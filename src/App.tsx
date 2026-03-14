import { Routes, Route, Navigate } from 'react-router-dom'
import { useTrialStorage } from './hooks/useTrialStorage'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { RecordPage } from './pages/RecordPage'
import { ReviewPage } from './pages/ReviewPage'

export function App() {
  const storage = useTrialStorage()

  return (
    <div className="container">
      <Routes>
        <Route path="/" element={<HomePage {...storage} />} />
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
  )
}
