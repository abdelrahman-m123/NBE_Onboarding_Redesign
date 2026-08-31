import Tesseract from 'tesseract.js'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { logger } from '../../common/logger.js'

const tesseractCachePath = path.join(os.tmpdir(), 'nbe-tesseract-cache')

const egyptianGovernorates = {
  '01': 'Cairo',
  '02': 'Alexandria',
  '03': 'Port Said',
  '04': 'Suez',
  11: 'Damietta',
  12: 'Dakahlia',
  13: 'Sharqia',
  14: 'Qalyubia',
  15: 'Kafr El Sheikh',
  16: 'Gharbia',
  17: 'Monufia',
  18: 'Beheira',
  19: 'Ismailia',
  21: 'Giza',
  22: 'Beni Suef',
  23: 'Faiyum',
  24: 'Minya',
  25: 'Asyut',
  26: 'Sohag',
  27: 'Qena',
  28: 'Aswan',
  29: 'Luxor',
  31: 'Red Sea',
  32: 'New Valley',
  33: 'Matrouh',
  34: 'North Sinai',
  35: 'South Sinai',
  88: 'Born outside Egypt',
}

const arabicLabelPatterns = [
  /جمهورية|العربية|بطاقة|تحقيق|الشخصية|محافظة|الرقم|القومي|ذكر|أنثى|تاريخ|الميلاد/,
]

const printedNumberPattern = /[A-Z]{1,3}\d{6,10}/i

function parseNationalId(nationalId) {
  if (!/^[23]\d{13}$/.test(nationalId)) return null

  const century = nationalId[0] === '2' ? 1900 : 2000
  const year = century + Number(nationalId.slice(1, 3))
  const month = Number(nationalId.slice(3, 5))
  const day = Number(nationalId.slice(5, 7))
  const birthDate = new Date(Date.UTC(year, month - 1, day))

  const isValidDate =
    birthDate.getUTCFullYear() === year &&
    birthDate.getUTCMonth() === month - 1 &&
    birthDate.getUTCDate() === day

  if (!isValidDate) return null

  const governorateCode = nationalId.slice(7, 9)
  if (!egyptianGovernorates[governorateCode]) return null

  return {
    nationalId,
    dateOfBirth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    governorate: egyptianGovernorates[governorateCode],
  }
}

