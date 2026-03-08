require("dotenv").config()

const path = require("path")
const mongoose = require("mongoose")
const User = require("../api/models/User")
const {
  user: { defaultPfp },
} = require("../constants")

function hasFlag(args, flag) {
  return args.includes(flag)
}

function normalizeKey(value) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/^\/+/, "")
}

function normalizeTitle(value) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function shouldSetToNewDefault(profilePicture = {}, options = {}) {
  const key = normalizeKey(profilePicture.key)
  const title = normalizeTitle(profilePicture.title)
  const url = typeof profilePicture.url === "string" ? profilePicture.url.trim() : ""
  const keyLower = key.toLowerCase()

  const newDefaultKey = normalizeKey(defaultPfp?.key)
  const oldDefaultKey = normalizeKey(options.oldDefaultKey || "public/defaults/Doggo.jpg")
  const oldDefaultTitle = normalizeTitle(options.oldDefaultTitle || "Doggo.jpg")

  // Already at new default.
  if (key === newDefaultKey) return false

  // Explicit old-default markers.
  if (key === oldDefaultKey) return true
  if (title === oldDefaultTitle) return true
  if (/Doggo\.jpg/i.test(url)) return true

  // Legacy per-user copied defaults, e.g. public/users/<id>/profile/images/Doggo.jpg
  if (
    keyLower.endsWith("/doggo.jpg") &&
    keyLower.includes("/profile/images/")
  ) {
    return true
  }

  // Broken/empty profile_picture payloads should move to new default.
  if (!key && !url) return true

  return false
}

async function run() {
  const args = process.argv.slice(2)
  const apply = hasFlag(args, "--apply")

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in env")
  }

  const stats = {
    scanned: 0,
    updated: 0,
    skippedAlreadyNewDefault: 0,
    skippedCustom: 0,
  }

  await mongoose.connect(process.env.MONGODB_URI)
  try {
    const cursor = User.find(
      {},
      { _id: 1, profile_picture: 1, username: 1 }
    ).cursor()

    for await (const user of cursor) {
      stats.scanned += 1

      const profilePicture = user.profile_picture || {}
      const currentKey = normalizeKey(profilePicture.key)
      const newDefaultKey = normalizeKey(defaultPfp?.key)

      if (currentKey === newDefaultKey) {
        stats.skippedAlreadyNewDefault += 1
        continue
      }

      if (!shouldSetToNewDefault(profilePicture)) {
        stats.skippedCustom += 1
        continue
      }

      if (apply) {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              profile_picture: {
                title: defaultPfp?.title || path.basename(newDefaultKey || "DaykeeperPFP.png"),
                key: newDefaultKey,
                url: "",
              },
            },
          }
        )
      }

      stats.updated += 1
    }
  } finally {
    await mongoose.disconnect()
  }

  console.log(`[default-pfp-migration] mode=${apply ? "APPLY" : "DRY_RUN"}`)
  console.table(stats)
}

run().catch((error) => {
  console.error("[default-pfp-migration] failed", error)
  process.exitCode = 1
})
