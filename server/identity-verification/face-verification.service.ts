import { performance } from 'node:perf_hooks'
import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  DetectFacesCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
  type DetectFacesCommandOutput,
  type FaceDetail,
} from '@aws-sdk/client-rekognition'
import { logger } from '../common/logger.js'

type FaceVerificationStatus = 'verified' | 'manual_review' | 'failed'

interface VerifyFaceInput {
  nationalIdFrontImage?: Express.Multer.File
  selfieImages: Express.Multer.File[]
  livenessSessionId?: string
}

const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
const livenessThreshold = Number(process.env.FACE_LIVENESS_THRESHOLD || 90)
const matchThreshold = Number(process.env.FACE_MATCH_THRESHOLD || 85)
const manualReviewThreshold = Number(process.env.FACE_MANUAL_REVIEW_THRESHOLD || 70)
const minFaceQuality = Number(process.env.FACE_MIN_QUALITY || 35)

@Injectable()
export class FaceVerificationService {
  private readonly rekognition = new RekognitionClient({ region: awsRegion })

  async createLivenessSession(requestId?: string) {
    const startedAt = performance.now()
    try {
      this.assertAwsCredentialsConfigured()
      const response = await this.rekognition.send(new CreateFaceLivenessSessionCommand({}))
      logger.info('face.liveness_session_created', {
        requestId,
        sessionId: response.SessionId,
        durationMs: Math.round(performance.now() - startedAt),
      })
      return {
        sessionId: response.SessionId,
        region: awsRegion,
        livenessThreshold,
        matchThreshold,
      }
    } catch (error) {
      logger.error('face.liveness_session_failed', { requestId, error })
      throw new HttpException({
        message: 'Face liveness is not available. Check AWS credentials and region.',
      }, HttpStatus.BAD_GATEWAY)
    }
  }

  async verifyFace(input: VerifyFaceInput, requestId?: string) {
    if (!input.nationalIdFrontImage) {
      throw new HttpException({ message: 'Upload the front image of the National ID.' }, HttpStatus.BAD_REQUEST)
    }
    if (!input.selfieImages.length && !input.livenessSessionId) {
      throw new HttpException({ message: 'Capture at least one selfie frame or provide a liveness session.' }, HttpStatus.BAD_REQUEST)
    }

    const startedAt = performance.now()
    try {
      const liveness = input.livenessSessionId ? await this.getLivenessReference(input.livenessSessionId) : null
      const selfieBuffers = [
        ...(liveness?.referenceImage ? [{ label: 'liveness-reference', buffer: liveness.referenceImage }] : []),
        ...input.selfieImages.map((file, index) => ({ label: `selfie-${index + 1}`, buffer: file.buffer })),
      ]

      const comparisons = []
      for (const selfie of selfieBuffers) {
        const quality = await this.detectPrimaryFace(selfie.buffer)
        if (!quality.hasUsableFace) {
          comparisons.push({
            frame: selfie.label,
            status: 'rejected',
            reason: quality.reason,
            faceConfidence: quality.faceConfidence,
            brightness: quality.brightness,
            sharpness: quality.sharpness,
          })
          continue
        }

        const compare = await this.rekognition.send(new CompareFacesCommand({
          SourceImage: { Bytes: selfie.buffer },
          TargetImage: { Bytes: input.nationalIdFrontImage.buffer },
          SimilarityThreshold: manualReviewThreshold,
          QualityFilter: 'AUTO',
        }))
        const bestMatch = [...(compare.FaceMatches || [])].sort((first, second) =>
          Number(second.Similarity || 0) - Number(first.Similarity || 0),
        )[0]

        comparisons.push({
          frame: selfie.label,
          status: bestMatch ? 'compared' : 'no_match',
          similarity: Math.round(Number(bestMatch?.Similarity || 0) * 10) / 10,
          faceConfidence: quality.faceConfidence,
          brightness: quality.brightness,
          sharpness: quality.sharpness,
        })
      }

      const bestComparison = comparisons
        .filter((item) => item.status === 'compared')
        .sort((first, second) => Number(second.similarity || 0) - Number(first.similarity || 0))[0]
      const bestSimilarity = Number(bestComparison?.similarity || 0)
      const hasLiveFace = liveness ? liveness.status === 'SUCCEEDED' && liveness.confidence >= livenessThreshold : true
      const status = this.decideStatus(bestSimilarity, hasLiveFace)

      logger.info('face.verification_finished', {
        requestId,
        status,
        bestSimilarity,
        livenessStatus: liveness?.status,
        livenessConfidence: liveness?.confidence,
        durationMs: Math.round(performance.now() - startedAt),
      })

      return {
        status,
        bestSimilarity,
        matchThreshold,
        manualReviewThreshold,
        liveness: liveness ? {
          status: liveness.status,
          confidence: liveness.confidence,
          threshold: livenessThreshold,
        } : null,
        comparisons,
      }
    } catch (error) {
      logger.error('face.verification_failed', {
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        error,
      })
      throw new HttpException({
        message: 'Face verification is unavailable. Check AWS credentials, region, and image quality.',
      }, HttpStatus.UNPROCESSABLE_ENTITY)
    }
  }