function normalizeDigits(text) {
  return text
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

function normalizeOcrText(text) {
  return normalizeDigits(text)
    .replace(/[OoQ]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[S]/g, '5')
    .replace(/[B]/g, '8')
}

export function extractNationalId(text) {
  const normalizedText = normalizeOcrText(text)
  const digitRuns = normalizedText.match(/\d[\d\s\-./:]{12,}\d/g) || []
  const candidatePools = [
    ...digitRuns.map((run) => run.replace(/\D/g, '')),
    normalizedText.replace(/\D/g, ''),
  ].filter((digits, index, list) => digits.length >= 14 && list.indexOf(digits) === index)

  for (const digits of candidatePools) {
    for (let index = 0; index <= digits.length - 14; index += 1) {
      const parsed = parseNationalId(digits.slice(index, index + 14))
      if (parsed) return parsed
    }
  }

  return null
}

function cleanArabicLine(line) {
  return line
    .replace(/[\u200E\u200F\u202A-\u202E]/g, ' ')
    .replace(/[^\u0600-\u06FF\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyArabicDataLine(line) {
  if (!line || line.length < 3) return false
  if (!/[\u0600-\u06FF]/.test(line)) return false
  return !arabicLabelPatterns.some((pattern) => pattern.test(line))
}

export function extractNameAndAddress(text) {
  const lines = text
    .replace(/[\u200E\u200F\u202A-\u202E]/g, ' ')
    .split(/\r?\n/)
    .map(cleanArabicLine)
    .filter(isLikelyArabicDataLine)

  const name = lines.find((line) => line.split(/\s+/).length >= 2) || null
  const addressStart = lines.findIndex((line) => /بطا|مركز|شارع|حي|قسم|محافظة/.test(line))
  const address = addressStart >= 0
    ? lines.slice(addressStart).join(' ')
    : lines.find((line) => line !== name && /[-\u060C،]|\s/.test(line)) || null

  return { name, address }
}

async function recognizeTextImage(buffer, pageSegMode = '6') {
  return Tesseract.recognize(buffer, 'ara', {
    cachePath: tesseractCachePath,
    tessedit_pageseg_mode: pageSegMode,
  } as any)
}

export function extractPrintedNumber(text) {
  const normalizedText = normalizeOcrText(text).replace(/\s+/g, '')
  return normalizedText.match(printedNumberPattern)?.[0]?.toUpperCase() || null
}

export function extractDateValues(text) {
  const normalizedText = normalizeDigits(text)
  const dates = []
  const patterns = [
    /\b([12]\d{3})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/g,
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-]([12]\d{3})\b/g,
    /([۱۲][۰-۹]{3})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/g,
  ]

  for (const pattern of patterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const first = Number(match[1])
      const year = first > 999 ? first : Number(match[3])
      const month = Number(match[2])
      const day = first > 999 ? Number(match[3]) : Number(match[1])
      const parsed = new Date(Date.UTC(year, month - 1, day))
      if (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      ) {
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      }
    }
  }

  return [...new Set(dates)]
}

async function getTextLineBoxes(buffer) {
  const resized = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 1800 })
    .grayscale()
    .normalize()
    .threshold(105)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = resized
  const visited = new Uint8Array(info.width * info.height)
  const components = []

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const startIndex = y * info.width + x
      if (visited[startIndex] || data[startIndex] > 0) continue

      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let count = 0
      const stack = [[x, y]]
      visited[startIndex] = 1

      while (stack.length) {
        const [currentX, currentY] = stack.pop()
        count += 1
        minX = Math.min(minX, currentX)
        maxX = Math.max(maxX, currentX)
        minY = Math.min(minY, currentY)
        maxY = Math.max(maxY, currentY)

        for (const [deltaX, deltaY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nextX = currentX + deltaX
          const nextY = currentY + deltaY
          if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) continue

          const nextIndex = nextY * info.width + nextX
          if (!visited[nextIndex] && data[nextIndex] === 0) {
            visited[nextIndex] = 1
            stack.push([nextX, nextY])
          }
        }
      }

      const width = maxX - minX + 1
      const height = maxY - minY + 1
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      if (count > 18 && height > 8 && width > 3 && height < 180 && width < 220) {
        components.push({ minX, maxX, minY, maxY, width, height, count, centerX, centerY })
      }
    }
  }

  const rightSideComponents = components.filter((component) => component.centerX > info.width * 0.42)
  const lines = []

  for (const component of rightSideComponents.sort((first, second) => first.centerY - second.centerY)) {
    let line = lines.find((item) => (
      Math.abs(item.centerY - component.centerY) < Math.max(18, (item.height + component.height) / 2)
    ))

    if (!line) {
      line = {
        components: [],
        centerY: component.centerY,
        minX: component.minX,
        maxX: component.maxX,
        minY: component.minY,
        maxY: component.maxY,
        height: component.height,
      }
      lines.push(line)
    }

    line.components.push(component)
    line.centerY = line.components.reduce((sum, item) => sum + item.centerY, 0) / line.components.length
    line.minX = Math.min(line.minX, component.minX)
    line.maxX = Math.max(line.maxX, component.maxX)
    line.minY = Math.min(line.minY, component.minY)
    line.maxY = Math.max(line.maxY, component.maxY)
    line.height = Math.max(line.height, component.height)
  }

  return {
    width: info.width,
    height: info.height,
    lines: lines
      .map((line) => ({
        ...line,
        componentCount: line.components.length,
        width: line.maxX - line.minX + 1,
      }))
      .sort((first, second) => first.centerY - second.centerY),
  }
}

async function createOcrImages(buffer) {
  const image = sharp(buffer, { failOn: 'none' }).rotate()
  const metadata = await image.metadata()
  const width = metadata.width || 1200
  const resizeWidth = Math.max(1600, Math.min(2600, width * 2))

  const normalized = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: resizeWidth, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer()

  const thresholded = await sharp(normalized)
    .threshold(150)
    .png()
    .toBuffer()

  return [normalized, thresholded, buffer]
}

async function createOrientationVariants(buffer, rotations = [270, 0, 90, 180]) {
  return Promise.all(rotations.map(async (rotation) => ({
    rotation,
    buffer: await sharp(buffer, { failOn: 'none' })
      .rotate()
      .rotate(rotation)
      .png()
      .toBuffer(),
  })))
}

