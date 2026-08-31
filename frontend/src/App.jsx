import { useMemo, useRef, useState, useEffect } from 'react'
import { StaffLoginModal } from './StaffLoginModal'
import { CrmDashboard } from './CrmDashboard'
import { SummaryReceipt } from './SummaryReceipt'
import { BookingModal } from './BookingModal'
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
  FileCheck2,
  FileText,
  HandHeart,
  Info,
  Landmark,
  LockKeyhole,
  Mail,
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

// Egyptian Civil Registry Governorate Codes
const EGYPT_GOVERNORATE_CODES = {
  '01': 'Cairo',
  '02': 'Alexandria',
  '03': 'Port Said',
  '04': 'Suez',
  '11': 'Damietta',
  '12': 'Dakahlia',
  '13': 'Sharqia',
  '14': 'Qalyubia',
  '15': 'Kafr El Sheikh',
  '16': 'Gharbia',
  '17': 'Monufia',
  '18': 'Beheira',
  '19': 'Ismailia',
  '21': 'Giza',
  '22': 'Beni Suef',
  '23': 'Faiyum',
  '24': 'Minya',
  '25': 'Asyut',
  '26': 'Sohag',
  '27': 'Qena',
  '28': 'Aswan',
  '29': 'Luxor',
  '31': 'Red Sea',
  '32': 'New Valley',
  '33': 'Matrouh',
  '34': 'North Sinai',
  '35': 'South Sinai',
  '88': 'Born outside Egypt',
}

