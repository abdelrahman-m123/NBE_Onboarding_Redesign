import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'

const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = process.env.LOG_LEVEL || 'info'
const minimumLevel = levels[configuredLevel] || levels.info

function serialize(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item instanceof Error) {
      return {
        name: item.name,
        message: item.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : item.stack,
      }
    }
    return item
  })
}

function write(level, message, meta = {}) {
  if (levels[level] < minimumLevel) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }

  const output = serialize(entry)
  if (level === 'error') console.error(output)
  else if (level === 'warn') console.warn(output)
  else console.log(output)
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
}

export function requestLogger(request, response, next) {
  const startedAt = performance.now()
  const requestId = crypto.randomUUID()
  request.requestId = requestId
  response.setHeader('X-Request-Id', requestId)

  logger.info('request.started', {
    requestId,
    method: request.method,
    path: request.path,
  })

  response.on('finish', () => {
    logger.info('request.finished', {
      requestId,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    })
  })

  next()
}
