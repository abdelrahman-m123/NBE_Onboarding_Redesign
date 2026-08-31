export const MAILER_SERVICE = Symbol('MAILER_SERVICE')

export interface MailerService {
  sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean>
}
