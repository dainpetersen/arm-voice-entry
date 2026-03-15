import { useState, useCallback } from 'react'
import { useDashboard } from '../components/DashboardLayout'
import { FarmMap } from '../components/FarmMap'
import { MapDrawTools } from '../components/MapDrawTools'
import { MapFieldPanel } from '../components/MapFieldPanel'
import { FlyToField } from '../components/FlyToField'
import { AutoPlanner } from '../components/AutoPlanner'
import type { Field, Plot, LngLat } from '../types'

export function MapPage() {
  const { data, currentSeasonId, saveFarm, saveField, deleteField, savePlots, saveTrial, deletePlot } = useDashboard()
  const [flyTarget, setFlyTarget] = useState<LngLat[] | null>(null)
  const [showAutoPlanner, setShowAutoPlanner] = useState(false)

  const seasonPlots = data.plots.filter(p => p.seasonId === currentSeasonId)

  const center: [number, number] | undefined = data.farm
    ? [data.farm.centerLat, data.farm.centerLng]
    : undefined

  const zoom = data.farm?.defaultZoom

  function handleFarmLocationSet(lat: number, lng: number, z: number) {
    saveFarm({
      id: data.farm?.id ?? crypto.randomUUID(),
      name: data.farm?.name ?? 'My Farm',
      centerLat: lat,
      centerLng: lng,
      defaultZoom: z,
      createdAt: data.farm?.createdAt ?? Date.now(),
    })
  }

  function handleFieldCreated(name: string, boundary: LngLat[]) {
    // Calculate rough area from boundary (simple shoelace formula)
    let area = 0
    for (let i = 0; i < boundary.length - 1; i++) {
      const [lng1, lat1] = boundary[i]!
      const [lng2, lat2] = boundary[i + 1]!
      area += lng1 * lat2 - lng2 * lat1
    }
    const metersPerDegreeLat = 111320
    const metersPerDegreeLng = 111320 * Math.cos((boundary[0]![1] * Math.PI) / 180)
    const areaSqMeters = Math.abs(area / 2) * metersPerDegreeLat * metersPerDegreeLng

    saveField({
      id: crypto.randomUUID(),
      farmId: data.farm?.id ?? 'farm-1',
      name,
      boundary,
      areaSqMeters,
      createdAt: Date.now(),
    })
  }

  const handleZoomToField = useCallback((field: Field) => {
    // Trigger fly animation
    setFlyTarget([...field.boundary])
  }, [])

  function handleDeleteField(id: string) {
    // Also delete all plots belonging to this field
    const fieldPlots = data.plots.filter(p => p.fieldId === id)
    for (const p of fieldPlots) deletePlot(p.id)
    deleteField(id)
  }

  function handleRenameField(id: string, name: string) {
    const field = data.fields.find(f => f.id === id)
    if (field) saveField({ ...field, name })
  }

  function handleFieldBoundaryUpdated(id: string, boundary: [number, number][]) {
    const field = data.fields.find(f => f.id === id)
    if (!field) return
    // Recalculate area
    let area = 0
    for (let i = 0; i < boundary.length - 1; i++) {
      const [lng1, lat1] = boundary[i]!
      const [lng2, lat2] = boundary[i + 1]!
      area += lng1 * lat2 - lng2 * lat1
    }
    const metersPerDegreeLat = 111320
    const metersPerDegreeLng = 111320 * Math.cos((boundary[0]![1] * Math.PI) / 180)
    const areaSqMeters = Math.abs(area / 2) * metersPerDegreeLat * metersPerDegreeLng
    saveField({ ...field, boundary, areaSqMeters })
  }

  function handleDeletePlotsForTrial(fieldId: string, trialId: string) {
    const toDelete = data.plots.filter(p => p.fieldId === fieldId && p.trialId === trialId && p.seasonId === currentSeasonId)
    for (const p of toDelete) deletePlot(p.id)
    // Also remove plotIds from the trial
    const trial = data.trials.find(t => t.id === trialId)
    if (trial) {
      const deletedIds = new Set(toDelete.map(p => p.id))
      saveTrial({
        ...trial,
        plotIds: trial.plotIds.filter(id => !deletedIds.has(id)),
        updatedAt: Date.now(),
      })
    }
  }

  function handleGeneratePlots(fieldId: string, trialId: string, cols: number, rows: number) {
    if (!currentSeasonId) return
    const field = data.fields.find(f => f.id === fieldId)
    const trial = data.trials.find(t => t.id === trialId)
    if (!field || !trial) return

    // Get the bounding box of the field boundary
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const [lng, lat] of field.boundary) {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }

    const cellW = (maxLng - minLng) / cols
    const cellH = (maxLat - minLat) / rows

    const newPlots = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pLng = minLng + c * cellW
        const pLat = minLat + r * cellH
        const treatmentNum = c + 1
        const repNum = r + 1

        newPlots.push({
          id: crypto.randomUUID(),
          fieldId,
          seasonId: currentSeasonId,
          trialId,
          label: `${trial.protocolCode}-R${repNum}T${treatmentNum}`,
          boundary: [
            [pLng, pLat] as LngLat,
            [pLng + cellW, pLat] as LngLat,
            [pLng + cellW, pLat + cellH] as LngLat,
            [pLng, pLat + cellH] as LngLat,
            [pLng, pLat] as LngLat,
          ],
          treatmentNumber: treatmentNum,
          replicationNumber: repNum,
          createdAt: Date.now(),
        })
      }
    }

    savePlots(newPlots)

    // Update trial with plotIds and fieldId
    const existingPlotIds = trial.plotIds ?? []
    saveTrial({
      ...trial,
      fieldId,
      plotIds: [...existingPlotIds, ...newPlots.map(p => p.id)],
      updatedAt: Date.now(),
    })

    // Zoom to the field after generating
    setFlyTarget([...field.boundary])
  }

  function handleAutoplanApply(plots: Plot[], trialUpdates: { id: string; fieldId: string; plotIds: string[] }[]) {
    savePlots(plots)
    for (const update of trialUpdates) {
      const trial = data.trials.find(t => t.id === update.id)
      if (trial) {
        const existingPlotIds = trial.plotIds ?? []
        saveTrial({
          ...trial,
          fieldId: update.fieldId,
          plotIds: [...existingPlotIds, ...update.plotIds],
          updatedAt: Date.now(),
        })
      }
    }
    setShowAutoPlanner(false)
  }

  return (
    <div style={{ margin: -24, height: 'calc(100vh - 56px)', position: 'relative' }}>
      {/* Field list panel */}
      <MapFieldPanel
        fields={data.fields}
        plots={data.plots}
        trials={data.trials}
        seasonId={currentSeasonId}
        onZoomToField={handleZoomToField}
        onDeleteField={handleDeleteField}
        onRenameField={handleRenameField}
        onGeneratePlots={handleGeneratePlots}
        onDeletePlot={deletePlot}
        onDeletePlotsForTrial={handleDeletePlotsForTrial}
        onAutoplan={() => setShowAutoPlanner(true)}
      />

      {/* Map area — offset by panel width */}
      <div style={{ position: 'absolute', top: 0, left: 300, right: 0, bottom: 0 }}>
        <FarmMap
          fields={data.fields}
          plots={seasonPlots}
          trials={data.trials}
          center={center}
          zoom={zoom}
        >
          <MapDrawTools
            onFieldCreated={handleFieldCreated}
            onFarmLocationSet={handleFarmLocationSet}
            onFieldBoundaryUpdated={handleFieldBoundaryUpdated}
            farmIsSet={!!data.farm}
            fields={data.fields}
          />
          <FlyToField boundary={flyTarget} />
        </FarmMap>
      </div>
      {/* Auto-planner modal */}
      {showAutoPlanner && currentSeasonId && (
        <AutoPlanner
          fields={data.fields}
          trials={data.trials}
          existingPlots={data.plots}
          seasonId={currentSeasonId}
          onApply={handleAutoplanApply}
          onClose={() => setShowAutoPlanner(false)}
        />
      )}
    </div>
  )
}
