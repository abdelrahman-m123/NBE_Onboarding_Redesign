import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { IdentityVerificationModule } from '../identity-verification/identity-verification.module.js'
import { ApplicationsController } from './applications.controller.js'
import { ApplicationsService } from './applications.service.js'
import { EmailOtpService } from './email-otp.service.js'
import { MobileOtpService } from './mobile-otp.service.js'

@Module({
  imports: [DatabaseModule, IdentityVerificationModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, EmailOtpService, MobileOtpService],
})
export class ApplicationsModule {}
