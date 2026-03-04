const cron = require("node-cron")
const User = require("../../models/User")

const {
  delete: { UserRetentionDays: USER_RETENTION_DAYS },
} = require("../../../constants/index")

const hardDeleteProfilePicture = require("../../services/user/delete/hardDeleteProfilePicture")
const hardDeletePostsLikes = require("../../services/user/delete/hardDeletePostsLikes")
const hardDeleteUserComments = require("../../services/user/delete/hardDeleteUserComments")
const hardDeleteCommentsLikes = require("../../services/user/delete/hardDeleteCommentsLikes")
const hardDeleteFollowers = require("../../services/user/delete/hardDeleteFollowers")
const hardDeletePosts = require("../../services/user/delete/hardDeletePosts")
const hardDeleteUser = require("../../services/user/delete/hardDeleteUser")
const hardDeleteEvents = require("../../services/day/events/delete/hardDeleteEvents")
const hardDeleteTasks = require("../../services/day/tasks/delete/hardDeleteTasks")

const hardDeleteReportsByUser = require("../../services/admin/delete/hardDeleteReportsByUser")
const hardDeleteBanHistoryByUser = require("../../services/admin/delete/hardDeleteBanHistoryByUser")

const BATCH_SIZE = Number(process.env.USER_PURGE_BATCH || 5)

const hardDeleteSoftDeletedUsers = async () => {
  try {
    const cutoff = new Date(
      Date.now() - USER_RETENTION_DAYS * 24 * 60 * 60 * 1000
    )

    const users = await User.find({
      status: "deleted",
      deletedAt: { $ne: null, $lt: cutoff },
    })
      .sort({ deletedAt: 1 })
      .limit(BATCH_SIZE)

    if (!users.length) return

    for (const u of users) {
      const userId = String(u._id)

      try {
        // 1) remove their likes on comments (collection-based version, or embedded if you still had it)
        await hardDeleteCommentsLikes(userId)

        // 2) hard delete dependent collections
        await Promise.allSettled([
          hardDeletePostsLikes(userId),
          hardDeleteUserComments(userId),
          hardDeleteFollowers(userId),
          hardDeletePosts(userId),

          hardDeleteEvents(userId),
          hardDeleteTasks(userId),

          hardDeleteReportsByUser(userId),
          hardDeleteBanHistoryByUser(userId),
        ])

        // 3) delete their profile picture object (if not default)
        await hardDeleteProfilePicture(userId)

        // 4) delete the user last
        await hardDeleteUser(userId)

        console.log("PURGED user:", userId)
      } catch (err) {
        console.error("PURGE failed user:", userId, err)
      }
    }
  } catch (err) {
    console.error("hardDeleteSoftDeletedUsers cron failed:", err)
  }
}

// Every day at 04:00
cron.schedule("0 4 * * *", hardDeleteSoftDeletedUsers)

module.exports = hardDeleteSoftDeletedUsers
