const {
  user: { defaultPfp, defaultTimeZone },
  auth: { registerCodeExpiresTime },
  success: { custom },
} = require("../../../constants/index")
const { serializeMediaPayload } = require("../../utils/serializeMediaPayload")
const {
  signAccessToken,
  makeRefreshToken,
  storeRefreshToken,
} = require("../../utils/token")

function sanitizeUser(user) {
  return serializeMediaPayload({
    id: user._id,
    username: user.username,
    email: user.email,
    profile_picture: user.profile_picture,
    roles: user.roles,
  })
}

async function login(props) {
  const { user, deviceId, ip, userAgent } = props

  const accessToken = signAccessToken(user)
  const refreshToken = makeRefreshToken()

  await storeRefreshToken({
    userId: user._id,
    refreshToken,
    deviceId,
    ip,
    userAgent,
  })

  return custom(`${user?.username} logged successfully`, {
    props: {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    },
  })
}

module.exports = login
