const { Types } = require("mongoose")
const postValidationPipeline = require("./postValidationPipeline")
const {
  user: { defaultTimeZone },
} = require("../../../constants/index")

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

const postInfoPipeline = (mainUser) => {
  const mainUserId = toObjectIdOrNull(mainUser?._id)
  const tz = mainUser?.timeZone || defaultTimeZone

  return [
    ...postValidationPipeline(mainUser),

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
                  $cond: [{ $eq: ["$userId", mainUserId] }, 1, 0],
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
              userCommentedCount: {
                $sum: {
                  $cond: [{ $eq: ["$userId", mainUserId] }, 1, 0],
                },
              },
            },
          },
        ],
        as: "comment_info",
      },
    },
    { $unwind: { path: "$comment_info", preserveNullAndEmptyArrays: true } },

    // computed fields (keep date as Date)
    {
      $addFields: {
        likes: { $ifNull: ["$like_info.totalLikes", 0] },
        userLiked: { $gt: ["$like_info.userLiked", 0] },
        comments: { $ifNull: ["$comment_info.totalComments", 0] },
        userCommented: {
          $gt: [{ $ifNull: ["$comment_info.userCommentedCount", 0] }, 0],
        },
        relevance: {
          $add: [
            { $ifNull: ["$like_info.totalLikes", 0] },
            { $ifNull: ["$comment_info.totalComments", 0] },
          ],
        },

        isOwner: {
          $cond: [
            {
              $and: [
                { $ne: [mainUserId, null] },
                { $eq: ["$user", mainUserId] },
              ],
            },
            true,
            false,
          ],
        },

        // optional
        timeZoneMatch: { $eq: ["$user_info.timeZone", tz] },
      },
    },

    // keep fields you need
    {
      $project: {
        _id: 1,
        date: 1, // IMPORTANT: keep as Date
        data: 1,
        emotion: 1,
        user: 1,
        media: 1,
        privacy: 1,
        status: 1,
        created_at: 1,
        edited_at: 1,
        isOwner: 1,

        likes: 1,
        userLiked: 1,
        comments: 1,
        userCommented: 1,
        relevance: 1,
        timeZoneMatch: 1,

        user_info: 1,
        following_info: 1,
        isInCloseFriends: 1,
      },
    },
  ]
}

module.exports = postInfoPipeline
