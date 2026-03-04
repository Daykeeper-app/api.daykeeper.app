const postInfoPipeline = require("../../common/postInfoPipeline")
const taskInfoPipeline = require("../../common/day/tasks/taskInfoPipeline")
const eventInfoPipeline = require("../../common/day/events/eventInfoPipeline")

const feedMixedPipeline = (mainUser) => [
  ...postInfoPipeline(mainUser),
  {
    $addFields: {
      type: "post",
      sortDate: "$date",
    },
  },
  {
    $unionWith: {
      coll: "dayTask",
      pipeline: [
        ...taskInfoPipeline(mainUser),
        {
          $addFields: {
            type: "task",
            sortDate: "$date",
          },
        },
      ],
    },
  },
  {
    $unionWith: {
      coll: "dayEvent",
      pipeline: [
        ...eventInfoPipeline(mainUser),
        {
          $addFields: {
            type: "event",
            sortDate: "$dateStart",
          },
        },
      ],
    },
  },
]

module.exports = feedMixedPipeline
