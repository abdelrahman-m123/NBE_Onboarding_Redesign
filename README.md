# NBE Onboarding Redesign

A full-stack prototype for a bilingual National Bank of Egypt account-opening journey. It combines guided onboarding, Egyptian National ID OCR, selfie-to-ID face comparison, mobile and email verification, appointment booking, progress recovery, and an internal CRM review experience.

> [!IMPORTANT]
> This is a demonstration/prototype, not a production banking system. The current authentication, OTP, PII storage, liveness, and authorization controls require production hardening; see [Prototype limitations](#prototype-limitations).

## What the project includes

### Applicant experience

- Seven-step onboarding journey: eligibility, identity, face check, contact verification, application details, review, and tracking.
- Complete English and Arabic interfaces, including right-to-left layout switching and remembered language preference.
- Eligibility confirmation for a new retail customer, Egyptian residency, minimum age, and a valid National ID.
- Front/back Egyptian National ID upload with OCR-assisted form completion and an editable result review.
- Browser-camera selfie capture and AWS Rekognition comparison against the ID portrait.
- Six-digit mobile and email OTP flows with five-minute expiry.
- Detailed KYC profile covering identity, address, social, employment, income, PEP, account, statement, and transaction preferences.
- Optional HR/income-proof upload as an image or PDF.
- Auto-save to PostgreSQL while moving through the journey and restore using the application UUID saved in `localStorage`.
- Choice of E-Branch, traditional branch, or employee visit for completion.
- Governorate-aware branch selection, channel-specific appointment slots, and appointment persistence.
- Submission timeline, copyable reference, and a bilingual print-ready application summary.
- Responsive form navigation, inline validation, toast feedback, a skip link, and labelled controls.

### Staff/operations experience

- Demo staff sign-in and session persistence in `sessionStorage`.
- CRM queue with search and status filtering.
- Full application/KYC view, including face-verification results and uploaded documents.
- Inline preview or download of current ID, selfie, and HR-letter files.
- Application status updates, officer attribution, rejection reason support, and an audit trail.
- API and PostgreSQL health checks plus structured request/application logging.

## System architecture

```mermaid
flowchart LR
    Browser[React + Vite applicant and CRM UI] -->|REST / multipart| API[NestJS API]
    API --> DB[(PostgreSQL)]
    API --> Files[Local application uploads]
    API --> OCR[OCR orchestrator]
    OCR --> Paddle[Python PaddleOCR - Arabic]
    OCR --> Image[Sharp preprocessing and ID segmentation]
    OCR -. alternative service .-> Tess[Tesseract.js]
    API --> Rekognition[AWS Rekognition]
    API --> Email[Nodemailer / Gmail]
    API --> Telegram[Telegram Bot API]
```

The frontend defaults to `http://localhost:4000` for API calls. The API defaults to port `4000`, permits `http://localhost:5173` through CORS, stores structured data in PostgreSQL, and stores uploaded files under `server/uploads/applications/<application-id>`.

## Applicant journey

| Step | Capability |
| --- | --- |
| 1. Prepare | Confirms all eligibility requirements before an application can start. |
| 2. Identity | Uploads both sides of the ID, runs OCR, derives ID metadata, lets the applicant correct extracted values, and gathers additional identity/address information. |
| 3. Face | Captures four selfie frames from the browser camera and compares usable frames with the front-of-ID portrait. |
| 4. Contact | Verifies an Egyptian mobile number through the prototype Telegram delivery adapter and an email address through Gmail/Nodemailer. |
| 5. Application | Captures social, employment, income, PEP, account, transaction, statement, and card preferences; optionally stores an HR letter. |
| 6. Review | Presents editable summaries, chooses the fulfillment channel, captures terms acceptance, and submits the application. |
| 7. Track | Shows the next action and status timeline, supports branch appointment booking, and opens a printable summary. |

## How OCR was implemented

The active OCR provider is `PaddleOcrService`, registered behind the `OCR_SERVICE` interface in the NestJS identity-verification module. This keeps the controller independent of the concrete OCR engine.

### OCR request flow

1. The React identity step sends `frontImage` and `backImage` as multipart data to `POST /api/identity/ocr/full`.
2. Multer keeps scan files in memory, accepts common image formats, and limits each file to 6 MB.
3. The server examines each image with Sharp, applies EXIF autorotation, and tries orientation candidates. Landscape images start with `0°` and `270°`; portrait images start with `270°` and `0°`.
4. A temporary PNG is passed to `paddle_ocr_runner.py`. PaddleOCR runs with `lang="ar"` and returns recognized text, confidence, and bounding boxes as UTF-8 JSON.
5. The Python runner automatically selects CUDA when the installed Paddle build supports it; otherwise it uses the CPU. Node serializes Paddle runs to avoid overlapping model executions, uses a configurable 120-second timeout, and removes each temporary directory afterward.
6. Positioned lines are grouped into rows, ordered top-to-bottom and right-to-left, and parsed with Egyptian-ID-specific rules.
7. Front and back results are merged, reconciled, returned with per-side diagnostics, and mapped into editable React form fields.

### Image and number recovery

In addition to PaddleOCR text recognition, the implementation contains a specialized 14-digit recovery path:

- Sharp crops likely ID-number regions, resizes them, converts them to grayscale, normalizes contrast, and applies a binary threshold.
- Connected components are grouped into the likely digit row.
- Glyph geometry generates Arabic-digit alternatives, capped to a bounded candidate search.
- A candidate is accepted only if it is a valid 14-digit Egyptian National ID: the century marker must be `2` or `3`, the embedded date must exist, and the governorate code must be recognized.
- Arabic, Persian, and Latin digits are normalized. Common OCR substitutions such as `O → 0`, `I/l → 1`, `S → 5`, and `B → 8` are also handled in the Tesseract parser.

When an ID is valid, the parser derives:

- National ID number
- Date of birth
- Birth governorate/place of birth
- Gender from the 13th digit

Layout-aware parsers also extract or infer:

- Arabic first, middle, and last name
- Arabic residence address
- Printed card number
- Occupation
- Religion
- Marital status
- ID issue month and expiry date

If the back-side religion or expiry date is missing, two focused back-card crops are enhanced and read again. If front and back ID values differ slightly, the service can fuse them only when the shared digits, parsed date/governorate, and a plausible age all pass validation. OCR returns `completed` when a National ID is found and `partial` otherwise; the UI always leaves the populated fields editable.

### PaddleOCR and Tesseract roles

- **PaddleOCR is the configured runtime provider.** It performs the current Arabic, layout-aware front/back scan.
- **Tesseract.js remains an implemented alternative/fallback pipeline** in `ocr.ts` and `TesseractOcrService`, with normalized, thresholded, and original image variants. It is not the provider currently registered in the NestJS module, and a Paddle process failure is surfaced as an OCR error rather than automatically switching providers.
- The optional `guideImage` API field is currently marked `reference-only`; it does not contribute extracted fields in the active Paddle flow.

Run the repository's sample OCR assertion and diagnostic output with:

```bash
npm run ocr:test:paddle
```

The command reads private fixture paths from `OCR_TEST_FRONT`, `OCR_TEST_BACK`, `OCR_TEST_GUIDE`, and/or `OCR_TEST_SAMPLE`. Keep those files outside the repository. Its diagnostic output reports only status, confidence, methods, field names, and line counts; it does not print extracted identity values.

## How face checks were implemented

Face verification uses the browser Media Capture API on the frontend and AWS Rekognition on the backend.

### Current browser flow

1. The applicant must first select the front image of the National ID.
2. `navigator.mediaDevices.getUserMedia()` opens the user-facing camera at an ideal resolution of 960×720.
3. The app draws four frames to a hidden canvas, 450 ms apart, and encodes each as JPEG at `0.92` quality.
4. The captured frames are persisted as application documents and are also sent with the front-of-ID image to `POST /api/identity/face/verify`.
5. The face endpoint accepts up to six selfie frames and limits each in-memory image to 6 MB.

### Server-side checks

For every submitted selfie frame, the service:

1. Calls Rekognition `DetectFaces` with all attributes and chooses the largest detected face.
2. Rejects the frame when no face is found.
3. Rejects dark or blurry frames when either brightness or sharpness is below `FACE_MIN_QUALITY` (default `35`).
4. Rejects a face whose absolute yaw, pitch, or roll is greater than `35°`.
5. Calls `CompareFaces` using the selfie as the source and the National ID as the target, with Rekognition's `AUTO` quality filter and the manual-review threshold as the minimum returned similarity.
6. Chooses the highest similarity across all usable frames and returns each frame's result, face confidence, brightness, sharpness, and rejection reason where applicable.

The final decision is:

| Condition | Result |
| --- | --- |
| Supplied liveness session did not succeed or is below the liveness threshold | `failed` |
| Best similarity is at least `FACE_MATCH_THRESHOLD` (default `85`) | `verified` |
| Best similarity is at least `FACE_MANUAL_REVIEW_THRESHOLD` (default `70`) | `manual_review` |
| No qualifying comparison or similarity below `70` | `failed` |

### Liveness support

The backend exposes `POST /api/identity/face/liveness-session` and can retrieve an AWS Face Liveness result when `livenessSessionId` is supplied to the verify endpoint. A successful liveness reference image is added to the comparison candidates, and the default required liveness confidence is `90`.

The current React flow does **not** start or complete the AWS Face Liveness challenge and does not send a liveness session ID. In that flow, `hasLiveFace` defaults to `true`; therefore the shipped UI performs multi-frame face quality and identity matching, not an anti-spoof liveness check. The Amplify liveness packages are installed but not yet wired into the UI.

## Getting started

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by the installed Vite version)
- npm
- PostgreSQL with permission to enable `pgcrypto`
- Python 3 with PaddleOCR dependencies
- Optional integrations: AWS Rekognition credentials, a Gmail app password, and a Telegram bot

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Install Python OCR dependencies

