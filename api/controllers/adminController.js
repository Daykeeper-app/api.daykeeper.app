const {
  maxPageSize: DEFAULT_MAX_PAGE_SIZE,
  errors: { serverError },
} = require("../../constants/index")

const deleteReport = require("../services/admin/deleteReport")
const getReportedElements = require("../services/admin/getReportedElements")
const getBannedElements = require("../services/admin/getBannedElements")
const getBanHistoryMadeByAdmin = require("../services/admin/getBanHistoryMadeByAdmin")
const getElementBanHistory = require("../services/admin/getElementBanHistory")

const banOrUnbanUser = require("../services/admin/user/banOrUnbanUser")
const deleteBannedUser = require("../services/admin/user/deleteBannedUser")

const banOrUnbanPost = require(`../services/admin/post/banOrUnbanPost`)
const deleteBannedPosts = require(`../services/admin/post/deleteBannedPost`)

const deleteReportController = async (req, res) => {
  try {
    const { code, message } = await deleteReport({
      ...req.params,
    })

    return res.status(code).json({ message })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const getReportedElementsController = async (req, res) => {
  const entity_type = req.query?.type == "user" ? req.query?.type : "post"
  const page = Number(req.query.page) || 1
  const maxPageSize = req.query.maxPageSize
    ? Number(req.query.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getReportedElements({
      page,
      maxPageSize,
      entity_type,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const getBannedElementsController = async (req, res) => {
  const entity_type = req.query?.type == "user" ? req.query?.type : "post"
  const page = Number(req.query.page) || 1
  const maxPageSize = req.query.pageSize
    ? Number(req.query.pageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query.pageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getBannedElements({
      page,
      maxPageSize,
      loggedUser: req.user,
      entity_type,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const getElementBanHistoryController = async (req, res) => {
  const page = Number(req.query.page) || 1
  const maxPageSize = req.query.pageSize
    ? Number(req.query.pageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query.pageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getElementBanHistory({
      page,
      maxPageSize,
      elementId: req.params.elementId,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// ========== GET BAN HISOTRY ============
const getBanHistoryMadeByAdminController = async (req, res) => {
  const entity_type = req.query?.type == "user" ? req.query?.type : "post"
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getBanHistoryMadeByAdmin({
      page,
      maxPageSize,
      username: req.params?.username,
      entity_type,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// ========== USERS ==========
const banOrUnbanUserController = async (req, res) => {
  try {
    const { code, message, reason, user } = await banOrUnbanUser({
      ...req.params,
      message: req.body.message || "",
      loggedUser: req.user,
    })

    return res.status(code).json({ message, reason, user })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const deleteBannedUserController = async (req, res) => {
  try {
    const { code, message, ban_info, user } = await deleteBannedUser({
      ...req.params,
      message: req.body.message || ``,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ban_info, user })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// =========== POSTS ==========
const banOrUnbanPostController = async (req, res) => {
  try {
    const { code, message, post } = await banOrUnbanPost({
      ...req.params,
      reason: req.body.reason || "",
      loggedUser: req.user,
    })

    return res.status(code).json({
      message,
      post,
    })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const deleteBannedPostController = async (req, res) => {
  try {
    const { code, message, post } = await deleteBannedPosts({
      ...req.params,
      message: req.body.message || "",
      loggedUser: req.user,
    })

    return res.status(code).json({ message, post })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

module.exports = {
  deleteReport: deleteReportController,
  getReportedElements: getReportedElementsController,
  getBannedElements: getBannedElementsController,
  getBanHistoryMadeByAdmin: getBanHistoryMadeByAdminController,
  getElementBanHistory: getElementBanHistoryController,

  banOrUnbanUser: banOrUnbanUserController,
  deleteBannedUser: deleteBannedUserController,

  banOrUnbanPost: banOrUnbanPostController,
  deleteBannedPost: deleteBannedPostController,
}
