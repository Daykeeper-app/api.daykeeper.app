const mongoose = require("mongoose")
const PostComments = require("../../models/PostComments")
const getPost = require("./getPost")
const {
  errors: { invalidValue, notFound },
  success: { fetched },
} = require("../../../constants/index")
const hideUserData = require("../../repositories/hideProject/hideUserData")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

const getCommentById = async (props) => {
  const { commentId, loggedUser } = props

  if (!mongoose.Types.ObjectId.isValid(commentId))
    return invalidValue("Comment ID")

  const comment = await PostComments.findOne({
    _id: commentId,
    status: { $ne: "deleted" },
  })
  if (!comment) return notFound("Comment")

  const postResponse = await getPost({ postId: comment.postId, loggedUser })
  if (postResponse.code !== 200) return notFound("Post")

  const commentData = await PostComments.aggregate([
    { $match: { _id: comment._id } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        pipeline: [{ $project: hideUserData }],
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 1,
        postId: 1,
        parentCommentId: 1,
        comment: 1,
        gif: 1,
        created_at: 1,
        user: 1,
      },
    },
  ])

  return fetched("Comment", { data: serializeMediaPayload(commentData?.[0] || null) })
}

module.exports = getCommentById
