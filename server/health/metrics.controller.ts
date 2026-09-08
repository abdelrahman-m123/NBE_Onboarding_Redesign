import { Controller, Get } from '@nestjs/common'
import os from 'node:os'

interface CpuSnapshot {
  idle: number
  total: number
}

// Stores the last CPU times snapshot for computing delta usage
let lastSnapshot: CpuSnapshot[] | null = null

function takeCpuSnapshot(): CpuSnapshot[] {
  return os.cpus().map((cpu) => {
    const times = cpu.times
    const total = times.user + times.nice + times.sys + times.irq + times.idle
    return { idle: times.idle, total }
  })
}

function computeUsagePercent(previous: CpuSnapshot[], current: CpuSnapshot[]): number[] {
  return current.map((curr, index) => {
    const prev = previous[index]
    const idleDelta = curr.idle - prev.idle
    const totalDelta = curr.total - prev.total
    if (totalDelta === 0) return 0
    return Math.round(((totalDelta - idleDelta) / totalDelta) * 100)
  })
}

@Controller('api/metrics')
export class MetricsController {
  @Get('cpu')
  getCpu() {
    const cpus = os.cpus()
    const currentSnapshot = takeCpuSnapshot()
    let perCoreUsage: number[] = []

    if (lastSnapshot && lastSnapshot.length === currentSnapshot.length) {
      perCoreUsage = computeUsagePercent(lastSnapshot, currentSnapshot)
    } else {
      // First call — no delta yet, report 0 per core
      perCoreUsage = cpus.map(() => 0)
    }

    lastSnapshot = currentSnapshot

    const avgUsage = perCoreUsage.length > 0
      ? Math.round(perCoreUsage.reduce((sum, v) => sum + v, 0) / perCoreUsage.length)
      : 0

    const loadAvg = os.loadavg() // [1m, 5m, 15m] — [0,0,0] on Windows

    return {
      // Physical CPU package info
      model: cpus[0]?.model?.trim() || 'Unknown',
      speedMhz: cpus[0]?.speed || 0,

      // Counts
      logicalCores: cpus.length,             // vCPUs / logical processors (hyperthreading included)
      physicalCores: Math.ceil(cpus.length / 2), // Estimate: assumes 2x hyperthreading

      // Usage
      avgUsagePercent: avgUsage,
      perCoreUsagePercent: perCoreUsage,

      // Memory
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
      freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
      usedMemoryMb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
      memoryUsagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),

      // System load
      loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
      loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
      loadAvg15m: Math.round(loadAvg[2] * 100) / 100,

      // Process-level (Node.js only)
      processUptime: Math.round(process.uptime()),
      nodeMemoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),

      sampledAt: new Date().toISOString(),
    }
  }
}
