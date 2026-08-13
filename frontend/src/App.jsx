import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  HandHeart,
  Info,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  Upload,
  UserRound,
  X,
} from 'lucide-react'

const steps = [
  { short: 'Prepare', title: 'Get ready' },
  { short: 'Identity', title: 'Verify your identity' },
  { short: 'Contact', title: 'Verify contact details' },
  { short: 'Employment', title: 'Employment proof' },
  { short: 'Review', title: 'Review and complete' },
  { short: 'Track', title: 'Request submitted' },
]

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const governorateOptions = [
  'Cairo',
  'Alexandria',
  'Port Said',
  'Suez',
  'Damietta',
  'Dakahlia',
  'Sharqia',
  'Qalyubia',
  'Kafr El Sheikh',
  'Gharbia',
  'Monufia',
  'Beheira',
  'Ismailia',
  'Giza',
  'Beni Suef',
  'Faiyum',
  'Minya',
  'Asyut',
  'Sohag',
  'Qena',
  'Aswan',
  'Luxor',
  'Red Sea',
  'New Valley',
  'Matrouh',
  'North Sinai',
  'South Sinai',
  'Born outside Egypt',
  'Other',
]

const initialForm = {
  eligibility: {
    newCustomer: false,
    resident: false,
    age: false,
    validId: false,
  },
  nationalId: '',
  dateOfBirth: '',
  fullName: '',
  mobile: '',
  smsOtp: '',
  email: '',
  emailOtp: '',
  governorate: '',
  address: '',
  employment: '',
  income: '',
  incomeProofDocument: null,
  method: '',
  terms: false,
}

const fieldLabels = {
  nationalId: 'National ID',
  dateOfBirth: 'Date of birth',
  fullName: 'Name as shown on ID',
  mobile: 'Mobile number',
  smsOtp: 'Mobile verification code',
  email: 'Email address',
  emailOtp: 'Email verification code',
  governorate: 'Governorate',
  address: 'Residential address',
  employment: 'Employment status',
  income: 'Monthly income range',
}

const nextLabels = [
  'Check eligibility and begin',
  'Continue to contact verification',
  'Continue to employment proof',
  'Continue to review',
  'Submit request',
]

