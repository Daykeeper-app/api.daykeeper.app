const DayEvent = require("../../../models/DayEvent")
const getEventPipeline = require("../../../repositories/pipelines/day/events/getEventPipeline")
const { serializeMediaPayload } = require("../../../utils/serializeMediaPayload")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../utils/normalizeObjectIdInput")

const {
  errors: { notFound, invalidValue, unauthorized },
  success: { fetched },
} = require("../../../../constants/index")

const getEvent = async ({ eventId, loggedUser }) => {
  if (!loggedUser?._id)
    return unauthorized("Unauthorized", "Login required", 401)

  const normalizedEventId = normalizeObjectIdInput(eventId)
  if (!isValidObjectIdInput(normalizedEventId)) return invalidValue("Event ID")

  try {
    const event = await DayEvent.aggregate(
      getEventPipeline(normalizedEventId, loggedUser)
    )

    if (!event || event.length === 0) return notFound("Event")

    return fetched("event", { data: serializeMediaPayload(event[0]) })
  } catch (error) {
    throw error
  }
}

module.exports = getEvent
