import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock3, FileText, Info, Upload, UserRound, X } from 'lucide-react'
import { API_BASE_URL } from '../../config/api'
import { additionalIdentityFields, governorateOptions } from '../../config/onboarding'
import { templateText } from '../../utils/form'
import { CheckboxField, Field, FieldGrid, FormSection, SelectField } from '../forms/FormControls'

export function IdentityStep({ form, errors, update, ocrFiles, setOcrFiles, ocrResult, onOcrResult, t }) {
  const language = document.documentElement.lang || 'en'
  const frontInputRef = useRef(null)
  const backInputRef = useRef(null)
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrError, setOcrError] = useState('')
  const [ocrLatencyMs, setOcrLatencyMs] = useState(null)
  const [ocrElapsedMs, setOcrElapsedMs] = useState(0)
  const [showReport, setShowReport] = useState(false)
  const [benchmarkMode, setBenchmarkMode] = useState(false)
  const ocrStartedAtRef = useRef(null)
  const isOcrScanning = ocrStatus === 'scanning'
  const canScanNationalId = Boolean(ocrFiles.front && ocrFiles.back) && !isOcrScanning
  const displayedLatencyMs = isOcrScanning ? ocrElapsedMs : ocrLatencyMs

  useEffect(() => {
    if (!isOcrScanning) return undefined

    const interval = window.setInterval(() => {
      if (!ocrStartedAtRef.current) return
      setOcrElapsedMs(Math.round(performance.now() - ocrStartedAtRef.current))
    }, 250)

    return () => window.clearInterval(interval)
  }, [isOcrScanning])

  const selectOcrFile = (side, event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setOcrFiles((current) => ({ ...current, [side]: file }))
    if (side === 'front') update('faceVerification', null)
    setOcrError('')
    setOcrStatus('idle')
    setOcrLatencyMs(null)
    setOcrElapsedMs(0)
    event.target.value = ''
  }

  const removeOcrFile = (side) => {
    setOcrFiles((current) => ({ ...current, [side]: null }))
    if (side === 'front') update('faceVerification', null)
    setOcrStatus('idle')
    setOcrLatencyMs(null)
    setOcrElapsedMs(0)
  }

  const scanNationalId = async () => {
    if (!ocrFiles.front || !ocrFiles.back) {
      setOcrStatus('needs-review')
      setOcrError(t.identity.uploadBoth)
      return
    }

    setOcrStatus('scanning')
    setOcrError('')
    setOcrLatencyMs(null)
    setOcrElapsedMs(0)
    ocrStartedAtRef.current = performance.now()

    const formData = new FormData()
    formData.append('frontImage', ocrFiles.front)
    formData.append('backImage', ocrFiles.back)

    try {
      // Add device parameter for benchmark mode
      const url = benchmarkMode 
        ? `${API_BASE_URL}/api/identity/ocr/full?device=both`
        : `${API_BASE_URL}/api/identity/ocr/full`
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      const finishedLatencyMs = Math.round(performance.now() - ocrStartedAtRef.current)
      setOcrLatencyMs(finishedLatencyMs)
      setOcrElapsedMs(finishedLatencyMs)

      if (!response.ok) {
        throw new Error(payload.message || t.identity.scanFallbackError)
      }

      // Handle dual mode results
      if (benchmarkMode && payload.mode === 'dual') {
        // Use GPU result if available, otherwise CPU result
        const primaryResult = payload.gpuResult || payload.cpuResult
        if (primaryResult) {
          onOcrResult({
            ...primaryResult,
            mode: payload.mode,
            cpuResult: payload.cpuResult,
            gpuResult: payload.gpuResult,
            durationMs: payload.durationMs,
          })
          setOcrStatus(primaryResult.extracted?.nationalId ? 'complete' : 'needs-review')
          if (!primaryResult.extracted?.nationalId) {
            setOcrError(t.identity.scanError)
          }
        } else {
          setOcrStatus('failed')
          setOcrError('Both CPU and GPU processing failed')
        }
      } else {
        onOcrResult(payload)
        setOcrStatus(payload.extracted?.nationalId ? 'complete' : 'needs-review')
        if (!payload.extracted?.nationalId) {
          setOcrError(t.identity.scanError)
        }
      }
    } catch (error) {
      if (ocrStartedAtRef.current) {
        const failedLatencyMs = Math.round(performance.now() - ocrStartedAtRef.current)
        setOcrLatencyMs(failedLatencyMs)
        setOcrElapsedMs(failedLatencyMs)
      }
      setOcrStatus('failed')
      setOcrError(error.message || t.identity.ocrUnavailable)
    } finally {
      ocrStartedAtRef.current = null
    }
  }

  return (
    <div className="step-body">
      <div className="upload-card">
        <div className="upload-illustration"><UserRound size={26} /></div>
        <div className="upload-copy">
          <span className="optional-tag">{t.identity.scanRecommended}</span>
          <h2>{t.identity.scanTitle}</h2>
          <p>{t.identity.scanDescription}</p>
        </div>
        <div className="ocr-upload-actions">
          <OcrImagePicker
            label={t.identity.frontImage}
            file={ocrFiles.front}
            inputRef={frontInputRef}
            onSelect={(event) => selectOcrFile('front', event)}
            onRemove={() => removeOcrFile('front')}
            t={t}
          />
          <OcrImagePicker
            label={t.identity.backImage}
            file={ocrFiles.back}
            inputRef={backInputRef}
            onSelect={(event) => selectOcrFile('back', event)}
            onRemove={() => removeOcrFile('back')}
            t={t}
          />
          <button
            type="button"
            className="button button-secondary"
            disabled={!canScanNationalId}
            onClick={scanNationalId}
          >
            <Upload size={18} /> {ocrStatus === 'scanning' ? t.identity.scanning : t.identity.scanButton}
          </button>
          <button
            type="button"
            className={`button ${benchmarkMode ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setBenchmarkMode(!benchmarkMode)}
            title="Run OCR on both CPU and GPU for performance comparison"
          >
            {benchmarkMode ? 'Benchmark: ON' : 'Benchmark: OFF'}
          </button>
          {displayedLatencyMs !== null && (
            <div className={`ocr-latency-pill ${isOcrScanning ? 'is-live' : ''}`} aria-live="polite">
              <Clock3 size={15} />
              <span>{t.identity.ocrLatencyLabel}: {formatLatency(displayedLatencyMs)}</span>
            </div>
          )}
        </div>
      </div>

      {(ocrResult || ocrError) && (
        <div className={`ocr-review ${ocrError ? 'has-warning' : ''}`}>
          <div className="ocr-review-heading">
            {ocrError ? <Info size={20} /> : <CheckCircle2 size={20} />}
            <div>
              <strong>{ocrError ? t.identity.reviewTitle : t.identity.appliedTitle}</strong>
              <p>{ocrError || t.identity.reviewDescription}</p>
              {displayedLatencyMs !== null && (
                <p className="ocr-latency-line">
                  {t.identity.ocrLatencyLabel}: {formatLatency(displayedLatencyMs)}
                </p>
              )}
            </div>
          </div>
          {ocrResult?.extracted && (
            <dl className="ocr-fields">
              <div><dt>{t.identity.ocrFields.nationalId}</dt><dd>{ocrResult.extracted.nationalId || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.dateOfBirth}</dt><dd>{ocrResult.extracted.dateOfBirth || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.firstNameAr}</dt><dd>{ocrResult.extracted.firstNameAr || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.middleNameAr}</dt><dd>{ocrResult.extracted.middleNameAr || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.lastNameAr}</dt><dd>{ocrResult.extracted.lastNameAr || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.gender}</dt><dd>{ocrResult.extracted.gender || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.placeOfBirth}</dt><dd>{ocrResult.extracted.placeOfBirth || ocrResult.extracted.governorate || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.nationalIdIssueDate}</dt><dd>{ocrResult.extracted.nationalIdIssueDate || ocrResult.extracted.nationalIdIssueMonth || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.nationalIdExpiryDate}</dt><dd>{ocrResult.extracted.nationalIdExpiryDate || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.nationalIdCardPrintedNumber}</dt><dd>{ocrResult.extracted.nationalIdCardPrintedNumber || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.idResidenceAddressAr}</dt><dd>{ocrResult.extracted.idResidenceAddressAr || ocrResult.extracted.address || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.occupation}</dt><dd>{ocrResult.extracted.occupation || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.religion}</dt><dd>{ocrResult.extracted.religion || t.identity.ocrFields.empty}</dd></div>
              <div><dt>{t.identity.ocrFields.maritalStatus}</dt><dd>{ocrResult.extracted.maritalStatusAr || ocrResult.extracted.maritalStatus || t.identity.ocrFields.empty}</dd></div>
            </dl>
          )}

          {ocrResult && (
            <div style={{ marginTop: '16px' }}>
              <button 
                type="button" 
                className="text-button compact" 
                onClick={() => setShowReport(!showReport)}
              >
                {showReport ? (language === 'ar' ? 'إخفاء تقرير الفحص' : 'Hide OCR Diagnostics Report') : (language === 'ar' ? 'عرض تقرير الفحص' : 'Show OCR Diagnostics Report')}
              </button>
              
              {showReport && (
                <div className="ocr-diagnostics-report">
                  <h4>{language === 'ar' ? 'تقرير فحص البطاقة (Diagnostic Report)' : 'OCR Diagnostics Report'}</h4>
                  
                  {benchmarkMode && ocrResult.mode === 'dual' ? (
                    <div className="benchmark-comparison">
                      {ocrResult.cpuResult && ocrResult.gpuResult && (
                        <div className="benchmark-summary">
                          <BenchmarkComparisonSummary 
                            cpuResult={ocrResult.cpuResult} 
                            gpuResult={ocrResult.gpuResult} 
                          />
                        </div>
                      )}
                      <div className="benchmark-column">
                        <h5>CPU Results</h5>
                        {ocrResult.cpuResult ? (
                          <BenchmarkResult result={ocrResult.cpuResult} />
                        ) : (
                          <p className="error-text">CPU processing failed</p>
                        )}
                      </div>
                      <div className="benchmark-column">
                        <h5>GPU Results</h5>
                        {ocrResult.gpuResult ? (
                          <BenchmarkResult result={ocrResult.gpuResult} />
                        ) : (
                          <p className="error-text">GPU processing failed</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="ocr-report-grid">
                        <div>
                          <strong>Status:</strong> {ocrResult.status}
                        </div>
                        {ocrResult.cpu && (
                          <>
                            <div>
                              <strong>CPU Usage:</strong> {ocrResult.cpu.usagePercent}%
                            </div>
                            <div>
                              <strong>Logical Cores (vCPUs):</strong> {ocrResult.cpu.vcpus}
                            </div>
                            <div>
                              <strong>Physical Cores (est.):</strong> {ocrResult.cpu.physicalCpus}
                            </div>
                          </>
                        )}
                        {ocrResult.gpu && (
                          <>
                            <div>
                              <strong>GPU Utilization:</strong> {ocrResult.gpu.utilizationPercent}%
                            </div>
                            <div>
                              <strong>GPU Memory:</strong> {ocrResult.gpu.memoryUsedMb}MB / {ocrResult.gpu.memoryTotalMb}MB
                            </div>
                          </>
                        )}
                        <div>
                          <strong>Method:</strong> {ocrResult.method}
                        </div>
                      </div>
                      
                      {ocrResult.sides?.front && (
                        <div className="ocr-side-report">
                          <h5>Front Image (Confidence: {ocrResult.sides.front.confidence}%)</h5>
                          <ul className="ocr-raw-lines">
                            {ocrResult.sides.front.lines?.map((line, i) => (
                              <li key={i}>
                                <span className="ocr-line-text">{line.text}</span>
                                {line.confidence != null && <span className="ocr-line-conf">{Math.round(line.confidence * 100)}%</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ocrResult.sides?.back && (
                        <div className="ocr-side-report">
                          <h5>Back Image (Confidence: {ocrResult.sides.back.confidence}%)</h5>
                          <ul className="ocr-raw-lines">
                            {ocrResult.sides.back.lines?.map((line, i) => (
                              <li key={i}>
                                <span className="ocr-line-text">{line.text}</span>
                                {line.confidence != null && <span className="ocr-line-conf">{Math.round(line.confidence * 100)}%</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="lead">{t.identity.lead}</p>

      <div className="form-grid two-columns">
        <Field
          label={t.fieldLabels.nationalId}
          name="nationalId"
          value={form.nationalId}
          onChange={(value) => update('nationalId', value.replace(/\D/g, '').slice(0, 14))}
          error={errors.nationalId}
          hint={t.identity.scanHint}
          inputMode="numeric"
          autoComplete="off"
          placeholder="2980 1010 1234 56"
          isLoading={isOcrScanning}
        />
        <Field
          label={t.fieldLabels.dateOfBirth}
          name="dateOfBirth"
          value={form.dateOfBirth}
          onChange={(value) => update('dateOfBirth', value)}
          error={errors.dateOfBirth}
          hint={t.dateFormatHint}
          inputMode="numeric"
          placeholder="1990-06-14"
          isLoading={isOcrScanning}
        />
        <Field
          label={t.fieldLabels.fullName}
          name="fullName"
          value={form.fullName}
          onChange={(value) => update('fullName', value)}
          error={errors.fullName}
          hint={t.nameHint}
          autoComplete="name"
          isLoading={isOcrScanning}
        />
        <Field
          label={t.fieldLabels.address}
          name="address"
          value={form.address}
          onChange={(value) => update('address', value)}
          error={errors.address}
          hint={t.addressHint}
          autoComplete="street-address"
          isLoading={isOcrScanning}
        />
        <SelectField
          label={t.fieldLabels.governorate}
          name="governorate"
          value={form.governorate}
          onChange={(value) => update('governorate', value)}
          error={errors.governorate}
          options={governorateOptions}
          isLoading={isOcrScanning}
          placeholder={t.selectOption}
        />
        <Field
          label={t.fieldLabels.mobile}
          name="mobile"
          value={form.mobile}
          onChange={(value) => update('mobile', value.replace(/\D/g, '').slice(0, 11))}
          error={errors.mobile}
          hint={t.mobileHint}
          inputMode="tel"
          autoComplete="tel"
          placeholder="01X XXXX XXXX"
          isComplete={/^01\d{9}$/.test(form.mobile)}
        />
      </div>

      <FormSection title={t.sections.identityDetails}>
        <FieldGrid fields={additionalIdentityFields} form={form} errors={errors} update={update} isLoading={isOcrScanning} t={t} />
        <div className="eligibility-grid" style={{ marginTop: '18px' }}>
          <CheckboxField name="hasSpecialNeeds" label={t.checkboxLabels.hasSpecialNeeds} checked={form.hasSpecialNeeds} update={update} />
          <CheckboxField name="hasOtherNationality" label={t.checkboxLabels.hasOtherNationality} checked={form.hasOtherNationality} update={update} />
          <CheckboxField name="hasResidencyInOtherCountry" label={t.checkboxLabels.hasResidencyInOtherCountry} checked={form.hasResidencyInOtherCountry} update={update} />
        </div>
      </FormSection>

    </div>
  )
}

function formatLatency(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '0.0s'
  return `${(milliseconds / 1000).toFixed(1)}s`
}

function OcrImagePicker({ label, file, inputRef, onSelect, onRemove, t }) {
  return (
    <div className={`ocr-file-picker ${file ? 'has-file' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={onSelect}
      />
      <button type="button" className="ocr-file-button" onClick={() => inputRef.current?.click()}>
        <FileText size={17} />
        <span>{file ? `${label}: ${file.name}` : `${label} ${t.identity.imageSuffix}`}</span>
      </button>
      {file && (
        <button type="button" className="icon-button" onClick={onRemove} aria-label={templateText(t.identity.removeImage, { label })}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}

function BenchmarkResult({ result }) {
  const deviceName = result.device === 'cpu' ? 'CPU' : result.device === 'gpu' ? 'GPU' : 'Unknown'
  const latency = result.durationMs ? (result.durationMs / 1000).toFixed(2) + 's' : 'N/A'
  
  return (
    <div className="benchmark-result">
      <div className="benchmark-latency-highlight">
        <strong>{deviceName} Latency:</strong> {latency}
      </div>
      <div className="ocr-report-grid">
        <div>
          <strong>Status:</strong> {result.status}
        </div>
        <div>
          <strong>Confidence:</strong> {result.confidence}%
        </div>
        {result.cpu && (
          <>
            <div>
              <strong>CPU Usage:</strong> {result.cpu.usagePercent}%
            </div>
            <div>
              <strong>vCPUs:</strong> {result.cpu.vcpus}
            </div>
          </>
        )}
        {result.gpu && (
          <>
            <div>
              <strong>GPU Utilization:</strong> {result.gpu.utilizationPercent}%
            </div>
            <div>
              <strong>GPU Memory:</strong> {result.gpu.memoryUsedMb}MB / {result.gpu.memoryTotalMb}MB
            </div>
            {result.gpu.utilizationDelta !== undefined && (
              <div>
                <strong>GPU Δ:</strong> {result.gpu.utilizationDelta > 0 ? '+' : ''}{result.gpu.utilizationDelta}%
              </div>
            )}
            {result.gpu.memoryDelta !== undefined && (
              <div>
                <strong>Memory Δ:</strong> {result.gpu.memoryDelta > 0 ? '+' : ''}{result.gpu.memoryDelta}MB
              </div>
            )}
          </>
        )}
      </div>
      
      {result.sides?.front && (
        <div className="ocr-side-report">
          <h6>Front (Confidence: {result.sides.front.confidence}%)</h6>
          <ul className="ocr-raw-lines">
            {result.sides.front.lines?.slice(0, 5).map((line, i) => (
              <li key={i}>
                <span className="ocr-line-text">{line.text}</span>
                {line.confidence != null && <span className="ocr-line-conf">{Math.round(line.confidence * 100)}%</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.sides?.back && (
        <div className="ocr-side-report">
          <h6>Back (Confidence: {result.sides.back.confidence}%)</h6>
          <ul className="ocr-raw-lines">
            {result.sides.back.lines?.slice(0, 5).map((line, i) => (
              <li key={i}>
                <span className="ocr-line-text">{line.text}</span>
                {line.confidence != null && <span className="ocr-line-conf">{Math.round(line.confidence * 100)}%</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BenchmarkComparisonSummary({ cpuResult, gpuResult }) {
  const cpuLatency = cpuResult.durationMs ? cpuResult.durationMs / 1000 : null
  const gpuLatency = gpuResult.durationMs ? gpuResult.durationMs / 1000 : null
  
  if (!cpuLatency || !gpuLatency) return null
  
  const speedup = cpuLatency / gpuLatency
  const speedupPercent = ((1 - (gpuLatency / cpuLatency)) * 100).toFixed(1)
  const isFaster = gpuLatency < cpuLatency
  
  return (
    <div className="benchmark-summary">
      <h4>Performance Comparison</h4>
      <div className="comparison-grid">
        <div className="comparison-item">
          <span className="comparison-label">Run order</span>
          <span className="comparison-value">CPU then GPU</span>
        </div>
        <div className="comparison-item">
          <span className="comparison-label">CPU Latency</span>
          <span className="comparison-value">{cpuLatency.toFixed(2)}s</span>
        </div>
        <div className="comparison-item">
          <span className="comparison-label">GPU Latency</span>
          <span className="comparison-value">{gpuLatency.toFixed(2)}s</span>
        </div>
        <div className={`comparison-item ${isFaster ? 'faster' : 'slower'}`}>
          <span className="comparison-label">Speedup</span>
          <span className="comparison-value">
            {speedup.toFixed(2)}x ({isFaster ? '+' : ''}{speedupPercent}%)
          </span>
        </div>
        <div className="comparison-item">
          <span className="comparison-label">Total benchmark time</span>
          <span className="comparison-value">{(cpuLatency + gpuLatency).toFixed(2)}s</span>
        </div>
      </div>
    </div>
  )
}
