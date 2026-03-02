const Post = require("../../models/Post")
const deleteFile = require("../../utils/deleteFile")
const mongoose = require("mongoose")

const deletePostLikes = require("./delete/deletePostLikes")
const deletePostComments = require("./delete/deletePostComments")
const deleteCommentLikes = require("./delete/deleteCommentLikes")
const deleteReports = require("../admin/delete/deleteReports")
const deleteBanHistory = require("../admin/delete/deleteBanHistory")

const {
  errors: { notFound, invalidValue },
  success: { deleted },
} = require("../../../constants/index")

function normalizePostId(value) {
  if (!value) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "object" && value !== null) {
    if (typeof value._id === "string") return value._id.trim()
    if (typeof value.id === "string") return value.id.trim()
  }
  return String(value).trim()
}

const deletePost = async ({ postId, loggedUser }) => {
  const normalizedPostId = normalizePostId(postId)
  if (!mongoose.Types.ObjectId.isValid(normalizedPostId)) {
    return invalidValue("Post ID")
  }

  // 1) Find post owned by user (secure)
  const post = await Post.findOne({ _id: normalizedPostId, user: loggedUser._id })
  if (!post) return notFound("Post")

  // Idempotency: if already deleted, return not found
  if (post.status === "deleted") return deleted("Post")

  const mediaIds = Array.isArray(post.media)
    ? post.media.map(String)
    : Array.isArray(post.medias)
    ? post.medias.map(String)
    : []

  const postUserId = post.user

  // 2) Soft-delete the post first (single-document atomic write)
  post.status = "deleted"
  post.deletedAt = new Date()
  await post.save()

  // 3) Best-effort cleanup of dependent docs (soft delete)
  await Promise.allSettled([
    deletePostLikes({ postId: post._id, postUserId }),
    deletePostComments({ postId: post._id, postUserId }),
    deleteCommentLikes({ postId: post._id, postUserId }),
    deleteReports(post._id),
    deleteBanHistory(post._id),
  ])

  // 4) Soft-delete media (DB only)
  // Since deleteFile now means "mark media deleted", it’s safe.
  await Promise.allSettled(
    mediaIds.map((id) => deleteFile({ key: id, type: "mediaId" }))
  )

  return deleted("Post")
}

module.exports = deletePost