function classifyArabicNationalIdGlyph(glyph, medianHeight) {
  const { width, height, left, right, top, bottom, bottomLeft } = glyph
  const leftRightRatio = left / Math.max(right, 1)
  const topBottomRatio = top / Math.max(bottom, 1)
  const bottomLeftRatio = bottomLeft / Math.max(bottom, 1)

  if (height < medianHeight * 0.58) return '0'
  if (width <= 31 && leftRightRatio < 0.78 && bottomLeftRatio < 0.28) return '1'
  if (width <= 38 && topBottomRatio < 1.1) return '4'
  if (width <= 46 && leftRightRatio < 0.82 && bottomLeftRatio < 0.32) return '9'
  if (topBottomRatio > 2.35 && bottomLeftRatio > 0.78) return '3'
  return '7'
}

function getArabicNationalIdGlyphAlternatives(glyph, medianHeight) {
  const primary = classifyArabicNationalIdGlyph(glyph, medianHeight)
  if (primary === '0') return ['0']
  if (primary === '1') return ['1']
  if (primary === '4') return ['4']
  if (primary === '9') return ['9', '7', '3']
  if (primary === '3') return ['3', '7']
  return ['7', '3', '9']
}

function findParseableNationalIdFromAlternatives(alternatives) {
  const candidates = ['']
  for (const options of alternatives) {
    const currentLength = candidates.length
    for (let index = 0; index < currentLength; index += 1) {
      const prefix = candidates.shift()
      for (const option of options) {
        const next = `${prefix}${option}`
        if (next.length === 1 && !['2', '3'].includes(next)) continue
        candidates.push(next)
      }
    }
    if (candidates.length > 5000) candidates.splice(5000)
  }

  for (const candidate of candidates) {
    const parsed = parseNationalId(candidate)
    if (parsed) return parsed
  }

  return null
}

function splitWideGlyph(component, data, info) {
  if (component.width < 70 || component.height > 70) return [component]

  const splitX = Math.round((component.minX + component.maxX) / 2)
  const halves = [
    { minX: component.minX, maxX: splitX },
    { minX: splitX + 1, maxX: component.maxX },
  ]

  return halves.map((half) => {
    let minX = Number.POSITIVE_INFINITY
    let maxX = 0
    let minY = Number.POSITIVE_INFINITY
    let maxY = 0
    let count = 0

    for (let y = component.minY; y <= component.maxY; y += 1) {
      for (let x = half.minX; x <= half.maxX; x += 1) {
        if (data[y * info.width + x] !== 0) continue
        count += 1
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }

    if (!count) return null
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      count,
    }
  }).filter(Boolean)
}

function findLikelyDigitLine(components, info) {
  const expanded = components.flatMap((component) => component.splitItems || [component])
  const candidates = expanded
    .filter((component) => component.height > 18 && component.width > 8)
    .filter((component) => {
      const centerY = (component.minY + component.maxY) / 2
      return component.minX > info.width * 0.35 && centerY > info.height * 0.3 && centerY < info.height * 0.7
    })
    .sort((first, second) => ((first.minY + first.maxY) / 2) - ((second.minY + second.maxY) / 2))

  const rows = []
  for (const component of candidates) {
    const centerY = (component.minY + component.maxY) / 2
    let row = rows.find((item) => Math.abs(item.centerY - centerY) < 45)
    if (!row) {
      row = { centerY, components: [] }
      rows.push(row)
    }
    row.components.push(component)
    row.centerY = row.components.reduce((sum, item) => sum + ((item.minY + item.maxY) / 2), 0) / row.components.length
  }

  const row = rows
    .map((item) => ({
      ...item,
      components: item.components.sort((first, second) => first.minX - second.minX),
      span: Math.max(...item.components.map((component) => component.maxX)) - Math.min(...item.components.map((component) => component.minX)),
    }))
    .filter((item) => item.components.length >= 12 && item.span > 450)
    .sort((first, second) => {
      if (first.components.length !== second.components.length) return second.components.length - first.components.length
      return second.centerY - first.centerY
    })[0]

  if (!row) return null
  if (row.components.length === 14) return row.components

  for (let start = 0; start <= row.components.length - 14; start += 1) {
    const window = row.components.slice(start, start + 14)
    const span = window[window.length - 1].maxX - window[0].minX
    if (span > 450) return window
  }

  return row.components.slice(0, 14)
}

