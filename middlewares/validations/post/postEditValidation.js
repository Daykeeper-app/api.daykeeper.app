const deleteFile = require("../../../api/utils/deleteFile")
const {
  errors: { serverError },
  post: { maxPostLength },
} = require("../../../constants/index")

const ALLOWED_PRIVACY = new Set([
  "public",
  "private",
  "close friends",
  "close_friends",
])

async function cleanupUploadedFiles(req) {
  const files = req.files || []
  await Promise.all(files.map((f) => deleteFile({ key: f.key })))
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0
}

function isIntegerStringOrNumber(v) {
  // Accept "50" or 50
  if (typeof v === "number") return Number.isInteger(v)
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    return Number.isInteger(n)
  }
  return false
}

const postEditValidation = async (req, res, next) => {
  const { data, privacy, emotion } = req.body

  const badRequest = async (status, message) => {
    await cleanupUploadedFiles(req)
    return res.status(status).json({ message })
  }

  try {
    // data
    if (data !== undefined) {
      if (typeof data !== "string") return badRequest(400, "Invalid data value")
      if (data.length > maxPostLength)
        return badRequest(413, "Text is too long")
    }

    // privacy
    if (privacy !== undefined) {
      if (typeof privacy !== "string")
        return badRequest(400, "Invalid privacy value")

      const normalized = privacy.trim().toLowerCase().replace(/\s+/g, "_")
      if (!ALLOWED_PRIVACY.has(normalized))
        return badRequest(400, "Invalid privacy value")

      // normalize so controllers always receive your internal value
      req.body.privacy =
        normalized === "close_friends" ? "close friends" : normalized
    }

    // emotion (0..100 integer)
    if (emotion !== undefined) {
      if (!isIntegerStringOrNumber(emotion))
        return badRequest(400, "Invalid emotion value")

      const n = Number(emotion)
      if (n < 0 || n > 100) return badRequest(400, "Invalid emotion value")

      // normalize
      req.body.emotion = n
    }

    return next()
  } catch (error) {
    return res.status(500).json({ message: serverError(error.message).message })
  }
}

module.exports = postEditValidation
