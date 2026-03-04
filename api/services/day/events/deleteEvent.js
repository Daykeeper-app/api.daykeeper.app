const deleteEventDoc = require("./delete/deleteEvents")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../utils/normalizeObjectIdInput")

const {
  errors: { notFound, invalidValue },
  success: { deleted },
} = require("../../../../constants/index")

const deleteEvent = async (props) => {
  const { eventId } = props || {}
  const normalizedEventId = normalizeObjectIdInput(eventId)

  if (!isValidObjectIdInput(normalizedEventId)) {
    return invalidValue("Event ID")
  }

  const changed = await deleteEventDoc(normalizedEventId)

  if (!changed) return notFound("Event")

  return deleted("Day Event")
}

module.exports = deleteEvent
