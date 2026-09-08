import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import sharp from 'sharp'
import { logger } from '../../common/logger.js'
import type { OcrService } from './ocr.interface.js'
import { extractNationalIdFieldsFromText, testOnly } from './ocr.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const compiledWorkerPath = path.join(currentDir, 'paddle_ocr_worker.py')
const sourceWorkerPath = path.join(process.cwd(), 'server', 'identity-verification', 'ocr', 'paddle_ocr_worker.py')
const defaultPaddleCacheDir = path.join(process.cwd(), '.paddle-cache')
const defaultPaddleMaxDimension = 960
let paddleRequestId = 0

interface PaddleLine {
  text: string
  confidence?: number
  box?: unknown
}

interface PositionedLine extends PaddleLine {
  bounds: { left: number; top: number; right: number; bottom: number }
}

interface PendingPaddleRequest {
  imageData: string // base64-encoded PNG sent via stdin — no temp file I/O
  resolve: (value: { lines: PaddleLine[] }) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
  enqueuedAt: number
  worker?: PaddleWorker
}

interface PaddleWorker {
  id: number
  process: ChildProcessWithoutNullStreams
  stdout: readline.Interface
  ready: Promise<void>
  busy: boolean
  currentRequestId?: string
  device: 'cpu' | 'gpu' | 'auto'
}

const arabicDigitMap = '٠١٢٣٤٥٦٧٨٩'
const persianDigitMap = '۰۱۲۳۴۵۶۷۸۹'

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(arabicDigitMap.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigitMap.indexOf(digit)))
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function containsArabic(value: string) {
  return /[\u0600-\u06ff]/.test(value)
}

@Injectable()
export class PaddleOcrService implements OcrService, OnModuleDestroy, OnModuleInit {
  private workers: PaddleWorker[] = []
  private workersReady: Promise<void> | null = null
  private workerPoolStarting: Promise<void> | null = null
  private pendingRequests = new Map<string, PendingPaddleRequest>()
  private queuedRequestIds: string[] = []
  private workerPath: string | null = null
  private workerEnvPaths: { paddleHome: string; paddlexCacheHome: string; xdgCacheHome: string } | null = null
  private stoppingWorkerPool = false
  
  // Dual pool support
  private cpuWorkers: PaddleWorker[] = []
  private gpuWorkers: PaddleWorker[] = []
  private cpuWorkersReady: Promise<void> | null = null
  private gpuWorkersReady: Promise<void> | null = null
  private cpuWorkerPoolStarting: Promise<void> | null = null
  private gpuWorkerPoolStarting: Promise<void> | null = null
  private cpuPendingRequests = new Map<string, PendingPaddleRequest>()
  private gpuPendingRequests = new Map<string, PendingPaddleRequest>()
  private cpuQueuedRequestIds: string[] = []
  private gpuQueuedRequestIds: string[] = []
  private dualPoolEnabled = false

  onModuleInit() {
    if (process.env.PADDLE_OCR_PREWARM === '0') return

    // Check if dual pool mode is enabled
    this.dualPoolEnabled = process.env.PADDLE_OCR_DUAL_POOL === 'true'
    
    if (this.dualPoolEnabled) {
      // Prewarm both CPU and GPU pools
      void Promise.all([
        this.ensureCpuWorkerPool().catch((error) => {
          logger.error('paddleocr.cpu_worker_pool.prewarm_failed', { error })
        }),
        this.ensureGpuWorkerPool().catch((error) => {
          logger.error('paddleocr.gpu_worker_pool.prewarm_failed', { error })
        }),
      ])
    } else {
      void this.ensureWorkerPool().catch((error) => {
        logger.error('paddleocr.worker_pool.prewarm_failed', { error })
      })
    }
  }

  enableDualPool() {
    this.dualPoolEnabled = true
  }

  disableDualPool() {
    this.dualPoolEnabled = false
  }

  onModuleDestroy() {
    this.stopWorkerPool()
    this.stopCpuWorkerPool()
    this.stopGpuWorkerPool()
  }

  async recognizeNationalId(buffer: Buffer) {
    return this.recognizeSide(buffer, 'unknown')
  }

  async recognizeNationalIdImages(images: { front?: Buffer; back?: Buffer }, device: 'cpu' | 'gpu' | 'both' | 'auto' = 'auto') {
    if (device === 'both') {
      // Run both CPU and GPU in parallel
      const [cpuResult, gpuResult] = await Promise.allSettled([
        this.recognizeSidesWithDevice(images, 'cpu'),
        this.recognizeSidesWithDevice(images, 'gpu'),
      ])
      
      const cpuData = cpuResult.status === 'fulfilled' ? cpuResult.value : null
      const gpuData = gpuResult.status === 'fulfilled' ? gpuResult.value : null
      
      // For dual mode, we return a special structure that includes both results
      // but also has fallback fields for compatibility
      return {
        mode: 'dual',
        cpuResult: cpuData,
        gpuResult: gpuData,
        // Fallback to GPU result if available, otherwise CPU
        status: (gpuData?.status || cpuData?.status || 'partial'),
        confidence: (gpuData?.confidence ?? cpuData?.confidence ?? 0),
        extracted: (gpuData?.extracted ?? cpuData?.extracted ?? null),
        method: 'paddleocr-arabic',
        sides: gpuData?.sides ?? cpuData?.sides ?? undefined,
        device: 'both',
      }
    }
    
    // Single device run
    const targetDevice = device === 'auto' ? ((process.env.PADDLE_OCR_DEVICE as 'cpu' | 'gpu' | 'auto') || 'auto') : device
    const result = await this.recognizeSidesWithDevice(images, targetDevice)
    return result
  }

