const deleteFile = require("../../../utils/deleteFile")
const {
  user: { defaultPfp },
} = require("../../../../constants/index")

const deleteProfilePicture = async (user) => {
  try {
    const isDefault =
      user?.profile_picture?.key === defaultPfp.key ||
      user?.profile_picture?.title === defaultPfp.title

    if (!isDefault) {
      await deleteFile({ key: user.profile_picture.key })
    }
    return user.profile_picture
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = deleteProfilePicture
