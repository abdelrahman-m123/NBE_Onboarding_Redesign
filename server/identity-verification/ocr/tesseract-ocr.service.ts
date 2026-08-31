import { Injectable } from '@nestjs/common'
import { recognizeNationalId, recognizeNationalIdImages } from './ocr.js'
import type { OcrService } from './ocr.interface.js'

@Injectable()
export class TesseractOcrService implements OcrService {
  recognizeNationalId(buffer: Buffer) {
    return recognizeNationalId(buffer)
  }

  recognizeNationalIdImages(images: { front?: Buffer; back?: Buffer; guide?: Buffer }) {
    return recognizeNationalIdImages(images)
  }
}
