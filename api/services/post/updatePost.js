const Post = require("../../models/Post")
const Media = require("../../models/Media")
const deleteFile = require("../../utils/deleteFile")
const getPost = require("./getPost")
const { ensurePostMediaPrivacy } = require("../../utils/postMediaPrivacy")

const deletePostLikes = require("./delete/deletePostLikes")
const deletePostComments = require("./delete/deletePostComments")
const deleteCommentLikes = require("./delete/deleteCommentLikes")

const {
  errors: { notFound },
  success: { updated },
} = require("../../../constants/index")

function parseIdArray(input) {
  if (!input) return []

  // If already an array
  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean)
  }

  // If JSON stringified array
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input)
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean)
      }
    } catch {
      // fallback: comma-separated string
      return input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }

  return []
}

function normalizePostPrivacy(privacy) {
  if (typeof privacy !== "string") return privacy
  const normalized = privacy.trim().toLowerCase().replace(/\s+/g, "_")
  if (normalized === "close_friends") return "close friends"
  return normalized
}

const updatePost = async (props) => {
  const {
    data,
    privacy,
    emotion,
    postId,
    loggedUser,
    mediaDocs = [],
    keepMediaIds = [],
  } = props || {}

  const keepIds = parseIdArray(keepMediaIds)
  const normalizedPrivacy = normalizePostPrivacy(privacy)

  try {
    // 1) Permission / existence check
    const postResponse = await getPost({ postId, loggedUser })
    if (postResponse.code !== 200) return notFound("Post")

    // get REAL mongoose doc so .save works
    const post = await Post.findById(postId)
    if (!post) return notFound("Post")

    // 2) media currently on post
    const postMediaIds = (post.media || []).map(String)
    const keepIdsOnPost = keepIds.filter((id) => postMediaIds.includes(id))

    const mediaToKeep = keepIdsOnPost.length
      ? await Media.find({ _id: { $in: keepIdsOnPost } })
      : []

    // 3) delete medias removed by user (only those belonging to this post)
    const idsToDelete = postMediaIds.filter((id) => !keepIdsOnPost.includes(id))

    if (idsToDelete.length) {
      const mediaToDelete = await Media.find({ _id: { $in: idsToDelete } })

      await Promise.all(mediaToDelete.map((m) => deleteFile({ key: m.key })))
      await Media.deleteMany({ _id: { $in: idsToDelete } })
    }

    // 5) link post usage to new medias
    if (mediaDocs.length) {
      await Media.updateMany(
        { _id: { $in: mediaDocs.map((m) => m._id) } },
        { $set: { usedIn: { model: "Post", refId: post._id } } }
      )
    }

    // 6) status based on media moderation
    const allMedia = [...mediaToKeep, ...mediaDocs]
    const postStatus =
      allMedia.length === 0 || allMedia.every((m) => m.status === "public")
        ? "public"
        : "pending"

    // 7) privacy change cleanup
    if (normalizedPrivacy && post.privacy !== normalizedPrivacy) {
      if (["private", "close friends"].includes(normalizedPrivacy)) {
        await deletePostLikes({ postId: post._id, postUserId: post.user })
        await deletePostComments({ postId: post._id, postUserId: post.user })
        await deleteCommentLikes({ postId: post._id, postUserId: post.user })
      }
    }

    // 8) update fields (assumes validated)
    if (data !== undefined) post.data = data
    if (normalizedPrivacy !== undefined) post.privacy = normalizedPrivacy
    if (emotion !== undefined) post.emotion = emotion // only if your schema has it

    post.media = allMedia.map((m) => m._id)
    post.status = postStatus
    post.edited_at = new Date()

    await post.save()

    const promotedMedia = allMedia.filter((m) => m.status === "public")
    if (promotedMedia.length) {
      await ensurePostMediaPrivacy({ post, medias: promotedMedia })
    }

    return updated("post")
  } catch (error) {
    console.error(error)

    await Promise.all((mediaDocs || []).map((m) => deleteFile({ key: m.key })))

    throw new Error(error.message)
  }
}

module.exports = updatePost
