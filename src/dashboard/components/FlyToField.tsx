import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LngLat } from '../types'

interface FlyToFieldProps {
  boundary: LngLat[] | null
}

export function FlyToField({ boundary }: FlyToFieldProps) {
  const map = useMap()
  const lastBoundary = useRef<LngLat[] | null>(null)

  useEffect(() => {
    if (!boundary || boundary === lastBoundary.current) return
    lastBoundary.current = boundary

    // Convert [lng, lat] to Leaflet [lat, lng]
    const latLngs = boundary.map(([lng, lat]) => L.latLng(lat, lng))
    if (latLngs.length === 0) return

    const bounds = L.latLngBounds(latLngs)
    map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 18, duration: 0.8 })
  }, [boundary, map])

  return null
}