function validateEgyptianNationalId(id, isAr = false) {
  if (!id || id.length !== 14 || !/^\d{14}$/.test(id)) {
    return {
      valid: false,
      message: isAr ? 'يجب أن يتكون الرقم القومي من ١٤ رقماً.' : 'National ID must be exactly 14 digits.',
    }
  }

  // 1. Century Digit Check (2 = 1900-1999, 3 = 2000-2099)
  const centuryDigit = id[0]
  if (centuryDigit !== '2' && centuryDigit !== '3') {
    return {
      valid: false,
      message: isAr
        ? 'رقم قومي غير صالح: يجب أن يبدأ بـ ٢ (مواليد ١٩٠٠-١٩٩٩) أو ٣ (مواليد ٢٠٠٠ فما فوق).'
        : 'Invalid first digit: Must start with 2 (born 1900–1999) or 3 (born 2000+).',
    }
  }

  // 2. Decode Birth Date (C YY MM DD)
  const century = centuryDigit === '2' ? 1900 : 2000
  const yearSuffix = parseInt(id.substring(1, 3), 10)
  const year = century + yearSuffix
  const month = parseInt(id.substring(3, 5), 10)
  const day = parseInt(id.substring(5, 7), 10)

  if (month < 1 || month > 12) {
    return {
      valid: false,
      message: isAr ? 'شهر الميلاد في الرقم القومي غير صالح (من ٠١ إلى ١٢).' : 'Invalid birth month in National ID (must be 01–12).',
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) {
    return {
      valid: false,
      message: isAr ? `يوم الميلاد غير صالح لهذا الشهر (الحد الأقصى ${daysInMonth} يوم).` : `Invalid birth day in National ID for this month.`,
    }
  }

  const birthDate = new Date(year, month - 1, day)
  const today = new Date()

  if (birthDate > today) {
    return {
      valid: false,
      message: isAr ? 'تاريخ الميلاد لا يمكن أن يكون في المستقبل.' : 'Birth date cannot be in the future.',
    }
  }

  // 3. Realistic Age Check (Min 21, Max 100)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  if (age < 21) {
    return {
      valid: false,
      message: isAr
        ? 'يشترط ألا يقل عمر العميل عن ٢١ عاماً لفتح الحساب رقمياً وفقاً لتعليمات البنك المركزي.'
        : 'Applicant must be at least 21 years old as per Central Bank of Egypt onboarding regulations.',
    }
  }

  if (age > 100) {
    return {
      valid: false,
      message: isAr
        ? `تاريخ الميلاد المستخرج (${year}) غير صالح. لمواليد سنة ٢٠٠٠ فما فوق يجب أن يبدأ الرقم القومي بـ ٣.`
        : `Invalid century digit: For births in 2000+, National ID must start with 3, not 2.`,
    }
  }

  // 4. Governorate Code Check
  const govCode = id.substring(7, 9)
  const governorate = EGYPT_GOVERNORATE_CODES[govCode]
  if (!governorate) {
    return {
      valid: false,
      message: isAr ? 'كود المحافظة في الرقم القومي (الرقمان ٨ و ٩) غير مسجل بالسجل المدني.' : 'Invalid governorate registry code (digits 8 & 9).',
    }
  }

  const formattedDob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return {
    valid: true,
    birthDate: formattedDob,
    governorate,
  }
}

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
  method: 'branch',
  terms: false,
  selectedBranch: '',
  appointmentDate: '',
  appointmentSlot: '',
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
    dateFormatHint: 'Decoded automatically (YYYY-MM-DD)',
    nameHint: 'Enter full name (minimum 3 names as on card)',
    addressHint: 'You can update your current residential address later if different',
    mobileHint: 'Must be 11 digits starting with 010, 011, 012, or 015',
    appStatus: 'Application status',
    steps: [
      { short: 'Prepare', title: 'Get ready' },
      { short: 'Identity', title: 'Verify your identity' },
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
      scanHint: '14 digits: Starts with 2 (1900s) or 3 (2000s)',
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
      contact: 'Contact',
      identityDetails: 'Identity details',
      employment: 'Employment',
      methodTitle: 'How would you like to complete your request?',
      methodCopy: 'Your online information will be ready when you arrive.',
      viewDetails: 'View details',
      legalText: 'I have read and agree to the',
      legalLink: 'account-opening terms and conditions',
      legalTextSuffix: 'and confirm that my information is accurate.',
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
    termsModal: {
      title: 'NBE Retail Account Terms & Conditions',
      p1Title: '1. Eligibility & Customer Due Diligence',
      p1Text: 'The applicant confirms accuracy of provided data and compliance with the 21+ age and Egyptian residency mandates.',
      p2Title: '2. Document Authentication',
      p2Text: 'Account activation remains pending until physical verification of the original National ID and physical signature at the branch or during the authorized employee visit.',
      p3Title: '3. Data Privacy & AML Compliance',
      p3Text: 'All customer information is strictly protected under Egyptian Banking Secrecy regulations and Central Bank of Egypt AML/CFT compliance directives.',
      acceptButton: 'I Agree & Accept Terms',
    },
    success: {
      lead: 'Thank you, {name}',
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
    dateFormatHint: 'مستخرج آلياً من الرقم القومي',
    nameHint: 'الاسم كما هو مدون بالبطاقة (ثلاثي على الأقل)',
    addressHint: 'يمكنك تحديث عنوانك الحالي لاحقًا إذا كان مختلفًا',
    mobileHint: '١١ رقماً تبدأ بـ (010, 011, 012, 015)',
    appStatus: 'حالة الطلب',
    steps: [
      { short: 'التجهيز', title: 'استعد' },
      { short: 'الهوية', title: 'تحقق من هويتك' },
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
      scanHint: '١٤ رقماً: يبدأ بـ ٢ (مواليد القرن ٢٠) أو ٣ (مواليد القرن ٢١)',
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
      contact: 'التواصل',
      identityDetails: 'تفاصيل الهوية',
      employment: 'الوظيفة',
      methodTitle: 'كيف تود إكمال طلبك؟',
      methodCopy: 'ستكون معلوماتك عبر الإنترنت جاهزة عند حضورك.',
      viewDetails: 'عرض التفاصيل',
      legalText: 'لقد قرأت وأوافق على',
      legalLink: 'الشروط والأحكام الخاصة بفتح الحساب',
      legalTextSuffix: 'وأؤكد أن معلوماتي دقيقة.',
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
    termsModal: {
      title: 'الشروط والأحكام المصرفية لفتح الحساب',
      p1Title: '١. الأهلية والعناية الواجبة بالعملاء',
      p1Text: 'يقر العميل بصحة البيانات المدخلة وبأنه مواطن مصري مقيم لا يقل عمره عن ٢١ عاماً وفقاً للضوابط المصرفية.',
      p2Title: '٢. التحقق الفعلي والمستندات',
      p2Text: 'لا يعتبر الحساب مفتوحاً أو فعالاً للعمليات إلا بعد مطابقة أصل بطاقة الرقم القومي والتوقيع الفعلي بالفرع أو أمام الموظف المختص.',
      p3Title: '٣. سرية الحسابات ومكافحة غسل الأموال',
      p3Text: 'تخضع كافة البيانات لقواعد حماية سرية حسابات العملاء وتعليمات البنك المركزي المصري ولوائح مكافحة غسل الأموال.',
      acceptButton: 'موافق وقبول الشروط',
    },
    success: {
      lead: 'شكرًا لك، {name}',
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileVerified, setMobileVerified] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [mobileOtpSent, setMobileOtpSent] = useState(false)
  const [language, setLanguage] = useState(() => localStorage.getItem('nbe_lang') || 'en')
  const headingRef = useRef(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)

  const [currentOfficer, setCurrentOfficer] = useState(() => {
    try {
      const saved = sessionStorage.getItem('nbe_staff_auth')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const t = translations[language]
  const isAr = language === 'ar'

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('nbe_lang', language)
  }, [language])

  const toggleLanguage = () => setLanguage((current) => (current === 'en' ? 'ar' : 'en'))

  const progress = Math.round(((step + 1) / (t?.steps?.length || 6)) * 100)
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

        const savedStepIndex = t.steps.findIndex((s) => s.short.toLowerCase() === data.current_step)
        if (savedStepIndex !== -1) {
          setStep(savedStepIndex)
        }

        setForm((current) => ({
          ...current,
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

        showToast(isAr ? 'تم استعادة تقدمك السابق بنجاح.' : 'Your previous progress has been restored.')
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
      governorate: result.extracted.governorate || current.governorate,
      address: result.extracted.address || current.address,
    }))
    setErrors((current) => ({
      ...current,
      nationalId: undefined,
      dateOfBirth: undefined,
      fullName: undefined,
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
      nextErrors.eligibility = isAr
        ? 'يرجى تأكيد جميع شروط الأهلية للمتابعة.'
        : 'Confirm each eligibility requirement to continue.'
    }

    if (step === 1) {
      // 1. Algorithmic National ID validation
      const nidCheck = validateEgyptianNationalId(form.nationalId, isAr)
      if (!nidCheck.valid) {
        nextErrors.nationalId = nidCheck.message
      }

      // 2. Mobile Operator Check (010, 011, 012, 015)
      if (!/^01[0125][0-9]{8}$/.test(form.mobile)) {
        nextErrors.mobile = isAr
          ? 'أدخل رقم هاتف مصري صالح مكون من ١١ رقماً يبدأ بـ (010, 011, 012, 015).'
          : 'Enter a valid 11-digit Egyptian mobile number (010, 011, 012, 015).'
      }

      // 3. Name check
      if (!form.fullName || form.fullName.trim().split(/\s+/).length < 2) {
        nextErrors.fullName = isAr
          ? 'يرجى إدخال الاسم بالكامل (الاسم الأول واسم العائلة على الأقل).'
          : 'Please enter your full name (at least first and last name).'
      }

      // 4. DOB check
      if (!form.dateOfBirth) {
        nextErrors.dateOfBirth = isAr ? 'تاريخ الميلاد مطلوب.' : 'Date of birth is required.'
      } else if (nidCheck.valid && form.dateOfBirth !== nidCheck.birthDate) {
        nextErrors.dateOfBirth = isAr
          ? `تاريخ الميلاد (${form.dateOfBirth}) لا يطابق الرقم القومي (${nidCheck.birthDate}).`
          : `Date of birth does not match National ID (${nidCheck.birthDate}).`
      }

      // 5. Governorate check
      if (!form.governorate) {
        nextErrors.governorate = isAr ? 'المحافظة مطلوبة.' : 'Governorate is required.'
      }
    }

    if (step === 2) {
      if (!mobileVerified) {
        nextErrors.smsOtp = isAr ? 'يرجى تأكيد رقم هاتفك للمتابعة.' : 'Verify your mobile number to continue.'
      }
      if (!/^\S+@\S+\.\S+$/.test(form.email)) {
        nextErrors.email = isAr ? 'أدخل بريداً إلكترونياً صالحاً.' : 'Enter a valid email address.'
      }
      if (!emailVerified) {
        nextErrors.emailOtp = isAr ? 'يرجى تأكيد بريدك الإلكتروني للمتابعة.' : 'Verify your email address to continue.'
      }
    }

    if (step === 3) {
      ;['employment', 'income'].forEach((name) => {
        if (!form[name]?.trim()) {
          nextErrors[name] = isAr ? `${t.fieldLabels[name]} مطلوب.` : `${t.fieldLabels[name]} is required.`
        }
      })
    }

    if (step === 4) {
      if (!form.method) {
        nextErrors.method = isAr ? 'اختر وسيلة استكمال طلبك.' : 'Choose how you will complete your request.'
      }
      if (!form.terms) {
        nextErrors.terms = isAr ? 'يجب قراءة الشروط والأحكام والموافقة عليها.' : 'Read and accept the terms to submit.'
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const next = async () => {
    if (!validateStep()) return

    if (step === 4) {
      setSubmitted(true)
      await handleSave('submitted', 'track')
      showToast(isAr ? 'تم إرسال الطلب بنجاح!' : 'Application successfully submitted!')
    } else {
      handleSave(null, t.steps[step + 1]?.short.toLowerCase())
    }

    setStep((current) => Math.min(current + 1, (t?.steps?.length || 6) - 1))
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
          body: JSON.stringify({ currentStep: t.steps[step]?.short.toLowerCase() || 'prepare' }),
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
          method: form.method,
          status: overrideStatus,
          currentStep: overrideStep || t.steps[step]?.short.toLowerCase() || 'prepare',
          selectedBranch: form.selectedBranch,
          appointmentDate: form.appointmentDate,
          appointmentSlot: form.appointmentSlot,
        }),
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
      showToast(isAr ? 'يرجى إدخال البريد الإلكتروني أولاً.' : 'Please enter an email address first.')
      return
    }

    try {
      let currentAppId = applicationId || (await handleSave())
      if (!currentAppId) return

      const response = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })

      if (!response.ok) throw new Error('Failed to send email.')

      setEmailOtpSent(true)
      showToast(isAr ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني!' : 'Verification code sent to your email!')
    } catch (error) {
      console.error(error)
      showToast(isAr ? 'حدث خطأ في إرسال رمز التحقق.' : 'Error sending verification code.')
    }
  }

  const handleVerifyEmailOtp = async () => {
    if (!form.emailOtp || form.emailOtp.length !== 6) {
      setErrors((current) => ({
        ...current,
        emailOtp: isAr ? 'أدخل الرمز المكون من ٦ أرقام.' : 'Enter the 6-digit code.',
      }))
      return
    }

    try {
      const currentAppId = applicationId || localStorage.getItem('nbe_app_id')
      const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.emailOtp }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Verification failed')

      setEmailVerified(true)
      setErrors((current) => ({ ...current, emailOtp: undefined }))
      showToast(isAr ? 'تم التحقق من البريد الإلكتروني بنجاح!' : 'Email address verified successfully!')
    } catch (error) {
      setErrors((current) => ({
        ...current,
        emailOtp: error.message || (isAr ? 'رمز غير صالح.' : 'Invalid code.'),
      }))
    }
  }

  const handleSendMobileOtp = async () => {
    if (!form.mobile || !/^01[0125][0-9]{8}$/.test(form.mobile)) {
      showToast(
        isAr
          ? 'يرجى إدخال رقم هاتف مصري صالح (010, 011, 012, 015).'
          : 'Please enter a valid 11-digit Egyptian mobile number.'
      )
      return
    }

    try {
      let currentAppId = applicationId || (await handleSave())
      if (!currentAppId) return

      const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch SMS')

      setMobileOtpSent(true)
      showToast(isAr ? 'تم إرسال رمز التحقق!' : 'Verification code dispatched!')
    } catch (error) {
      showToast(error.message)
    }
  }

  const handleVerifyMobileOtp = async () => {
    if (!form.smsOtp || form.smsOtp.length !== 6) {
      setErrors((current) => ({
        ...current,
        smsOtp: isAr ? 'أدخل الرمز المكون من ٦ أرقام.' : 'Enter the 6-digit code.',
      }))
      return
    }

    try {
      const currentAppId = applicationId || localStorage.getItem('nbe_app_id')

      const res = await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/verify-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.smsOtp }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Verification failed')

      setMobileVerified(true)
      setErrors((current) => ({ ...current, smsOtp: undefined }))
      showToast(isAr ? 'تم التحقق من رقم الهاتف بنجاح!' : 'Mobile number verified successfully!')
    } catch (error) {
      setErrors((current) => ({
        ...current,
        smsOtp: error.message || (isAr ? 'رمز غير صالح.' : 'Invalid code.'),
      }))
    }
  }

  const handleConfirmBooking = async (bookingDetails) => {
    update('selectedBranch', bookingDetails.branchName)
    update('appointmentDate', bookingDetails.date)
    update('appointmentSlot', bookingDetails.slot)

    const currentAppId = applicationId || localStorage.getItem('nbe_app_id')
    if (currentAppId) {
      try {
        await fetch(`${API_BASE_URL}/api/applications/${currentAppId}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedBranch: bookingDetails.branchName,
            appointmentDate: bookingDetails.date,
            appointmentSlot: bookingDetails.slot,
            currentStep: 'track',
            status: 'submitted',
          }),
        })
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
    setCurrentOfficer(staffMember)
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
      <a className="skip-link" href="#main-content">
        {t.skipToApplication}
      </a>
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

      {/* Dynamic Booking Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onConfirm={handleConfirmBooking}
        userGovernorate={form.governorate || 'Cairo'}
        methodType={form.method || 'branch'}
        language={language}
      />

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 25, 20, 0.72)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              width: 'min(640px, 92vw)',
              maxHeight: '84vh',
              borderRadius: '12px',
              padding: '28px',
              overflowY: 'auto',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              position: 'relative',
              fontFamily: 'system-ui, sans-serif',
              direction: isAr ? 'rtl' : 'ltr',
              textAlign: isAr ? 'right' : 'left',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #dce4e0',
                paddingBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#006643' }}>
                <ShieldCheck size={24} />
                <h2 style={{ fontSize: '18px', color: '#10281f', margin: 0 }}>
                  {t.termsModal.title}
                </h2>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#60706a',
                  padding: '4px',
                }}
                aria-label="Close terms modal"
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                fontSize: '13px',
                color: '#384c44',
                lineHeight: '1.75',
                marginBottom: '22px',
              }}
            >
              <p style={{ margin: '0 0 14px' }}>
                <strong style={{ color: '#006643', display: 'block', marginBottom: '2px' }}>
                  {t.termsModal.p1Title}
                </strong>
                {t.termsModal.p1Text}
              </p>
              <p style={{ margin: '0 0 14px' }}>
                <strong style={{ color: '#006643', display: 'block', marginBottom: '2px' }}>
                  {t.termsModal.p2Title}
                </strong>
                {t.termsModal.p2Text}
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#006643', display: 'block', marginBottom: '2px' }}>
                  {t.termsModal.p3Title}
                </strong>
                {t.termsModal.p3Text}
              </p>
            </div>

            <button
              type="button"
              className="button button-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              onClick={() => {
                update('terms', true)
                setShowTermsModal(false)
              }}
            >
              <Check size={17} /> {t.termsModal.acceptButton}
            </button>
          </div>
        </div>
      )}

      <div className="progress-strip" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <main id="main-content" className="page-wrap">
        <JourneyNav step={step} onStepSelect={setStep} submitted={submitted} t={t} />

        <section className="content-panel" aria-labelledby="page-title">
          <div className="step-kicker">
            {t.step} {step + 1} {t.of} {t?.steps?.length || 6}
          </div>
          <h1 id="page-title" tabIndex="-1" ref={headingRef}>
            {t.steps[step]?.title || ''}
          </h1>

          {step === 0 && (
            <PrepareStep form={form} errors={errors} onToggle={updateEligibility} t={t} />
          )}
          {step === 1 && (
            <IdentityStep
              form={form}
              errors={errors}
              update={update}
              ocrResult={ocrResult}
              onOcrResult={applyOcrResult}
              language={language}
              t={t}
            />
          )}
          {step === 2 && (
            <ContactStep
              form={form}
              applicationId={applicationId}
              errors={errors}
              update={update}
              mobileVerified={mobileVerified}
              emailVerified={emailVerified}
              verifyMobile={handleVerifyMobileOtp}
              verifyEmail={handleVerifyEmailOtp}
              resetMobile={() => {
                setMobileVerified(false)
                setMobileOtpSent(false)
              }}
              resetEmail={() => {
                setEmailVerified(false)
                setEmailOtpSent(false)
              }}
              showToast={showToast}
              mobileOtpSent={mobileOtpSent}
              onSendMobileOtp={handleSendMobileOtp}
              emailOtpSent={emailOtpSent}
              onSendEmailOtp={handleSendEmailOtp}
              t={t}
            />
          )}
          {step === 3 && (
            <ApplicationStep form={form} errors={errors} update={update} t={t} />
          )}
          {step === 4 && (
            <ReviewStep
              form={form}
              errors={errors}
              update={update}
              goTo={setStep}
              onOpenTermsModal={() => setShowTermsModal(true)}
              t={t}
            />
          )}
          {step === 5 && (
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

          {step < 5 && (
            <div className="form-actions">
              {step > 0 ? (
                <button className="button button-secondary" type="button" onClick={back}>
                  {isAr ? (
                    <ArrowRight size={18} aria-hidden="true" />
                  ) : (
                    <ArrowLeft size={18} aria-hidden="true" />
                  )}{' '}
                  {t.back}
                </button>
              ) : (
                <span />
              )}
              <button className="button button-primary" type="button" onClick={next}>
                {isAr ? (
                  <ArrowLeft size={18} aria-hidden="true" />
                ) : (
                  <ArrowRight size={18} aria-hidden="true" />
                )}
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

function Header({ onSave, mobileNavOpen, setMobileNavOpen, language, toggleLanguage, onOpenCrm, t }) {
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
          <button
            type="button"
            className={`lang-toggle ${language === 'ar' ? 'is-ar' : 'is-en'}`}
            onClick={toggleLanguage}
            aria-label={t.languageLabel}
          >
            <span className="lang-toggle-track">
              <span className="lang-toggle-label en">EN</span>
              <span className="lang-toggle-label ar">AR</span>
              <span className="lang-toggle-thumb" aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            className="header-link"
            onClick={() => alert('Call NBE support at 19623 for assistance.')}
          >
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
              <span className="custom-check">
                <Check size={15} />
              </span>
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
          <div key={doc.title}>
            <FileText size={21} />
            <span>
              <strong>{doc.title}</strong>
              <small>{doc.hint}</small>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="text-button">
        <Info size={17} /> {t.prepare.branchLink}
      </button>
    </div>
  )
}

function IdentityStep({ form, errors, update, ocrResult, onOcrResult, language, t }) {
  const fileInputRef = useRef(null)
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrError, setOcrError] = useState('')
  const isOcrScanning = ocrStatus === 'scanning'
  const isAr = language === 'ar'

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
        setOcrError(t.identity.scanError)
      }
    } catch (error) {
      setOcrStatus('failed')
      setOcrError(error.message || 'OCR is unavailable. You can still enter the number manually.')
    } finally {
      event.target.value = ''
    }
  }

  const handleNationalIdChange = (value) => {
    const cleanId = value.replace(/\D/g, '').slice(0, 14)
    update('nationalId', cleanId)

    // Real-time decoding
    if (cleanId.length === 14) {
      const decoded = validateEgyptianNationalId(cleanId, isAr)
      if (decoded.valid) {
        update('dateOfBirth', decoded.birthDate)
        if (!form.governorate) {
          update('governorate', decoded.governorate)
        }
      }
    }
  }

  return (
    <div className="step-body">
      <p className="lead">{t.identity.lead}</p>

      <div className="form-grid two-columns">
        <Field
          label={t.fieldLabels.nationalId}
          name="nationalId"
          value={form.nationalId}
          onChange={handleNationalIdChange}
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
          placeholder="1998-10-24"
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
          placeholder="Mostafa Fouad Ahmed"
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
          placeholder="Ezzat Salama St, Nasr City"
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
          placeholder="01012345678"
          isComplete={/^01[0125][0-9]{8}$/.test(form.mobile)}
        />
      </div>

      <div className="upload-card">
        <div className="upload-illustration">
          <UserRound size={26} />
        </div>
        <div className="upload-copy">
          <span className="optional-tag">{t.identity.scanRecommended}</span>
          <h2>{t.identity.scanTitle}</h2>
          <p>{t.identity.scanDescription}</p>
          {ocrError && <p style={{ color: '#b42318', marginTop: '6px', fontWeight: '600' }}>{ocrError}</p>}
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
          <Upload size={18} /> {ocrStatus === 'scanning' ? t.identity.scanning : t.identity.scanButton}
        </button>
      </div>
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
  t,
}) {
  const maskedMobile = form.mobile
    ? `${form.mobile.slice(0, 3)} •••• ${form.mobile.slice(-4)}`
    : '01• •••• ••••'

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
              onChange={(value) => {
                update('mobile', value)
                resetMobile()
              }}
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
              <span>
                {t.contact.expiresIn} <strong>05:00</strong>
              </span>
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
              onChange={(value) => {
                update('email', value)
                resetEmail()
              }}
              error={errors.email}
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
              <span>
                {t.contact.expiresIn} <strong>05:00</strong>
              </span>
              <button type="button" onClick={onSendEmailOtp}>
                {t.contact.resendEmail}
              </button>
            </div>
          </div>
        )}
      </VerificationCard>

      <div className="security-banner">
        <ShieldCheck size={21} />
        <span>{t.contact.security}</span>
      </div>
    </div>
  )
}

function VerificationCard({ icon, title, destination, verified, onEdit, children, t }) {
  return (
    <section className={`verification-card ${verified ? 'is-verified' : ''}`}>
      <div className="verification-heading">
        <div className="verification-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{destination}</p>
        </div>
        {verified && (
          <span className="verified-pill">
            <BadgeCheck size={17} /> {t.verified}
          </span>
        )}
      </div>
      {verified ? (
        <button className="text-button compact" type="button" onClick={onEdit}>
          {t.change} {title.toLowerCase()}
        </button>
      ) : (
        children
      )}
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

      <div className="section-heading">
        <span>1</span>
        <div>
          <h2>{t.application.sectionTitle}</h2>
          <p>{t.application.sectionDescription}</p>
        </div>
      </div>
      <div className="form-grid two-columns">
        <SelectField
          label={t.fieldLabels.employment}
          name="employment"
          value={form.employment}
          onChange={(value) => update('employment', value)}
          error={errors.employment}
          options={['Employed', 'Self-employed', 'Retired', 'Student', 'Not currently employed']}
          placeholder={t.selectOption}
        />
        <SelectField
          label={t.fieldLabels.income}
          name="income"
          value={form.income}
          onChange={(value) => update('income', value)}
          error={errors.income}
          options={[
            'Less than EGP 10,000',
            'EGP 10,000–25,000',
            'EGP 25,001–50,000',
            'More than EGP 50,000',
          ]}
          placeholder={t.selectOption}
        />
      </div>

      {form.employment && (
        <div className="dynamic-checklist">
          <FileCheck2 size={22} />
          <div>
            <strong>{t.application.checklist}</strong>
            <p>
              {form.employment === 'Employed'
                ? t.application.employed
                : form.employment === 'Self-employed'
                ? t.application.selfEmployed
                : t.application.other}
            </p>
          </div>
        </div>
      )}

      <div className={`employment-upload ${form.incomeProofDocument ? 'has-file' : ''}`}>
        <div className="upload-illustration">
          <FileCheck2 size={25} />
        </div>
        <div>
          <span className="optional-tag">{t.application.optional}</span>
          <h2>{t.application.uploadTitle}</h2>
          <p>
            {form.incomeProofDocument
              ? `${form.incomeProofDocument.name} · ${formatFileSize(form.incomeProofDocument.size)}`
              : t.application.uploadDescription}
          </p>
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
            <button
              className="text-button compact"
              type="button"
              onClick={() => update('incomeProofDocument', null)}
            >
              {t.application.remove}
            </button>
          )}
          <button
            className="button button-secondary"
            type="button"
            onClick={() => employmentDocumentRef.current?.click()}
          >
            <Upload size={18} /> {form.incomeProofDocument ? t.application.replace : t.application.upload}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ form, errors, update, goTo, onOpenTermsModal, t }) {
  const methods = [
    {
      id: 'ebranch',
      icon: CalendarDays,
      title: t.review.methods.ebranch,
      text: t.review.methodText.ebranch,
      tag: t.review.tags.mostConvenient,
    },
    { id: 'branch', icon: Building2, title: t.review.methods.branch, text: t.review.methodText.branch, tag: '' },
    {
      id: 'employee',
      icon: HandHeart,
      title: t.review.methods.employee,
      text: t.review.methodText.employee,
      tag: t.review.tags.eligibilityApplies,
    },
  ]

  return (
    <div className="step-body">
      <p className="lead">{t.review.lead}</p>

      <div className="review-card">
        <ReviewRow
          title={t.review.identity}
          value={`National ID ending ${form.nationalId.slice(-4) || '—'} · ${
            form.dateOfBirth || 'Date of birth not entered'
          }`}
          onEdit={() => goTo(1)}
          t={t}
        />
        <ReviewRow
          title={t.review.contact}
          value={`${form.email || 'Email not entered'} · ${t.verified}`}
          onEdit={() => goTo(2)}
          t={t}
        />
        <ReviewRow
          title={t.review.identityDetails}
          value={`${form.fullName || 'Name not entered'} · ${form.governorate || 'Governorate not entered'}`}
          onEdit={() => goTo(1)}
          t={t}
        />
        <ReviewRow
          title={t.review.employment}
          value={`${form.employment || 'Employment not selected'} · ${form.income || 'Income not selected'} · ${
            form.incomeProofDocument?.name || 'No HR letter uploaded yet'
          }`}
          onEdit={() => goTo(3)}
          t={t}
        />
      </div>

      <div className="section-divider" />
      <h2>{t.review.methodTitle}</h2>
      <p className="section-copy">{t.review.methodCopy}</p>
      <div className={`method-grid ${errors.method ? 'has-error' : ''}`}>
        {methods.map(({ id, icon: Icon, title, text, tag }) => (
          <label className={`method-card ${form.method === id ? 'selected' : ''}`} key={id}>
            <input
              type="radio"
              name="method"
              value={id}
              checked={form.method === id}
              onChange={() => update('method', id)}
            />
            <span className="radio-mark" />
            <Icon size={25} />
            {tag && <span className="method-tag">{tag}</span>}
            <strong>{title}</strong>
            <p>{text}</p>
            <span className="learn-more">
              {t.review.viewDetails} <ChevronRight size={15} />
            </span>
          </label>
        ))}
      </div>
      {errors.method && <FieldError message={errors.method} />}

      {/* Terms Checkbox with Modal Trigger */}
      <div className="terms-box">
        <label className="terms-check">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(event) => update('terms', event.target.checked)}
          />
          <span className="custom-check">
            <Check size={15} />
          </span>
          <span>
            {t.review.legalText}{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onOpenTermsModal()
              }}
              style={{
                color: '#006643',
                fontWeight: '750',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {t.review.legalLink}
            </button>{' '}
            {t.review.legalTextSuffix}
          </span>
        </label>
        {errors.terms && <FieldError message={errors.terms} />}
      </div>

      <div className="security-banner">
        <LockKeyhole size={20} />
        <span>{t.review.securityNote}</span>
      </div>
    </div>
  )
}

function ReviewRow({ title, value, onEdit, t }) {
  return (
    <div className="review-row">
      <div>
        <strong>{title}</strong>
        <p>{value}</p>
      </div>
      <button type="button" onClick={onEdit}>
        {t.review.edit}
      </button>
    </div>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SuccessStep({ form, referenceNumber, restart, onDownloadSummary, onOpenBooking, language = 'en', t }) {
  const methodKey = form.method || 'branch'
  const firstName = form.fullName?.trim().split(' ')[0] || t.success.requestReady
  const isAr = language === 'ar'

  const hasAppointment = Boolean(form.appointmentDate && form.selectedBranch)

  return (
    <div className="step-body success-body">
      <div className="success-mark">
        <Check size={34} />
      </div>
      <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#17382b', margin: '0 0 8px' }}>
        {t.success.lead.replace('{name}', firstName)}.
      </h2>
      <p style={{ color: '#60706a', margin: '0 0 20px' }}>
        {t.success.confirmation} <strong>{form.email || 'your verified email'}</strong>.
      </p>

      <div className="reference-card">
        <span>{t.applicationReference}</span>
        <strong>{referenceNumber}</strong>
        <button type="button" onClick={() => navigator.clipboard?.writeText(referenceNumber)}>
          {t.copy}
        </button>
      </div>

      {/* Interactive Next Step & Appointment Booking Card */}
      <div className="next-step-card">
        <div className="next-step-icon">
          <CalendarDays size={25} />
        </div>
        <div style={{ flex: 1 }}>
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
        <div className="status-heading">
          <div>
            <span className="eyebrow">{t.appStatus}</span>
            <h2>{t.success.statusTitle}</h2>
          </div>
          <span className="status-pill">{t.success.statusPill}</span>
        </div>
        <ol className="status-timeline">
          <li className="done">
            <span>
              <Check size={14} />
            </span>
            <div>
              <strong>{t.success.timeline.submitted}</strong>
              <small>{t.success.timeline.today}</small>
            </div>
          </li>
          <li className="active">
            <span>2</span>
            <div>
              <strong>{t.success.timeline.signature}</strong>
              <small>{t.success.timeline.nextAction}</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>{t.success.timeline.review}</strong>
              <small>{t.success.timeline.update}</small>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <strong>{t.success.timeline.accountReady}</strong>
              <small>{t.success.timeline.final}</small>
            </div>
          </li>
        </ol>
      </div>

      <div className="success-actions">
        <button className="button button-secondary" type="button" onClick={onDownloadSummary}>
          <FileText size={17} /> {t.success.downloadSummary}
        </button>
        <button className="text-button" type="button" onClick={restart}>
          {t.success.restart}
        </button>
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
        className={`${error ? 'input-error' : ''} ${filled ? 'is-filled' : ''} ${
          isLoading ? 'is-shimmering' : ''
        }`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...props}
      />
      {hint && !error && <small id={`${name}-hint`}>{hint}</small>}
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

function SelectField({ label, name, value, onChange, error, options, isLoading, placeholder }) {
  return (
    <div className={`field ${isLoading ? 'is-loading' : ''}`} aria-busy={isLoading || undefined}>
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${error ? 'input-error' : ''} ${value ? 'is-filled' : ''} ${
          isLoading ? 'is-shimmering' : ''
        }`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <option value="">{placeholder || 'Select an option'}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <FieldError id={`${name}-error`} message={error} />}
    </div>
  )
}

function FieldError({ id, message }) {
  return (
    <span id={id} className="field-error">
      <Info size={15} aria-hidden="true" /> {message}
    </span>
  )
}

function Footer({ t }) {
  return (
    <footer className="site-footer">
      <div>
        <Landmark size={19} />
        <span>National Bank of Egypt</span>
      </div>
      <nav aria-label="Legal">
        <a href="#privacy">{t.footer.legal}</a>
        <a href="#security">{t.footer.security}</a>
        <a href="#accessibility">{t.footer.accessibility}</a>
        <a href="tel:19623">
          <Phone size={14} /> 19623
        </a>
      </nav>
    </footer>
  )
}

export default App