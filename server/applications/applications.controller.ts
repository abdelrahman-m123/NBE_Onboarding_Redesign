import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, Req, UploadedFiles, UseInterceptors } from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import multer from 'multer'
import type { RequestWithId } from '../common/types/request-with-id.js'
import { ApplicationsService, type ApplicationUploadInput } from './applications.service.js'
import type { CreateApplicationBody, SaveProfileBody } from './dto.js'
import { EmailOtpService } from './email-otp.service.js'
import { MobileOtpService } from './mobile-otp.service.js'

const uploadRoot = join(process.cwd(), 'server', 'uploads', 'applications')
const selfieDocumentSides = ['selfie_1', 'selfie_2', 'selfie_3', 'selfie_4', 'selfie_5', 'selfie_6'] as const

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'document'
}

const documentUploadOptions = {
  storage: multer.diskStorage({
    destination: (request, _file, callback) => {
      const applicationId = safeFilename(String(request.params.id || 'unknown'))
      const destination = join(uploadRoot, applicationId)
      mkdirSync(destination, { recursive: true })
      callback(null, destination)
    },
    filename: (_request, file, callback) => {
      const extension = extname(file.originalname)
      const baseName = safeFilename(file.originalname.slice(0, extension ? -extension.length : undefined))
      callback(null, `${file.fieldname}-${Date.now()}-${baseName}${extension}`)
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_request: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const isNationalId = file.fieldname === 'nationalIdFrontImage' || file.fieldname === 'nationalIdBackImage'
    const isHrLetter = file.fieldname === 'incomeProofDocument'
    const isFaceSelfie = file.fieldname === 'selfieImages'
    const isImage = file.mimetype.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.originalname)
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)

    if (isNationalId && isImage) {
      callback(null, true)
      return
    }

    if (isHrLetter && (isImage || isPdf)) {
      callback(null, true)
      return
    }

    if (isFaceSelfie && isImage) {
      callback(null, true)
      return
    }

    callback(new Error('Upload National ID images, face captures, and HR letters as supported image or PDF files.'), false)
  },
}

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

  @Post(':id/documents')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'nationalIdFrontImage', maxCount: 1 },
    { name: 'nationalIdBackImage', maxCount: 1 },
    { name: 'selfieImages', maxCount: 6 },
    { name: 'incomeProofDocument', maxCount: 1 },
  ], documentUploadOptions))
  uploadDocuments(
    @Param('id') id: string,
    @UploadedFiles() uploadedFiles: Record<string, Express.Multer.File[]>,
    @Req() request: RequestWithId,
  ) {
    const uploads: ApplicationUploadInput[] = [
      ...(uploadedFiles.nationalIdFrontImage?.[0]
        ? [{ documentType: 'national_id' as const, documentSide: 'front' as const, file: uploadedFiles.nationalIdFrontImage[0] }]
        : []),
      ...(uploadedFiles.nationalIdBackImage?.[0]
        ? [{ documentType: 'national_id' as const, documentSide: 'back' as const, file: uploadedFiles.nationalIdBackImage[0] }]
        : []),
      ...(uploadedFiles.incomeProofDocument?.[0]
        ? [{ documentType: 'employment_hr_letter' as const, file: uploadedFiles.incomeProofDocument[0] }]
        : []),
      ...((uploadedFiles.selfieImages || []).map((file, index) => ({
        documentType: 'face_selfie' as const,
        documentSide: selfieDocumentSides[index],
        file,
      }))),
    ]

    return this.applicationsService.saveDocumentUploads(id, uploads, request.requestId)
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
