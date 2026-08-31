import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'

type NextFunction = () => void

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogMeta = Record<string, unknown>
interface RequestWithId {
  requestId?: string
  method: string
  path: string
}

interface ResponseLike {
  statusCode: number
  setHeader(name: string, value: string): void
  on(event: 'finish', listener: () => void): void
}

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = (process.env.LOG_LEVEL || 'info') as LogLevel
const minimumLevel = levels[configuredLevel] || levels.info

function serialize(value: unknown) {
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

function write(level: LogLevel, message: string, meta: LogMeta = {}) {
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
  debug: (message: string, meta?: LogMeta) => write('debug', message, meta),
  info: (message: string, meta?: LogMeta) => write('info', message, meta),
  warn: (message: string, meta?: LogMeta) => write('warn', message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
}

export function requestLogger(request: RequestWithId, response: ResponseLike, next: NextFunction) {
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
