const { buildMediaUrlFromKey } = require("./cloudfrontMedia")
const { Types } = require("mongoose")

const VARIANT_KEY_FIELDS = [
  ["thumbKey", "thumb"],
  ["thumbnailKey", "thumb"],
  ["mainKey", "main"],
  ["hlsKey", "hls"],
  ["previewKey", "preview"],
  ["posterKey", "poster"],
  ["imageKey", "main"],
  ["videoKey", "main"],
]

function isObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]"
}

function tryNormalizeObjectIdLike(value) {
  if (value == null) return null

  if (value instanceof Types.ObjectId) {
    return value.toString()
  }

  if (isObject(value) && typeof value.$oid === "string") {
    return value.$oid
  }

  if (isObject(value) && typeof value.toHexString === "function") {
    try {
      return value.toHexString()
    } catch {
      // ignore
    }
  }

  if (
    isObject(value) &&
    typeof value.buffer === "string" &&
    /^[a-fA-F0-9]{24}$/.test(value.buffer)
  ) {
    return value.buffer
  }

  if (isObject(value) && Buffer.isBuffer(value.buffer)) {
    return value.buffer.toString("hex")
  }

  if (
    isObject(value) &&
    value.type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    try {
      return Buffer.from(value.data).toString("hex")
    } catch {
      // ignore
    }
  }

  return null
}

function isLikelyMediaObject(obj) {
  if (!isObject(obj) || typeof obj.key !== "string") return false

  return (
    Object.prototype.hasOwnProperty.call(obj, "type") ||
    Object.prototype.hasOwnProperty.call(obj, "verified") ||
    Object.prototype.hasOwnProperty.call(obj, "uploadedBy") ||
    Object.prototype.hasOwnProperty.call(obj, "usedIn") ||
    Object.prototype.hasOwnProperty.call(obj, "status") ||
    Object.prototype.hasOwnProperty.call(obj, "jobId") ||
    Object.prototype.hasOwnProperty.call(obj, "title") ||
    Object.prototype.hasOwnProperty.call(obj, "url")
  )
}

function withMediaUrls(mediaLike, options = {}) {
  if (!isObject(mediaLike)) return mediaLike

  const next = { ...mediaLike }
  const urls = isObject(next.urls) ? { ...next.urls } : {}

  if (typeof next.key === "string" && next.key.trim()) {
    const mainUrl = buildMediaUrlFromKey(next.key)
    if (mainUrl) {
      next.url = mainUrl
      urls.main = urls.main || mainUrl
    } else if (
      typeof next.url === "string" &&
      /\/raw\//i.test(next.url)
    ) {
      // Never expose raw S3 objects to clients; they are private by design.
      next.url = ""
    }
  }

  for (const [field, alias] of VARIANT_KEY_FIELDS) {
    if (typeof next[field] !== "string" || !next[field].trim()) continue
    const value = buildMediaUrlFromKey(next[field])
    if (value) urls[alias] = urls[alias] || value
  }

  if (Object.keys(urls).length > 0) {
    next.urls = urls
  }

  return next
}

function keyFieldToUrlField(keyField) {
  return keyField.replace(/Key$/, "Url")
}

function shouldProjectUrlForKeyField(keyField) {
  return /(media|image|video|thumb|thumbnail|preview|poster|hls|file)Key$/i.test(
    keyField
  )
}

function serializeMediaPayload(value) {
  const normalizedId = tryNormalizeObjectIdLike(value)
  if (normalizedId) return normalizedId

  if (Array.isArray(value)) {
    return value.map((item) => serializeMediaPayload(item))
  }

  if (!isObject(value)) return value

  let next = {}
  for (const [key, rawVal] of Object.entries(value)) {
    next[key] = serializeMediaPayload(rawVal)
  }

  if (isLikelyMediaObject(next)) {
    next = withMediaUrls(next)
  }

  if (isObject(next.profile_picture)) {
    next.profile_picture = withMediaUrls(next.profile_picture)
  }

  for (const [field, fieldValue] of Object.entries(next)) {
    if (
      shouldProjectUrlForKeyField(field) &&
      typeof fieldValue === "string" &&
      fieldValue.trim()
    ) {
      const computed = buildMediaUrlFromKey(fieldValue)
      if (computed) {
        next[keyFieldToUrlField(field)] = computed
      }
    }
  }

  return next
}

module.exports = {
  serializeMediaPayload,
  withMediaUrls,
}
