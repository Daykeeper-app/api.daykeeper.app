require("dotenv").config()

const mongoose = require("mongoose")
const path = require("path")
const User = require("../api/models/User")
const awsS3Config = require("../api/config/awsS3Config")
const { buildMediaUrlFromKey } = require("../api/utils/cloudfrontMedia")
const {
  aws: { bucketName, storageType },
} = require("../config")

function hasFlag(args, flag) {
  return args.includes(flag)
}

function normalizeKey(value) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/^\/+/, "")
}

function extractKeyFromUrl(raw) {
  if (typeof raw !== "string") return ""
  const value = raw.trim()
  if (!value) return ""
  if (!/^https?:\/\//i.test(value)) return normalizeKey(value)

  try {
    const u = new URL(value)
    return decodeURIComponent(String(u.pathname || "")).replace(/^\/+/, "")
  } catch {
    return ""
  }
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${String(key || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`
}

async function moveStorageObject(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return toKey

  if (storageType === "s3") {
    await awsS3Config
      .copyObject({
        Bucket: bucketName,
        CopySource: encodeCopySource(bucketName, fromKey),
        Key: toKey,
      })
      .promise()

    await awsS3Config
      .deleteObject({
        Bucket: bucketName,
        Key: fromKey,
      })
      .promise()

    return toKey
  }

  return toKey
}

function targetProfileKey(userId, sourceKey) {
  const fileName = path.basename(String(sourceKey || "").trim() || `pfp-${Date.now()}`)
  return `public/users/${String(userId)}/profile/images/${fileName}`
}

async function run() {
  const args = process.argv.slice(2)
  const apply = hasFlag(args, "--apply")

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in env")
  }

  const stats = {
    scanned: 0,
    keyUpdated: 0,
    movedToPublicPrefix: 0,
    urlCleared: 0,
    skippedExternal: 0,
  }

  await mongoose.connect(process.env.MONGODB_URI)

  try {
    const cursor = User.find(
      {
        $or: [
          { "profile_picture.key": { $type: "string", $ne: "" } },
          { "profile_picture.url": { $type: "string", $ne: "" } },
        ],
      },
      { _id: 1, profile_picture: 1 }
    ).cursor()

    for await (const user of cursor) {
      stats.scanned += 1

      const pfp = user.profile_picture || {}
      const currentKey = normalizeKey(pfp.key)
      const currentUrl = typeof pfp.url === "string" ? pfp.url.trim() : ""

      // Google/external URL-only pfp should remain external.
      if (!currentKey && /^https?:\/\//i.test(currentUrl)) {
        stats.skippedExternal += 1
        continue
      }

      let nextKey = currentKey || extractKeyFromUrl(currentUrl)
      if (!nextKey) continue

      let moved = false
      if (!nextKey.startsWith("public/")) {
        const targetKey = targetProfileKey(user._id, nextKey)
        if (apply) await moveStorageObject(nextKey, targetKey)
        nextKey = targetKey
        moved = true
        stats.movedToPublicPrefix += 1
      }

      const canCompute = !!buildMediaUrlFromKey(nextKey)
      const shouldClearUrl = canCompute && !!currentUrl

      if (nextKey !== currentKey) stats.keyUpdated += 1
      if (shouldClearUrl) stats.urlCleared += 1

      if (apply && (nextKey !== currentKey || shouldClearUrl)) {
        const set = { "profile_picture.key": nextKey }
        if (shouldClearUrl) set["profile_picture.url"] = ""
        await User.updateOne({ _id: user._id }, { $set: set })
      }

      if (!apply && moved) {
        // dry-run noop marker
      }
    }
  } finally {
    await mongoose.disconnect()
  }

  console.log(`[profile-pfp-migration] mode=${apply ? "APPLY" : "DRY_RUN"}`)
  console.table(stats)
}

run().catch((error) => {
  console.error("[profile-pfp-migration] failed", error)
  process.exitCode = 1
})

