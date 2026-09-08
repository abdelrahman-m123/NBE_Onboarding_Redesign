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
  }, device?: 'cpu' | 'gpu' | 'both' | 'auto'): Promise<{
    status: string
    confidence: number
    extracted: unknown
    method?: string
    sides?: unknown
    device?: string
    mode?: string
    cpuResult?: any
    gpuResult?: any
    durationMs?: number
    cpu?: any
    gpu?: any
  }>
}
