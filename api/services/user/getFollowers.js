const User = require("../../models/User")
const getDataWithPages = require("../getDataWithPages")
const {
  getFollowersPipeline,
  getUserPipeline,
} = require("../../repositories/index")

const {
  errors: { notFound },
  success: { fetched },
} = require("../../../constants/index")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")

const getFollowers = async (props) => {
  const { username, page, maxPageSize, loggedUser } = props

  try {
    const user = await User.aggregate(getUserPipeline(username, loggedUser))
    if (!user[0]) return notFound("User")

    const response = await getDataWithPages({
      pipeline: getFollowersPipeline(user[0]._id, loggedUser),
      type: "Follower",
      page,
      maxPageSize,
    })

    return fetched(`followers`, {
      response: { ...response, user: serializeMediaPayload(user) },
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = getFollowers
