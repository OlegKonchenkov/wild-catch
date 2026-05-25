'use client'
import { useEffect, useRef, useState } from 'react'
import type { Session } from '@/lib/types'

export interface MapPin {
  id: string
  lat: number
  lng: number
  name: string
  description: string
  image_url?: string | null
  reward_type?: string | null
  reward_radius_m?: number | null
  reward_payload?: Record<string, unknown> | null
  claimed?: boolean
}

interface Props {
  session: Session
  playerPosition: { lat: number; lng: number } | null
  sessionId: string
  creatureImageUrl?: string | null
  pins?: MapPin[]
  onPinTap?: (pin: MapPin) => void
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

// Build the player marker HTML
function markerHTML(bearing: number | null, creatureImageUrl?: string | null): string {
  const rotate = bearing !== null ? bearing : 0
  const showCone = bearing !== null

  if (creatureImageUrl) {
    // Creature image marker — 40×40 circular portrait
    return `
      <div class="wc-player-inner" style="
        width:40px; height:40px; position:relative;
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
            border-bottom:9px solid rgba(58,157,188,0.9);
            margin-bottom:1px;
          "></div>
        ` : ''}
        <div style="
          width:40px; height:40px;
          border-radius:50%;
          border:3px solid #3A9DBC;
          box-shadow:0 0 0 3px rgba(58,157,188,0.35), 0 2px 8px rgba(0,0,0,0.5);
          overflow:hidden;
          background:#0F1F2E;
        ">
          <img src="${creatureImageUrl}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      </div>
    `
  }

  // Default orange circle marker
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

function markerSize(hasImage: boolean): number {
  return hasImage ? 40 : 20
}

// Stable pulsing "presence" halo rendered as its OWN Leaflet marker,
// sitting under the player marker. Created once and only repositioned
// (never setIcon'd) so the CSS pulse animation runs uninterrupted —
// re-creating the icon every GPS fix (~1 Hz) would restart the keyframe
// and make it stutter. Gives the player dot the "alive" feel polished
// location games have, without touching any position/credit logic.
const PRESENCE_SIZE = 70
function presenceHTML(): string {
  return `
    <div style="width:${PRESENCE_SIZE}px;height:${PRESENCE_SIZE}px;position:relative;pointer-events:none;">
      <div class="wc-presence-core"></div>
      <div class="wc-presence-ring"></div>
      <div class="wc-presence-ring" style="animation-delay:1.1s;"></div>
    </div>
  `
}

export default function GameMap({ session, playerPosition, sessionId, creatureImageUrl, pins, onPinTap }: Props) {
  const mapRef = useRef<unknown>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<unknown>(null)
  const presenceRef = useRef<unknown>(null)
  const firstFixRef = useRef(true)
  const followingRef = useRef(true)
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const headingRef = useRef<number | null>(null)
  const playerPositionRef = useRef(playerPosition)
  const pinMarkersRef = useRef<Map<string, unknown>>(new Map())
  const LRef = useRef<any>(null)
  const onPinTapRef = useRef(onPinTap)
  const [following, setFollowing] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { onPinTapRef.current = onPinTap }, [onPinTap])

  useEffect(() => { playerPositionRef.current = playerPosition }, [playerPosition])

  useEffect(() => {
    if (typeof window === 'undefined') return

    import('leaflet').then(L => {
      if (mapRef.current || !mapContainerRef.current) return

      // Bounded session: configured area (north/south/east/west). Unbounded
      // (e.g. always-on tutorial with area_bounds = {}): play anywhere, no
      // maxBounds constraint, no rectangle overlay. We still need an
      // initial center — prefer the player GPS if we have one, otherwise
      // fall back to a sane Italian default that any subsequent fix will
      // immediately replace via setView.
      const bounds = session.area_bounds as
        | { north?: number; south?: number; east?: number; west?: number }
        | null
        | undefined
      const isBounded =
        !!bounds &&
        typeof bounds.north === 'number' && !isNaN(bounds.north) &&
        typeof bounds.south === 'number' && !isNaN(bounds.south) &&
        typeof bounds.east  === 'number' && !isNaN(bounds.east)  &&
        typeof bounds.west  === 'number' && !isNaN(bounds.west)

      const initialPos = playerPositionRef.current
      const center: [number, number] = isBounded
        ? [(bounds!.north! + bounds!.south!) / 2, (bounds!.east! + bounds!.west!) / 2]
        : initialPos
          ? [initialPos.lat, initialPos.lng]
          : [42.5, 12.5] // geographic center of Italy as last-resort fallback

      const Leaflet = L as unknown as typeof import('leaflet')
      LRef.current = Leaflet

      const mapOpts: import('leaflet').MapOptions = {
        center,
        zoom: isBounded ? 16 : 17,
        zoomControl: false,
      }
      if (isBounded) {
        mapOpts.maxBounds = Leaflet.latLngBounds(
          [bounds!.south! - 0.005, bounds!.west! - 0.005],
          [bounds!.north! + 0.005, bounds!.east! + 0.005],
        )
      }
      const map = Leaflet.map(mapContainerRef.current!, mapOpts)
      mapRef.current = map

      // Inject the player-presence pulse styles once. Brand-teal halo so
      // it reads on the dark CARTO tiles and matches the boot splash /
      // favicon identity.
      if (!document.getElementById('wc-presence-style')) {
        const st = document.createElement('style')
        st.id = 'wc-presence-style'
        st.textContent = `
          .wc-presence-core {
            position:absolute; left:50%; top:50%;
            width:18px; height:18px; margin:-9px 0 0 -9px;
            border-radius:50%;
            background:radial-gradient(circle,#3ABCA8 0%,rgba(58,188,168,0.35) 70%,transparent 72%);
            box-shadow:0 0 14px 3px rgba(58,188,168,0.55);
            animation:wcPresenceCore 2.6s ease-in-out infinite;
          }
          .wc-presence-ring {
            position:absolute; left:50%; top:50%;
            width:${PRESENCE_SIZE}px; height:${PRESENCE_SIZE}px;
            margin:-${PRESENCE_SIZE / 2}px 0 0 -${PRESENCE_SIZE / 2}px;
            border-radius:50%;
            border:2px solid rgba(58,188,168,0.45);
            animation:wcPresenceRing 2.6s ease-out infinite;
          }
          @keyframes wcPresenceCore { 0%,100%{transform:scale(0.82);opacity:0.75} 50%{transform:scale(1);opacity:1} }
          @keyframes wcPresenceRing { 0%{transform:scale(0.28);opacity:0.7} 80%{transform:scale(1);opacity:0} 100%{opacity:0} }
          @media (prefers-reduced-motion: reduce) {
            .wc-presence-core,.wc-presence-ring{animation:none}
            .wc-presence-ring{opacity:0.25}
          }
        `
        document.head.appendChild(st)
      }

      // Immediately create marker if we already have a GPS position
      const pos = playerPositionRef.current
      if (pos) {
        // Presence halo first so it sits UNDER the player marker.
        presenceRef.current = Leaflet.marker([pos.lat, pos.lng], {
          icon: Leaflet.divIcon({
            html: presenceHTML(),
            iconSize: [PRESENCE_SIZE, PRESENCE_SIZE],
            iconAnchor: [PRESENCE_SIZE / 2, PRESENCE_SIZE / 2],
            className: '',
          }),
          zIndexOffset: 900,
          interactive: false,
          keyboard: false,
        }).addTo(map)

        const sz = markerSize(!!creatureImageUrl)
        const icon = Leaflet.divIcon({
          html: markerHTML(null, creatureImageUrl),
          iconSize: [sz, sz],
          iconAnchor: [sz / 2, sz / 2],
          className: '',
        })
        markerRef.current = Leaflet.marker([pos.lat, pos.lng], { icon, zIndexOffset: 1000 }).addTo(map)
        map.setView([pos.lat, pos.lng], 17, { animate: false })
        firstFixRef.current = false
      }

      // CartoDB Dark Matter tiles
      Leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map)

      if (isBounded) {
        Leaflet.rectangle(
          [[bounds!.south!, bounds!.west!], [bounds!.north!, bounds!.east!]],
          { color: '#3A9DBC', weight: 2, fillOpacity: 0.07 }
        ).addTo(map)
      }

      map.on('dragstart', () => {
        followingRef.current = false
        setFollowing(false)
      })

      setMapReady(true)
    })

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove(): void }).remove()
        mapRef.current = null
        markerRef.current = null
        presenceRef.current = null
        firstFixRef.current = true
        followingRef.current = true
        prevPosRef.current = null
        headingRef.current = null
        LRef.current = null
        pinMarkersRef.current.clear()
        setMapReady(false)
      }
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

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
      }
      prevPosRef.current = { lat, lng }

      const bearing = headingRef.current
      const sz = markerSize(!!creatureImageUrl)

      // Presence halo — reposition only (NEVER setIcon) so the pulse
      // animation never restarts. Lazily create it if the map was set
      // up before the first fix arrived.
      if (presenceRef.current) {
        (presenceRef.current as import('leaflet').Marker).setLatLng([lat, lng])
      } else {
        presenceRef.current = Leaflet.marker([lat, lng], {
          icon: Leaflet.divIcon({
            html: presenceHTML(),
            iconSize: [PRESENCE_SIZE, PRESENCE_SIZE],
            iconAnchor: [PRESENCE_SIZE / 2, PRESENCE_SIZE / 2],
            className: '',
          }),
          zIndexOffset: 900,
          interactive: false,
          keyboard: false,
        }).addTo(map)
      }

      if (markerRef.current) {
        const marker = markerRef.current as import('leaflet').Marker
        marker.setLatLng([lat, lng])
        marker.setIcon(Leaflet.divIcon({
          html: markerHTML(bearing, creatureImageUrl),
          iconSize: [sz, sz],
          iconAnchor: [sz / 2, sz / 2],
          className: '',
        }))
      } else {
        const icon = Leaflet.divIcon({
          html: markerHTML(bearing, creatureImageUrl),
          iconSize: [sz, sz],
          iconAnchor: [sz / 2, sz / 2],
          className: '',
        })
        markerRef.current = Leaflet.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map)
      }

      if (firstFixRef.current) {
        map.setView([lat, lng], 17, { animate: true, duration: 0.8 })
        firstFixRef.current = false
      } else if (followingRef.current) {
        map.panTo([lat, lng], { animate: true, duration: 0.5, easeLinearity: 0.5 })
      }
    })
  }, [playerPosition, creatureImageUrl])

  // Render / update map pins
  useEffect(() => {
    if (!mapReady || !LRef.current || !mapRef.current) return
    const Leaflet = LRef.current as typeof import('leaflet')
    const map = mapRef.current as import('leaflet').Map

    // Remove stale markers
    pinMarkersRef.current.forEach(m => (m as import('leaflet').Marker).remove())
    pinMarkersRef.current.clear()

    // Pin icon — teardrop-style
    const pinIcon = Leaflet.divIcon({
      html: `<div style="
        width:0; height:0;
        position:relative;
      ">
        <div style="
          position:absolute;
          width:28px; height:28px;
          left:-14px; top:-28px;
          background:#F7C841;
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(0,0,0,0.45);
        "></div>
      </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      className: '',
    })

