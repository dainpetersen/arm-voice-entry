import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet'
import type { ReactNode } from 'react'
import type { Field, Plot, DashboardTrial, TrialStatus } from '../types'
import { TRIAL_STATUS_COLORS } from '../types'

interface FarmMapProps {
  fields: Field[]
  plots: Plot[]
  trials: DashboardTrial[]
  center?: [number, number]
  zoom?: number
  children?: ReactNode
}

export function FarmMap({ fields, plots, trials, center, zoom, children }: FarmMapProps) {
  const mapCenter = center ?? [39.8, -98.5] as [number, number]
  const mapZoom = zoom ?? 5

  const trialMap = new Map(trials.map(t => [t.id, t]))

  function getPlotColor(plot: Plot): string {
    if (!plot.trialId) return '#6b7280' // gray for unassigned
    const trial = trialMap.get(plot.trialId)
    if (!trial) return '#6b7280'
    return TRIAL_STATUS_COLORS[trial.status as TrialStatus] ?? '#6b7280'
  }

  function getPlotTreatmentInfo(plot: Plot): { trialName: string; treatmentName: string } | null {
    if (!plot.trialId) return null
    const trial = trialMap.get(plot.trialId)
    if (!trial) return null
    const treatment = plot.treatmentNumber != null
      ? trial.treatmentDescriptions.find(td => td.number === plot.treatmentNumber)
      : null
    return {
      trialName: trial.name,
      treatmentName: treatment ? `${treatment.number}: ${treatment.name}` : 'No treatment assigned',
    }
  }

  return (
    <div className="dashboard-map-container">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        {/* Satellite base layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />

        {/* OpenStreetMap label overlay */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          opacity={0.4}
          maxZoom={19}
        />

        {/* Field boundaries */}
        {fields.map(field => (
          <Polygon
            key={`field-${field.id}`}
            positions={field.boundary.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: '#3b82f6',
              weight: 2,
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
            }}
          >
            <Popup>
              <strong>{field.name}</strong>
              {field.areaSqMeters != null && (
                <div style={{ fontSize: 12, color: '#666' }}>
                  {(field.areaSqMeters / 4046.86).toFixed(1)} acres
                </div>
              )}
            </Popup>
          </Polygon>
        ))}

        {/* Plot boundaries */}
        {plots.map(plot => {
          const color = getPlotColor(plot)
          const info = getPlotTreatmentInfo(plot)
          return (
            <Polygon
              key={`plot-${plot.id}`}
              positions={plot.boundary.map(([lng, lat]) => [lat, lng] as [number, number])}
              pathOptions={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.3,
              }}
            >
              <Popup>
                <strong>{plot.label}</strong>
                {info ? (
                  <>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Trial: {info.trialName}</div>
                    <div style={{ fontSize: 12 }}>Treatment: {info.treatmentName}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, marginTop: 4, color: '#999' }}>Unassigned</div>
                )}
                {plot.replicationNumber != null && (
                  <div style={{ fontSize: 12 }}>Rep: {plot.replicationNumber}</div>
                )}
              </Popup>
            </Polygon>
          )
        })}
        {children}
      </MapContainer>
    </div>
  )
}
