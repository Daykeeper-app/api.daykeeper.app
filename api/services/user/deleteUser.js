const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const User = require("../../models/User")
const {
  success: { deleted },
  errors: { fieldNotFilledIn, invalidValue, unauthorized, notFound },
} = require("../../../constants/index")

const deleteProfilePicture = require("./delete/deleteProfilePicture")
const deletePostsLikes = require("./delete/deletePostsLikes")
const deleteUserComments = require("./delete/deleteUserComments")
const deleteCommentsLikes = require("./delete/deleteCommentsLikes")
const deleteFollowers = require("./delete/deleteFollowers")
const deletePosts = require("./delete/deletePosts")
const deleteEvents = require("../day/events/delete/deleteEvents")
const deleteTasks = require("../day/tasks/delete/deleteTasks")
const deleteUserFromDatabase = require("./delete/deleteUser")

const deleteReports = require("../admin/delete/deleteReports")
const deleteBanHistory = require("../admin/delete/deleteBanHistory")

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex")
}

const deleteUser = async (props) => {
  const { loggedUser, password, code } = props

  try {
    if (!password || !code) return fieldNotFilledIn("password or code")

    const userDoc = await User.findById(loggedUser._id).select(
      "password delete_code_hash delete_expires_at email"
    )
    if (!userDoc) return notFound("User")

    if (!userDoc.password)
      return unauthorized("delete user", "Password is not set for this user")

    const passwordOk = await bcrypt.compare(password, userDoc.password)
    if (!passwordOk) return invalidValue("Password")

    if (!userDoc.delete_code_hash || !userDoc.delete_expires_at) {
      return invalidValue("Verification code")
    }

    if (userDoc.delete_expires_at.getTime() < Date.now()) {
      await User.updateOne(
        { _id: userDoc._id },
        { $unset: { delete_code_hash: 1, delete_expires_at: 1 } }
      )
      return invalidValue("Verification code")
    }

    const codeHash = hashCode(code.toString().trim())
    if (userDoc.delete_code_hash !== codeHash) {
      await User.updateOne(
        { _id: userDoc._id },
        { $unset: { delete_code_hash: 1, delete_expires_at: 1 } }
      )
      return invalidValue("Verification code")
    }

    // 1) soft delete the user FIRST (should set status:"deleted" + deletedAt)
    const deletedUser = await deleteUserFromDatabase(loggedUser._id)

    await User.updateOne(
      { _id: loggedUser._id },
      { $unset: { delete_code_hash: 1, delete_expires_at: 1 } }
    )

    // if already deleted, treat as success (idempotent)
    if (deletedUser?.status === "deleted") {
      return deleted("User", { user: deletedUser })
      // return it maybe? If I want best effort
    }

    // 2) best-effort cleanup (soft deletes)
    const results = await Promise.allSettled([
      deleteProfilePicture(loggedUser),
      deletePostsLikes(loggedUser._id),
      deleteUserComments(loggedUser._id),
      deleteCommentsLikes(loggedUser._id),
      deleteFollowers(loggedUser._id),
      deletePosts(loggedUser._id),
      deleteReports(loggedUser._id),
      deleteBanHistory(loggedUser._id),
      deleteEvents(loggedUser._id),
      deleteTasks(loggedUser._id),
    ])

    const pick = (i) =>
      results[i]?.status === "fulfilled" ? results[i].value : 0

    return deleted("User", {
      user: deletedUser,
      posts_likes: pick(1),
      comments: pick(2),
      comments_likes: pick(3),
      followers: pick(4),
      posts: pick(5),
      reports: pick(6),
      ban_history: pick(7),
    })
  } catch (error) {
    console.error(error)
    throw new Error(error.message)
  }
}

module.exports = deleteUser
