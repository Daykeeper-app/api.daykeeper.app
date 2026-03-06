const User = require(`../../../models/User`)
const mongoose = require(`mongoose`)

const { hideUserData } = require("../../../repositories/index")

const findUser = async ({
  userInput = "",
  allowUnverified = false,
  allowNonPublic = false,
}) => {
  try {
    const statusFilter = allowNonPublic ? { $ne: "deleted" } : "public"
    const verifiedFilter = allowUnverified ? { $in: [true, false, null] } : true

    let user = await User.findOne({
      username: userInput,
      status: statusFilter,
      verified_email: verifiedFilter,
    }).select(hideUserData)
    if (!user && mongoose.Types.ObjectId.isValid(userInput))
      user = await User.findOne({
        _id: userInput,
        status: statusFilter,
        verified_email: verifiedFilter,
      }).select(hideUserData)

    return user
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = findUser
