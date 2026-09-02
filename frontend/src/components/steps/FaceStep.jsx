import { useEffect, useRef, useState } from 'react'
import { Camera, ShieldCheck, X } from 'lucide-react'
import { API_BASE_URL } from '../../config/api'
import { translations } from '../../i18n/translations'
import { templateText } from '../../utils/form'

export function FaceStep({ form, nationalIdFrontFile, onFaceVerificationResult, ensureApplicationId, t }) {
  return (
    <div className="step-body">
      <p className="lead">{t.face.lead}</p>
      <div className="privacy-note">
        <ShieldCheck size={18} />
        <span>{t.face.disclosure}</span>
      </div>
      <FaceVerificationPanel
        nationalIdFrontFile={nationalIdFrontFile}
        result={form.faceVerification}
        onResult={onFaceVerificationResult}
        ensureApplicationId={ensureApplicationId}
        t={t}
      />
    </div>
  )
}

function FaceVerificationPanel({ nationalIdFrontFile, result, onResult, ensureApplicationId, t }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const capturedFramesRef = useRef([])
  const [cameraStatus, setCameraStatus] = useState('idle')
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [capturedCount, setCapturedCount] = useState(0)
  const isCameraOn = cameraStatus === 'camera-ready'
  const isWorking = cameraStatus === 'starting' || cameraStatus === 'capturing' || cameraStatus === 'verifying'

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (!isCameraModalOpen || !streamRef.current || !videoRef.current) return

    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => {
      setCameraStatus('failed')
      setMessage(t.face.previewError)
    })
  }, [isCameraModalOpen, cameraStatus])

  const startCamera = async () => {
    if (!nationalIdFrontFile) {
      setMessage(t.face.uploadFrontFirst)
      return
    }

    try {
      setIsCameraModalOpen(true)
      setCameraStatus('starting')
      setMessage('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      capturedFramesRef.current = []
      setCapturedCount(0)
      setCameraStatus('camera-ready')
    } catch (_error) {
      setIsCameraModalOpen(false)
      setCameraStatus('failed')
      setMessage(t.face.cameraUnavailable)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const closeCamera = () => {
    stopCamera()
    setIsCameraModalOpen(false)
    setCameraStatus('idle')
  }

  const uploadCapturedFrames = async () => {
    const applicationId = await ensureApplicationId?.()
    if (!applicationId || capturedFramesRef.current.length === 0) return

    const documents = new FormData()
    capturedFramesRef.current.forEach((blob, index) => {
      documents.append('selfieImages', blob, `face-capture-${index + 1}.jpg`)
    })

    const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}/documents`, {
      method: 'POST',
      body: documents,
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || t.face.storeError)
    }
  }

  const captureAndVerify = async () => {
    if (!nationalIdFrontFile) {
      setMessage(t.face.uploadFrontFirst)
      return
    }
    if (!videoRef.current || !canvasRef.current) {
      setMessage(t.face.openCameraFirst)
      return
    }

    setCameraStatus('capturing')
    setMessage('')
    capturedFramesRef.current = []
    setCapturedCount(0)

    for (let index = 0; index < 4; index += 1) {
      const blob = await captureFrame(videoRef.current, canvasRef.current, t)
      capturedFramesRef.current.push(blob)
      setCapturedCount(index + 1)
      await delay(450)
    }

    setCameraStatus('verifying')
    try {
      await uploadCapturedFrames()

      const formData = new FormData()
      formData.append('nationalIdFrontImage', nationalIdFrontFile)
      capturedFramesRef.current.forEach((blob, index) => {
        formData.append('selfieImages', blob, `selfie-${index + 1}.jpg`)
      })

      const response = await fetch(`${API_BASE_URL}/api/identity/face/verify`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || t.face.verifyFailed)

      onResult(payload)
      setCameraStatus(payload.status === 'verified' ? 'verified' : 'needs-review')
      setMessage(faceStatusMessage(payload, t))
      stopCamera()
      setIsCameraModalOpen(false)
    } catch (error) {
      setCameraStatus('failed')
      setMessage(error.message || t.face.unavailable)
    }
  }

  return (
    <div className={`face-card ${result?.status === 'verified' ? 'is-verified' : ''}`}>
      <div className="upload-illustration"><Camera size={25} /></div>
      <div className="face-card-main">
        <div className="upload-copy">
          <span className="optional-tag">{t.face.badge}</span>
          <h2>{t.face.title}</h2>
          <p>{t.face.description}</p>
        </div>

        {(message || result) && (
          <div className={`face-result ${result?.status === 'verified' ? 'is-verified' : ''}`}>
            <ShieldCheck size={18} />
            <span>
              {message || faceStatusMessage(result, t)}
              {result?.bestSimilarity !== undefined && ` ${t.face.similarity}: ${result.bestSimilarity}%.`}
            </span>
          </div>
        )}
      </div>

      <div className="face-actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={isWorking}
          onClick={startCamera}
        >
          <Camera size={18} /> {t.face.openCamera}
        </button>
      </div>

      {isCameraModalOpen && (
        <div className="face-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="face-camera-title">
          <div className="face-modal">
            <div className="face-modal-header">
              <div>
                <span className="optional-tag">{t.face.badge}</span>
                <h2 id="face-camera-title">{t.face.cameraTitle}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeCamera} aria-label={t.face.cancel}>
                <X size={18} />
              </button>
            </div>

            <div className="face-camera-frame">
              <video ref={videoRef} muted playsInline />
              <canvas ref={canvasRef} className="visually-hidden" />
              {cameraStatus === 'starting' && <div className="face-camera-status">{t.face.openingCamera}</div>}
            </div>

            <div className="face-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={closeCamera}
                disabled={cameraStatus === 'capturing' || cameraStatus === 'verifying'}
              >
                {t.face.cancel}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!isCameraOn || isWorking}
                onClick={captureAndVerify}
              >
                <Camera size={18} /> {faceActionLabel(cameraStatus, capturedCount, t)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function captureFrame(video, canvas, t) {
  const width = video.videoWidth || 960
  const height = video.videoHeight || 720
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(video, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(t.face.captureError))
    }, 'image/jpeg', 0.92)
  })
}

function faceActionLabel(status, capturedCount, t) {
  if (status === 'starting') return t.face.openingCamera
  if (status === 'capturing') return templateText(t.face.capturing, { count: capturedCount })
  if (status === 'verifying') return t.face.verifying
  if (status === 'camera-ready') return t.face.captureVerify
  return t.face.openCamera
}

export function faceStatusMessage(result, t = translations.en) {
  if (!result) return ''
  if (result.status === 'verified') return t.face.verifiedMessage
  if (result.status === 'manual_review') return t.face.reviewMessage
  return t.face.failedMessage
}

