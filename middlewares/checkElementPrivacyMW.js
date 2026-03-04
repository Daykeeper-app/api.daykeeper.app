const CloseFriends = require("../api/models/CloseFriends")
const DayEvent = require("../api/models/DayEvent")
const DayTask = require("../api/models/DayTask")

const {
  errors: { serverError },
} = require("../constants/index")

function checkElementPrivacy(elementType) {
  return async (req, res, next) => {
    const { eventId, taskId } = req.params
    const loggedUser = req.user

    try {
      const element = await (async () => {
        switch (elementType) {
          case "event":
            return DayEvent.findById(eventId)
          case "task":
            return DayTask.findById(taskId)
          default:
            return res.status(400).json({ message: "Invalid element type" })
        }
      })()

      if (!element)
        return res.status(404).json({ message: `Element not found` })
      if (!element.privacy || element.privacy === "public") return next()

      const { privacy, user } = element

      if (privacy === "private" && !user.equals(loggedUser._id)) {
        return res.status(409).json({ message: "This element is Private" })
      }

      if (privacy === "close friends") {
        const isInCloseFriends = await CloseFriends.exists({
          userId: loggedUser._id,
          closeFriendId: user,
        })

        if (!isInCloseFriends)
          return res
            .status(409)
            .json({ message: "You cannot access this element" })
      }

      return next()
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ message: serverError(error.message).message })
    }
  }
}

module.exports = checkElementPrivacy
