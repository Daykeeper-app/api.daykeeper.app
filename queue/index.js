const parseBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback
  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "yes", "on"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false
  return fallback
}
const verboseQueueLogs = parseBool(process.env.MODERATION_QUEUE_VERBOSE_LOGS, false)

// Run all workers
if (verboseQueueLogs) console.log("[queues] Booting workers...")
require("./moderation.worker")
if (verboseQueueLogs) console.log("[queues] All workers initialized")
