const { listNotifications } = require("./listNotifications")

const getNotificationsWithoutMediaReview = async (props) =>
  listNotifications(props, { mode: "exclude_media" })

module.exports = getNotificationsWithoutMediaReview
