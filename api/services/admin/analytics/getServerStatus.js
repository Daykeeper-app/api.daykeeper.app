const os = require("os")
const mongoose = require("mongoose")
const { readyStateLabels } = require("./shared")

module.exports = async () => {
  const memoryUsage = process.memoryUsage()
  const readyState = mongoose.connection.readyState
  const databaseStatus = readyStateLabels[readyState] || "unknown"
  const status = readyState === 1 ? "ok" : "degraded"

  return {
    code: 200,
    message: "Server status fetched successfully",
    response: {
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
      uptimeHuman: `${Math.floor(process.uptime())}s`,
      database: {
        status: databaseStatus,
        readyState,
        host: mongoose.connection.host || null,
        name: mongoose.connection.name || null,
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
        hostname: os.hostname(),
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
    },
  }
}
