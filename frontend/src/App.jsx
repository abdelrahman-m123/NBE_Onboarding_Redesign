import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { BookingModal } from './components/booking/BookingModal'
import { CrmDashboard } from './components/crm/CrmDashboard'
import { StaffLoginModal } from './components/crm/StaffLoginModal'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { JourneyNav } from './components/layout/JourneyNav'
import { SummaryReceipt } from './components/summary/SummaryReceipt'
import { ApplicationStep } from './components/steps/ApplicationStep'
import { ContactStep } from './components/steps/ContactStep'
import { FaceStep } from './components/steps/FaceStep'
import { IdentityStep } from './components/steps/IdentityStep'
import { PrepareStep } from './components/steps/PrepareStep'
import { ReviewStep } from './components/steps/ReviewStep'
import { SuccessStep } from './components/steps/SuccessStep'
import { API_BASE_URL } from './config/api'
import {
  accountPreferenceFields,
  additionalIdentityFields,
  employmentFields,
  initialForm,
  onboardingStepKeys,
} from './config/onboarding'
import { translations } from './i18n/translations'
import { requiredFieldMessage } from './utils/form'

function App() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [applicationId, setApplicationId] = useState(null)
  const [errors, setErrors] = useState({})
  const [viewMode, setViewMode] = useState('form')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileVerified, setMobileVerified] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [ocrFiles, setOcrFiles] = useState({ front: null, back: null })
  const [incomeProofFile, setIncomeProofFile] = useState(null)
  const [uploadedDocumentKeys, setUploadedDocumentKeys] = useState({ front: '', back: '', income: '' })
  const [mobileOtpSent, setMobileOtpSent] = useState(false)
  const [language, setLanguage] = useState(() => localStorage.getItem('nbe_lang') || 'en')
  const [currentOfficer, setCurrentOfficer] = useState(() => {
    try {
      const saved = sessionStorage.getItem('nbe_staff_auth')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const headingRef = useRef(null)

  const t = translations[language]
  const isAr = language === 'ar'

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('nbe_lang', language)
  }, [language])

  const toggleLanguage = () => setLanguage((current) => (current === 'en' ? 'ar' : 'en'))

  const progress = Math.round(((step + 1) / t.steps.length) * 100)
  const referenceNumber = useMemo(() => 'NBE-26-018427', [])

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  useEffect(() => {
    const savedAppId = localStorage.getItem('nbe_app_id')
    if (!savedAppId) return

    const loadSavedApplication = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/applications/${savedAppId}/profile`)
        if (!response.ok) throw new Error('Could not load profile')
        
        const data = await response.json()
        setApplicationId(savedAppId)
        
        const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ')
        
        const savedStepIndex = onboardingStepKeys.findIndex((stepKey) => stepKey === data.current_step)
        if (savedStepIndex !== -1) {
          setStep(savedStepIndex)
        }

        setForm(current => ({
          ...current,
          ...(data.onboarding_fields || {}),
          nationalId: data.national_id_hash || current.nationalId,
          fullName: fullName || current.fullName,
          dateOfBirth: data.date_of_birth ? data.date_of_birth.split('T')[0] : current.dateOfBirth,
          governorate: data.governorate || current.governorate,
          address: data.address_line || current.address,
          mobile: data.mobile_hash || current.mobile,
          email: data.email_hash || current.email,
          employment: data.employment_status || current.employment,
          income: data.income_range || current.income,
          method: data.submission_method || current.method,
          selectedBranch: data.selected_branch || current.selectedBranch,
          appointmentDate: data.appointment_date ? data.appointment_date.split('T')[0] : current.appointmentDate,
          appointmentSlot: data.appointment_slot || current.appointmentSlot,
        }))
        
        showToast('Your previous progress has been restored.')
      } catch (error) {
        console.error('Failed to resume application:', error)
      }
    }

    loadSavedApplication()
  }, [])

  const applyOcrResult = (result) => {
    setOcrResult(result)
    if (!result?.extracted) return

    setForm((current) => ({
      ...current,
      nationalId: result.extracted.nationalId || current.nationalId,
      dateOfBirth: result.extracted.dateOfBirth || current.dateOfBirth,
      fullName: result.extracted.name || current.fullName,
      firstNameAr: result.extracted.firstNameAr || current.firstNameAr,
      middleNameAr: result.extracted.middleNameAr || current.middleNameAr,
      lastNameAr: result.extracted.lastNameAr || current.lastNameAr,
      gender: result.extracted.gender || current.gender,
      nationalIdExpiryDate: result.extracted.nationalIdExpiryDate || current.nationalIdExpiryDate,
      nationalIdIssueDate: result.extracted.nationalIdIssueDate || result.extracted.nationalIdIssueMonth || current.nationalIdIssueDate,
      nationalIdCardPrintedNumber: result.extracted.nationalIdCardPrintedNumber || current.nationalIdCardPrintedNumber,
      placeOfBirth: result.extracted.placeOfBirth || result.extracted.governorate || current.placeOfBirth,
      idResidenceAddressAr: result.extracted.idResidenceAddressAr || result.extracted.address || current.idResidenceAddressAr,
      maritalStatus: result.extracted.maritalStatus || current.maritalStatus,
      governorate: result.extracted.governorate || current.governorate,
      address: result.extracted.address || current.address,
    }))
    setErrors((current) => ({
      ...current,
      nationalId: undefined,
      dateOfBirth: undefined,
      fullName: undefined,
      firstNameAr: undefined,
      middleNameAr: undefined,
      lastNameAr: undefined,
      gender: undefined,
      nationalIdExpiryDate: undefined,
      nationalIdIssueDate: undefined,
      nationalIdCardPrintedNumber: undefined,
      placeOfBirth: undefined,
      idResidenceAddressAr: undefined,
      governorate: undefined,
      address: undefined,
    }))
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
      additionalIdentityFields
        .filter((field) => field.required)
        .forEach((field) => {
          if (!String(form[field.name] || '').trim()) nextErrors[field.name] = requiredFieldMessage(fieldLabel(field, t), t)
        })
    }

    if (step === 3) {
      if (!mobileVerified) nextErrors.smsOtp = 'Verify your mobile number to continue.'
      if (!/^\S+@\S+\.\S+$/.test(form.email)) {
        nextErrors.email = 'Enter a valid email address.'
      }
      if (form.emailConfirmation && form.emailConfirmation.trim() !== form.email.trim()) {
        nextErrors.emailConfirmation = 'Email confirmation must match your email address.'
      }
      if (!emailVerified) nextErrors.emailOtp = 'Verify your email address to continue.'
    }

    if (step === 4) {
      ;['employment', 'income'].forEach(
        (name) => {
          if (!form[name].trim()) nextErrors[name] = requiredFieldMessage(t.fieldLabels[name], t)
        },
      )
      ;[...employmentFields, ...accountPreferenceFields]
        .filter((field) => field.required)
        .forEach((field) => {
          if (!String(form[field.name] || '').trim()) nextErrors[field.name] = requiredFieldMessage(fieldLabel(field, t), t)
        })
      if (!form.accountTransactionTypes?.length) {
        nextErrors.accountTransactionTypes = t.accountTransactionTypesRequired
      }
    }

    if (step === 5) {
      if (!form.method) nextErrors.method = 'Choose how you will complete your request.'
      if (!form.terms) nextErrors.terms = 'Read and accept the terms to submit.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const next = async () => {
    if (!validateStep()) return

    if (step === 5) {
      // Step 5 is Review -> Clicking "Submit request"
      setSubmitted(true)
      await handleSave('submitted', 'track')
      showToast('Application successfully submitted!')
    } else {
      // Auto-save progress as user advances each step
      handleSave(null, onboardingStepKeys[step + 1])
    }

    setStep((current) => Math.min(current + 1, t.steps.length - 1))
    focusHeading()
  }
  const back = () => {
    setStep((current) => Math.max(current - 1, 0))
    setErrors({})
    focusHeading()
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
    setOcrFiles({ front: null, back: null })
    setIncomeProofFile(null)
    setUploadedDocumentKeys({ front: '', back: '', income: '' })
    setShowReceipt(false)
    setIsBookingOpen(false)
    setSubmitted(false)
    setApplicationId(null)
    localStorage.removeItem('nbe_app_id')
    focusHeading()
  }

  const fillDemoData = () => {
    const demoEmploymentPageData = {
      maritalStatus: 'Single',
      numberOfDependents: '0',
      housingNature: 'Rented',
      rentalType: 'New rent',
      educationStatus: 'Bachelor degree',
      employment: 'Employed',
      income: 'EGP 25,001-50,000',
      employmentNature: 'Employee',
      employerName: 'Nile Digital Services',
      employmentStartDate: '2022-04-01',
      employerAddress: 'Smart Village, Giza',
      monthlySalary: '36000',
      employmentStatus: 'Permanent',
      jobGrade: 'Supervisor',
      employerPhone: '0235360000',
      otherIncomeSources: 'None',
      currentPosition: 'Supervisor',
      employerFax: '0235360001',
      annualIncomeBracket: 'EGP 300,001-600,000',
      isOrWasPep: false,
      accountType: 'Savings account',
      accountCurrency: 'Egyptian Pound',
      accountOpeningPurposeAr: 'ادخار الراتب والمعاملات اليومية',
      statementFrequency: 'Monthly',
      statementDeliveryAddress: 'Correspondence address',
      accountTransactionTypes: ['Cash', 'Transfers from third parties'],
      cardPrintedName: 'MARIAM H ALI',
      foreignCurrencyTransferHandling: 'Convert the transfer into the currency of an existing account at the announced rate',
      smsAlertSubscription: true,
      secureCodeSubscription: true,
      isBeneficialOwner: 'Yes',
      hasOtherBankAccountsOrCards: 'No',
    }
    const demoKeys = Object.keys(demoEmploymentPageData)

    setForm((current) => ({
      ...current,
      ...demoEmploymentPageData,
    }))
    setErrors((current) => {
      const nextErrors = { ...current }
      demoKeys.forEach((key) => {
        delete nextErrors[key]
      })
      return nextErrors
    })
    showToast(t.demoDataFilled)
  }

  const fileUploadKey = (file) => file ? `${file.name}:${file.size}:${file.lastModified}` : ''

  const uploadApplicationDocuments = async (currentAppId) => {
    const nextKeys = {
      front: fileUploadKey(ocrFiles.front),
      back: fileUploadKey(ocrFiles.back),
      income: fileUploadKey(incomeProofFile),
    }
    const formData = new FormData()

    if (ocrFiles.front && nextKeys.front !== uploadedDocumentKeys.front) {
      formData.append('nationalIdFrontImage', ocrFiles.front)
    }
    if (ocrFiles.back && nextKeys.back !== uploadedDocumentKeys.back) {
      formData.append('nationalIdBackImage', ocrFiles.back)
    }
    if (incomeProofFile && nextKeys.income !== uploadedDocumentKeys.income) {
      formData.append('incomeProofDocument', incomeProofFile)
    }

    if ([...formData.keys()].length === 0) return

    const uploadRes = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/documents`, {
      method: 'POST',
      body: formData,
    })

    if (!uploadRes.ok) {
      const payload = await uploadRes.json().catch(() => ({}))
      throw new Error(payload.message || 'Failed to upload supporting documents.')
    }

    setUploadedDocumentKeys((current) => ({
      front: ocrFiles.front ? nextKeys.front : current.front,
      back: ocrFiles.back ? nextKeys.back : current.back,
      income: incomeProofFile ? nextKeys.income : current.income,
    }))
  }

  const handleSave = async (overrideStatus = null, overrideStep = null) => {
    try {
      let currentAppId = applicationId

      if (!currentAppId) {
        const createRes = await fetch(`${API_BASE_URL}/api/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentStep: onboardingStepKeys[step] })
        })
        
        if (!createRes.ok) throw new Error('Failed to create application session.')
        const createData = await createRes.json()
        currentAppId = createData.id
        setApplicationId(currentAppId)
        localStorage.setItem('nbe_app_id', currentAppId)
      }

      const updateRes = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nationalId: form.nationalId,
          fullName: form.fullName,
          dateOfBirth: form.dateOfBirth,
          governorate: form.governorate,
          address: form.address,
          mobile: form.mobile,
          email: form.email,
          employment: form.employment,
          income: form.income,
          onboardingFields: {
            ...form,
            incomeProofDocument: form.incomeProofDocument
              ? {
                  name: form.incomeProofDocument.name,
                  size: form.incomeProofDocument.size,
                  type: form.incomeProofDocument.type,
                }
              : null,
            nationalIdConfirmed: form.nationalId,
            confirmedMobileNumber: form.mobile,
            confirmedEmail: form.email,
          },
          method: form.method,
          selectedBranch: form.selectedBranch,
          appointmentDate: form.appointmentDate,
          appointmentSlot: form.appointmentSlot,
          status: overrideStatus,
          currentStep: overrideStep || onboardingStepKeys[step]
        })
      })

      if (!updateRes.ok) throw new Error('Failed to save profile data.')

      await uploadApplicationDocuments(currentAppId)

      return currentAppId
    } catch (error) {
      console.error('Save error:', error)
      return null
    }
  }

  const handleSendEmailOtp = async () => {
    if (!form.email) {
      showToast('Please enter an email address first.')
      return
    }

    try {
      let currentAppId = applicationId || (await handleSave())
      if (!currentAppId) return

      const response = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      })

      if (!response.ok) throw new Error('Failed to send email.')

      setEmailOtpSent(true)
      showToast('Verification code sent to your email!')
    } catch (error) {
      console.error(error)
      showToast('Error sending verification code.')
    }
  }

  const handleVerifyEmailOtp = async () => {
    if (!form.emailOtp || form.emailOtp.length !== 6) {
      setErrors((current) => ({ ...current, emailOtp: 'Enter the 6-digit code.' }))
      return
    }

    try {
      const currentAppId = applicationId || localStorage.getItem('nbe_app_id')
      const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.emailOtp })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Verification failed')

      setEmailVerified(true)
      setErrors((current) => ({ ...current, emailOtp: undefined }))
      showToast('Email address verified successfully!')
    } catch (error) {
      setErrors((current) => ({ ...current, emailOtp: error.message || 'Invalid code.' }))
    }
  }

  const handleSendMobileOtp = async () => {
    if (!form.mobile || !/^01[0125][0-9]{8}$/.test(form.mobile)) {
      showToast('Please enter a valid 11-digit Egyptian mobile number.')
      return
    }

    try {
      let currentAppId = applicationId || (await handleSave())
      if (!currentAppId) return

      const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch SMS')

      setMobileOtpSent(true)
      showToast('Verification code dispatched!')
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleVerifyMobileOtp = async () => {
    if (!form.smsOtp || form.smsOtp.length !== 6) {
      setErrors((current) => ({ ...current, smsOtp: 'Enter the 6-digit code.' }))
      return
    }

    try {
      const currentAppId = applicationId || localStorage.getItem('nbe_app_id')

      const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/verify-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.smsOtp })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Verification failed')

      setMobileVerified(true)
      setErrors((current) => ({ ...current, smsOtp: undefined }))
      showToast('Mobile number verified successfully!')
    } catch (error) {
      setErrors((current) => ({ ...current, smsOtp: error.message || 'Invalid code.' }))
    }
  }

  const handleConfirmBooking = async (bookingDetails) => {
    update('selectedBranch', bookingDetails.branchName)
    update('appointmentDate', bookingDetails.date)
    update('appointmentSlot', bookingDetails.slot)

    const currentAppId = applicationId || localStorage.getItem('nbe_app_id')
    if (currentAppId) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: form.method || bookingDetails.branchType || 'branch',
            selectedBranch: bookingDetails.branchName,
            appointmentDate: bookingDetails.date,
            appointmentSlot: bookingDetails.slot,
            governorate: bookingDetails.governorate,
            currentStep: 'track',
            status: 'submitted',
          }),
        })
        if (!res.ok) throw new Error('Failed to save appointment.')
      } catch (err) {
        console.error('Failed to sync appointment with backend:', err)
      }
    }

    showToast(
      isAr
        ? `تم تأكيد حجز الموعد بـ ${bookingDetails.branchName} بنجاح!`
        : `Appointment confirmed at ${bookingDetails.branchName}!`
    )
  }

  const handleOpenCrm = () => {
    if (currentOfficer?.authenticated) {
      setViewMode('crm')
    } else {
      setIsLoginModalOpen(true)
    }
  }

  const handleLoginSuccess = (staffMember) => {
    setCurrentOfficer({ ...staffMember, authenticated: true })
    setViewMode('crm')
  }

  const handleLogout = () => {
    sessionStorage.removeItem('nbe_staff_auth')
    setCurrentOfficer(null)
    setViewMode('form')
    showToast(isAr ? 'تم تسجيل الخروج من نظام الموظفين.' : 'Logged out of Staff CRM.')
  }

  if (viewMode === 'crm') {
    return (
      <CrmDashboard
        onBackToForm={() => setViewMode('form')}
        onLogout={handleLogout}
        currentOfficer={currentOfficer}
      />
    )
  }

  if (showReceipt) {
    return (
      <SummaryReceipt
        form={form}
        referenceNumber={referenceNumber}
        language={language}
        onBack={() => setShowReceipt(false)}
      />
    )
  }

  return (
    <div className={`app-shell ${language === 'ar' ? 'rtl' : ''}`}>
      <a className="skip-link" href="#main-content">{t.skipToApplication}</a>
      <Header
        onSave={() => handleSave()}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        language={language}
        toggleLanguage={toggleLanguage}
        onOpenCrm={handleOpenCrm}
        t={t}
      />

      <StaffLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onConfirm={handleConfirmBooking}
        userGovernorate={form.governorate || 'Cairo'}
        methodType={form.method || 'branch'}
        language={language}
      />

      <div className="progress-strip" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <main id="main-content" className="page-wrap">
        <JourneyNav step={step} onStepSelect={setStep} submitted={submitted} t={t} />

        <section className="content-panel" aria-labelledby="page-title">
          <div className="step-kicker">{t.step} {step + 1} {t.of} {t.steps.length}</div>
          <h1 id="page-title" tabIndex="-1" ref={headingRef}>{t.steps[step].title}</h1>

          {step === 0 && (
            <PrepareStep form={form} errors={errors} onToggle={updateEligibility} t={t} />
          )}
          {step === 1 && (
            <IdentityStep
              form={form}
              errors={errors}
              update={update}
              ocrFiles={ocrFiles}
              setOcrFiles={setOcrFiles}
              ocrResult={ocrResult}
              onOcrResult={applyOcrResult}
              t={t}
            />
          )}
          {step === 2 && (
            <FaceStep
              form={form}
              nationalIdFrontFile={ocrFiles.front}
              onFaceVerificationResult={(result) => update('faceVerification', result)}
              ensureApplicationId={() => applicationId || handleSave(null, 'face')}
              t={t}
            />
          )}
          {step === 3 && (
            <ContactStep
              form={form}
              applicationId={applicationId}
              errors={errors}
              update={update}
              mobileVerified={mobileVerified}
              emailVerified={emailVerified}
              verifyMobile={handleVerifyMobileOtp}
              verifyEmail={handleVerifyEmailOtp}
              resetMobile={() => { setMobileVerified(false); setMobileOtpSent(false); }}
              resetEmail={() => { setEmailVerified(false); setEmailOtpSent(false); }}
              showToast={showToast}
              mobileOtpSent={mobileOtpSent}
              onSendMobileOtp={handleSendMobileOtp}
              emailOtpSent={emailOtpSent}
              onSendEmailOtp={handleSendEmailOtp}
              t={t}
            />
          )}
          {step === 4 && (
            <ApplicationStep
              form={form}
              errors={errors}
              update={update}
              incomeProofFile={incomeProofFile}
              setIncomeProofFile={setIncomeProofFile}
              onFillDemoData={fillDemoData}
              t={t}
            />
          )}
          {step === 5 && (
            <ReviewStep form={form} errors={errors} update={update} goTo={setStep} t={t} />
          )}
          {step === 6 && (
            <SuccessStep
              form={form}
              referenceNumber={referenceNumber}
              restart={restart}
              onDownloadSummary={() => setShowReceipt(true)}
              onOpenBooking={() => setIsBookingOpen(true)}
              language={language}
              t={t}
            />
          )}

          {step < 6 && (
            <div className="form-actions">
              {step > 0 ? (
                <button className="button button-secondary" type="button" onClick={back}>
                  {language === 'ar' ? <ArrowRight size={18} aria-hidden="true" /> : <ArrowLeft size={18} aria-hidden="true" />} {t.back}
                </button>
              ) : (
                <span />
              )}
              <button className="button button-primary" type="button" onClick={next}>
                {language === 'ar' ? <ArrowLeft size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                {t.nextLabels[step]}
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer t={t} />

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  )
}

export default App
