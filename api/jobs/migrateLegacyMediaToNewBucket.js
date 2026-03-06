const cron = require("node-cron")
const mongoose = require("mongoose")
const {
  runLegacyMediaMigration,
  parseBool,
} = require("../utils/migrateLegacyMediaToNewBucket")

const isEnabled = parseBool(process.env.MIGRATE_LEGACY_MEDIA_JOB_ENABLED, false)
if (!isEnabled) {
  module.exports = {}
  return
}

const cronExpr = String(
  process.env.MIGRATE_LEGACY_MEDIA_CRON || "20 * * * *"
).trim()

if (!cron.validate(cronExpr)) {
  console.error(
    "[legacy-media-migration-job] invalid cron expression:",
    cronExpr
  )
  module.exports = {}
  return
}

let running = false

async function runOnce() {
  if (running) return
  running = true
  try {
    if (mongoose.connection.readyState !== 1) return
    const stats = await runLegacyMediaMigration({
      apply: true,
      maxMedia: Number(process.env.MIGRATE_LEGACY_MEDIA_BATCH_MEDIA || 500),
      maxUsers: Number(process.env.MIGRATE_LEGACY_MEDIA_BATCH_USERS || 500),
      clearLegacyUrls: true,
      legacyBucketName: process.env.LEGACY_BUCKET_NAME || "daykeeper",
    })
    console.log("[legacy-media-migration-job] batch done", stats)
  } catch (error) {
    console.error(
      "[legacy-media-migration-job] batch failed:",
      error?.message || String(error)
    )
  } finally {
    running = false
  }
}

cron.schedule(cronExpr, runOnce)

if (parseBool(process.env.MIGRATE_LEGACY_MEDIA_RUN_ON_START, false)) {
  setTimeout(() => {
    runOnce().catch?.(() => null)
  }, 15000)
}

module.exports = { runOnce }

