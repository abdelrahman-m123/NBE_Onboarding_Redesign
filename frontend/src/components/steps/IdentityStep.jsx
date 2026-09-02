import { useRef, useState } from 'react'
import { CheckCircle2, FileText, Info, Upload, UserRound, X } from 'lucide-react'
import { API_BASE_URL } from '../../config/api'
import { additionalIdentityFields, governorateOptions } from '../../config/onboarding'
import { templateText } from '../../utils/form'
import { CheckboxField, Field, FieldGrid, FormSection, SelectField } from '../forms/FormControls'

export function IdentityStep({ form, errors, update, ocrFiles, setOcrFiles, ocrResult, onOcrResult, t }) {
  const frontInputRef = useRef(null)
  const backInputRef = useRef(null)
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrError, setOcrError] = useState('')
  const isOcrScanning = ocrStatus === 'scanning'
  const canScanNationalId = Boolean(ocrFiles.front && ocrFiles.back) && !isOcrScanning

  const selectOcrFile = (side, event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setOcrFiles((current) => ({ ...current, [side]: file }))
    if (side === 'front') update('faceVerification', null)
    setOcrError('')
    setOcrStatus('idle')
    event.target.value = ''
  }

  const removeOcrFile = (side) => {
    setOcrFiles((current) => ({ ...current, [side]: null }))
    if (side === 'front') update('faceVerification', null)
    setOcrStatus('idle')
  }

  const scanNationalId = async () => {
    if (!ocrFiles.front || !ocrFiles.back) {
      setOcrStatus('needs-review')
      setOcrError(t.identity.uploadBoth)
      return
    }

    setOcrStatus('scanning')
    setOcrError('')

    const formData = new FormData()
    formData.append('frontImage', ocrFiles.front)
    formData.append('backImage', ocrFiles.back)

    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/ocr/full`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || t.identity.scanFallbackError)
      }

      onOcrResult(payload)
      setOcrStatus(payload.extracted?.nationalId ? 'complete' : 'needs-review')
      if (!payload.extracted?.nationalId) {
        setOcrError(t.identity.scanError)
      }
    } catch (error) {
      setOcrStatus('failed')
      setOcrError(error.message || t.identity.ocrUnavailable)
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
        </div>
      </div>

      {(ocrResult || ocrError) && (
        <div className={`ocr-review ${ocrError ? 'has-warning' : ''}`}>
          <div className="ocr-review-heading">
            {ocrError ? <Info size={20} /> : <CheckCircle2 size={20} />}
            <div>
              <strong>{ocrError ? t.identity.reviewTitle : t.identity.appliedTitle}</strong>
              <p>{ocrError || t.identity.reviewDescription}</p>
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
