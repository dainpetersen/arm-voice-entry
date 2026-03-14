import { Component, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTrialStorage } from './hooks/useTrialStorage'
import { useSync } from './hooks/useSync'
import { AuthGate } from './components/AuthGate'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { RecordPage } from './pages/RecordPage'
import { ReviewPage } from './pages/ReviewPage'

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
    <AuthGate>
    <div className="container">
      <Routes>
        <Route path="/" element={<HomePage {...storage} syncStatus={syncStatus} />} />
        <Route path="/setup" element={<SetupPage onSave={storage.saveConfig} />} />
        <Route path="/setup/:id" element={<SetupPage configs={storage.configs} onSave={storage.saveConfig} />} />
        <Route
          path="/record/:id"
          element={
            <RecordPage
              configs={storage.configs}
              sessions={storage.sessions}
              onSaveSession={storage.saveSession}
            />
          }
        />
        <Route
          path="/review/:id/:startedAt"
          element={
            <ReviewPage
              sessions={storage.sessions}
              onDeleteSession={storage.deleteSession}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
    </AuthGate>
    </ErrorBoundary>
  )
}
