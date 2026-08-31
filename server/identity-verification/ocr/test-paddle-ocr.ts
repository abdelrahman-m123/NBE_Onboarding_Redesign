import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { PaddleOcrService } from './paddle-ocr.service.js'

const testImages = {
  front: 'test-ids/image copy 2.png',
  back: 'test-ids/image copy.png',
  guide: 'test-ids/image.png',
  sample: 'test-ids/test-national-id.png',
}

async function readOptional(path: string) {
  try {
    return await fs.readFile(path)
  } catch (_error) {
    return undefined
  }
}

async function main() {
  const service = new PaddleOcrService()
  const front = await readOptional(testImages.front)
  const back = await readOptional(testImages.back)
  const guide = await readOptional(testImages.guide)
  const sample = await readOptional(testImages.sample)

  if (front || back || guide) {
    const result = await service.recognizeNationalIdImages({ front, back, guide })
    assert.deepEqual({
      nationalId: result.extracted?.nationalId,
      dateOfBirth: result.extracted?.dateOfBirth,
      firstNameAr: result.extracted?.firstNameAr,
      middleNameAr: result.extracted?.middleNameAr,
      lastNameAr: result.extracted?.lastNameAr,
      address: result.extracted?.address,
      nationalIdCardPrintedNumber: result.extracted?.nationalIdCardPrintedNumber,
      occupation: result.extracted?.occupation,
      gender: result.extracted?.gender,
      religion: result.extracted?.religion,
      maritalStatus: result.extracted?.maritalStatus,
      nationalIdExpiryDate: result.extracted?.nationalIdExpiryDate,
      nationalIdIssueDate: result.extracted?.nationalIdIssueDate,
      nationalIdIssueMonth: result.extracted?.nationalIdIssueMonth,
    }, {
      nationalId: '30411070107397',
      dateOfBirth: '2004-11-07',
      firstNameAr: 'عبدالرحمن',
      middleNameAr: 'مصطفى محمد حسنين',
      lastNameAr: 'عماد',
      address: 'عمارة ٩ مجموعة ١١٤ مدينتى التجمع الأول القاهرة',
      nationalIdCardPrintedNumber: 'JA3651732',
      occupation: 'طالب',
      gender: 'Male',
      religion: 'مسلم',
      maritalStatus: 'Single',
      nationalIdExpiryDate: '2028-08-27',
      nationalIdIssueDate: '2021-08',
      nationalIdIssueMonth: '2021-08',
    })
    console.log('\n### front/back/guide')
    console.log(JSON.stringify(summarizeResult(result), null, 2))
  }

  if (sample) {
    const result = await service.recognizeNationalId(sample)
    console.log('\n### sample')
    console.log(JSON.stringify(summarizeSide(result), null, 2))
  }
}

function summarizeResult(result: any) {
  return {
    status: result.status,
    confidence: result.confidence,
    method: result.method,
    extracted: result.extracted,
    sides: {
      front: result.sides?.front ? summarizeSide(result.sides.front) : null,
      back: result.sides?.back ? summarizeSide(result.sides.back) : null,
      guide: result.sides?.guide ? summarizeSide(result.sides.guide) : null,
    },
  }
}

function summarizeSide(side: any) {
  return {
    status: side.status,
    confidence: side.confidence,
    method: side.method,
    rotation: side.rotation,
    extracted: side.extracted,
    lineTexts: Array.isArray(side.lines) ? side.lines.slice(0, 12).map((line: any) => line.text) : [],
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
