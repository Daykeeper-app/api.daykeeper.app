const Notification = require("../../models/Notification")
const mongoose = require("mongoose")
const {
  errors: { unauthorized, fieldNotFilledIn },
  success: { updated },
} = require("../../../constants/index")

function normalizeNotificationIds(ids) {
  if (!Array.isArray(ids)) return []

  return ids
    .map((item) => {
      if (!item) return null
      if (typeof item === "string") return item.trim()
      if (typeof item === "object") {
        if (typeof item._id === "string") return item._id.trim()
        if (typeof item.id === "string") return item.id.trim()
      }
      return null
    })
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
}

const markNotificationsRead = async (props) => {
  const { loggedUser, ids, all } = props

  if (!loggedUser?._id) return unauthorized("update notifications")

  const normalizedIds = normalizeNotificationIds(ids)

  if (!all && normalizedIds.length === 0) {
    return fieldNotFilledIn("ids")
  }

  let result
  if (all) {
    result = await Notification.updateMany(
      { user: loggedUser._id, read: false },
      { $set: { read: true } }
    )
  } else {
    result = await Notification.updateMany(
      { user: loggedUser._id, _id: { $in: normalizedIds } },
      { $set: { read: true } }
    )
  }

  return updated("notifications", {
    matched: result.matchedCount ?? result.n,
    modified: result.modifiedCount ?? result.nModified,
  })
}

module.exports = markNotificationsRead
