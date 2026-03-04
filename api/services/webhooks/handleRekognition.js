const Post = require("../../models/Post")
const Media = require("../../models/Media")
const User = require("../../models/User")
const axios = require("axios")
const https = require("https")
const AWS = require("aws-sdk")
const banOrUnbanUser = require("../admin/user/banOrUnbanUser")

const {
  inappropriateLabels,
  messages: {
    admin: { inapropriateMediaBanMessage },
  },
} = require("../../../constants/index")
const {
  aws: { accessKeyId, secretAccessKey, defaultRegion },
} = require(`../../../config`)

AWS.config.update({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
  region: defaultRegion,
})

const rekognition = new AWS.Rekognition()

const handleRekognition = async (req) => {
  try {
    const type = req.headers["x-amz-sns-message-type"]

    let body
    try {
      body = JSON.parse(req.body)
    } catch (err) {
      console.error("Invalid SNS message:", err)
      return { code: 400, message: "Invalid SNS message" }
    }

    /* If the server just wants to confirm the subscription */
    if (type === "SubscriptionConfirmation") {
      console.log("Confirming subscription:", body.SubscribeURL)
      await axios.get(body.SubscribeURL, {
        httpsAgent: new https.Agent({ rejectUnauthorized: true }),
      })
      console.log("subscription confirmed")
      return { code: 200, message: "SNS confirmed" }
    }

    /* Server just verified a Media */
    if (type === "Notification") {
      const msg = JSON.parse(body.Message)
      const jobId = msg.JobId
      const media = await Media.findOne({ jobId })
      if (!media) {
        console.log("Media not found")
        return { code: 200, message: "Media not found" }
      }

      /* Verify media */
      const result = await rekognition
        .getContentModeration({ JobId: jobId })
        .promise()

      const flagged = result.ModerationLabels.some(
        (label) =>
          inappropriateLabels.includes(label.ModerationLabel.Name) &&
          label.ModerationLabel.Confidence > 90
      )

      media.status = flagged ? "rejected" : "public"
      media.verified = true
      await media.save()

      if (media.status == "rejected") {
        const user = await User.findOne({ _id: media.uploadedBy })

        if (user && !user?.banned)
          await banOrUnbanUser({
            username: user.username,
            message: inapropriateMediaBanMessage,
          })
      }

      /* Verify all medias related */
      const allMedia = await Media.find({
        "usedIn.refId": media.usedIn.refId,
      })

      // Check if all medias from that post have been processed
      const stillPending = allMedia.some((m) => m.status === "pending")
      if (stillPending) {
        console.log("Some media still pending. Skipping post status update.")
        return { code: 200, message: "Waiting for all media to be moderated" }
      }

      // If every media was processed, update post status to 'public' or 'rejected'
      const someRejected = allMedia.some((m) => m.status === "rejected")
      const newStatus = someRejected ? "rejected" : "public"

      console.log(`All media moderated. Setting post to: ${newStatus}`)

      if (media.usedIn?.model === "Post") {
        await Post.findByIdAndUpdate(media.usedIn.refId, {
          status: newStatus,
        })
      }

      return { code: 200, message: "Handled video moderation result" }
    }

    return { code: 200, message: "No-op" }
  } catch (error) {
    console.error(error)
    return { code: 500, message: "Webhook Error, please contact an admin" }
  }
}

module.exports = handleRekognition
