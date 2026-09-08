import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Building2,
  ShieldCheck,
  CalendarDays,
  FileText,
  RefreshCw,
  Eye,
  X,
  Activity,
} from 'lucide-react'
import { CpuMonitor } from './CpuMonitor'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const crmFieldSections = [
  {
    title: 'Identity & KYC Details',
    fields: [
      ['firstNameAr', 'First name in Arabic'],
      ['middleNameAr', 'Middle name in Arabic'],
      ['lastNameAr', 'Last name in Arabic'],
      ['gender', 'Gender'],
      ['nationalIdIssueDate', 'National ID issue date'],
      ['nationalIdExpiryDate', 'National ID expiry date'],
      ['nationalIdCardPrintedNumber', 'ID card printed number'],
      ['placeOfBirth', 'Place of birth'],
      ['idResidenceAddressAr', 'ID residence address'],
      ['hasSpecialNeeds', 'Special needs declaration'],
      ['hasOtherNationality', 'Other nationality'],
      ['hasResidencyInOtherCountry', 'Foreign residency rights'],
    ],
  },
  {
    title: 'Correspondence & Social Profile',
    fields: [
      ['correspondenceAddressSource', 'Correspondence address'],
      ['correspondenceLanguage', 'Correspondence language'],
      ['landlineNumber', 'Landline'],
      ['deliveryMethod', 'Delivery method'],
      ['maritalStatus', 'Marital status'],
      ['numberOfDependents', 'Dependents'],
      ['housingNature', 'Housing nature'],
      ['rentalType', 'Rental type'],
      ['educationStatus', 'Education status'],
    ],
  },
  {
    title: 'Employment & Account Setup',
    fields: [
      ['employmentNature', 'Employment nature'],
      ['employerName', 'Employer name'],
      ['employmentStartDate', 'Employment start date'],
      ['employerAddress', 'Employer address'],
      ['monthlySalary', 'Monthly salary'],
      ['isOrWasPep', 'PEP declaration'],
      ['employmentStatus', 'Employment status'],
      ['jobGrade', 'Job grade'],
      ['employerPhone', 'Employer phone'],
      ['currentPosition', 'Current position'],
      ['annualIncomeBracket', 'Annual income bracket'],
      ['accountType', 'Account type'],
      ['accountCurrency', 'Account currency'],
      ['accountOpeningPurposeAr', 'Account purpose in Arabic'],
      ['statementFrequency', 'Statement frequency'],
      ['statementDeliveryAddress', 'Statement delivery address'],
      ['accountTransactionTypes', 'Transaction types'],
      ['cardPrintedName', 'Card printed name'],
      ['smsAlertSubscription', 'SMS alerts'],
      ['secureCodeSubscription', 'Secure code'],
      ['isBeneficialOwner', 'Beneficial owner'],
      ['hasOtherBankAccountsOrCards', 'Other bank accounts/cards'],
    ],
  },
]

function formatCrmValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'N/A'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return 'N/A'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function documentTitle(document) {
  if (document.document_type === 'national_id') {
    return `National ID ${document.document_side || 'image'}`
  }
  if (document.document_type === 'face_selfie') {
    return `Face capture ${String(document.document_side || '').replace('selfie_', '') || 'frame'}`
  }
  if (document.document_type === 'employment_hr_letter') return 'Employment HR letter'
  return 'Supporting document'
}

function DocumentPreviewImage({ document }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const imageUrl = `${API_BASE_URL}${document.view_url}`
  const title = documentTitle(document)

  useEffect(() => {
    let isMounted = true
    let objectUrl = ''

    const loadPreview = async () => {
      setFailed(false)
      setPreviewUrl('')

      try {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error('Preview image failed to load.')

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (isMounted) setPreviewUrl(objectUrl)
      } catch (error) {
        console.error('Failed to load document preview', error)
        if (isMounted) setFailed(true)
      }
    }

    loadPreview()

    return () => {
      isMounted = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl])

  if (failed) {
    return (
      <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: '#60706a', fontSize: '11px', textAlign: 'center', padding: '8px' }}>
        Preview unavailable
      </span>
    )
  }

  if (!previewUrl) {
    return (
      <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: '#60706a', fontSize: '11px' }}>
        Loading...
      </span>
    )
  }

  return (
    <img
      src={previewUrl}
      alt={title}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  )
}

