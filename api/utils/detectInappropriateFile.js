const Media = require("../models/Media")

const parseBoundedNumber = (value, fallback, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

const trustedThreshold = parseBoundedNumber(
  process.env.MODERATION_TRUST_THRESHOLD,
  70,
  0,
  100
)
const trustedSkipRateImage = parseBoundedNumber(
  process.env.MODERATION_TRUSTED_SKIP_RATE_IMAGE,
  0.8,
  0,
  1
)
const trustedSkipRateVideo = parseBoundedNumber(
  process.env.MODERATION_TRUSTED_SKIP_RATE_VIDEO,
  0.9,
  0,
  1
)

const detectInappropriateContent = async (
  key,
  type = "image",
  mediaId,
  trustScore,
  uploadedBy
) => {
  const skipRate = type === "video" ? trustedSkipRateVideo : trustedSkipRateImage
  const shouldSkip = trustScore >= trustedThreshold && Math.random() < skipRate

  if (shouldSkip) {
    await Media.findByIdAndUpdate(mediaId, {
      status: "public",
      verified: false,
      skippedModeration: true,
    })
    return true
  }

  const { enqueueModeration } = require("../../queue/moderation.queue")
  await enqueueModeration({
    key,
    type,
    mediaId,
    uploadedBy,
  })

  // For videos, createMediaDocsMW already persists pending + verified=false.
  // For images, force pending while moderation runs.
  if (type === "image") {
    await Media.findByIdAndUpdate(mediaId, {
      status: "pending",
      verified: false,
    })
  }

  return true
}

module.exports = detectInappropriateContent
