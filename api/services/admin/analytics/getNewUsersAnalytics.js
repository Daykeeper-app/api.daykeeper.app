const User = require("../../../models/User")
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

  const rows = await aggregateDailyCount({
    model: User,
    match: buildDateFieldMatch({
      field: "created_at",
      from: range.from,
      to: range.to,
      extraMatch: createStatusMatch(),
    }),
    dateExpression: "$created_at",
  })

  const countsByBucket = asCountMap(rows)
  const series = mergeSeriesWithBuckets({
    buckets,
    seriesMap: countsByBucket,
    mapBucket: ({ value }) => ({
      count: value || 0,
    }),
  })

  const total = series.reduce((sum, item) => sum + item.count, 0)

  return {
    code: 200,
    message: "New users analytics fetched successfully",
    response: {
      range: {
        days: range.days,
        bucket: "day",
        timezone: range.timezone,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      totals: {
        users: total,
      },
      series,
    },
  }
}
