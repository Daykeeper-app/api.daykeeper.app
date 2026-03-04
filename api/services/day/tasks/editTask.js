const DayTask = require("../../../models/DayTask")
const { parseISO, isValid } = require("date-fns")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../utils/normalizeObjectIdInput")

const {
  errors: { invalidValue, notFound, unauthorized },
  success: { updated },
} = require("../../../../constants/index")

const ALLOWED_PRIVACY = ["public", "private", "close friends"]

const editTask = async (props) => {
  const { taskId, completed, title, date, privacy, loggedUser } = props || {}
  const normalizedTaskId = normalizeObjectIdInput(taskId)

  if (!isValidObjectIdInput(normalizedTaskId)) {
    return invalidValue("Task ID")
  }

  try {
    const existing = await DayTask.findOne({
      _id: normalizedTaskId,
      user: loggedUser._id,
    })
    if (!existing) return notFound("Task")

    const updateData = {}

    // --- title ---
    if (Object.prototype.hasOwnProperty.call(props, "title")) {
      if (typeof title !== "string" || title.trim().length < 1) {
        return invalidValue("Title")
      }
      updateData.title = title.trim()
    }

    // --- privacy ---
    if (Object.prototype.hasOwnProperty.call(props, "privacy")) {
      if (privacy !== undefined && !ALLOWED_PRIVACY.includes(privacy)) {
        return invalidValue("Privacy")
      }
      updateData.privacy = privacy
    }

    // --- completed ---
    if (Object.prototype.hasOwnProperty.call(props, "completed")) {
      if (typeof completed !== "boolean") {
        return invalidValue("Completed")
      }

      // Templates can never be completed
      if (existing.daily === true && completed === true) {
        return invalidValue("Completed")
      }

      updateData.completed = completed
    }

    // --- date ---
    if (Object.prototype.hasOwnProperty.call(props, "date")) {
      // Templates should not have a date
      if (existing.daily === true) {
        return invalidValue("Date")
      }

      const d = typeof date === "string" ? parseISO(date) : new Date(date)
      if (!isValid(d)) return invalidValue("Date")
      updateData.date = d
    }

    // nothing to update
    if (Object.keys(updateData).length === 0) {
      return invalidValue("No fields to update")
    }

    // Apply update
    const doc = await DayTask.findOneAndUpdate(
      { _id: normalizedTaskId, user: loggedUser._id },
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!doc) return notFound("Task")

    return updated("Task", { data: doc })
  } catch (error) {
    throw error
  }
}

module.exports = editTask
