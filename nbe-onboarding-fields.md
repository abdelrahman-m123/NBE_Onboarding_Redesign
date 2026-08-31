# NBE New Customer Account Opening — Onboarding Fields

This document inventories the fields visible in the supplied NBE onboarding screenshots for **طلب فتح حساب للعملاء الجدد**.

## Field conventions

- **Required** is based on a visible red asterisk (`*`).
- **Prefilled / read-only** means the screenshot shows a greyed or system-populated value.
- Suggested keys are implementation-friendly names inferred from the Arabic labels; they are not official NBE API field names.
- Dropdown options are listed only where a selected value or visible choices appear in the screenshots.

---

## 1. Identity and mobile verification

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 1 | الرقم القومي | `national_id` | Text input | Not visibly marked | National ID entry. The screen includes an illustration showing where to find the issuance date on the ID card. |
| 2 | رقم الهاتف المحمول | `mobile_number` | Tel/text input | Not visibly marked | Mobile number used to receive the verification code. |
| 3 | رمز التحقق | `mobile_verification_code` | OTP/code input | Not visibly marked | Verification code is sent to the registered mobile number. The displayed validity period is **3 minutes**. |

### Related actions and states

- `تنفيذ` — submit/continue.
- `لإعادة إرسال رمز التحقق` — resend verification code; initially appears disabled with a countdown timer.
- Visible helper text: `سيتم إرسال رمز التحقق على رقم الهاتف المحمول الذي قمت بإدخاله`.

---

## 2. Email verification

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 4 | البريد الإلكتروني | `email` | Email input | Not visibly marked | Primary email address. |
| 5 | تأكيد البريد الإلكتروني | `email_confirmation` | Email input | Not visibly marked | Must repeat/match the email address. |
| 6 | رمز التحقق من البريد الإلكتروني | `email_verification_code` | OTP/code input | Not visibly marked | Appears after requesting email verification. The screenshot shows this input without a visible label, so the name is inferred from the flow. |

### Related actions

- `التحقق من البريد` — request/perform email verification.
- `تنفيذ` — submit the email verification code.

---

## 3. Customer and personal identity details

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 7 | نوعية العميل | `customer_type` | Select | Not visibly marked | Selected value shown: `الأفراد`. |
| 8 | اسم العميل — الاسم الأول (باللغة العربية) | `first_name_ar` | Text input | Yes | First Arabic name. Placeholder: `برجاء إدخال الاسم الأول (باللغة العربية)`. |
| 9 | اسم العميل — الاسم الأوسط (باللغة العربية) | `middle_name_ar` | Text input | Yes | Middle Arabic name. Placeholder: `برجاء إدخال الاسم الأوسط (باللغة العربية)`. |
| 10 | اسم العميل — الاسم الأخير (باللغة العربية) | `last_name_ar` | Text input | Yes | Last Arabic name. Placeholder: `برجاء إدخال الاسم الأخير (باللغة العربية)`. |
| 11 | النوع | `gender` | Select | Not visibly marked | Selected value shown: `ذكر`. |
| 12 | الرقم القومي | `national_id_confirmed` | Prefilled/read-only text | Not visibly marked | Repeated, system-populated National ID. |
| 13 | تاريخ الانتهاء | `national_id_expiry_date` | Date selector | Not visibly marked | National ID expiry date. |
| 14 | تاريخ إصدار بطاقة الرقم القومي | `national_id_issue_date` | Prefilled/read-only date | Yes | ID issuance date. |
| 15 | الرقم المطبوع على البطاقة | `national_id_card_printed_number` | Text input | Yes | Placeholder: `برجاء إدخال الرقم المطبوع على البطاقة`. |
| 16 | تاريخ الميلاد | `date_of_birth` | Prefilled/read-only date | Not visibly marked | Derived/system-populated birth date. |
| 17 | محل الميلاد | `place_of_birth` | Select | Yes | Place of birth. |
| 18 | محل الإقامة من واقع تحقيق الشخصية (باللغة العربية) | `id_residence_address_ar` | Text input | Yes | Maximum **50** characters. |
| 19 | عنوان محل الإقامة (إذا كان هناك اختلاف عن العنوان المدون بمستند تحقيق الشخصية) | `alternate_residence_address_ar` | Text input | Not visibly marked | Maximum **50** characters; used only if the residence differs from the ID address. |
| 20 | هل أنت من ذوي الاحتياجات الخاصة؟ (بشرط القدرة على السمع والقراءة والكتابة) | `has_special_needs` | Checkbox | No | Boolean question. |
| 21 | هل لديك جنسية أخرى؟ | `has_other_nationality` | Checkbox | No | If selected, additional nationality details may be required in a later/conditional view. |
| 22 | هل لديك حق الإقامة في دولة أخرى؟ | `has_residency_in_other_country` | Checkbox | No | If selected, additional country/residency details may be required in a later/conditional view. |

