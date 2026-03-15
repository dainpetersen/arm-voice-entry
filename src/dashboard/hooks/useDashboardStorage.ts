import { useState, useEffect, useCallback } from 'react'
import type { DashboardData, Farm, Season, Field, Plot, Client, DashboardTrial } from '../types'
import { DEFAULT_DASHBOARD_DATA } from '../types'
import { generateSeedData } from '../seedData'

const STORAGE_KEY = 'arm-dashboard-data'

function loadData(): DashboardData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_DASHBOARD_DATA, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  // Auto-load demo data on first visit
  const seed = generateSeedData()
  persist(seed)
  return seed
}

function persist(data: DashboardData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useDashboardStorage() {
  const [data, setData] = useState<DashboardData>(loadData)

  // Sync from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setData(loadData())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const update = useCallback((updater: (prev: DashboardData) => DashboardData) => {
    setData(prev => {
      const next = updater(prev)
      persist(next)
      return next
    })
  }, [])

  // --- Farm ---
  const saveFarm = useCallback((farm: Farm) => {
    update(d => ({ ...d, farm }))
  }, [update])

  // --- Seasons ---
  const saveSeason = useCallback((season: Season) => {
    update(d => ({
      ...d,
      seasons: d.seasons.some(s => s.id === season.id)
        ? d.seasons.map(s => s.id === season.id ? season : s)
        : [...d.seasons, season],
    }))
  }, [update])

  const deleteSeason = useCallback((id: string) => {
    update(d => ({ ...d, seasons: d.seasons.filter(s => s.id !== id) }))
  }, [update])

  // --- Fields ---
  const saveField = useCallback((field: Field) => {
    update(d => ({
      ...d,
      fields: d.fields.some(f => f.id === field.id)
        ? d.fields.map(f => f.id === field.id ? field : f)
        : [...d.fields, field],
    }))
  }, [update])

  const deleteField = useCallback((id: string) => {
    update(d => ({ ...d, fields: d.fields.filter(f => f.id !== id) }))
  }, [update])

  // --- Plots ---
  const savePlot = useCallback((plot: Plot) => {
    update(d => ({
      ...d,
      plots: d.plots.some(p => p.id === plot.id)
        ? d.plots.map(p => p.id === plot.id ? plot : p)
        : [...d.plots, plot],
    }))
  }, [update])

  const savePlots = useCallback((plots: Plot[]) => {
    update(d => {
      const ids = new Set(plots.map(p => p.id))
      const existing = d.plots.filter(p => !ids.has(p.id))
      return { ...d, plots: [...existing, ...plots] }
    })
  }, [update])

  const deletePlot = useCallback((id: string) => {
    update(d => ({ ...d, plots: d.plots.filter(p => p.id !== id) }))
  }, [update])

  // --- Clients ---
  const saveClient = useCallback((client: Client) => {
    update(d => ({
      ...d,
      clients: d.clients.some(c => c.id === client.id)
        ? d.clients.map(c => c.id === client.id ? client : c)
        : [...d.clients, client],
    }))
  }, [update])

  const deleteClient = useCallback((id: string) => {
    update(d => ({ ...d, clients: d.clients.filter(c => c.id !== id) }))
  }, [update])

  // --- Trials ---
  const saveTrial = useCallback((trial: DashboardTrial) => {
    update(d => ({
      ...d,
      trials: d.trials.some(t => t.id === trial.id)
        ? d.trials.map(t => t.id === trial.id ? trial : t)
        : [...d.trials, trial],
    }))
  }, [update])

  const deleteTrial = useCallback((id: string) => {
    update(d => ({ ...d, trials: d.trials.filter(t => t.id !== id) }))
  }, [update])

  const loadBulkData = useCallback((newData: DashboardData) => {
    setData(newData)
    persist(newData)
  }, [])

  return {
    data,
    saveFarm,
    saveSeason, deleteSeason,
    saveField, deleteField,
    savePlot, savePlots, deletePlot,
    saveClient, deleteClient,
    saveTrial, deleteTrial,
    loadBulkData,
  }
}
