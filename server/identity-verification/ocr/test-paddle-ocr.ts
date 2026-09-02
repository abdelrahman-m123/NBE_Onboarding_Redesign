import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PaddleOcrService } from './paddle-ocr.service.js'

const testImages = {
  front: process.env.OCR_TEST_FRONT,
  back: process.env.OCR_TEST_BACK,
  guide: process.env.OCR_TEST_GUIDE,
  sample: process.env.OCR_TEST_SAMPLE,
}

async function readOptional(filePath?: string) {
  if (!filePath) return undefined

  try {
    return await fs.readFile(filePath)
  } catch (_error) {
    throw new Error(`Could not read the OCR fixture configured at ${filePath}.`)
  }
}

function assertSafeOcrResult(result: any) {
  assert.ok(['completed', 'partial'].includes(result.status), 'OCR returned an unexpected status.')

  const nationalId = result.extracted?.nationalId
  if (nationalId !== undefined) {
    assert.match(String(nationalId), /^[23]\d{13}$/, 'OCR returned an invalid Egyptian National ID shape.')
  }
}

function summarizeSide(side: any) {
  return {
    status: side.status,
    confidence: side.confidence,
    method: side.method,
    rotation: side.rotation,
    extractedFields: Object.keys(side.extracted || {}),
    recognizedLineCount: Array.isArray(side.lines) ? side.lines.length : 0,
  }
}

function summarizeResult(result: any) {
  return {
    status: result.status,
    confidence: result.confidence,
    method: result.method,
    extractedFields: Object.keys(result.extracted || {}),
    sides: {
      front: result.sides?.front ? summarizeSide(result.sides.front) : null,
      back: result.sides?.back ? summarizeSide(result.sides.back) : null,
      guide: result.sides?.guide ? summarizeSide(result.sides.guide) : null,
    },
  }
}

async function main() {
  const service = new PaddleOcrService()
  const front = await readOptional(testImages.front)
  const back = await readOptional(testImages.back)
  const guide = await readOptional(testImages.guide)
  const sample = await readOptional(testImages.sample)

  if (!front && !back && !guide && !sample) {
    throw new Error(
      'Configure private OCR fixtures with OCR_TEST_FRONT, OCR_TEST_BACK, OCR_TEST_GUIDE, or OCR_TEST_SAMPLE.',
    )
  }

  if (front || back || guide) {
    const result = await service.recognizeNationalIdImages({ front, back, guide })
    assertSafeOcrResult(result)
    console.log('\n### front/back/guide')
    console.log(JSON.stringify(summarizeResult(result), null, 2))
  }

  if (sample) {
    const result = await service.recognizeNationalId(sample)
    assertSafeOcrResult(result)
    console.log('\n### sample')
    console.log(JSON.stringify(summarizeSide(result), null, 2))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
