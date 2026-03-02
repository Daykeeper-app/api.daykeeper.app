const User = require("../../models/User")
const getUserPipeline = require("../../repositories/pipelines/user/getUserPipeline")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")
const {
  errors: { notFound },
  success: { fetched },
} = require("../../../constants/index")

const getUser = async (props) => {
  const { username: userInput, loggedUser } = props

  try {
    const user = await User.aggregate(
      getUserPipeline(userInput, loggedUser, { allowPrivate: true })
    )
    if (!user[0]) return notFound("User")

    return fetched(`user`, {
      data: serializeMediaPayload(user[0]),
    })
  } catch (error) {
    console.error(error)
    throw new Error(error.message)
  }
}

module.exports = getUser
