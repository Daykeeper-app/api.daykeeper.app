const deleteTaskDoc = require("./delete/deleteTasks")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../utils/normalizeObjectIdInput")

const {
  errors: { notFound, invalidValue },
  success: { deleted },
} = require("../../../../constants/index")

const deleteTask = async (props) => {
  const { taskId } = props || {}
  const normalizedTaskId = normalizeObjectIdInput(taskId)

  if (!isValidObjectIdInput(normalizedTaskId)) {
    return invalidValue("Task ID")
  }

  const changed = await deleteTaskDoc(normalizedTaskId)

  if (!changed) return notFound("Task")

  return deleted("Day Task")
}

module.exports = deleteTask
