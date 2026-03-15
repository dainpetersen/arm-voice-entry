import { Outlet, Link } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { useDashboardStorage } from '../hooks/useDashboardStorage'
import type { Season } from '../types'
import '../dashboard.css'

type DashboardStorageReturn = ReturnType<typeof useDashboardStorage>

interface DashboardContextValue extends DashboardStorageReturn {
  currentSeasonId: string | null
  setCurrentSeasonId: (id: string | null) => void
  currentSeason: Season | null
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardLayout')
  return ctx
}

export function DashboardLayout() {
  const storage = useDashboardStorage()
  const { data } = storage
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile/small screens
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Default to most recent season
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(() => {
    if (data.seasons.length === 0) return null
    return data.seasons.sort((a, b) => b.year - a.year)[0]!.id
  })

  // Auto-select first season if none selected but seasons exist
  useEffect(() => {
    if (!currentSeasonId && data.seasons.length > 0) {
      setCurrentSeasonId(data.seasons.sort((a, b) => b.year - a.year)[0]!.id)
    }
  }, [currentSeasonId, data.seasons])

  const currentSeason = data.seasons.find(s => s.id === currentSeasonId) ?? null

  const contextValue: DashboardContextValue = {
    ...storage,
    currentSeasonId,
    setCurrentSeasonId,
    currentSeason,
  }

  if (isMobile) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 32, textAlign: 'center', background: '#0f172a', color: '#e2e8f0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🖥️</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Desktop Only</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, maxWidth: 300 }}>
          The Farm Management Dashboard is designed for desktop screens. Please open this page on a computer or widen your browser window.
        </p>
        <Link to="/" style={{ marginTop: 24, color: '#22d3ee', fontSize: 14, textDecoration: 'none' }}>
          ← Go to Voice Entry App
        </Link>
      </div>
    )
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="dashboard-shell">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <Link to="/dashboard" className="dashboard-topbar-logo">
              CROP<span>WISE</span>
            </Link>
            <span className="dashboard-breadcrumb">Farm Management</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {data.seasons.length > 0 ? (
              <select
                className="dashboard-season-select"
                value={currentSeasonId ?? ''}
                onChange={e => setCurrentSeasonId(e.target.value || null)}
              >
                {data.seasons
                  .sort((a, b) => b.year - a.year)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>No seasons — create one to get started</span>
            )}
          </div>
        </header>

        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </DashboardContext.Provider>
  )
}
