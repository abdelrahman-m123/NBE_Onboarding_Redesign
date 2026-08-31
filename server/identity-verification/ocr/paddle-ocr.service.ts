import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Injectable } from '@nestjs/common'
import sharp from 'sharp'
import { logger } from '../../common/logger.js'
import type { OcrService } from './ocr.interface.js'
import { extractNationalIdFieldsFromText, recognizeNationalId, testOnly } from './ocr.js'

const execFileAsync = promisify(execFile)
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const compiledRunnerPath = path.join(currentDir, 'paddle_ocr_runner.py')
const sourceRunnerPath = path.join(process.cwd(), 'server', 'identity-verification', 'ocr', 'paddle_ocr_runner.py')
const defaultPaddleCacheDir = path.join(process.cwd(), '.paddle-cache')
let paddleRunQueue = Promise.resolve()

interface PaddleLine {
  text: string
  confidence?: number
  box?: unknown
}

interface PositionedLine extends PaddleLine {
  bounds: { left: number; top: number; right: number; bottom: number }
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

async function withPaddleRunLock<T>(task: () => Promise<T>) {
  const previousRun = paddleRunQueue
  let releaseCurrentRun!: () => void
  paddleRunQueue = new Promise<void>((resolve) => {
    releaseCurrentRun = resolve
  })

  await previousRun.catch(() => undefined)
  try {
    return await task()
  } finally {
    releaseCurrentRun()
  }
}

@Injectable()
export class PaddleOcrService implements OcrService {
  async recognizeNationalId(buffer: Buffer) {
    return this.recognizeSide(buffer, 'unknown')
  }

  async recognizeNationalIdImages(images: { front?: Buffer; back?: Buffer; guide?: Buffer }) {
    const [front, back] = await Promise.all([
      images.front ? this.recognizeSide(images.front, 'front') : null,
      images.back ? this.recognizeSide(images.back, 'back') : null,
    ])
    const guide = images.guide
      ? { status: 'reference-only', confidence: 0, extracted: null, method: 'guide-reference' }
      : null

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
      sides: { front, back, guide },
    }
  }

  private async recognizeSide(buffer: Buffer, side: string) {
    const metadata = await sharp(buffer, { failOn: 'none' }).metadata()
    const isLandscape = (metadata.width || 0) >= (metadata.height || 0)
    const primaryRotations = isLandscape ? [0, 270] : [270, 0]
    const rotations = side === 'unknown' ? [...primaryRotations, 90, 180] : primaryRotations
    const results = []

    for (const rotation of rotations) {
      const rotated = await sharp(buffer, { failOn: 'none' }).rotate().rotate(rotation).png().toBuffer()
      const segmented = await testOnly.extractSegmentedNationalId(rotated)
      const paddleResult = await this.runPaddle(rotated)
      const initialSideDetails = this.extractSideDetails(paddleResult.lines, side)
      const needsFocusedBackRead = side === 'back' && (!initialSideDetails.religion || !initialSideDetails.nationalIdExpiryDate)
      const focusedBackLines = needsFocusedBackRead ? await this.readFocusedBackLines(rotated) : []
      const lines = this.mergeOcrLines([...paddleResult.lines, ...focusedBackLines])
      const text = lines.map((line) => line.text).join('\n')
      const rawTextExtracted = extractNationalIdFieldsFromText(text)
      const textExtracted = side === 'front' || side === 'unknown'
        ? rawTextExtracted
        : Object.fromEntries(Object.entries(rawTextExtracted).filter(([key]) => !['name', 'address'].includes(key)))
      const sideDetails = this.extractSideDetails(lines, side)
      const extracted = this.mergeExtractedFields([segmented, sideDetails, textExtracted])
      if (extracted.nationalId) {
        extracted.placeOfBirth = extracted.governorate
        extracted.gender ||= Number(String(extracted.nationalId)[12]) % 2 === 0 ? 'Female' : 'Male'
      }
      const confidence = Math.round(Math.max(segmented ? 82 : 0, this.averageConfidence(paddleResult.lines)))

      results.push({
        status: extracted.nationalId ? 'completed' : Object.keys(extracted).length ? 'partial' : 'partial',
        confidence,
        extracted: Object.keys(extracted).length ? extracted : null,
        method: segmented ? 'paddleocr-arabic+segmented-digit-line' : 'paddleocr-arabic',
        rotation,
        lines: this.summarizeLines(lines),
      })

      const hasCompleteFront = side === 'front' && Boolean(sideDetails.name && sideDetails.address && extracted.nationalIdCardPrintedNumber)
      const hasCompleteBack = side === 'back' && Boolean(extracted.nationalId && (sideDetails.gender || sideDetails.nationalIdExpiryDate))
      if (hasCompleteFront || hasCompleteBack || (extracted.nationalId && (textExtracted.name || textExtracted.address))) break
    }

    const best = results.sort((first, second) => {
      const firstHasId = first.extracted?.nationalId ? 1 : 0
      const secondHasId = second.extracted?.nationalId ? 1 : 0
      if (firstHasId !== secondHasId) return secondHasId - firstHasId
      return second.confidence - first.confidence
    })[0]

    if (best) return best

    logger.warn('paddleocr.empty_result', { side })
    return recognizeNationalId(buffer)
  }