function App() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState('')
  const [mobileVerified, setMobileVerified] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const headingRef = useRef(null)

  const progress = Math.round(((step + 1) / steps.length) * 100)
  const referenceNumber = useMemo(() => 'NBE-26-018427', [])

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const applyOcrResult = (result) => {
    setOcrResult(result)
    if (!result?.extracted) return

    setForm((current) => ({
      ...current,
      nationalId: result.extracted.nationalId || current.nationalId,
      dateOfBirth: result.extracted.dateOfBirth || current.dateOfBirth,
      fullName: result.extracted.name || current.fullName,
      governorate: result.extracted.governorate || current.governorate,
      address: result.extracted.address || current.address,
    }))
    setErrors((current) => ({ ...current, nationalId: undefined, dateOfBirth: undefined, fullName: undefined, governorate: undefined, address: undefined }))
  }

  const updateEligibility = (name) => {
    setForm((current) => ({
      ...current,
      eligibility: {
        ...current.eligibility,
        [name]: !current.eligibility[name],
      },
    }))
    setErrors((current) => ({ ...current, eligibility: undefined }))
  }

  const focusHeading = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => headingRef.current?.focus(), 250)
  }

  const validateStep = () => {
    const nextErrors = {}

    if (step === 0 && !Object.values(form.eligibility).every(Boolean)) {
      nextErrors.eligibility = 'Confirm each eligibility requirement to continue.'
    }

    if (step === 1) {
      if (!/^\d{14}$/.test(form.nationalId)) {
        nextErrors.nationalId = 'Enter the 14-digit National ID number.'
      }
      if (!/^01\d{9}$/.test(form.mobile)) {
        nextErrors.mobile = 'Enter an Egyptian mobile number beginning with 01.'
      }
    }

    if (step === 2) {
      if (!mobileVerified) nextErrors.smsOtp = 'Verify your mobile number to continue.'
      if (!/^\S+@\S+\.\S+$/.test(form.email)) {
        nextErrors.email = 'Enter a valid email address.'
      }
      if (!emailVerified) nextErrors.emailOtp = 'Verify your email address to continue.'
    }

    if (step === 3) {
      ;['employment', 'income'].forEach(
        (name) => {
          if (!form[name].trim()) nextErrors[name] = `${fieldLabels[name]} is required.`
        },
      )
    }

    if (step === 4) {
      if (!form.method) nextErrors.method = 'Choose how you will complete your request.'
      if (!form.terms) nextErrors.terms = 'Read and accept the terms to submit.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const next = () => {
    if (!validateStep()) return
    if (step === 4) setSubmitted(true)
    setStep((current) => Math.min(current + 1, steps.length - 1))
    focusHeading()
  }

  const back = () => {
    setStep((current) => Math.max(current - 1, 0))
    setErrors({})
    focusHeading()
  }

  const verifyMobile = () => {
    if (!/^\d{6}$/.test(form.smsOtp)) {
      setErrors((current) => ({ ...current, smsOtp: 'Enter the 6-digit code.' }))
      return
    }
    setMobileVerified(true)
    setErrors((current) => ({ ...current, smsOtp: undefined }))
  }

  const verifyEmail = () => {
    const nextErrors = {}
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!/^\d{6}$/.test(form.emailOtp)) nextErrors.emailOtp = 'Enter the 6-digit code.'
    if (Object.keys(nextErrors).length) {
      setErrors((current) => ({ ...current, ...nextErrors }))
      return
    }
    setEmailVerified(true)
    setErrors((current) => ({ ...current, emailOtp: undefined }))
  }

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const restart = () => {
    setForm(initialForm)
    setStep(0)
    setErrors({})
    setMobileVerified(false)
    setEmailVerified(false)
    setSubmitted(false)
    focusHeading()
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to application</a>
      <Header
        onSave={() => showToast('Your progress is saved for this prototype session.')}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />

      <div className="progress-strip" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <main id="main-content" className="page-wrap">
        <JourneyNav step={step} onStepSelect={setStep} submitted={submitted} />

        <section className="content-panel" aria-labelledby="page-title">
          <div className="step-kicker">Step {step + 1} of {steps.length}</div>
          <h1 id="page-title" tabIndex="-1" ref={headingRef}>{steps[step].title}</h1>

          {/* {Object.keys(errors).length > 0 && (
            <div className="error-summary" role="alert">
              <Info size={20} aria-hidden="true" />
              <div>
                <strong>Check the highlighted information</strong>
                <p>There are {Object.keys(errors).length} items to complete before continuing.</p>
              </div>
            </div>
          )} */}

          {step === 0 && (
            <PrepareStep form={form} errors={errors} onToggle={updateEligibility} />
          )}
          {step === 1 && (
            <IdentityStep
              form={form}
              errors={errors}
              update={update}
              ocrResult={ocrResult}
              onOcrResult={applyOcrResult}
            />
          )}
          {step === 2 && (
            <ContactStep
              form={form}
              errors={errors}
              update={update}
              mobileVerified={mobileVerified}
              emailVerified={emailVerified}
              verifyMobile={verifyMobile}
              verifyEmail={verifyEmail}
              resetMobile={() => setMobileVerified(false)}
              resetEmail={() => setEmailVerified(false)}
              showToast={showToast}
            />
          )}
          {step === 3 && (
            <ApplicationStep form={form} errors={errors} update={update} />
          )}
          {step === 4 && (
            <ReviewStep form={form} errors={errors} update={update} goTo={setStep} />
          )}
          {step === 5 && (
            <SuccessStep form={form} referenceNumber={referenceNumber} restart={restart} />
          )}

          {step < 5 && (
            <div className="form-actions">
              {step > 0 ? (
                <button className="button button-secondary" type="button" onClick={back}>
                  <ArrowLeft size={18} aria-hidden="true" /> Back
                </button>
              ) : (
                <span />
              )}
              <button className="button button-primary" type="button" onClick={next}>
                {nextLabels[step]}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

      </main>

      <Footer />

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  )
}

function Header({ onSave, mobileNavOpen, setMobileNavOpen }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#main-content" aria-label="National Bank of Egypt home">
          <img className="brand-logo" src="/image.png" alt="" />
        </a>
        <nav className={`header-actions ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Support navigation">
          <span className="prototype-label" aria-label="Prototype language">English prototype</span>
          <button type="button" className="header-link" onClick={() => alert('Call NBE support at 19623 for assistance.')}>
            <CircleHelp size={18} aria-hidden="true" /> Help
          </button>
          <button type="button" className="save-button" onClick={onSave}>
            <Save size={17} aria-hidden="true" /> Save & exit
          </button>
        </nav>
        <button
          type="button"
          className="menu-button"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          {mobileNavOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  )
}

function JourneyNav({ step, onStepSelect, submitted }) {
  return (
    <aside className="journey-nav" aria-label="Application progress">
      <p className="journey-label">Account opening</p>
      <ol>
        {steps.map((item, index) => {
          const complete = index < step
          const active = index === step
          const canVisit = index < step || (submitted && index === 5)
          return (
            <li key={item.short} className={active ? 'active' : complete ? 'complete' : ''}>
              <button
                type="button"
                disabled={!canVisit || active}
                aria-current={active ? 'step' : undefined}
                onClick={() => onStepSelect(index)}
              >
                <span className="step-dot">{complete ? <Check size={15} /> : index + 1}</span>
                <span>{item.short}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

function PrepareStep({ form, errors, onToggle }) {
  const requirements = [
    ['newCustomer', 'I am a new NBE retail customer'],
    ['resident', 'I currently reside in Egypt'],
    ['age', 'I am 21 years old or older'],
    ['validId', 'I have a valid National ID number'],
  ]

  return (
    <div className="step-body">
      <p className="lead">A few quick checks will make sure this service is right for you. It usually takes 10-15 minutes to complete the online request.</p>

      <fieldset className={`checklist-fieldset ${errors.eligibility ? 'has-error' : ''}`}>
        <legend>Confirm that each statement applies to you</legend>
        <div className="eligibility-grid">
          {requirements.map(([name, label]) => (
            <label className="check-card" key={name}>
              <input
                type="checkbox"
                checked={form.eligibility[name]}
                onChange={() => onToggle(name)}
              />
              <span className="custom-check"><Check size={15} /></span>
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.eligibility && <FieldError message={errors.eligibility} />}
      </fieldset>

      <div className="section-divider" />
      <h2>What you may need later</h2>
      <div className="document-preview">
        <div><FileText size={21} /><span><strong>National ID</strong><small>Original and a clear copy</small></span></div>
        <div><MapPin size={21} /><span><strong>Proof of address</strong><small>Only if your address differs</small></span></div>
        <div><FileCheck2 size={21} /><span><strong>Income or employment proof</strong><small>Based on your application answers</small></span></div>
      </div>
      <button type="button" className="text-button"><Info size={17} /> Who should apply at a branch instead?</button>
    </div>
  )
}

function IdentityStep({ form, errors, update, ocrResult, onOcrResult }) {
  const fileInputRef = useRef(null)
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrError, setOcrError] = useState('')
  const isOcrScanning = ocrStatus === 'scanning'

  const scanNationalId = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setOcrStatus('scanning')
    setOcrError('')

    const formData = new FormData()
    formData.append('nationalIdImage', file)

    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/ocr`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'We could not scan this image.')
      }

      onOcrResult(payload)
      setOcrStatus(payload.extracted?.nationalId ? 'complete' : 'needs-review')
      if (!payload.extracted?.nationalId) {
        setOcrError('We could not confidently find a 14-digit National ID. Try a clearer image or enter it manually.')
      }
    } catch (error) {
      setOcrStatus('failed')
      setOcrError(error.message || 'OCR is unavailable. You can still enter the number manually.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="step-body">
      <p className="lead">We use these details to locate and protect your application. Enter the National ID number—not the passport number.</p>

      <div className="form-grid two-columns">
        <Field
          label="National ID number"
          name="nationalId"
          value={form.nationalId}
          onChange={(value) => update('nationalId', value.replace(/\D/g, '').slice(0, 14))}
          error={errors.nationalId}
          hint="14 digits, shown on your National ID"
          inputMode="numeric"
          autoComplete="off"
          placeholder="2980 1010 1234 56"
          isLoading={isOcrScanning}
        />
        <Field
          label="Date of birth"
          name="dateOfBirth"
          value={form.dateOfBirth}
          onChange={(value) => update('dateOfBirth', value)}
          error={errors.dateOfBirth}
          hint="Use YYYY-MM-DD"
          inputMode="numeric"
          placeholder="1990-06-14"
          isLoading={isOcrScanning}
        />
        <Field
          label="Name as shown on ID"
          name="fullName"
          value={form.fullName}
          onChange={(value) => update('fullName', value)}
          error={errors.fullName}
          hint="Correct OCR spelling mistakes here"
          autoComplete="name"
          isLoading={isOcrScanning}
        />
        <Field
          label="Address as shown on ID"
          name="address"
          value={form.address}
          onChange={(value) => update('address', value)}
          error={errors.address}
          hint="You can update your current residential address later if different"
          autoComplete="street-address"
          isLoading={isOcrScanning}
        />
        <SelectField
          label="Governorate from National ID"
          name="governorate"
          value={form.governorate}
          onChange={(value) => update('governorate', value)}
          error={errors.governorate}
          options={governorateOptions}
          isLoading={isOcrScanning}
        />
        <Field
          label="Mobile number"
          name="mobile"
          value={form.mobile}
          onChange={(value) => update('mobile', value.replace(/\D/g, '').slice(0, 11))}
          error={errors.mobile}
          hint="We will send a verification code to this number"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01X XXXX XXXX"
          isComplete={/^01\d{9}$/.test(form.mobile)}
        />
      </div>

      <div className="upload-card">
        <div className="upload-illustration"><UserRound size={26} /></div>
        <div className="upload-copy">
          <span className="optional-tag">Recommended</span>
          <h2>Scan your National ID</h2>
          <p>Upload a clear photo to extract the 14-digit ID number. You can review and edit it before continuing.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          onChange={scanNationalId}
        />
        <button
          type="button"
          className="button button-secondary"
          disabled={ocrStatus === 'scanning'}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={18} /> {ocrStatus === 'scanning' ? 'Scanning...' : 'Scan ID'}
        </button>
      </div>

      {/* {(ocrResult || ocrError || ocrStatus === 'scanning') && (
        <div className={`ocr-review ${ocrStatus === 'failed' || ocrStatus === 'needs-review' ? 'has-warning' : ''}`} role="status">
          <div className="ocr-review-heading">
            {ocrStatus === 'complete' ? <CheckCircle2 size={20} /> : <Info size={20} />}
            <div>
              <strong>{ocrStatus === 'scanning' ? 'Reading the ID image' : ocrStatus === 'complete' ? 'Review extracted details' : 'Scan needs attention'}</strong>
              <p>{ocrStatus === 'scanning' ? 'This can take a few seconds. The image is processed by the local backend for this prototype.' : ocrError || 'We filled the extracted fields above. Review and correct them before continuing.'}</p>
            </div>
          </div>
        </div>
      )} */}

    </div>
  )
}

