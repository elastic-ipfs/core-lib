
import pino from 'pino'

function createLogger ({ version, pretty = false, level = 'info' } = {}, destination) {
  let transport
  if (pretty) {
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }

  const logger = pino(
    {
      level,
      base: { v: version },
      timestamp: pino.stdTimeFunctions.isoTime,
      transport,
      serializers: {
        err: (e) => `[${e.code || e.constructor.name}] ${e.message}\n${e.stack}`
      }
    }, destination
  )

  return logger
}

export {
  createLogger
}
