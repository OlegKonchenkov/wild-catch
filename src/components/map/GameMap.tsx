'use client'
import { useEffect, useRef, useState } from 'react'
import type { Session } from '@/lib/types'

interface Props {
  session: Session
  playerPosition: { lat: number; lng: number } | null
  sessionId: string
}

// Haversine distance in metres between two GPS points
function gpsDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Bearing 0–360° (0 = north) from point 1 → point 2
function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const lat1r = lat1 * Math.PI / 180
  const lat2r = lat2 * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2r)
  const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon)
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
}

// Build the player marker HTML (inner div handles rotation independently of Leaflet's translate)
function markerHTML(bearing: number | null): string {
  const rotate = bearing !== null ? bearing : 0
  const showCone = bearing !== null
  return `
    <div class="wc-player-inner" style="
      width:20px; height:20px; position:relative;
      transform:rotate(${rotate}deg);
      transform-origin:50% 50%;
      transition:transform 0.4s ease-out;
    ">
      ${showCone ? `
        <div style="
          position:absolute; bottom:100%; left:50%; margin-left:-4px;
          width:0; height:0;
          border-left:4px solid transparent;
          border-right:4px solid transparent;
          border-bottom:9px solid rgba(232,93,47,0.85);
          margin-bottom:1px;
        "></div>
      ` : ''}
      <div style="
        width:20px; height:20px;
        background:#E85D2F;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 0 5px rgba(232,93,47,0.25), 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    </div>
  `
}

export default function GameMap({ session, playerPosition, sessionId }: Props) {
  const mapRef = useRef<unknown>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<unknown>(null)
  const firstFixRef = useRef(true)
  const followingRef = useRef(true)
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const headingRef = useRef<number | null>(null)
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

      Leaflet.rectangle(
        [[bounds.south, bounds.west], [bounds.north, bounds.east]],
        { color: '#3A9DBC', weight: 2, fillOpacity: 0.05 }
      ).addTo(map)

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
        firstFixRef.current = true
        followingRef.current = true
        prevPosRef.current = null
        headingRef.current = null
      }
    }
  }, [session])

  // Update player marker position, bearing and map pan
  useEffect(() => {
    if (!playerPosition || !mapRef.current) return
    import('leaflet').then(L => {
      const { lat, lng } = playerPosition
      const Leaflet = L as unknown as typeof import('leaflet')
      const map = mapRef.current as import('leaflet').Map

      // Compute bearing from movement (only when moved > 5 m to avoid GPS jitter)
      const prev = prevPosRef.current
      if (prev) {
        const dist = gpsDistance(prev.lat, prev.lng, lat, lng)
        if (dist >= 5) {
          headingRef.current = computeBearing(prev.lat, prev.lng, lat, lng)
        }
        // if dist < 5m, keep previous heading (player stationary or jitter)
      }
      prevPosRef.current = { lat, lng }

      const bearing = headingRef.current

      if (markerRef.current) {
        // Update position
        ;(markerRef.current as { setLatLng(ll: [number, number]): void }).setLatLng([lat, lng])
        // Update bearing via DOM (avoid recreating the marker)
        const marker = markerRef.current as import('leaflet').Marker
        const el = marker.getElement?.()
        const inner = el?.querySelector('.wc-player-inner') as HTMLElement | null
        if (inner) {
          inner.style.transform = `rotate(${bearing ?? 0}deg)`
          // Show/hide cone
          const cone = inner.querySelector('div:first-child') as HTMLElement | null
          if (cone) cone.style.display = bearing !== null ? 'block' : 'none'
        }
      } else {
        const icon = Leaflet.divIcon({
          html: markerHTML(bearing),
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          className: '',
        })
        markerRef.current = Leaflet.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map)
      }

      // Pan map
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" fill="white" stroke="none"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="8" strokeDasharray="2 4"/>
            </svg>
          ) : (
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
