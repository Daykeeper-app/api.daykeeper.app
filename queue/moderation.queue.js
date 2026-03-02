const { Queue } = require("bullmq")
const IORedis = require("ioredis")

const {
  redis: { url: redisUrl },
} = require("../config")

const parseBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback
  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "yes", "on"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false
  return fallback
}
const verboseQueueLogs = parseBool(process.env.MODERATION_QUEUE_VERBOSE_LOGS, false)

const connection = new IORedis(redisUrl)
const parsedAttempts = Number(process.env.MODERATION_JOB_ATTEMPTS)
const moderationJobAttempts = Number.isInteger(parsedAttempts)
  ? Math.max(1, Math.min(parsedAttempts, 5))
  : 1

const moderationQueue = new Queue("moderationQueue", { connection })

function enqueueModeration({ mediaId, key, type, uploadedBy }) {
  return moderationQueue.add(
    "analyzeMedia",
    { mediaId, key, type, uploadedBy },
    {
      attempts: moderationJobAttempts,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: true,
    }
  )
}

if (verboseQueueLogs) {
  connection.on("ready", () => {
    console.log(`\x1b[36mRedis connected successfully\x1b[0m`)
  })
}

module.exports = { enqueueModeration, moderationQueue }
