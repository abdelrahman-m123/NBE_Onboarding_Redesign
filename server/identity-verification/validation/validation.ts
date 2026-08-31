/**
 * server/identity-verification/validation/validation.ts
 * Centralized Validation Engine for Egyptian Banking Rules
 */

// Governorate mapping according to Egypt   ian Civil Registry codes
const GOVERNORATE_CODES = {
  '01': 'Cairo',
  '02': 'Alexandria',
  '03': 'Port Said',
  '04': 'Suez',
  '11': 'Damietta',
  '12': 'Dakahlia',
  '13': 'Sharqia',
  '14': 'Qalyubia',
  '15': 'Kafr El Sheikh',
  '16': 'Gharbia',
  '17': 'Monufia',
  '18': 'Beheira',
  '19': 'Ismailia',
  '21': 'Giza',
  '22': 'Beni Suef',
  '23': 'Faiyum',
  '24': 'Minya',
  '25': 'Asyut',
  '26': 'Sohag',
  '27': 'Qena',
  '28': 'Aswan',
  '29': 'Luxor',
  '31': 'Red Sea',
  '32': 'New Valley',
  '33': 'Matrouh',
  '34': 'North Sinai',
  '35': 'South Sinai',
  '88': 'Born outside Egypt'
}

export function validateNationalId(nationalId) {
  if (!nationalId || typeof nationalId !== 'string') {
    return { isValid: false, message: 'National ID is required.' }
  }

  const cleanId = nationalId.trim()

  // 1. Length check: Exactly 14 numeric digits
  if (!/^\d{14}$/.test(cleanId)) {
    return { isValid: false, message: 'National ID must be exactly 14 digits.' }
  }

  // 2. Century validation
  const centuryDigit = parseInt(cleanId[0], 10)
  if (centuryDigit !== 2 && centuryDigit !== 3) {
    return { isValid: false, message: 'Invalid National ID: Century prefix must be 2 or 3.' }
  }

  // 3. Extract & Validate Date of Birth
  const yearPrefix = centuryDigit === 2 ? 1900 : 2000
  const birthYear = yearPrefix + parseInt(cleanId.substring(1, 3), 10)
  const birthMonth = parseInt(cleanId.substring(3, 5), 10)
  const birthDay = parseInt(cleanId.substring(5, 7), 10)

  const parsedDate = new Date(birthYear, birthMonth - 1, birthDay)

  if (
    parsedDate.getFullYear() !== birthYear ||
    parsedDate.getMonth() !== birthMonth - 1 ||
    parsedDate.getDate() !== birthDay
  ) {
    return { isValid: false, message: 'National ID contains an invalid date of birth.' }
  }

  // 4. Age Restriction (Banking compliance: >= 21 years)
  const today = new Date()
  let age = today.getFullYear() - birthYear
  const monthDiff = today.getMonth() - (birthMonth - 1)
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
    age--
  }

  if (age < 21) {
    return { isValid: false, message: 'Applicant must be at least 21 years old to open an individual retail account.' }
  }

  // 5. Governorate verification
  const govCode = cleanId.substring(7, 9)
  const governorateName = GOVERNORATE_CODES[govCode] || 'Other'

  return {
    isValid: true,
    data: {
      dateOfBirth: parsedDate.toISOString().split('T')[0],
      governorate: governorateName,
      age
    }
  }
}

export function validateMobileNumber(mobile) {
  if (!mobile) return { isValid: false, message: 'Mobile number is required.' }
  
  // Must be Egyptian operator prefix: 010, 011, 012, 015 followed by 8 digits
  const regex = /^01[0125]\d{8}$/
  if (!regex.test(mobile.trim())) {
    return { isValid: false, message: 'Mobile number must be a valid 11-digit Egyptian number (010, 011, 012, or 015).' }
  }
  return { isValid: true }
}

export function validateEmailAddress(email) {
  if (!email) return { isValid: false, message: 'Email address is required.' }
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(email.trim())) {
    return { isValid: false, message: 'Please provide a valid email address.' }
  }
  return { isValid: true }
}
