import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { logger } from '../common/logger.js'
import { DatabaseService } from '../database/database.service.js'
import { getOnboardingProfileValidationErrors } from '../identity-verification/validation/profile-validation.js'
import type { CreateApplicationBody, SaveProfileBody } from './dto.js'

@Injectable()
export class ApplicationsService {
  constructor(private readonly database: DatabaseService) {}

  validateProfile(body: SaveProfileBody) {
    return getOnboardingProfileValidationErrors(body)
  }

  async getApplication(referenceNumber: string, requestId?: string) {
    const result = await this.database.query(
      `select reference_number, status, current_step, submission_method, submitted_at, created_at, updated_at
       from public.applications
       where reference_number = $1`,
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
        `select a.current_step, p.national_id_hash, p.first_name, p.last_name, p.date_of_birth, p.governorate, p.address_line, p.mobile_hash, p.email_hash, p.onboarding_fields
         from public.applications a
         left join public.applicant_profiles p on a.id = p.application_id
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
}
