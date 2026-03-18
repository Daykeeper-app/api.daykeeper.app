const Post = require("../../../models/Post")
const DayTask = require("../../../models/DayTask")
const DayEvent = require("../../../models/DayEvent")
const {
  createRange,
  createDailyBuckets,
  createStatusMatch,
  aggregateDailyCount,
  buildDateFieldMatch,
  mergeSeriesWithBuckets,
  asCountMap,
} = require("./shared")

module.exports = async ({ days }) => {
  const range = createRange({ days })
  const buckets = createDailyBuckets(range)
  const statusMatch = createStatusMatch()

  const [postsRows, tasksRows, eventsRows] = await Promise.all([
    aggregateDailyCount({
      model: Post,
      match: buildDateFieldMatch({
        field: "created_at",
        from: range.from,
        to: range.to,
        extraMatch: statusMatch,
      }),
      dateExpression: "$created_at",
    }),
    aggregateDailyCount({
      model: DayTask,
      match: buildDateFieldMatch({
        field: "createdAt",
        from: range.from,
        to: range.to,
        extraMatch: statusMatch,
      }),
      dateExpression: "$createdAt",
    }),
    aggregateDailyCount({
      model: DayEvent,
      match: buildDateFieldMatch({
        field: "createdAt",
        from: range.from,
        to: range.to,
        extraMatch: statusMatch,
      }),
      dateExpression: "$createdAt",
    }),
  ])

  const postsMap = asCountMap(postsRows)
  const tasksMap = asCountMap(tasksRows)
  const eventsMap = asCountMap(eventsRows)

  const series = mergeSeriesWithBuckets({
    buckets,
    mapBucket: ({ bucket }) => {
      const posts = postsMap.get(bucket) || 0
      const tasks = tasksMap.get(bucket) || 0
      const events = eventsMap.get(bucket) || 0

      return {
        total: posts + tasks + events,
        posts,
        tasks,
        events,
      }
    },
  })

  const totals = series.reduce(
    (acc, item) => ({
      total: acc.total + item.total,
      posts: acc.posts + item.posts,
      tasks: acc.tasks + item.tasks,
      events: acc.events + item.events,
    }),
    { total: 0, posts: 0, tasks: 0, events: 0 }
  )

  return {
    code: 200,
    message: "New content analytics fetched successfully",
    response: {
      range: {
        days: range.days,
        bucket: "day",
        timezone: range.timezone,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      totals,
      series,
    },
  }
}
