import crypto from 'crypto'
import { logger } from './logger.js'

// In-memory key-value store for active OTPs: Map<applicationId, { code, mobile, expiresAt } >
const otpStore = new Map()

const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Generates a 6-digit numeric OTP and stores it against an application ID
 */
export function generateMobileOtp(applicationId, mobile) {
  // Generate a cryptographically random 6-digit integer
  const otpCode = crypto.randomInt(100000, 999999).toString()

  otpStore.set(String(applicationId), {
    code: otpCode,
    mobile,
    expiresAt: Date.now() + OTP_TTL_MS,
  })

  // Simulated SMS Provider Dispatch
  logger.info(`📱 ========================================================`)
  logger.info(`📱 [SMS GATEWAY DISPATCH]`)
  logger.info(`📱 To: ${mobile}`)
  logger.info(`📱 Message: "National Bank of Egypt: Your verification code is ${otpCode}. Valid for 5 minutes."`)
  logger.info(`📱 ========================================================`)

  return otpCode
}

/**
 * Validates the OTP submitted by the user
 */
export function verifyMobileOtp(applicationId, inputCode) {
  const key = String(applicationId)
  const entry = otpStore.get(key)

  if (!entry) {
    return { success: false, reason: 'NO_OTP_FOUND', message: 'No active OTP found. Please request a new code.' }
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key)
    return { success: false, reason: 'EXPIRED', message: 'The verification code has expired. Please request a new one.' }
  }

  if (entry.code !== String(inputCode).trim()) {
    return { success: false, reason: 'INVALID', message: 'Invalid verification code. Please check and try again.' }
  }

  // OTP verified successfully: clear single-use token
  otpStore.delete(key)
  return { success: true, mobile: entry.mobile }
}