function ContactStep({ form, errors, update, mobileVerified, emailVerified, verifyMobile, verifyEmail, resetMobile, resetEmail, showToast }) {
  const maskedMobile = form.mobile ? `${form.mobile.slice(0, 3)} •••• ${form.mobile.slice(-4)}` : '01• •••• ••••'

  return (
    <div className="step-body">
      <p className="lead">Verify the contact details NBE will use for application updates. Never share this code. NBE employees will not ask you for it.</p>

      <VerificationCard
        icon={<Smartphone size={22} />}
        title="Mobile number"
        destination={maskedMobile}
        verified={mobileVerified}
        onEdit={resetMobile}
      >
        <OtpInput
          name="smsOtp"
          value={form.smsOtp}
          onChange={(value) => update('smsOtp', value)}
          error={errors.smsOtp}
          onVerify={verifyMobile}
          verifyLabel="Verify mobile number"
        />
        <div className="resend-row"><span>Code expires in <strong>04:32</strong></span><button type="button" onClick={() => showToast('A new mobile code has been sent.')}>Resend code</button></div>
      </VerificationCard>

      <VerificationCard
        icon={<Mail size={22} />}
        title="Email address"
        destination={form.email || 'Add the email you check regularly'}
        verified={emailVerified}
        onEdit={resetEmail}
      >
        <Field
          label="Email address"
          name="email"
          value={form.email}
          onChange={(value) => { update('email', value); resetEmail() }}
          error={errors.email}
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
        />
        <OtpInput
          name="emailOtp"
          value={form.emailOtp}
          onChange={(value) => update('emailOtp', value)}
          error={errors.emailOtp}
          onVerify={verifyEmail}
          verifyLabel="Verify email address"
        />
        <div className="resend-row"><span>Can’t find it? Check junk or spam.</span><button type="button" onClick={() => showToast('A new email code has been sent.')}>Resend email</button></div>
      </VerificationCard>

      <div className="security-banner"><ShieldCheck size={21} /><span><strong>Keep every code private.</strong> NBE employees will never ask you to read or send them a verification code.</span></div>
    </div>
  )
}

