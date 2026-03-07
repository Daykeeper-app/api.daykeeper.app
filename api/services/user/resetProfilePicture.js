const User = require("../../models/User")

const deleteFile = require("../../utils/deleteFile")
const {
  user: { defaultPfp },
  errors: { custom: customErr },
  success: { custom },
} = require("../../../constants/index")

const reseteProfilePicture = async (props) => {
  const { loggedUser } = props

  try {
    const isAlreadyDefault =
      loggedUser?.profile_picture?.key === defaultPfp.key ||
      loggedUser?.profile_picture?.title === defaultPfp.title

    if (isAlreadyDefault)
      return customErr("User profile picture is already the default")

    // deleteLastPFP
    if (
      loggedUser?.profile_picture?.key &&
      loggedUser.profile_picture.key !== defaultPfp.key &&
      loggedUser?.profile_picture?.title !== defaultPfp.title
    )
      deleteFile({ key: loggedUser.profile_picture.key })

    const updatedUser = await User.findByIdAndUpdate(loggedUser._id, {
      $set: {
        profile_picture: defaultPfp,
      },
    })
    await updatedUser.save()

    return custom(
      `${loggedUser.username}'s profile picture reseted successfully`
    )
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = reseteProfilePicture
