const DEFAULT_DAYS = 30
const MAX_DAYS = 365
const DEFAULT_TIMEZONE = "UTC"

const parseDays = (value) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAYS

  return Math.min(Math.floor(parsed), MAX_DAYS)
}

const createDateLabel = (date) => {
  return date.toISOString().slice(0, 10)
}

const createRange = ({ days }) => {
  const safeDays = parseDays(days)
  const now = new Date()
  const from = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (safeDays - 1),
      0,
      0,
      0,
      0
    )
  )

  return {
    days: safeDays,
    from,
    to: now,
    timezone: DEFAULT_TIMEZONE,
  }
}

const createDailyBuckets = ({ from, to }) => {
  const buckets = []
  const cursor = new Date(from)
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 0, 0, 0, 0)
  )

  while (cursor <= end) {
    const bucketStart = new Date(cursor)
    buckets.push({
      bucket: createDateLabel(bucketStart),
      bucketStart: bucketStart.toISOString(),
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return buckets
}

const createStatusMatch = () => ({
  status: { $ne: "deleted" },
})

const aggregateDailyCount = async ({ model, match = {}, dateExpression }) => {
  const pipeline = [
    {
      $match: {
        ...match,
      },
    },
    {
      $project: {
        bucket: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: dateExpression,
            timezone: DEFAULT_TIMEZONE,
          },
        },
      },
    },
    {
      $group: {
        _id: "$bucket",
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]

  return model.aggregate(pipeline)
}

const buildDateFieldMatch = ({ field, from, to, extraMatch = {} }) => ({
  ...extraMatch,
  [field]: {
    $gte: from,
    $lte: to,
  },
})

const buildObjectIdDateMatch = ({ from, to, extraMatch = {} }) => ({
  ...extraMatch,
  $expr: {
    $and: [
      {
        $gte: [{ $toDate: "$_id" }, from],
      },
      {
        $lte: [{ $toDate: "$_id" }, to],
      },
    ],
  },
})

const mergeSeriesWithBuckets = ({ buckets, seriesMap = new Map(), mapBucket }) => {
  return buckets.map(({ bucket, bucketStart }, index) => ({
    bucket,
    bucketStart,
    ...mapBucket({
      value: seriesMap.get(bucket),
      bucket,
      bucketStart,
      index,
    }),
  }))
}

const asCountMap = (rows) => {
  return new Map(rows.map((row) => [row._id, row.count]))
}

const readyStateLabels = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
}

module.exports = {
  DEFAULT_DAYS,
  MAX_DAYS,
  DEFAULT_TIMEZONE,
  parseDays,
  createRange,
  createDailyBuckets,
  createStatusMatch,
  aggregateDailyCount,
  buildDateFieldMatch,
  buildObjectIdDateMatch,
  mergeSeriesWithBuckets,
  asCountMap,
  readyStateLabels,
}
