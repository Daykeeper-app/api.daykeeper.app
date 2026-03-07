const User = require("../../../models/User")
const hardDeleteStorageObject = require("../../../utils/delete/hardDeleteStorageObject")
const {
  user: { defaultPfp },
} = require("../../../../constants/index")

async function hardDeleteProfilePicture(userId) {
  const u = await User.findById(String(userId)).select("profile_picture")
  if (!u) return 0

  const pfp = u.profile_picture
  const key = pfp?.key
  const title = pfp?.title

  if (!key) return 0
  if (key === defaultPfp.key) return 0
  if (title && title === defaultPfp.title) return 0

  await hardDeleteStorageObject(key)
  return 1
}

module.exports = hardDeleteProfilePicture
