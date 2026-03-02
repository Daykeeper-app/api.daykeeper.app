const fs = require("fs")
const path = require("path")
const { promisify } = require("util")
const Media = require("../models/Media")
const awsS3Config = require("../config/awsS3Config")
const {
  aws: { bucketName, storageType },
} = require("../../config")

function getPrivacyPrefix(privacy) {
  const normalized = String(privacy || "").trim().toLowerCase()
  if (
    normalized === "private" ||
    normalized === "close friends" ||
    normalized === "close_friends"
  ) {
    return "private"
  }
  return "public"
}

function buildTargetMediaKey({ currentKey, privacyPrefix, userId, postId, mediaId }) {
  const current = String(currentKey || "").trim().replace(/^\/+/, "")
  const fileName = current.split("/").pop() || `${mediaId}`
  return `${privacyPrefix}/users/${userId}/posts/${postId}/${mediaId}/${fileName}`
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${String(key || "").split("/").map(encodeURIComponent).join("/")}`
}

async function moveStorageObject(fromKey, toKey) {
  const source = String(fromKey || "").trim()
  const target = String(toKey || "").trim()
  if (!source || !target || source === target) return target

  if (storageType === "s3") {
    await awsS3Config
      .copyObject({
        Bucket: bucketName,
        CopySource: encodeCopySource(bucketName, source),
        Key: target,
      })
      .promise()

    await awsS3Config
      .deleteObject({
        Bucket: bucketName,
        Key: source,
      })
      .promise()

    return target
  }

  if (storageType === "local") {
    const uploadRoot = path.resolve(__dirname, "..", "tmp", "uploads")
    const srcPath = path.resolve(uploadRoot, source)
    const dstPath = path.resolve(uploadRoot, target)

    await promisify(fs.mkdir)(path.dirname(dstPath), { recursive: true })
    await promisify(fs.rename)(srcPath, dstPath)
    return target
  }

  return target
}

async function ensureSinglePostMediaPrivacy({ media, post }) {
  if (!media || !post) return media
  if (media.status !== "public") return media

  const privacyPrefix = getPrivacyPrefix(post.privacy)
  const currentKey = String(media.key || "")
  if (!currentKey) return media

  const targetKey = buildTargetMediaKey({
    currentKey,
    privacyPrefix,
    userId: String(post.user),
    postId: String(post._id),
    mediaId: String(media._id),
  })

  if (targetKey === currentKey) return media

  try {
    await moveStorageObject(currentKey, targetKey)
    const updated = await Media.findByIdAndUpdate(
      media._id,
      { $set: { key: targetKey } },
      { new: true },
    )

    return updated || media
  } catch (error) {
    console.error("Failed to move media key to privacy prefix", {
      mediaId: String(media._id),
      from: currentKey,
      to: targetKey,
      message: error?.message || String(error),
    })
    return media
  }
}

async function ensurePostMediaPrivacy({ post, medias = [] }) {
  const result = []
  for (const media of medias) {
    const updated = await ensureSinglePostMediaPrivacy({ media, post })
    result.push(updated)
  }
  return result
}

module.exports = {
  getPrivacyPrefix,
  ensureSinglePostMediaPrivacy,
  ensurePostMediaPrivacy,
}
