import { performance } from 'node:perf_hooks'
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { logger } from '../common/logger.js'
import { OCR_SERVICE, type OcrService } from './ocr/ocr.interface.js'

@Injectable()
export class IdentityVerificationService {
  constructor(@Inject(OCR_SERVICE) private readonly ocrService: OcrService) {}

  async readNationalId(file: Express.Multer.File, requestId?: string) {
    const startedAt = performance.now()
    logger.info('ocr.started', {
      requestId,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
    })

    try {
      const result = await this.ocrService.recognizeNationalId(file.buffer)
      logger.info('ocr.finished', {
        requestId,
        status: result.status,
        confidence: result.confidence,
        method: result.method || 'tesseract',
        extracted: Boolean(result.extracted),
        durationMs: Math.round(performance.now() - startedAt),
      })
      return result
    } catch (error) {
      logger.error('ocr.failed', {
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        error,
      })
      throw new HttpException({
        message: 'We could not read the ID image. Try another photo or enter the number manually.',
      }, HttpStatus.UNPROCESSABLE_ENTITY)
    }
  }

  async readNationalIdImages(
    files: { front?: Express.Multer.File; back?: Express.Multer.File; guide?: Express.Multer.File },
    requestId?: string,
  ) {
    const startedAt = performance.now()
    logger.info('ocr.multi_started', {
      requestId,
      hasFront: Boolean(files.front),
      hasBack: Boolean(files.back),
      hasGuide: Boolean(files.guide),
    })

    try {
      const result = await this.ocrService.recognizeNationalIdImages({
        front: files.front?.buffer,
        back: files.back?.buffer,
        guide: files.guide?.buffer,
      })
      logger.info('ocr.multi_finished', {
        requestId,
        status: result.status,
        confidence: result.confidence,
        durationMs: Math.round(performance.now() - startedAt),
      })
      return result
    } catch (error) {
      logger.error('ocr.multi_failed', {
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        error,
      })
      throw new HttpException({
        message: 'We could not read the ID images. Try clearer front and back photos or enter the data manually.',
      }, HttpStatus.UNPROCESSABLE_ENTITY)
    }
  }
}
