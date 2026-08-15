# NBE Onboarding Prototype Gap Checklist

Use this as the living checklist for the redesign prototype. When a gap is completed in the app, change `[ ]` to `[x]` and add a short note or PR/commit reference if useful.

## Product And Journey

- [x] Initialize backend project and create the required Postgres tables in `nbe_onboarding.public`.
- [x] Add real backend integration for NID, mobile OTP, email OTP, saving, submission, and tracking.
- [x] Implement real save-and-resume instead of the current prototype toast.
- [ ] Add Arabic language support with equivalent RTL layout and content.
- [ ] Add complete eligibility handling for minors, power of attorney, gift accounts, people who cannot read or write, non-residents, and customers under 21.
- [ ] Add account type or product selection if required by NBE before account opening.
- [ ] Add a clear preparation route for customers who should apply at a branch instead.

## Verification And Security

- [x] Add backend OCR extraction for uploaded National ID images and prefill review in the identity step.
- [ ] Implement real SMS OTP behavior: expiry, resend limits, attempt limits, lockouts, and invalidation of previous codes after resend.
- [ ] Implement real email verification behavior with secure delivery, resend, change-email, and recovery states.
- [ ] Add secure generic error handling to avoid identity or account enumeration.
- [ ] Add real identity verification or e-KYC flow, if approved by NBE compliance and CBE requirements.
- [ ] Add National ID authenticity checks, expiry checks, and compliance-approved customer review records before prefill.
- [ ] Add selfie/liveness or risk-based step-up checks, if legally and operationally approved.
- [ ] Add manual-review routing for uncertain identity, document, fraud, or verification outcomes.
- [ ] Add fraud controls such as rate limiting, abnormal velocity checks, device/network signals, and SIM-swap checks where permitted.
- [ ] Ensure NIDs, full contact details, OTPs, documents, and biometrics are excluded from URLs, analytics, notifications, and general logs.
- [ ] Add privacy controls for retention, audit logs, telemetry filtering, masking, and data minimization.

## Application Form And Documents

- [ ] Expand the form to cover all required personal, address, employment, income, tax, regulatory, and account-preference fields.
- [ ] Add conditional document checklist logic based on address mismatch, profession mismatch, income proof, birthplace, US nationality, and foreign residency.
- [ ] Add document upload or digital document capture only if supported by NBE compliance and operations.
- [ ] Preserve valid field data after errors and failed submission attempts.
- [ ] Add full error and recovery states for service unavailable, session timeout, duplicate application, failed submission, expired codes, and lost connection.

## Signature And Completion Options

- [ ] Build the e-branch booking flow with branch selection, available dates, available times, and instant debit card availability.
- [ ] Add missed e-branch appointment handling and the 10-working-day cancellation rule.
- [ ] Build the traditional branch flow with branch search, required next action, and 10-working-day cancellation rule.
- [ ] Build the employee visit request flow with eligibility checks, governorate availability, call expectations, appointment scheduling, and failed-contact handling.
- [ ] Confirm which signature and document-completion routes are legally and operationally supported.
- [ ] Add digital signature flow only if approved by NBE compliance and applicable regulation.

## Consent, Submission, And Tracking

- [ ] Add a full terms and conditions viewer.
- [ ] Add a plain-language terms summary.
- [ ] Record consent with document version, application ID, date, and timestamp.
- [ ] Build secure post-submission tracking with renewed verification before exposing or changing application data.
- [ ] Add notification history and next-action management.
- [ ] Ensure confirmation emails contain no sensitive personal information.
- [ ] Add downloadable application summary with safe masking.

## Accessibility And Usability

- [ ] Validate keyboard-only navigation across the full journey.
- [ ] Validate screen-reader behavior for form labels, error summaries, status updates, and OTP flows.
- [ ] Validate zoom and text resizing behavior.
- [ ] Validate color contrast and non-color-only status cues against WCAG 2.2 AA.
- [ ] Validate mobile layouts on real devices, including long Arabic text, keyboard overlays, OTP autofill, and touch target sizes.
- [ ] Add alternatives or assisted paths for customers who cannot use SMS, email, selfie capture, document scanning, or camera upload.

## Analytics, Testing, And Readiness

- [ ] Add analytics for start-to-submit completion, stage drop-off, field errors, completion time, OTP resend, OTP expiry, save-and-resume, support contacts, manual review, and document resubmission.
- [ ] Add guardrail metrics for fraud, false rejection, manual handling, and accessibility task completion.
- [ ] Add automated frontend tests for core happy path and major recovery paths.
- [ ] Add security and abuse test cases for OTP, enumeration, session handling, document handling, and tracking links.
- [ ] Add content review with NBE legal, compliance, security, and service teams.
- [ ] Add production threat model and privacy review before pilot.
- [ ] Define pilot success criteria and compare against baseline NBE funnel data.
