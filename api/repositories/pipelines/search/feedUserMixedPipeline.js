const { Types } = require("mongoose")
const hideUserData = require("../../hideProject/hideUserData")
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

const feedUserMixedPipeline = (
  mainUser,
  { dateStr = null, maxPostsPerUser = DEFAULT_MAXPOSTSPERUSER } = {}
) => {
  const tz = mainUser?.timeZone || defaultTimeZone
  const mainUserId = toObjectIdOrNull(mainUser?._id)

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
    { $match: { status: "public", banned: { $ne: true } } },

    // follow info
    {
      $lookup: {
        from: "followers",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$requested", true] },
                  { $ne: ["$status", "deleted"] },
                  {
                    $or: [
                      { $eq: ["$followingId", "$$userId"] },
                      { $eq: ["$followerId", "$$userId"] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 0, followerId: 1, followingId: 1 } },
        ],
        as: "_followRels",
      },
    },
    {
      $addFields: {
        followers: {
          $size: {
            $filter: {
              input: "$_followRels",
              as: "r",
              cond: { $eq: ["$$r.followingId", "$_id"] },
            },
          },
        },
        following: {
          $size: {
            $filter: {
              input: "$_followRels",
              as: "r",
              cond: { $eq: ["$$r.followerId", "$_id"] },
            },
          },
        },
        isFollowing: {
          $cond: [
            { $eq: ["$_id", mainUserId] },
            0,
            {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$_followRels",
                          as: "r",
                          cond: {
                            $and: [
                              { $eq: ["$$r.followerId", mainUserId] },
                              { $eq: ["$$r.followingId", "$_id"] },
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
                1,
                0,
              ],
            },
          ],
        },
      },
    },

    // close friends relationship
    {
      $lookup: {
        from: "closeFriends",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $eq: ["$closeFriendId", mainUserId] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "isInCloseFriends",
      },
    },
    {
      $addFields: {
        isCloseFriend: {
          $max: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$isInCloseFriends", []] } }, 0] },
              1,
              0,
            ],
          },
        },
      },
    },

    // hide private users if not following (but allow self)
    {
      $match: {
        $expr: {
          $or: [
            { $ne: ["$private", true] },
            { $eq: ["$_id", mainUserId] },
            { $gt: ["$isFollowing", 0] },
          ],
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

    // posts list
    {
      $lookup: {
        from: "posts",
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
          ...require("../../common/postValidationPipeline")(mainUser),
          // likes
          {
            $lookup: {
              from: "postLikes",
              let: { postId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$postId", "$$postId"] },
                        { $ne: ["$status", "deleted"] },
                      ],
                    },
                  },
                },
                {
                  $group: {
                    _id: null,
                    totalLikes: { $sum: 1 },
                    userLiked: {
                      $sum: {
                        $cond: [
                          { $eq: ["$userId", mainUserId] },
                          1,
                          0,
                        ],
                      },
                    },
                  },
                },
              ],
              as: "like_info",
            },
          },
          { $unwind: { path: "$like_info", preserveNullAndEmptyArrays: true } },
          // comments
          {
            $lookup: {
              from: "postComments",
              let: { postId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$postId", "$$postId"] },
                        { $ne: ["$status", "deleted"] },
                      ],
                    },
                  },
                },
                {
                  $group: {
                    _id: null,
                    totalComments: { $sum: 1 },
                    userCommented: {
                      $push: {
                        $cond: [
                          { $eq: ["$userId", mainUserId] },
                          {
                            comment: "$comment",
                            gif: "$gif",
                            created_at: "$created_at",
                          },
                          false,
                        ],
                      },
                    },
                  },
                },
              ],
              as: "comment_info",
            },
          },
          { $unwind: { path: "$comment_info", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              likes: { $ifNull: ["$like_info.totalLikes", 0] },
              userLiked: { $gt: ["$like_info.userLiked", 0] },
              comments: { $ifNull: ["$comment_info.totalComments", 0] },
              userCommented: { $ifNull: ["$comment_info.userCommented", false] },
              relevance: {
                $add: [
                  { $ifNull: ["$like_info.totalLikes", 0] },
                  { $ifNull: ["$comment_info.totalComments", 0] },
                ],
              },
              isOwner: { $eq: ["$user", mainUserId] },
            },
          },
        ],
        as: "posts",
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

    // events list (include multi-day span)
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
                  { $lte: ["$dateStart", "$$dayEnd"] },
                  {
                    $gte: [
                      { $ifNull: ["$dateEnd", "$dateStart"] },
                      "$$dayStart",
                    ],
                  },
                ],
              },
            },
          },
          { $match: { $expr: visibilityExpr } },
          {
            $addFields: {
              _isStartDay: {
                $and: [
                  { $gte: ["$dateStart", "$$dayStart"] },
                  { $lt: ["$dateStart", "$$dayEnd"] },
                ],
              },
              _createdParts: {
                $dateToParts: { date: "$createdAt", timezone: tz },
              },
            },
          },
          {
            $addFields: {
              sortDate: {
                $cond: [
                  "$_isStartDay",
                  {
                    $dateFromParts: {
                      year: { $year: { date: "$$dayStart", timezone: tz } },
                      month: { $month: { date: "$$dayStart", timezone: tz } },
                      day: { $dayOfMonth: { date: "$$dayStart", timezone: tz } },
                      hour: "$_createdParts.hour",
                      minute: "$_createdParts.minute",
                      second: 0,
                      millisecond: 0,
                      timezone: tz,
                    },
                  },
                  "$$dayStart",
                ],
              },
            },
          },
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
              sortDate: 1,
            },
          },
        ],
        as: "event_items",
      },
    },

    // counts
    {
      $addFields: {
        postsCount: { $size: "$posts" },
        notesCount: { $size: "$note_items" },
        tasksCount: { $size: "$task_items" },
        eventsCount: { $size: "$event_items" },
      },
    },

    // include only users that have at least one item today
    {
      $match: {
        $expr: {
          $gt: [
            { $add: ["$postsCount", "$notesCount", "$tasksCount", "$eventsCount"] },
            0,
          ],
        },
      },
    },

    // mixed items + sorting
    {
      $addFields: {
        mixedItems: {
          $concatArrays: [
            {
              $map: {
                input: "$posts",
                as: "p",
                in: { type: "post", sortDate: "$$p.date", item: "$$p" },
              },
            },
            {
              $map: {
                input: "$note_items",
                as: "n",
                in: { type: "note", sortDate: "$$n.date", item: "$$n" },
              },
            },
            {
              $map: {
                input: "$task_items",
                as: "t",
                in: { type: "task", sortDate: "$$t.date", item: "$$t" },
              },
            },
            {
              $map: {
                input: "$event_items",
                as: "e",
                in: {
                  type: "event",
                  sortDate: { $ifNull: ["$$e.sortDate", "$$e.dateStart"] },
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

    // last post time
    {
      $addFields: {
        lastPostTime: {
          $cond: [
            { $gt: [{ $size: "$mixedItems" }, 0] },
            time12hExpr({ $arrayElemAt: ["$mixedItems.sortDate", 0] }, tz),
            null,
          ],
        },
      },
    },

    { $project: { _followRels: 0, isInCloseFriends: 0 } },

    // user_info projection
    {
      $addFields: {
        user_info: {
          _id: "$_id",
          username: "$username",
          displayName: "$displayName",
          email: "$email",
          profile_picture: "$profile_picture",
          timeZone: "$timeZone",
          bio: "$bio",
          verified_email: "$verified_email",
          private: "$private",
          roles: "$roles",
          currentStreak: "$currentStreak",
          maxStreak: "$maxStreak",
          streakLastDay: "$streakLastDay",
          created_at: "$created_at",
          banned: "$banned",
          status: "$status",
          deletedAt: "$deletedAt",
        },
      },
    },
    { $project: { ...hideUserData, name: 0 } },

    // final shape
    {
      $project: {
        _id: 1,
        user_info: 1,
        isFollowing: 1,
        isCloseFriend: 1,
        postsCount: 1,
        notesCount: 1,
        tasksCount: 1,
        eventsCount: 1,
        lastPostTime: 1,
        userRelevance: 1,
        created_at: 1,
        relevance: 1,
        timeZoneMatch: 1,
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
              text: "$$m.item.text",
              title: "$$m.item.title",
              completed: { $ifNull: ["$$m.item.completed", false] },
              description: "$$m.item.description",
              location: "$$m.item.location",
              dateEnd: "$$m.item.dateEnd",
            },
          },
        },
      },
    },
  ]
}

module.exports = feedUserMixedPipeline
