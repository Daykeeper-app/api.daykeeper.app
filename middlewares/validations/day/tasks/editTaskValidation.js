const getTask = require("../../../../api/services/day/tasks/getTask")
const { isValid } = require("date-fns")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../../api/utils/normalizeObjectIdInput")

const {
  day: {
    task: { maxTitleLength },
  },
} = require("../../../../constants/index")

const ALLOWED_PRIVACY = ["public", "private", "close friends"]

const editTaskValidation = async (req, res, next) => {
  const { taskId } = req.params
  const { title, privacy } = req.body

  // Support old "value" field and new "completed"
  const hasCompleted =
    Object.prototype.hasOwnProperty.call(req.body, "completed") ||
    Object.prototype.hasOwnProperty.call(req.body, "value")

  const completed =
    typeof req.body.completed === "boolean"
      ? req.body.completed
      : typeof req.body.value === "boolean"
      ? req.body.value
      : undefined

  // TaskId validation
  const normalizedTaskId = normalizeObjectIdInput(taskId)
  if (!isValidObjectIdInput(normalizedTaskId)) {
    return res.status(400).json({ message: "The Task ID is Invalid" })
  }
  req.params.taskId = normalizedTaskId

  // Title validation (optional)
  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    if (typeof title !== "string" || title.trim().length < 1) {
      return res.status(400).json({ message: "Invalid Title" })
    }
    if (title.trim().length > maxTitleLength) {
      return res.status(413).json({ message: "Task Title is too long" })
    }
  }

  // Privacy validation (optional)
  if (Object.prototype.hasOwnProperty.call(req.body, "privacy")) {
    if (privacy !== undefined && !ALLOWED_PRIVACY.includes(privacy)) {
      return res.status(400).json({ message: "Invalid privacy value" })
    }
  }

  // Date validation (optional)
  const hasDate = Object.prototype.hasOwnProperty.call(req.body, "date")
  const date = hasDate && req.body.date ? new Date(req.body.date) : null

  if (hasDate && req.body.date && (!date || !isValid(date))) {
    return res.status(400).json({ message: "Date is Invalid" })
  }

  try {
    const taskRes = await getTask({ taskId: normalizedTaskId, loggedUser: req.user })
    if (taskRes?.code != 200) {
      return res.status(404).json({ message: "Task not Found" })
    }

    const task = taskRes?.data || taskRes?.task || taskRes

    // If it's a DAILY TEMPLATE, block invalid edits
    if (task?.daily === true) {
      if (hasDate) {
        return res
          .status(400)
          .json({ message: "Daily task templates cannot have a date" })
      }

      if (hasCompleted && completed === true) {
        return res
          .status(400)
          .json({ message: "Daily task templates cannot be completed" })
      }
    }

    return next()
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

module.exports = editTaskValidation
