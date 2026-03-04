const express = require("express")
const router = express.Router()
const {
  createEvent,
  editEvent,
  deleteEvent,
  getEvent,
  getEventByDate,

  createTask,
  editTask,
  deleteTask,
  getTask,
  getDailyTasks,
  getTasksByDate,
} = require("../api/controllers/dayController")

// Middlewares
const checkTokenMW = require("../middlewares/checkTokenMW")
const createEventValidation = require("../middlewares/validations/day/events/createEventValidation")
const editEventValidation = require("../middlewares/validations/day/events/editEventValidation")
const createTaskValidation = require("../middlewares/validations/day/tasks/createTaskValidation")
const editTaskValidation = require("../middlewares/validations/day/tasks/editTaskValidation")

// Event Router
router.post("/event", checkTokenMW, createEventValidation, createEvent)
router.put("/event/:eventId", checkTokenMW, editEventValidation, editEvent)
router.delete("/event/:eventId", checkTokenMW, deleteEvent)
router.get("/event/:eventId", checkTokenMW, getEvent)
router.get("/event/:username/:date", checkTokenMW, getEventByDate)

// Task Router
router.post("/task", checkTokenMW, createTaskValidation, createTask)
router.put("/task/:taskId", checkTokenMW, editTaskValidation, editTask)
router.delete("/task/:taskId", checkTokenMW, deleteTask)
router.get("/task/:taskId", checkTokenMW, getTask)
router.get("/task/:username/:date", checkTokenMW, getTasksByDate)

router.get(
  "/dailyTasks",
  checkTokenMW,
  (req, res, next) => {
    req.params.username = req.user.username
    return next()
  },
  getDailyTasks
)
router.get("/:username/dailyTasks", checkTokenMW, getDailyTasks)

module.exports = router
