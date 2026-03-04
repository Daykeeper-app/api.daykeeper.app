const DayTask = require("../../../models/DayTask")
const getTaskPipeline = require("../../../repositories/pipelines/day/tasks/getTaskPipeline")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../utils/normalizeObjectIdInput")

const {
  errors: { invalidValue, notFound, unauthorized },
  success: { fetched },
} = require("../../../../constants/index")

const getTask = async ({ taskId, loggedUser }) => {
  if (!loggedUser?._id) {
    return unauthorized("Unauthorized", "Login required", 401)
  }

  const normalizedTaskId = normalizeObjectIdInput(taskId)
  if (!isValidObjectIdInput(normalizedTaskId)) {
    return invalidValue("Task ID")
  }

  try {
    const task = await DayTask.aggregate(getTaskPipeline(normalizedTaskId, loggedUser))
    if (!task || task.length === 0) return notFound("Task")

    return fetched("task", { data: task[0] })
  } catch (error) {
    throw error
  }
}

module.exports = getTask
