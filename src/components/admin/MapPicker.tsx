'use client'
import { useEffect, useRef, useState } from 'react'

export interface Bounds { north: number; south: number; east: number; west: number }

interface Props {
  onBoundsChange: (b: Bounds | null) => void
  initialBounds?: Bounds | null
}

export default function MapPicker({ onBoundsChange, initialBounds }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<any>(null)
  const rectRef           = useRef<any>(null)
  const LRef              = useRef<any>(null)
  const drawModeRef       = useRef(false)
  const onChangeRef       = useRef(onBoundsChange)

  const [drawMode, setDrawMode]     = useState(false)
  const [hasBounds, setHasBounds]   = useState(!!initialBounds)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching]   = useState(false)
  const [tooSmall, setTooSmall]     = useState(false)

  useEffect(() => { onChangeRef.current = onBoundsChange }, [onBoundsChange])

  // Sync drawMode → Leaflet dragging
  useEffect(() => {
    if (!mapRef.current) return
    if (drawMode) mapRef.current.dragging.disable()
    else mapRef.current.dragging.enable()
  }, [drawMode])

  // Init Leaflet
  useEffect(() => {
    if (!containerRef.current) return
    let cleanupFn = () => {}

    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      // Avoid double-init on React StrictMode
      if (mapRef.current) return

      LRef.current = L

      const center: [number, number] = initialBounds
        ? [(initialBounds.north + initialBounds.south) / 2, (initialBounds.east + initialBounds.west) / 2]
        : [43.91, 12.91]

      const map = L.map(containerRef.current!, { center, zoom: initialBounds ? 14 : 12, zoomControl: true })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Draw existing bounds
      if (initialBounds) {
        const b = L.latLngBounds(
          [initialBounds.south, initialBounds.west],
          [initialBounds.north, initialBounds.east]
        )
        rectRef.current = L.rectangle(b, { color: '#3A9DBC', weight: 2, fillOpacity: 0.15 }).addTo(map)
        map.fitBounds(b, { padding: [30, 30] })
      }

      /* ── Drag-to-draw ────────────────────────────────────── */
      let startLatLng: any = null

      function getLatLng(clientX: number, clientY: number) {
        const rect = containerRef.current!.getBoundingClientRect()
        return map.containerPointToLatLng(L.point(clientX - rect.left, clientY - rect.top))
      }

      function startDraw(clientX: number, clientY: number) {
        if (!drawModeRef.current) return
        startLatLng = getLatLng(clientX, clientY)
        if (rectRef.current) { map.removeLayer(rectRef.current); rectRef.current = null }
      }

      function moveDraw(clientX: number, clientY: number) {
        if (!startLatLng) return
        const cur = getLatLng(clientX, clientY)
        const bounds = L.latLngBounds(startLatLng, cur)
        if (rectRef.current) rectRef.current.setBounds(bounds)
        else rectRef.current = L.rectangle(bounds, { color: '#3A9DBC', weight: 2, fillOpacity: 0.1 }).addTo(map)
      }

      function endDraw(clientX: number, clientY: number) {
        if (!startLatLng) return
        const cur = getLatLng(clientX, clientY)
        const bounds = L.latLngBounds(startLatLng, cur)
        startLatLng = null

        const w = Math.abs(bounds.getEast()  - bounds.getWest())
        const h = Math.abs(bounds.getNorth() - bounds.getSouth())

        if (w < 0.0005 || h < 0.0005) {
          setTooSmall(true)
          setTimeout(() => setTooSmall(false), 2500)
          if (rectRef.current) { map.removeLayer(rectRef.current); rectRef.current = null }
          return
        }

        if (rectRef.current) rectRef.current.setBounds(bounds)
        else rectRef.current = L.rectangle(bounds, { color: '#3A9DBC', weight: 2, fillOpacity: 0.15 }).addTo(map)

        onChangeRef.current({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() })
        setHasBounds(true)
        setDrawMode(false)
      }

      // Mouse
      const onMouseDown = (e: MouseEvent) => { startDraw(e.clientX, e.clientY) }
      const onMouseMove = (e: MouseEvent) => { moveDraw(e.clientX, e.clientY) }
      const onMouseUp   = (e: MouseEvent) => { endDraw(e.clientX, e.clientY) }

      // Touch
      const onTouchStart = (e: TouchEvent) => {
        if (!drawModeRef.current) return
        e.preventDefault()
        startDraw(e.touches[0].clientX, e.touches[0].clientY)
      }
      const onTouchMove  = (e: TouchEvent) => { e.preventDefault(); moveDraw(e.touches[0].clientX, e.touches[0].clientY) }
      const onTouchEnd   = (e: TouchEvent) => { endDraw(e.changedTouches[0].clientX, e.changedTouches[0].clientY) }

      const el = containerRef.current!
      el.addEventListener('mousedown',  onMouseDown)
      el.addEventListener('mousemove',  onMouseMove)
      el.addEventListener('mouseup',    onMouseUp)
      el.addEventListener('touchstart', onTouchStart, { passive: false })
      el.addEventListener('touchmove',  onTouchMove,  { passive: false })
      el.addEventListener('touchend',   onTouchEnd)

      cleanupFn = () => {
        map.remove()
        mapRef.current = null
        el.removeEventListener('mousedown',  onMouseDown)
        el.removeEventListener('mousemove',  onMouseMove)
        el.removeEventListener('mouseup',    onMouseUp)
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove',  onTouchMove)
        el.removeEventListener('touchend',   onTouchEnd)
      }
    })

    return () => cleanupFn()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync with state
  useEffect(() => { drawModeRef.current = drawMode }, [drawMode])

  async function geocode() {
    if (!searchQuery.trim() || !mapRef.current) return
    setSearching(true)
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`, { headers: { 'Accept-Language': 'it' } })
      const data = await res.json()
      if (data[0]) mapRef.current.setView([+data[0].lat, +data[0].lon], 14)
    } catch { /* silent */ }
    finally { setSearching(false) }
  }

  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(
      p => mapRef.current.setView([p.coords.latitude, p.coords.longitude], 15),
      () => {}
    )
  }

  function reset() {
    if (rectRef.current && mapRef.current) { mapRef.current.removeLayer(rectRef.current); rectRef.current = null }
    onChangeRef.current(null)
    setHasBounds(false)
    setDrawMode(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && geocode()}
          placeholder="Cerca città o indirizzo..."
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#3A9DBC]/60"
        />
        <button onClick={geocode} disabled={searching || !searchQuery.trim()}
          className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40 transition-colors">
          {searching ? '…' : '🔍'}
        </button>
        <button onClick={locateMe} title="Usa la mia posizione GPS"
          className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm hover:bg-white/15 transition-colors">
          📍
        </button>
      </div>

      {/* Map */}
      <div
        className="relative rounded-xl overflow-hidden transition-all"
        style={{ height: 300, border: `2px solid ${drawMode ? '#3A9DBC' : 'rgba(255,255,255,0.15)'}`, cursor: drawMode ? 'crosshair' : undefined }}
      >
        <div ref={containerRef} className="w-full h-full" />
        {drawMode && (
          <div className="absolute top-2 inset-x-2 flex justify-center pointer-events-none z-[1000]">
            <div className="bg-[#3A9DBC] text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg">
              ✏️ Clicca e trascina per disegnare l'area
            </div>
          </div>
        )}
        {tooSmall && (
          <div className="absolute inset-x-2 bottom-2 flex justify-center pointer-events-none z-[1000]">
            <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg">
              Area troppo piccola — riprova con un'area più grande
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setDrawMode(v => !v)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${
            drawMode
              ? 'bg-[#3A9DBC] border-[#3A9DBC] text-white'
              : 'bg-white/8 border-white/20 text-white hover:bg-white/15'
          }`}
        >
          {drawMode ? '✕ Annulla disegno' : hasBounds ? '✏️ Ridisegna area' : '✏️ Disegna area'}
        </button>
        {hasBounds && !drawMode && (
          <button onClick={reset}
            className="bg-red-500/10 text-red-400 border border-red-500/25 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-colors">
            🗑 Reset
          </button>
        )}
      </div>

      {/* Status */}
      {hasBounds ? (
        <p className="text-xs text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/25 rounded-lg px-3 py-2">
          ✅ Area geografica definita
        </p>
      ) : (
        <p className="text-xs text-white/40 bg-white/4 border border-white/10 rounded-lg px-3 py-2">
          ℹ️ Cerca un luogo per navigare sulla mappa, poi disegna l'area dell'evento trascinando
        </p>
      )}
    </div>
  )
}
