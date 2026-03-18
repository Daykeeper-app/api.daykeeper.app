const express = require("express")
const router = express.Router()
const {
  deleteReport,
  getReportedElements,
  getBannedElements,
  getBanHistoryMadeByAdmin,
  getElementBanHistory,
  getNewUsersAnalytics,
  getNewContentAnalytics,
  getNewInteractionsAnalytics,
  getServerStatus,

  banOrUnbanUser,
  deleteBannedUser,

  banOrUnbanPost,
  deleteBannedPost,
} = require("../api/controllers/adminController")

// Middlewares
const checkTokenMW = require("../middlewares/checkTokenMW")
const checkAdminMW = require("../middlewares/checkAdminMW")

router.delete("/report/:reportId", checkTokenMW, checkAdminMW, deleteReport)
router.get(
  "/banHistoryByAdmin/:username", // type = 'user' || 'post'
  checkTokenMW,
  checkAdminMW,
  getBanHistoryMadeByAdmin
)
router.get("/reports", checkTokenMW, checkAdminMW, getReportedElements)
router.get("/bans", checkTokenMW, checkAdminMW, getBannedElements)
router.get("/about/users", getNewUsersAnalytics)
router.get("/about/content", getNewContentAnalytics)
router.get("/about/interactions", getNewInteractionsAnalytics)
router.get("/about/server-status", getServerStatus)
router.get(
  "/banHistory/:elementId",
  checkTokenMW,
  checkAdminMW,
  getElementBanHistory
)

// User
router.post("/:username", checkTokenMW, checkAdminMW, banOrUnbanUser)
router.delete("/:username", checkTokenMW, checkAdminMW, deleteBannedUser)

// Post
router.post("/post/:postId", checkTokenMW, checkAdminMW, banOrUnbanPost)
router.delete("/post/:postId", checkTokenMW, checkAdminMW, deleteBannedPost)

module.exports = router