async function extractSegmentedNationalId(buffer) {
  const cropConfigs = [
    { left: 0.38, top: 0.62, width: 0.58, height: 0.24 },
    { left: 0.28, top: 0.58, width: 0.68, height: 0.3 },
    { left: 0.2, top: 0.55, width: 0.76, height: 0.35 },
  ]
  const metadata = await sharp(buffer, { failOn: 'none' }).metadata()
  const sourceWidth = metadata.width || 1200
  const sourceHeight = metadata.height || 800

  for (const config of cropConfigs) {
    const crop = await sharp(buffer, { failOn: 'none' })
      .extract({
        left: Math.max(0, Math.floor(sourceWidth * config.left)),
        top: Math.max(0, Math.floor(sourceHeight * config.top)),
        width: Math.min(sourceWidth, Math.floor(sourceWidth * config.width)),
        height: Math.min(sourceHeight, Math.floor(sourceHeight * config.height)),
      })
      .resize({ width: 1600 })
      .grayscale()
      .normalize()
      .threshold(120)
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { data, info } = crop
    const visited = new Uint8Array(info.width * info.height)
    const components = []

    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const startIndex = y * info.width + x
        if (visited[startIndex] || data[startIndex] > 0) continue

        let minX = x
        let maxX = x
        let minY = y
        let maxY = y
        let count = 0
        const stack = [[x, y]]
        visited[startIndex] = 1

        while (stack.length) {
          const [currentX, currentY] = stack.pop()
          count += 1
          minX = Math.min(minX, currentX)
          maxX = Math.max(maxX, currentX)
          minY = Math.min(minY, currentY)
          maxY = Math.max(maxY, currentY)

          for (const [deltaX, deltaY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nextX = currentX + deltaX
            const nextY = currentY + deltaY
            if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) continue

            const nextIndex = nextY * info.width + nextX
            if (!visited[nextIndex] && data[nextIndex] === 0) {
              visited[nextIndex] = 1
              stack.push([nextX, nextY])
            }
          }
        }

        const width = maxX - minX + 1
        const height = maxY - minY + 1
        if (count > 30 && height > 15 && width > 5 && height < 90 && width < 90) {
          components.push({ minX, maxX, minY, maxY, width, height, count })
        }
      }
    }

    const lineComponents = components
      .map((component) => ({
        ...component,
        splitItems: splitWideGlyph(component, data, info),
      }))
      .filter((component) => component.minY < info.height * 0.7)

    const likelyDigitLine = findLikelyDigitLine(lineComponents, info)
    const windows = likelyDigitLine ? [likelyDigitLine] : []

    for (const glyphs of windows) {
      const medianHeight = [...glyphs].sort((first, second) => first.height - second.height)[7].height
      const alternatives = glyphs.map((glyph) => {
        let left = 0
        let right = 0
        let top = 0
        let bottom = 0
        let bottomLeft = 0
        const midX = (glyph.minX + glyph.maxX) / 2
        const midY = (glyph.minY + glyph.maxY) / 2

        for (let y = glyph.minY; y <= glyph.maxY; y += 1) {
          for (let x = glyph.minX; x <= glyph.maxX; x += 1) {
            if (data[y * info.width + x] !== 0) continue
            if (x < midX) left += 1
            else right += 1
            if (y < midY) top += 1
            else bottom += 1
            if (x < midX && y >= midY) bottomLeft += 1
          }
        }

        return getArabicNationalIdGlyphAlternatives({
          width: glyph.width,
          height: glyph.height,
          left,
          right,
          top,
          bottom,
          bottomLeft,
        }, medianHeight)
      })

      const parsed = findParseableNationalIdFromAlternatives(alternatives)
      if (parsed) return parsed
    }
  }

  return null
}

