const getDataWithPages = require("../getDataWithPages")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")
const Notification = require("../../models/Notification")
const {
  errors: { unauthorized },
  success: { fetched },
} = require("../../../constants/index")

const MEDIA_REVIEW_TITLE_FRAGMENT = "media review"

function isMediaReviewNotification(notification) {
  const title = String(notification?.title || "").toLowerCase()
  return title.includes(MEDIA_REVIEW_TITLE_FRAGMENT)
}

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
  // mode filtering for split endpoints is done in-code via title match

  const parsedRead = parseOptionalBoolean(read)
  if (parsedRead !== null) match.read = parsedRead

  let response
  let rawData

  if (mode === "all") {
    response = await getDataWithPages({
      type: "Notification",
      pipeline: [{ $match: match }],
      page,
      maxPageSize,
      order: "recent",
    })
    rawData = response.data || []
  } else {
    const p = Math.max(1, Number(page) || 1)
    const size = Math.max(1, Number(maxPageSize) || 20)
    const skip = (p - 1) * size

    const allRows = await Notification.find(match)
      .sort({ created_at: -1, _id: -1 })
      .lean()

    const filtered = allRows.filter((row) =>
      mode === "media_only"
        ? isMediaReviewNotification(row)
        : !isMediaReviewNotification(row)
    )

    rawData = filtered.slice(skip, skip + size)
    response = {
      data: rawData,
      page: p,
      pageSize: rawData.length,
      maxPageSize: size,
      totalPages: filtered.length ? Math.ceil(filtered.length / size) : 0,
      totalCount: filtered.length,
    }
  }

  const data = rawData.map((notification) => ({
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
  MEDIA_REVIEW_TITLE_FRAGMENT,
}
