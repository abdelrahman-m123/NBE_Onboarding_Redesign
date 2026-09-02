import { Mail, ShieldCheck, Smartphone } from 'lucide-react'
import { correspondenceFields } from '../../config/onboarding'
import { Field, FieldGrid, FormSection, OtpInput, VerificationCard } from '../forms/FormControls'

export function ContactStep({ 
  form, 
  applicationId,
  errors, 
  update, 
  mobileVerified, 
  emailVerified, 
  verifyMobile, 
  verifyEmail, 
  resetMobile, 
  resetEmail, 
  showToast,
  mobileOtpSent,
  onSendMobileOtp,
  emailOtpSent,        
  onSendEmailOtp,
  t
}) {
  const maskedMobile = form.mobile ? `${form.mobile.slice(0, 3)} •••• ${form.mobile.slice(-4)}` : '01• •••• ••••'

  return (
    <div className="step-body">
      <p className="lead">{t.contact.lead}</p>

      {/* --- MOBILE VERIFICATION CARD --- */}
      <VerificationCard
        icon={<Smartphone size={22} />}
        title={t.contact.mobile}
        destination={mobileVerified ? maskedMobile : form.mobile || t.contact.destinationMobile}
        verified={mobileVerified}
        onEdit={resetMobile}
        t={t}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', width: '100%' }}>
          <div style={{ flexGrow: 1 }}>
            <Field
              label={t.contact.mobile}
              name="mobile"
              value={form.mobile}
              onChange={(value) => { update('mobile', value); resetMobile() }}
              error={errors.mobile}
              autoComplete="tel"
              inputMode="tel"
              placeholder="01012345678"
              disabled={mobileVerified}
            />
          </div>
          
          {!mobileVerified && !mobileOtpSent && (
            <a
              href={`https://t.me/nbe_onboarding_otp_bot?start=${applicationId || 'demo_app'}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => onSendMobileOtp()}
              className="button button-primary"
              style={{
                marginBottom: '1rem',
                height: '46px',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {t.contact.verifyMobileNumber}
            </a>
          )}
        </div>

        {mobileOtpSent && !mobileVerified && (
          <div style={{ marginTop: '1rem' }}>
            <OtpInput
              name="smsOtp"
              label={t.contact.verifyMobileOtpLabel || 'Verify Mobile OTP'}
              value={form.smsOtp}
              onChange={(value) => update('smsOtp', value)}
              error={errors.smsOtp}
              onVerify={verifyMobile}
              verifyLabel={t.contact.verifyButton || 'Verify'}
            />
            <div className="resend-row">
              <span>{t.contact.expiresIn} <strong>05:00</strong></span>
              <a
                href={`https://t.me/nbe_onboarding_otp_bot?start=${applicationId || 'demo_app'}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '13px', color: '#006847', fontWeight: '600', textDecoration: 'underline' }}
              >
                {t.contact.resendCode}
              </a>
            </div>
          </div>
        )}
      </VerificationCard>

      {/* --- EMAIL VERIFICATION CARD --- */}
      <VerificationCard
        icon={<Mail size={22} />}
        title={t.contact.email}
        destination={form.email || t.contact.destinationEmail}
        verified={emailVerified}
        onEdit={resetEmail}
        t={t}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', width: '100%' }}>
          <div style={{ flexGrow: 1 }}>
            <Field
              label={t.contact.email}
              name="email"
              value={form.email}
              onChange={(value) => { update('email', value); resetEmail() }}
              error={errors.email}
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              disabled={emailVerified}
            />
            <Field
              label={t.contact.confirmEmail}
              name="emailConfirmation"
              value={form.emailConfirmation}
              onChange={(value) => update('emailConfirmation', value)}
              error={errors.emailConfirmation}
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              disabled={emailVerified}
            />
          </div>
          
          {!emailVerified && !emailOtpSent && (
            <button
              type="button"
              onClick={onSendEmailOtp}
              className="button button-primary"
              style={{ marginBottom: '1rem', height: '46px', whiteSpace: 'nowrap' }}
            >
              {t.contact.verifyEmail}
            </button>
          )}
        </div>

        {emailOtpSent && !emailVerified && (
          <div style={{ marginTop: '1rem' }}>
            <OtpInput
              name="emailOtp"
              label={t.contact.verifyEmailOtpLabel || 'Verify Email OTP'}
              value={form.emailOtp}
              onChange={(value) => update('emailOtp', value)}
              error={errors.emailOtp}
              onVerify={verifyEmail}
              verifyLabel={t.contact.verifyButton || 'Verify'}
            />
            <div className="resend-row">
              <span>{t.contact.expiresIn} <strong>05:00</strong></span>
              <button type="button" onClick={onSendEmailOtp}>{t.contact.resendEmail}</button>
            </div>
          </div>
        )}
      </VerificationCard>

      <div className="security-banner">
        <ShieldCheck size={21} />
        <span>{t.contact.security}</span>
      </div>

      <FormSection title={t.sections.correspondenceDetails}>
        <div className="form-grid two-columns">
          <Field label={t.contact.confirmedMobile} name="confirmedMobileNumber" value={form.mobile} onChange={() => {}} disabled />
          <Field label={t.contact.confirmedEmail} name="confirmedEmail" value={form.email} onChange={() => {}} disabled />
        </div>
        <FieldGrid fields={correspondenceFields} form={form} errors={errors} update={update} t={t} />
      </FormSection>
    </div>
  )
}
