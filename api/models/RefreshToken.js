const mongoose = require("mongoose")

const RefreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    deviceId: { type: String, default: null }, // optional
    ip: { type: String, default: null }, // optional
    userAgent: { type: String, default: null }, // optional
  },
  { timestamps: true }
)

// Auto-clean expired refresh tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RefreshToken = mongoose.model(
  "RefreshTokens",
  RefreshTokenSchema,
  "refreshToken"
)

module.exports = RefreshToken