---

## 4. Correspondence and contact details

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 23 | عنوان المراسلات (باللغة العربية) | `correspondence_address_source` | Select | Not visibly marked | Selected value shown: `محل الإقامة بمستند تحقيق الشخصية`. |
| 24 | لغة المراسلات | `correspondence_language` | Select | Not visibly marked | Selected value shown: `عربي`. |
| 25 | رقم الهاتف المحمول | `confirmed_mobile_number` | Prefilled/read-only text | Not visibly marked | Repeated, system-populated mobile number. |
| 26 | التليفون الأرضي (يشمل رمز المحافظة) | `landline_number` | Tel/text input | Not visibly marked | Must include the governorate/area code. |
| 27 | البريد الإلكتروني | `confirmed_email` | Prefilled/read-only text | Not visibly marked | Repeated, verified email address. |
| 28 | طريقة الإرسال | `delivery_method` | Select | Not visibly marked | Selected value shown: `البريد العادي`. |

---

## 5. Social, housing, and education details

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 29 | الحالة الاجتماعية | `marital_status` | Select | Not visibly marked | Marital status. |
| 30 | عدد من يعول | `number_of_dependents` | Number input | Not visibly marked | Placeholder: `برجاء إدخال عدد من يعول`. |
| 31 | طبيعة السكن | `housing_nature` | Select | Not visibly marked | Housing/residence status. |
| 32 | نوع الإيجار | `rental_type` | Select | Not visibly marked | Rental type. This may be conditional on the housing selection. |
| 33 | حالة التعليم | `education_status` | Select | Not visibly marked | Education status/level. |

---

## 6. Employment and income details

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 34 | طبيعة العمل | `employment_nature` | Select | Not visibly marked | Nature/type of employment. |
| 35 | اسم الجهة | `employer_name` | Text input | Yes | Placeholder: `برجاء إدخال اسم الجهة`. |
| 36 | تاريخ بدء العمل | `employment_start_date` | Date selector | Not visibly marked | Start date with the current employer. |
| 37 | عنوان جهة العمل | `employer_address` | Text input | Not visibly marked | Maximum **50** characters. Placeholder: `برجاء إدخال عنوان جهة العمل`. |
| 38 | الراتب الشهري | `monthly_salary` | Number/currency input | Not visibly marked | Placeholder: `برجاء إدخال الراتب الشهري`. |
| 39 | هل تشغل أو سبق لك شغل منصب عام رفيع في الحقل السياسي/القضائي/الحكومي/العسكري/الدبلوماسي؟ | `is_or_was_pep` | Checkbox | No | Politically exposed/public-position declaration. |
| 40 | حالة العمل | `employment_status` | Radio group | Not visibly marked | Visible options: `مؤقتة`, `دائمة`. |
| 41 | الدرجة الوظيفية | `job_grade` | Select | Not visibly marked | Employment grade. |
| 42 | تليفون جهة العمل | `employer_phone` | Tel/text input | Not visibly marked | Placeholder: `برجاء إدخال تليفون جهة العمل`. |
| 43 | مصادر دخل أخرى | `other_income_sources` | Text input | Not visibly marked | Placeholder: `برجاء إدخال مصادر دخل أخرى`. |
| 44 | المنصب الحالي | `current_position` | Select | Yes | Placeholder: `برجاء اختيار المنصب الحالي`. |
| 45 | فاكس جهة العمل | `employer_fax` | Text input | Not visibly marked | Placeholder: `برجاء إدخال فاكس جهة العمل`. |
| 46 | فئة الدخل السنوي | `annual_income_bracket` | Select | Not visibly marked | Annual-income category/bracket. |

