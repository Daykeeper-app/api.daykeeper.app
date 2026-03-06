const path = require("path")
const Media = require("../models/Media")
const Post = require("../models/Post")
const User = require("../models/User")
const awsS3Config = require("../config/awsS3Config")
const {
  aws: { bucketName: targetBucketName, storageType },
} = require("../../config")
const {
  getPrivacyPrefix,
  buildTargetMediaKey,
} = require("./postMediaPrivacy")

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback
  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "yes", "on"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false
  return fallback
}

function normalizeKey(value) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/^\/+/, "")
}

function isNewStyleKey(key) {
  const normalized = normalizeKey(key)
  return normalized.startsWith("public/") || normalized.startsWith("private/")
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${String(key || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(String(pathname || ""))
  } catch {
    return String(pathname || "")
  }
}

function parseBucketAndKeyFromUrl(raw) {
  if (typeof raw !== "string" || !/^https?:\/\//i.test(raw.trim())) return null

  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }

  const host = String(u.hostname || "").toLowerCase()
  const pathname = decodePathname(u.pathname).replace(/^\/+/, "")
  if (!pathname) return null

  // bucket.s3.amazonaws.com/key
  let match = host.match(/^([^.]+)\.s3\.amazonaws\.com$/)
  if (match) return { bucket: match[1], key: pathname }

  // bucket.s3.us-east-1.amazonaws.com/key
  match = host.match(/^([^.]+)\.s3\.[^.]+\.amazonaws\.com$/)
  if (match) return { bucket: match[1], key: pathname }

  // s3.amazonaws.com/bucket/key
  if (host === "s3.amazonaws.com") {
    const [bucket, ...parts] = pathname.split("/")
    if (bucket && parts.length) return { bucket, key: parts.join("/") }
  }

  // s3.us-east-1.amazonaws.com/bucket/key
  if (/^s3\.[^.]+\.amazonaws\.com$/.test(host)) {
    const [bucket, ...parts] = pathname.split("/")
    if (bucket && parts.length) return { bucket, key: parts.join("/") }
  }

  return null
}

async function copyObjectIfNeeded({ sourceBucket, sourceKey, targetKey, apply }) {
  if (!sourceBucket || !sourceKey || !targetBucketName || !targetKey) {
    return { copied: false, reason: "missing_fields" }
  }

  if (
    sourceBucket === targetBucketName &&
    normalizeKey(sourceKey) === normalizeKey(targetKey)
  ) {
    return { copied: false, reason: "same_key" }
  }

  if (!apply || storageType !== "s3") {
    return { copied: false, reason: "dry_run_or_non_s3" }
  }

  await awsS3Config
    .copyObject({
      Bucket: targetBucketName,
      CopySource: encodeCopySource(sourceBucket, sourceKey),
      Key: targetKey,
    })
    .promise()

  return { copied: true }
}

async function runLegacyMediaMigration({
  apply = false,
  maxMedia = 1000,
  maxUsers = 1000,
  legacyBucketName = process.env.LEGACY_BUCKET_NAME || "daykeeper",
  clearLegacyUrls = true,
} = {}) {
  const stats = {
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

  const postCache = new Map()

  const mediaCursor = Media.find(
    {},
    { _id: 1, key: 1, url: 1, usedIn: 1, status: 1 }
  )
    .limit(Math.max(1, Number(maxMedia) || 1000))
    .cursor()

  for await (const media of mediaCursor) {
    stats.mediaScanned += 1

    const key = normalizeKey(media.key)
    if (isNewStyleKey(key)) {
      stats.mediaSkippedNewStyle += 1
      if (clearLegacyUrls && apply && typeof media.url === "string" && media.url) {
        await Media.updateOne({ _id: media._id }, { $set: { url: "" } })
      }
      continue
    }

    const parsedFromUrl = parseBucketAndKeyFromUrl(media.url)
    const sourceKey = parsedFromUrl?.key || key
    const sourceBucket = parsedFromUrl?.bucket || legacyBucketName
    if (!sourceKey) continue

    let targetKey = ""
    if (media.usedIn?.model === "Post" && media.usedIn?.refId) {
      const postId = String(media.usedIn.refId)
      let post = postCache.get(postId)
      if (post === undefined) {
        post = await Post.findById(postId).select("_id user privacy").lean()
        postCache.set(postId, post || null)
      }

      if (post?._id && post?.user) {
        const privacyPrefix = getPrivacyPrefix(post.privacy)
        targetKey = buildTargetMediaKey({
          currentKey: sourceKey,
          privacyPrefix,
          userId: String(post.user),
          postId: String(post._id),
          mediaId: String(media._id),
        })
      }
    }

    if (!targetKey) {
      const fileName = path.basename(sourceKey) || `${media._id}`
      targetKey = `public/legacy/media/${media._id}/${fileName}`
    }

    try {
      const copyRes = await copyObjectIfNeeded({
        sourceBucket,
        sourceKey,
        targetKey,
        apply,
      })
      if (copyRes.copied) stats.mediaCopied += 1

      if (apply) {
        await Media.updateOne(
          { _id: media._id },
          { $set: { key: targetKey, url: "" } }
        )
      }
      stats.mediaUpdated += 1
    } catch (error) {
      stats.mediaCopyErrors += 1
      console.error("[legacy-media-migration] media copy failed", {
        mediaId: String(media._id),
        sourceBucket,
        sourceKey,
        targetKey,
        message: error?.message || String(error),
      })
    }
  }

  const profileCursor = User.find(
    {
      $or: [
        { "profile_picture.key": { $type: "string", $ne: "" } },
        { "profile_picture.url": { $type: "string", $ne: "" } },
      ],
    },
    { _id: 1, profile_picture: 1 }
  )
    .limit(Math.max(1, Number(maxUsers) || 1000))
    .cursor()

  for await (const user of profileCursor) {
    stats.profileScanned += 1
    const pfp = user.profile_picture || {}
    const currentKey = normalizeKey(pfp.key)
    const currentUrl = typeof pfp.url === "string" ? pfp.url.trim() : ""

    if (!currentKey && /^https?:\/\//i.test(currentUrl)) {
      stats.profileSkippedExternal += 1
      continue
    }

    if (isNewStyleKey(currentKey)) {
      if (clearLegacyUrls && apply && currentUrl) {
        await User.updateOne(
          { _id: user._id },
          { $set: { "profile_picture.url": "" } }
        )
      }
      continue
    }

    const parsedFromUrl = parseBucketAndKeyFromUrl(currentUrl)
    const sourceKey = parsedFromUrl?.key || currentKey
    const sourceBucket = parsedFromUrl?.bucket || legacyBucketName
    if (!sourceKey) continue

    const fileName = path.basename(sourceKey) || `pfp-${user._id}`
    const targetKey = `public/users/${user._id}/profile/images/${fileName}`

    try {
      const copyRes = await copyObjectIfNeeded({
        sourceBucket,
        sourceKey,
        targetKey,
        apply,
      })
      if (copyRes.copied) stats.profileCopied += 1

      if (apply) {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              "profile_picture.key": targetKey,
              "profile_picture.url": "",
            },
          }
        )
      }
      stats.profileUpdated += 1
    } catch (error) {
      stats.profileCopyErrors += 1
      console.error("[legacy-media-migration] profile copy failed", {
        userId: String(user._id),
        sourceBucket,
        sourceKey,
        targetKey,
        message: error?.message || String(error),
      })
    }
  }

  return stats
}

module.exports = {
  runLegacyMediaMigration,
  parseBool,
}

