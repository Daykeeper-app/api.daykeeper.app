const { isValid, isBefore } = require("date-fns")
const getEvent = require("../../../../api/services/day/events/getEvent")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../../api/utils/normalizeObjectIdInput")

const {
  day: {
    event: { maxEventTitleLength, maxEventDescriptionLength },
  },
} = require("../../../../constants/index")

const createEvent = async (req, res, next) => {
  const {
    title,
    description,
    privacy,
    placeId,
  } = req.body
  const rawEventId = req.params?.eventId
  const normalizedEventId = normalizeObjectIdInput(rawEventId)
  if (!isValidObjectIdInput(normalizedEventId)) {
    return res.status(400).json({ message: "The Event ID is Invalid" })
  }
  req.params.eventId = normalizedEventId

  // Validations
  if (description !== undefined && description !== null && typeof description !== "string")
    return res.status(400).json({ message: "Invalid Event Description" })
  if (typeof description === "string" && description.length > maxEventDescriptionLength)
    return res.status(413).json({ message: "Event Description is too long" })
  if (title && title?.length > maxEventTitleLength)
    return res.status(413).json({ message: "Event Title is too long" })

  const dateStart = req.body.dateStart ? new Date(req.body.dateStart) : null
  const dateEnd = req.body.dateEnd ? new Date(req.body.dateEnd) : null

  if (
    (dateStart && !isValid(dateStart)) ||
    (dateEnd && !isValid(dateEnd)) ||
    (dateStart && dateEnd && !isBefore(dateStart, dateEnd))
  )
    return res.status(400).json({ message: "Invalid Date" })

  // Privacy
  if (privacy)
    switch (privacy) {
      case "public":
      case "private":
      case "close friends":
      case undefined:
        break
      default:
        return res.status(404).json({ message: "Invalid privacy value" })
    }

  try {
    const event = await getEvent({ eventId: normalizedEventId, loggedUser: req.user })
    if (event?.code !== 200)
      return res.status(event?.code || 404).json({ message: "Event not Found" })

    if (placeId) {
      const placeById = await getPlaceById({ placeId })
      if (!placeById || placeById?.code != 200)
        return res.status(placeById.code).json({ message: placeById.message })
    }

    return next()
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

module.exports = createEvent
