import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.OCR_BENCHMARK_BASE_URL || 'http://localhost:4000',
    endpoint: process.env.OCR_BENCHMARK_ENDPOINT || '/api/identity/ocr',
    requests: Number(process.env.OCR_BENCHMARK_REQUESTS || 100),
    concurrency: Number(process.env.OCR_BENCHMARK_CONCURRENCY || 1),
    fixturesDir: process.env.OCR_BENCHMARK_FIXTURES_DIR || path.join(root, 'test-ids'),
    targetConcurrency: Number(process.env.OCR_BENCHMARK_TARGET_CONCURRENCY || 1000),
    targetCpuUtilization: Number(process.env.OCR_BENCHMARK_TARGET_CPU_UTILIZATION || 0.7),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--base-url') args.baseUrl = next
    else if (arg === '--endpoint') args.endpoint = next
    else if (arg === '--requests') args.requests = Number(next)
    else if (arg === '--concurrency') args.concurrency = Number(next)
    else if (arg === '--fixtures-dir') args.fixturesDir = path.resolve(next)
    else if (arg === '--target-concurrency') args.targetConcurrency = Number(next)
    else if (arg === '--target-cpu-utilization') args.targetCpuUtilization = Number(next)
    else continue
    index += 1
  }

  if (!Number.isFinite(args.requests) || args.requests < 1) throw new Error('--requests must be a positive number')
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) throw new Error('--concurrency must be a positive number')
  if (!Number.isFinite(args.targetConcurrency) || args.targetConcurrency < 1) throw new Error('--target-concurrency must be a positive number')
  if (!Number.isFinite(args.targetCpuUtilization) || args.targetCpuUtilization <= 0 || args.targetCpuUtilization > 1) {
    throw new Error('--target-cpu-utilization must be > 0 and <= 1')
  }

  args.concurrency = Math.min(Math.floor(args.concurrency), Math.floor(args.requests))
  args.requests = Math.floor(args.requests)
  args.targetConcurrency = Math.floor(args.targetConcurrency)
  return args
}

function percentile(values, percentileValue) {
  if (!values.length) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

async function loadFixtures(fixturesDir) {
  const entries = await fs.readdir(fixturesDir, { withFileTypes: true })
  const imageFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(fixturesDir, entry.name))
    .filter((file) => /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file))
    .sort()
  const pairedIdFiles = imageFiles.filter((file) => /^test-\d+-(front|back)\./i.test(path.basename(file)))
  const files = pairedIdFiles.length ? pairedIdFiles : imageFiles

  if (!files.length) throw new Error(`No image fixtures found in ${fixturesDir}`)

  return Promise.all(files.map(async (file) => ({
    file,
    name: path.basename(file),
    buffer: await fs.readFile(file),
    type: mimeTypeFor(file),
  })))
}

function mimeTypeFor(file) {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.bmp') return 'image/bmp'
  if (extension === '.tif' || extension === '.tiff') return 'image/tiff'
  return 'image/png'
}

async function fetchCpuMetrics(baseUrl) {
  try {
    const response = await fetch(new URL('/api/metrics/cpu', baseUrl))
    if (!response.ok) return null
    return response.json()
  } catch (_error) {
    return null
  }
}

async function sendOcrRequest({ url, fixture, testId }) {
  const form = new FormData()
  form.append('testId', testId)
  form.append('nationalIdImage', new Blob([fixture.buffer], { type: fixture.type }), fixture.name)

  const startedAt = performance.now()
  let status = 0
  let ok = false
  let error = null

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Benchmark-Test-Id': testId,
      },
      body: form,
    })
    status = response.status
    ok = response.ok
    await response.arrayBuffer()
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }

  return {
    testId,
    fixture: fixture.name,
    status,
    ok,
    error,
    latencyMs: performance.now() - startedAt,
  }
}

