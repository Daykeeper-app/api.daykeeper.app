const taskInfoPipeline = require("../../common/day/tasks/taskInfoPipeline")
const mongoose = require("mongoose")

function escapeRegex(input = "") {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const searchTaskPipeline = (searchQuery, filterPipe, mainUser) => {
  const q = (searchQuery || "").trim().slice(0, 64)
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
                ...(regex ? [{ title: { $regex: regex } }] : []),
                ...(objectIdQuery ? [{ _id: objectIdQuery }] : []),
              ],
            }
          : {}),
      },
    },

    { $sort: { date: -1, _id: -1 } },

    ...taskInfoPipeline(mainUser),
  ]
}

module.exports = searchTaskPipeline