async function extractDigitLineFallback(buffer) {
  const layout = await getTextLineBoxes(buffer)
  const digitLine = [...layout.lines]
    .reverse()
    .find((line) => line.componentCount >= 12 && line.componentCount <= 18 && line.width > layout.width * 0.18)

  if (!digitLine) return null

  const resizedImage = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: layout.width })
    .png()
    .toBuffer()

  const padX = Math.max(28, Math.round(digitLine.height * 0.7))
  const padY = Math.max(18, Math.round(digitLine.height * 0.7))
  const left = Math.max(0, digitLine.minX - padX)
  const top = Math.max(0, digitLine.minY - padY)
  const right = Math.min(layout.width - 1, digitLine.maxX + padX)
  const bottom = Math.min(layout.height - 1, digitLine.maxY + padY)

  const crop = await sharp(resizedImage)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width: 1800 })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(100)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = crop
  const visited = new Uint8Array(info.width * info.height)
  const components = []

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const startIndex = y * info.width + x
      if (visited[startIndex] || data[startIndex] > 0) continue

      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let count = 0
      const stack = [[x, y]]
      visited[startIndex] = 1

      while (stack.length) {
        const [currentX, currentY] = stack.pop()
        count += 1
        minX = Math.min(minX, currentX)
        maxX = Math.max(maxX, currentX)
        minY = Math.min(minY, currentY)
        maxY = Math.max(maxY, currentY)

        for (const [deltaX, deltaY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nextX = currentX + deltaX
          const nextY = currentY + deltaY
          if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) continue

          const nextIndex = nextY * info.width + nextX
          if (!visited[nextIndex] && data[nextIndex] === 0) {
            visited[nextIndex] = 1
            stack.push([nextX, nextY])
          }
        }
      }

      const width = maxX - minX + 1
      const height = maxY - minY + 1
      if (count > 20 && height > 20) {
        components.push({ minX, maxX, minY, maxY, width, height, count })
      }
    }
  }

  const glyphs = components.sort((first, second) => first.minX - second.minX)
  if (glyphs.length !== 14) return null

  const medianWidth = [...glyphs].sort((first, second) => first.width - second.width)[7].width
  const medianHeight = [...glyphs].sort((first, second) => first.height - second.height)[7].height

  const digits = glyphs.map((glyph) => {
    let left = 0
    let right = 0
    let top = 0
    let bottom = 0
    let bottomLeft = 0
    const midX = (glyph.minX + glyph.maxX) / 2
    const midY = (glyph.minY + glyph.maxY) / 2

    for (let y = glyph.minY; y <= glyph.maxY; y += 1) {
      for (let x = glyph.minX; x <= glyph.maxX; x += 1) {
        if (data[y * info.width + x] !== 0) continue
        if (x < midX) left += 1
        else right += 1
        if (y < midY) top += 1
        else bottom += 1
        if (x < midX && y >= midY) bottomLeft += 1
      }
    }

    const leftRightRatio = left / Math.max(right, 1)
    const topBottomRatio = top / Math.max(bottom, 1)
    const bottomLeftRatio = bottomLeft / Math.max(glyph.count, 1)

    if (glyph.height < medianHeight * 0.55) return '0'
    if (glyph.width < medianWidth * 0.82) return '1'
    if (glyph.width > medianWidth * 1.45) return '8'
    if (topBottomRatio > 2.15) return '2'
    if (leftRightRatio < 0.65 && bottomLeftRatio < 0.02) return '6'
    if (leftRightRatio < 0.85 && topBottomRatio > 1.55) return '9'
    return '4'
  }).join('')

  return parseNationalId(digits)
}

