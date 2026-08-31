import { useMemo, useRef, useState, useEffect } from 'react'
import { CrmDashboard } from './crmDashboard'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const onboardingStepKeys = ['prepare', 'identity', 'face', 'contact', 'application', 'review', 'track']

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

const selectOptions = {
  yesNo: ['Yes', 'No'],
  customerType: ['Individuals'],
  gender: ['Male', 'Female'],
  correspondenceAddressSource: ['Residence address from ID document', 'Alternate residence address', 'Employer address'],
  correspondenceLanguage: ['Arabic', 'English'],
  deliveryMethod: ['Regular mail', 'Branch pickup', 'Employee visit'],
  maritalStatus: ['Single', 'Married', 'Divorced', 'Widowed'],
  housingNature: ['Owned', 'Rented', 'Family residence', 'Company housing'],
  rentalType: ['New rent', 'Old rent', 'Furnished rent', 'Not applicable'],
  educationStatus: ['No formal education', 'Secondary', 'Bachelor degree', 'Postgraduate'],
  employmentNature: ['Employee', 'Self-employed', 'Business owner', 'Retired', 'Student', 'Not employed'],
  employmentStatus: ['Temporary', 'Permanent'],
  jobGrade: ['Staff', 'Supervisor', 'Manager', 'Senior manager', 'Executive'],
  currentPosition: ['Specialist', 'Supervisor', 'Manager', 'Director', 'Business owner', 'Other'],
  annualIncomeBracket: ['Less than EGP 120,000', 'EGP 120,000-300,000', 'EGP 300,001-600,000', 'More than EGP 600,000'],
  accountType: ['Current account', 'Savings account'],
  accountCurrency: ['Egyptian Pound'],
  statementFrequency: ['Monthly', 'Quarterly', 'Semi-annually', 'Annually'],
  statementDeliveryAddress: ['Correspondence address', 'ID residence address', 'Employer address'],
  foreignCurrencyTransferHandling: [
    'Open a new account in the transfer currency and deduct applicable fees',
    'Convert the transfer into the currency of an existing account at the announced rate',
  ],
}

const accountTransactionTypeOptions = [
  'Cash',
  'Cash and cheques',
  'Cash deposit by third parties',
  'Transfers from third parties',
  'Other',
]

const additionalIdentityFields = [
  { name: 'customerType', label: 'Customer type', type: 'select', options: selectOptions.customerType },
  { name: 'firstNameAr', label: 'First name in Arabic', required: true, ocr: true },
  { name: 'middleNameAr', label: 'Middle name in Arabic', required: true, ocr: true },
  { name: 'lastNameAr', label: 'Last name in Arabic', required: true, ocr: true },
  { name: 'gender', label: 'Gender', type: 'select', options: selectOptions.gender, ocr: true },
  { name: 'nationalIdExpiryDate', label: 'National ID expiry date', type: 'date', ocr: true },
  { name: 'nationalIdIssueDate', label: 'National ID issue date (year and month)', type: 'month', required: true, ocr: true },
  { name: 'nationalIdCardPrintedNumber', label: 'Printed number on ID card', required: true, ocr: true },
  { name: 'placeOfBirth', label: 'Place of birth', type: 'select', options: governorateOptions, required: true, ocr: true },
  { name: 'idResidenceAddressAr', label: 'Residence address from ID in Arabic', maxLength: 50, required: true, ocr: true },
  { name: 'alternateResidenceAddressAr', label: 'Alternate residence address in Arabic', maxLength: 50 },
]

const correspondenceFields = [
  { name: 'correspondenceAddressSource', label: 'Correspondence address', type: 'select', options: selectOptions.correspondenceAddressSource },
  { name: 'correspondenceLanguage', label: 'Correspondence language', type: 'select', options: selectOptions.correspondenceLanguage },
  { name: 'landlineNumber', label: 'Landline number including area code', inputMode: 'tel' },
  { name: 'deliveryMethod', label: 'Delivery method', type: 'select', options: selectOptions.deliveryMethod },
]

const socialFields = [
  { name: 'maritalStatus', label: 'Marital status', type: 'select', options: selectOptions.maritalStatus },
  { name: 'numberOfDependents', label: 'Number of dependents', type: 'number', min: '0' },
  { name: 'housingNature', label: 'Housing nature', type: 'select', options: selectOptions.housingNature },
  { name: 'rentalType', label: 'Rental type', type: 'select', options: selectOptions.rentalType },
  { name: 'educationStatus', label: 'Education status', type: 'select', options: selectOptions.educationStatus },
]

const employmentFields = [
  { name: 'employmentNature', label: 'Employment nature', type: 'select', options: selectOptions.employmentNature },
  { name: 'employerName', label: 'Employer name', required: true },
  { name: 'employmentStartDate', label: 'Employment start date', type: 'date' },
  { name: 'employerAddress', label: 'Employer address', maxLength: 50 },
  { name: 'monthlySalary', label: 'Monthly salary', type: 'number', min: '0' },
  { name: 'employmentStatus', label: 'Employment status', type: 'select', options: selectOptions.employmentStatus },
  { name: 'jobGrade', label: 'Job grade', type: 'select', options: selectOptions.jobGrade },
  { name: 'employerPhone', label: 'Employer phone', inputMode: 'tel' },
  { name: 'otherIncomeSources', label: 'Other income sources' },
  { name: 'currentPosition', label: 'Current position', type: 'select', options: selectOptions.currentPosition, required: true },
  { name: 'employerFax', label: 'Employer fax' },
  { name: 'annualIncomeBracket', label: 'Annual income bracket', type: 'select', options: selectOptions.annualIncomeBracket },
]

