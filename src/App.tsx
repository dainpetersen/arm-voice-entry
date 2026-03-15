import { Component, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTrialStorage } from './hooks/useTrialStorage'
import { useSync } from './hooks/useSync'
import { AuthGate } from './components/AuthGate'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { RecordPage } from './pages/RecordPage'
import { ReviewPage } from './pages/ReviewPage'
import { DashboardLayout } from './dashboard/components/DashboardLayout'
import { DashboardHomePage } from './dashboard/pages/DashboardHomePage'
import { MapPage } from './dashboard/pages/MapPage'
import { TrialsPage } from './dashboard/pages/TrialsPage'
import { TrialDetailPage } from './dashboard/pages/TrialDetailPage'
import { ClientsPage } from './dashboard/pages/ClientsPage'
import { SchedulePage } from './dashboard/pages/SchedulePage'
import { WorkflowsPage } from './dashboard/pages/WorkflowsPage'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  const storage = useTrialStorage()
  const syncStatus = useSync()

  return (
    <ErrorBoundary>
      <Routes>
        {/* Dashboard routes — own layout, no auth gate */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHomePage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="trials" element={<TrialsPage />} />
          <Route path="trials/:id" element={<TrialDetailPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
        </Route>

        {/* Mobile voice-entry routes — existing .container wrapper with auth */}
        <Route path="/*" element={
          <AuthGate>
            <Routes>
              <Route path="/" element={
                <div className="container">
                  <HomePage {...storage} syncStatus={syncStatus} />
                </div>
              } />
              <Route path="/setup" element={
                <div className="container">
                  <SetupPage onSave={storage.saveConfig} />
                </div>
              } />
              <Route path="/setup/:id" element={
                <div className="container">
                  <SetupPage configs={storage.configs} onSave={storage.saveConfig} />
                </div>
              } />
              <Route path="/record/:id" element={
                <div className="container">
                  <RecordPage configs={storage.configs} sessions={storage.sessions} onSaveSession={storage.saveSession} />
                </div>
              } />
              <Route path="/review/:id/:startedAt" element={
                <div className="container">
                  <ReviewPage sessions={storage.sessions} onDeleteSession={storage.deleteSession} />
                </div>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthGate>
        } />
      </Routes>
    </ErrorBoundary>
  )
}
