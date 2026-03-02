const getDataWithPages = require("../getDataWithPages")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")
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

const getNotifications = async (props) => {
  const { loggedUser, page, maxPageSize, read } = props

  if (!loggedUser?._id) return unauthorized("fetch notifications")

  const match = { user: loggedUser._id }
  if (read === "true") match.read = true
  if (read === "false") match.read = false

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

  return fetched("notifications", { response: { ...response, data } })
}

module.exports = getNotifications
