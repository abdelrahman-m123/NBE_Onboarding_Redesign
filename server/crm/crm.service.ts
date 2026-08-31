import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { logger } from '../common/logger.js'
import { errorMessage } from '../common/utils/errors.js'
import { DatabaseService } from '../database/database.service.js'
import type { JsonRecord } from './types.js'

@Injectable()
export class CrmService {
  constructor(private readonly database: DatabaseService) {}

  async listApplications(filter: { status?: string; search?: string } = {}) {
    const { status, search } = filter

    try {
      let sql = `
        SELECT
          a.id,
          a.reference_number,
          a.status,
          a.current_step,
          a.submission_method AS fulfillment_method,
          a.assigned_officer,
          a.created_at,
          CONCAT_WS(' ', p.first_name, p.last_name) AS full_name,
          p.mobile_hash,
          p.email_hash,
          p.governorate
        FROM public.applications a
        LEFT JOIN public.applicant_profiles p ON a.id = p.application_id
        WHERE 1=1
      `
      const params: string[] = []

      if (status && status !== 'all') {
        params.push(status)
        sql += ` AND a.status = $${params.length}`
      }

      if (search && search.trim() !== '') {
        params.push(`%${search.trim()}%`)
        sql += ` AND (
          a.reference_number ILIKE $${params.length}
          OR p.first_name ILIKE $${params.length}
          OR p.last_name ILIKE $${params.length}
          OR p.mobile_hash ILIKE $${params.length}
        )`
      }

      sql += ' ORDER BY a.created_at DESC LIMIT 100'

      const result = await this.database.query(sql, params)
      return { success: true, count: result.rowCount, data: result.rows }
    } catch (error) {
      logger.error('crm.applications.fetch_failed', { error })
      throw new HttpException({ success: false, message: errorMessage(error) }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getApplication(id: string) {
    try {
      const appResult = await this.database.query(
        `SELECT
          a.id,
          a.reference_number,
          a.status,
          a.current_step,
          a.submission_method,
          a.assigned_officer,
          a.rejection_reason,
          a.created_at,
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
         FROM public.applications a
         LEFT JOIN public.applicant_profiles p ON a.id = p.application_id
         WHERE a.id = $1`,
        [id],
      )

      if (!appResult.rowCount) {
        throw new HttpException({ success: false, message: 'Application record not found.' }, HttpStatus.NOT_FOUND)
      }

      const auditResult = await this.database.query(
        'SELECT * FROM public.crm_audit_trail WHERE application_id = $1 ORDER BY created_at DESC',
        [id],
      )

      return {
        success: true,
        application: appResult.rows[0],
        auditTrail: auditResult.rows,
      }
    } catch (error) {
      if (error instanceof HttpException) throw error
      logger.error('crm.application.fetch_failed', { error })
      throw new HttpException({ success: false, message: errorMessage(error) }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateStatus(id: string, body: JsonRecord = {}) {
    const status = String(body.status ?? '')
    const officerName = String(body.officerName ?? 'Senior_Branch_Officer')
    const notes = String(body.notes ?? '')
    const rejectionReason = body.rejectionReason ?? null

    try {
      const current = await this.database.query('SELECT status FROM public.applications WHERE id = $1', [id])
      if (!current.rowCount) {
        throw new HttpException({ success: false, message: 'Application not found.' }, HttpStatus.NOT_FOUND)
      }
      const previousStatus = current.rows[0].status

      await this.database.query(
        `UPDATE public.applications
         SET status = $1, assigned_officer = $2, rejection_reason = $3, updated_at = now()
         WHERE id = $4`,
        [status, officerName, rejectionReason, id],
      )

      await this.database.query(
        `INSERT INTO public.crm_audit_trail (application_id, action, performed_by, previous_status, new_status, notes)
         VALUES ($1, 'STATUS_UPDATE', $2, $3, $4, $5)`,
        [id, officerName, previousStatus, status, notes],
      )

      return { success: true, message: `Application status updated to ${status}` }
    } catch (error) {
      if (error instanceof HttpException) throw error
      logger.error('crm.status_update.failed', { error })
      throw new HttpException({ success: false, message: errorMessage(error) }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
