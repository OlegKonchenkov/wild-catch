'use client'
import { useEffect, useRef } from 'react'

interface Bounds { north: number; south: number; east: number; west: number }

export default function MapPicker({ onBoundsChange }: { onBoundsChange: (b: Bounds) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onBoundsChangeRef = useRef(onBoundsChange)

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange
  }, [onBoundsChange])

  useEffect(() => {
    if (!containerRef.current) return

    import('leaflet').then(L => {
      const map = L.map(containerRef.current!, { center: [43.91, 12.91], zoom: 15 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

      let rectangle: any = null
      let firstPoint: L.LatLng | null = null

      map.on('click', (e) => {
        if (!firstPoint) {
          firstPoint = e.latlng
        } else {
          const bounds = L.latLngBounds(firstPoint, e.latlng)
          if (rectangle) map.removeLayer(rectangle)
          rectangle = L.rectangle(bounds, { color: '#3A9DBC', weight: 2 }).addTo(map)

          onBoundsChangeRef.current({
            north: bounds.getNorth(), south: bounds.getSouth(),
            east: bounds.getEast(), west: bounds.getWest(),
          })
          firstPoint = null
        }
      })
    })
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full z-10 pointer-events-none">
        Click per primo angolo, poi secondo angolo
      </div>
    </div>
  )
}