function VerificationCard({ icon, title, destination, verified, onEdit, children }) {
  return (
    <section className={`verification-card ${verified ? 'is-verified' : ''}`}>
      <div className="verification-heading">
        <div className="verification-icon">{icon}</div>
        <div><h2>{title}</h2><p>{destination}</p></div>
        {verified && <span className="verified-pill"><BadgeCheck size={17} /> Verified</span>}
      </div>
      {verified ? (
        <button className="text-button compact" type="button" onClick={onEdit}>Change {title.toLowerCase()}</button>
      ) : children}
    </section>
  )
}

function OtpInput({ name, value, onChange, error, onVerify, verifyLabel }) {
  return (
    <div className="otp-group">
      <div className="field grow">
        <label htmlFor={name}>6-digit verification code</label>
        <input
          id={name}
          className={error ? 'input-error otp-input' : 'otp-input'}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="• • • • • •"
          aria-describedby={error ? `${name}-error` : undefined}
          aria-invalid={Boolean(error)}
        />
        {error && <FieldError id={`${name}-error`} message={error} />}
      </div>
      <button className="button button-secondary verify-button" type="button" onClick={onVerify}>{verifyLabel}</button>
    </div>
  )
}

function ApplicationStep({ form, errors, update }) {
  const employmentDocumentRef = useRef(null)
  const uploadEmploymentDocument = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    update('incomeProofDocument', {
      name: file.name,
      size: file.size,
      type: file.type || 'Document',
    })
    event.target.value = ''
  }

  return (
    <div className="step-body">
      <p className="lead">Tell us about your employment so we can prepare the right proof checklist for your branch or employee visit.</p>

      <div className="section-heading"><span>1</span><div><h2>Employment proof</h2><p>This helps determine which supporting documents apply</p></div></div>
      <div className="form-grid two-columns">
        <SelectField label="Employment status" name="employment" value={form.employment} onChange={(value) => update('employment', value)} error={errors.employment} options={['Employed', 'Self-employed', 'Retired', 'Student', 'Not currently employed']} />
        <SelectField label="Monthly income range" name="income" value={form.income} onChange={(value) => update('income', value)} error={errors.income} options={['Less than EGP 10,000', 'EGP 10,000–25,000', 'EGP 25,001–50,000', 'More than EGP 50,000']} />
      </div>

      {form.employment && (
        <div className="dynamic-checklist">
          <FileCheck2 size={22} />
          <div><strong>Your employment proof checklist</strong><p>{form.employment === 'Employed' ? 'Upload or bring an HR letter that proves your income if your profession or income needs confirmation.' : form.employment === 'Self-employed' ? 'You may need a professional licence or tax card.' : 'We will confirm whether additional income evidence applies to you.'}</p></div>
        </div>
      )}

      <div className={`employment-upload ${form.incomeProofDocument ? 'has-file' : ''}`}>
        <div className="upload-illustration"><FileCheck2 size={25} /></div>
        <div>
          <span className="optional-tag">Optional</span>
          <h2>Upload HR letter proving income</h2>
          <p>{form.incomeProofDocument ? `${form.incomeProofDocument.name} · ${formatFileSize(form.incomeProofDocument.size)}` : 'Add an HR letter that confirms your role and income if you already have it ready.'}</p>
        </div>
        <input
          ref={employmentDocumentRef}
          type="file"
          accept="image/*,.pdf"
          className="visually-hidden"
          onChange={uploadEmploymentDocument}
        />
        <div className="employment-upload-actions">
          {form.incomeProofDocument && (
            <button className="text-button compact" type="button" onClick={() => update('incomeProofDocument', null)}>
              Remove
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={() => employmentDocumentRef.current?.click()}>
            <Upload size={18} /> {form.incomeProofDocument ? 'Replace HR letter' : 'Upload HR letter'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ form, errors, update, goTo }) {
  const methods = [
    { id: 'ebranch', icon: CalendarDays, title: 'Book an e-branch visit', text: 'Choose a branch, date and time. We will show card-issuance availability.', tag: 'Most convenient' },
    { id: 'branch', icon: Building2, title: 'Visit a traditional branch', text: 'Visit within 10 working days and ask for the Retail Banking Manager.', tag: '' },
    { id: 'employee', icon: HandHeart, title: 'Request an employee visit', text: 'Available to eligible customers in select governorates. We will call within two working days.', tag: 'Eligibility applies' },
  ]

  return (
    <div className="step-body">
      <p className="lead">Review your details, then choose how you will provide the original documents and physical signature.</p>

      <div className="review-card">
        <ReviewRow title="Identity" value={`National ID ending ${form.nationalId.slice(-4) || '—'} · ${form.dateOfBirth || 'Date of birth not entered'}`} onEdit={() => goTo(1)} />
        <ReviewRow title="Contact" value={`${form.email || 'Email not entered'} · Verified`} onEdit={() => goTo(2)} />
        <ReviewRow title="Identity details" value={`${form.fullName || 'Name not entered'} · ${form.governorate || 'Governorate not entered'}`} onEdit={() => goTo(1)} />
        <ReviewRow title="Employment" value={`${form.employment} · ${form.income} · ${form.incomeProofDocument?.name || 'No HR letter uploaded yet'}`} onEdit={() => goTo(3)} />
      </div>

      <div className="section-divider" />
      <h2>How would you like to complete your request?</h2>
      <p className="section-copy">Your online information will be ready when you arrive.</p>
      <div className={`method-grid ${errors.method ? 'has-error' : ''}`}>
        {methods.map(({ id, icon: Icon, title, text, tag }) => (
          <label className={`method-card ${form.method === id ? 'selected' : ''}`} key={id}>
            <input type="radio" name="method" value={id} checked={form.method === id} onChange={() => update('method', id)} />
            <span className="radio-mark" />
            <Icon size={25} />
            {tag && <span className="method-tag">{tag}</span>}
            <strong>{title}</strong>
            <p>{text}</p>
            <span className="learn-more">View details <ChevronRight size={15} /></span>
          </label>
        ))}
      </div>
      {errors.method && <FieldError message={errors.method} />}

      <div className="terms-box">
        <label className="terms-check">
          <input type="checkbox" checked={form.terms} onChange={(event) => update('terms', event.target.checked)} />
          <span className="custom-check"><Check size={15} /></span>
          <span>I have read and agree to the <button type="button">account-opening terms and conditions</button> and confirm that my information is accurate.</span>
        </label>
        {errors.terms && <FieldError message={errors.terms} />}
      </div>

      <div className="security-banner"><LockKeyhole size={20} /><span>Submitting creates a request—it does not open the account until NBE verifies your original documents and physical signature.</span></div>
    </div>
  )
}

function ReviewRow({ title, value, onEdit }) {
  return (
    <div className="review-row">
      <div><strong>{title}</strong><p>{value}</p></div>
      <button type="button" onClick={onEdit}>Edit</button>
    </div>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SuccessStep({ form, referenceNumber, restart }) {
  const methodNames = {
    ebranch: 'Book an e-branch visit',
    branch: 'Visit a traditional branch',
    employee: 'Request an employee visit',
  }

  return (
    <div className="step-body success-body">
      <div className="success-mark"><Check size={34} /></div>
      <p className="success-lead">Thank you, {form.fullName?.split(' ')[0] || 'your request is ready'}.</p>
      <p>We have received your account-opening request and sent a confirmation to <strong>{form.email || 'your verified email'}</strong>.</p>

      <div className="reference-card">
        <span>Application reference</span>
        <strong>{referenceNumber}</strong>
        <button type="button" onClick={() => navigator.clipboard?.writeText(referenceNumber)}>Copy</button>
      </div>

      <div className="next-step-card">
        <div className="next-step-icon"><CalendarDays size={25} /></div>
        <div>
          <span className="eyebrow">Your next step</span>
          <h2>{methodNames[form.method] || 'Complete your documents and signature'}</h2>
          <p>{form.method === 'employee' ? 'An NBE employee will call your verified mobile number within two working days.' : form.method === 'ebranch' ? 'Choose your preferred branch, date and time to complete the request.' : 'Visit your chosen NBE branch within 10 working days with the original documents.'}</p>
          <button className="button button-primary" type="button">{form.method === 'ebranch' ? 'Choose appointment' : form.method === 'employee' ? 'View preparation checklist' : 'Find a branch'} <ArrowRight size={18} /></button>
        </div>
      </div>

      <div className="status-section">
        <div className="status-heading"><div><span className="eyebrow">Application status</span><h2>Submitted for completion</h2></div><span className="status-pill">On track</span></div>
        <ol className="status-timeline">
          <li className="done"><span><Check size={14} /></span><div><strong>Online request submitted</strong><small>Today</small></div></li>
          <li className="active"><span>2</span><div><strong>Original documents and signature</strong><small>Your next action</small></div></li>
          <li><span>3</span><div><strong>NBE review</strong><small>We will keep you updated</small></div></li>
          <li><span>4</span><div><strong>Account ready</strong><small>Final confirmation by NBE</small></div></li>
        </ol>
      </div>

      <div className="success-actions">
        <button className="button button-secondary" type="button">Download summary</button>
        <button className="text-button" type="button" onClick={restart}>Start another prototype request</button>
      </div>
    </div>
  )
}

function Field({ label, name, value, onChange, error, hint, isLoading, isComplete, ...props }) {
  const filled = isComplete ?? Boolean(value)
  return (
    <div className={`field ${isLoading ? 'is-loading' : ''}`} aria-busy={isLoading || undefined}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${error ? 'input-error' : ''} ${filled ? 'is-filled' : ''} ${isLoading ? 'is-shimmering' : ''}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...props}
      />
      {hint && !error && <small id={`${name}-hint`}>{hint}</small>}
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

function SelectField({ label, name, value, onChange, error, options, isLoading }) {
  return (
    <div className={`field ${isLoading ? 'is-loading' : ''}`} aria-busy={isLoading || undefined}>
      <label htmlFor={name}>{label}</label>
      <select id={name} value={value} onChange={(event) => onChange(event.target.value)} className={`${error ? 'input-error' : ''} ${value ? 'is-filled' : ''} ${isLoading ? 'is-shimmering' : ''}`.trim()} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>
        <option value="">Select an option</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

function FieldError({ id, message }) {
  return <span id={id} className="field-error"><Info size={15} aria-hidden="true" /> {message}</span>
}

function Footer() {
  return (
    <footer className="site-footer">
      <div><Landmark size={19} /><span>National Bank of Egypt</span></div>
      <nav aria-label="Legal"><a href="#privacy">Privacy</a><a href="#security">Security</a><a href="#accessibility">Accessibility</a><a href="tel:19623"><Phone size={14} /> 19623</a></nav>
    </footer>
  )
}

export default App
