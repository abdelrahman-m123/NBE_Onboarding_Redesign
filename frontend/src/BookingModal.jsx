import React, { useState, useMemo, useEffect } from 'react'
import { Calendar, Clock, MapPin, CheckCircle2, X, Building2, Zap } from 'lucide-react'
import { NBE_BRANCHES_CATALOG, TRADITIONAL_TIME_SLOTS, EBRANCH_TIME_SLOTS } from './branches'

export function BookingModal({
  isOpen,
  onClose,
  onConfirm,
  userGovernorate = 'Cairo',
  methodType = 'branch',
  language = 'en',
}) {
  const isAr = language === 'ar'

  // Filter branches by matching Governorate and Channel Type
  const availableBranches = useMemo(() => {
    const targetGov = userGovernorate || 'Cairo'
    const targetType = methodType === 'ebranch' ? 'ebranch' : 'branch'

    let matches = NBE_BRANCHES_CATALOG.filter(
      (b) => b.governorate.toLowerCase() === targetGov.toLowerCase() && b.type === targetType
    )

    if (matches.length === 0) {
      matches = NBE_BRANCHES_CATALOG.filter((b) => b.type === targetType)
    }

    return matches.length > 0 ? matches : NBE_BRANCHES_CATALOG
  }, [userGovernorate, methodType])

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  })

  // Sync selected branch ID when catalog changes
  useEffect(() => {
    if (availableBranches.length > 0) {
      setSelectedBranchId(availableBranches[0].id)
    }
  }, [availableBranches])

  const activeBranch = availableBranches.find((b) => b.id === selectedBranchId) || availableBranches[0]

  // Dynamically select the slot schedule: Traditional (ends 2:30 PM) vs E-Branch (ends 6:00 PM)
  const timeSlots = useMemo(() => {
    if (activeBranch?.type === 'ebranch') {
      return EBRANCH_TIME_SLOTS
    }
    return TRADITIONAL_TIME_SLOTS
  }, [activeBranch])

  const [selectedSlot, setSelectedSlot] = useState(timeSlots[0])

  // Reset selected slot if slot list changes
  useEffect(() => {
    if (timeSlots.length > 0) {
      setSelectedSlot(timeSlots[0])
    }
  }, [timeSlots])

  if (!isOpen) return null

  const handleBooking = () => {
    if (!activeBranch) return
    onConfirm({
      branchId: activeBranch.id,
      branchName: isAr ? activeBranch.nameAr : activeBranch.nameEn,
      branchType: activeBranch.type,
      governorate: activeBranch.governorate,
      date: selectedDate,
      slot: selectedSlot,
    })
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 25, 20, 0.72)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
        direction: isAr ? 'rtl' : 'ltr',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          width: 'min(680px, 94vw)',
          maxHeight: '88vh',
          borderRadius: '12px',
          padding: '28px',
          overflowY: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
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
            <Building2 size={24} />
            <h2 style={{ fontSize: '18px', margin: 0, color: '#10281f' }}>
              {methodType === 'ebranch'
                ? isAr
                  ? 'حجز موعد بفرع إلكتروني (E-Branch)'
                  : 'Book an E-Branch Digital Appointment'
                : isAr
                ? 'حجز موعد بفرع البنك الأهلي المصري'
                : 'Book a Traditional Branch Visit'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#60706a',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Indicator Badge */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '18px',
            fontSize: '12px',
            color: '#495a53',
            background: '#f4f7f6',
            padding: '8px 12px',
            borderRadius: '6px',
          }}
        >
          <MapPin size={15} color="#006643" />
          <span>
            {isAr
              ? `المحافظة المحددة: ${userGovernorate || 'القاهرة'} | نوع الفرع: ${
                  methodType === 'ebranch' ? 'فرع إلكتروني للخدمة الذاتية' : 'فرع تقليدي'
                }`
              : `Filtered for: ${userGovernorate || 'Cairo'} | Channel: ${
                  methodType === 'ebranch' ? 'Self-Service E-Branch' : 'Traditional Retail Branch'
                }`}
          </span>
        </div>

        {/* 1. Branch Selector */}
        <div style={{ marginBottom: '18px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              marginBottom: '6px',
              color: '#2b3a34',
            }}
          >
            {isAr ? 'اختر الفرع المتاح' : 'Available Branches'}
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #b8c8c2',
              fontSize: '14px',
              backgroundColor: '#fff',
            }}
          >
            {availableBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.nameAr : b.nameEn} ({b.governorate})
              </option>
            ))}
          </select>
        </div>

        {/* Branch Operating Info Card */}
        {activeBranch && (
          <div
            style={{
              background: '#f0faf5',
              border: '1px solid #9ccbb8',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '20px',
              fontSize: '12px',
              color: '#23443a',
            }}
          >
            <div>
              <strong>{isAr ? 'العنوان:' : 'Address:'}</strong>{' '}
              {isAr ? activeBranch.addressAr : activeBranch.addressEn}
            </div>
            <div style={{ marginTop: '5px' }}>
              <strong>{isAr ? 'مواعيد العمل الرسمية:' : 'Official Working Hours:'}</strong>{' '}
              {isAr ? activeBranch.hoursAr : activeBranch.hoursEn}
            </div>
            {activeBranch.instantCard ? (
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#006643',
                  fontWeight: '750',
                }}
              >
                <Zap size={15} />{' '}
                {isAr
                  ? 'خاصية إصدار وطباعة بطاقة الخصم المباشر الفورية متاحة بهذا الفرع'
                  : 'Instant Debit Card Printing kiosk available at this branch'}
              </div>
            ) : (
              <div style={{ marginTop: '8px', color: '#687c74' }}>
                {isAr
                  ? 'يتم تسليم بطاقة الخصم عبر موظف خدمة العملاء داخل الفرع'
                  : 'Standard debit card delivery via Customer Service Representative'}
              </div>
            )}
          </div>
        )}

        {/* 2. Date & Time Selection with Schedule Boundaries */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 'bold',
                marginBottom: '6px',
                color: '#2b3a34',
              }}
            >
              <Calendar size={15} style={{ verticalAlign: 'middle', marginInlineEnd: '4px' }} />
              {isAr ? 'تاريخ الزيارة' : 'Appointment Date'}
            </label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #b8c8c2',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 'bold',
                marginBottom: '6px',
                color: '#2b3a34',
              }}
            >
              <Clock size={15} style={{ verticalAlign: 'middle', marginInlineEnd: '4px' }} />
              {isAr ? 'الوقت المتاح للحجز' : 'Available Time Slot'}
            </label>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #b8c8c2',
                fontSize: '14px',
                backgroundColor: '#fff',
              }}
            >
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            <small style={{ color: '#687c74', fontSize: '11px', display: 'block', marginTop: '4px' }}>
              {activeBranch?.type === 'branch'
                ? isAr
                  ? 'آخر موعد حجز متاح ٢:٣٠ م قبل موعد الإغلاق (٣:٠٠ م)'
                  : 'Last appointment is 2:30 PM before 3:00 PM closure'
                : isAr
                ? 'متاح حتى ٦:٠٠ م قبل إغلاق الفرع الإلكتروني (٧:٠٠ م)'
                : 'Slots available until 6:00 PM before 7:00 PM closure'}
            </small>
          </div>
        </div>

        <button
          type="button"
          className="button button-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
          onClick={handleBooking}
        >
          <CheckCircle2 size={18} /> {isAr ? 'تأكيد الحجز وحفظ الموعد' : 'Confirm Appointment'}
        </button>
      </div>
    </div>
  )
}   