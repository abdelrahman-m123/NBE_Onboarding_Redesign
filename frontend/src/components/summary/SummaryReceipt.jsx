import React from 'react'
import { Building2, CheckCircle2, ShieldCheck, FileText, Printer, ArrowLeft } from 'lucide-react'

export function SummaryReceipt({ form, referenceNumber, language = 'en', onBack }) {
  const isAr = language === 'ar'

  const methodNames = {
    ebranch: isAr ? 'حجز زيارة فرع إلكتروني (E-Branch)' : 'E-Branch Appointment Visit',
    branch: isAr ? 'زيارة فرع تقليدي' : 'Traditional Branch Visit',
    employee: isAr ? 'طلب زيارة موظف مصرفي' : 'Direct NBE Employee Visit',
  }

  const maskId = (id) => (id && id.length === 14 ? `${id.slice(0, 3)}••••••••${id.slice(-3)}` : id || 'N/A')
  const maskPhone = (phone) => (phone && phone.length === 11 ? `${phone.slice(0, 3)}••••${phone.slice(-4)}` : phone || 'N/A')

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="receipt-container" style={{ maxWidth: '820px', margin: '30px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Controls Bar (Hidden during PDF Printing) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#f0f3f2', border: '1px solid #c8d8d0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          <ArrowLeft size={16} /> {isAr ? 'العودة للتطبيق' : 'Back to Application'}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#006643', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
        >
          <Printer size={16} /> {isAr ? 'طباعة / حفظ PDF' : 'Print / Save as PDF'}
        </button>
      </div>

      {/* Printable Sheet */}
      <div
        id="printable-docket"
        style={{
          background: '#ffffff',
          border: '2px solid #006643',
          borderRadius: '12px',
          padding: '36px',
          color: '#1a2b25',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          direction: isAr ? 'rtl' : 'ltr',
        }}
      >
        {/* Bank Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #006643', paddingBottom: '20px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#006643' }}>
              <Building2 size={32} />
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>
                {isAr ? 'البنك الأهلي المصري' : 'National Bank of Egypt'}
              </h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#52665e' }}>
              {isAr ? 'إشعار استلام وتأكيد طلب فتح حساب رقمي' : 'Digital Account Onboarding Confirmation Docket'}
            </p>
          </div>
          <div style={{ textAlign: isAr ? 'left' : 'right' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#687c74', letterSpacing: '0.05em' }}>
              {isAr ? 'الرقم المرجعي للطلب' : 'Application Reference'}
            </span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#006643', fontFamily: 'monospace', marginTop: '2px' }}>
              {referenceNumber}
            </div>
            <small style={{ color: '#889c94', fontSize: '11px' }}>
              {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
            </small>
          </div>
        </div>

        {/* Status Callout Banner */}
        <div
          style={{
            background: '#eef8f3',
            border: '1px solid #9ccbb8',
            borderRadius: '8px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <CheckCircle2 color="#006643" size={24} />
          <div>
            <strong style={{ color: '#006643', fontSize: '14px', display: 'block' }}>
              {isAr ? 'تم استلام بيانات الطلب الإلكتروني بنجاح' : 'Online Request Submitted Successfully'}
            </strong>
            <span style={{ fontSize: '12px', color: '#40564e' }}>
              {isAr
                ? 'يرجى إحضار هذا الإشعار والمستندات الأصلية عند موعد زيارة البنك لتوقيع عقد فتح الحساب.'
                : 'Please present this confirmation docket with your original documents during your branch or employee visit.'}
            </span>
          </div>
        </div>

        {/* Section 1: Customer Profile Details */}
        <h3 style={{ fontSize: '15px', color: '#006643', borderBottom: '1px solid #dce4e0', paddingBottom: '6px', marginBottom: '14px' }}>
          {isAr ? '١. بيانات العميل المسجلة' : '1. Applicant Information'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '13px', marginBottom: '28px' }}>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'الاسم بالكامل' : 'Full Name'}</span>
            <strong>{form.fullName || 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'الرقم القومي (المشفر)' : 'National ID (Masked)'}</span>
            <strong style={{ fontFamily: 'monospace' }}>{maskId(form.nationalId)}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'تاريخ الميلاد' : 'Date of Birth'}</span>
            <strong>{form.dateOfBirth || 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'المحافظة والعنوان' : 'Governorate & Address'}</span>
            <strong>{form.governorate ? `${form.governorate} · ${form.address || ''}` : 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'رقم الهاتف الموثق' : 'Verified Mobile Number'}</span>
            <strong>{maskPhone(form.mobile)}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'البريد الإلكتروني الموثق' : 'Verified Email Address'}</span>
            <strong>{form.email || 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'الموقف الوظيفي' : 'Employment Status'}</span>
            <strong>{form.employment || 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#687c74', display: 'block', fontSize: '11px' }}>{isAr ? 'نطاق الدخل الشهري' : 'Income Range'}</span>
            <strong>{form.income || 'N/A'}</strong>
          </div>
        </div>

        {/* Section 2: Fulfillment & Completion Plan */}
        <h3 style={{ fontSize: '15px', color: '#006643', borderBottom: '1px solid #dce4e0', paddingBottom: '6px', marginBottom: '14px' }}>
          {isAr ? '٢. وسيلة إتمام التوقيع وتسليم المستندات' : '2. Signature & Fulfillment Method'}
        </h3>
        <div style={{ background: '#f8faf9', padding: '14px 18px', borderRadius: '8px', marginBottom: '28px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#687c74', fontSize: '11px', display: 'block' }}>{isAr ? 'الوسيلة المختارة' : 'Selected Method'}</span>
              <strong style={{ color: '#006643', fontSize: '14px' }}>{methodNames[form.method] || 'Branch Visit'}</strong>
            </div>
            <span style={{ background: '#006643', color: '#fff', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '700' }}>
              {isAr ? 'صالح لمدة ١٠ أيام عمل' : 'Valid 10 Working Days'}
            </span>
          </div>
        </div>

        {/* Section 3: Physical Documents Checklist */}
        <h3 style={{ fontSize: '15px', color: '#006643', borderBottom: '1px solid #dce4e0', paddingBottom: '6px', marginBottom: '14px' }}>
          {isAr ? '٣. قائمة المستندات الأصلية المطلوبة للزيارة' : '3. Required Physical Documents Checklist'}
        </h3>
        <ul style={{ margin: '0 0 28px', paddingInlineStart: '20px', fontSize: '13px', color: '#30423a', lineHeight: '1.8' }}>
          <li>
            <strong>{isAr ? 'أصل بطاقة الرقم القومي سارية' : 'Original valid Egyptian National ID card'}</strong> {isAr ? '(وصورة واضحة منها).' : '(plus one clear photocopy).'}
          </li>
          <li>
            <strong>{isAr ? 'خطاب إثبات الدخل / العمل' : 'Proof of Income / HR Letter'}</strong> {isAr ? '(إن وُجد أو إذا كانت المهنة بالبطاقة تختلف عن الواقع).' : '(if role or income requires confirmation).'}
          </li>
          {form.address && (
            <li>
              <strong>{isAr ? 'إيصال مرافق حديث' : 'Recent Utility Bill'}</strong> {isAr ? '(فقط إذا كان محل السكن الفعلي يختلف عن العنوان بالرقم القومي).' : '(only if current residential address differs from National ID).'}
            </li>
          )}
        </ul>

        {/* Footer Security Notice */}
        <div style={{ borderTop: '1px solid #dce4e0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#748880' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="#006643" />
            <span>{isAr ? 'وثيقة رسمية صادرة آلياً من منظومة البنك الأهلي المصري' : 'System generated official record · National Bank of Egypt'}</span>
          </div>
          <span>{isAr ? 'خدمة العملاء: ١٩٦٢٣' : 'Hotline: 19623'}</span>
        </div>
      </div>
    </div>
  )
}
