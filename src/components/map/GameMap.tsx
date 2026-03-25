'use client'
import { useEffect, useRef, useState } from 'react'
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
  const accuracyCircleRef = useRef<unknown>(null)
  const firstFixRef = useRef(true)
  const followingRef = useRef(true)
  const [following, setFollowing] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    import('leaflet').then(L => {
      if (mapRef.current || !mapContainerRef.current) return

      const bounds = session.area_bounds
      if (!bounds || bounds.north == null || isNaN(bounds.north)) return

      const center: [number, number] = [
        (bounds.north + bounds.south) / 2,
        (bounds.east + bounds.west) / 2,
      ]

      const Leaflet = L as unknown as typeof import('leaflet')

      const map = Leaflet.map(mapContainerRef.current!, {
        center,
        zoom: 16,
        zoomControl: false,
        maxBounds: Leaflet.latLngBounds(
          [bounds.south - 0.005, bounds.west - 0.005],
          [bounds.north + 0.005, bounds.east + 0.005]
        ),
      })
      mapRef.current = map

      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Draw bounding box
      Leaflet.rectangle(
        [[bounds.south, bounds.west], [bounds.north, bounds.east]],
        { color: '#3A9DBC', weight: 2, fillOpacity: 0.05 }
      ).addTo(map)

      // Detect manual panning — disable follow mode
      map.on('dragstart', () => {
        followingRef.current = false
        setFollowing(false)
      })
    })

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove(): void }).remove()
        mapRef.current = null
        markerRef.current = null
        accuracyCircleRef.current = null
        firstFixRef.current = true
        followingRef.current = true
      }
    }
  }, [session])

  // Update player marker and optionally pan map
  useEffect(() => {
    if (!playerPosition || !mapRef.current) return
    import('leaflet').then(L => {
      const { lat, lng } = playerPosition
      const Leaflet = L as unknown as typeof import('leaflet')
      const map = mapRef.current as import('leaflet').Map

      if (markerRef.current) {
        (markerRef.current as { setLatLng(ll: [number, number]): void }).setLatLng([lat, lng])
      } else {
        const icon = Leaflet.divIcon({
          html: `<div style="
            width:18px;height:18px;
            background:#E85D2F;
            border:3px solid white;
            border-radius:50%;
            box-shadow:0 0 0 6px rgba(232,93,47,0.25),0 2px 8px rgba(0,0,0,0.4);
          "></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          className: '',
        })
        markerRef.current = Leaflet.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map)
      }

      // Pan to player on first fix or when following
      if (firstFixRef.current) {
        map.setView([lat, lng], 17, { animate: true, duration: 0.8 })
        firstFixRef.current = false
      } else if (followingRef.current) {
        map.panTo([lat, lng], { animate: true, duration: 0.5, easeLinearity: 0.5 })
      }
    })
  }, [playerPosition])

  function handleRecenter() {
    if (!playerPosition || !mapRef.current) return
    followingRef.current = true
    setFollowing(true)
    const map = mapRef.current as import('leaflet').Map
    map.setView([playerPosition.lat, playerPosition.lng], 17, { animate: true, duration: 0.6 })
  }

  if (!session.area_bounds) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0F1F2E]">
        <span className="text-4xl opacity-30">🗺️</span>
        <p className="text-white/30 text-sm text-center px-6">Area di gioco non ancora configurata dall'organizzatore</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Re-center / follow button */}
      {playerPosition && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-20 right-4 z-[500] w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors"
          style={{
            background: following ? '#3A9DBC' : 'rgba(15,31,46,0.92)',
            border: following ? '2px solid #3A9DBC' : '2px solid rgba(255,255,255,0.2)',
          }}
          title={following ? 'Segue la tua posizione' : 'Centra su di me'}
        >
          {following ? (
            // compass/follow icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" fill="white" stroke="none"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="8" strokeDasharray="2 4"/>
            </svg>
          ) : (
            // crosshair icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="22" y2="12"/>
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
