const User = require("../../models/User")
const crypto = require("crypto")
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../../utils/emailHandler")
const { buildMediaUrlFromKey } = require("../../utils/cloudfrontMedia")

const {
  errors: { notFound, fieldNotFilledIn, unauthorized },
  success: { custom },
  user: { defaultPfp },
  auth: { registerCodeExpiresTime, resetPasswordExpiresTime },
} = require("../../../constants/index")

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex")
}

function make6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const resendCode = async (props, type = "verify") => {
  // type = "verify" || "reset"
  let { email } = props

  if (!email) return fieldNotFilledIn("Email")
  email = email.trim().toLowerCase()

  if (type !== "verify" && type !== "reset") {
    return unauthorized("resend code", "invalid type")
  }

  const user = await User.findOne({ email })
  if (!user) return notFound("user")

  // ===== VERIFY EMAIL FLOW =====
  if (type === "verify") {
    if (user.verified_email) {
      return custom(`${user.username}'s email is already confirmed`)
    }

    // Optional anti-spam:
    // if (user.verification_expires_at && user.verification_expires_at.getTime() > Date.now()) {
    //   return unauthorized("resend code", "code already sent, wait until it expires")
    // }

    const code = make6DigitCode()
    const codeHash = hashCode(code)
    const expiresAt = new Date(Date.now() + registerCodeExpiresTime)

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          verification_code_hash: codeHash,
          verification_expires_at: expiresAt,
        },
      }
    )

    const pfpUrl =
      buildMediaUrlFromKey(user.profile_picture?.key) ||
      user.profile_picture?.url ||
      defaultPfp?.url ||
      undefined
    sendVerificationEmail(user.username, user.email, pfpUrl, code).catch(
      () => null
    )

    return custom(`Verification code resent to ${user.email}`)
  }

  // ===== RESET PASSWORD FLOW =====
  // Optional anti-spam:
  // if (user.reset_expires_at && user.reset_expires_at.getTime() > Date.now()) {
  //   return unauthorized("resend reset", "code already sent, wait until it expires")
  // }

  const code = make6DigitCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + resetPasswordExpiresTime)

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        reset_code_hash: codeHash,
        reset_expires_at: expiresAt,
      },
    }
  )

  sendPasswordResetEmail(user.email, code).catch(() => null)
  return custom(`Password reset code sent to ${user.email}`)
}

module.exports = resendCode
