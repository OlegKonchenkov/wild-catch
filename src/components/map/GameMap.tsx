'use client'
import { useEffect, useRef, useState } from 'react'
import type { Session } from '@/lib/types'
import { ELEMENT_BACKGROUND } from '@/lib/game/battle-scene'

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
  creatureElement?: string | null
  creatureRarity?: string | null
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

// Pin name/description/image_url come from admin-authored rows and are
// injected into a Leaflet popup via innerHTML — so they must be escaped.
// escapeHtml guards element/attribute contexts; escapeJs guards the string
// literal inside the inline onclick handler.
function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
function escapeJs(s: string): string {
  return String(s).replace(/[\\'"]/g, '\\$&').replace(/</g, '\\x3c').replace(/[\r\n]/g, '')
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

const ELEMENT_MARKER: Record<string, { glow: string; core: string }> = {
  fiamma:    { glow: '#FF6B35', core: '#4A1208' },
  adriatico: { glow: '#3A9DBC', core: '#071D34' },
  bosco:     { glow: '#34D399', core: '#092817' },
  terra:     { glow: '#D4A060', core: '#2B1D08' },
  armonia:   { glow: '#C084FC', core: '#210B34' },
}

const RARITY_MARKER: Record<string, string> = {
  comune:      '#9CA3AF',
  non_comune:  '#34D399',
  raro:        '#3A9DBC',
  epico:       '#C084FC',
  leggendario: '#F7C841',
  mitologico:  '#FF4D6D',
}

// Build the player marker HTML
function markerHTML(
  bearing: number | null,
  creatureImageUrl?: string | null,
  creatureElement?: string | null,
  creatureRarity?: string | null,
): string {
  const rotate = bearing !== null ? bearing : 0
  const showCone = bearing !== null
  const theme = ELEMENT_MARKER[creatureElement ?? ''] ?? { glow: '#3ABCA8', core: '#0F1F2E' }
  const rarity = RARITY_MARKER[creatureRarity ?? ''] ?? '#7FE6FF'
  const sceneUrl = creatureElement && creatureElement in ELEMENT_BACKGROUND
    ? ELEMENT_BACKGROUND[creatureElement as keyof typeof ELEMENT_BACKGROUND]
    : null

  if (creatureImageUrl) {
    return `
      <div style="width:48px;height:52px;position:relative;transform-origin:50% 50%;">
        ${showCone ? `
          <div style="position:absolute;left:50%;top:1px;width:34px;height:34px;margin-left:-17px;transform:rotate(${rotate}deg);transform-origin:50% 50%;transition:transform 0.4s ease-out;pointer-events:none;">
            <div style="position:absolute;left:50%;top:-4px;margin-left:-4px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:9px solid ${theme.glow};filter:drop-shadow(0 0 5px ${theme.glow});opacity:.96;"></div>
            <div style="position:absolute;inset:2px;border-radius:50%;border:1px solid ${theme.glow}66;border-top-color:${theme.glow};opacity:.42;"></div>
          </div>
        ` : ''}
        <div style="position:absolute;left:2px;top:6px;width:44px;height:44px;border-radius:50%;border:2px solid rgba(127,230,255,.92);box-shadow:0 0 0 2px ${rarity}66,0 0 16px ${theme.glow}88,0 6px 12px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.30);overflow:hidden;background:${sceneUrl ? `linear-gradient(180deg, rgba(3,7,12,.12), rgba(3,7,12,.48)), url('${sceneUrl}') center/cover no-repeat` : `radial-gradient(circle at 50% 34%, ${theme.glow}55 0%, ${theme.core} 58%, #06101d 100%)`};backdrop-filter:blur(4px);">
          <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 35%, transparent 34%, rgba(2,5,10,.50) 100%);pointer-events:none;"></div>
          <div style="position:absolute;inset:3px;border-radius:50%;border:1px solid rgba(255,255,255,.24);box-shadow:inset 0 0 14px ${theme.glow}22;pointer-events:none;"></div>
          <div style="position:absolute;left:8px;right:8px;top:2px;height:1px;background:linear-gradient(90deg, transparent, rgba(185,250,255,.95), transparent);pointer-events:none;"></div>
          <img src="${creatureImageUrl}" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;padding:5px 4px 4px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.70)) drop-shadow(0 0 7px ${theme.glow}88);" />
        </div>
        <div style="position:absolute;left:50%;bottom:0;margin-left:-5px;width:10px;height:10px;transform:rotate(45deg);background:${theme.core};border-right:1.5px solid rgba(127,230,255,.82);border-bottom:1.5px solid rgba(127,230,255,.82);box-shadow:4px 4px 9px rgba(0,0,0,.32);"></div>
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

function markerSize(hasImage: boolean): [number, number] {
  return hasImage ? [48, 52] : [20, 20]
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

export default function GameMap({ session, playerPosition, sessionId, creatureImageUrl, creatureElement, creatureRarity, pins, onPinTap }: Props) {
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
          html: markerHTML(null, creatureImageUrl, creatureElement, creatureRarity),
          iconSize: sz,
          iconAnchor: [sz[0] / 2, sz[1] / 2],
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
          html: markerHTML(bearing, creatureImageUrl, creatureElement, creatureRarity),
          iconSize: sz,
          iconAnchor: [sz[0] / 2, sz[1] / 2],
          className: '',
        }))
      } else {
        const icon = Leaflet.divIcon({
          html: markerHTML(bearing, creatureImageUrl, creatureElement, creatureRarity),
          iconSize: sz,
          iconAnchor: [sz[0] / 2, sz[1] / 2],
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
  }, [playerPosition, creatureImageUrl, creatureElement, creatureRarity])

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
        ? `<img src="${escapeHtml(pin.image_url)}"
            onclick="window.dispatchEvent(new CustomEvent('wc:zoom-image',{detail:'${escapeJs(pin.image_url)}'}))"
            style="width:100%;border-radius:8px;margin-top:6px;cursor:zoom-in;max-height:130px;object-fit:cover"
            title="Tocca per ingrandire" />`
        : ''
      // autoClose:false + closeOnClick:false → once a player opens a pin
      // popup, it stays open until they explicitly close it. Default
      // Leaflet behaviour dismisses popups on the next map interaction or
      // marker re-render, which is annoying when reading the pin text.
      // Text colours are light: the popup wrapper is retheme'd dark in
      // globals.css, so dark-on-white text would be invisible.
      const popup = Leaflet.popup({
        maxWidth: 230,
        autoClose: false,
        closeOnClick: false,
      }).setContent(`
        <div style="font-family:sans-serif;padding:2px 0">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#FFE9A6">${escapeHtml(pin.name || 'Punto di interesse')}</div>
          ${pin.description ? `<div style="font-size:12px;color:rgba(238,245,249,0.72);line-height:1.4">${escapeHtml(pin.description)}</div>` : ''}
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
          type="button"
          onClick={handleRecenter}
          className="absolute bottom-20 right-4 z-[500] flex h-12 w-12 items-center justify-center rounded-2xl transition-all active:scale-95"
          style={{
            background: following
              ? 'radial-gradient(circle at 30% 18%, rgba(112,247,255,0.24), transparent 34%), linear-gradient(158deg, rgba(11,68,78,0.95) 0%, rgba(5,23,33,0.97) 100%)'
              : 'radial-gradient(circle at 30% 18%, rgba(103,239,255,0.12), transparent 34%), linear-gradient(158deg, rgba(8,35,50,0.92) 0%, rgba(5,15,27,0.96) 100%)',
            border: following ? '1.5px solid rgba(61,225,241,0.9)' : '1.5px solid rgba(61,225,241,0.58)',
            backdropFilter: 'blur(10px) saturate(1.2)',
            boxShadow: following
              ? '0 0 18px rgba(39,221,241,0.42), 0 4px 14px rgba(0,0,0,0.5), inset 0 0 14px rgba(39,221,241,0.14), inset 0 1px 0 rgba(164,249,255,0.34)'
              : '0 0 14px rgba(39,221,241,0.20), 0 4px 14px rgba(0,0,0,0.5), inset 0 0 12px rgba(39,221,241,0.08), inset 0 1px 0 rgba(164,249,255,0.18)',
          }}
          title={following ? 'Segue la tua posizione' : 'Centra su di me'}
        >
          <span
            className="pointer-events-none absolute inset-x-4 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(156,249,255,0.92), transparent)' }}
          />
          {following ? (
            <svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="#A9FBFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(103,239,255,0.82))' }}>
              <circle cx="24" cy="24" r="13.5" />
              <circle cx="24" cy="24" r="4.5" fill="#83F7FF" stroke="none" />
              <path d="M24 4v10M24 34v10M4 24h10M34 24h10" />
              <path d="M24 4l-5 8h10z" fill="#A9FBFF" stroke="none" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="#83F7FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(103,239,255,0.58))' }}>
              <circle cx="24" cy="24" r="13.5" />
              <circle cx="24" cy="24" r="4.5" fill="#83F7FF" stroke="none" />
              <path d="M24 4v10M24 34v10M4 24h10M34 24h10" />
              <path d="M24 4l-5 8h10z" fill="#83F7FF" stroke="none" opacity="0.72" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