The Python dependencies are not currently pinned in a `requirements.txt` file:

```bash
python -m pip install paddlepaddle paddleocr
```

For a CUDA deployment, install the Paddle build appropriate for the machine and set `PADDLE_OCR_DEVICE=gpu:0`. The first OCR run downloads the Arabic model into the configured cache.

### 3. Configure the server

Create `.env` in the repository root or `server/.env`. Root values take precedence.

```dotenv
# API
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
LOG_LEVEL=info

# PostgreSQL: use DATABASE_URL, or the individual PG* settings
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nbe_onboarding
PGHOST=localhost
PGPORT=5432
PGDATABASE=nbe_onboarding
PGUSER=postgres
PGPASSWORD=postgres
PGSSL=false

# PaddleOCR
PADDLE_OCR_PYTHON=python
PADDLE_OCR_DEVICE=auto
PADDLE_OCR_TIMEOUT_MS=120000
# PADDLE_OCR_HOME=.paddle-cache

# AWS Rekognition
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
FACE_LIVENESS_THRESHOLD=90
FACE_MATCH_THRESHOLD=85
FACE_MANUAL_REVIEW_THRESHOLD=70
FACE_MIN_QUALITY=35

# Gmail/Nodemailer
EMAIL_USER=
EMAIL_PASS=

# Prototype mobile OTP delivery
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

The AWS identity needs permission for the Rekognition operations used by the enabled flow: `DetectFaces`, `CompareFaces`, `CreateFaceLivenessSession`, and `GetFaceLivenessSessionResults`.

To point the frontend at another API, create `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

