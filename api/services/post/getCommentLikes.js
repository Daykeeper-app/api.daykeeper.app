const Post = require("../../models/Post")
const PostComments = require("../../models/PostComments")
const getDataWithPages = require("../getDataWithPages")
const {
  getCommentLikesPipeline,
  getPostPipeline,
} = require("../../repositories/index")

const {
  errors: { notFound },
  success: { fetched },
} = require("../../../constants/index")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

const getCommentLikes = async (props) => {
  const { commentId, loggedUser, page, maxPageSize } = props

  try {
    const comment = await PostComments.findOne({
      _id: commentId,
      status: { $ne: "deleted" },
    })
    if (!comment) return notFound("Comment")

    const post = await Post.aggregate(
      getPostPipeline(comment.postId, loggedUser)
    )
    if (!post?.[0]) return notFound("Post")

    const usersThatLiked = await getDataWithPages({
      pipeline: getCommentLikesPipeline(commentId),
      type: "CommentLikes",
      page,
      maxPageSize,
    })

    return fetched(`Comment Likes`, {
      response: {
        post: serializeMediaPayload(post[0]),
        commentId,
        ...usersThatLiked,
      },
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = getCommentLikes
