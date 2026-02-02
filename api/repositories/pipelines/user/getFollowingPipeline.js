const userInfoPipeline = require("../../common/userInfoPipeline")

const getFollowingPipeline = (userId, mainUser) => [
  {
    $match: {
      $and: [
        {
          followerId: userId,
        },
        {
          $or: [{ requested: false }, { requested: { $exists: false } }],
        },
      ],
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "followingId",
      foreignField: "_id",
      as: "followingInfo",
    },
  },
  {
    $unwind: "$followingInfo",
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: [{ followingId: "$followingId" }, "$followingInfo"],
      },
    },
  },
  ...userInfoPipeline(mainUser),
]

module.exports = getFollowingPipeline