  private async readFocusedBackLines(buffer: Buffer): Promise<PaddleLine[]> {
    const metadata = await sharp(buffer, { failOn: 'none' }).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0
    if (!width || !height) return []

    const cropConfigs = [
      { left: 0.22, top: 0.28, width: 0.58, height: 0.35 },
      { left: 0.38, top: 0.34, width: 0.26, height: 0.22 },
    ]
    const focusedLines: PaddleLine[] = []

    for (const config of cropConfigs) {
      const left = Math.max(0, Math.floor(width * config.left))
      const top = Math.max(0, Math.floor(height * config.top))
      const cropWidth = Math.min(width - left, Math.floor(width * config.width))
      const cropHeight = Math.min(height - top, Math.floor(height * config.height))
      if (cropWidth <= 0 || cropHeight <= 0) continue

      const crop = await sharp(buffer, { failOn: 'none' })
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .resize({ width: 1800, withoutEnlargement: false })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer()
      const result = await this.runPaddle(crop)
      focusedLines.push(...result.lines)
    }

    return focusedLines
  }

  private async runPaddle(buffer: Buffer): Promise<{ lines: PaddleLine[] }> {
    return withPaddleRunLock(async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nbe-paddle-ocr-'))
      const imagePath = path.join(tempDir, 'input.png')
      const paddleHome = process.env.PADDLE_OCR_HOME || defaultPaddleCacheDir
      const paddlexCacheHome = process.env.PADDLE_PDX_CACHE_HOME || path.join(paddleHome, 'paddlex')
      const xdgCacheHome = process.env.XDG_CACHE_HOME || path.join(paddleHome, 'xdg')

      try {
        await fs.mkdir(paddlexCacheHome, { recursive: true })
        await fs.mkdir(xdgCacheHome, { recursive: true })
        await fs.writeFile(imagePath, buffer)
        const runnerPath = await this.resolveRunnerPath()
        const { stdout } = await execFileAsync(
          process.env.PADDLE_OCR_PYTHON || 'python',
          [runnerPath, imagePath],
          {
            env: {
              ...process.env,
              HOME: paddleHome,
              USERPROFILE: paddleHome,
              PADDLE_PDX_CACHE_HOME: paddlexCacheHome,
              XDG_CACHE_HOME: xdgCacheHome,
              PADDLE_OCR_DEVICE: process.env.PADDLE_OCR_DEVICE || 'auto',
              FLAGS_use_mkldnn: process.env.FLAGS_use_mkldnn || '0',
              FLAGS_use_onednn: process.env.FLAGS_use_onednn || '0',
              PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: process.env.PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK || 'True',
              PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
            },
            maxBuffer: 8 * 1024 * 1024,
            timeout: Number(process.env.PADDLE_OCR_TIMEOUT_MS || 120000),
          },
        )
        const jsonStart = stdout.indexOf('{')
        const payload = JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout)
        return { lines: Array.isArray(payload.lines) ? payload.lines : [] }
      } catch (error) {
        logger.error('paddleocr.failed', { error })
        throw error
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })
  }

  private async resolveRunnerPath() {
    for (const candidate of [compiledRunnerPath, sourceRunnerPath]) {
      try {
        await fs.access(candidate)
        return candidate
      } catch (_error) {
        continue
      }
    }

    throw new Error(`PaddleOCR runner not found. Checked: ${compiledRunnerPath}, ${sourceRunnerPath}`)
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