const accountPreferenceFields = [
  { name: 'accountType', label: 'Account type', type: 'select', options: selectOptions.accountType },
  { name: 'accountCurrency', label: 'Account currency', type: 'select', options: selectOptions.accountCurrency, disabled: true },
  { name: 'accountOpeningPurposeAr', label: 'Purpose of opening the account in Arabic', required: true },
  { name: 'statementFrequency', label: 'Statement frequency', type: 'select', options: selectOptions.statementFrequency, required: true },
  { name: 'statementDeliveryAddress', label: 'Statement delivery address', type: 'select', options: selectOptions.statementDeliveryAddress },
  { name: 'cardPrintedName', label: 'Name to print on card', minLength: 7, maxLength: 20, required: true },
  { name: 'foreignCurrencyTransferHandling', label: 'Foreign-currency transfer handling', type: 'select', options: selectOptions.foreignCurrencyTransferHandling },
  { name: 'isBeneficialOwner', label: 'Are you the beneficial owner?', type: 'select', options: selectOptions.yesNo },
  { name: 'hasOtherBankAccountsOrCards', label: 'Do you have accounts/cards with other banks?', type: 'select', options: selectOptions.yesNo, required: true },
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
  customerType: 'Individuals',
  firstNameAr: '',
  middleNameAr: '',
  lastNameAr: '',
  gender: '',
  nationalIdExpiryDate: '',
  nationalIdIssueDate: '',
  nationalIdCardPrintedNumber: '',
  placeOfBirth: '',
  idResidenceAddressAr: '',
  alternateResidenceAddressAr: '',
  hasSpecialNeeds: false,
  hasOtherNationality: false,
  hasResidencyInOtherCountry: false,
  mobile: '',
  smsOtp: '',
  email: '',
  emailConfirmation: '',
  emailOtp: '',
  correspondenceAddressSource: 'Residence address from ID document',
  correspondenceLanguage: 'Arabic',
  landlineNumber: '',
  deliveryMethod: 'Regular mail',
  governorate: '',
  address: '',
  maritalStatus: '',
  numberOfDependents: '',
  housingNature: '',
  rentalType: '',
  educationStatus: '',
  employment: '',
  income: '',
  employmentNature: '',
  employerName: '',
  employmentStartDate: '',
  employerAddress: '',
  monthlySalary: '',
  isOrWasPep: false,
  employmentStatus: '',
  jobGrade: '',
  employerPhone: '',
  otherIncomeSources: '',
  currentPosition: '',
  employerFax: '',
  annualIncomeBracket: '',
  accountType: '',
  accountCurrency: 'Egyptian Pound',
  accountOpeningPurposeAr: '',
  statementFrequency: '',
  statementDeliveryAddress: '',
  accountTransactionTypes: ['Cash', 'Transfers from third parties'],
  cardPrintedName: '',
  foreignCurrencyTransferHandling: 'Convert the transfer into the currency of an existing account at the announced rate',
  smsAlertSubscription: true,
  secureCodeSubscription: true,
  isBeneficialOwner: 'Yes',
  hasOtherBankAccountsOrCards: '',
  incomeProofDocument: null,
  method: '',
  terms: false,
  faceVerification: null,
}