async function runQueue(total, concurrency, task) {
  const results = []
  let next = 0

  async function worker() {
    while (next < total) {
      const current = next
      next += 1
      results[current] = await task(current)
      const done = results.filter(Boolean).length
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`\rCompleted ${done}/${total}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  process.stdout.write('\n')
  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const fixtures = await loadFixtures(args.fixturesDir)
  const url = new URL(args.endpoint, args.baseUrl)

  console.log(`OCR endpoint benchmark`)
  console.log(`URL: ${url}`)
  console.log(`Requests: ${args.requests}, client concurrency: ${args.concurrency}`)
  console.log(`Fixtures: ${fixtures.map((fixture) => fixture.name).join(', ')}`)

  await fetchCpuMetrics(args.baseUrl)
  const cpuSamples = []
  const sampler = setInterval(async () => {
    const sample = await fetchCpuMetrics(args.baseUrl)
    if (sample) cpuSamples.push(sample)
  }, 1000)

  const startedAt = performance.now()
  const results = await runQueue(args.requests, args.concurrency, (index) => {
    const fixture = fixtures[index % fixtures.length]
    const testId = `ocr-benchmark-${String(index + 1).padStart(3, '0')}-${Date.now()}`
    return sendOcrRequest({ url, fixture, testId })
  })
  clearInterval(sampler)
  const finalCpu = await fetchCpuMetrics(args.baseUrl)
  if (finalCpu) cpuSamples.push(finalCpu)
  const elapsedMs = performance.now() - startedAt

  const successful = results.filter((result) => result.ok)
  const failed = results.filter((result) => !result.ok)
  const latencies = successful.map((result) => result.latencyMs)
  const avgCpuPercent = mean(cpuSamples.map((sample) => Number(sample.avgUsagePercent)).filter(Number.isFinite))
  const peakCpuPercent = Math.max(0, ...cpuSamples.map((sample) => Number(sample.avgUsagePercent)).filter(Number.isFinite))
  const logicalCores = finalCpu?.logicalCores || cpuSamples.find((sample) => sample.logicalCores)?.logicalCores || 1
  const throughputRps = successful.length / (elapsedMs / 1000)
  const observedBusyVcpus = (avgCpuPercent / 100) * logicalCores
  const vcpuSecondsPerRequest = throughputRps > 0 ? observedBusyVcpus / throughputRps : 0
  const avgLatencySeconds = mean(latencies) / 1000
  const targetRpsForSameLatency = avgLatencySeconds > 0 ? args.targetConcurrency / avgLatencySeconds : 0
  const estimatedVcpusAtTarget = args.targetCpuUtilization > 0
    ? (targetRpsForSameLatency * vcpuSecondsPerRequest) / args.targetCpuUtilization
    : 0
  const estimatedBatchSeconds = throughputRps > 0 ? args.targetConcurrency / throughputRps : 0

  const summary = {
    requestCount: args.requests,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    clientConcurrency: args.concurrency,
    elapsedSeconds: round(elapsedMs / 1000, 3),
    throughputRps: round(throughputRps, 3),
    latencyMs: {
      average: round(mean(latencies), 2),
      p50: round(percentile(latencies, 50), 2),
      p90: round(percentile(latencies, 90), 2),
      p95: round(percentile(latencies, 95), 2),
      p99: round(percentile(latencies, 99), 2),
      min: latencies.length ? round(Math.min(...latencies), 2) : 0,
      max: latencies.length ? round(Math.max(...latencies), 2) : 0,
    },
    cpu: {
      samples: cpuSamples.length,
      averageUsagePercent: round(avgCpuPercent, 2),
      peakUsagePercent: round(peakCpuPercent, 2),
      logicalCores,
      observedBusyVcpus: round(observedBusyVcpus, 2),
      vcpuSecondsPerRequest: round(vcpuSecondsPerRequest, 4),
    },
    estimateForConcurrentUsers: {
      users: args.targetConcurrency,
      targetCpuUtilization: args.targetCpuUtilization,
      rpsNeededToKeepObservedAverageLatency: round(targetRpsForSameLatency, 3),
      estimatedVcpusNeeded: round(estimatedVcpusAtTarget, 2),
      estimatedTimeToDrainOneBurstSeconds: round(estimatedBatchSeconds, 2),
    },
    failedExamples: failed.slice(0, 5),
  }

  const outDir = path.join(root, 'output', 'ocr-endpoint-benchmark')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await fs.writeFile(outPath, JSON.stringify({ summary, cpuSamples, results }, null, 2))

  console.log(JSON.stringify(summary, null, 2))
  console.log(`Report written to ${path.relative(root, outPath)}`)
  console.log('Note: the 1000-user CPU estimate assumes users continuously submit OCR work and that latency scales linearly. Validate it with a higher-concurrency load test before capacity planning.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
