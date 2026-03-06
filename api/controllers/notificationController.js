const {
  maxPageSize: DEFAULT_MAX_PAGE_SIZE,
  errors: { serverError },
} = require("../../constants/index")

const getNotifications = require("../services/notification/getNotifications")
const getNotificationsWithoutMediaReview = require("../services/notification/getNotificationsWithoutMediaReview")
const getMediaReviewNotifications = require("../services/notification/getMediaReviewNotifications")
const markNotificationsRead = require("../services/notification/markNotificationsRead")

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false

  const normalized = value.trim().toLowerCase()
  return ["true", "1", "yes", "on"].includes(normalized)
}

const getNotificationsController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE
  const read = req.query?.read

  try {
    const { code, message, response } = await getNotifications({
      loggedUser: req.user,
      page,
      maxPageSize,
      read,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

const getNotificationsWithoutMediaReviewController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE
  const read = req.query?.read

  try {
    const { code, message, response } = await getNotificationsWithoutMediaReview({
      loggedUser: req.user,
      page,
      maxPageSize,
      read,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

const getMediaReviewNotificationsController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE
  const read = req.query?.read

  try {
    const { code, message, response } = await getMediaReviewNotifications({
      loggedUser: req.user,
      page,
      maxPageSize,
      read,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

const markNotificationsReadController = async (req, res) => {
  try {
    const { code, message, matched, modified, unreadCount, hasUnread } =
      await markNotificationsRead({
      loggedUser: req.user,
      ids: req.body?.ids,
      all: parseBoolean(req.body?.all),
    })

    return res
      .status(code)
      .json({ message, matched, modified, unreadCount, hasUnread })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

module.exports = {
  getNotifications: getNotificationsController,
  getNotificationsWithoutMediaReview:
    getNotificationsWithoutMediaReviewController,
  getMediaReviewNotifications: getMediaReviewNotificationsController,
  markNotificationsRead: markNotificationsReadController,
}
