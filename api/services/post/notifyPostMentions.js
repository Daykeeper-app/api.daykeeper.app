const User = require("../../models/User")
const { createNotificationWithLimits } = require("../notification/createNotification")

const MAX_MENTIONS_PER_POST = 20
const USERNAME_REGEX = /(^|[^A-Za-z0-9_])@([A-Za-z0-9._]{1,40})/g

function extractMentionUsernames(text) {
  if (typeof text !== "string" || !text.trim()) return []

  const found = new Set()
  let match
  while ((match = USERNAME_REGEX.exec(text)) !== null) {
    const username = String(match[2] || "")
      .trim()
      .toLowerCase()
    if (!username) continue
    found.add(username)
    if (found.size >= MAX_MENTIONS_PER_POST) break
  }

  return [...found]
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function findUsersByUsernames(usernames) {
  if (!Array.isArray(usernames) || usernames.length === 0) return []

  const orConditions = usernames.map((username) => ({
    username: new RegExp(`^${escapeRegex(username)}$`, "i"),
  }))

  return User.find(
    {
      $or: orConditions,
      status: { $ne: "deleted" },
      deletedAt: null,
      banned: { $ne: true },
      verified_email: true,
    },
    { _id: 1, username: 1 }
  ).lean()
}

async function notifyPostMentions({
  postId,
  actorId,
  actorUsername,
  nextText,
  prevText = "",
}) {
  const nextMentions = extractMentionUsernames(nextText)
  if (nextMentions.length === 0) return

  const prevMentions = extractMentionUsernames(prevText)

  const [nextUsers, prevUsers] = await Promise.all([
    findUsersByUsernames(nextMentions),
    prevMentions.length ? findUsersByUsernames(prevMentions) : Promise.resolve([]),
  ])

  const actorIdStr = String(actorId)
  const alreadyMentionedUserIds = new Set(prevUsers.map((u) => String(u._id)))

  const usersToNotify = nextUsers.filter((u) => {
    const userId = String(u._id)
    if (userId === actorIdStr) return false
    if (alreadyMentionedUserIds.has(userId)) return false
    return true
  })

  if (usersToNotify.length === 0) return

  await Promise.all(
    usersToNotify.map((targetUser) =>
      createNotificationWithLimits({
        userId: targetUser._id,
        type: "post_mention",
        title: "You were mentioned",
        body: `@${actorUsername} mentioned you in a post.`,
        data: {
          actorId: actorId,
          actorUsername: actorUsername,
          targetId: postId,
          postId: postId,
          mentionedUsername: targetUser.username,
        },
        actorId: actorId,
        targetId: postId,
        debounceMs: 5 * 60 * 1000,
        maxPerWindow: 10,
      })
    )
  )
}

module.exports = notifyPostMentions
