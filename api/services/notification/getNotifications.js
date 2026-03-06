const { listNotifications } = require("./listNotifications")

const getNotifications = async (props) =>
  listNotifications(props, { mode: "all" })

module.exports = getNotifications
