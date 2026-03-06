const hideUserData = require("../../hideProject/hideUserData")

const dayElementValidationPipeline = (mainUser) => [
  {
    $lookup: {
      from: "users",
      let: { userId: "$user" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
        { $project: hideUserData },
      ],
      as: "user_info",
    },
  },
  { $unwind: { path: "$user_info", preserveNullAndEmptyArrays: false } },

  // following relationship
  {
    $lookup: {
      from: "followers",
      let: { eventUserId: "$user_info._id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$followerId", mainUser._id] },
                { $eq: ["$followingId", "$$eventUserId"] },
              ],
            },
          },
        },
        { $project: { _id: 1 } },
        { $limit: 1 },
      ],
      as: "following_info",
    },
  },

  // block relationship (me -> them)
  {
    $lookup: {
      from: "blocks",
      let: { eventUserId: "$user_info._id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$blockId", mainUser._id] },
                { $eq: ["$blockedId", "$$eventUserId"] },
              ],
            },
          },
        },
        { $project: { _id: 1 } },
        { $limit: 1 },
      ],
      as: "block_info",
    },
  },

  // block relationship (them -> me)
  {
    $lookup: {
      from: "blocks",
      let: { eventUserId: "$user_info._id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$blockId", "$$eventUserId"] },
                { $eq: ["$blockedId", mainUser._id] },
              ],
            },
          },
        },
        { $project: { _id: 1 } },
        { $limit: 1 },
      ],
      as: "blocked_by_owner_info",
    },
  },

  // close friends relationship
  {
    $lookup: {
      from: "closeFriends",
      let: { eventUserId: "$user_info._id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$userId", "$$eventUserId"] },
                { $eq: ["$closeFriendId", mainUser._id] },
              ],
            },
          },
        },
        { $project: { _id: 1 } },
        { $limit: 1 },
      ],
      as: "isInCloseFriends",
    },
  },

  // access control
  {
    $match: {
      $and: [
        { "block_info.0": { $exists: false } },
        { status: "public" },
        { "blocked_by_owner_info.0": { $exists: false } },

        { "user_info.banned": { $ne: true } },
        {
          $or: [
            { "user_info.verified_email": { $ne: false } },
            { "user_info._id": mainUser._id },
          ],
        },

        // privacy rules
        {
          $or: [
            { $or: [{ privacy: "public" }, { privacy: { $exists: false } }] },

            // private: only owner can see
            {
              $and: [{ privacy: "private" }, { "user_info._id": mainUser._id }],
            },

            // close friends: owner OR close friend can see
            {
              $and: [
                { privacy: "close friends" },
                {
                  $or: [
                    { "user_info._id": mainUser._id },
                    { "isInCloseFriends.0": { $exists: true } },
                  ],
                },
              ],
            },
          ],
        },

        // if user is private, require following, but owner can always see
        {
          $or: [
            { "user_info.private": { $ne: true } },
            { "following_info.0": { $exists: true } },
            { "user_info._id": mainUser._id },
          ],
        },
      ],
    },
  },
]

module.exports = dayElementValidationPipeline
