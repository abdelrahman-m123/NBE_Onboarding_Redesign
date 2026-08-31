/**
 * Profile validation helpers
 */
import { validateNationalId, validateMobileNumber, validateEmailAddress } from './validation.js'

type NextFunction = () => void

interface RequestLike {
  body: ProfileValidationBody
}

interface ResponseLike {
  status(code: number): {
    json(payload: unknown): unknown
  }
}

interface ProfileValidationBody {
  nationalId?: string
  mobile?: string
  email?: string
}

export function getOnboardingProfileValidationErrors(body: ProfileValidationBody = {}) {
  const { nationalId, mobile, email } = body
  const fieldErrors: Record<string, string> = {}

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

  return fieldErrors
}

export function validateOnboardingProfile(req: RequestLike, res: ResponseLike, next: NextFunction) {
  const fieldErrors = getOnboardingProfileValidationErrors(req.body)

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
