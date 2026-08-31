import { Injectable } from '@nestjs/common'
import { generateMobileOtp, startTelegramBotListener, verifyMobileOtp } from './sms.js'
import type { MobileOtpVerificationResult, SmsService } from './sms.interface.js'

@Injectable()
export class TelegramSmsService implements SmsService {
  sendOtp(applicationId: string, mobile: string) {
    return generateMobileOtp(applicationId, mobile)
  }

  verifyOtp(applicationId: string, code: string): MobileOtpVerificationResult {
    return verifyMobileOtp(applicationId, code)
  }

  startListener() {
    return startTelegramBotListener()
  }
}
