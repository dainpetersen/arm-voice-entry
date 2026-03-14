import { useState, useEffect, useCallback } from 'react'
import type { TrialConfig, TrialSession } from '../types'

const CONFIGS_KEY = 'arm-voice-trial-configs'
const SESSIONS_KEY = 'arm-voice-trial-sessions'

export function useTrialStorage() {
  const [configs, setConfigs] = useState<TrialConfig[]>([])
  const [sessions, setSessions] = useState<TrialSession[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedConfigs = localStorage.getItem(CONFIGS_KEY)
      if (savedConfigs) setConfigs(JSON.parse(savedConfigs))

      const savedSessions = localStorage.getItem(SESSIONS_KEY)
      if (savedSessions) setSessions(JSON.parse(savedSessions))
    } catch {
      console.warn('Failed to load saved data')
    }
  }, [])

  const saveConfig = useCallback((config: TrialConfig) => {
    setConfigs(prev => {
      const existing = prev.findIndex(c => c.id === config.id)
      const next = existing >= 0
        ? prev.map(c => c.id === config.id ? config : c)
        : [...prev, config]
      localStorage.setItem(CONFIGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const deleteConfig = useCallback((id: string) => {
    setConfigs(prev => {
      const next = prev.filter(c => c.id !== id)
      localStorage.setItem(CONFIGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const saveSession = useCallback((session: TrialSession) => {
    setSessions(prev => {
      const key = `${session.config.id}-${session.startedAt}`
      const existing = prev.findIndex(s => `${s.config.id}-${s.startedAt}` === key)
      const next = existing >= 0
        ? prev.map((s, i) => i === existing ? session : s)
        : [...prev, session]
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const deleteSession = useCallback((configId: string, startedAt: number) => {
    setSessions(prev => {
      const next = prev.filter(s => !(s.config.id === configId && s.startedAt === startedAt))
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { configs, sessions, saveConfig, deleteConfig, saveSession, deleteSession }
}
