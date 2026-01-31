const { Types } = require("mongoose")
const postInfoPipeline = require("../../common/postInfoPipeline")
const {
  user: { defaultTimeZone },
  maxPostsPerUser: DEFAULT_MAXPOSTSPERUSER,
} = require("../../../../constants/index")

function toObjectIdOrNull(value) {
  try {
    if (!value) return null
    if (value instanceof Types.ObjectId) return value
    if (Types.ObjectId.isValid(value)) return new Types.ObjectId(value)
    return null
  } catch {
    return null
  }
}
function time12hExpr(dateExpr, tz) {
  return {
    $let: {
      vars: {
        h24: { $hour: { date: dateExpr, timezone: tz } },
        m: { $dateToString: { format: "%M", date: dateExpr, timezone: tz } },
      },
      in: {
        $concat: [
          {
            $toString: {
              $cond: [
                { $eq: ["$$h24", 0] },
                12,
                {
                  $cond: [
                    { $gt: ["$$h24", 12] },
                    { $subtract: ["$$h24", 12] },
                    "$$h24",
                  ],
                },
              ],
            },
          },
          ":",
          "$$m",
          " ",
          { $cond: [{ $lt: ["$$h24", 12] }, "AM", "PM"] },
        ],
      },
    },
  }
}

const FOLLOW_FIRST_BOOST = 1e9

