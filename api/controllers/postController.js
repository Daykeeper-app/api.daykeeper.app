const {
  maxPageSize: DEFAULT_MAX_PAGE_SIZE,
  errors: { serverError },
} = require("../../constants/index")
const getPost = require("../services/post/getPost")
const createPost = require("../services/post/createPost")
const updatePost = require("../services/post/updatePost")
const deletePost = require("../services/post/deletePost")
const reportPost = require("../services/post/reportPost")
const likePost = require("../services/post/likePost")
const getPostLikes = require("../services/post/getPostLikes")
const commentPost = require("../services/post/commentPost")
const commentOnComment = require("../services/post/commentOnComment")
const getPostComments = require("../services/post/getPostComments")
const getCommentById = require("../services/post/getCommentById")
const getCommentReplies = require("../services/post/getCommentReplies")
const likeComment = require("../services/post/likeComment")
const getCommentLikes = require("../services/post/getCommentLikes")
const deleteComment = require("../services/post/deleteComment")

// getPost
const getPostController = async (req, res) => {
  try {
    const { code, message, data } = await getPost({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, data })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// submitPost
const createPostController = async (req, res) => {
  try {
    const { code, message, post } = await createPost(req)

    return res.status(code).json({ message, post })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// updatePost
const updatePostController = async (req, res) => {
  try {
    const { code, message, post } = await updatePost({
      ...req.body,
      ...req.params,
      mediaDocs: req.mediaDocs,
      loggedUser: req.user,
      reqFiles: req.files,
    })

    return res.status(code).json({ message, post })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// deletePost
const deletePostController = async (req, res) => {
  try {
    const { code, message, post } = await deletePost({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, post })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// report Post
const reportPostController = async (req, res) => {
  const reason = req.body.reason || ""

  try {
    const { code, message } = await reportPost({
      ...req.params,
      reason,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, reason })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// likePost
const likePostController = async (req, res) => {
  try {
    const { code, message, post } = await likePost({
      ...req.params,
      loggedUser: req.user,
      ...req.body,
    })

    return res.status(code).json({ message, post })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const getPostLikesController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getPostLikes({
      ...req.params,
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

//commentPost
const commentPostController = async (req, res) => {
  try {
    const { code, message, response } = await commentPost({
      ...req.params,
      ...req.body,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

//commentPost
const getPostCommentsController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getPostComments({
      ...req.params,
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// getCommentById
const getCommentByIdController = async (req, res) => {
  try {
    const { code, message, data } = await getCommentById({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, data })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// getCommentReplies
const getCommentRepliesController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getCommentReplies({
      ...req.params,
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// commentOnComment
const commentOnCommentController = async (req, res) => {
  try {
    const { code, message, response } = await commentOnComment({
      ...req.params,
      ...req.body,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

// likeComment
const likeCommentController = async (req, res) => {
  try {
    const { code, message, post } = await likeComment({
      ...req.params,
      ...req.body,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, post })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

const getCommentLikesController = async (req, res) => {
  const page = Number(req.query?.page) || 1
  const maxPageSize = req.query?.maxPageSize
    ? Number(req.query?.maxPageSize) <= DEFAULT_MAX_PAGE_SIZE
      ? Number(req.query?.maxPageSize)
      : DEFAULT_MAX_PAGE_SIZE
    : DEFAULT_MAX_PAGE_SIZE

  try {
    const { code, message, response } = await getCommentLikes({
      ...req.params,
      loggedUser: req.user,
      page,
      maxPageSize,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: `${error}` })
  }
}

// deleteComment
const deleteCommentController = async (req, res) => {
  try {
    const { code, message, response } = await deleteComment({
      ...req.params,
      loggedUser: req.user,
    })

    return res.status(code).json({ message, ...response })
  } catch (error) {
    return res.status(500).json({ message: serverError(error.toString()) })
  }
}

module.exports = {
  getPostById: getPostController,
  createPost: createPostController,
  updatePost: updatePostController,
  deletePost: deletePostController,
  reportPost: reportPostController,
  likePost: likePostController,
  getPostLikes: getPostLikesController,
  commentPost: commentPostController,
  getPostComments: getPostCommentsController,
  getCommentById: getCommentByIdController,
  getCommentReplies: getCommentRepliesController,
  commentOnComment: commentOnCommentController,
  likeComment: likeCommentController,
  getCommentLikes: getCommentLikesController,
  deleteComment: deleteCommentController,
}