    ;(pins ?? []).forEach(pin => {
      // Differentiate: claimed=grey, has reward=gold+pulse, plain=yellow
      const hasReward = !!pin.reward_type
      const isClaimed = !!pin.claimed
      const pinColor  = isClaimed ? '#6B7280' : hasReward ? '#F7C841' : '#F7C841'
      const pinBorder = isClaimed ? '#9CA3AF' : '#fff'
      const pulse     = hasReward && !isClaimed
        ? `<div style="position:absolute;width:36px;height:36px;left:-18px;top:-32px;border-radius:50%;border:2px solid #F7C84188;animation:pinPulse 1.8s ease-out infinite;"></div>`
        : ''
      // Active reward pins get a gold glow so they pop off the dark
      // tiles; claimed/plain keep the plain drop shadow.
      const pinShadow = hasReward && !isClaimed
        ? '0 2px 8px rgba(0,0,0,0.45), 0 0 14px 3px rgba(247,200,65,0.55)'
        : '0 2px 8px rgba(0,0,0,0.45)'
      const icon = Leaflet.divIcon({
        html: `<div style="width:0;height:0;position:relative;">
          ${pulse}
          <div style="
            position:absolute;width:28px;height:28px;
            left:-14px;top:-28px;
            background:${pinColor};border:3px solid ${pinBorder};
            border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            box-shadow:${pinShadow};
            opacity:${isClaimed ? 0.55 : 1};
          "></div>
          ${hasReward && !isClaimed ? `<div style="position:absolute;width:10px;height:10px;left:-5px;top:-37px;background:#E85D2F;border:2px solid #fff;border-radius:50%;"></div>` : ''}
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        className: '',
      })

      const rewardBadge = hasReward
        ? `<div style="margin-top:5px;display:inline-block;font-size:10px;padding:2px 8px;border-radius:999px;background:${isClaimed ? '#6B728022' : '#F7C84122'};color:${isClaimed ? '#9CA3AF' : '#F7C841'};border:1px solid ${isClaimed ? '#6B728055' : '#F7C84155'};font-weight:700">
            ${isClaimed ? '✓ Riscattato' : '🎁 Ricompensa disponibile!'}
          </div>`
        : ''
      const imgHtml = pin.image_url
        ? `<img src="${pin.image_url}"
            onclick="window.dispatchEvent(new CustomEvent('wc:zoom-image',{detail:'${pin.image_url}'}))"
            style="width:100%;border-radius:8px;margin-top:6px;cursor:zoom-in;max-height:130px;object-fit:cover"
            title="Tocca per ingrandire" />`
        : ''
      // autoClose:false + closeOnClick:false → once a player opens a pin
      // popup, it stays open until they explicitly close it. Default
      // Leaflet behaviour dismisses popups on the next map interaction or
      // marker re-render, which is annoying when reading the pin text.
      const popup = Leaflet.popup({
        maxWidth: 230,
        autoClose: false,
        closeOnClick: false,
      }).setContent(`
        <div style="font-family:sans-serif;padding:2px 0">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#0F1F2E">${pin.name || 'Punto di interesse'}</div>
          ${pin.description ? `<div style="font-size:12px;color:#4B5563;line-height:1.4">${pin.description}</div>` : ''}
          ${rewardBadge}
          ${imgHtml}
        </div>
      `)
      const m = Leaflet.marker([pin.lat, pin.lng], { icon }).addTo(map).bindPopup(popup)
      m.on('click', () => { if (onPinTapRef.current) onPinTapRef.current(pin) })
      pinMarkersRef.current.set(pin.id, m)
    })

    // Inject pulse keyframe into the page once
    if (!document.getElementById('wc-pin-pulse')) {
      const style = document.createElement('style')
      style.id = 'wc-pin-pulse'
      style.textContent = `@keyframes pinPulse { 0%{transform:scale(1);opacity:0.7} 70%{transform:scale(2.2);opacity:0} 100%{transform:scale(2.2);opacity:0} }`
      document.head.appendChild(style)
    }
  }, [mapReady, pins])

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

      {/* Atmospheric overlay — pure CSS, no tiles/provider/API change.
          Three stacked static gradients, GPU-cheap, pointer-events:none
          so map interaction is untouched:
            1. Edge vignette  → focuses the eye on the player, gives the
               flat CARTO tiles a "game viewport" depth. Centre stays
               fully transparent so markers/labels read crisp.
            2. Soft teal brand glow from the top — ties the map to the
               splash / favicon / presence-halo identity.
            3. Faint warm floor gradient at the bottom for depth.
          Reversible: delete this block to restore the bare tiles. */}
      <div
        className="absolute inset-0 pointer-events-none z-[400]"
        style={{
          background:
            'radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, rgba(6,12,24,0.30) 78%, rgba(4,8,18,0.62) 100%), ' +
            'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(58,188,168,0.10) 0%, transparent 55%), ' +
            'linear-gradient(180deg, transparent 70%, rgba(20,12,6,0.22) 100%)',
          mixBlendMode: 'normal',
        }}
      />

      {/* Re-center / follow button */}
      {playerPosition && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-20 right-4 z-[500] w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95"
          style={{
            background: following
              ? 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)'
              : 'rgba(10,20,35,0.82)',
            border: following ? '1.5px solid rgba(58,157,188,0.7)' : '1.5px solid rgba(58,157,188,0.55)',
            backdropFilter: 'blur(10px)',
            boxShadow: following
              ? '0 0 20px rgba(58,157,188,0.5), 0 4px 14px rgba(0,0,0,0.5)'
              : '0 0 14px rgba(58,157,188,0.16), 0 4px 14px rgba(0,0,0,0.5)',
          }}
          title={following ? 'Segue la tua posizione' : 'Centra su di me'}
        >
          {following ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
              <circle cx="12" cy="12" r="3" fill="white" stroke="none"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="8" strokeDasharray="2 4"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#46bad8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
