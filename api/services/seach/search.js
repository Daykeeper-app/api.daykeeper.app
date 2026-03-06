const Followers = require("../../models/Followers")
const getDataWithPages = require("../getDataWithPages")
const {
  searchPostPipeline,
  searchUserPipeline,
  searchEventPipeline,
  searchTaskPipeline,
} = require("../../repositories")

const {
  maxPageSize: DEFAULT_MAX_PAGE_SIZE,
  success: { fetched },
} = require("../../../constants/index")

function normalizeSearchType(input) {
  const t = String(input || "")
    .trim()
    .toLowerCase()

  if (t === "user" || t === "users") return "User"
  if (t === "event" || t === "events") return "Event"
  if (t === "task" || t === "tasks") return "Task"
  return "Post"
}

const search = async (props) => {
  const page = Number(props.page) || 1
  const maxPageSize = props.maxPageSize
    ? Number(props.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(props.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  const searchQuery = props.q || ""
  const order = props.order || "relevant"
  const following = props.following
  const type = normalizeSearchType(props?.type)

  const loggedUser = props.user

  try {
    loggedUser.following = await Followers.countDocuments({
      followerId: loggedUser._id,
    })

    // Specific Filters
    const now = new Date()
    let filterPipe = {}
    const filter = String(props.filter || "")
      .trim()
      .toLowerCase()
    if (type == "Event") {
      if (filter === "upcoming") filterPipe = { dateStart: { $gt: now } }
      if (filter === "past") filterPipe = { dateStart: { $lt: now } }
      if (filter === "ongoing")
        filterPipe = { dateStart: { $lte: now }, dateEnd: { $gte: now } }
    }

    if (type === "Task") {
      if (filter === "upcoming") filterPipe = { date: { $gt: now } }
      if (filter === "past") filterPipe = { date: { $lt: now } }
    }

    const pipeline =
      type === "Post"
        ? searchPostPipeline(searchQuery, loggedUser)
        : type === "User"
        ? searchUserPipeline(searchQuery, loggedUser)
        : type === "Event"
        ? searchEventPipeline(searchQuery, filterPipe, loggedUser)
        : searchTaskPipeline(searchQuery, filterPipe, loggedUser)

    const response = await getDataWithPages(
      {
        type,
        pipeline,
        order,
        following,
        page,
        maxPageSize,
      },
      loggedUser
    )

    return fetched(`data`, { response })
  } catch (error) {
    console.error(error)
    throw new Error(error.message)
  }
}

module.exports = search
