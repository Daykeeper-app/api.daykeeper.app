const { getSignedUrl } = require("@aws-sdk/cloudfront-signer")

function normalizeObjectKey(key) {
  if (typeof key !== "string") return ""
  return key.trim().replace(/^\/+/, "")
}

function isPublicKey(key) {
  return normalizeObjectKey(key).startsWith("public/")
}

function isPrivateKey(key) {
  return normalizeObjectKey(key).startsWith("private/")
}

function getCloudFrontDomain() {
  const raw = (process.env.CLOUDFRONT_DOMAIN || "").trim()
  if (!raw) return ""
  return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
}

function getCloudFrontBaseUrl() {
  const domain = getCloudFrontDomain()
  return domain ? `https://${domain}` : ""
}

function getLegacyMediaBaseUrl() {
  const raw = (
    process.env.LEGACY_MEDIA_BASE_URL ||
    process.env.LEGACY_PROFILE_PICTURE_BASE_URL ||
    ""
  ).trim()
  if (!raw) return ""
  return raw.replace(/\/+$/, "")
}

function getSigningTtlSeconds() {
  const parsed = Number(process.env.CLOUDFRONT_SIGN_TTL_SECONDS)
  if (!Number.isFinite(parsed) || parsed <= 0) return 900
  return Math.floor(parsed)
}

function getSigningPrivateKey() {
  const raw = process.env.CLOUDFRONT_PRIVATE_KEY_PEM || ""
  if (!raw) return ""
  return raw.replace(/\\n/g, "\n")
}

function getCloudFrontSignedUrlForPrivateKey(objectKey, ttlSeconds) {
  const key = normalizeObjectKey(objectKey)
  const domain = getCloudFrontDomain()
  const keyPairId = (process.env.CLOUDFRONT_PUBLIC_KEY_ID || "").trim()
  const privateKey = getSigningPrivateKey()

  if (!key || !domain || !keyPairId || !privateKey) return ""

  const url = `https://${domain}/${key}`
  const ttl = Number.isFinite(Number(ttlSeconds))
    ? Number(ttlSeconds)
    : getSigningTtlSeconds()
  const expiresAt = new Date(Date.now() + Math.max(1, Math.floor(ttl)) * 1000)

  return getSignedUrl({
    url,
    keyPairId,
    privateKey,
    dateLessThan: expiresAt.toISOString(),
  })
}

function buildMediaUrlFromKey(objectKey, options = {}) {
  if (typeof objectKey !== "string") return ""
  const trimmed = objectKey.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const key = normalizeObjectKey(trimmed)
  const baseUrl = getCloudFrontBaseUrl()
  const legacyBase = getLegacyMediaBaseUrl()

  if (isPublicKey(key)) {
    if (baseUrl) return `${baseUrl}/${key}`
    // Temporary compatibility path: if CloudFront domain is not available
    // in an environment, allow public assets through legacy base.
    if (legacyBase) return `${legacyBase}/${key}`
    return ""
  }

  if (isPrivateKey(key)) {
    return getCloudFrontSignedUrlForPrivateKey(key, options.ttlSeconds)
  }

  if (options.allowLegacy === true) {
    if (legacyBase) return `${legacyBase}/${key}`
  }

  return ""
}

module.exports = {
  normalizeObjectKey,
  isPublicKey,
  isPrivateKey,
  getCloudFrontBaseUrl,
  buildMediaUrlFromKey,
}
