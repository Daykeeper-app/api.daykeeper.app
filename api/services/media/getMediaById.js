const Media = require("../../models/Media")

const {
  errors: { inputTooLong, notFound },
  success: { fetched },
} = require("../../../constants/index")

const getMediaById = async (props) => {
  const { mediaId } = props

  if (mediaId?.length > 100) return inputTooLong("Media ID")

  try {
    const media = await Media.findById(mediaId).lean()
    if (!media) return notFound("Media")

    return fetched("Media", { media })
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = getMediaById
