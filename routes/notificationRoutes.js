const express = require("express")
const router = express.Router()

const checkTokenMW = require("../middlewares/checkTokenMW")
const {
  getNotifications,
  getNotificationsWithoutMediaReview,
  getMediaReviewNotifications,
  markNotificationsRead,
} = require("../api/controllers/notificationController")

router.get("/", checkTokenMW, getNotifications)
router.get(
  "/without-media-review",
  checkTokenMW,
  getNotificationsWithoutMediaReview
)
router.get("/media-review", checkTokenMW, getMediaReviewNotifications)
router.patch("/read", checkTokenMW, markNotificationsRead)

module.exports = router
