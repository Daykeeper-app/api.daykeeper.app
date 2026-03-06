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
  const maxMedia = Number(getArgValue(args, "maxMedia", "5000")) || 5000
  const maxUsers = Number(getArgValue(args, "maxUsers", "5000")) || 5000
  const clearLegacyUrls = parseBool(
    getArgValue(args, "clearLegacyUrls", "true"),
    true
  )

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in env")
  }

  await mongoose.connect(process.env.MONGODB_URI)
  try {
    const stats = await runLegacyMediaMigration({
      apply,
      maxMedia,
      maxUsers,
      clearLegacyUrls,
      legacyBucketName: process.env.LEGACY_BUCKET_NAME || "daykeeper",
    })

    console.log(
      `[legacy-media-migration] mode=${apply ? "APPLY" : "DRY_RUN"}`
    )
    console.table(stats)
  } finally {
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error("[legacy-media-migration] failed", error)
  process.exitCode = 1
})