  private async getLivenessReference(sessionId: string) {
    this.assertAwsCredentialsConfigured()
    const result = await this.rekognition.send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }))
    return {
      status: result.Status,
      confidence: Math.round(Number(result.Confidence || 0) * 10) / 10,
      referenceImage: result.ReferenceImage?.Bytes ? Buffer.from(result.ReferenceImage.Bytes) : null,
    }
  }

  private async detectPrimaryFace(buffer: Buffer) {
    this.assertAwsCredentialsConfigured()
    const result: DetectFacesCommandOutput = await this.rekognition.send(new DetectFacesCommand({
      Image: { Bytes: buffer },
      Attributes: ['ALL'],
    }))
    const face = this.primaryFace(result.FaceDetails || [])
    if (!face) return { hasUsableFace: false, reason: 'No face detected.' }

    const faceConfidence = Math.round(Number(face.Confidence || 0) * 10) / 10
    const brightness = Math.round(Number(face.Quality?.Brightness || 0) * 10) / 10
    const sharpness = Math.round(Number(face.Quality?.Sharpness || 0) * 10) / 10
    const pose = face.Pose || {}
    const poseOk = Math.abs(Number(pose.Yaw || 0)) <= 35 && Math.abs(Number(pose.Pitch || 0)) <= 35 && Math.abs(Number(pose.Roll || 0)) <= 35
    const qualityOk = brightness >= minFaceQuality && sharpness >= minFaceQuality

    if (!qualityOk) return { hasUsableFace: false, reason: 'Face image is too dark or blurry.', faceConfidence, brightness, sharpness }
    if (!poseOk) return { hasUsableFace: false, reason: 'Face is turned too far from the camera.', faceConfidence, brightness, sharpness }
    return { hasUsableFace: true, faceConfidence, brightness, sharpness }
  }

  private primaryFace(faces: FaceDetail[]) {
    return [...faces].sort((first, second) => {
      const firstBox = first.BoundingBox
      const secondBox = second.BoundingBox
      const firstArea = Number(firstBox?.Width || 0) * Number(firstBox?.Height || 0)
      const secondArea = Number(secondBox?.Width || 0) * Number(secondBox?.Height || 0)
      return secondArea - firstArea
    })[0]
  }

  private decideStatus(similarity: number, hasLiveFace: boolean): FaceVerificationStatus {
    if (!hasLiveFace) return 'failed'
    if (similarity >= matchThreshold) return 'verified'
    if (similarity >= manualReviewThreshold) return 'manual_review'
    return 'failed'
  }

  private assertAwsCredentialsConfigured() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) return

    throw new HttpException({
      message: 'AWS Rekognition credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env or server/.env.',
    }, HttpStatus.SERVICE_UNAVAILABLE)
  }
}
