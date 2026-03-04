const Post = require("../../models/Post")
const DayTask = require("../../models/DayTask")
const DayEvent = require("../../models/DayEvent")
const CloseFriends = require("../../models/CloseFriends")
const findUser = require("./get/findUser")
const {
  user: { defaultTimeZone },
  errors: { notFound, invalidValue },
  success: { fetched },
} = require("../../../constants/index")

function parseDays(input) {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return 365
  const int = Math.trunc(parsed)
  if (int < 7) return 7
  if (int > 3650) return 3650
  return int
}

function parseEndDate(input) {
  if (!input) return new Date()
  const date = new Date(input)
  if (!Number.isFinite(date.getTime())) return null
  return date
}

function parseStartDate(input) {
  if (!input) return null
  const date = new Date(input)
  if (!Number.isFinite(date.getTime())) return null
  return date
}

function formatDateInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const d = parts.find((p) => p.type === "day")?.value
  return `${y}-${m}-${d}`
}

function privacyMatch({ isOwner, isCloseFriend }) {
  if (isOwner) return {}
  if (isCloseFriend) {
    return {
      $or: [
        { privacy: "public" },
        { privacy: { $exists: false } },
        { privacy: "close friends" },
      ],
    }
  }
  return {
    $or: [{ privacy: "public" }, { privacy: { $exists: false } }],
  }
}

async function aggregateDailyCounts({
  Model,
  userId,
  dateField,
  startDate,
  endDate,
  timeZone,
  visibility,
  extraMatch = {},
}) {
  const match = {
    user: userId,
    status: "public",
    [dateField]: { $gte: startDate, $lte: endDate },
    ...visibility,
    ...extraMatch,
  }

  const rows = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: `$${dateField}`,
            timezone: timeZone,
          },
        },
        count: { $sum: 1 },
      },
    },
  ])

  return Object.fromEntries(rows.map((r) => [r._id, r.count]))
}

const getUserCalendar = async (props) => {
  const { username, loggedUser, days, endDate, startDate, scope, fetchedUser } =
    props

  const targetUser =
    fetchedUser || (await findUser({ userInput: username, hideData: false }))
  if (!targetUser) return notFound("User")

  const parsedEndDate = parseEndDate(endDate)
  if (!parsedEndDate) return invalidValue("endDate")
  const parsedStartDate = parseStartDate(startDate)
  if (startDate && !parsedStartDate) return invalidValue("startDate")

  const end = new Date(parsedEndDate)
  let start
  let rangeDays

  if (String(scope || "").trim().toLowerCase() === "all") {
    start = new Date(targetUser.created_at || targetUser._id?.getTimestamp?.() || end)
    rangeDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    )
  } else if (parsedStartDate) {
    start = new Date(parsedStartDate)
    if (start > end) return invalidValue("startDate")
    rangeDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    )
  } else {
    rangeDays = parseDays(days)
    start = new Date(end)
    start.setUTCDate(start.getUTCDate() - (rangeDays - 1))
  }

  const isOwner = String(targetUser._id) === String(loggedUser._id)
  const isCloseFriend = isOwner
    ? true
    : !!(await CloseFriends.exists({
        userId: targetUser._id,
        closeFriendId: loggedUser._id,
        status: { $ne: "deleted" },
      }))

  const visibility = privacyMatch({ isOwner, isCloseFriend })
  const timeZone = targetUser.timeZone || defaultTimeZone

  const [postCounts, taskCounts, eventCounts] = await Promise.all([
    aggregateDailyCounts({
      Model: Post,
      userId: targetUser._id,
      dateField: "date",
      startDate: start,
      endDate: end,
      timeZone,
      visibility,
      extraMatch: { banned: { $ne: true } },
    }),
    aggregateDailyCounts({
      Model: DayTask,
      userId: targetUser._id,
      dateField: "date",
      startDate: start,
      endDate: end,
      timeZone,
      visibility,
      extraMatch: { daily: { $ne: true } },
    }),
    aggregateDailyCounts({
      Model: DayEvent,
      userId: targetUser._id,
      dateField: "dateStart",
      startDate: start,
      endDate: end,
      timeZone,
      visibility,
    }),
  ])

  const points = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const key = formatDateInTimeZone(cursor, timeZone)
    const postsCount = postCounts[key] || 0
    const tasksCount = taskCounts[key] || 0
    const eventsCount = eventCounts[key] || 0
    const count = postsCount + tasksCount + eventsCount

    points.push({
      date: key,
      count,
      postsCount,
      tasksCount,
      eventsCount,
      interactions: [
        { type: "post", count: postsCount },
        { type: "task", count: tasksCount },
        { type: "event", count: eventsCount },
      ],
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const maxCount = points.reduce((max, p) => Math.max(max, p.count), 0)
  const withLevel = points.map((p) => {
    if (p.count === 0 || maxCount === 0) return { ...p, level: 0 }
    const ratio = p.count / maxCount
    if (ratio <= 0.25) return { ...p, level: 1 }
    if (ratio <= 0.5) return { ...p, level: 2 }
    if (ratio <= 0.75) return { ...p, level: 3 }
    return { ...p, level: 4 }
  })

  const total = withLevel.reduce((sum, p) => sum + p.count, 0)

  return fetched("calendar", {
    data: {
      userId: targetUser._id,
      username: targetUser.username,
      timeZone,
      days: rangeDays,
      from: withLevel[0]?.date || null,
      to: withLevel[withLevel.length - 1]?.date || null,
      range: {
        scope:
          String(scope || "").trim().toLowerCase() === "all"
            ? "all"
            : parsedStartDate
            ? "custom"
            : "rolling",
        startDate: withLevel[0]?.date || null,
        endDate: withLevel[withLevel.length - 1]?.date || null,
      },
      totalCount: total,
      maxCount,
      points: withLevel,
    },
  })
}

module.exports = getUserCalendar
