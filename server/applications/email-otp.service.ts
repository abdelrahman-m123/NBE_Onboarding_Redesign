import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { logger } from '../common/logger.js'
import { MAILER_SERVICE, type MailerService } from '../identity-verification/mailer/mailer.interface.js'

interface EmailOtpRecord {
  code: string
  email: string
  expiresAt: number
}

@Injectable()
export class EmailOtpService {
  private readonly store = new Map<string, EmailOtpRecord>()

  constructor(@Inject(MAILER_SERVICE) private readonly mailerService: MailerService) {}

  async send(applicationId: string, email?: string) {
    if (!email) {
      throw new HttpException({ message: 'Email is required.' }, HttpStatus.BAD_REQUEST)
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    try {
      this.store.set(applicationId, {
        code: otpCode,
        email,
        expiresAt: Date.now() + 5 * 60 * 1000,
      })

      await this.mailerService.sendOtpEmail(email, otpCode)
      logger.info(`PROTOTYPE OTP FOR ${email}: ${otpCode}`)
      return { message: 'OTP sent successfully!' }
    } catch (error) {
      logger.error('Email failed to send', { error })
      throw new HttpException({ error: 'Failed to send OTP email.' }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  verify(applicationId: string, code?: string) {
    if (!code || String(code).trim().length !== 6) {
      throw new HttpException({ message: 'Please provide a valid 6-digit code.' }, HttpStatus.BAD_REQUEST)
    }

    const record = this.store.get(applicationId)

    if (!record) {
      throw new HttpException({ message: 'No verification code found. Please request a new code.' }, HttpStatus.BAD_REQUEST)
    }

    if (Date.now() > record.expiresAt) {
      this.store.delete(applicationId)
      throw new HttpException({ message: 'Verification code has expired. Please request a new code.' }, HttpStatus.BAD_REQUEST)
    }

    if (record.code !== String(code).trim()) {
      throw new HttpException({ message: 'Incorrect verification code.' }, HttpStatus.BAD_REQUEST)
    }

    this.store.delete(applicationId)
    logger.info('application.email_verified', { applicationId, email: record.email })
    return { success: true, message: 'Email address verified successfully.' }
  }
}
