import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import { pool, query } from './db.js'
import { logger, requestLogger } from './logger.js'
import { recognizeNationalId } from './ocr.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const hasImageMime = file.mimetype.startsWith('image/')
    const hasImageExtension = /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.originalname)

    if (!hasImageMime && !hasImageExtension) {
      callback(new Error('Only image files can be scanned.'))
      return
    }
    callback(null, true)
  },
})

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))
app.use(requestLogger)

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'nbe-onboarding-api' })
})

app.get('/api/db/health', async (_request, response) => {
  try {
    const result = await query('select current_database() as database, current_schema() as schema, now() as checked_at')
    response.json({ ok: true, ...result.rows[0] })
  } catch (error) {
    logger.error('database.health.failed', { error })
    response.status(503).json({ ok: false, message: 'Database connection is unavailable.' })
  }
})

app.get('/api/applications/:referenceNumber', async (request, response) => {
  const { referenceNumber } = request.params
  const result = await query(
    `select reference_number, status, current_step, submission_method, submitted_at, created_at, updated_at
     from public.applications
     where reference_number = $1`,
    [referenceNumber],
  )

  if (!result.rowCount) {
    logger.warn('application.not_found', { requestId: request.requestId })
    response.status(404).json({ message: 'Application was not found.' })
    return
  }

  logger.info('application.loaded', {
    requestId: request.requestId,
    status: result.rows[0].status,
    currentStep: result.rows[0].current_step,
  })
  response.json(result.rows[0])
})

app.post('/api/applications', async (request, response) => {
  const { currentStep = 'prepare', language = 'en' } = request.body || {}
  const result = await query(
    `insert into public.applications (current_step, language)
     values ($1, $2)
     returning id, reference_number, status, current_step, language, created_at`,
    [currentStep, language],
  )

  logger.info('application.created', {
    requestId: request.requestId,
    applicationId: result.rows[0].id,
    currentStep: result.rows[0].current_step,
    language: result.rows[0].language,
  })
  response.status(201).json(result.rows[0])
})

app.post('/api/identity/ocr', upload.single('nationalIdImage'), async (request, response) => {
  if (!request.file) {
    logger.warn('ocr.missing_file', { requestId: request.requestId })
    response.status(400).json({ message: 'Upload a clear image of the National ID.' })
    return
  }

  const startedAt = performance.now()
  logger.info('ocr.started', {
    requestId: request.requestId,
    fileSizeBytes: request.file.size,
    mimeType: request.file.mimetype,
  })

  try {
    const result = await recognizeNationalId(request.file.buffer)
    logger.info('ocr.finished', {
      requestId: request.requestId,
      status: result.status,
      confidence: result.confidence,
      method: result.method || 'tesseract',
      extracted: Boolean(result.extracted),
      durationMs: Math.round(performance.now() - startedAt),
    })
    response.json(result)
  } catch (error) {
    logger.error('ocr.failed', {
      requestId: request.requestId,
      durationMs: Math.round(performance.now() - startedAt),
      error,
    })
    response.status(422).json({
      message: 'We could not read the ID image. Try another photo or enter the number manually.',
    })
  }
})

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError || error.message === 'Only image files can be scanned.') {
    logger.warn('request.validation_failed', { error })
    response.status(400).json({ message: error.message })
    return
  }

  logger.error('request.unhandled_error', { error })
  response.status(500).json({ message: 'Something went wrong. Your progress is still safe.' })
})

const server = app.listen(port, () => {
  server.ref()
  logger.info('server.started', { port, url: `http://localhost:${port}` })
})

server.on('close', () => {
  logger.info('server.closed')
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error('server.port_in_use', {
      port,
      message: `Port ${port} is already in use. Stop the existing server or run npm run port:4000 to find it.`,
    })
    process.exit(1)
  }

  logger.error('server.error', { error })
})

async function shutdown(signal) {
  logger.info('server.shutdown_started', { signal })

  server.close(async () => {
    await pool.end()
    logger.info('server.shutdown_finished', { signal })
    process.exit(0)
  })
}

process.on('SIGINT', () => {
  shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', { error })
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  logger.error('process.unhandled_rejection', { error })
  process.exit(1)
})
