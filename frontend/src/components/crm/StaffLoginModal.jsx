import { useState } from 'react'
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react'

export function StaffLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    // Mock banking employee credentials
    // You can test with: ID: admin or nbe_officer / Password: admin
    const validStaff = [
      { id: 'admin', pass: 'admin', name: 'Senior Branch Officer (Admin)' },
      { id: 'nbe_officer', pass: 'nbe2026', name: 'Operations Officer' },
      { id: 'compliance', pass: 'compliance123', name: 'KYC Compliance Lead' }
    ]

    const staffMember = validStaff.find(
      (s) => s.id.toLowerCase() === employeeId.trim().toLowerCase() && s.pass === password
    )

    if (staffMember) {
      // Save authenticated session in sessionStorage
      sessionStorage.setItem('nbe_staff_auth', JSON.stringify({
        authenticated: true,
        employeeId: staffMember.id,
        name: staffMember.name,
        loginTime: new Date().toISOString()
      }))
      onLoginSuccess(staffMember)
      onClose()
    } else {
      setError('Invalid Staff ID or Password. (Demo: admin / admin)')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 25, 20, 0.65)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          width: 'min(440px, 92vw)',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: '1px solid #c8d8d0',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#60706a',
          }}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              backgroundColor: '#e6f3ee',
              color: '#006643',
              padding: '8px',
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#10281f' }}>Staff Portal Authentication</h2>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#556660' }}>
          Restricted access for National Bank of Egypt operations and retail branch supervisors.
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2b3a34', marginBottom: '6px' }}>
              Staff ID / Username
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. admin"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #b8c8c2',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2b3a34', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #b8c8c2',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginTop: '10px' }}>
            <button
              type="submit"
              className="button button-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
            >
              <Lock size={16} /> Authenticate & Enter CRM
            </button>
          </div>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#80908a' }}>
          Demo credentials: <strong>admin</strong> / <strong>admin</strong>
        </div>
      </div>
    </div>
  )
}