const translations = {
  en: {
    help: 'Help',
    saveExit: 'Save & exit',
    back: 'Back',
    languageLabel: 'Language',
    skipToApplication: 'Skip to application',
    step: 'Step',
    of: 'of',
    accountOpening: 'Account opening',
    nextStep: 'Your next step',
    applicationReference: 'Application reference',
    copy: 'Copy',
    verified: 'Verified',
    change: 'Change',
    selectOption: 'Select an option',
    dateFormatHint: 'Use YYYY-MM-DD',
    nameHint: 'Correct OCR spelling mistakes here',
    addressHint: 'You can update your current residential address later if different',
    mobileHint: 'We will send a verification code to this number',
    appStatus: 'Application status',
    steps: [
      { short: 'Prepare', title: 'Get ready' },
      { short: 'Identity', title: 'Verify your identity' },
      { short: 'Face', title: 'Verify your face' },
      { short: 'Contact', title: 'Verify contact details' },
      { short: 'Employment', title: 'Employment proof' },
      { short: 'Review', title: 'Review and complete' },
      { short: 'Track', title: 'Request submitted' },
    ],
    fieldLabels: {
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
    },
    nextLabels: [
      'Check eligibility and begin',
      'Continue to face verification',
      'Continue to contact verification',
      'Continue to employment proof',
      'Continue to review',
      'Submit request',
    ],
    prepare: {
      lead: 'A few quick checks will make sure this service is right for you. It usually takes 10-15 minutes to complete the online request.',
      legend: 'Confirm that each statement applies to you',
      requirements: [
        'I am a new NBE retail customer',
        'I currently reside in Egypt',
        'I am 21 years old or older',
        'I have a valid National ID number',
      ],
      laterTitle: 'What you may need later',
      docs: [
        { title: 'National ID', hint: 'Original and a clear copy' },
        { title: 'Proof of address', hint: 'Only if your address differs' },
        { title: 'Income or employment proof', hint: 'Based on your application answers' },
      ],
      branchLink: 'Who should apply at a branch instead?',
    },
    identity: {
      lead: 'We use these details to locate and protect your application. Enter the National ID number—not the passport number.',
      scanRecommended: 'Recommended',
      scanTitle: 'Scan your National ID',
      scanDescription: 'Upload a clear photo to extract the 14-digit ID number. You can review and edit it before continuing.',
      scanButton: 'Scan ID',
      scanning: 'Scanning...',
      scanError: 'We could not confidently find a 14-digit National ID. Try a clearer image or enter it manually.',
      scanHint: '14 digits, shown on your National ID',
    },
    face: {
      lead: 'Match your face to the National ID photo so the application can continue with a stronger identity check.',
    },
    contact: {
      lead: 'Verify the contact details NBE will use for application updates. Never share this code. NBE employees will not ask you for it.',
      mobile: 'Mobile number',
      email: 'Email address',
      destinationMobile: 'Add your Egyptian mobile number',
      destinationEmail: 'Add the email you check regularly',
      verifyMobileNumber: 'Verify Mobile Number',
      resendCode: 'Resend code',
      verifyMobileOtpLabel: 'Verify Mobile OTP',
      verifyEmailOtpLabel: 'Verify Email OTP',
      verifyButton: 'Verify',
      verifyEmail: 'Verify Email',
      resendEmail: 'Resend email',
      expiresIn: 'Code expires in',
      security: 'Keep every code private. NBE employees will never ask you to read or send them a verification code.',
    },
    application: {
      lead: 'Tell us about your employment so we can prepare the right proof checklist for your branch or employee visit.',
      sectionTitle: 'Employment proof',
      sectionDescription: 'This helps determine which supporting documents apply',
      optional: 'Optional',
      uploadTitle: 'Upload HR letter proving income',
      uploadDescription: 'Add an HR letter that confirms your role and income if you already have it ready.',
      replace: 'Replace HR letter',
      upload: 'Upload HR letter',
      remove: 'Remove',
      checklist: 'Your employment proof checklist',
      employed: 'Upload or bring an HR letter that proves your income if your profession or income needs confirmation.',
      selfEmployed: 'You may need a professional licence or tax card.',
      other: 'We will confirm whether additional income evidence applies to you.',
    },
    review: {
      lead: 'Review your details, then choose how you will provide the original documents and physical signature.',
      identity: 'Identity',
      face: 'Face match',
      contact: 'Contact',
      identityDetails: 'Identity details',
      employment: 'Employment',
      methodTitle: 'How would you like to complete your request?',
      methodCopy: 'Your online information will be ready when you arrive.',
      viewDetails: 'View details',
      legalText: 'I have read and agree to the account-opening terms and conditions and confirm that my information is accurate.',
      securityNote: 'Submitting creates a request—it does not open the account until NBE verifies your original documents and physical signature.',
      edit: 'Edit',
      methods: {
        ebranch: 'Book an e-branch visit',
        branch: 'Visit a traditional branch',
        employee: 'Request an employee visit',
      },
      methodText: {
        ebranch: 'Choose a branch, date and time. We will show card-issuance availability.',
        branch: 'Visit within 10 working days and ask for the Retail Banking Manager.',
        employee: 'Available to eligible customers in select governorates. We will call within two working days.',
      },
      tags: {
        mostConvenient: 'Most convenient',
        eligibilityApplies: 'Eligibility applies',
      },
    },
    success: {
      lead: 'Thank you, {name}.',
      requestReady: 'your request is ready',
      confirmation: 'We have received your account-opening request and sent a confirmation to',
      nextStep: 'Your next step',
      method: {
        ebranch: 'Book an e-branch visit',
        branch: 'Visit a traditional branch',
        employee: 'Request an employee visit',
      },
      methodText: {
        ebranch: 'Choose your preferred branch, date and time to complete the request.',
        branch: 'Visit your chosen NBE branch within 10 working days with the original documents.',
        employee: 'An NBE employee will call your verified mobile number within two working days.',
      },
      action: {
        ebranch: 'Choose appointment',
        branch: 'Find a branch',
        employee: 'View preparation checklist',
      },
      statusTitle: 'Submitted for completion',
      statusPill: 'On track',
      timeline: {
        submitted: 'Online request submitted',
        today: 'Today',
        signature: 'Original documents and signature',
        nextAction: 'Your next action',
        review: 'NBE review',
        update: 'We will keep you updated',
        accountReady: 'Account ready',
        final: 'Final confirmation by NBE',
      },
      downloadSummary: 'Download summary',
      restart: 'Start another request',
    },
    footer: {
      legal: 'Privacy',
      security: 'Security',
      accessibility: 'Accessibility',
    },
  },
  ar: {
    help: 'مساعدة',
    saveExit: 'حفظ وخروج',
    back: 'رجوع',
    languageLabel: 'اللغة',
    skipToApplication: 'تجاوز إلى التطبيق',
    step: 'الخطوة',
    of: 'من',
    accountOpening: 'فتح الحساب',
    nextStep: 'خطوتك التالية',
    applicationReference: 'مرجع الطلب',
    copy: 'نسخ',
    verified: 'تم التحقق',
    change: 'تغيير',
    selectOption: 'اختر خيارًا',
    dateFormatHint: 'استخدم YYYY-MM-DD',
    nameHint: 'صحح أخطاء OCR في الاسم هنا',
    addressHint: 'يمكنك تحديث عنوانك الحالي لاحقًا إذا كان مختلفًا',
    mobileHint: 'سنرسل رمز التحقق إلى هذا الرقم',
    appStatus: 'حالة الطلب',
    steps: [
      { short: 'التجهيز', title: 'استعد' },
      { short: 'الهوية', title: 'تحقق من هويتك' },
      { short: 'الوجه', title: 'تحقق من الوجه' },
      { short: 'التواصل', title: 'تحقق من بيانات التواصل' },
      { short: 'العمل', title: 'إثبات العمل' },
      { short: 'المراجعة', title: 'راجع بياناتك وأكمل' },
      { short: 'المتابعة', title: 'تم إرسال الطلب' },
    ],
    fieldLabels: {
      nationalId: 'الرقم القومي',
      dateOfBirth: 'تاريخ الميلاد',
      fullName: 'الاسم كما يظهر في البطاقة',
      mobile: 'رقم الهاتف',
      smsOtp: 'رمز التحقق من الهاتف',
      email: 'البريد الإلكتروني',
      emailOtp: 'رمز التحقق من البريد الإلكتروني',
      governorate: 'المحافظة',
      address: 'عنوان السكن',
      employment: 'الحالة الوظيفية',
      income: 'نطاق الدخل الشهري',
    },
    nextLabels: [
      'تحقق من الأهلية وابدأ',
      'الانتقال إلى تحقق الوجه',
      'الانتقال إلى التحقق من التواصل',
      'الانتقال إلى إثبات العمل',
      'الانتقال إلى المراجعة',
      'إرسال الطلب',
    ],
    prepare: {
      lead: 'بضع فحوصات سريعة للتأكد من أن هذه الخدمة مناسبة لك. عادة ما يستغرق إكمال الطلب عبر الإنترنت من 10 إلى 15 دقيقة.',
      legend: 'أكد أن كل عبارة تنطبق عليك',
      requirements: [
        'أنا عميل جديد في الخدمات المصرفية للأفراد في البنك الأهلي المصري',
        'أقيم حاليًا في مصر',
        'عمري 21 عامًا أو أكثر',
        'لدي رقم قومي صالح',
      ],
      laterTitle: 'ما قد تحتاجه لاحقًا',
      docs: [
        { title: 'الرقم القومي', hint: 'الأصل ونسخة واضحة' },
        { title: 'إثبات العنوان', hint: 'فقط إذا كان عنوانك مختلفًا' },
        { title: 'إثبات الدخل أو العمل', hint: 'بناءً على إجابات طلبك' },
      ],
      branchLink: 'من ينبغي أن يتقدم إلى الفرع بدلاً من ذلك؟',
    },
    identity: {
      lead: 'نستخدم هذه البيانات لتحديد طلبك وحمايته. أدخل رقم البطاقة القومية وليس رقم جواز السفر.',
      scanRecommended: 'موصى به',
      scanTitle: 'امسح بطاقتك القومية',
      scanDescription: 'ارفع صورة واضحة لاستخراج الرقم القومي المكون من 14 رقمًا. يمكنك مراجعة المحتوى وتعديله قبل المتابعة.',
      scanButton: 'مسح البطاقة',
      scanning: 'جارٍ المسح...',
      scanError: 'تعذر العثور على رقم قومي مكون من 14 رقمًا بشكل موثوق. جرّب صورة أوضح أو أدخله يدويًا.',
      scanHint: '14 رقمًا كما هو موضح في بطاقتك الوطنية',
    },
    face: {
      lead: 'طابق وجهك مع صورة بطاقة الرقم القومي حتى يستمر الطلب بفحص هوية أقوى.',
    },
    contact: {
      lead: 'تحقق من تفاصيل التواصل التي سيستخدمها البنك لتحديث طلبك. لا تشارك هذا الرمز أبدًا. لن يطلب منك موظفو البنك ذلك.',
      mobile: 'رقم الهاتف',
      email: 'البريد الإلكتروني',
      destinationMobile: 'أضف رقم هاتفك المصري',
      destinationEmail: 'أضف البريد الإلكتروني الذي تراجعُه بانتظام',
      verifyMobileNumber: 'التحقق من رقم الهاتف',
      resendCode: 'إعادة إرسال الرمز',
      verifyMobileOtpLabel: 'رمز التحقق من الهاتف',
      verifyEmailOtpLabel: 'رمز التحقق من البريد',
      verifyButton: 'تأكيد',
      verifyEmail: 'تحقق من البريد',
      resendEmail: 'إعادة إرسال البريد',
      expiresIn: 'تنتهي صلاحية الرمز خلال',
      security: 'احفظ كل رمز في سرية كاملة. لن يطلب منك موظفو البنك أبدًا قراءة أو إرسال رموز التحقق.',
    },
    application: {
      lead: 'أخبرنا عن وظيفتك حتى نعد قائمة الدليل المناسبة لزيارتك إلى الفرع أو الموظف.',
      sectionTitle: 'إثبات العمل',
      sectionDescription: 'يساعد هذا في تحديد المستندات الداعمة المناسبة',
      optional: 'اختياري',
      uploadTitle: 'رفع خطاب توظيف يثبت الدخل',
      uploadDescription: 'أضف خطاب توظيف يثبت دورك ودخلك إذا كان جاهزًا لديك بالفعل.',
      replace: 'استبدال خطاب التوظيف',
      upload: 'رفع خطاب التوظيف',
      remove: 'حذف',
      checklist: 'قائمة إثبات عملك',
      employed: 'حمّل أو أحضر خطابًا من جهة العمل يثبت دخلك إذا كانت مهنة أو دخلِك تحتاج إلى تأكيد.',
      selfEmployed: 'قد تحتاج إلى رخصة مهنية أو بطاقة ضريبية.',
      other: 'سنقوم بتحديد ما إذا كانت هناك أدلة إضافية للدخل مطلوبة.',
    },
    review: {
      lead: 'راجع بياناتك، ثم اختر الطريقة التي ستقدم بها المستندات الأصلية والتوقيع الفعلي.',
      identity: 'الهوية',
      face: 'مطابقة الوجه',
      contact: 'التواصل',
      identityDetails: 'تفاصيل الهوية',
      employment: 'الوظيفة',
      methodTitle: 'كيف تود إكمال طلبك؟',
      methodCopy: 'ستكون معلوماتك عبر الإنترنت جاهزة عند حضورك.',
      viewDetails: 'عرض التفاصيل',
      legalText: 'لقد قرأت وأوافق على الشروط والأحكام الخاصة بفتح الحساب وأؤكد أن معلوماتي دقيقة.',
      securityNote: 'يؤدي التقديم إلى إنشاء طلب، لكنه لا يفتح الحساب حتى يتحقق البنك من المستندات الأصلية والتوقيع الفعلي.',
      edit: 'تعديل',
      methods: {
        ebranch: 'حجز زيارة فرع إلكتروني',
        branch: 'زيارة فرع تقليدي',
        employee: 'طلب زيارة موظف',
      },
      methodText: {
        ebranch: 'اختر فرعًا وتاريخًا ووقتًا مناسبين. سنعرض توافر إصدار البطاقة.',
        branch: 'زر الفرع خلال 10 أيام عمل واطلب مدير الخدمات المصرفية للأفراد.',
        employee: 'متاح للعملاء المؤهلين في بعض المحافظات. سنتصل بك خلال يومين عمل.',
      },
      tags: {
        mostConvenient: 'الأكثر ملاءمة',
        eligibilityApplies: 'يطبق التأهيل',
      },
    },
    success: {
      lead: 'شكرًا لك، {name}.',
      requestReady: 'طلبك جاهز',
      confirmation: 'لقد تلقينا طلب فتح الحساب الخاص بك وأرسلنا تأكيدًا إلى',
      nextStep: 'خطوتك التالية',
      method: {
        ebranch: 'حجز زيارة فرع إلكتروني',
        branch: 'زيارة فرع تقليدي',
        employee: 'طلب زيارة موظف',
      },
      methodText: {
        ebranch: 'اختر الفرع والتاريخ والوقت المناسبين لإكمال الطلب.',
        branch: 'زر الفرع المختار في البنك الأهلي المصري خلال 10 أيام عمل مع المستندات الأصلية.',
        employee: 'سيتصل بك موظف من البنك على رقم هاتفك الموثق خلال يومين عمل.',
      },
      action: {
        ebranch: 'اختيار الموعد',
        branch: 'العثور على فرع',
        employee: 'عرض قائمة التحضير',
      },
      statusTitle: 'تم التقديم للإكمال',
      statusPill: 'في المسار الصحيح',
      timeline: {
        submitted: 'تم تقديم الطلب عبر الإنترنت',
        today: 'اليوم',
        signature: 'المستندات الأصلية والتوقيع',
        nextAction: 'إجراءك التالي',
        review: 'مراجعة البنك',
        update: 'سنبقيك على اطلاع',
        accountReady: 'الحساب جاهز',
        final: 'تأكيد نهائي من البنك',
      },
      downloadSummary: 'تحميل الملخص',
      restart: 'بدء طلب جديد',
    },
    footer: {
      legal: 'الخصوصية',
      security: 'الأمان',
      accessibility: 'إمكانية الوصول',
    },
  },
}

