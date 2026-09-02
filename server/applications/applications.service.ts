import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { unlink } from 'node:fs/promises'
import { logger } from '../common/logger.js'
import { DatabaseService } from '../database/database.service.js'
import { getOnboardingProfileValidationErrors } from '../identity-verification/validation/profile-validation.js'
import type { CreateApplicationBody, SaveProfileBody } from './dto.js'

type UploadDocumentType = 'national_id' | 'employment_hr_letter' | 'face_selfie'
type UploadDocumentSide = 'front' | 'back' | 'selfie_1' | 'selfie_2' | 'selfie_3' | 'selfie_4' | 'selfie_5' | 'selfie_6'

export interface ApplicationUploadInput {
  documentType: UploadDocumentType
  documentSide?: UploadDocumentSide
  file: Express.Multer.File
}

function normalizeAppointmentMethod(method?: string) {
  if (method === 'employee') return 'employee_visit'
  if (method === 'ebranch' || method === 'branch' || method === 'employee_visit') return method
  return 'branch'
}

function appointmentTimestamp(date?: string, slot?: string) {
  if (!date) return null

  const match = slot?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return `${date}T12:00:00`

  let hours = Number(match[1])
  const minutes = match[2]
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  return `${date}T${String(hours).padStart(2, '0')}:${minutes}:00`
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly database: DatabaseService) {}

  validateProfile(body: SaveProfileBody) {
    return getOnboardingProfileValidationErrors(body)
  }

  async getApplication(referenceNumber: string, requestId?: string) {
    const result = await this.database.query(
      `select
         a.reference_number,
         a.status,
         a.current_step,
         a.submission_method,
         ap.branch_name as selected_branch,
         ap.scheduled_at as appointment_date,
         ap.appointment_slot,
         a.submitted_at,
         a.created_at,
         a.updated_at
       from public.applications a
       left join lateral (
         select branch_name, scheduled_at, appointment_slot
         from public.appointments
         where application_id = a.id
         order by updated_at desc, created_at desc
         limit 1
       ) ap on true
       where a.reference_number = $1`,
      [referenceNumber],
    )

    if (!result.rowCount) {
      logger.warn('application.not_found', { requestId })
      throw new HttpException({ message: 'Application was not found.' }, HttpStatus.NOT_FOUND)
    }

    logger.info('application.loaded', {
      requestId,
      status: result.rows[0].status,
      currentStep: result.rows[0].current_step,
    })
    return result.rows[0]
  }

  async createApplication(body: CreateApplicationBody = {}, requestId?: string) {
    const { currentStep = 'prepare', language = 'en' } = body
    try {
      const result = await this.database.query(
        `insert into public.applications (current_step, language)
         values ($1, $2)
         returning id, reference_number, status, current_step, language, created_at`,
        [currentStep, language],
      )

      logger.info('application.created', {
        requestId,
        applicationId: result.rows[0].id,
        currentStep: result.rows[0].current_step,
        language: result.rows[0].language,
      })
      return result.rows[0]
    } catch (error) {
      logger.error('application.create_failed', { error })
      throw new HttpException({ message: 'Failed to create application.' }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async saveProfile(id: string, body: SaveProfileBody = {}, requestId?: string) {
    const {
      nationalId,
      fullName,
      dateOfBirth,
      governorate,
      address,
      mobile,
      email,
      employment,
      income,
      method,
      selectedBranch,
      appointmentDate,
      appointmentSlot,
      status,
      currentStep,
      onboardingFields = {},
    } = body

    try {
      await this.database.query(
        `UPDATE public.applications
         SET current_step = COALESCE($1, current_step),
             submission_method = COALESCE($2, submission_method),
             status = COALESCE($3, status),
             updated_at = NOW()
         WHERE id = $4`,
        [currentStep || null, method || null, status || null, id],
      )

      const nameParts = fullName ? fullName.trim().split(' ') : []
      const firstName = nameParts[0] || null
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
      const dob = dateOfBirth ? dateOfBirth : null

      await this.database.query(
        `INSERT INTO public.applicant_profiles
          (application_id, national_id_hash, first_name, last_name, date_of_birth, governorate, address_line, mobile_hash, email_hash, employment_status, income_range, onboarding_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (application_id) DO UPDATE SET
          national_id_hash = COALESCE(excluded.national_id_hash, public.applicant_profiles.national_id_hash),
          first_name = COALESCE(excluded.first_name, public.applicant_profiles.first_name),
          last_name = COALESCE(excluded.last_name, public.applicant_profiles.last_name),
          date_of_birth = COALESCE(excluded.date_of_birth, public.applicant_profiles.date_of_birth),
          governorate = COALESCE(excluded.governorate, public.applicant_profiles.governorate),
          address_line = COALESCE(excluded.address_line, public.applicant_profiles.address_line),
          mobile_hash = COALESCE(excluded.mobile_hash, public.applicant_profiles.mobile_hash),
          email_hash = COALESCE(excluded.email_hash, public.applicant_profiles.email_hash),
          employment_status = COALESCE(excluded.employment_status, public.applicant_profiles.employment_status),
          income_range = COALESCE(excluded.income_range, public.applicant_profiles.income_range),
          onboarding_fields = public.applicant_profiles.onboarding_fields || excluded.onboarding_fields,
          updated_at = NOW()`,
        [
          id,
          nationalId || null,
          firstName,
          lastName,
          dob,
          governorate || null,
          address || null,
          mobile || null,
          email || null,
          employment || null,
          income || null,
          onboardingFields,
        ],
      )

      if (selectedBranch && appointmentDate) {
        const scheduledAt = appointmentTimestamp(appointmentDate, appointmentSlot)
        const latestAppointment = await this.database.query(
          `SELECT branch_name, scheduled_at::date::text as appointment_date, appointment_slot
           FROM public.appointments
           WHERE application_id = $1
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1`,
          [id],
        )
        const latest = latestAppointment.rows[0]
        const appointmentChanged =
          !latest ||
          latest.branch_name !== selectedBranch ||
          latest.appointment_date !== appointmentDate ||
          latest.appointment_slot !== (appointmentSlot || null)

        if (appointmentChanged) {
          await this.database.query(
            `INSERT INTO public.appointments
              (application_id, method, branch_name, governorate, scheduled_at, appointment_slot, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
            [
              id,
              normalizeAppointmentMethod(method),
              selectedBranch,
              governorate || null,
              scheduledAt,
              appointmentSlot || null,
            ],
          )

          await this.database.query(
            `INSERT INTO public.crm_audit_trail (application_id, action, performed_by, notes)
             VALUES ($1, 'APPOINTMENT_BOOKED', 'Applicant', $2)`,
            [id, `Booked visit at ${selectedBranch} on ${appointmentDate} (${appointmentSlot || 'Standard Slot'}).`],
          )
        }
      }

      logger.info('application.profile_saved', { requestId, applicationId: id })
      return { message: 'Progress saved successfully.' }
    } catch (error) {
      logger.error('application.profile_save_failed', { requestId, applicationId: id, error })
      throw new HttpException({ message: 'Failed to save application progress.' }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getProfile(id: string, requestId?: string) {
    try {
      const result = await this.database.query(
        `select
           a.current_step,
           a.status,
           a.submission_method,
           ap.branch_name as selected_branch,
           ap.scheduled_at as appointment_date,
           ap.appointment_slot,
           p.national_id_hash,
           p.first_name,
           p.last_name,
           p.date_of_birth,
           p.governorate,
           p.address_line,
           p.mobile_hash,
           p.email_hash,
           p.employment_status,
           p.income_range,
           p.onboarding_fields
         from public.applications a
         left join public.applicant_profiles p on a.id = p.application_id
         left join lateral (
           select branch_name, scheduled_at, appointment_slot
           from public.appointments
           where application_id = a.id
           order by updated_at desc, created_at desc
           limit 1
         ) ap on true
         where a.id = $1`,
        [id],
      )

      if (!result.rowCount) {
        throw new HttpException({ message: 'Application not found.' }, HttpStatus.NOT_FOUND)
      }

      return result.rows[0]
    } catch (error) {
      if (error instanceof HttpException) throw error
      logger.error('application.profile_fetch_failed', { requestId, applicationId: id, error })
      throw new HttpException({ message: 'Failed to load application progress.' }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async saveDocumentUploads(applicationId: string, uploads: ApplicationUploadInput[], requestId?: string) {
    if (!uploads.length) {
      throw new HttpException({ message: 'Upload at least one document.' }, HttpStatus.BAD_REQUEST)
    }

    const application = await this.database.query('SELECT id FROM public.applications WHERE id = $1', [applicationId])
    if (!application.rowCount) {
      throw new HttpException({ message: 'Application not found.' }, HttpStatus.NOT_FOUND)
    }

    const savedDocuments = []

    for (const upload of uploads) {
      const previousResult = await this.database.query<{ file_path: string }>(
        `SELECT file_path
         FROM public.application_uploads
         WHERE application_id = $1
           AND document_type = $2
           AND document_side IS NOT DISTINCT FROM $3
           AND is_current = true`,
        [applicationId, upload.documentType, upload.documentSide || null],
      )

      await this.database.query(
        `UPDATE public.application_uploads
         SET is_current = false
         WHERE application_id = $1
           AND document_type = $2
           AND document_side IS NOT DISTINCT FROM $3
           AND is_current = true`,
        [applicationId, upload.documentType, upload.documentSide || null],
      )

      const inserted = await this.database.query(
        `INSERT INTO public.application_uploads
          (application_id, document_type, document_side, original_name, stored_name, file_path, mime_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, document_type, document_side, original_name, mime_type, file_size, uploaded_at`,
        [
          applicationId,
          upload.documentType,
          upload.documentSide || null,
          upload.file.originalname,
          upload.file.filename,
          upload.file.path,
          upload.file.mimetype,
          upload.file.size,
        ],
      )

      savedDocuments.push(inserted.rows[0])

      for (const previous of previousResult.rows) {
        if (previous.file_path && previous.file_path !== upload.file.path) {
          unlink(previous.file_path).catch((error) => {
            logger.warn('application.upload.previous_delete_failed', {
              requestId,
              applicationId,
              path: previous.file_path,
              error,
            })
          })
        }
      }
    }

    logger.info('application.documents_uploaded', {
      requestId,
      applicationId,
      count: savedDocuments.length,
    })

    return { success: true, documents: savedDocuments }
  }
}
