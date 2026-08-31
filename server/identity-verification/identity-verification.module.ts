import { Module } from '@nestjs/common'
import { IdentityVerificationController } from './identity-verification.controller.js'
import { IdentityVerificationService } from './identity-verification.service.js'
import { MAILER_SERVICE } from './mailer/mailer.interface.js'
import { NodemailerMailerService } from './mailer/nodemailer-mailer.service.js'
import { OCR_SERVICE } from './ocr/ocr.interface.js'
import { PaddleOcrService } from './ocr/paddle-ocr.service.js'
import { SMS_SERVICE } from './sms/sms.interface.js'
import { TelegramSmsService } from './sms/telegram-sms.service.js'
import { FaceVerificationService } from './face-verification.service.js'

@Module({
  controllers: [IdentityVerificationController],
  providers: [
    IdentityVerificationService,
    FaceVerificationService,
    {
      provide: MAILER_SERVICE,
      useClass: NodemailerMailerService,
    },
    {
      provide: OCR_SERVICE,
      useClass: PaddleOcrService,
    },
    {
      provide: SMS_SERVICE,
      useClass: TelegramSmsService,
    },
  ],
  exports: [MAILER_SERVICE, SMS_SERVICE],
})
export class IdentityVerificationModule {}
