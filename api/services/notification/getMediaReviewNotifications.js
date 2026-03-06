const { listNotifications } = require("./listNotifications")

const getMediaReviewNotifications = async (props) =>
  listNotifications(props, { mode: "media_only" })

module.exports = getMediaReviewNotifications
