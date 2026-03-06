const {
  maxPageSize: DEFAULT_MAX_PAGE_SIZE,
  errors: { serverError },
} = require("../../constants/index")
const getUser = require("../services/user/getUser")
const getUserPosts = require("../services/user/getUserPosts")
const getUserPostsByDay = require("../services/user/getUserPostsByDay")
const updateUser = require("../services/user/updateUser")
const reseteProfilePicture = require("../services/user/resetProfilePicture")
const deleteUser = require("../services/user/deleteUser")
const followUser = require("../services/user/followUser")
const respondFollowRequest = require("../services/user/respondFollowRequest")
const removeFollower = require("../services/user/removeFollower")
const blockUser = require("../services/user/blockUser")
const getBlockedUsers = require("../services/user/getBlockedUsers")
const reportUser = require("../services/user/reportUser")
const getUserCalendar = require("../services/user/getUserCalendar")
const getFollowing = require("../services/user/getFollowing")
const getFollowers = require("../services/user/getFollowers")
const getFollowRequests = require("../services/user/getFollowRequests")
const addOrRemoveFromCloseFriends = require("../services/user/addOrRemoveFromCloseFriends")
const getCloseFriends = require("../services/user/getCloseFriends")

// getUser
const getUserController = async (req, res) => {
  try {
    const { code, message, data } = await getUser({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, data })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

const getUserPostsController = async (req, res) => {
  const page = Number(req.query.page) || 1
  const maxPageSize = req.query.maxPageSize
    ? Number(req.query.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE
  const order = req.query.order || "relevant"
  const { username } = req.params

  try {
    const { code, response } = await getUserPosts({
      username,
      order,
      maxPageSize,
      page,
      loggedUser: req.user,
    })

    return res.status(code).json({ ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

const getUserPostsByDayController = async (req, res) => {
  const { username, date } = req.params
  const page = Number(req.query.page) || 1
  const maxPageSize = req.query.maxPageSize
    ? Number(req.query.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE
  const order = req.query.order || "relevant"

  try {
    const { code, message, props } = await getUserPostsByDay({
      username,
      dateStr: date,
      page,
      maxPageSize,
      order,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ...props })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

const getUserCalendarController = async (req, res) => {
  const { username } = req.params

  try {
    const { code, message, data } = await getUserCalendar({
      username,
      days: req.query?.days,
      endDate: req.query?.endDate,
      startDate: req.query?.startDate,
      scope: req.query?.scope,
      loggedUser: req.user,
      fetchedUser: req.fetchedUser,
    })

    return res.status(code).json({ message, data })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

// updateUser
const updateUserController = async (req, res) => {
  try {
    const { code, message, user } = await updateUser({
      ...req.body,
      file: req.file,
      loggedUser: req.loggedUserDoc || req.user,
    })

    return res.status(code).json({ message, user })
  } catch (error) {
    return res.status(500).json({ message: serverError(String(error)) })
  }
}

// reseteProfilePicture
const reseteProfilePictureController = async (req, res) => {
  try {
    const { code, message } = await reseteProfilePicture({
      loggedUser: req.user,
    })

    console.log("Message: " + message)

    return res.status(code).json({ message })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: `${error}` })
  }
}

// deleteUser
const deleteUserController = async (req, res) => {
  try {
    const { code, message, data } = await deleteUser({
      loggedUser: req.user,
      password: req.body?.password,
      code: req.body?.code,
    })

    return res.status(code).json({ message, data })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// followUser
const followUserController = async (req, res) => {
  try {
    const { code, message } = await followUser({
      loggedUser: req.user,
      ...req.params,
    })

    return res.status(code).json({ message })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// respondFollowRequest (private users only)
const respondFollowRequestController = async (req, res) => {
  try {
    const { code, message, reason } = await respondFollowRequest({
      ...req.params,
      ...req.body,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, reason })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// removeFollower (private users only)
const removeFollowerController = async (req, res) => {
  try {
    const { code, message, reason } = await removeFollower({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, reason })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// report User
const reportUserController = async (req, res) => {
  try {
    const { code, message, reason, user } = await reportUser({
      ...req.params,
      loggedUser: req.user,
      reason: req.body.reason || "",
    })

    return res.status(code).json({ message, reason, user })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// getFollowing
const getFollowingController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getFollowing({
      ...req.params,
      page,
      maxPageSize,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// getFollowers
const getFollowersController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getFollowers({
      ...req.params,
      page,
      maxPageSize,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// Get Follow Requests
const getFollowRequestsController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getFollowRequests({
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// add Or Remove From Close Friends
const addOrRemoveFromCloseFriendsController = async (req, res) => {
  try {
    const { code, message } = await addOrRemoveFromCloseFriends({
      loggedUser: req.user,
      ...req.params,
    })

    return res.status(code).json({ message })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// getCloseFriends
const getCloseFriendsController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getCloseFriends({
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// blockUser
const blockUserController = async (req, res) => {
  try {
    const { code, message } = await blockUser({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// getBlockedUsers
const getBlockedUsersController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getBlockedUsers({
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

module.exports = {
  getUser: getUserController,
  getUserPosts: getUserPostsController,
  getUserPostsByDay: getUserPostsByDayController,
  getUserCalendar: getUserCalendarController,
  updateUser: updateUserController,
  reseteProfilePicture: reseteProfilePictureController,
  deleteUser: deleteUserController,
  followUser: followUserController,
  getFollowing: getFollowingController,
  getFollowers: getFollowersController,
  getFollowRequests: getFollowRequestsController,
  respondFollowRequest: respondFollowRequestController,
  removeFollower: removeFollowerController,
  addOrRemoveFromCloseFriends: addOrRemoveFromCloseFriendsController,
  getCloseFriends: getCloseFriendsController,
  blockUser: blockUserController,
  getBlockedUsers: getBlockedUsersController,
  reportUser: reportUserController,
}
