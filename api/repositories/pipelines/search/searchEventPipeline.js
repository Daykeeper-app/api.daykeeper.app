const eventInfoPipeline = require("../../common/day/events/eventInfoPipeline")
const mongoose = require("mongoose")

function escapeRegex(input = "") {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const searchEventPipeline = (searchQuery, filterPipe, mainUser) => {
  const q = (searchQuery || "").trim().slice(0, 64) // clamp length
  const safe = escapeRegex(q)
  const regex = safe ? new RegExp(safe, "i") : null
  const objectIdQuery = mongoose.Types.ObjectId.isValid(q)
    ? new mongoose.Types.ObjectId(q)
    : null

  return [
    {
      $match: {
        ...(filterPipe && Object.keys(filterPipe).length ? filterPipe : {}),
        ...(regex || objectIdQuery
          ? {
              $or: [
                ...(regex
                  ? [
                      { title: { $regex: regex } },
                      { description: { $regex: regex } },
                    ]
                  : []),
                ...(objectIdQuery ? [{ _id: objectIdQuery }] : []),
              ],
            }
          : {}),
      },
    },
    { $sort: { dateStart: 1, _id: 1 } },
    ...eventInfoPipeline(mainUser),

    {
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        dateStart: 1,
        dateEnd: 1,
        location: 1,
        privacy: 1,
        user: 1,
        user_info: 1,
        created_at: 1,
      },
    },
  ]
}

module.exports = searchEventPipeline
