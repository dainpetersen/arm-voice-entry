import { supabase, isSupabaseConfigured } from './supabase'
import type { TrialConfig, TrialSession, PlotData } from '../types'

const SYNC_QUEUE_KEY = 'arm-voice-sync-queue'
const LAST_SYNC_KEY = 'arm-voice-last-sync'

interface SyncQueueItem {
  type: 'config' | 'session' | 'delete-config' | 'delete-session'
  payload: unknown
  timestamp: number
}

// --- Queue management ---

function getQueue(): SyncQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: SyncQueueItem[]) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
}

export function enqueueSync(item: SyncQueueItem) {
  if (!isSupabaseConfigured()) return
  const queue = getQueue()
  queue.push(item)
  saveQueue(queue)
}

// --- Config sync ---

async function syncConfig(config: TrialConfig, userId: string) {
  if (!supabase) return

  const { error } = await supabase
    .from('trial_configs')
    .upsert({
      id: config.id,
      name: config.name,
      treatments: config.treatments,
      replications: config.replications,
      serpentine: config.serpentine,
      variables: config.variables,
      created_at: config.createdAt,
      user_id: userId,
    })

  if (error) throw error
}

async function deleteConfigRemote(configId: string) {
  if (!supabase) return
  const { error } = await supabase
    .from('trial_configs')
    .delete()
    .eq('id', configId)
  if (error) throw error
}

// --- Session sync ---

async function syncSession(session: TrialSession, userId: string) {
  if (!supabase) return

  const sessionId = `${session.config.id}-${session.startedAt}`

  // Upsert session metadata
  const { error: sessionError } = await supabase
    .from('trial_sessions')
    .upsert({
      id: sessionId,
      config_id: session.config.id,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      current_plot_index: session.currentPlotIndex,
      current_variable_index: session.currentVariableIndex,
      current_sub_sample_index: session.currentSubSampleIndex,
      user_id: userId,
    })

  if (sessionError) throw sessionError

  // Upsert plot data (without photos — those go to storage)
  const plotRows = session.data.map((plot: PlotData) => ({
    session_id: sessionId,
    plot_number: plot.plotNumber,
    readings: plot.readings,
    notes: plot.notes,
  }))

  const { error: plotError } = await supabase
    .from('plot_data')
    .upsert(plotRows, { onConflict: 'session_id,plot_number' })

  if (plotError) throw plotError

  // Upload photos to storage
  for (const plot of session.data) {
    for (let i = 0; i < plot.photos.length; i++) {
      const photo = plot.photos[i]!
      if (!photo.dataUrl.startsWith('data:')) continue // already a storage URL

      const path = `${userId}/${sessionId}/${plot.plotNumber}_${photo.timestamp}.jpg`

      // Convert base64 to blob
      const res = await fetch(photo.dataUrl)
      const blob = await res.blob()

      const { error: uploadError } = await supabase.storage
        .from('plot-photos')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        console.warn('Photo upload failed:', uploadError.message)
        continue
      }

      // Save photo reference
      await supabase.from('plot_photos').upsert({
        session_id: sessionId,
        plot_number: plot.plotNumber,
        storage_path: path,
        timestamp: photo.timestamp,
      })
    }
  }
}

async function deleteSessionRemote(configId: string, startedAt: number) {
  if (!supabase) return
  const sessionId = `${configId}-${startedAt}`
  const { error } = await supabase
    .from('trial_sessions')
    .delete()
    .eq('id', sessionId)
  if (error) throw error
}

// --- Process the offline queue ---

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  if (!supabase) return { synced: 0, failed: 0 }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { synced: 0, failed: 0 }

  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining: SyncQueueItem[] = []

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'config':
          await syncConfig(item.payload as TrialConfig, user.id)
          break
        case 'session':
          await syncSession(item.payload as TrialSession, user.id)
          break
        case 'delete-config':
          await deleteConfigRemote(item.payload as string)
          break
        case 'delete-session': {
          const { configId, startedAt } = item.payload as { configId: string; startedAt: number }
          await deleteSessionRemote(configId, startedAt)
          break
        }
      }
      synced++
    } catch (err) {
      console.warn('Sync failed for item:', err)
      remaining.push(item)
      failed++
    }
  }

  saveQueue(remaining)
  if (synced > 0) {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
  }

  return { synced, failed }
}

// --- Pull data from Supabase (for initial load / multi-device) ---

export async function pullFromRemote(): Promise<{
  configs: TrialConfig[]
  sessions: TrialSession[]
} | null> {
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch configs
  const { data: configRows, error: configError } = await supabase
    .from('trial_configs')
    .select('*')
    .eq('user_id', user.id)

  if (configError) throw configError

  const configs: TrialConfig[] = (configRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    treatments: r.treatments as number,
    replications: r.replications as number,
    serpentine: r.serpentine as boolean,
    variables: r.variables as TrialConfig['variables'],
    createdAt: r.created_at as number,
  }))

  // Fetch sessions with plot data
  const { data: sessionRows, error: sessionError } = await supabase
    .from('trial_sessions')
    .select('*, plot_data(*)')
    .eq('user_id', user.id)

  if (sessionError) throw sessionError

  const sessions: TrialSession[] = (sessionRows ?? []).map((r: Record<string, unknown>) => {
    const config = configs.find(c => c.id === r.config_id)
    const plotDataRows = (r.plot_data as Record<string, unknown>[]) ?? []

    const data: PlotData[] = plotDataRows.map((pd: Record<string, unknown>) => ({
      plotNumber: pd.plot_number as number,
      readings: pd.readings as Record<string, (number | null)[]>,
      notes: (pd.notes as PlotData['notes']) ?? [],
      photos: [], // Photos loaded separately from storage
    }))

    return {
      config: config ?? {
        id: r.config_id as string,
        name: 'Unknown',
        treatments: 0,
        replications: 0,
        serpentine: true,
        variables: [],
        createdAt: 0,
      },
      data,
      currentPlotIndex: r.current_plot_index as number,
      currentVariableIndex: r.current_variable_index as number,
      currentSubSampleIndex: r.current_sub_sample_index as number,
      startedAt: r.started_at as number,
      completedAt: r.completed_at as number | null,
    }
  })

  return { configs, sessions }
}

// --- Utility ---

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

export function getPendingCount(): number {
  return getQueue().length
}
