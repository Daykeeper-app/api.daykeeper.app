const User = require("../../../models/User")
const getDailyTasksPipeline = require("../../../repositories/pipelines/day/tasks/getDailyTasksPipeline")
const getDataWithPages = require("../../getDataWithPages")

const {
  errors: { notFound, unauthorized },
  success: { fetched },
} = require("../../../../constants/index")

const getDailyTasks = async (props) => {
  const { loggedUser, username, page, maxPageSize } = props || {}

  try {
    let targetUser = loggedUser

    // Just you can see your daily tasks
    if (username) {
      targetUser = await User.findOne({
        username,
        status: "public",
        verified_email: true,
      })
      if (!targetUser) return notFound("User")
    }

    const tasks = await getDataWithPages(
      {
        type: "Task",
        pipeline: getDailyTasksPipeline(targetUser, loggedUser),
        page,
        maxPageSize,
      },
      loggedUser
    )

    return fetched("Daily Tasks", tasks || { data: [] })
  } catch (error) {
    throw error
  }
}

module.exports = getDailyTasks
