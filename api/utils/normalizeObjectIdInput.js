const mongoose = require("mongoose")

function normalizeObjectIdInput(value) {
  if (!value) return ""

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return ""

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object") {
          if (typeof parsed._id === "string") return parsed._id.trim()
          if (typeof parsed.id === "string") return parsed.id.trim()
        }
      } catch {
        return trimmed
      }
    }

    return trimmed
  }

  if (typeof value === "object") {
    if (typeof value._id === "string") return value._id.trim()
    if (typeof value.id === "string") return value.id.trim()
  }

  return String(value).trim()
}

function isValidObjectIdInput(value) {
  return mongoose.Types.ObjectId.isValid(normalizeObjectIdInput(value))
}

module.exports = {
  normalizeObjectIdInput,
  isValidObjectIdInput,
}
