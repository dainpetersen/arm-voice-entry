import { useState, useEffect, useCallback, useRef } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { processQueue, getLastSyncTime, getPendingCount } from '../lib/sync'

export interface SyncStatus {
  enabled: boolean
  isSyncing: boolean
  lastSync: string | null
  pendingCount: number
  error: string | null
}

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>({
    enabled: isSupabaseConfigured(),
    isSyncing: false,
    lastSync: getLastSyncTime(),
    pendingCount: getPendingCount(),
    error: null,
  })
  const syncingRef = useRef(false)

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured() || syncingRef.current) return
    syncingRef.current = true
    setStatus(prev => ({ ...prev, isSyncing: true, error: null }))

    try {
      const result = await processQueue()
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSync: getLastSyncTime(),
        pendingCount: getPendingCount(),
        error: result.failed > 0 ? `${result.failed} item(s) failed to sync` : null,
      }))
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      }))
    } finally {
      syncingRef.current = false
    }
  }, [])

  // Auto-sync when online
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const handleOnline = () => { syncNow() }
    window.addEventListener('online', handleOnline)

    // Sync on mount if online
    if (navigator.onLine) {
      syncNow()
    }

    // Periodic sync every 30 seconds
    const interval = setInterval(() => {
      if (navigator.onLine && getPendingCount() > 0) {
        syncNow()
      }
    }, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [syncNow])

  // Update pending count when it changes
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => {
        const count = getPendingCount()
        return count !== prev.pendingCount ? { ...prev, pendingCount: count } : prev
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return { ...status, syncNow }
}
