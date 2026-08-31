export const SMS_SERVICE = Symbol('SMS_SERVICE')

export interface MobileOtpVerificationResult {
  success: boolean
  message?: string
  mobile?: string
}

export interface SmsService {
  sendOtp(applicationId: string, mobile: string): Promise<string>
  verifyOtp(applicationId: string, code: string): MobileOtpVerificationResult
  startListener(): Promise<void> | void
}
