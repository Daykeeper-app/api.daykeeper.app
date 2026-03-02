const Post = require("../../models/Post")
const getPostPipeline = require("../../repositories/pipelines/post/getPostPipeline")
const mongoose = require("mongoose")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

const {
  errors: { notFound, invalidValue },
  success: { fetched },
} = require("../../../constants/index")

const getPost = async ({ postId, loggedUser }) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(postId)) return invalidValue("Post ID")

    const post = await Post.aggregate(getPostPipeline(postId, loggedUser))

    if (!post || post?.length == 0) return notFound("Post")

    return fetched("post", { data: serializeMediaPayload(post[0]) })
  } catch (error) {
    console.error(error)
    throw new Error(error.message)
  }
}

module.exports = getPost