### 4. Create and migrate the database

Create the configured `nbe_onboarding` database, then run:

```bash
npm run db:migrate
```

The migration is transactional and idempotently creates the application, profile, verification, document, appointment, status, consent, and audit tables plus their indexes and update triggers.

### 5. Start the application

Run the API and frontend in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev
```

- Applicant UI: `http://localhost:5173`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/api/health`
- Database health: `http://localhost:4000/api/db/health`
- Staff CRM: use the **Staff CRM** action in the application header. The sign-in is a client-side demo, and the modal displays a demo credential.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend development server. |
| `npm run dev:server` | Watch server TypeScript, rebuild it, and restart the compiled API with Nodemon. |
| `npm run build:server` | Compile `server/**/*.ts` into `dist/`. |
| `npm run server` | Build and run the API once. |
| `npm run db:migrate` | Apply `server/database/schema.sql` to PostgreSQL. |
| `npm run ocr:test:paddle` | Run privacy-safe PaddleOCR diagnostics against fixture paths supplied through environment variables. |
| `npm run build` | Build the server and production frontend. |
| `npm run preview` | Preview the built Vite frontend. |
| `npm run port:4000` | Show the process listening on port 4000. |
| `npm run port:kill:4000` | Terminate the process listening on port 4000. |

## Packages used

