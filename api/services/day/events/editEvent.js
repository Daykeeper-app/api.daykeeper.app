const DayEvent = require("../../../models/DayEvent")
const {
  normalizeObjectIdInput,
  isValidObjectIdInput,
} = require("../../../utils/normalizeObjectIdInput")

const {
  errors: { invalidValue, notFound, unauthorized },
  success: { updated },
} = require("../../../../constants/index")

const editEvent = async (props) => {
  const {
    eventId,
    title,
    description,
    dateStart,
    dateEnd,
    privacy,
    loggedUser,
  } = props || {}

  if (!loggedUser?._id) {
    return unauthorized("Unauthorized", "Login required", 401)
  }

  const normalizedEventId = normalizeObjectIdInput(eventId)
  if (!isValidObjectIdInput(normalizedEventId)) {
    return invalidValue("Event ID")
  }

  try {
    const updateData = {}

    if (Object.prototype.hasOwnProperty.call(props, "title"))
      updateData.title = title
    if (Object.prototype.hasOwnProperty.call(props, "description"))
      updateData.description = description
    if (Object.prototype.hasOwnProperty.call(props, "privacy"))
      updateData.privacy = privacy
    if (Object.prototype.hasOwnProperty.call(props, "dateStart"))
      updateData.dateStart = dateStart
    if (Object.prototype.hasOwnProperty.call(props, "dateEnd"))
      updateData.dateEnd = dateEnd

    if (Object.keys(updateData).length === 0) {
      return invalidValue("No fields to update")
    }

    const doc = await DayEvent.findOneAndUpdate(
      { _id: normalizedEventId, user: loggedUser._id },
      { $set: updateData },
      {
        new: true,
        runValidators: true, // IMPORTANT
      }
    )

    if (!doc) {
      // dont exist OR not owned
      return notFound("Event")
    }

    return updated("Day Event", { data: doc })
  } catch (error) {
    throw error
  }
}

module.exports = editEvent
