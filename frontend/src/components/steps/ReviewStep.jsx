import { Building2, CalendarDays, Check, ChevronRight, HandHeart, LockKeyhole } from 'lucide-react'
import { optionLabel } from '../../utils/form'
import { FieldError } from '../forms/FormControls'
import { faceStatusMessage } from './FaceStep'

export function ReviewStep({ form, errors, update, goTo, t }) {
  const methods = [
    { id: 'ebranch', icon: CalendarDays, title: t.review.methods.ebranch, text: t.review.methodText.ebranch, tag: t.review.tags.mostConvenient },
    { id: 'branch', icon: Building2, title: t.review.methods.branch, text: t.review.methodText.branch, tag: '' },
    { id: 'employee', icon: HandHeart, title: t.review.methods.employee, text: t.review.methodText.employee, tag: t.review.tags.eligibilityApplies },
  ]

  return (
    <div className="step-body">
      <p className="lead">{t.review.lead}</p>

      <div className="review-card">
        <ReviewRow title={t.review.identity} value={`${t.review.nationalIdEnding} ${form.nationalId.slice(-4) || t.identity.ocrFields.empty} · ${form.dateOfBirth || t.review.dateOfBirthMissing}`} onEdit={() => goTo(1)} t={t} />
        <ReviewRow title={t.review.face} value={faceStatusMessage(form.faceVerification, t) || t.face.incomplete} onEdit={() => goTo(2)} t={t} />
        <ReviewRow title={t.review.contact} value={`${form.email || t.review.emailMissing} · ${t.verified}`} onEdit={() => goTo(3)} t={t} />
        <ReviewRow title={t.review.identityDetails} value={`${form.fullName || t.review.nameMissing} · ${form.governorate || t.review.governorateMissing}`} onEdit={() => goTo(1)} t={t} />
        <ReviewRow title={t.review.employment} value={`${optionLabel(form.employment, t)} · ${optionLabel(form.income, t)} · ${form.incomeProofDocument?.name || t.review.noHrLetterUploaded}`} onEdit={() => goTo(4)} t={t} />
      </div>

      <div className="section-divider" />
      <h2>{t.review.methodTitle}</h2>
      <p className="section-copy">{t.review.methodCopy}</p>
      <div className={`method-grid ${errors.method ? 'has-error' : ''}`}>
        {methods.map(({ id, icon: Icon, title, text, tag }) => (
          <label className={`method-card ${form.method === id ? 'selected' : ''}`} key={id}>
            <input type="radio" name="method" value={id} checked={form.method === id} onChange={() => update('method', id)} />
            <span className="radio-mark" />
            <Icon size={25} />
            {tag && <span className="method-tag">{tag}</span>}
            <strong>{title}</strong>
            <p>{text}</p>
            <span className="learn-more">{t.review.viewDetails} <ChevronRight size={15} /></span>
          </label>
        ))}
      </div>
      {errors.method && <FieldError message={errors.method} />}

      <div className="terms-box">
        <label className="terms-check">
          <input type="checkbox" checked={form.terms} onChange={(event) => update('terms', event.target.checked)} />
          <span className="custom-check"><Check size={15} /></span>
          <span>{t.review.legalText}</span>
        </label>
        {errors.terms && <FieldError message={errors.terms} />}
      </div>

      <div className="security-banner"><LockKeyhole size={20} /><span>{t.review.securityNote}</span></div>
    </div>
  )
}

function ReviewRow({ title, value, onEdit, t }) {
  return (
    <div className="review-row">
      <div><strong>{title}</strong><p>{value}</p></div>
      <button type="button" onClick={onEdit}>{t.review.edit}</button>
    </div>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

