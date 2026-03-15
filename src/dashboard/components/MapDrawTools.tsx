import { useState, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import type { Field } from '../types'

interface MapDrawToolsProps {
  onFieldCreated: (name: string, boundary: [number, number][]) => void
  onFarmLocationSet: (lat: number, lng: number, zoom: number) => void
  onFieldBoundaryUpdated?: (fieldId: string, boundary: [number, number][]) => void
  farmIsSet: boolean
  fields?: Field[]
}

type DrawMode = 'none' | 'set-farm' | 'draw-polygon' | 'draw-rectangle' | 'edit-fields'

export function MapDrawTools({
  onFieldCreated,
  onFarmLocationSet,
  onFieldBoundaryUpdated,
  farmIsSet,
  fields = [],
}: MapDrawToolsProps) {
  const [mode, setMode] = useState<DrawMode>('none')
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const [fieldName, setFieldName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingBoundary, setPendingBoundary] = useState<[number, number][] | null>(null)
  const map = useMap()

  // Refs for polygon drawing
  const previewLayerRef = useRef<L.Polygon | null>(null)
  const pointMarkersRef = useRef<L.CircleMarker[]>([])

  // Refs for rectangle drawing
  const rectHandlerRef = useRef<L.Draw.Rectangle | null>(null)
  const drawnLayerRef = useRef<L.Layer | null>(null)

  // Refs for field editing
  const editLayersRef = useRef<L.FeatureGroup | null>(null)
  const editControlRef = useRef<L.EditToolbar.Edit | null>(null)
  const fieldIdMapRef = useRef<Map<number, string>>(new Map())

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupPolygonDraw()
      cleanupRectDraw()
      cleanupEditMode()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for leaflet-draw created event (rectangle mode)
  useEffect(() => {
    function onCreated(e: L.LeafletEvent) {
      const event = e as L.DrawEvents.Created
      const layer = event.layer as L.Polygon
      drawnLayerRef.current = layer
      map.addLayer(layer)

      const latLngs = layer.getLatLngs()[0] as L.LatLng[]
      const boundary: [number, number][] = latLngs.map(ll => [ll.lng, ll.lat])
      boundary.push(boundary[0]!)

      setPendingBoundary(boundary)
      setShowNamePrompt(true)
    }

    map.on(L.Draw.Event.CREATED, onCreated)
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated)
    }
  }, [map])

  // Handle map clicks for polygon drawing
  useEffect(() => {
    if (mode !== 'draw-polygon') return

    function onClick(e: L.LeafletMouseEvent) {
      const point: [number, number] = [e.latlng.lat, e.latlng.lng]
      setDrawPoints(prev => {
        const newPoints = [...prev, point]

        // Add vertex marker
        const marker = L.circleMarker(e.latlng, {
          radius: 6,
          color: '#3b82f6',
          fillColor: 'white',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map)
        pointMarkersRef.current.push(marker)

        // Update preview polygon
        updatePreview(newPoints)
        return newPoints
      })
    }

    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [mode, map]) // eslint-disable-line react-hooks/exhaustive-deps

  function updatePreview(points: [number, number][]) {
    if (previewLayerRef.current) {
      map.removeLayer(previewLayerRef.current)
      previewLayerRef.current = null
    }
    if (points.length >= 2) {
      const poly = L.polygon(points, {
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        dashArray: points.length < 3 ? '6 4' : undefined,
      }).addTo(map)
      previewLayerRef.current = poly
    }
  }

  function cleanupPolygonDraw() {
    if (previewLayerRef.current) {
      map.removeLayer(previewLayerRef.current)
      previewLayerRef.current = null
    }
    for (const marker of pointMarkersRef.current) {
      map.removeLayer(marker)
    }
    pointMarkersRef.current = []
    setDrawPoints([])
  }

  function cleanupRectDraw() {
    if (rectHandlerRef.current) {
      rectHandlerRef.current.disable()
      rectHandlerRef.current = null
    }
    if (drawnLayerRef.current) {
      map.removeLayer(drawnLayerRef.current)
      drawnLayerRef.current = null
    }
  }

  function cleanupEditMode() {
    if (editControlRef.current) {
      editControlRef.current.disable()
      editControlRef.current = null
    }
    if (editLayersRef.current) {
      editLayersRef.current.clearLayers()
      map.removeLayer(editLayersRef.current)
      editLayersRef.current = null
    }
    fieldIdMapRef.current.clear()
  }

  function cancelAll() {
    cleanupPolygonDraw()
    cleanupRectDraw()
    cleanupEditMode()
    setPendingBoundary(null)
    setShowNamePrompt(false)
    setFieldName('')
    setMode('none')
  }

  // --- Polygon mode ---
  function startPolygon() {
    cancelAll()
    setMode('draw-polygon')
  }

  function handleUndo() {
    if (drawPoints.length === 0) return
    const newPoints = drawPoints.slice(0, -1)
    setDrawPoints(newPoints)

    const last = pointMarkersRef.current.pop()
    if (last) map.removeLayer(last)

    updatePreview(newPoints)
  }

  function handleFinishPolygon() {
    if (drawPoints.length < 3) return
    const boundary: [number, number][] = drawPoints.map(([lat, lng]) => [lng, lat])
    boundary.push(boundary[0]!)

    setPendingBoundary(boundary)
    setShowNamePrompt(true)
  }

  // --- Rectangle mode ---
  function startRectangle() {
    cancelAll()
    setMode('draw-rectangle')
    const handler = new L.Draw.Rectangle(map as unknown as L.DrawMap, {
      shapeOptions: {
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      },
    })
    handler.enable()
    rectHandlerRef.current = handler
  }

  // --- Edit fields mode ---
  function startEditFields() {
    cancelAll()
    setMode('edit-fields')

    const featureGroup = new L.FeatureGroup()
    map.addLayer(featureGroup)
    editLayersRef.current = featureGroup
    fieldIdMapRef.current.clear()

    // Add existing field polygons as editable layers
    for (const field of fields) {
      const latLngs = field.boundary
        .filter((_, i) => i < field.boundary.length - 1) // skip closing point
        .map(([lng, lat]) => L.latLng(lat, lng))

      const polygon = L.polygon(latLngs, {
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      })

      polygon.bindTooltip(field.name, {
        permanent: false,
        direction: 'center',
        className: 'field-edit-tooltip',
      })

      featureGroup.addLayer(polygon)
      fieldIdMapRef.current.set(L.Util.stamp(polygon), field.id)
    }

    // Enable editing on the feature group
    const editHandler = new L.EditToolbar.Edit(map as unknown as L.DrawMap, {
      featureGroup,
    } as L.EditToolbar.EditHandlerOptions)
    editHandler.enable()
    editControlRef.current = editHandler
  }

  function saveFieldEdits() {
    if (!editLayersRef.current || !onFieldBoundaryUpdated) return

    editLayersRef.current.eachLayer((layer) => {
      const polygon = layer as L.Polygon
      const fieldId = fieldIdMapRef.current.get(L.Util.stamp(polygon))
      if (!fieldId) return

      const latLngs = polygon.getLatLngs()[0] as L.LatLng[]
      const boundary: [number, number][] = latLngs.map(ll => [ll.lng, ll.lat])
      boundary.push(boundary[0]!) // close
      onFieldBoundaryUpdated(fieldId, boundary)
    })

    cancelAll()
  }

  // --- Farm location ---
  function handleSetFarm() {
    if (mode === 'set-farm') {
      const center = map.getCenter()
      const zoom = map.getZoom()
      onFarmLocationSet(center.lat, center.lng, zoom)
      setMode('none')
    } else {
      cancelAll()
      setMode('set-farm')
    }
  }

  // --- Save new field ---
  function handleSaveField() {
    if (!fieldName.trim() || !pendingBoundary) return
    onFieldCreated(fieldName.trim(), pendingBoundary)
    cleanupPolygonDraw()
    cleanupRectDraw()
    setFieldName('')
    setShowNamePrompt(false)
    setPendingBoundary(null)
    setMode('none')
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {/* Main toolbar */}
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '8px',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          pointerEvents: 'auto',
        }}
      >
        {mode === 'none' && (
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSetFarm}
              title="Set farm location to current view"
            >
              {farmIsSet ? '\u{1F3E0} Update Farm View' : '\u{1F3E0} Set Farm Location'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={startPolygon}
              title="Draw a polygon field boundary"
            >
              {'\u270E'} Draw Field
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={startRectangle}
              title="Draw a rectangular field"
              style={{ background: 'var(--green-600)' }}
            >
              {'\u25AD'} Rectangle
            </button>
            {fields.length > 0 && onFieldBoundaryUpdated && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={startEditFields}
                title="Drag field vertices to reshape"
              >
                Edit Fields
              </button>
            )}
          </>
        )}

        {mode === 'set-farm' && (
          <>
            <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, padding: '4px 8px' }}>
              Pan & zoom to your farm, then click below
            </span>
            <button className="btn btn-primary btn-sm" onClick={handleSetFarm}>
              Save This View
            </button>
            <button className="btn btn-secondary btn-sm" onClick={cancelAll}>
              Cancel
            </button>
          </>
        )}

        {mode === 'draw-polygon' && !showNamePrompt && (
          <>
            <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, padding: '4px 8px' }}>
              Click to add vertices ({drawPoints.length} points)
            </span>
            {drawPoints.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleUndo}>
                Undo
              </button>
            )}
            {drawPoints.length >= 3 && (
              <button className="btn btn-primary btn-sm" onClick={handleFinishPolygon}>
                Finish
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={cancelAll}>
              Cancel
            </button>
          </>
        )}

        {mode === 'draw-rectangle' && !showNamePrompt && (
          <>
            <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, padding: '4px 8px' }}>
              Click & drag to draw rectangle
            </span>
            <button className="btn btn-secondary btn-sm" onClick={cancelAll}>
              Cancel
            </button>
          </>
        )}

        {mode === 'edit-fields' && (
          <>
            <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, padding: '4px 8px' }}>
              Drag vertices to reshape fields
            </span>
            <button className="btn btn-primary btn-sm" onClick={saveFieldEdits}>
              Save Changes
            </button>
            <button className="btn btn-secondary btn-sm" onClick={cancelAll}>
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Field name prompt */}
      {showNamePrompt && (
        <div
          style={{
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            padding: 16,
            pointerEvents: 'auto',
            width: 280,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>
            Name this field
          </div>
          <input
            type="text"
            value={fieldName}
            onChange={e => setFieldName(e.target.value)}
            placeholder="e.g. North 40"
            autoFocus
            style={{ width: '100%', marginBottom: 10 }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveField()
              if (e.key === 'Escape') cancelAll()
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={cancelAll}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveField} disabled={!fieldName.trim()}>
              Save Field
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
