import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, Req } from '@nestjs/common'
import type { RequestWithId } from '../common/types/request-with-id.js'
import { ApplicationsService } from './applications.service.js'
import type { CreateApplicationBody, SaveProfileBody } from './dto.js'
import { EmailOtpService } from './email-otp.service.js'
import { MobileOtpService } from './mobile-otp.service.js'

function validationFailed(errors: Record<string, string>) {
  return new HttpException({
    success: false,
    message: 'Validation failed',
    errors,
  }, HttpStatus.BAD_REQUEST)
}

@Controller('api/applications')
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly emailOtpService: EmailOtpService,
    private readonly mobileOtpService: MobileOtpService,
  ) {}

  @Get(':referenceNumber')
  getApplication(@Param('referenceNumber') referenceNumber: string, @Req() request: RequestWithId) {
    return this.applicationsService.getApplication(referenceNumber, request.requestId)
  }

  @Post()
  createApplication(@Body() body: CreateApplicationBody = {}, @Req() request: RequestWithId) {
    return this.applicationsService.createApplication(body, request.requestId)
  }

  @Put(':id/profile')
  async saveProfile(@Param('id') id: string, @Body() body: SaveProfileBody = {}, @Req() request: RequestWithId) {
    const fieldErrors = this.applicationsService.validateProfile(body)
    if (Object.keys(fieldErrors).length > 0) throw validationFailed(fieldErrors)
    return this.applicationsService.saveProfile(id, body, request.requestId)
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string, @Req() request: RequestWithId) {
    return this.applicationsService.getProfile(id, request.requestId)
  }

  @Post(':id/send-email-otp')
  sendEmailOtp(@Param('id') id: string, @Body() body: { email?: string } = {}) {
    return this.emailOtpService.send(id, body.email)
  }

  @Post(':id/verify-email-otp')
  verifyEmailOtp(@Param('id') id: string, @Body() body: { code?: string } = {}) {
    return this.emailOtpService.verify(id, body.code)
  }

  @Post(':id/send-mobile-otp')
  sendMobileOtp(@Param('id') id: string, @Body() body: { mobile?: string } = {}) {
    return this.mobileOtpService.send(id, body.mobile)
  }

  @Post(':id/verify-mobile-otp')
  verifyMobileOtp(@Param('id') id: string, @Body() body: { code?: string } = {}) {
    return this.mobileOtpService.verify(id, body.code)
  }
}
