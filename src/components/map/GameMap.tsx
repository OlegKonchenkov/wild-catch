'use client'
import { useEffect, useRef } from 'react'
import type { Session } from '@/lib/types'

interface Props {
  session: Session
  playerPosition: { lat: number; lng: number } | null
  onEncounterTrigger: (encounterId: string, creature: unknown) => void
  sessionId: string
}

export default function GameMap({ session, playerPosition, onEncounterTrigger, sessionId }: Props) {
  const mapRef = useRef<unknown>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<unknown>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Lazy import Leaflet (not SSR compatible)
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css')

      if (mapRef.current || !mapContainerRef.current) return

      const bounds = session.area_bounds
      // Area not configured yet — skip map init (fallback UI shown in JSX)
      if (!bounds || bounds.north == null || isNaN(bounds.north)) return

      const center: [number, number] = [
        (bounds.north + bounds.south) / 2,
        (bounds.east + bounds.west) / 2,
      ]

      const map = (L as unknown as typeof import('leaflet')).map(mapContainerRef.current!, {
        center,
        zoom: 16,
        zoomControl: false,
        maxBounds: (L as unknown as typeof import('leaflet')).latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        ),
      })
      mapRef.current = map

      ;(L as unknown as typeof import('leaflet')).tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Draw bounding box
      ;(L as unknown as typeof import('leaflet')).rectangle(
        [[bounds.south, bounds.west], [bounds.north, bounds.east]],
        { color: '#3A9DBC', weight: 2, fillOpacity: 0.05 }
      ).addTo(map)
    })

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove(): void }).remove()
        mapRef.current = null
      }
    }
  }, [session])

  // Update player marker
  useEffect(() => {
    if (!playerPosition || !mapRef.current) return
    import('leaflet').then(L => {
      const { lat, lng } = playerPosition

      if (markerRef.current) {
        (markerRef.current as { setLatLng(ll: [number, number]): void }).setLatLng([lat, lng])
      } else {
        const Leaflet = L as unknown as typeof import('leaflet')
        const icon = Leaflet.divIcon({
          html: '<div style="width:16px;height:16px;background:#E85D2F;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(232,93,47,0.3)"></div>',
          iconSize: [16, 16],
          className: '',
        })
        markerRef.current = Leaflet.marker([lat, lng], { icon }).addTo(mapRef.current as import('leaflet').Map)
      }
    })
  }, [playerPosition])

  if (!session.area_bounds) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0F1F2E]">
        <span className="text-4xl opacity-30">🗺️</span>
        <p className="text-white/30 text-sm text-center px-6">Area di gioco non ancora configurata dall'organizzatore</p>
      </div>
    )
  }

  return <div ref={mapContainerRef} className="w-full h-full" />
}