Versions below are the declared ranges in `package.json`.

### Runtime and application dependencies

| Package | Version | Role |
| --- | --- | --- |
| `react`, `react-dom` | `^19.2.8` | Applicant and CRM interfaces and browser rendering. |
| `lucide-react` | `^1.30.0` | Interface icons. |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | `^11.2.1` | Modular REST API, dependency injection, controllers, and Express integration. |
| `reflect-metadata` | `^0.2.2` | Decorator metadata required by NestJS. |
| `rxjs` | `^7.8.2` | NestJS reactive runtime dependency. |
| `pg` | `^8.23.0` | PostgreSQL connection pooling and queries. |
| `multer` | `^2.2.0` | Multipart ID, selfie, and HR-document uploads. |
| `sharp` | `^0.35.3` | Rotation, cropping, resizing, grayscale conversion, normalization, sharpening, thresholding, and raw-pixel analysis. |
| `tesseract.js` | `^7.0.0` | Alternative OCR pipeline and digit/text fallback utilities. |
| `@aws-sdk/client-rekognition` | `^3.1118.0` | Face detection, face comparison, and Face Liveness session APIs. |
| `nodemailer` | `^9.0.5` | Gmail-backed email OTP delivery. |
| `dotenv` | `^17.4.2` | Root/server environment-file loading. |
| `helmet` | `^8.3.0` | HTTP security headers. |
| `cors` | `^2.8.6` | Cross-origin support for the separate frontend/API development origins. |
| `nodemon` | `^3.1.14` | Server rebuild/restart loop used by `dev:server`. |

### Declared for the planned liveness UI

| Package | Version | Current status |
| --- | --- | --- |
| `aws-amplify` | `^6.20.0` | Installed but not imported by the current frontend. |
| `@aws-amplify/ui-react` | `^6.15.6` | Installed but not imported by the current frontend. |
| `@aws-amplify/ui-react-liveness` | `^3.6.9` | Intended for an AWS Face Liveness challenge UI; not currently wired. |

### Development dependencies

| Package | Version | Role |
| --- | --- | --- |
| `vite` | `^8.2.1` | Frontend development server and production bundler. |
| `@vitejs/plugin-react` | `^6.0.5` | React Fast Refresh and Vite React transformation. |
| `typescript` | `^7.0.2` | Server compilation. |
| `tsx` | `^4.23.12` | Direct TypeScript execution for migrations and utility scripts. |
| `@types/node` | `^26.2.0` | Node.js TypeScript types. |
| `@types/multer` | `^2.2.0` | Multer/Express upload types. |
| `@types/nodemailer` | `^8.0.1` | Nodemailer types. |
| `@types/pg` | `^8.23.1` | PostgreSQL client types. |

### Python dependencies

| Package | Role |
| --- | --- |
| `paddlepaddle` | CPU/GPU inference runtime used by the OCR runner. |
| `paddleocr` | Arabic text detection and recognition. |

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health. |
| `GET` | `/api/db/health` | PostgreSQL connectivity and active database/schema. |
| `POST` | `/api/identity/ocr` | Scan one ID image using field name `nationalIdImage`. |
| `POST` | `/api/identity/ocr/full` | Scan front/back ID images using `frontImage` and `backImage`; `guideImage` is optional/reference-only. |
| `POST` | `/api/identity/face/liveness-session` | Create an AWS Face Liveness session. |
| `POST` | `/api/identity/face/verify` | Verify `nationalIdFrontImage`, up to six `selfieImages`, and optional `livenessSessionId`. |
| `POST` | `/api/applications` | Create a draft application. |
| `GET` | `/api/applications/:referenceNumber` | Retrieve public tracking data by generated reference. |
| `GET` | `/api/applications/:id/profile` | Restore an application's saved profile. |
| `PUT` | `/api/applications/:id/profile` | Validate and upsert profile, progress, status, and appointment data. |
| `POST` | `/api/applications/:id/documents` | Store ID, selfie, and income-proof documents. |
| `POST` | `/api/applications/:id/send-email-otp` | Send an email OTP. |
| `POST` | `/api/applications/:id/verify-email-otp` | Verify an email OTP. |
| `POST` | `/api/applications/:id/send-mobile-otp` | Generate and dispatch a prototype mobile OTP. |
| `POST` | `/api/applications/:id/verify-mobile-otp` | Verify a mobile OTP. |
| `GET` | `/api/crm/applications` | List/search/filter applications. |
| `GET` | `/api/crm/applications/:id` | Load an application, documents, and audit trail. |
| `PATCH` | `/api/crm/applications/:id/status` | Update application status and write an audit event. |
| `GET` | `/api/crm/applications/:id/documents/:documentId/view` | View a current uploaded document inline. |
| `GET` | `/api/crm/applications/:id/documents/:documentId/download` | Download a current uploaded document. |