export function CrmDashboard({ onBackToForm = () => {}, onLogout = () => {}, currentOfficer = null }) {
  const [applications, setApplications] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppId, setSelectedAppId] = useState(null)
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [showCpuMonitor, setShowCpuMonitor] = useState(false)
  const officerName = currentOfficer?.name || 'Staff Officer'
  const selectedFields = selectedDetails?.application?.onboarding_fields || {}
  const selectedDocuments = selectedDetails?.documents || []

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/crm/applications?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`
      )
      const json = await res.json()
      if (json && json.success) {
        setApplications(json.data || [])
      } else {
        setApplications([])
      }
    } catch (err) {
      console.error('Failed to load CRM applications', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [statusFilter, searchQuery])

  const openAppDetails = async (id) => {
    setSelectedAppId(id)
    setModalLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/crm/applications/${id}`)
      const json = await res.json()
      if (json.success) setSelectedDetails(json)
    } catch (err) {
      console.error('Failed to load application details', err)
    } finally {
      setModalLoading(false)
    }
  }

  const handleStatusChange = async (id, newStatus, reason = null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/crm/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          officerName,
          notes: `Status changed to ${newStatus.toUpperCase()} by ${officerName}.`,
          rejectionReason: reason,
        }),
      })
      if (res.ok) {
        fetchApplications()
        if (selectedAppId === id) openAppDetails(id)
      }
    } catch (err) {
      console.error('Failed to update status', err)
    }
  }

  return (
    <div style={{ maxWidth: '1360px', margin: '32px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={28} color="#006643" />
            <h1 style={{ fontSize: '26px', color: '#10281f', margin: 0 }}>NBE Operations & Case CRM</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: '#60706a', fontSize: '14px' }}>
            Logged in as: <strong style={{ color: '#006643' }}>{officerName}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="button button-secondary" onClick={() => setShowCpuMonitor(!showCpuMonitor)} title="Toggle CPU Monitor">
            <Activity size={16} /> Metrics
          </button>
          <button className="button button-secondary" onClick={fetchApplications} title="Refresh records">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="button button-secondary" onClick={onBackToForm}>
            Applicant Portal
          </button>
          <button
            onClick={onLogout}
            style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fca5a5',
              padding: '8px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          background: '#f8fbfa',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #dce4e0',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search by Reference ID (e.g. NBE-26-...) or Applicant Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #b9c8c2',
              fontSize: '14px',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            minHeight: '44px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #b9c8c2',
            background: 'white',
            fontWeight: '600',
            fontSize: '13px',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft (In-Progress)</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Data Table */}
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #dce4e0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(19,55,42,0.05)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f4f7f6', borderBottom: '1px solid #dce4e0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <tr>
              <th style={{ padding: '14px 18px' }}>Reference</th>
              <th style={{ padding: '14px 18px' }}>Applicant</th>
              <th style={{ padding: '14px 18px' }}>Contact</th>
              <th style={{ padding: '14px 18px' }}>Governorate</th>
              <th style={{ padding: '14px 18px' }}>Fulfillment</th>
              <th style={{ padding: '14px 18px' }}>Status</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '13px' }}>
            {applications.map((app) => (
              <tr key={app.id} style={{ borderBottom: '1px solid #eef3f1' }}>
                <td style={{ padding: '14px 18px', fontWeight: 'bold', color: '#006643' }}>
                  {app.reference_number}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <strong>{app.full_name || 'Anonymous Draft'}</strong>
                  <div style={{ color: '#60706a', fontSize: '11px' }}>Step: {app.current_step}</div>
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div>{app.mobile_hash || 'N/A'}</div>
                  <small style={{ color: '#60706a' }}>{app.email_hash || 'N/A'}</small>
                </td>
                <td style={{ padding: '14px 18px' }}>{app.governorate || 'N/A'}</td>
                <td style={{ padding: '14px 18px', textTransform: 'capitalize' }}>
                  {app.fulfillment_method || 'Branch'}
                  {app.selected_branch && (
                    <div style={{ color: '#60706a', fontSize: '11px', textTransform: 'none' }}>
                      {app.selected_branch}
                    </div>
                  )}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '800',
                      background:
                        app.status === 'approved'
                          ? '#dcfce7'
                          : app.status === 'rejected'
                          ? '#fee2e2'
                          : app.status === 'submitted'
                          ? '#e0f2fe'
                          : '#fef9c3',
                      color:
                        app.status === 'approved'
                          ? '#166534'
                          : app.status === 'rejected'
                          ? '#991b1b'
                          : app.status === 'submitted'
                          ? '#0369a1'
                          : '#854d0e',
                    }}
                  >
                    {app.status?.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => openAppDetails(app.id)}
                    style={{
                      background: '#f0faf5',
                      color: '#006643',
                      border: '1px solid #9ccbb8',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      marginRight: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    Inspect
                  </button>
                  <button
                    onClick={() => handleStatusChange(app.id, 'approved')}
                    style={{
                      background: '#006643',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      marginRight: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusChange(app.id, 'rejected', 'Verification mismatch')}
                    style={{
                      background: '#b42318',
                      color: 'white',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {applications.length === 0 && !loading && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#60706a' }}>
            No customer applications found matching filter criteria.
          </div>
        )}
      </div>

      {/* Details & Audit Trail Inspection Modal */}
      {selectedAppId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: 'white',
              width: 'min(760px, 94vw)',
              maxHeight: '88vh',
              borderRadius: '12px',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', color: '#10281f', margin: 0 }}>
                Dossier: {selectedDetails?.application?.reference_number || 'Loading...'}
              </h2>
              <button
                onClick={() => { setSelectedAppId(null); setSelectedDetails(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {modalLoading ? (
              <p>Loading application dossier...</p>
            ) : (
              selectedDetails && (
                <div>
                  {/* Summary Profile Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px', background: '#f8faf9', padding: '16px', borderRadius: '8px' }}>
                    <div><strong>Name:</strong> {selectedDetails.application.first_name} {selectedDetails.application.last_name}</div>
                    <div><strong>National ID:</strong> {selectedDetails.application.national_id_hash || 'N/A'}</div>
                    <div><strong>DOB:</strong> {selectedDetails.application.date_of_birth ? selectedDetails.application.date_of_birth.split('T')[0] : 'N/A'}</div>
                    <div><strong>Governorate:</strong> {selectedDetails.application.governorate || 'N/A'}</div>
                    <div><strong>Mobile:</strong> {selectedDetails.application.mobile_hash || 'N/A'}</div>
                    <div><strong>Email:</strong> {selectedDetails.application.email_hash || 'N/A'}</div>
                    <div><strong>Employment:</strong> {selectedDetails.application.employment_status || 'N/A'}</div>
                    <div><strong>Monthly Income:</strong> {selectedDetails.application.income_range || 'N/A'}</div>
                    <div><strong>Selected Branch:</strong> {selectedDetails.application.selected_branch || 'N/A'}</div>
                    <div>
                      <strong>Appointment:</strong>{' '}
                      {selectedDetails.application.appointment_date
                        ? `${selectedDetails.application.appointment_date.split('T')[0]} · ${selectedDetails.application.appointment_slot || 'Standard Slot'}`
                        : 'N/A'}
                    </div>
                  </div>

                  {selectedFields.faceVerification && (
                    <div style={{ marginBottom: '24px', background: '#f0faf5', border: '1px solid #9ccbb8', borderRadius: '8px', padding: '14px 16px' }}>
                      <h3 style={{ fontSize: '16px', color: '#006643', margin: '0 0 10px' }}>Face Verification</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                        <div><strong>Status:</strong> {formatCrmValue(selectedFields.faceVerification.status)}</div>
                        <div><strong>Best similarity:</strong> {selectedFields.faceVerification.bestSimilarity !== undefined ? `${selectedFields.faceVerification.bestSimilarity}%` : 'N/A'}</div>
                      </div>
                    </div>
                  )}

                  {crmFieldSections.map((section) => (
                    <div key={section.title} style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '16px', color: '#006643', margin: '0 0 12px' }}>{section.title}</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', background: '#fbfcfc', border: '1px solid #edf2f0', borderRadius: '8px', padding: '14px', fontSize: '12px' }}>
                        {section.fields.map(([key, label]) => (
                          <div key={key}>
                            <span style={{ display: 'block', color: '#60706a', fontSize: '11px' }}>{label}</span>
                            <strong style={{ overflowWrap: 'anywhere' }}>{formatCrmValue(selectedFields[key])}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', color: '#006643', margin: '0 0 12px' }}>Uploaded Documents</h3>
                    {selectedDocuments.length > 0 ? (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {selectedDocuments.map((document) => (
                          <div key={document.id} style={{ display: 'grid', gridTemplateColumns: document.mime_type?.startsWith('image/') ? '112px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto', alignItems: 'center', gap: '12px', border: '1px solid #dce4e0', borderRadius: '8px', padding: '12px 14px', background: '#ffffff' }}>
                            {document.mime_type?.startsWith('image/') && (
                              <a href={`${API_BASE_URL}${document.view_url}`} target="_blank" rel="noreferrer" style={{ display: 'block', width: '112px', aspectRatio: '4 / 3', overflow: 'hidden', borderRadius: '6px', border: '1px solid #dce4e0', background: '#f4f7f6' }}>
                                <DocumentPreviewImage document={document} />
                              </a>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ display: 'block', color: '#10281f' }}>{documentTitle(document)}</strong>
                              <span style={{ display: 'block', color: '#60706a', fontSize: '12px', overflowWrap: 'anywhere' }}>
                                {document.original_name} · {formatFileSize(document.file_size)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {document.mime_type?.startsWith('image/') && (
                                <a
                                  className="button button-secondary"
                                  href={`${API_BASE_URL}${document.view_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                                >
                                  View
                                </a>
                              )}
                            <a
                              className="button button-secondary"
                              href={`${API_BASE_URL}${document.download_url}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                            >
                              Download
                            </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#889892', fontSize: '12px' }}>No uploaded documents are attached to this application yet.</p>
                    )}
                  </div>

                  {/* Audit Trail Timeline */}
                  <h3 style={{ fontSize: '16px', color: '#006643', marginBottom: '12px' }}>Compliance Audit Trail</h3>
                  <div style={{ borderLeft: '2px solid #006643', paddingLeft: '16px', margin: '12px 0 24px' }}>
                    {selectedDetails.auditTrail?.map((log) => (
                      <div key={log.id} style={{ marginBottom: '12px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                          {log.action} <small style={{ color: '#60706a' }}>by {log.performed_by}</small>
                        </div>
                        <div style={{ color: '#60706a', fontSize: '12px' }}>
                          Status changed: <em>{log.previous_status || 'initial'}</em> $\rightarrow$ <strong>{log.new_status}</strong>
                        </div>
                        {log.notes && <div style={{ fontSize: '12px', color: '#17211d' }}>Note: {log.notes}</div>}
                        <small style={{ color: '#889892', fontSize: '10px' }}>{new Date(log.created_at).toLocaleString()}</small>
                      </div>
                    ))}
                    {(!selectedDetails.auditTrail || selectedDetails.auditTrail.length === 0) && (
                      <p style={{ color: '#889892', fontSize: '12px' }}>No audit history recorded yet.</p>
                    )}
                  </div>

                  {/* Action Buttons inside Modal */}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      className="button button-primary"
                      onClick={() => handleStatusChange(selectedDetails.application.id, 'approved')}
                    >
                      Approve Application
                    </button>
                    <button
                      style={{ background: '#b42318', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => handleStatusChange(selectedDetails.application.id, 'rejected', 'Verification mismatch')}
                    >
                      Reject Application
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {showCpuMonitor && <CpuMonitor onClose={() => setShowCpuMonitor(false)} />}
    </div>
  )
}

