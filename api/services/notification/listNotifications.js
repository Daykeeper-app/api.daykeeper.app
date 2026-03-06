const getDataWithPages = require("../getDataWithPages")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")
const Notification = require("../../models/Notification")
const {
  errors: { unauthorized },
  success: { fetched },
} = require("../../../constants/index")

const MEDIA_REVIEW_NOTIFICATION_TYPES = [
  "media_review",
  "media_approved",
  "media_rejected",
  "media_moderation",
  "post_media_approved",
  "post_media_rejected",
  "profile_media_approved",
  "profile_media_rejected",
  "profile_picture_approved",
  "profile_picture_rejected",
]

const getNotificationRoute = (notification) => {
  const type = notification?.type
  const data = notification?.data || {}

  switch (type) {
    case "new_follower":
    case "follow_request_accepted":
      return data.username ? `/${data.username}` : null
    case "follow_request":
      return "/settings/follow-requests"
    case "post_like":
    case "post_comment":
    case "comment_like":
    case "comment_reply":
    case "post_mention":
      return data.postId ? `/post/${data.postId}` : null
    case "welcome":
      return "/"
    default:
      return null
  }
}

function parseOptionalBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return null

  const normalized = value.trim().toLowerCase()
  if (["true", "1", "yes"].includes(normalized)) return true
  if (["false", "0", "no"].includes(normalized)) return false
  return null
}

async function listNotifications(props = {}, options = {}) {
  const { loggedUser, page, maxPageSize, read } = props
  const mode = options.mode || "all" // all | media_only | exclude_media

  if (!loggedUser?._id) return unauthorized("fetch notifications")

  const match = { user: loggedUser._id }

  if (mode === "media_only") {
    match.type = { $in: MEDIA_REVIEW_NOTIFICATION_TYPES }
  } else if (mode === "exclude_media") {
    match.type = { $nin: MEDIA_REVIEW_NOTIFICATION_TYPES }
  }

  const parsedRead = parseOptionalBoolean(read)
  if (parsedRead !== null) match.read = parsedRead

  const response = await getDataWithPages({
    type: "Notification",
    pipeline: [{ $match: match }],
    page,
    maxPageSize,
    order: "recent",
  })

  const data = (response.data || []).map((notification) => ({
    ...serializeMediaPayload(notification),
    seen: Boolean(notification?.read),
    route: getNotificationRoute(notification),
  }))

  const unreadCount = await Notification.countDocuments({
    user: loggedUser._id,
    read: false,
  })

  return fetched("notifications", {
    response: {
      ...response,
      data,
      unreadCount,
      hasUnread: unreadCount > 0,
    },
  })
}

module.exports = {
  listNotifications,
  MEDIA_REVIEW_NOTIFICATION_TYPES,
}
