const Media = require("../../models/Media")
const Post = require("../../models/Post")
const mongoose = require("mongoose")
const getPostPipeline = require("../../repositories/pipelines/post/getPostPipeline")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

const {
  errors: { inputTooLong, notFound },
  success: { fetched },
} = require("../../../constants/index")

const getMediaById = async (props) => {
  const { mediaId, loggedUser } = props

  if (mediaId?.length > 100) return inputTooLong("Media ID")

  try {
    const media = await Media.findById(mediaId).lean()
    if (!media) return notFound("Media")
    if (media.status !== "public") return notFound("Media")

    if (media?.usedIn?.model === "Post" && media?.usedIn?.refId) {
      const postId = String(media.usedIn.refId)
      if (!mongoose.Types.ObjectId.isValid(postId)) return notFound("Media")

      const authorizedPost = await Post.aggregate(getPostPipeline(postId, loggedUser))
      if (!authorizedPost?.[0]) return notFound("Media")
    }

    return fetched("Media", { media: serializeMediaPayload(media) })
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = getMediaById
