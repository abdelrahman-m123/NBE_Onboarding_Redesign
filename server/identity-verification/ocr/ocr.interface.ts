export const OCR_SERVICE = Symbol('OCR_SERVICE')

export interface OcrService {
  recognizeNationalId(buffer: Buffer): Promise<{
    status: string
    confidence: number
    extracted: unknown
    method?: string
  }>
  recognizeNationalIdImages(images: {
    front?: Buffer
    back?: Buffer
    guide?: Buffer
  }): Promise<{
    status: string
    confidence: number
    extracted: unknown
    method?: string
    sides?: unknown
  }>
}
