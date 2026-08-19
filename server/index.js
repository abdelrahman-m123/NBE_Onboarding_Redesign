import 'dotenv/config.js'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import { pool, query } from './db.js'
import { logger, requestLogger } from './logger.js'
import { recognizeNationalId } from './ocr.js'
import { sendOtpEmail } from './mailer.js'
import { generateMobileOtp, verifyMobileOtp, startTelegramBotListener } from './sms.js'
import { validateOnboardingProfile } from './middleware.js'
import crmRoutes from './crm-routes.js'

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

// --- CRM BACK-OFFICE OPERATIONS ROUTES ---
app.use('/api/crm', crmRoutes)

// --- HEALTH ROUTES ---
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

// --- APPLICATION ROUTES ---
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
  try {
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
  } catch (error) {
    logger.error('application.create_failed', { error })
    response.status(500).json({ message: 'Failed to create application.' })
  }
})

app.put('/api/applications/:id/profile', validateOnboardingProfile, async (request, response) => {
  const { id } = request.params
  const { 
    nationalId, 
    fullName, 
    dateOfBirth, 
    governorate, 
    address, 
    mobile, 
    email,
    employment,
    income,
    method,
    status,
    currentStep 
  } = request.body

  try {
    // 1. Update the parent application
    await query(
      `UPDATE public.applications 
       SET current_step = COALESCE($1, current_step),
           submission_method = COALESCE($2, submission_method),
           status = COALESCE($3, status),
           updated_at = NOW() 
       WHERE id = $4`,
      [currentStep || null, method || null, status || null, id]
    )

    // 2. Update applicant profile details
    const nameParts = fullName ? fullName.trim().split(' ') : []
    const firstName = nameParts[0] || null
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
    const dob = dateOfBirth ? dateOfBirth : null

    await query(
      `INSERT INTO public.applicant_profiles 
        (application_id, national_id_hash, first_name, last_name, date_of_birth, governorate, address_line, mobile_hash, email_hash, employment_status, income_range)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (application_id) DO UPDATE SET 
        national_id_hash = COALESCE(excluded.national_id_hash, public.applicant_profiles.national_id_hash),
        first_name = COALESCE(excluded.first_name, public.applicant_profiles.first_name),
        last_name = COALESCE(excluded.last_name, public.applicant_profiles.last_name),
        date_of_birth = COALESCE(excluded.date_of_birth, public.applicant_profiles.date_of_birth),
        governorate = COALESCE(excluded.governorate, public.applicant_profiles.governorate),
        address_line = COALESCE(excluded.address_line, public.applicant_profiles.address_line),
        mobile_hash = COALESCE(excluded.mobile_hash, public.applicant_profiles.mobile_hash),
        email_hash = COALESCE(excluded.email_hash, public.applicant_profiles.email_hash),
        employment_status = COALESCE(excluded.employment_status, public.applicant_profiles.employment_status),
        income_range = COALESCE(excluded.income_range, public.applicant_profiles.income_range),
        updated_at = NOW()`,
      [
        id, 
        nationalId || null, 
        firstName, 
        lastName, 
        dob, 
        governorate || null, 
        address || null,
        mobile || null,
        email || null,
        employment || null,
        income || null
      ]
    )

    logger.info('application.profile_saved', { requestId: request.requestId, applicationId: id })
    response.json({ message: 'Progress saved successfully.' })
  } catch (error) {
    logger.error('application.profile_save_failed', { requestId: request.requestId, applicationId: id, error })
    response.status(500).json({ message: 'Failed to save application progress.' })
  }
})

app.get('/api/applications/:id/profile', async (request, response) => {
  const { id } = request.params

  try {
    const result = await query(
      `select a.current_step, p.national_id_hash, p.first_name, p.last_name, p.date_of_birth, p.governorate, p.address_line, p.mobile_hash, p.email_hash
       from public.applications a
       left join public.applicant_profiles p on a.id = p.application_id
       where a.id = $1`,
      [id]
    )

    if (!result.rowCount) {
      return response.status(404).json({ message: 'Application not found.' })
    }

    response.json(result.rows[0])
  } catch (error) {
    logger.error('application.profile_fetch_failed', { requestId: request.requestId, applicationId: id, error })
    response.status(500).json({ message: 'Failed to load application progress.' })
  }
})

