const User = require("../../models/User")
const {
  user: { defaultTimeZone, defaultPfp },
} = require("../../../constants/index")

module.exports = async function upsertGoogleUser(profile) {
  const email = profile.emails?.[0]?.value
  const googleId = profile.id
  const photo = profile.photos?.[0]?.value || null
  const displayName = (profile.displayName || "").split(" ").join("")

  if (!email) throw new Error("Google account has no email")

  let user = await User.findOne({ $or: [{ email }, { google_id: googleId }] })

  if (user) {
    if (!user.google_id) user.google_id = googleId
    if (
      photo &&
      (!user.profile_picture ||
        (!String(user.profile_picture.key || "").trim() &&
          !String(user.profile_picture.url || "").trim()))
    ) {
      user.profile_picture = { url: photo, title: "google_pfp", key: "" }
    }
    if (user.verified_email === false) user.verified_email = true
    await user.save()
    return user
  }

  user = await User.create({
    username: displayName,
    name: displayName,
    displayName,
    email,
    bio: "",
    timeZone: defaultTimeZone,
    profile_picture: photo
      ? { url: photo, title: "google_pfp", key: "" }
      : defaultPfp,
    private: false,
    roles: ["user"],
    blocked_users: [],
    verified_email: true,
    password: null,
    created_at: Date.now(),
    google_id: googleId,
    verification_code: null,
    verification_time: null,
  })

  return user
}
