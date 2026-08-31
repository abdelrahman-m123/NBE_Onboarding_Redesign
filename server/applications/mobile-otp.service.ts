import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { logger } from '../common/logger.js'
import { SMS_SERVICE, type SmsService } from '../identity-verification/sms/sms.interface.js'

@Injectable()
export class MobileOtpService {
  constructor(@Inject(SMS_SERVICE) private readonly smsService: SmsService) {}

  async send(applicationId: string, mobile?: string) {
    if (!mobile || !/^01[0125][0-9]{8}$/.test(mobile.trim())) {
      throw new HttpException({ message: 'Please provide a valid 11-digit Egyptian mobile number.' }, HttpStatus.BAD_REQUEST)
    }

    try {
      await this.smsService.sendOtp(applicationId, mobile.trim())
      return { message: 'Verification SMS sent successfully.' }
    } catch (error) {
      logger.error('sms.dispatch_failed', { id: applicationId, error })
      throw new HttpException({ message: 'Failed to send SMS OTP.' }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  verify(applicationId: string, code?: string) {
    if (!code || String(code).trim().length !== 6) {
      throw new HttpException({ message: 'Please provide a valid 6-digit code.' }, HttpStatus.BAD_REQUEST)
    }

    const result = this.smsService.verifyOtp(applicationId, code)

    if (!result.success) {
      throw new HttpException({ message: result.message }, HttpStatus.BAD_REQUEST)
    }

    logger.info('application.mobile_verified', { applicationId, mobile: result.mobile })
    return { success: true, message: 'Mobile number verified successfully.' }
  }
}
