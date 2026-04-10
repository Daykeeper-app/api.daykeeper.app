const { isValid, isBefore } = require("date-fns")

const {
  day: {
    event: {
      maxEventTitleLength: MAX_TITLE_LENGTH,
      maxEventDescriptionLength: MAX_DESCRIPTION_LENGTH,
    },
  },
} = require("../../../../constants/index")

const ALLOWED_PRIVACY = ["public", "private", "close friends"]

const createEvent = async (req, res, next) => {
  const { title, description, privacy, placeId } = req.body

  // Title (required)
  if (typeof title !== "string" || title.trim().length < 1) {
    return res.status(400).json({ message: "Event Title is required" })
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    return res.status(413).json({ message: "Event Title is too long" })
  }

  // Description (optional, but if present must be valid)
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return res.status(400).json({ message: "Invalid Event Description" })
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return res.status(413).json({ message: "Event Description is too long" })
    }
  }

  // Dates (required)
  const dateStart = new Date(req.body.dateStart)
  const dateEnd = new Date(req.body.dateEnd)

  if (!isValid(dateStart) || !isValid(dateEnd)) {
    return res.status(400).json({ message: "Invalid Date" })
  }
  if (!isBefore(dateStart, dateEnd)) {
    return res.status(400).json({ message: "dateStart must be before dateEnd" })
  }

  // Privacy (optional)
  if (privacy !== undefined && !ALLOWED_PRIVACY.includes(privacy)) {
    return res.status(400).json({ message: "Invalid privacy value" })
  }

  try {
    // Place check (optional)
    if (placeId) {
      const placeById = await getPlaceById({ placeId })

      // keep your service contract (code/status/message)
      if (!placeById || (placeById?.status != 200 && placeById?.code != 200)) {
        return res
          .status(placeById?.code || 400)
          .json({ message: placeById?.message || "Invalid placeId" })
      }
    }

    return next()
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: error.message })
  }
}

module.exports = createEvent