---

## 7. Account setup and preferences

| # | Arabic field label | Suggested key | Control | Required | Notes / visible rules |
|---:|---|---|---|---|---|
| 47 | نوع الحساب | `account_type` | Select | Not visibly marked | Account type. |
| 48 | عملة الحساب | `account_currency` | Prefilled/read-only select | Not visibly marked | Value shown: `جنيه مصري`. |
| 49 | الغرض من فتح الحساب (باللغة العربية) | `account_opening_purpose_ar` | Text input | Yes | Purpose must be entered in Arabic. |
| 50 | دورية كشف الحساب | `statement_frequency` | Select | Yes | Account-statement frequency. Placeholder: `اختر دورية كشف الحساب`. |
| 51 | عنوان المراسلات الخاص بالحساب | `statement_delivery_address` | Select | Not visibly marked | Helper text: `سيتم تسليم كشفك إلى هذا العنوان`. |
| 52 | نوع التعامل على الحساب | `account_transaction_types` | Checkbox group | Yes | Multi-select transaction types; options listed below. |
| 53 | الاسم المطلوب طباعته على البطاقة | `card_printed_name` | Text input | Yes | English only; minimum **7** characters and maximum **20** characters. |
| 54 | الإجراء عند ورود تحويل باسم العميل بعملة أجنبية لا يوجد له حساب مفتوح بذات العملة | `foreign_currency_transfer_handling` | Radio group | Not visibly marked | Choose one of the two handling options listed below. |
| 55 | الاشتراك في خدمة التنبيه بالرسائل القصيرة | `sms_alert_subscription` | Checkbox | No | Screenshot shows it selected. |
| 56 | الاشتراك في خدمة الكود الآمن للشراء عبر الإنترنت | `secure_code_subscription` | Checkbox | No | Screenshot shows it selected. |
| 57 | هل أنت المستفيد الحقيقي من الحساب؟ | `is_beneficial_owner` | Select | Not visibly marked | Value shown: `نعم`. |
| 58 | هل لديك حسابات/بطاقات لدى بنوك أخرى؟ | `has_other_bank_accounts_or_cards` | Select | Yes | Value shown: `نعم`. |

### Options for `نوع التعامل على الحساب`

- `نقدي`
- `نقدي وشيكات`
- `إيداع نقدي من الغير`
- `تحويلات من الغير`
- `أخرى`

> Note: In the screenshots, `نقدي` and `تحويلات من الغير` are selected.

### Options for foreign-currency transfer handling

The form explains that when a foreign-currency transfer arrives in the customer’s name and the customer does not already have an account in that currency, the bank may do one of the following according to the customer’s choice:

1. `فتح حساب جديد باسم العميل بنفس عملة التحويل الوارد مع خصم كافة المصروفات المتعلقة.`
2. `تحويل قيمة التحويل الوارد إلى ذات العملة المفتوح بها حساب العميل، وبما يتفق والسعر المعلن لدى البنك في يوم استلام هذه الأموال.`

The second option is selected in the supplied screenshot.

---

## Summary

| Section | Field count |
|---|---:|
| Identity and mobile verification | 3 |
| Email verification | 3 |
| Customer and personal identity details | 16 |
| Correspondence and contact details | 6 |
| Social, housing, and education details | 5 |
| Employment and income details | 13 |
| Account setup and preferences | 12 |
| **Total inventoried fields** | **58** |

## Screenshot limitations

- This inventory contains all fields visible across the supplied screenshots.
- Dropdown menus were not expanded, so their full option lists cannot be determined beyond selected values shown on-screen.
- Conditional follow-up fields triggered by checkboxes or dropdown selections may exist but are not visible in the supplied screenshots.
- The email OTP field is inferred from its position and flow because its label is cropped/not shown.
