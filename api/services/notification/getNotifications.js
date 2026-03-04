const getDataWithPages = require("../getDataWithPages")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")
const Notification = require("../../models/Notification")
const {
  errors: { unauthorized },
  success: { fetched },
} = require("../../../constants/index")

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

const getNotifications = async (props) => {
  const { loggedUser, page, maxPageSize, read } = props

  if (!loggedUser?._id) return unauthorized("fetch notifications")

  const match = { user: loggedUser._id }
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

module.exports = getNotifications