  private async recognizeSidesWithDevice(images: { front?: Buffer; back?: Buffer }, device: 'cpu' | 'gpu' | 'auto') {
    const [front, back] = await Promise.all([
      images.front ? this.recognizeSideWithDevice(images.front, 'front', device) : null,
      images.back ? this.recognizeSideWithDevice(images.back, 'back', device) : null,
    ])

    const extracted = this.mergeExtractedFields([front?.extracted, back?.extracted])
    const reconciledNationalId = this.reconcileNationalId(front?.extracted?.nationalId, back?.extracted?.nationalId)
    if (reconciledNationalId) {
      Object.assign(extracted, testOnly.parseNationalId(reconciledNationalId))
      extracted.placeOfBirth = extracted.governorate
      extracted.gender = Number(reconciledNationalId[12]) % 2 === 0 ? 'Female' : 'Male'
    }
    const confidenceValues = [front, back].filter(Boolean).map((item) => item.confidence || 0)
    const confidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, item) => sum + item, 0) / confidenceValues.length)
      : 0

    return {
      status: extracted.nationalId ? 'completed' : 'partial',
      confidence,
      extracted: Object.keys(extracted).length ? extracted : null,
      method: 'paddleocr-arabic',
      sides: { front, back },
      device: device === 'auto' ? (process.env.PADDLE_OCR_DEVICE || 'auto') : device,
    }
  }

  private async recognizeSide(buffer: Buffer, side: string) {
    return this.recognizeSideWithDevice(buffer, side, (process.env.PADDLE_OCR_DEVICE as 'cpu' | 'gpu' | 'auto') || 'auto')
  }

  private async recognizeSideWithDevice(buffer: Buffer, side: string, device: 'cpu' | 'gpu' | 'auto') {
    const normalized = await sharp(buffer, { failOn: 'none' }).rotate().png().toBuffer()
    const paddleInput = await this.preparePaddleInput(normalized, side)
    const paddleResult = await this.runPaddleWithDevice(paddleInput, device)
    const lines = this.mergeOcrLines(paddleResult.lines)
    const text = lines.map((line) => line.text).join('\n')
    const rawTextExtracted = extractNationalIdFieldsFromText(text)
    const textExtracted = side === 'front' || side === 'unknown'
      ? rawTextExtracted
      : Object.fromEntries(Object.entries(rawTextExtracted).filter(([key]) => !['name', 'address'].includes(key)))
    const sideDetails = this.extractSideDetails(lines, side)
    const extracted = this.mergeExtractedFields([sideDetails, textExtracted])
    if (extracted.nationalId) {
      extracted.placeOfBirth = extracted.governorate
      extracted.gender ||= Number(String(extracted.nationalId)[12]) % 2 === 0 ? 'Female' : 'Male'
    }
    const confidence = Math.round(this.averageConfidence(paddleResult.lines))

    return {
      status: extracted.nationalId ? 'completed' : 'partial',
      confidence,
      extracted: Object.keys(extracted).length ? extracted : null,
      method: 'paddleocr-arabic',
      lines: this.summarizeLines(lines),
    }
  }

  private async preparePaddleInput(buffer: Buffer, side: string) {
    const maxDimension = Math.max(640, Number(process.env.PADDLE_OCR_MAX_DIMENSION || defaultPaddleMaxDimension))
    const trimThreshold = Number(process.env.PADDLE_OCR_TRIM_THRESHOLD || 18)

    if (side !== 'back') {
      // Front / unknown: single Sharp pipeline — trim, resize, and enhance in one encode/decode pass
      return sharp(buffer, { failOn: 'none' })
        .trim({ background: '#ffffff', threshold: trimThreshold })
        .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer()
    }

    // Back: 2 passes — trim to get post-trim dimensions (needed for band crop), then crop + enhance.
    // toBuffer({ resolveWithObject: true }) avoids a separate metadata() round-trip.
    const { data: trimmed, info } = await sharp(buffer, { failOn: 'none' })
      .trim({ background: '#ffffff', threshold: trimThreshold })
      .png()
      .toBuffer({ resolveWithObject: true })

    const bandRatio = Number(process.env.PADDLE_OCR_BACK_TEXT_BAND_RATIO || 0.62)
    const bandHeight = Math.max(1, Math.floor(info.height * bandRatio))

    return sharp(trimmed, { failOn: 'none' })
      .extract({ left: 0, top: 0, width: info.width, height: Math.min(bandHeight, info.height) })
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer()
  }

  private async runPaddle(buffer: Buffer): Promise<{ lines: PaddleLine[] }> {
    return this.runPaddleWithDevice(buffer, (process.env.PADDLE_OCR_DEVICE as 'cpu' | 'gpu' | 'auto') || 'auto')
  }

  private async runPaddleWithDevice(buffer: Buffer, device: 'cpu' | 'gpu' | 'auto'): Promise<{ lines: PaddleLine[] }> {
    // Image is base64-encoded and piped directly to the Python worker via stdin.
    // No temp directory, writeFile, or rm — eliminates all temp-file I/O overhead.
    const startedAt = performance.now()
    try {
      return await this.requestPaddleWorkerWithDevice(buffer, device)
    } catch (error) {
      logger.error('paddleocr.failed', { device, error })
      throw error
    } finally {
      logger.info('paddleocr.run_finished', {
        device,
        durationMs: Math.round(performance.now() - startedAt),
        inputBytes: buffer.length,
      })
    }
  }

  private async requestPaddleWorker(buffer: Buffer): Promise<{ lines: PaddleLine[] }> {
    return this.requestPaddleWorkerWithDevice(buffer, (process.env.PADDLE_OCR_DEVICE as 'cpu' | 'gpu' | 'auto') || 'auto')
  }

  private async requestPaddleWorkerWithDevice(buffer: Buffer, device: 'cpu' | 'gpu' | 'auto'): Promise<{ lines: PaddleLine[] }> {
    if (device === 'auto') {
      return this.requestFromPool(buffer, this.workers, this.workersReady, this.pendingRequests, this.queuedRequestIds, this.workerPoolStarting, this.ensureWorkerPool.bind(this), this.dispatchQueuedRequests.bind(this))
    }
    
    // Use specific device pool
    if (device === 'cpu') {
      return this.requestFromPool(buffer, this.cpuWorkers, this.cpuWorkersReady, this.cpuPendingRequests, this.cpuQueuedRequestIds, this.cpuWorkerPoolStarting, this.ensureCpuWorkerPool.bind(this), this.dispatchCpuQueuedRequests.bind(this))
    }
    
    if (device === 'gpu') {
      return this.requestFromPool(buffer, this.gpuWorkers, this.gpuWorkersReady, this.gpuPendingRequests, this.gpuQueuedRequestIds, this.gpuWorkerPoolStarting, this.ensureGpuWorkerPool.bind(this), this.dispatchGpuQueuedRequests.bind(this))
    }
    
    // Fallback to default (should not reach here with proper typing)
    return this.requestFromPool(buffer, this.workers, this.workersReady, this.pendingRequests, this.queuedRequestIds, this.workerPoolStarting, this.ensureWorkerPool.bind(this), this.dispatchQueuedRequests.bind(this))
  }

  private async requestFromPool(
    buffer: Buffer,
    workers: PaddleWorker[],
    workersReady: Promise<void> | null,
    pendingRequests: Map<string, PendingPaddleRequest>,
    queuedRequestIds: string[],
    poolStarting: Promise<void> | null,
    ensurePool: () => Promise<void>,
    dispatchRequests: () => void,
  ): Promise<{ lines: PaddleLine[] }> {
    await ensurePool()

    const id = String(++paddleRequestId)
    const timeoutMs = Number(process.env.PADDLE_OCR_TIMEOUT_MS || 120000)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id)
        const index = queuedRequestIds.indexOf(id)
        if (index > -1) queuedRequestIds.splice(index, 1)
        const pendingWorker = pending.worker
        if (pendingWorker) this.restartWorker(pendingWorker)
        reject(new Error(`PaddleOCR worker timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const pending: PendingPaddleRequest = { imageData: buffer.toString('base64'), resolve, reject, timer, enqueuedAt: performance.now() }
      pendingRequests.set(id, pending)
      queuedRequestIds.push(id)
      logger.info('paddleocr.job_queued', { id, queueDepth: queuedRequestIds.length })
      dispatchRequests()
    })
  }

  private async ensureWorkerPool() {
    if (this.workers.length && this.workersReady) return this.workersReady
    if (this.workerPoolStarting) return this.workerPoolStarting

    this.workerPoolStarting = this.startWorkerPool()
    try {
      await this.workerPoolStarting
    } finally {
      this.workerPoolStarting = null
    }
  }

  private async ensureCpuWorkerPool() {
    if (this.cpuWorkers.length && this.cpuWorkersReady) return this.cpuWorkersReady
    if (this.cpuWorkerPoolStarting) return this.cpuWorkerPoolStarting

    this.cpuWorkerPoolStarting = this.startDeviceWorkerPool('cpu')
    try {
      await this.cpuWorkerPoolStarting
    } finally {
      this.cpuWorkerPoolStarting = null
    }
  }

  private async ensureGpuWorkerPool() {
    if (this.gpuWorkers.length && this.gpuWorkersReady) return this.gpuWorkersReady
    if (this.gpuWorkerPoolStarting) return this.gpuWorkerPoolStarting

    this.gpuWorkerPoolStarting = this.startDeviceWorkerPool('gpu')
    try {
      await this.gpuWorkerPoolStarting
    } finally {
      this.gpuWorkerPoolStarting = null
    }
  }

  private async startWorkerPool() {
    this.stoppingWorkerPool = false
    const workerPath = await this.resolveWorkerPath()
    const paddleHome = process.env.PADDLE_OCR_HOME || defaultPaddleCacheDir
    const paddlexCacheHome = process.env.PADDLE_PDX_CACHE_HOME || path.join(paddleHome, 'paddlex')
    const xdgCacheHome = process.env.XDG_CACHE_HOME || path.join(paddleHome, 'xdg')
    this.workerPath = workerPath
    this.workerEnvPaths = { paddleHome, paddlexCacheHome, xdgCacheHome }
    await fs.mkdir(paddlexCacheHome, { recursive: true })
    await fs.mkdir(xdgCacheHome, { recursive: true })

    // Default 4 workers: front + back run truly in parallel (each needs 1 worker), plus headroom
    const workerCount = Math.max(1, Number(process.env.PADDLE_OCR_WORKERS || 4))
    const device = (process.env.PADDLE_OCR_DEVICE as 'cpu' | 'gpu' | 'auto') || 'auto'
    this.workers = Array.from({ length: workerCount }, (_item, index) =>
      this.startWorker(index + 1, workerPath, paddleHome, paddlexCacheHome, xdgCacheHome, device),
    )

    this.workersReady = Promise.all(this.workers.map((worker) => worker.ready)).then(() => undefined)

    try {
      await this.workersReady
      logger.info('paddleocr.worker_pool.ready', { workers: this.workers.length, device })
    } catch (error) {
      this.stopWorkerPool()
      throw error
    }
  }

  private async startDeviceWorkerPool(device: 'cpu' | 'gpu') {
    const workerPath = await this.resolveWorkerPath()
    const paddleHome = process.env.PADDLE_OCR_HOME || defaultPaddleCacheDir
    const paddlexCacheHome = process.env.PADDLE_PDX_CACHE_HOME || path.join(paddleHome, 'paddlex')
    const xdgCacheHome = process.env.XDG_CACHE_HOME || path.join(paddleHome, 'xdg')
    
    // Create device-specific cache directories
    const deviceCacheHome = path.join(paddleHome, device)
    const devicePaddlexCacheHome = path.join(deviceCacheHome, 'paddlex')
    const deviceXdgCacheHome = path.join(deviceCacheHome, 'xdg')
    
    await fs.mkdir(devicePaddlexCacheHome, { recursive: true })
    await fs.mkdir(deviceXdgCacheHome, { recursive: true })

    // 2 workers per device pool for dual-run mode
    const workerCount = Math.max(1, Number(process.env.PADDLE_OCR_WORKERS_PER_DEVICE || 2))
    
    if (device === 'cpu') {
      this.cpuWorkers = Array.from({ length: workerCount }, (_item, index) =>
        this.startWorker(index + 1, workerPath, deviceCacheHome, devicePaddlexCacheHome, deviceXdgCacheHome, device),
      )
      this.cpuWorkersReady = Promise.all(this.cpuWorkers.map((worker) => worker.ready)).then(() => undefined)

      try {
        await this.cpuWorkersReady
        logger.info('paddleocr.cpu_worker_pool.ready', { workers: this.cpuWorkers.length })
      } catch (error) {
        this.stopCpuWorkerPool()
        throw error
      }
    } else {
      this.gpuWorkers = Array.from({ length: workerCount }, (_item, index) =>
        this.startWorker(index + 1, workerPath, deviceCacheHome, devicePaddlexCacheHome, deviceXdgCacheHome, device),
      )
      this.gpuWorkersReady = Promise.all(this.gpuWorkers.map((worker) => worker.ready)).then(() => undefined)

      try {
        await this.gpuWorkersReady
        logger.info('paddleocr.gpu_worker_pool.ready', { workers: this.gpuWorkers.length })
      } catch (error) {
        this.stopGpuWorkerPool()
        throw error
      }
    }
  }

  private startWorker(id: number, workerPath: string, paddleHome: string, paddlexCacheHome: string, xdgCacheHome: string, device: 'cpu' | 'gpu' | 'auto' = 'auto'): PaddleWorker {
    const child = spawn(process.env.PADDLE_OCR_PYTHON || 'python', [workerPath], {
      env: {
        ...process.env,
        HOME: paddleHome,
        USERPROFILE: paddleHome,
        PADDLE_PDX_CACHE_HOME: paddlexCacheHome,
        XDG_CACHE_HOME: xdgCacheHome,
        PADDLE_OCR_DEVICE: device,
        PADDLE_OCR_CPU_THREADS: process.env.PADDLE_OCR_CPU_THREADS || '2',
        FLAGS_use_mkldnn: process.env.FLAGS_use_mkldnn || '1',
        FLAGS_use_onednn: process.env.FLAGS_use_onednn || '1',
        PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: process.env.PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK || 'True',
        PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
      },
    })

    const stdout = readline.createInterface({ input: child.stdout })
    const worker: PaddleWorker = {
      id,
      process: child,
      stdout,
      ready: Promise.resolve(),
      busy: true,
      device,
    }

    stdout.on('line', (line) => this.handleWorkerLine(worker, line))
    child.stderr.on('data', (chunk) => logger.debug('paddleocr.worker.stderr', { workerId: id, message: String(chunk).trim() }))
    child.on('exit', (code, signal) => {
      logger.warn('paddleocr.worker.exited', { workerId: id, code, signal })
      this.rejectWorkerRequest(worker, new Error(`PaddleOCR worker ${id} exited with code ${code ?? 'null'}`))
      this.workers = this.workers.filter((candidate) => candidate !== worker)
      this.replaceWorker(id)
    })
    child.on('error', (error) => {
      logger.error('paddleocr.worker.error', { workerId: id, error })
      this.rejectWorkerRequest(worker, error)
      this.workers = this.workers.filter((candidate) => candidate !== worker)
      this.replaceWorker(id)
    })

    worker.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('PaddleOCR worker did not become ready in time')), Number(process.env.PADDLE_OCR_STARTUP_TIMEOUT_MS || 120000))
      const checkReady = (line: string) => {
        try {
          const payload = JSON.parse(line)
          if (payload.type !== 'ready') return
          clearTimeout(timer)
          stdout.off('line', checkReady)
          worker.busy = false
          logger.info('paddleocr.worker.ready', { workerId: id })
          this.dispatchQueuedRequests()
          resolve()
        } catch (_error) {
          return
        }
      }
      stdout.on('line', checkReady)
      child.once('error', (error) => {
        clearTimeout(timer)
        stdout.off('line', checkReady)
        reject(error)
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        stdout.off('line', checkReady)
        reject(new Error(`PaddleOCR worker exited before ready with code ${code ?? 'null'}`))
      })
    })

    return worker
  }

  private dispatchQueuedRequests() {
    this.dispatchRequestsForPool(this.workers, this.pendingRequests, this.queuedRequestIds)
  }

  private dispatchCpuQueuedRequests() {
    this.dispatchRequestsForPool(this.cpuWorkers, this.cpuPendingRequests, this.cpuQueuedRequestIds)
  }

  private dispatchGpuQueuedRequests() {
    this.dispatchRequestsForPool(this.gpuWorkers, this.gpuPendingRequests, this.gpuQueuedRequestIds)
  }

  private dispatchRequestsForPool(workers: PaddleWorker[], pendingRequests: Map<string, PendingPaddleRequest>, queuedRequestIds: string[]) {
    for (const worker of workers) {
      if (worker.busy || worker.process.stdin.destroyed) continue

      const id = queuedRequestIds.shift()
      if (!id) return

      const pending = pendingRequests.get(id)
      if (!pending) continue

      worker.busy = true
      worker.currentRequestId = id
      pending.worker = worker
      const queueWaitMs = Math.round(performance.now() - pending.enqueuedAt)
      logger.info('paddleocr.job_started', { id, workerId: worker.id, device: worker.device, queueWaitMs, queueDepth: queuedRequestIds.length })
      worker.process.stdin.write(`${JSON.stringify({ id, imageData: pending.imageData })}\n`, 'utf8', (error) => {
        if (!error) return
        this.rejectWorkerRequest(worker, error)
      })
    }
  }

  private handleWorkerLine(worker: PaddleWorker, line: string) {
    let payload: { id?: string; lines?: PaddleLine[]; error?: string; type?: string }
    try {
      payload = JSON.parse(line)
    } catch (_error) {
      logger.debug('paddleocr.worker.stdout', { message: line })
      return
    }

    if (payload.type === 'ready') return
    if (!payload.id) return

    const pending = this.pendingRequests.get(payload.id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pendingRequests.delete(payload.id)
    worker.busy = false
    worker.currentRequestId = undefined
    if (payload.error) pending.reject(new Error(payload.error))
    else pending.resolve({ lines: Array.isArray(payload.lines) ? payload.lines : [] })
    this.dispatchQueuedRequests()
  }

  private rejectWorkerRequest(worker: PaddleWorker, error: Error) {
    if (!worker.currentRequestId) return
    const pending = this.pendingRequests.get(worker.currentRequestId)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pendingRequests.delete(worker.currentRequestId)
    pending.reject(error)
    worker.busy = false
    worker.currentRequestId = undefined
    this.dispatchQueuedRequests()
  }

  private restartWorker(worker: PaddleWorker) {
    worker.process.kill()
  }

  private replaceWorker(id: number) {
    if (this.stoppingWorkerPool || !this.workerPath || !this.workerEnvPaths) return
    const replacement = this.startWorker(
      id,
      this.workerPath,
      this.workerEnvPaths.paddleHome,
      this.workerEnvPaths.paddlexCacheHome,
      this.workerEnvPaths.xdgCacheHome,
    )
    this.workers.push(replacement)
  }

  private rejectPendingRequests(error: Error) {
    for (const id of [...this.pendingRequests.keys()]) {
      const pending = this.pendingRequests.get(id)
      if (!pending) continue
      clearTimeout(pending.timer)
      pending.reject(error)
      this.pendingRequests.delete(id)
    }
    this.queuedRequestIds = []
  }

  private stopWorkerPool() {
    const workers = this.workers
    this.stoppingWorkerPool = true
    this.workers = []
    this.workersReady = null
    for (const worker of workers) worker.process.kill()
    this.rejectPendingRequests(new Error('PaddleOCR worker pool stopped'))
  }

  private stopCpuWorkerPool() {
    const workers = this.cpuWorkers
    this.cpuWorkers = []
    this.cpuWorkersReady = null
    for (const worker of workers) worker.process.kill()
    this.rejectPendingRequestsForPool(this.cpuPendingRequests, this.cpuQueuedRequestIds, new Error('PaddleOCR CPU worker pool stopped'))
  }

  private stopGpuWorkerPool() {
    const workers = this.gpuWorkers
    this.gpuWorkers = []
    this.gpuWorkersReady = null
    for (const worker of workers) worker.process.kill()
    this.rejectPendingRequestsForPool(this.gpuPendingRequests, this.gpuQueuedRequestIds, new Error('PaddleOCR GPU worker pool stopped'))
  }

  private rejectPendingRequestsForPool(pendingRequests: Map<string, PendingPaddleRequest>, queuedRequestIds: string[], error: Error) {
    for (const id of [...pendingRequests.keys()]) {
      const pending = pendingRequests.get(id)
      if (!pending) continue
      clearTimeout(pending.timer)
      pending.reject(error)
      pendingRequests.delete(id)
    }
    queuedRequestIds.length = 0
  }

  private async resolveWorkerPath() {
    for (const candidate of [compiledWorkerPath, sourceWorkerPath]) {
      try {
        await fs.access(candidate)
        return candidate
      } catch (_error) {
        continue
      }
    }

    throw new Error(`PaddleOCR worker not found. Checked: ${compiledWorkerPath}, ${sourceWorkerPath}`)
  }

  private averageConfidence(lines: PaddleLine[]) {
    const confidences = lines
      .map((line) => Number(line.confidence || 0))
      .filter((confidence) => Number.isFinite(confidence) && confidence > 0)

    if (!confidences.length) return 0
    return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length * 100
  }

  private summarizeLines(lines: PaddleLine[]) {
    return lines.map((line) => ({
      text: line.text,
      confidence: line.confidence,
    }))
  }

  private mergeOcrLines(lines: PaddleLine[]) {
    const seen = new Set<string>()
    return lines.filter((line) => {
      const key = cleanText(line.text)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private extractSideDetails(lines: PaddleLine[], side: string) {
    if (side === 'front' || side === 'unknown') return this.extractFrontDetails(lines)
    if (side === 'back') return this.extractBackDetails(lines)
    return {}
  }

  private extractFrontDetails(lines: PaddleLine[]) {
    const rows = this.groupRows(lines)
    const headingIndex = rows.findIndex((row) => /بطاقة|تحقيق|الشخصية/.test(row))
    const candidateRows = (headingIndex >= 0 ? rows.slice(headingIndex + 1) : rows)
      .filter((row) => containsArabic(row))
      .filter((row) => !/جمهورية|العربية|بطاقة|تحقيق|الشخصية/.test(row))
      .filter((row) => !/^\s*[٠-٩۰-۹\d\s/.-]+\s*$/.test(row))

    let nameRows: string[] = []
    let addressRows: string[] = []

    if (candidateRows.length >= 3) {
      nameRows = candidateRows.slice(0, 2)
      addressRows = candidateRows.slice(2)
    } else {
      const flatLines = lines.map((line) => cleanText(line.text)).filter(Boolean)
      let flatHeadingIndex = -1
      for (let index = 0; index < Math.min(flatLines.length, 6); index += 1) {
        if (/بطاقة|تحقيق|الشخصية/.test(flatLines[index])) flatHeadingIndex = index
      }
      const dataLines = flatLines.slice(flatHeadingIndex + 1)
        .filter((line) => containsArabic(line))
        .filter((line) => !/^\s*[٠-٩۰-۹\d\s/.-]+\s*$/.test(line))
      const addressStart = dataLines.findIndex((line) => /[٠-٩۰-۹\d]|عمارة|شارع|مركز|قرية|حي|قسم|التجمع|مدينة|كفر|طريق/.test(line))
      const rawNameLines = addressStart >= 0 ? dataLines.slice(0, addressStart) : dataLines.slice(0, 2)
      const firstNameLine = rawNameLines[0] || ''
      const remainingNameLines = rawNameLines.slice(1)
      nameRows = [
        firstNameLine,
        remainingNameLines.length > 1 && remainingNameLines.every((line) => !line.includes(' '))
          ? [...remainingNameLines].reverse().join(' ')
          : remainingNameLines.join(' '),
      ].filter(Boolean)

      const rawAddressLines = addressStart >= 0 ? dataLines.slice(addressStart) : []
      const buildingIndex = rawAddressLines.findIndex((line) => /عمارة/.test(line))
      if (buildingIndex >= 0) {
        addressRows = [
          rawAddressLines.slice(0, buildingIndex + 1).reverse().join(' '),
          rawAddressLines.slice(buildingIndex + 1).reverse().join(' '),
        ].filter(Boolean)
      } else {
        addressRows = rawAddressLines
      }
    }

    const name = cleanText(nameRows.join(' '))
    const address = cleanText(addressRows.join(' '))
      .replace(/([٠-٩۰-۹\d]+)\s*مجمو\s*عة/g, '$1 مجموعة')
      .replace(/مجموعة\s+([٠-٩۰-۹\d]+)\s+([٠-٩۰-۹\d]+)/g, (_match, first, second) => `مجموعة ${second}${first}`)
      .replace(/القاهره/g, 'القاهرة')
      .replace(/الاول/g, 'الأول')
    const nameParts = this.splitArabicName(name)

    return this.mergeExtractedFields([
      name ? { name } : null,
      nameParts,
      address ? { address, idResidenceAddressAr: address } : null,
    ])
  }

  private extractBackDetails(lines: PaddleLine[]) {
    const textLines = lines.map((line) => cleanText(line.text)).filter(Boolean)
    const allText = textLines.join(' ')
    const expiryLine = textLines.find((line) => /سارية|حتى|حثى/.test(line))
    const issueLine = textLines.find((line) => /20[12]\d|[٢٠][٠-٩]{3}/.test(normalizeDigits(line)))
    const occupation = textLines.find((line) =>
      containsArabic(line) &&
      !/بطاقة|سارية|حتى|حثى|ذكر|نكر|أنثى|مسلم|مسيحي|أعزب|متزوج|مطلق|أرمل/.test(line) &&
      !/[٠-٩۰-۹\d]/.test(line),
    )
    const gender = /أنثى/.test(allText) ? 'Female' : /ذكر|نكر/.test(allText) ? 'Male' : null
    const hasSplitMuslim = textLines.some((line, index) => /^م$/.test(line) && /^سل(?:م)?$/.test(textLines[index + 1] || ''))
    const religion = /مسلم/.test(allText) || hasSplitMuslim ? 'مسلم' : /مسيحي/.test(allText) ? 'مسيحي' : null
    const maritalStatusAr = textLines.find((line) => /^(أعزب|متزوج|مطلق|أرمل)$/.test(line)) || null
    const maritalStatus = maritalStatusAr === 'أعزب'
      ? 'Single'
      : maritalStatusAr === 'متزوج'
        ? 'Married'
        : maritalStatusAr === 'مطلق'
          ? 'Divorced'
          : maritalStatusAr === 'أرمل'
            ? 'Widowed'
            : null
    const nationalIdIssueMonth = issueLine ? this.inferIssueMonth(issueLine) : null
    const nationalIdExpiryDate = expiryLine ? this.inferDate(expiryLine, nationalIdIssueMonth) : null

    return this.mergeExtractedFields([
      occupation ? { occupation } : null,
      gender ? { gender } : null,
      religion ? { religion } : null,
      maritalStatusAr ? { maritalStatusAr } : null,
      maritalStatus ? { maritalStatus } : null,
      nationalIdExpiryDate ? { nationalIdExpiryDate } : null,
      nationalIdIssueMonth ? {
        nationalIdIssueDate: nationalIdIssueMonth,
        nationalIdIssueMonth,
      } : null,
    ])
  }

  private groupRows(lines: PaddleLine[]) {
    const positioned = lines
      .map((line) => ({ ...line, bounds: this.getBounds(line.box) }))
      .filter((line): line is PositionedLine => Boolean(line.bounds) && Boolean(cleanText(line.text)))
      .sort((first, second) => first.bounds.top - second.bounds.top)

    if (!positioned.length) return []

    const rows: PositionedLine[][] = []
    for (const line of positioned) {
      const centerY = (line.bounds.top + line.bounds.bottom) / 2
      const height = line.bounds.bottom - line.bounds.top
      const row = rows.find((candidate) => {
        const candidateCenter = candidate.reduce((sum, item) => sum + (item.bounds.top + item.bounds.bottom) / 2, 0) / candidate.length
        const candidateHeight = candidate.reduce((sum, item) => sum + item.bounds.bottom - item.bounds.top, 0) / candidate.length
        return Math.abs(centerY - candidateCenter) <= Math.max(12, Math.min(height, candidateHeight) * 0.65)
      })
      if (row) row.push(line)
      else rows.push([line])
    }

    return rows
      .sort((first, second) => first[0].bounds.top - second[0].bounds.top)
      .map((row) => row
        .sort((first, second) => second.bounds.left - first.bounds.left)
        .map((line) => cleanText(line.text))
        .join(' '))
  }

  private getBounds(box: unknown) {
    if (!Array.isArray(box) || !box.length) return null
    if (box.length >= 4 && box.every((value) => typeof value === 'number')) {
      const [left, top, right, bottom] = box as number[]
      return { left, top, right, bottom }
    }

    const points = box.filter((point): point is number[] =>
      Array.isArray(point) && point.length >= 2 && point.every((value) => typeof value === 'number'),
    )
    if (!points.length) return null
    const xs = points.map((point) => point[0])
    const ys = points.map((point) => point[1])
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
  }

  private splitArabicName(name: string) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length < 2) return name ? { firstNameAr: name } : {}

    const compoundFirstName = parts[0] === 'عبد' && parts[1]?.startsWith('ال')
    const firstNameLength = compoundFirstName ? 2 : 1
    return {
      firstNameAr: parts.slice(0, firstNameLength).join(' '),
      middleNameAr: parts.slice(firstNameLength, -1).join(' '),
      lastNameAr: parts.at(-1),
    }
  }

  private inferDate(value: string, issueMonth?: string | null) {
    const normalized = normalizeDigits(value)
    const explicit = normalized.match(/(20\d{2})\D{0,3}(\d{1,2})\D{1,3}(\d{1,2})/)
    if (explicit) return this.validDate(Number(explicit[1]), Number(explicit[2]), Number(explicit[3]))
    const missingCenturyDigit = normalized.match(/\b0(\d{2})\D{0,3}(\d{1,2})\D{1,3}(\d{1,2})\b/)
    if (missingCenturyDigit) {
      const date = this.validDate(
        Number(`20${missingCenturyDigit[1]}`),
        Number(missingCenturyDigit[2]),
        Number(missingCenturyDigit[3]),
      )
      if (date) return date
    }

    const digits = normalized.replace(/\D/g, '')
    const yearMatch = digits.match(/20\d{2}/)
    if (!yearMatch || yearMatch.index === undefined) return null
    const year = Number(yearMatch[0])
    const before = digits.slice(0, yearMatch.index)
    const after = digits.slice(yearMatch.index + 4)

    for (const nearby of [before.slice(-4), before.slice(-3), after.slice(0, 4), after.slice(0, 3)]) {
      if (nearby.length === 3) {
        const date = this.validDate(year, Number(nearby[0]), Number(nearby.slice(1)))
        if (date) return date
      }
      if (nearby.length === 4) {
        const date = this.validDate(year, Number(nearby.slice(0, 2)), Number(nearby.slice(2)))
        if (date) return date
      }
    }

    const issueMonthMatch = issueMonth?.match(/^(\d{4})-(\d{2})$/)
    if (issueMonthMatch && year === Number(issueMonthMatch[1]) + 7 && after.length >= 2) {
      const day = Number(after.slice(-2))
      const date = this.validDate(year, Number(issueMonthMatch[2]), day)
      if (date) return date
    }

    return null
  }

  private inferIssueMonth(value: string) {
    const digits = normalizeDigits(value).replace(/\D/g, '')
    const match = digits.match(/(20\d{2})(?:1)?(0[1-9]|1[0-2])$/)
    return match ? `${match[1]}-${match[2]}` : null
  }

  private validDate(year: number, month: number, day: number) {
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  private reconcileNationalId(frontValue: unknown, backValue: unknown) {
    const front = typeof frontValue === 'string' ? frontValue : ''
    const back = typeof backValue === 'string' ? backValue : ''
    if (!front) return back || null
    if (!back) return front
    if (front === back) return front

    const differences = [...front].filter((digit, index) => digit !== back[index]).length
    const fused = front[0] + back.slice(1)
    const parsedFused = testOnly.parseNationalId(fused)
    const birthYear = parsedFused ? Number(String(parsedFused.dateOfBirth).slice(0, 4)) : 0
    const plausibleAge = birthYear >= 1926 && birthYear <= new Date().getUTCFullYear() - 16
    if (differences <= 4 && front.slice(1, 10) === back.slice(1, 10) && parsedFused && plausibleAge) return fused

    return front
  }

  private mergeExtractedFields(items: Array<Record<string, unknown> | null | undefined>) {
    return items.reduce<Record<string, unknown>>((merged, item) => {
      if (!item) return merged
      for (const [key, value] of Object.entries(item)) {
        if (value !== null && value !== undefined && value !== '' && !merged[key]) {
          merged[key] = value
        }
      }
      return merged
    }, {})
  }
}
