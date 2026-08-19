/**
 * server/middleware.js
 * Intercepts incoming requests and runs the Validation Engine
 */
import { validateNationalId, validateMobileNumber, validateEmailAddress } from './validation.js'

export function validateOnboardingProfile(req, res, next) {
  const { nationalId, mobile, email } = req.body
  const fieldErrors = {}

  if (nationalId) {
    const idCheck = validateNationalId(nationalId)
    if (!idCheck.isValid) fieldErrors.nationalId = idCheck.message
  }

  if (mobile) {
    const mobileCheck = validateMobileNumber(mobile)
    if (!mobileCheck.isValid) fieldErrors.mobile = mobileCheck.message
  }

  if (email) {
    const emailCheck = validateEmailAddress(email)
    if (!emailCheck.isValid) fieldErrors.email = emailCheck.message
  }

  // If any field failed, stop the request right here
  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: fieldErrors
    })
  }

  // Everything is clean; proceed to database query
  next()
}