import { Controller, HttpException, HttpStatus, Post, Query, Req, UploadedFile, UploadedFiles, UseInterceptors, Get, Body } from '@nestjs/common'
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express'
import multer from 'multer'
import { logger } from '../common/logger.js'
import type { RequestWithId } from '../common/types/request-with-id.js'
import { FaceVerificationService } from './face-verification.service.js'
import { IdentityVerificationService } from './identity-verification.service.js'
import { PaddleOcrService } from './ocr/paddle-ocr.service.js'

const uploadOptions = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
  fileFilter: (_request: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const hasImageMime = file.mimetype.startsWith('image/')
    const hasImageExtension = /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.originalname)

    if (!hasImageMime && !hasImageExtension) {
      callback(new Error('Only image files can be scanned.'), false)
      return
    }
    callback(null, true)
  },
}

@Controller('api/identity')
export class IdentityVerificationController {
  constructor(
    private readonly identityVerificationService: IdentityVerificationService,
    private readonly faceVerificationService: FaceVerificationService,
    private readonly paddleOcrService: PaddleOcrService,
  ) {}

  @Post('ocr')
  @UseInterceptors(FileInterceptor('nationalIdImage', uploadOptions))
  async readNationalId(@UploadedFile() file: Express.Multer.File | undefined, @Req() request: RequestWithId) {
    if (!file) {
      logger.warn('ocr.missing_file', { requestId: request.requestId })
      throw new HttpException({ message: 'Upload a clear image of the National ID.' }, HttpStatus.BAD_REQUEST)
    }

    return this.identityVerificationService.readNationalId(file, request.requestId)
  }

  @Post('ocr/full')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
  ], uploadOptions))
  async readFullNationalId(
    @UploadedFiles() uploadedFiles: Record<string, Express.Multer.File[]>,
    @Req() request: RequestWithId,
    @Query('device') device?: 'cpu' | 'gpu' | 'both' | 'auto',
  ) {
    const files = {
      front: uploadedFiles.frontImage?.[0],
      back: uploadedFiles.backImage?.[0],
    }

    if (!files.front && !files.back) {
      logger.warn('ocr.multi_missing_file', { requestId: request.requestId })
      throw new HttpException({ message: 'Upload at least the front or back image of the National ID.' }, HttpStatus.BAD_REQUEST)
    }

    const targetDevice = device || 'auto'
    return this.identityVerificationService.readNationalIdImages(files, request.requestId, targetDevice)
  }

  @Post('face/liveness-session')
  async createFaceLivenessSession(@Req() request: RequestWithId) {
    return this.faceVerificationService.createLivenessSession(request.requestId)
  }

  @Post('face/verify')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'nationalIdFrontImage', maxCount: 1 },
    { name: 'selfieImages', maxCount: 6 },
  ], uploadOptions))
  async verifyFace(
    @UploadedFiles() uploadedFiles: Record<string, Express.Multer.File[]>,
    @Body() body: { livenessSessionId?: string },
    @Req() request: RequestWithId,
  ) {
    return this.faceVerificationService.verifyFace({
      nationalIdFrontImage: uploadedFiles.nationalIdFrontImage?.[0],
      selfieImages: uploadedFiles.selfieImages || [],
      livenessSessionId: body.livenessSessionId,
    }, request.requestId)
  }

  @Post('ocr/dual-pool')
  async toggleDualPool(@Body() body: { enabled: boolean }) {
    if (body.enabled) {
      this.paddleOcrService.enableDualPool()
    } else {
      this.paddleOcrService.disableDualPool()
    }
    return { enabled: body.enabled }
  }

  @Get('ocr/dual-pool')
  getDualPoolStatus() {
    return { enabled: this.paddleOcrService['dualPoolEnabled'] }
  }
}
