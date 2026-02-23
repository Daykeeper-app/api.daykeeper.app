const cron = require("node-cron")
const User = require("../models/User")

const {
  user: { defaultTimeZone },
} = require("../../constants/index")

async function resetBrokenStreaks() {
  try {
    const res = await User.updateMany(
      {
        currentStreak: { $gt: 0 },
        $expr: {
          $or: [
            { $eq: [{ $ifNull: ["$streakLastDay", null] }, null] },
            {
              $lt: [
                "$streakLastDay",
                {
                  $dateToString: {
                    date: {
                      $dateSubtract: {
                        startDate: "$$NOW",
                        unit: "day",
                        amount: 1,
                      },
                    },
                    format: "%Y-%m-%d",
                    timezone: { $ifNull: ["$timeZone", defaultTimeZone] },
                  },
                },
              ],
            },
          ],
        },
      },
      { $set: { currentStreak: 0 } }
    )

    if (!res.modifiedCount) {
      console.log("No broken streaks to reset.")
      return
    }

    console.log(`Reset currentStreak=0 for ${res.modifiedCount} users.`)
  } catch (err) {
    console.error("Error resetting broken streaks:", err)
  }
}

// once daily at 00:05 server time by default
const defaultStreakResetCron = "5 0 * * *"
const streakResetCron = process.env.STREAK_RESET_CRON || defaultStreakResetCron
const safeStreakResetCron = cron.validate(streakResetCron)
  ? streakResetCron
  : defaultStreakResetCron

cron.schedule(safeStreakResetCron, async () => {
  console.log("Running broken streak reset job...")
  await resetBrokenStreaks()
})
