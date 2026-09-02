import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { logger } from '../common/logger.js'
import { errorMessage } from '../common/utils/errors.js'
import { DatabaseService } from '../database/database.service.js'
import type { JsonRecord } from './types.js'

const uploadsRoot = resolve(process.cwd(), 'server', 'uploads')

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
          ap.branch_name AS selected_branch,
          ap.scheduled_at AS appointment_date,
          ap.appointment_slot,
          a.assigned_officer,
          a.created_at,
          CONCAT_WS(' ', p.first_name, p.last_name) AS full_name,
          p.mobile_hash,
          p.email_hash,
          p.governorate
        FROM public.applications a
        LEFT JOIN public.applicant_profiles p ON a.id = p.application_id
        LEFT JOIN LATERAL (
          SELECT branch_name, scheduled_at, appointment_slot
          FROM public.appointments
          WHERE application_id = a.id
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        ) ap ON true
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
          ap.branch_name AS selected_branch,
          ap.scheduled_at AS appointment_date,
          ap.appointment_slot,
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
         LEFT JOIN LATERAL (
           SELECT branch_name, scheduled_at, appointment_slot
           FROM public.appointments
           WHERE application_id = a.id
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 1
         ) ap ON true
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
      const documentsResult = await this.database.query(
        `SELECT
           id,
           document_type,
           document_side,
           original_name,
           mime_type,
           file_size,
           uploaded_at
         FROM public.application_uploads
         WHERE application_id = $1 AND is_current = true
         ORDER BY
           CASE document_type
             WHEN 'national_id' THEN 1
             WHEN 'face_selfie' THEN 2
             WHEN 'employment_hr_letter' THEN 3
             ELSE 3
           END,
           document_side NULLS LAST,
           uploaded_at DESC`,
        [id],
      )

      return {
        success: true,
        application: appResult.rows[0],
        auditTrail: auditResult.rows,
        documents: documentsResult.rows.map((document) => ({
          ...document,
          download_url: `/api/crm/applications/${id}/documents/${document.id}/download`,
          view_url: `/api/crm/applications/${id}/documents/${document.id}/view`,
        })),
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

  async getDocumentForDownload(applicationId: string, documentId: string) {
    const result = await this.database.query(
      `SELECT original_name, file_path, mime_type
       FROM public.application_uploads
       WHERE id = $1 AND application_id = $2 AND is_current = true`,
      [documentId, applicationId],
    )

    if (!result.rowCount) {
      throw new HttpException({ success: false, message: 'Document was not found.' }, HttpStatus.NOT_FOUND)
    }

    const document = result.rows[0]
    const resolvedPath = resolve(String(document.file_path))
    if (!resolvedPath.startsWith(`${uploadsRoot}${sep}`) || !existsSync(resolvedPath)) {
      throw new HttpException({ success: false, message: 'Document file is unavailable.' }, HttpStatus.NOT_FOUND)
    }

    return {
      filePath: resolvedPath,
      originalName: String(document.original_name || 'document'),
      mimeType: document.mime_type ? String(document.mime_type) : undefined,
    }
  }
}
