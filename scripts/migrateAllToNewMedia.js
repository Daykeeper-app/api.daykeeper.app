require("dotenv").config()

const mongoose = require("mongoose")
const {
  runLegacyMediaMigration,
  parseBool,
} = require("../api/utils/migrateLegacyMediaToNewBucket")

function hasFlag(args, flag) {
  return args.includes(flag)
}

function getArgValue(args, name, fallback = "") {
  const prefix = `--${name}=`
  const hit = args.find((arg) => arg.startsWith(prefix))
  if (!hit) return fallback
  return hit.slice(prefix.length)
}

async function run() {
  const args = process.argv.slice(2)
  const apply = hasFlag(args, "--apply")
  const batchMedia = Number(getArgValue(args, "batchMedia", "5000")) || 5000
  const batchUsers = Number(getArgValue(args, "batchUsers", "5000")) || 5000
  const maxPasses = Number(getArgValue(args, "maxPasses", "100")) || 100
  const clearLegacyUrls = parseBool(
    getArgValue(args, "clearLegacyUrls", "true"),
    true
  )

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in env")
  }

  await mongoose.connect(process.env.MONGODB_URI)

  try {
    if (!apply) {
      const stats = await runLegacyMediaMigration({
        apply: false,
        maxMedia: batchMedia,
        maxUsers: batchUsers,
        clearLegacyUrls,
        legacyBucketName: process.env.LEGACY_BUCKET_NAME || "daykeeper",
      })

      console.log("[migrate-all-new-media] mode=DRY_RUN")
      console.table(stats)
      console.log(
        "Dry run completed. Re-run with --apply to migrate DB + copy files."
      )
      return
    }

    const total = {
      passes: 0,
      mediaScanned: 0,
      mediaUpdated: 0,
      mediaCopied: 0,
      mediaSkippedNewStyle: 0,
      mediaCopyErrors: 0,
      profileScanned: 0,
      profileUpdated: 0,
      profileCopied: 0,
      profileSkippedExternal: 0,
      profileCopyErrors: 0,
    }

    for (let pass = 1; pass <= maxPasses; pass += 1) {
      const stats = await runLegacyMediaMigration({
        apply: true,
        maxMedia: batchMedia,
        maxUsers: batchUsers,
        clearLegacyUrls,
        legacyBucketName: process.env.LEGACY_BUCKET_NAME || "daykeeper",
      })

      total.passes += 1
      for (const [k, v] of Object.entries(stats)) {
        total[k] += Number(v) || 0
      }

      console.log(`[migrate-all-new-media] pass=${pass}`)
      console.table(stats)

      const migratedThisPass =
        (stats.mediaUpdated || 0) + (stats.profileUpdated || 0)

      if (migratedThisPass === 0) {
        console.log(
          "[migrate-all-new-media] completed: no legacy media left in current batch scan."
        )
        break
      }
    }

    console.log("[migrate-all-new-media] mode=APPLY summary")
    console.table(total)
  } finally {
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error("[migrate-all-new-media] failed", error)
  process.exitCode = 1
})
