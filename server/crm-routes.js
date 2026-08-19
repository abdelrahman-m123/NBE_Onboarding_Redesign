import express from 'express'
import { query } from './db.js'

const router = express.Router()

// 1. GET /api/crm/applications -> Search & Filter List
router.get('/applications', async (req, res) => {
  const { status, search } = req.query

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
    const params = []

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

    sql += ` ORDER BY a.created_at DESC LIMIT 100`

    const result = await query(sql, params)
    res.json({ success: true, count: result.rowCount, data: result.rows })
  } catch (error) {
    console.error('CRM fetch failed:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// 2. GET /api/crm/applications/:id -> Full Profile & Audit History
router.get('/applications/:id', async (req, res) => {
  try {
    const appResult = await query(
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
        p.income_range
       FROM public.applications a 
       LEFT JOIN public.applicant_profiles p ON a.id = p.application_id 
       WHERE a.id = $1`,
      [req.params.id]
    )

    if (!appResult.rowCount) {
      return res.status(404).json({ success: false, message: 'Application record not found.' })
    }

    const auditResult = await query(
      `SELECT * FROM public.crm_audit_trail WHERE application_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    )

    res.json({
      success: true,
      application: appResult.rows[0],
      auditTrail: auditResult.rows
    })
  } catch (error) {
    console.error('CRM single fetch failed:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// 3. PATCH /api/crm/applications/:id/status -> Status Transition & Audit Log
router.patch('/applications/:id/status', async (req, res) => {
  const { status, officerName = 'Senior_Branch_Officer', notes = '', rejectionReason = null } = req.body
  const appId = req.params.id

  try {
    const current = await query(`SELECT status FROM public.applications WHERE id = $1`, [appId])
    if (!current.rowCount) {
      return res.status(404).json({ success: false, message: 'Application not found.' })
    }
    const previousStatus = current.rows[0].status

    await query(
      `UPDATE public.applications 
       SET status = $1, assigned_officer = $2, rejection_reason = $3, updated_at = now() 
       WHERE id = $4`,
      [status, officerName, rejectionReason, appId]
    )

    await query(
      `INSERT INTO public.crm_audit_trail (application_id, action, performed_by, previous_status, new_status, notes)
       VALUES ($1, 'STATUS_UPDATE', $2, $3, $4, $5)`,
      [appId, officerName, previousStatus, status, notes]
    )

    res.json({ success: true, message: `Application status updated to ${status}` })
  } catch (error) {
    console.error('CRM status update failed:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router