async function extractTextFieldsFromCard(buffer) {
  try {
    const layout = await getTextLineBoxes(buffer)
    const digitLine = [...layout.lines]
      .reverse()
      .find((line) => line.componentCount >= 12 && line.componentCount <= 18 && line.width > layout.width * 0.18)

    const candidateLines = layout.lines
      .filter((line) => !digitLine || line.centerY < digitLine.centerY)
      .filter((line) => line.centerY > layout.height * 0.38)
      .filter((line) => line.width > 45)
      .filter((line) => line.componentCount <= 20)
      .sort((first, second) => first.centerY - second.centerY)

    const resizedImage = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: layout.width })
      .png()
      .toBuffer()

    const readLine = async (line) => {
      const padX = Math.max(24, Math.round(line.height * 1.1))
      const padY = Math.max(18, Math.round(line.height * 0.7))
      const left = Math.max(0, line.minX - padX)
      const top = Math.max(0, line.minY - padY)
      const right = Math.min(layout.width - 1, line.maxX + padX)
      const bottom = Math.min(layout.height - 1, line.maxY + padY)

      const lineImage = await sharp(resizedImage)
        .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
        .resize({ width: Math.max(900, Math.min(1800, (right - left + 1) * 3)) })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer()

      const result = await recognizeTextImage(lineImage, '7')
      const text = cleanArabicLine(result.data.text)
      if (isLikelyArabicDataLine(text) && !/^\d+$/.test(normalizeDigits(result.data.text).replace(/\D/g, ''))) {
        return text
      }

      return null
    }

    const recognizedLineItems = []
    for (const line of candidateLines) {
      const text = await readLine(line)
      if (text) recognizedLineItems.push({ line, text })
    }

    const recognizedLines = recognizedLineItems.map((item) => item.text)
    const uniqueLines = recognizedLines
      .filter((line, index, lines) => lines.indexOf(line) === index)
      .filter((line) => line.length > 2)
    const name = uniqueLines.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim() || null
    const addressSourceLines = candidateLines.slice(2)
    let address = null

    if (addressSourceLines.length) {
      const pad = 28
      const left = Math.max(0, Math.min(...addressSourceLines.map((line) => line.minX)) - pad)
      const top = Math.max(0, Math.min(...addressSourceLines.map((line) => line.minY)) - pad)
      const right = Math.min(layout.width - 1, Math.max(...addressSourceLines.map((line) => line.maxX)) + pad)
      const bottom = Math.min(layout.height - 1, Math.max(...addressSourceLines.map((line) => line.maxY)) + pad)
      const addressImage = await sharp(resizedImage)
        .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
        .resize({ width: Math.max(1200, Math.min(2200, (right - left + 1) * 3)) })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer()

      const addressResult = await recognizeTextImage(addressImage, '6')
      const addressLines = addressResult.data.text
        .split(/\r?\n/)
        .map(cleanArabicLine)
        .filter(isLikelyArabicDataLine)

      address = addressLines.join(' ').replace(/\s+/g, ' ').trim() || null
    }

    if (!address) {
      const addressLines = uniqueLines.slice(2)
      address = (addressLines.find((line) => /مركز|محافظة|القليوبية|شارع|حي|قسم/.test(line)) || addressLines.join(' '))
        .replace(/\s+/g, ' ')
        .trim() || null
    }

    return {
      name,
      address,
    }
  } catch (_error) {
    return { name: null, address: null }
  }
}

async function recognizeImage(buffer, languages) {
  return Tesseract.recognize(buffer, languages, {
    cachePath: tesseractCachePath,
    tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ -./:',
    tessedit_pageseg_mode: '11',
  } as any)
}

function mergeExtractedFields(items) {
  return items.reduce((merged, item) => {
    if (!item) return merged
    for (const [key, value] of Object.entries(item)) {
      if (value !== null && value !== undefined && value !== '' && !merged[key]) {
        merged[key] = value
      }
    }
    return merged
  }, {})
}

export function extractNationalIdFieldsFromText(text) {
  const extracted = extractNationalId(text)
  const printedNumber = extractPrintedNumber(text)
  const dates = extractDateValues(text)
  const textFields = extractNameAndAddress(text)

  return mergeExtractedFields([extracted, {
    nationalIdCardPrintedNumber: printedNumber,
    nationalIdIssueDate: dates[0],
    nationalIdExpiryDate: dates[1],
    name: textFields.name,
    address: textFields.address,
  }])
}

async function recognizeNationalIdSide(buffer, side = 'unknown') {
  const rotations = side === 'back' || side === 'guide'
    ? [0, 270]
    : side === 'front'
      ? [270, 0]
      : [270, 0, 90, 180]
  const variants = await createOrientationVariants(buffer, rotations)
  const sideResults = []

  for (const variant of variants) {
    const segmentedNationalId = await extractSegmentedNationalId(variant.buffer)
    if (segmentedNationalId) {
      sideResults.push({
        status: 'completed',
        confidence: 82,
        extracted: segmentedNationalId,
        method: 'segmented-digit-line',
        rotation: variant.rotation,
      })
      break
    }

    const result = await recognizeNationalId(variant.buffer, {
      allowLowConfidenceTextId: side === 'front',
      skipOrientationVariants: true,
    })
    sideResults.push({
      ...result,
      rotation: variant.rotation,
    })
  }

  return sideResults.sort((first, second) => {
    const firstHasId = first.extracted?.nationalId ? 1 : 0
    const secondHasId = second.extracted?.nationalId ? 1 : 0
    if (firstHasId !== secondHasId) return secondHasId - firstHasId
    return second.confidence - first.confidence
  })[0]
}