## Project structure

```text
frontend/
  src/App.jsx                         Application state, API actions, and page composition
  src/components/
    booking/BookingModal.jsx          Branch and appointment selection
    crm/                              Staff login and application-review dashboard
    forms/FormControls.jsx            Shared fields, checkboxes, and verification controls
    layout/                           Header, journey navigation, and footer
    steps/                            One component per onboarding step
    summary/SummaryReceipt.jsx        Printable bilingual summary
  src/config/
    api.js                            Frontend API base URL
    onboarding.js                     Field definitions, options, steps, and initial form state
  src/data/branches.js                NBE branch catalog and appointment slots
  src/i18n/translations.js            English and Arabic interface copy
  src/utils/form.js                   Shared form labels and message helpers
  src/styles.css                      Application-wide presentation
server/
  applications/                       Application, document, and OTP APIs
  crm/                                Staff queue, detail, status, and file APIs
  database/schema.sql                 PostgreSQL schema
  identity-verification/
    face-verification.service.ts      AWS face quality/match/liveness logic
    ocr/paddle-ocr.service.ts         Active OCR provider and field parsing
    ocr/paddle_ocr_runner.py          Python PaddleOCR adapter
    ocr/ocr.ts                        ID parsing, segmentation, and Tesseract pipeline
  uploads/applications/               Runtime document storage (generated)
```

## Data and upload behavior

- ID and HR files are versioned by marking the previous matching upload as non-current and deleting its old local file after the replacement is recorded.
- Stored-document uploads allow ID/selfie images and HR-letter images or PDFs, with a 10 MB per-file limit.
- OCR and face-verification uploads are processed in memory with a 6 MB per-file limit.
- The database schema includes application/profile, eligibility, OTP, contact verification, identity-document, document-requirement, upload, appointment, consent, status-event, general audit, and CRM audit tables. Not every scaffolded table is populated by the current prototype flow.

## Prototype limitations

- Staff credentials are hard-coded in the React bundle, the CRM session is client-side, and CRM API endpoints do not enforce server-side authentication or authorization.
- OTP records live in process memory, disappear on restart, and are logged for prototype debugging. Mobile OTP is delivered through Telegram (or printed in the server log), not through a real SMS provider.
- Columns named `national_id_hash`, `mobile_hash`, and `email_hash` currently receive the submitted plaintext values; the available encrypted columns are not populated.
- Uploaded identity, selfie, and HR files are stored on the local filesystem without object-storage encryption or a retention policy.
- The browser face flow does not perform the available AWS liveness challenge, and successful face verification is not currently required by step validation.
- The success page/printable receipt currently displays a fixed demo reference (`NBE-26-018427`) instead of the reference generated by PostgreSQL for the created application.
- The sample staff login is a development fixture and should not be shipped as a production credential. Identity-image fixtures are deliberately ignored and must remain outside Git.
- There is no general automated unit/integration/end-to-end test suite beyond the fixture-based PaddleOCR check.

Before production use, add real identity and access management, server-side authorization, rate limiting and OTP attempt controls, secret management, encryption/tokenization for PII, durable OTP storage, secure object storage and deletion policies, audit review, real liveness UI integration, consent persistence, monitoring, and a comprehensive test/security program.