function App() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [applicationId, setApplicationId] = useState(null)
  const [errors, setErrors] = useState({})
  const [viewMode, setViewMode] = useState('form') 
  const [toast, setToast] = useState('')
  const [mobileVerified, setMobileVerified] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [ocrFiles, setOcrFiles] = useState({ front: null, back: null })
  const [mobileOtpSent, setMobileOtpSent] = useState(false)
  const [language, setLanguage] = useState(() => localStorage.getItem('nbe_lang') || 'en')
  const headingRef = useRef(null)

  const t = translations[language]

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
          if (!String(form[field.name] || '').trim()) nextErrors[field.name] = `${field.label} is required.`
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
          if (!form[name].trim()) nextErrors[name] = `${t.fieldLabels[name]} is required.`
        },
      )
      ;[...employmentFields, ...accountPreferenceFields]
        .filter((field) => field.required)
        .forEach((field) => {
          if (!String(form[field.name] || '').trim()) nextErrors[field.name] = `${field.label} is required.`
        })
      if (!form.accountTransactionTypes?.length) {
        nextErrors.accountTransactionTypes = 'Choose at least one account transaction type.'
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
    setSubmitted(false)
    setApplicationId(null)
    localStorage.removeItem('nbe_app_id')
    focusHeading()
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
          status: overrideStatus,
          currentStep: overrideStep || onboardingStepKeys[step]
        })
      })

      if (!updateRes.ok) throw new Error('Failed to save profile data.')

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
  if (viewMode === 'crm') {
    return <CrmDashboard onBackToForm={() => setViewMode('form')} />
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
        onOpenCrm={() => setViewMode('crm')}
        t={t}
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
            <ApplicationStep form={form} errors={errors} update={update} t={t} />
          )}
          {step === 5 && (
            <ReviewStep form={form} errors={errors} update={update} goTo={setStep} t={t} />
          )}
          {step === 6 && (
            <SuccessStep form={form} referenceNumber={referenceNumber} restart={restart} t={t} />
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

function Header({ onSave, mobileNavOpen, setMobileNavOpen, language, toggleLanguage,onOpenCrm, t }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#main-content" aria-label="National Bank of Egypt home">
          <img className="brand-logo" src="/image.png" alt="" />
        </a>
        <nav className={`header-actions ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Support navigation">
          <button
            type="button"
            className="header-link"
            onClick={onOpenCrm}
            style={{ color: '#006643', fontWeight: '700' }}
          >
            <Building2 size={18} /> Staff CRM
          </button>
          <button type="button" className={`lang-toggle ${language === 'ar' ? 'is-ar' : 'is-en'}`} onClick={toggleLanguage} aria-label={t.languageLabel}>
            <span className="lang-toggle-track">
              <span className="lang-toggle-label en">EN</span>
              <span className="lang-toggle-label ar">AR</span>
              <span className="lang-toggle-thumb" aria-hidden="true" />
            </span>
          </button>
          <button type="button" className="header-link" onClick={() => alert('Call NBE support at 19623 for assistance.')}>
            <CircleHelp size={18} aria-hidden="true" /> {t.help}
          </button>
          <button type="button" className="save-button" onClick={onSave}>
            <Save size={17} aria-hidden="true" /> {t.saveExit}
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

function JourneyNav({ step, onStepSelect, submitted, t }) {
  return (
    <aside className="journey-nav" aria-label="Application progress">
      <p className="journey-label">{t.accountOpening}</p>
      <ol>
        {t.steps.map((item, index) => {
          const complete = index < step
          const active = index === step
          const canVisit = index < step || (submitted && index === 6)
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

function PrepareStep({ form, errors, onToggle, t }) {
  const requirements = [
    ['newCustomer', t.prepare.requirements[0]],
    ['resident', t.prepare.requirements[1]],
    ['age', t.prepare.requirements[2]],
    ['validId', t.prepare.requirements[3]],
  ]

  return (
    <div className="step-body">
      <p className="lead">{t.prepare.lead}</p>

      <fieldset className={`checklist-fieldset ${errors.eligibility ? 'has-error' : ''}`}>
        <legend>{t.prepare.legend}</legend>
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
      <h2>{t.prepare.laterTitle}</h2>
      <div className="document-preview">
        {t.prepare.docs.map((doc) => (
          <div key={doc.title}><FileText size={21} /><span><strong>{doc.title}</strong><small>{doc.hint}</small></span></div>
        ))}
      </div>
      <button type="button" className="text-button"><Info size={17} /> {t.prepare.branchLink}</button>
    </div>
  )
}

function IdentityStep({ form, errors, update, ocrFiles, setOcrFiles, ocrResult, onOcrResult, t }) {
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
      setOcrError('Upload the front and back of the National ID before scanning.')
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
        throw new Error(payload.message || 'We could not scan this image.')
      }

      onOcrResult(payload)
      setOcrStatus(payload.extracted?.nationalId ? 'complete' : 'needs-review')
      if (!payload.extracted?.nationalId) {
        setOcrError(t.identity.scanError)
      }
    } catch (error) {
      setOcrStatus('failed')
      setOcrError(error.message || 'OCR is unavailable. You can still enter the number manually.')
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
            label="Front"
            file={ocrFiles.front}
            inputRef={frontInputRef}
            onSelect={(event) => selectOcrFile('front', event)}
            onRemove={() => removeOcrFile('front')}
          />
          <OcrImagePicker
            label="Back"
            file={ocrFiles.back}
            inputRef={backInputRef}
            onSelect={(event) => selectOcrFile('back', event)}
            onRemove={() => removeOcrFile('back')}
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
              <strong>{ocrError ? 'Review OCR result' : 'OCR fields applied'}</strong>
              <p>{ocrError || 'Check the extracted fields below before continuing.'}</p>
            </div>
          </div>
          {ocrResult?.extracted && (
            <dl className="ocr-fields">
              <div><dt>National ID</dt><dd>{ocrResult.extracted.nationalId || '—'}</dd></div>
              <div><dt>Date of birth</dt><dd>{ocrResult.extracted.dateOfBirth || '—'}</dd></div>
              <div><dt>First name</dt><dd>{ocrResult.extracted.firstNameAr || '—'}</dd></div>
              <div><dt>Middle name</dt><dd>{ocrResult.extracted.middleNameAr || '—'}</dd></div>
              <div><dt>Last name</dt><dd>{ocrResult.extracted.lastNameAr || '—'}</dd></div>
              <div><dt>Gender</dt><dd>{ocrResult.extracted.gender || '—'}</dd></div>
              <div><dt>Place of birth</dt><dd>{ocrResult.extracted.placeOfBirth || ocrResult.extracted.governorate || '—'}</dd></div>
              <div><dt>Issue year and month</dt><dd>{ocrResult.extracted.nationalIdIssueDate || ocrResult.extracted.nationalIdIssueMonth || '—'}</dd></div>
              <div><dt>Expiry date</dt><dd>{ocrResult.extracted.nationalIdExpiryDate || '—'}</dd></div>
              <div><dt>Printed number</dt><dd>{ocrResult.extracted.nationalIdCardPrintedNumber || '—'}</dd></div>
              <div><dt>Address</dt><dd>{ocrResult.extracted.idResidenceAddressAr || ocrResult.extracted.address || '—'}</dd></div>
              <div><dt>Occupation</dt><dd>{ocrResult.extracted.occupation || '—'}</dd></div>
              <div><dt>Religion</dt><dd>{ocrResult.extracted.religion || '—'}</dd></div>
              <div><dt>Marital status</dt><dd>{ocrResult.extracted.maritalStatusAr || ocrResult.extracted.maritalStatus || '—'}</dd></div>
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

      <FormSection title="Customer and personal identity details">
        <FieldGrid fields={additionalIdentityFields} form={form} errors={errors} update={update} isLoading={isOcrScanning} />
        <div className="eligibility-grid" style={{ marginTop: '18px' }}>
          <CheckboxField name="hasSpecialNeeds" label="I have special needs and can hear, read, and write" checked={form.hasSpecialNeeds} update={update} />
          <CheckboxField name="hasOtherNationality" label="I have another nationality" checked={form.hasOtherNationality} update={update} />
          <CheckboxField name="hasResidencyInOtherCountry" label="I have residency rights in another country" checked={form.hasResidencyInOtherCountry} update={update} />
        </div>
      </FormSection>

    </div>
  )
}

function FaceStep({ form, nationalIdFrontFile, onFaceVerificationResult, t }) {
  return (
    <div className="step-body">
      <p className="lead">{t.face.lead}</p>
      <FaceVerificationPanel
        nationalIdFrontFile={nationalIdFrontFile}
        result={form.faceVerification}
        onResult={onFaceVerificationResult}
      />
    </div>
  )
}

function FaceVerificationPanel({ nationalIdFrontFile, result, onResult }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const capturedFramesRef = useRef([])
  const [cameraStatus, setCameraStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [capturedCount, setCapturedCount] = useState(0)
  const isCameraOn = cameraStatus === 'camera-ready'
  const isWorking = cameraStatus === 'starting' || cameraStatus === 'capturing' || cameraStatus === 'verifying'

  useEffect(() => () => stopCamera(), [])

  const startCamera = async () => {
    if (!nationalIdFrontFile) {
      setMessage('Upload the front of the National ID first.')
      return
    }

    try {
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      capturedFramesRef.current = []
      setCapturedCount(0)
      setCameraStatus('camera-ready')
    } catch (_error) {
      setCameraStatus('failed')
      setMessage('Camera access was blocked or unavailable.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const closeCamera = () => {
    stopCamera()
    setCameraStatus('idle')
  }

  const captureAndVerify = async () => {
    if (!nationalIdFrontFile) {
      setMessage('Upload the front of the National ID first.')
      return
    }
    if (!videoRef.current || !canvasRef.current) {
      setMessage('Open the camera before verification.')
      return
    }

    setCameraStatus('capturing')
    setMessage('')
    capturedFramesRef.current = []
    setCapturedCount(0)

    for (let index = 0; index < 4; index += 1) {
      const blob = await captureFrame(videoRef.current, canvasRef.current)
      capturedFramesRef.current.push(blob)
      setCapturedCount(index + 1)
      await delay(450)
    }

    setCameraStatus('verifying')
    try {
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
      if (!response.ok) throw new Error(payload.message || 'Face verification failed.')

      onResult(payload)
      setCameraStatus(payload.status === 'verified' ? 'verified' : 'needs-review')
      setMessage(faceStatusMessage(payload))
      stopCamera()
    } catch (error) {
      setCameraStatus('failed')
      setMessage(error.message || 'Face verification is unavailable.')
    }
  }

  return (
    <div className={`face-card ${result?.status === 'verified' ? 'is-verified' : ''}`}>
      <div className="upload-illustration"><Camera size={25} /></div>
      <div className="face-card-main">
        <div className="upload-copy">
          <span className="optional-tag">Face match</span>
          <h2>Verify face against ID photo</h2>
          <p>Open the camera, capture a short selfie burst, and compare it with the National ID front image.</p>
        </div>

        {(isCameraOn || isWorking) && (
          <div className="face-camera-frame">
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} className="visually-hidden" />
          </div>
        )}

        {(message || result) && (
          <div className={`face-result ${result?.status === 'verified' ? 'is-verified' : ''}`}>
            <ShieldCheck size={18} />
            <span>
              {message || faceStatusMessage(result)}
              {result?.bestSimilarity !== undefined && ` Similarity: ${result.bestSimilarity}%.`}
            </span>
          </div>
        )}
      </div>

      <div className="face-actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={isWorking}
          onClick={isCameraOn ? captureAndVerify : startCamera}
        >
          <Camera size={18} /> {faceActionLabel(cameraStatus, capturedCount)}
        </button>
        {isCameraOn && (
          <button type="button" className="icon-button" onClick={closeCamera} aria-label="Close camera">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function captureFrame(video, canvas) {
  const width = video.videoWidth || 960
  const height = video.videoHeight || 720
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(video, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not capture a selfie frame.'))
    }, 'image/jpeg', 0.92)
  })
}

function faceActionLabel(status, capturedCount) {
  if (status === 'starting') return 'Opening camera...'
  if (status === 'capturing') return `Capturing ${capturedCount}/4`
  if (status === 'verifying') return 'Verifying...'
  if (status === 'camera-ready') return 'Capture & verify'
  return 'Open camera'
}

function faceStatusMessage(result) {
  if (!result) return ''
  if (result.status === 'verified') return 'Face match verified.'
  if (result.status === 'manual_review') return 'Face match needs staff review.'
  return 'Face match was not accepted.'
}

function OcrImagePicker({ label, file, inputRef, onSelect, onRemove }) {
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
        <span>{file ? `${label}: ${file.name}` : `${label} image`}</span>
      </button>
      {file && (
        <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()} image`}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}

function ContactStep({ 
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
              label="Confirm email address"
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

      <FormSection title="Correspondence and contact details">
        <div className="form-grid two-columns">
          <Field label="Confirmed mobile number" name="confirmedMobileNumber" value={form.mobile} onChange={() => {}} disabled />
          <Field label="Confirmed email" name="confirmedEmail" value={form.email} onChange={() => {}} disabled />
        </div>
        <FieldGrid fields={correspondenceFields} form={form} errors={errors} update={update} />
      </FormSection>
    </div>
  )
}

function VerificationCard({ icon, title, destination, verified, onEdit, children, t }) {
  return (
    <section className={`verification-card ${verified ? 'is-verified' : ''}`}>
      <div className="verification-heading">
        <div className="verification-icon">{icon}</div>
        <div><h2>{title}</h2><p>{destination}</p></div>
        {verified && <span className="verified-pill"><BadgeCheck size={17} /> {t.verified}</span>}
      </div>
      {verified ? (
        <button className="text-button compact" type="button" onClick={onEdit}>{t.change} {title.toLowerCase()}</button>
      ) : children}
    </section>
  )
}

function OtpInput({ name, label, value, onChange, error, onVerify, verifyLabel }) {
  return (
    <div className="otp-group">
      <div className="field grow">
        <label htmlFor={name}>{label || verifyLabel}</label>
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
      <button className="button button-secondary verify-button" type="button" onClick={onVerify}>
        {verifyLabel}
      </button>
    </div>
  )
}

function FormSection({ title, children }) {
  return (
    <>
      <div className="section-divider" />
      <h2>{title}</h2>
      {children}
    </>
  )
}

function FieldRenderer({ field, form, errors, update, isLoading }) {
  if (field.type === 'select') {
    return (
      <SelectField
        label={`${field.label}${field.required ? ' *' : ''}`}
        name={field.name}
        value={form[field.name] || ''}
        onChange={(value) => update(field.name, value)}
        error={errors[field.name]}
        options={field.options}
        placeholder="Select an option"
        disabled={field.disabled}
        isLoading={isLoading && field.ocr}
      />
    )
  }

  return (
    <Field
      label={`${field.label}${field.required ? ' *' : ''}`}
      name={field.name}
      value={form[field.name] || ''}
      onChange={(value) => update(field.name, value)}
      error={errors[field.name]}
      type={field.type || 'text'}
      inputMode={field.inputMode}
      min={field.min}
      minLength={field.minLength}
      maxLength={field.maxLength}
      disabled={field.disabled}
      isLoading={isLoading && field.ocr}
    />
  )
}

function FieldGrid({ fields, form, errors, update, isLoading = false }) {
  return (
    <div className="form-grid two-columns">
      {fields.map((field) => (
        <FieldRenderer key={field.name} field={field} form={form} errors={errors} update={update} isLoading={isLoading} />
      ))}
    </div>
  )
}

function CheckboxField({ name, label, checked, update }) {
  return (
    <label className="check-card">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => update(name, event.target.checked)} />
      <span className="custom-check"><Check size={15} /></span>
      <span>{label}</span>
    </label>
  )
}

function MultiCheckboxField({ name, legend, options, values, update, error }) {
  const selected = Array.isArray(values) ? values : []
  const toggle = (option) => {
    update(
      name,
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    )
  }

  return (
    <fieldset className={`checklist-fieldset ${error ? 'has-error' : ''}`}>
      <legend>{legend}</legend>
      <div className="eligibility-grid">
        {options.map((option) => (
          <CheckboxField
            key={option}
            name={`${name}-${option}`}
            label={option}
            checked={selected.includes(option)}
            update={() => toggle(option)}
          />
        ))}
      </div>
      {error && <FieldError message={error} />}
    </fieldset>
  )
}

function ApplicationStep({ form, errors, update, t }) {
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
      <p className="lead">{t.application.lead}</p>

      <div className="section-heading"><span>1</span><div><h2>{t.application.sectionTitle}</h2><p>{t.application.sectionDescription}</p></div></div>
      <div className="form-grid two-columns">
        <SelectField label={t.fieldLabels.employment} name="employment" value={form.employment} onChange={(value) => update('employment', value)} error={errors.employment} options={['Employed', 'Self-employed', 'Retired', 'Student', 'Not currently employed']} placeholder={t.selectOption} />
        <SelectField label={t.fieldLabels.income} name="income" value={form.income} onChange={(value) => update('income', value)} error={errors.income} options={['Less than EGP 10,000', 'EGP 10,000–25,000', 'EGP 25,001–50,000', 'More than EGP 50,000']} placeholder={t.selectOption} />
      </div>

      <FormSection title="Social, housing, and education details">
        <FieldGrid fields={socialFields} form={form} errors={errors} update={update} />
      </FormSection>

      <FormSection title="Employment and income details">
        <FieldGrid fields={employmentFields} form={form} errors={errors} update={update} />
        <div className="eligibility-grid" style={{ marginTop: '18px' }}>
          <CheckboxField name="isOrWasPep" label="I hold or previously held a senior public political, judicial, government, military, or diplomatic role" checked={form.isOrWasPep} update={update} />
        </div>
      </FormSection>

      <FormSection title="Account setup and preferences">
        <FieldGrid fields={accountPreferenceFields} form={form} errors={errors} update={update} />
        <MultiCheckboxField
          name="accountTransactionTypes"
          legend="Account transaction types *"
          options={accountTransactionTypeOptions}
          values={form.accountTransactionTypes}
          update={update}
          error={errors.accountTransactionTypes}
        />
        <div className="eligibility-grid" style={{ marginTop: '18px' }}>
          <CheckboxField name="smsAlertSubscription" label="Subscribe to SMS alerts" checked={form.smsAlertSubscription} update={update} />
          <CheckboxField name="secureCodeSubscription" label="Subscribe to secure code for online purchases" checked={form.secureCodeSubscription} update={update} />
        </div>
      </FormSection>

      {form.employment && (
        <div className="dynamic-checklist">
          <FileCheck2 size={22} />
          <div><strong>{t.application.checklist}</strong><p>{form.employment === 'Employed' ? t.application.employed : form.employment === 'Self-employed' ? t.application.selfEmployed : t.application.other}</p></div>
        </div>
      )}

      <div className={`employment-upload ${form.incomeProofDocument ? 'has-file' : ''}`}>
        <div className="upload-illustration"><FileCheck2 size={25} /></div>
        <div>
          <span className="optional-tag">{t.application.optional}</span>
          <h2>{t.application.uploadTitle}</h2>
          <p>{form.incomeProofDocument ? `${form.incomeProofDocument.name} · ${formatFileSize(form.incomeProofDocument.size)}` : t.application.uploadDescription}</p>
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
              {t.application.remove}
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={() => employmentDocumentRef.current?.click()}>
            <Upload size={18} /> {form.incomeProofDocument ? t.application.replace : t.application.upload}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ form, errors, update, goTo, t }) {
  const methods = [
    { id: 'ebranch', icon: CalendarDays, title: t.review.methods.ebranch, text: t.review.methodText.ebranch, tag: t.review.tags.mostConvenient },
    { id: 'branch', icon: Building2, title: t.review.methods.branch, text: t.review.methodText.branch, tag: '' },
    { id: 'employee', icon: HandHeart, title: t.review.methods.employee, text: t.review.methodText.employee, tag: t.review.tags.eligibilityApplies },
  ]

  return (
    <div className="step-body">
      <p className="lead">{t.review.lead}</p>

      <div className="review-card">
        <ReviewRow title={t.review.identity} value={`National ID ending ${form.nationalId.slice(-4) || '—'} · ${form.dateOfBirth || 'Date of birth not entered'}`} onEdit={() => goTo(1)} t={t} />
        <ReviewRow title={t.review.face} value={faceStatusMessage(form.faceVerification) || 'Face match not completed'} onEdit={() => goTo(2)} t={t} />
        <ReviewRow title={t.review.contact} value={`${form.email || 'Email not entered'} · ${t.verified}`} onEdit={() => goTo(3)} t={t} />
        <ReviewRow title={t.review.identityDetails} value={`${form.fullName || 'Name not entered'} · ${form.governorate || 'Governorate not entered'}`} onEdit={() => goTo(1)} t={t} />
        <ReviewRow title={t.review.employment} value={`${form.employment} · ${form.income} · ${form.incomeProofDocument?.name || 'No HR letter uploaded yet'}`} onEdit={() => goTo(4)} t={t} />
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

function SuccessStep({ form, referenceNumber, restart, t }) {
  const methodNames = {
    ebranch: t.success.method.ebranch,
    branch: t.success.method.branch,
    employee: t.success.method.employee,
  }

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
          <h2>{methodNames[form.method] || 'Complete your documents and signature'}</h2>
          <p>{form.method === 'employee' ? t.success.methodText.employee : form.method === 'ebranch' ? t.success.methodText.ebranch : t.success.methodText.branch}</p>
          <button className="button button-primary" type="button">{form.method === 'ebranch' ? t.success.action.ebranch : form.method === 'employee' ? t.success.action.employee : t.success.action.branch} <ArrowRight size={18} /></button>
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
        <button className="button button-secondary" type="button">{t.success.downloadSummary}</button>
        <button className="text-button" type="button" onClick={restart}>{t.success.restart}</button>
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

function SelectField({ label, name, value, onChange, error, options, isLoading, placeholder, disabled }) {
  return (
    <div className={`field ${isLoading ? 'is-loading' : ''}`} aria-busy={isLoading || undefined}>
      <label htmlFor={name}>{label}</label>
      <select id={name} value={value} onChange={(event) => onChange(event.target.value)} className={`${error ? 'input-error' : ''} ${value ? 'is-filled' : ''} ${isLoading ? 'is-shimmering' : ''}`.trim()} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} disabled={disabled}>
        <option value="">{placeholder || 'Select an option'}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

function FieldError({ id, message }) {
  return <span id={id} className="field-error"><Info size={15} aria-hidden="true" /> {message}</span>
}

function Footer({ t }) {
  return (
    <footer className="site-footer">
      <div><Landmark size={19} /><span>National Bank of Egypt</span></div>
      <nav aria-label="Legal"><a href="#privacy">{t.footer.legal}</a><a href="#security">{t.footer.security}</a><a href="#accessibility">{t.footer.accessibility}</a><a href="tel:19623"><Phone size={14} /> 19623</a></nav>
    </footer>
  )
  
}

export default App
