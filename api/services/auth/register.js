const User = require("../../models/User")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const { sendVerificationEmail } = require("../../utils/emailHandler")
const { createNotification } = require("../notification/createNotification")
const { buildMediaUrlFromKey } = require("../../utils/cloudfrontMedia")

const {
  user: { defaultPfp, defaultTimeZone },
  auth: { registerCodeExpiresTime },
  success: { created },
  errors: { duplicatedValue },
} = require("../../../constants/index")

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex")
}

const register = async (props) => {
  let { username, email, password, timeZone } = props

  if (!password) {
    throw new Error("Password is required for local registration")
  }

  // Normalize inputs
  username = (username || "").trim()
  email = (email || "").trim().toLowerCase()

  if (!username) throw new Error("Name is required")
  if (!email) throw new Error("Email is required")

  const img = defaultPfp

  // 6-digit code
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString()
  const verificationCodeHash = hashCode(verificationCode)
  const verificationExpiresAt = new Date(Date.now() + registerCodeExpiresTime)
  const passwordHash = await bcrypt.hash(password, 12)

  const user = new User({
    username,
    name: username,
    displayName: username,
    email,
    bio: "",
    timeZone: timeZone || defaultTimeZone,
    profile_picture: img,
    private: false,
    roles: ["user"],
    blocked_users: [],
    verified_email: false,
    password: passwordHash,
    created_at: Date.now(),

    status: "public",

    verification_code_hash: verificationCodeHash,
    verification_expires_at: verificationExpiresAt,
  })

  try {
    await user.save()
  } catch (err) {
    if (err && (err.code === 11000 || err.code === 11001)) {
      const dupField = Object.keys(err.keyPattern || {})[0]
      if (dupField === "email") return duplicatedValue("Email")
      if (dupField === "username") return duplicatedValue("Username")
      console.log(err)
      return duplicatedValue("Something")
    }
    throw err
  }

  const pfpUrl = buildMediaUrlFromKey(img?.key) || img?.url
  sendVerificationEmail(username, email, pfpUrl, verificationCode).catch(() => null)

  createNotification({
    userId: user._id,
    type: "welcome",
    title: "Welcome to Daykeeper!",
    body: "Thanks for joining. Your account is ready to use.",
    data: { userId: user._id },
    sendPush: false,
  }).catch(() => null)

  return created(`${username}`, user)
}

module.exports = register
