import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../../config/api'

const POLL_INTERVAL_MS = 2500
const HISTORY_LENGTH = 40 // data points kept for the sparkline

function Sparkline({ values, color = '#006643', height = 36 }) {
  if (values.length < 2) return null
  const max = 100
  const w = 180
  const h = height
  const step = w / (HISTORY_LENGTH - 1)

  const points = Array.from({ length: HISTORY_LENGTH }, (_, i) => {
    const val = values[HISTORY_LENGTH - values.length + i] ?? 0
    const x = i * step
    const y = h - (val / max) * h
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${h} ${points} ${w},${h}`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function CoreBar({ usage, index }) {
  const color = usage > 85 ? '#b42318' : usage > 60 ? '#c97c00' : '#006643'
  return (
    <div className="cpu-core-bar" title={`Core ${index}: ${usage}%`}>
      <div className="cpu-core-bar-track">
        <div
          className="cpu-core-bar-fill"
          style={{ height: `${usage}%`, background: color, transition: 'height 0.5s cubic-bezier(.2,.8,.2,1)' }}
        />
      </div>
      <span className="cpu-core-label">{index + 1}</span>
    </div>
  )
}

function StatCell({ label, value, sub, accent }) {
  return (
    <div className="cpu-stat-cell">
      <span className="cpu-stat-label">{label}</span>
      <strong className="cpu-stat-value" style={accent ? { color: accent } : {}}>
        {value}
      </strong>
      {sub && <span className="cpu-stat-sub">{sub}</span>}
    </div>
  )
}

export function CpuMonitor({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [usageHistory, setUsageHistory] = useState([])
  const [memHistory, setMemHistory] = useState([])
  const intervalRef = useRef(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/metrics/cpu`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
      setUsageHistory((prev) => [...prev.slice(-(HISTORY_LENGTH - 1)), json.avgUsagePercent])
      setMemHistory((prev) => [...prev.slice(-(HISTORY_LENGTH - 1)), json.memoryUsagePercent])
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    intervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [fetchMetrics])

  const usageColor = data
    ? data.avgUsagePercent > 85 ? '#b42318' : data.avgUsagePercent > 60 ? '#c97c00' : '#006643'
    : '#006643'

  const memColor = data
    ? data.memoryUsagePercent > 90 ? '#b42318' : data.memoryUsagePercent > 70 ? '#c97c00' : '#006643'
    : '#006643'

  const fmtUptime = (seconds) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${s}s`
    return `${m}m ${s}s`
  }

  return (
    <div className="cpu-monitor-panel" role="region" aria-label="CPU & System Monitor">
      {/* Header */}
      <div className="cpu-monitor-header">
        <div className="cpu-monitor-title">
          <div className="cpu-monitor-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
              <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
              <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
            </svg>
          </div>
          <div>
            <strong className="cpu-monitor-name">System Monitor</strong>
            <span className="cpu-monitor-subtitle">
              {data ? data.model : 'Loading…'}
            </span>
          </div>
        </div>
        <div className="cpu-monitor-header-right">
          <span className="cpu-live-badge" aria-label="Live data">● LIVE</span>
          {onClose && (
            <button className="cpu-close-btn" onClick={onClose} aria-label="Close monitor">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="cpu-error-banner" role="alert">
          ⚠ Cannot reach metrics endpoint — {error}
        </div>
      )}

      {data && (
        <>
          {/* CPU & vCPU stat row */}
          <div className="cpu-stat-row">
            <StatCell
              label="Logical Cores (vCPUs)"
              value={data.logicalCores}
              sub="Hyperthreaded threads"
            />
            <StatCell
              label="Physical Cores (est.)"
              value={data.physicalCores}
              sub="÷2 from logical"
            />
            <StatCell
              label="Clock Speed"
              value={`${(data.speedMhz / 1000).toFixed(1)} GHz`}
              sub={`${data.speedMhz} MHz`}
            />
            <StatCell
              label="Process Uptime"
              value={fmtUptime(data.processUptime)}
              sub="Node.js server"
            />
          </div>

          {/* CPU Usage chart */}
          <div className="cpu-chart-card">
            <div className="cpu-chart-header">
              <span className="cpu-chart-label">CPU Usage</span>
              <span className="cpu-chart-value" style={{ color: usageColor }}>
                {data.avgUsagePercent}%
              </span>
            </div>
            <div className="cpu-chart-sparkline">
              <Sparkline values={usageHistory} color={usageColor} height={52} />
            </div>
            <div className="cpu-chart-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
          </div>

          {/* Memory Usage chart */}
          <div className="cpu-chart-card">
            <div className="cpu-chart-header">
              <span className="cpu-chart-label">Memory Usage</span>
              <span className="cpu-chart-value" style={{ color: memColor }}>
                {data.memoryUsagePercent}%
                <span className="cpu-chart-value-sub">
                  {data.usedMemoryMb.toLocaleString()} / {data.totalMemoryMb.toLocaleString()} MB
                </span>
              </span>
            </div>
            <div className="cpu-chart-sparkline">
              <Sparkline values={memHistory} color={memColor} height={52} />
            </div>
            <div className="cpu-chart-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
          </div>

          {/* Per-core bars */}
          <div className="cpu-cores-section">
            <span className="cpu-cores-label">Per-Core Usage</span>
            <div className="cpu-cores-grid">
              {data.perCoreUsagePercent.map((usage, i) => (
                <CoreBar key={i} usage={usage} index={i} />
              ))}
            </div>
          </div>

          {/* System load + Node RSS */}
          <div className="cpu-stat-row cpu-stat-row-bottom">
            <StatCell
              label="Load Avg (1m)"
              value={data.loadAvg1m === 0 ? 'N/A' : data.loadAvg1m}
              sub={data.loadAvg1m === 0 ? 'Windows — unavailable' : undefined}
            />
            <StatCell
              label="Load Avg (5m)"
              value={data.loadAvg5m === 0 ? 'N/A' : data.loadAvg5m}
            />
            <StatCell
              label="Load Avg (15m)"
              value={data.loadAvg15m === 0 ? 'N/A' : data.loadAvg15m}
            />
            <StatCell
              label="Node.js RSS"
              value={`${data.nodeMemoryMb} MB`}
              sub="Process heap"
            />
          </div>

          <div className="cpu-sampled-at">
            Sampled {new Date(data.sampledAt).toLocaleTimeString()} · every {POLL_INTERVAL_MS / 1000}s
          </div>
        </>
      )}

      {!data && !error && (
        <div className="cpu-loading">
          <span className="cpu-loading-dot" />
          <span className="cpu-loading-dot" />
          <span className="cpu-loading-dot" />
          <span style={{ marginLeft: 8, fontSize: 11, color: '#74807c' }}>Reading system metrics…</span>
        </div>
      )}
    </div>
  )
}
