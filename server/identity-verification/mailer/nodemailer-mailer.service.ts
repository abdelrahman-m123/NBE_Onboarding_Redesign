import { Injectable } from '@nestjs/common'
import { sendOtpEmail } from './mailer.js'
import type { MailerService } from './mailer.interface.js'

@Injectable()
export class NodemailerMailerService implements MailerService {
  sendOtpEmail(toEmail: string, otpCode: string) {
    return sendOtpEmail(toEmail, otpCode)
  }
}
