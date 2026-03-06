const User = require("../../models/User")
const Followers = require("../../models/Followers")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const deleteFile = require("../../utils/deleteFile")
const { sendVerificationEmail } = require("../../utils/emailHandler")
const { buildMediaUrlFromKey } = require("../../utils/cloudfrontMedia")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

const {
  errors: { notFound },
  success: { updated },
  auth: { registerCodeExpiresTime, maxTimeZoneLength }, // add maxTimeZoneLength in constants or it will fallback
  user: { defaultPfp },
} = require("../../../constants/index")

function make6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex")
}

function normalizeOptionalString(v, { lower = false } = {}) {
  if (typeof v !== "string") return undefined
  const t = v.trim()
  if (!t) return undefined
  return lower ? t.toLowerCase() : t
}

// date-fns-tz expects IANA zones like "America/New_York"
function isValidIanaTimeZone(tz) {
  if (typeof tz !== "string") return false
  const s = tz.trim()
  if (!s) return false
  try {
    Intl.DateTimeFormat("en-US", { timeZone: s }).format()
    return true
  } catch {
    return false
  }
}

function toProfilePicturePayload(input = {}) {
  const title = typeof input.title === "string" ? input.title : ""
  const key = typeof input.key === "string" ? input.key.trim() : ""
  const url = typeof input.url === "string" ? input.url.trim() : ""
  const computed = key ? buildMediaUrlFromKey(key) : ""

  // Key-first model: when key is mappable to CloudFront, do not persist a static URL.
  return {
    title,
    key,
    url: computed ? "" : url,
  }
}

const updateUser = async (params) => {
  let {
    username,
    displayName,
    email,
    password,
    bio,
    file,
    timeZone,
    loggedUser,
  } = params

  // normalize
  username = normalizeOptionalString(username)
  displayName = normalizeOptionalString(displayName)
  email = normalizeOptionalString(email, { lower: true })
  bio = typeof bio === "string" ? bio : undefined
  timeZone = normalizeOptionalString(timeZone)

  const privateNext =
    typeof params?.private === "string" &&
    (params.private === "true" || params.private === "false")
      ? params.private === "true"
      : !!loggedUser.private

  // get logged user
  let user = loggedUser
  if (!user?.save) user = await User.findById(loggedUser._id)

  const emailChanged = !!email && email !== user.email
  const usernameChanged = !!username && username !== user.username
  const displayNameChanged =
    !!displayName && displayName !== (user.displayName || "")

  const timeZoneChanged =
    typeof timeZone === "string" && timeZone !== (user.timeZone || "")

  // Keep old picture key so we can delete it AFTER successful update
  const oldPictureKey = user.profile_picture?.key
  const oldPictureTitle = user.profile_picture?.title

  // Hash password if provided
  let passwordHash
  if (typeof password === "string" && password.length > 0) {
    passwordHash = await bcrypt.hash(password, 12)
  }

  // private -> public cleanup
  if (user.private === true && privateNext === false) {
    await Followers.deleteMany({
      following: user._id,
      required: true,
    })
  }

  // If email changed, rotate verification
  let verificationCode
  let verificationCodeHash
  let verificationExpiresAt

  if (emailChanged) {
    verificationCode = make6DigitCode()
    verificationCodeHash = hashCode(verificationCode)
    verificationExpiresAt = new Date(Date.now() + registerCodeExpiresTime)
  }

  const set = {
    username: user.username,
    displayName: user.displayName || user.username, // nice default
    bio: bio ?? user.bio ?? "",
    private: privateNext,
  }

  if (usernameChanged) set.username = username
  if (displayNameChanged) set.displayName = displayName
  if (passwordHash) set.password = passwordHash
  if (timeZoneChanged) set.timeZone = timeZone

  if (file) {
    set.profile_picture = toProfilePicturePayload({
      title: file.originalname,
      key: file.key,
      url: file.url || "",
    })
  }

  if (emailChanged) {
    set.email = email
    set.verified_email = false
    set.verification_code_hash = verificationCodeHash
    set.verification_expires_at = verificationExpiresAt
  }

  let updatedUser
  try {
    updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: set },
      { new: true },
    )
  } catch (err) {
    if (err && (err.code === 11000 || err.code === 11001)) {
      const dupField = Object.keys(err.keyPattern || {})[0]
      if (dupField === "email") throw new Error("Email already in use")
      if (dupField === "username") throw new Error("Username already in use")
      if (dupField === "displayName")
        throw new Error("Display name already in use")
      throw new Error("Duplicate value")
    }
    throw err
  }

  if (!updatedUser) return notFound("User")

  // delete old pfp ONLY after update succeeded
  if (
    file &&
    oldPictureKey &&
    oldPictureTitle &&
    defaultPfp?.title &&
    oldPictureTitle !== defaultPfp.title &&
    oldPictureKey !== file.key
  ) {
    deleteFile({ key: oldPictureKey }).catch?.(() => null)
  }

  // Best-effort email verification send
  if (emailChanged) {
    const pfpUrl =
      buildMediaUrlFromKey(updatedUser.profile_picture?.key) ||
      updatedUser.profile_picture?.url ||
      defaultPfp?.url
    const friendlyName = updatedUser.displayName || updatedUser.username
    sendVerificationEmail(
      friendlyName,
      updatedUser.email,
      pfpUrl,
      verificationCode,
    ).catch(() => null)
  }

  return updated("user", { user: serializeMediaPayload(updatedUser.toObject()) })
}

module.exports = updateUser
