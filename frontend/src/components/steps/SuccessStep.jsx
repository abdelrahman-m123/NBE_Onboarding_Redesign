import { ArrowRight, CalendarDays, Check, FileText } from 'lucide-react'

export function SuccessStep({ form, referenceNumber, restart, onDownloadSummary, onOpenBooking, language = 'en', t }) {
  const methodKey = form.method || 'branch'
  const isAr = language === 'ar'
  const hasAppointment = Boolean(form.appointmentDate && form.selectedBranch)

  return (
    <div className="step-body success-body">
      <div className="success-mark"><Check size={34} /></div>
      <p className="success-lead">{t.success.lead.replace('{name}', form.fullName?.split(' ')[0] || t.success.requestReady)}.</p>
      <p>{t.success.confirmation} <strong>{form.email || 'your verified email'}</strong>.</p>

      <div className="reference-card">
        <span>{t.applicationReference}</span>
        <strong>{referenceNumber}</strong>
        <button type="button" onClick={() => navigator.clipboard?.writeText(referenceNumber)}>{t.copy}</button>
      </div>

      <div className="next-step-card">
        <div className="next-step-icon"><CalendarDays size={25} /></div>
        <div>
          <span className="eyebrow">{t.nextStep}</span>
          <h2>
            {hasAppointment
              ? (isAr ? 'تم تأكيد حجز الموعد' : 'Appointment Confirmed')
              : (t.success.method[methodKey] || t.success.method.branch)}
          </h2>
          <p>
            {hasAppointment
              ? (isAr
                  ? `الفرع المختار: ${form.selectedBranch} | التاريخ: ${form.appointmentDate} | الوقت: ${form.appointmentSlot || '11:30 AM'}`
                  : `Location: ${form.selectedBranch} | Date: ${form.appointmentDate} | Time Slot: ${form.appointmentSlot || '11:30 AM'}`)
              : (t.success.methodText[methodKey] || t.success.methodText.branch)}
          </p>
          <button className="button button-primary" type="button" onClick={onOpenBooking}>
            {hasAppointment
              ? (isAr ? 'تعديل الموعد أو الفرع' : 'Change Appointment Slot')
              : (t.success.action[methodKey] || t.success.action.branch)}{' '}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="status-section">
        <div className="status-heading"><div><span className="eyebrow">{t.appStatus}</span><h2>{t.success.statusTitle}</h2></div><span className="status-pill">{t.success.statusPill}</span></div>
        <ol className="status-timeline">
          <li className="done"><span><Check size={14} /></span><div><strong>{t.success.timeline.submitted}</strong><small>{t.success.timeline.today}</small></div></li>
          <li className="active"><span>2</span><div><strong>{t.success.timeline.signature}</strong><small>{t.success.timeline.nextAction}</small></div></li>
          <li><span>3</span><div><strong>{t.success.timeline.review}</strong><small>{t.success.timeline.update}</small></div></li>
          <li><span>4</span><div><strong>{t.success.timeline.accountReady}</strong><small>{t.success.timeline.final}</small></div></li>
        </ol>
      </div>

      <div className="success-actions">
        <button className="button button-secondary" type="button" onClick={onDownloadSummary}>
          <FileText size={17} /> {t.success.downloadSummary}
        </button>
        <button className="text-button" type="button" onClick={restart}>{t.success.restart}</button>
      </div>
    </div>
  )
}