// --- OTP & EMAIL ROUTES ---
// --- In-Memory Email OTP Store ---
const emailOtpStore = new Map()

// --- OTP & EMAIL ROUTES ---
app.post('/api/applications/:id/send-email-otp', async (request, response) => {
  const { id } = request.params
  const { email } = request.body

  if (!email) {
    return response.status(400).json({ message: 'Email is required.' })
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

  try {
    // Store OTP for verification with a 5-minute expiry
    emailOtpStore.set(id, {
      code: otpCode,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })

    await sendOtpEmail(email, otpCode)
    logger.info(`🚨 PROTOTYPE OTP FOR ${email}: ${otpCode} 🚨`)
    response.json({ message: 'OTP sent successfully!' })
  } catch (error) {
    logger.error('Email failed to send', { error })
    response.status(500).json({ error: 'Failed to send OTP email.' })
  }
})

// --- EMAIL OTP VERIFICATION (The Missing Route) ---
app.post('/api/applications/:id/verify-email-otp', async (request, response) => {
  const { id } = request.params
  const { code } = request.body

  if (!code || String(code).trim().length !== 6) {
    return response.status(400).json({ message: 'Please provide a valid 6-digit code.' })
  }

  const record = emailOtpStore.get(id)

  if (!record) {
    return response.status(400).json({ message: 'No verification code found. Please request a new code.' })
  }

  if (Date.now() > record.expiresAt) {
    emailOtpStore.delete(id)
    return response.status(400).json({ message: 'Verification code has expired. Please request a new code.' })
  }

  if (record.code !== String(code).trim()) {
    return response.status(400).json({ message: 'Incorrect verification code.' })
  }

  // Cleanup after successful verification
  emailOtpStore.delete(id)
  logger.info('application.email_verified', { applicationId: id, email: record.email })
  response.json({ success: true, message: 'Email address verified successfully.' })
})

app.post('/api/applications/:id/send-mobile-otp', async (request, response) => {
  const { id } = request.params
  const { mobile } = request.body

  if (!mobile || !/^01[0125][0-9]{8}$/.test(mobile.trim())) {
    return response.status(400).json({ message: 'Please provide a valid 11-digit Egyptian mobile number.' })
  }

  try {
    await generateMobileOtp(id, mobile.trim())
    response.json({ message: 'Verification SMS sent successfully.' })
  } catch (error) {
    logger.error('sms.dispatch_failed', { id, error })
    response.status(500).json({ message: 'Failed to send SMS OTP.' })
  }
})

// --- MOBILE OTP VERIFICATION ---
app.post('/api/applications/:id/verify-mobile-otp', async (request, response) => {
  const { id } = request.params
  const { code } = request.body

  if (!code || String(code).trim().length !== 6) {
    return response.status(400).json({ message: 'Please provide a valid 6-digit code.' })
  }

  const result = verifyMobileOtp(id, code)

  if (!result.success) {
    return response.status(400).json({ message: result.message })
  }

  logger.info('application.mobile_verified', { applicationId: id, mobile: result.mobile })
  response.json({ success: true, message: 'Mobile number verified successfully.' })
})


// --- OCR ROUTE ---
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

// --- ERROR HANDLING & SERVER INIT ---
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
  startTelegramBotListener()
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

process.on('SIGINT', () => { shutdown('SIGINT') })
process.on('SIGTERM', () => { shutdown('SIGTERM') })
process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', { error })
  process.exit(1)
})
process.on('unhandledRejection', (error) => {
  logger.error('process.unhandled_rejection', { error })
  process.exit(1)
})