interface RecognizeNationalIdOptions {
  allowLowConfidenceTextId?: boolean
  skipOrientationVariants?: boolean
}

export async function recognizeNationalId(buffer, options: RecognizeNationalIdOptions = {}) {
  if (!options.skipOrientationVariants) {
    return recognizeNationalIdSide(buffer)
  }

  const images = await createOcrImages(buffer)
  const attempts = []
  let bestText = ''
  let bestConfidence = 0
  let bestExtractedText = null

  for (const [index, image] of images.entries()) {
    let result

    try {
      result = await recognizeImage(image, 'eng+ara')
    } catch (_error) {
      logger.warn('ocr.language_fallback', { imageIndex: index, from: 'eng+ara', to: 'eng' })
      result = await recognizeImage(image, 'eng')
    }

    const extracted = extractNationalId(result.data.text)
    const printedNumber = extractPrintedNumber(result.data.text)
    const dates = extractDateValues(result.data.text)
    const confidence = Math.round(result.data.confidence)
    if (confidence > bestConfidence) {
      bestConfidence = confidence
      bestText = result.data.text
    }
    bestExtractedText = mergeExtractedFields([bestExtractedText, {
      nationalIdCardPrintedNumber: printedNumber,
      nationalIdIssueDate: dates[0],
      nationalIdExpiryDate: dates[1],
    }])
    attempts.push({
      confidence,
      extracted,
    })

    logger.debug('ocr.attempt_finished', {
      imageIndex: index,
      confidence,
      extracted: Boolean(extracted),
    })

    if (extracted && (confidence >= 55 || options.allowLowConfidenceTextId)) {
      const cardTextFields = await extractTextFieldsFromCard(buffer)
      const textFields = {
        name: cardTextFields.name || extractNameAndAddress(result.data.text).name,
        address: cardTextFields.address || extractNameAndAddress(result.data.text).address,
      }
      return {
        status: 'completed',
        confidence,
        extracted: {
          ...extracted,
          ...textFields,
          ...bestExtractedText,
        },
      }
    }
  }

  const digitLineExtracted = await extractDigitLineFallback(buffer)
  if (digitLineExtracted) {
    const cardTextFields = await extractTextFieldsFromCard(buffer)
    const bestTextFields = extractNameAndAddress(bestText)
    const textFields = {
      name: cardTextFields.name || bestTextFields.name,
      address: cardTextFields.address || bestTextFields.address,
    }
    return {
      status: 'completed',
      confidence: 70,
      extracted: {
        ...digitLineExtracted,
        ...textFields,
        ...bestExtractedText,
      },
      method: 'digit-line-fallback',
    }
  }

  const bestAttempt = attempts.sort((first, second) => second.confidence - first.confidence)[0]

  return {
    status: 'partial',
    confidence: bestAttempt?.confidence || 0,
    extracted: Object.keys(bestExtractedText || {}).length ? bestExtractedText : null,
  }
}

export async function recognizeNationalIdImages(images) {
  const [front, back, guide] = await Promise.all([
    images.front ? recognizeNationalIdSide(images.front, 'front') : null,
    images.back ? recognizeNationalIdSide(images.back, 'back') : null,
    images.guide ? recognizeNationalIdSide(images.guide, 'guide') : null,
  ])

  const extracted = mergeExtractedFields([
    front?.extracted,
    back?.extracted,
    guide?.extracted,
  ])
  const confidenceValues = [front, back, guide]
    .filter(Boolean)
    .map((item) => item.confidence || 0)
  const confidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, item) => sum + item, 0) / confidenceValues.length)
    : 0

  return {
    status: extracted.nationalId ? 'completed' : 'partial',
    confidence,
    extracted: Object.keys(extracted).length ? extracted : null,
    method: 'multi-image-side-aware',
    sides: {
      front,
      back,
      guide,
    },
  }
}

export const testOnly = {
  extractNationalId,
  normalizeDigits,
  parseNationalId,
  extractNameAndAddress,
  getTextLineBoxes,
  extractPrintedNumber,
  extractDateValues,
  extractSegmentedNationalId,
}
