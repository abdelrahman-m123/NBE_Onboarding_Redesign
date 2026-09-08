import { performance } from 'node:perf_hooks'
import os from 'node:os'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { logger } from '../common/logger.js'
import { OCR_SERVICE, type OcrService } from './ocr/ocr.interface.js'

const execAsync = promisify(exec)

function takeCpuSnapshot() {
  return os.cpus().map((cpu) => {
    const times = cpu.times
    const total = times.user + times.nice + times.sys + times.irq + times.idle
    return { idle: times.idle, total }
  })
}

function computeUsagePercent(previous: any[], current: any[]) {
  const perCore = current.map((curr, index) => {
    const prev = previous[index]
    const idleDelta = curr.idle - prev.idle
    const totalDelta = curr.total - prev.total
    if (totalDelta === 0) return 0
    return Math.round(((totalDelta - idleDelta) / totalDelta) * 100)
  })
  return Math.round(perCore.reduce((sum, v) => sum + v, 0) / perCore.length)
}

interface GpuMetrics {
  utilizationPercent?: number
  memoryUsedMb?: number
  memoryTotalMb?: number
  memoryPercent?: number
  temperature?: number
  powerDraw?: number
}

async function getGpuMetrics(): Promise<GpuMetrics | null> {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits')
    
    const values = stdout.trim().split(',').map(v => parseFloat(v.trim()))
    
    if (values.length >= 5) {
      const [utilization, memoryUsed, memoryTotal, temperature, powerDraw] = values
      const memoryPercent = memoryTotal > 0 ? Math.round((memoryUsed / memoryTotal) * 100) : 0
      
      return {
        utilizationPercent: Math.round(utilization),
        memoryUsedMb: Math.round(memoryUsed),
        memoryTotalMb: Math.round(memoryTotal),
        memoryPercent,
        temperature: Math.round(temperature),
        powerDraw: Math.round(powerDraw * 1000) / 1000, // Keep 3 decimal places
      }
    }
    
    return null
  } catch (error) {
    logger.debug('gpu.metrics.failed', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

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
    files: { front?: Express.Multer.File; back?: Express.Multer.File },
    requestId?: string,
    device: 'cpu' | 'gpu' | 'both' | 'auto' = 'auto',
  ) {
    const startedAt = performance.now()
    logger.info('ocr.multi_started', {
      requestId,
      hasFront: Boolean(files.front),
      hasBack: Boolean(files.back),
      device,
    })

    try {
      if (device === 'both') {
        const cpuRun = await this.runBenchmarkSafely(files, requestId, 'cpu')
        const gpuRun = await this.runBenchmarkSafely(files, requestId, 'gpu')
        
        const durationMs = Math.round(performance.now() - startedAt)
        
        logger.info('ocr.multi_finished', {
          requestId,
          mode: 'dual',
          cpuStatus: cpuRun.status === 'fulfilled' ? cpuRun.value.status : 'failed',
          gpuStatus: gpuRun.status === 'fulfilled' ? gpuRun.value.status : 'failed',
          durationMs,
        })
        
        return {
          mode: 'dual',
          cpuResult: cpuRun.status === 'fulfilled' ? cpuRun.value : null,
          gpuResult: gpuRun.status === 'fulfilled' ? gpuRun.value : null,
          durationMs,
        }
      }
      
      // Single device run
      const startCpu = takeCpuSnapshot()
      const startGpu = await getGpuMetrics()
      
      const result = await this.ocrService.recognizeNationalIdImages({
        front: files.front?.buffer,
        back: files.back?.buffer,
      }, device)
      
      const endCpu = takeCpuSnapshot()
      const endGpu = await getGpuMetrics()
      
      const cpuUsagePercent = computeUsagePercent(startCpu, endCpu)
      const cpu = {
        usagePercent: cpuUsagePercent,
        vcpus: startCpu.length,
        physicalCpus: Math.ceil(startCpu.length / 2),
      }
      
      // Calculate GPU metrics delta if available
      let gpu = null
      if (startGpu && endGpu) {
        gpu = {
          ...endGpu,
          utilizationDelta: endGpu.utilizationPercent !== undefined && startGpu.utilizationPercent !== undefined
            ? endGpu.utilizationPercent - startGpu.utilizationPercent
            : undefined,
          memoryDelta: endGpu.memoryUsedMb !== undefined && startGpu.memoryUsedMb !== undefined
            ? endGpu.memoryUsedMb - startGpu.memoryUsedMb
            : undefined,
        }
      } else if (endGpu) {
        gpu = endGpu
      }
      
      logger.info('ocr.multi_finished', {
        requestId,
        status: result.status,
        confidence: result.confidence,
        durationMs: Math.round(performance.now() - startedAt),
        cpuUsage: cpu.usagePercent,
        gpuMetrics: gpu,
      })
      
      return { ...result, cpu, gpu }
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

  private async runBenchmarkSafely(
    files: { front?: Express.Multer.File; back?: Express.Multer.File },
    requestId: string | undefined,
    device: 'cpu' | 'gpu',
  ) {
    try {
      return {
        status: 'fulfilled' as const,
        value: await this.runWithMetrics(files, requestId, device),
      }
    } catch (reason) {
      return {
        status: 'rejected' as const,
        reason,
      }
    }
  }

  private async runWithMetrics(
    files: { front?: Express.Multer.File; back?: Express.Multer.File },
    requestId: string | undefined,
    device: 'cpu' | 'gpu',
  ) {
    const startedAt = performance.now()
    const startCpu = takeCpuSnapshot()
    const startGpu = await getGpuMetrics()
    
    const result = await this.ocrService.recognizeNationalIdImages({
      front: files.front?.buffer,
      back: files.back?.buffer,
    }, device)
    
    const endCpu = takeCpuSnapshot()
    const endGpu = await getGpuMetrics()
    
    const cpuUsagePercent = computeUsagePercent(startCpu, endCpu)
    const cpu = {
      usagePercent: cpuUsagePercent,
      vcpus: startCpu.length,
      physicalCpus: Math.ceil(startCpu.length / 2),
    }
    
    // Calculate GPU metrics delta if available
    let gpu = null
    if (startGpu && endGpu) {
      gpu = {
        ...endGpu,
        utilizationDelta: endGpu.utilizationPercent !== undefined && startGpu.utilizationPercent !== undefined
          ? endGpu.utilizationPercent - startGpu.utilizationPercent
          : undefined,
        memoryDelta: endGpu.memoryUsedMb !== undefined && startGpu.memoryUsedMb !== undefined
          ? endGpu.memoryUsedMb - startGpu.memoryUsedMb
          : undefined,
      }
    } else if (endGpu) {
      gpu = endGpu
    }
    
    return {
      ...result,
      cpu,
      gpu,
      device,
      durationMs: Math.round(performance.now() - startedAt),
    }
  }
}
