const User = require("../../../models/User")

const { getTasksByDatePipeline } = require("../../../repositories/index")
const {
  getDayRangeDDMMYYYY,
  getTodayRange,
} = require("../../../utils/dayRange")
const getDataWithPages = require("../../getDataWithPages")

const {
  user: { defaultTimeZone },
  errors: { notFound, unauthorized },
  success: { fetched },
} = require("../../../../constants/index")

const isDDMMYYYY = (v) => typeof v === "string" && /^\d{2}-\d{2}-\d{4}$/.test(v)

const getTasksByDate = async (props) => {
  const { username, dateStr, loggedUser, order, page, maxPageSize } =
    props || {}

  if (!loggedUser?._id) {
    return unauthorized("Unauthorized", "Login required", 401)
  }

  const targetUser = await User.findOne({
    username,
    status: "public",
    verified_email: true,
  }).select("_id username")
  if (!targetUser) return notFound("User")

  const tz = loggedUser?.timeZone || defaultTimeZone
  let range = null
  let usedDateStr = null

  if (isDDMMYYYY(dateStr)) {
    const tryRange = getDayRangeDDMMYYYY(dateStr, tz)
    if (tryRange) {
      usedDateStr = dateStr
      range = tryRange
    }
  }

  if (!range) {
    range = getTodayRange(tz)
    usedDateStr = null
  }

  const tasks = await getDataWithPages({
    type: "Task",
    pipeline: getTasksByDatePipeline({
      mainUser: loggedUser,
      targetUserId: targetUser._id,
      start: range.start,
      end: range.end,
    }),
    order,
    page,
    maxPageSize,
  })

  return fetched("tasks", {
    props: {
      ...tasks,
      usedDate: usedDateStr,
    },
  })
}

module.exports = getTasksByDate
