const User = require("../../models/User")
const hardDeleteStorageObject = require("./hardDeleteStorageObject")
const {
  user: { defaultPfp },
} = require("../../../constants/index")

async function hardDeleteUserProfilePicture(userId) {
  const user = await User.findById(String(userId)).select("profile_picture")
  if (!user) return

  const pfp = user.profile_picture
  const key = pfp?.key
  const title = pfp?.title

  // don't delete the shared default file
  if (!key) return
  if (key === defaultPfp.key) return
  if (title && title === defaultPfp.title) return

  await hardDeleteStorageObject(key)
}

module.exports = hardDeleteUserProfilePicture