const feedPostPipeline = (
  mainUser,
  {
    scope = "a",
    dateStr = null,
    orderMode = "recent",
    maxPostsPerUser = DEFAULT_MAXPOSTSPERUSER,
  } = {},
) => {
  const tz = mainUser?.timeZone || defaultTimeZone
  const mainUserId = toObjectIdOrNull(mainUser?._id)

  const wantRelevanceSort =
    orderMode === "relevant" || orderMode === "follow_first"

  const dayStartExpr = dateStr
    ? {
        $dateTrunc: {
          date: {
            $dateFromString: {
              dateString: dateStr,
              format: "%d-%m-%Y",
              timezone: tz,
              onError: null,
              onNull: null,
            },
          },
          unit: "day",
          timezone: tz,
        },
      }
    : { $dateTrunc: { date: "$$NOW", unit: "day", timezone: tz } }

  const dayMatchStage = {
    $match: {
      $expr: {
        $eq: [
          { $dateTrunc: { date: "$date", unit: "day", timezone: tz } },
          dayStartExpr,
        ],
      },
    },
  }

  const visibilityExpr = {
    $or: [
      { $eq: ["$user", "$$viewerId"] },
      {
        $or: [
          { $eq: ["$privacy", "public"] },
          { $eq: [{ $type: "$privacy" }, "missing"] },
        ],
      },
      {
        $and: [
          { $eq: ["$privacy", "close friends"] },
          { $eq: ["$$isCloseFriend", 1] },
        ],
      },
    ],
  }

  return [
    ...postInfoPipeline(mainUser),

    // only the requested day (or today)
    dayMatchStage,

    // scope filter (following)
    ...(scope === "following"
      ? [
          {
            $match: {
              $or: [
                { "user_info._id": mainUserId },
                { "following_info.0": { $exists: true } },
              ],
            },
          },
        ]
      : []),

    // order posts inside each user BEFORE grouping
    ...(wantRelevanceSort
      ? [{ $sort: { "user_info._id": 1, relevance: -1, date: 1, _id: -1 } }]
      : [{ $sort: { "user_info._id": 1, date: -1, _id: 1 } }]),

    // group by user
    {
      $group: {
        _id: "$user_info._id",
        user_info: { $first: "$user_info" },

        isFollowing: {
          $max: {
            $cond: [
              {
                $or: [
                  { $eq: ["$user_info._id", mainUserId] },
                  { $gt: [{ $size: { $ifNull: ["$following_info", []] } }, 0] },
                ],
              },
              1,
              0,
            ],
          },
        },

        isCloseFriend: {
          $max: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$isInCloseFriends", []] } }, 0] },
              1,
              0,
            ],
          },
        },

        latestPostAt: { $max: "$date" },
        userRelevance: { $sum: "$relevance" },

        posts: {
          $push: {
            _id: "$_id",
            date: "$date",
            edited_at: "$edited_at",
            data: "$data",
            privacy: "$privacy",
            media: "$media",
            isOwner: "$isOwner",

            likes: "$likes",
            userLiked: "$userLiked",
            comments: "$comments",
            userCommented: "$userCommented",

            relevance: "$relevance",
          },
        },
      },
    },

    { $addFields: { dayStart: dayStartExpr } },
    {
      $addFields: {
        dayEnd: {
          $dateAdd: { startDate: "$dayStart", unit: "day", amount: 1 },
        },
      },
    },

    // notes count
    {
      $lookup: {
        from: "dayNote",
        let: {
          uid: "$_id",
          dayStart: "$dayStart",
          dayEnd: "$dayEnd",
          viewerId: mainUserId,
          isCloseFriend: "$isCloseFriend",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$uid"] },
                  { $gte: ["$date", "$$dayStart"] },
                  { $lt: ["$date", "$$dayEnd"] },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          { $count: "count" },
        ],
        as: "note_count",
      },
    },
    {
      $addFields: {
        notesCount: {
          $ifNull: [{ $arrayElemAt: ["$note_count.count", 0] }, 0],
        },
      },
    },

    // tasks count
    {
      $lookup: {
        from: "dayTask",
        let: {
          uid: "$_id",
          dayStart: "$dayStart",
          dayEnd: "$dayEnd",
          viewerId: mainUserId,
          isCloseFriend: "$isCloseFriend",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$uid"] },
                  { $gte: ["$date", "$$dayStart"] },
                  { $lt: ["$date", "$$dayEnd"] },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          { $count: "count" },
        ],
        as: "task_count",
      },
    },
    {
      $addFields: {
        tasksCount: {
          $ifNull: [{ $arrayElemAt: ["$task_count.count", 0] }, 0],
        },
      },
    },

    // events count
    {
      $lookup: {
        from: "dayEvent",
        let: {
          uid: "$_id",
          dayStart: "$dayStart",
          dayEnd: "$dayEnd",
          viewerId: mainUserId,
          isCloseFriend: "$isCloseFriend",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$uid"] },
                  { $gte: ["$dateStart", "$$dayStart"] },
                  { $lt: ["$dateStart", "$$dayEnd"] },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          { $count: "count" },
        ],
        as: "event_count",
      },
    },
    {
      $addFields: {
        eventsCount: {
          $ifNull: [{ $arrayElemAt: ["$event_count.count", 0] }, 0],
        },
      },
    },

    // paging sort + extra stats
    {
      $addFields: {
        created_at: "$latestPostAt",
        relevance:
          orderMode === "follow_first"
            ? {
                $add: [
                  "$userRelevance",
                  {
                    $cond: [
                      { $eq: ["$isFollowing", 1] },
                      FOLLOW_FIRST_BOOST,
                      0,
                    ],
                  },
                ],
              }
            : "$userRelevance",

        timeZoneMatch: 1,

        postsCount: { $size: "$posts" },
        lastPostTime: time12hExpr("$latestPostAt", tz),
      },
    },
    // keep only the 3 posts
    {
      $addFields: {
        posts: { $slice: ["$posts", maxPostsPerUser] },
      },
    },

    // notes list
    {
      $lookup: {
        from: "dayNote",
        let: {
          uid: "$_id",
          dayStart: "$dayStart",
          dayEnd: "$dayEnd",
          viewerId: mainUserId,
          isCloseFriend: "$isCloseFriend",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$uid"] },
                  { $gte: ["$date", "$$dayStart"] },
                  { $lt: ["$date", "$$dayEnd"] },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          {
            $project: {
              _id: 1,
              text: 1,
              privacy: 1,
              user: 1,
              date: 1,
              created_at: 1,
            },
          },
        ],
        as: "note_items",
      },
    },

    // tasks list
    {
      $lookup: {
        from: "dayTask",
        let: {
          uid: "$_id",
          dayStart: "$dayStart",
          dayEnd: "$dayEnd",
          viewerId: mainUserId,
          isCloseFriend: "$isCloseFriend",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$uid"] },
                  { $gte: ["$date", "$$dayStart"] },
                  { $lt: ["$date", "$$dayEnd"] },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          {
            $project: {
              _id: 1,
              title: 1,
              completed: 1,
              privacy: 1,
              user: 1,
              date: 1,
              created_at: 1,
            },
          },
        ],
        as: "task_items",
      },
    },

    // events list
    {
      $lookup: {
        from: "dayEvent",
        let: {
          uid: "$_id",
          dayStart: "$dayStart",
          dayEnd: "$dayEnd",
          viewerId: mainUserId,
          isCloseFriend: "$isCloseFriend",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$uid"] },
                  { $gte: ["$dateStart", "$$dayStart"] },
                  { $lt: ["$dateStart", "$$dayEnd"] },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              location: 1,
              privacy: 1,
              user: 1,
              dateStart: 1,
              dateEnd: 1,
              createdAt: 1,
            },
          },
        ],
        as: "event_items",
      },
    },

    // build mixed items
    {
      $addFields: {
        mixedItems: {
          $concatArrays: [
            {
              $map: {
                input: "$posts",
                as: "p",
                in: {
                  type: "post",
                  sortDate: "$$p.date",
                  item: "$$p",
                },
              },
            },
            {
              $map: {
                input: "$note_items",
                as: "n",
                in: {
                  type: "note",
                  sortDate: "$$n.date",
                  item: "$$n",
                },
              },
            },
            {
              $map: {
                input: "$task_items",
                as: "t",
                in: {
                  type: "task",
                  sortDate: "$$t.date",
                  item: "$$t",
                },
              },
            },
            {
              $map: {
                input: "$event_items",
                as: "e",
                in: {
                  type: "event",
                  sortDate: "$$e.dateStart",
                  item: "$$e",
                },
              },
            },
          ],
        },
      },
    },
    {
      $addFields: {
        mixedItems: {
          $slice: [
            { $sortArray: { input: "$mixedItems", sortBy: { sortDate: -1 } } },
            maxPostsPerUser,
          ],
        },
      },
    },

    {
      $unset: ["note_count", "task_count", "event_count", "dayStart", "dayEnd"],
    },

    // final shape
    {
      $project: {
        _id: 1,
        user_info: 1,

        isFollowing: 1,
        isCloseFriend: 1,

        postsCount: 1,
        lastPostTime: 1,
        notesCount: 1,
        tasksCount: 1,
        eventsCount: 1,

        userRelevance: 1,

        data: {
          $map: {
            input: "$mixedItems",
            as: "m",
            in: {
              type: "$$m.type",
              id: "$$m.item._id",
              time: time12hExpr("$$m.sortDate", tz),
              date: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$$m.sortDate",
                  timezone: tz,
                },
              },
              content: "$$m.item.data",
              privacy: "$$m.item.privacy",
              media: "$$m.item.media",
              isOwner: "$$m.item.isOwner",

              likes: "$$m.item.likes",
              userLiked: "$$m.item.userLiked",
              comments: "$$m.item.comments",
              userCommented: "$$m.item.userCommented",

              edited_at: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$$m.item.edited_at",
                  timezone: tz,
                },
              },

              relevance: "$$m.item.relevance",

              // notes
              text: "$$m.item.text",

              // tasks
              title: "$$m.item.title",
              completed: "$$m.item.completed",

              // events
              description: "$$m.item.description",
              location: "$$m.item.location",
              dateEnd: "$$m.item.dateEnd",
            },
          },
        },

        created_at: 1,
        relevance: 1,
        timeZoneMatch: 1,
      },
    },
  ]
}

module.exports = feedPostPipeline
