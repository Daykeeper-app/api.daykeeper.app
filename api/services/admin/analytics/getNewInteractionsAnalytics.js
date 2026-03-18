const PostComments = require("../../../models/PostComments")
const PostLikes = require("../../../models/PostLikes")
const CommentLikes = require("../../../models/CommentLikes")
const {
  createRange,
  createDailyBuckets,
  createStatusMatch,
  aggregateDailyCount,
  buildDateFieldMatch,
  buildObjectIdDateMatch,
  mergeSeriesWithBuckets,
  asCountMap,
} = require("./shared")

module.exports = async ({ days }) => {
  const range = createRange({ days })
  const buckets = createDailyBuckets(range)
  const statusMatch = createStatusMatch()

  const [commentsRows, postLikesRows, commentLikesRows] = await Promise.all([
    aggregateDailyCount({
      model: PostComments,
      match: buildDateFieldMatch({
        field: "created_at",
        from: range.from,
        to: range.to,
        extraMatch: statusMatch,
      }),
      dateExpression: "$created_at",
    }),
    aggregateDailyCount({
      model: PostLikes,
      match: buildObjectIdDateMatch({
        from: range.from,
        to: range.to,
        extraMatch: statusMatch,
      }),
      dateExpression: { $toDate: "$_id" },
    }),
    aggregateDailyCount({
      model: CommentLikes,
      match: buildObjectIdDateMatch({
        from: range.from,
        to: range.to,
        extraMatch: statusMatch,
      }),
      dateExpression: { $toDate: "$_id" },
    }),
  ])

  const commentsMap = asCountMap(commentsRows)
  const postLikesMap = asCountMap(postLikesRows)
  const commentLikesMap = asCountMap(commentLikesRows)

  const series = mergeSeriesWithBuckets({
    buckets,
    mapBucket: ({ bucket }) => {
      const comments = commentsMap.get(bucket) || 0
      const postLikes = postLikesMap.get(bucket) || 0
      const commentLikes = commentLikesMap.get(bucket) || 0
      const likes = postLikes + commentLikes

      return {
        total: comments + likes,
        comments,
        likes,
        postLikes,
        commentLikes,
      }
    },
  })

  const totals = series.reduce(
    (acc, item) => ({
      total: acc.total + item.total,
      comments: acc.comments + item.comments,
      likes: acc.likes + item.likes,
      postLikes: acc.postLikes + item.postLikes,
      commentLikes: acc.commentLikes + item.commentLikes,
    }),
    {
      total: 0,
      comments: 0,
      likes: 0,
      postLikes: 0,
      commentLikes: 0,
    }
  )

  return {
    code: 200,
    message: "New interactions analytics fetched successfully",
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
