const mongoose = require("mongoose")
const {
  runLegacyMediaMigration,
  parseBool,
} = require("../utils/migrateLegacyMediaToNewBucket")

const enabled = parseBool(process.env.MIGRATE_PROFILE_PICTURES_ON_START, false)
if (!enabled) {
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
      includeMedia: false,
      includeProfiles: true,
      maxUsers: Number(process.env.MIGRATE_PROFILE_PICTURES_BATCH_USERS || 2000),
      clearLegacyUrls: true,
      legacyBucketName: process.env.LEGACY_BUCKET_NAME || "daykeeper",
    })

    console.log("[profile-picture-migration-on-start] done", stats)
  } catch (error) {
    console.error(
      "[profile-picture-migration-on-start] failed:",
      error?.message || String(error)
    )
  } finally {
    running = false
  }
}

// give DB connection a few seconds to settle after boot
setTimeout(() => {
  runOnce().catch?.(() => null)
}, 15000)

module.exports = { runOnce }

