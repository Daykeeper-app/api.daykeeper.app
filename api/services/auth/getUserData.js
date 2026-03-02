const User = require("../../models/User")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

module.exports = async function getUserData({ userId }) {
  const user = await User.findById(userId).select(
    "_id username displayName email profile_picture roles verified_email timeZone private"
  )

  if (!user || user.status === "deleted") {
    return { code: 404, message: "User not found", user: null }
  }

  return {
    code: 200,
    message: "User data",
    user: serializeMediaPayload(user.toObject()),
  }
}
