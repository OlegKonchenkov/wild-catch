'use client'
import { useEffect, useRef, useState } from 'react'
import { PinPayloadFields } from '@/components/admin/PinPayloadForms'

export interface Bounds { north: number; south: number; east: number; west: number }

export interface MapPin {
  id?: string
  lat: number
  lng: number
  name: string
  description: string
  image_url?: string | null
  reward_type?: string | null
  reward_radius_m?: number | null
}

interface Props {
  onBoundsChange: (b: Bounds | null) => void
  initialBounds?: Bounds | null
  pins?: MapPin[]
  onAddPin?: (pin: {
    lat: number; lng: number; name: string; description: string
    image_url?: string | null
    reward_type?: string | null
    reward_payload?: string | null
    reward_radius_m?: number | null
  }) => Promise<void> | void
  onDeletePin?: (id: string) => Promise<void> | void
  onEditPin?: (id: string) => void
  onMovePin?: (id: string, lat: number, lng: number) => Promise<void> | void
  allItems?: { id: string; name: string; type: string }[]
  allCreatures?: { id: string; name: string; rarity: string }[]
}

function isValidBounds(b: Bounds | null | undefined): b is Bounds {
  return !!b &&
    typeof b.north === 'number' && isFinite(b.north) &&
    typeof b.south === 'number' && isFinite(b.south) &&
    typeof b.east  === 'number' && isFinite(b.east)  &&
    typeof b.west  === 'number' && isFinite(b.west)
}

export default function MapPicker({ onBoundsChange, initialBounds, pins, onAddPin, onDeletePin, onEditPin, onMovePin, allItems = [], allCreatures = [] }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<any>(null)
  const rectRef           = useRef<any>(null)
  const LRef              = useRef<any>(null)
  const drawModeRef       = useRef(false)
  const pinModeRef        = useRef(false)
  const onChangeRef       = useRef(onBoundsChange)
  const pinMarkersRef     = useRef<Map<string, any>>(new Map())

  const validInitial = isValidBounds(initialBounds) ? initialBounds : null

  const [drawMode, setDrawMode]       = useState(false)
  const [pinMode, setPinMode]         = useState(false)
  const [hasBounds, setHasBounds]     = useState(isValidBounds(initialBounds))
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching]     = useState(false)
  const [tooSmall, setTooSmall]       = useState(false)
  const [mapReady, setMapReady]       = useState(false)
  // Pending pin: clicked point waiting for name/description
  const [pendingPin, setPendingPin]   = useState<{ lat: number; lng: number } | null>(null)
  const [pinName, setPinName]         = useState('')
  const [pinDesc, setPinDesc]         = useState('')
  const [pinImageFile, setPinImageFile] = useState<File | null>(null)
  const [pinImagePreview, setPinImagePreview] = useState<string | null>(null)
  const [pinRewardType, setPinRewardType]     = useState('none')
  const [pinRewardPayload, setPinRewardPayload] = useState('')
  const [pinRewardRadius, setPinRewardRadius]   = useState(50)
  const [savingPin, setSavingPin]     = useState(false)

  useEffect(() => { onChangeRef.current = onBoundsChange }, [onBoundsChange])
  useEffect(() => { drawModeRef.current = drawMode }, [drawMode])
  useEffect(() => { pinModeRef.current = pinMode }, [pinMode])

  // Sync drawMode → Leaflet dragging
  useEffect(() => {
    if (!mapRef.current) return
    if (drawMode || pinMode) mapRef.current.dragging.disable()
    else mapRef.current.dragging.enable()
  }, [drawMode, pinMode])

  // Init Leaflet
  useEffect(() => {
    if (!containerRef.current) return
    let cleanupFn = () => {}

    import('leaflet').then(L => {
      if (mapRef.current) return

      LRef.current = L

      const center: [number, number] = validInitial
        ? [(validInitial.north + validInitial.south) / 2, (validInitial.east + validInitial.west) / 2]
        : [43.91, 12.91]

      const map = L.map(containerRef.current!, { center, zoom: validInitial ? 14 : 12, zoomControl: true })
      mapRef.current = map

      setTimeout(() => map.invalidateSize(), 100)

      // CartoDB Dark Matter tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map)

      if (validInitial) {
        const b = L.latLngBounds(
          [validInitial.south, validInitial.west],
          [validInitial.north, validInitial.east]
        )
        rectRef.current = L.rectangle(b, { color: '#3A9DBC', weight: 2, fillOpacity: 0.15 }).addTo(map)
        map.fitBounds(b, { padding: [30, 30] })
      }

      // Click handler for pin mode
      map.on('click', (e: any) => {
        if (!pinModeRef.current) return
        setPendingPin({ lat: e.latlng.lat, lng: e.latlng.lng })
        setPinName('')
        setPinDesc('')
        pinModeRef.current = false
        setPinMode(false)
      })

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

      const onMouseDown = (e: MouseEvent) => { startDraw(e.clientX, e.clientY) }
      const onMouseMove = (e: MouseEvent) => { moveDraw(e.clientX, e.clientY) }
      const onMouseUp   = (e: MouseEvent) => { endDraw(e.clientX, e.clientY) }

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

      setMapReady(true)

      cleanupFn = () => {
        map.remove()
        mapRef.current = null
        LRef.current = null
        pinMarkersRef.current.clear()
        setMapReady(false)
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

  // Sync pin markers when pins prop changes
  useEffect(() => {
    if (!mapReady || !LRef.current || !mapRef.current) return
    const L = LRef.current
    const map = mapRef.current

    // Remove old markers
    pinMarkersRef.current.forEach(m => m.remove())
    pinMarkersRef.current.clear()

    // Pin icon (teardrop)
    const mkPinIcon = () => L.divIcon({
      html: `<div style="position:relative;width:0;height:0">
        <div style="
          position:absolute;width:26px;height:26px;
          left:-13px;top:-26px;
          background:#F7C841;border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 6px rgba(0,0,0,0.5);
        "></div>
      </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      className: '',
    })

    ;(pins ?? []).forEach(pin => {
      const key = pin.id ?? `${pin.lat},${pin.lng}`
      const REWARD_LABELS: Record<string, string> = {
        oggetto: '🎁 Oggetto', uovo: '🥚 Uovo', creatura: '🐾 Creatura',
        indizio: '🧩 Indizio', boss: '⚔️ Boss', evento: '🎉 Evento',
      }
      const rewardBadge = pin.reward_type
        ? `<span style="display:inline-block;margin-top:4px;font-size:10px;padding:2px 7px;border-radius:999px;background:#F7C84122;color:#F7C841;border:1px solid #F7C84155;font-weight:700">
            ${REWARD_LABELS[pin.reward_type] ?? pin.reward_type}
            ${pin.reward_radius_m ? `· ${pin.reward_radius_m}m` : ''}
          </span>`
        : ''
      const editBtn = pin.id && onEditPin
        ? `<button
            onclick="(function(){window.dispatchEvent(new CustomEvent('wc:edit-pin',{detail:'${pin.id}'}));})()"
            style="margin-top:6px;font-size:11px;color:#3A9DBC;background:none;border:none;cursor:pointer;padding:0;font-weight:600;margin-right:10px"
          >✏️ Modifica</button>`
        : ''
      const deleteBtn = pin.id && onDeletePin
        ? `<button
            onclick="(function(){window.dispatchEvent(new CustomEvent('wc:delete-pin',{detail:'${pin.id}'}));})()"
            style="margin-top:6px;font-size:11px;color:#E85D2F;background:none;border:none;cursor:pointer;padding:0;font-weight:600"
          >🗑 Elimina</button>`
        : ''
      const imgHtml = pin.image_url
        ? `<img src="${pin.image_url}"
            onclick="window.dispatchEvent(new CustomEvent('wc:zoom-image',{detail:'${pin.image_url}'}))"
            style="width:100%;border-radius:8px;margin-top:6px;cursor:zoom-in;max-height:120px;object-fit:cover"
            title="Clicca per ingrandire" />`
        : ''
      const popup = L.popup({ maxWidth: 230 }).setContent(
        `<div style="font-family:sans-serif;padding:2px 0">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${pin.name || 'Pin'}</div>
          ${pin.description ? `<div style="font-size:12px;color:#aaa;line-height:1.4">${pin.description}</div>` : ''}
          ${rewardBadge}
          ${imgHtml}
          <div style="margin-top:4px">${editBtn}${deleteBtn}</div>
        </div>`
      )
      const m = L.marker([pin.lat, pin.lng], { icon: mkPinIcon(), draggable: !!onMovePin && !!pin.id }).addTo(map).bindPopup(popup)
      if (onMovePin && pin.id) {
        m.on('dragstart', () => m.closePopup())
        m.on('dragend', () => {
          const { lat, lng } = m.getLatLng()
          window.dispatchEvent(new CustomEvent('wc:move-pin', { detail: { id: pin.id, lat, lng } }))
        })
      }
      pinMarkersRef.current.set(key, m)
    })
  }, [mapReady, pins]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for delete-pin / edit-pin events fired from Leaflet popup buttons
  useEffect(() => {
    if (!onDeletePin) return
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) onDeletePin(id)
    }
    window.addEventListener('wc:delete-pin', handler)
    return () => window.removeEventListener('wc:delete-pin', handler)
  }, [onDeletePin])

  useEffect(() => {
    if (!onEditPin) return
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) onEditPin(id)
    }
    window.addEventListener('wc:edit-pin', handler)
    return () => window.removeEventListener('wc:edit-pin', handler)
  }, [onEditPin])

  useEffect(() => {
    if (!onMovePin) return
    const handler = (e: Event) => {
      const { id, lat, lng } = (e as CustomEvent<{ id: string; lat: number; lng: number }>).detail
      if (id) onMovePin(id, lat, lng)
    }
    window.addEventListener('wc:move-pin', handler)
    return () => window.removeEventListener('wc:move-pin', handler)
  }, [onMovePin])

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

  async function confirmPin() {
    if (!pendingPin || !onAddPin) return
    setSavingPin(true)
    let imageUrl: string | null = null
    if (pinImageFile) {
      const fd = new FormData()
      fd.append('file', pinImageFile)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const json = await res.json()
        imageUrl = json.url ?? null
      }
    }
    await onAddPin({
      lat: pendingPin.lat, lng: pendingPin.lng,
      name: pinName.trim(), description: pinDesc.trim(),
      image_url: imageUrl,
      reward_type: pinRewardType === 'none' ? null : pinRewardType,
      reward_payload: (pinRewardType !== 'none' && pinRewardPayload) ? pinRewardPayload : null,
      reward_radius_m: pinRewardType !== 'none' ? pinRewardRadius : null,
    })
    setSavingPin(false)
    setPendingPin(null)
    setPinImageFile(null)
    setPinImagePreview(null)
    setPinRewardType('none')
    setPinRewardPayload('')
    setPinRewardRadius(50)
  }

  const showPinTools = !!onAddPin

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
        style={{
          height: 300,
          border: `2px solid ${drawMode ? '#3A9DBC' : pinMode ? '#F7C841' : 'rgba(255,255,255,0.15)'}`,
          cursor: drawMode ? 'crosshair' : pinMode ? 'cell' : undefined,
        }}
      >
        <div ref={containerRef} className="w-full h-full" />
        {drawMode && (
          <div className="absolute top-2 inset-x-2 flex justify-center pointer-events-none z-[1000]">
            <div className="bg-[#3A9DBC] text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg">
              ✏️ Clicca e trascina per disegnare l'area
            </div>
          </div>
        )}
        {pinMode && (
          <div className="absolute top-2 inset-x-2 flex justify-center pointer-events-none z-[1000]">
            <div className="bg-[#F7C841] text-black text-xs px-3 py-1.5 rounded-full font-bold shadow-lg">
              📍 Clicca sulla mappa per posizionare il pin
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
          onClick={() => { setDrawMode(v => !v); setPinMode(false) }}
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
        {showPinTools && (
          <button
            onClick={() => { setPinMode(v => !v); setDrawMode(false) }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
              pinMode
                ? 'bg-[#F7C841] border-[#F7C841] text-black'
                : 'bg-white/8 border-white/20 text-white hover:bg-white/15'
            }`}
          >
            {pinMode ? '✕ Annulla' : '📍 Pin'}
          </button>
        )}
      </div>

      {/* Pending pin form */}
      {pendingPin && (
        <div className="bg-[#F7C841]/10 border border-[#F7C841]/30 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-[#F7C841]">
            📍 Nuovo pin — {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
          </p>
          <input
            autoFocus
            value={pinName}
            onChange={e => setPinName(e.target.value)}
            placeholder="Nome del punto (es. Checkpoint A)"
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#F7C841]/60"
          />
          <textarea
            value={pinDesc}
            onChange={e => setPinDesc(e.target.value)}
            placeholder="Descrizione (opzionale)"
            rows={2}
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm resize-none placeholder:text-white/30 focus:outline-none focus:border-[#F7C841]/60"
          />
          {/* Image upload */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Immagine (opzionale)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setPinImageFile(f)
                if (f) {
                  const reader = new FileReader()
                  reader.onload = ev => setPinImagePreview(ev.target?.result as string)
                  reader.readAsDataURL(f)
                } else {
                  setPinImagePreview(null)
                }
              }}
              className="w-full text-xs text-white/60 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white/70 hover:file:bg-white/15 cursor-pointer"
            />
            {pinImagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pinImagePreview} alt="Anteprima" className="w-full rounded-lg object-cover max-h-28" />
            )}
          </div>
          {/* Reward type */}
          <div>
            <label className="text-xs text-white/50 font-medium">Tipo ricompensa (opzionale)</label>
            <select value={pinRewardType}
              onChange={e => { setPinRewardType(e.target.value); setPinRewardPayload('') }}
              className="mt-1 w-full bg-[#0F1F2E] border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#F7C841]/60">
              <option value="none">— Nessuna —</option>
              <option value="oggetto">🎁 Oggetto</option>
              <option value="uovo">🥚 Uovo</option>
              <option value="creatura">🐾 Creatura</option>
              <option value="indizio">🧩 Indizio</option>
              <option value="boss">⚔️ Boss</option>
              <option value="evento">🎉 Evento</option>
            </select>
          </div>
          {pinRewardType !== 'none' && (
            <>
              <PinPayloadFields
                type={pinRewardType}
                value={pinRewardPayload}
                onChange={setPinRewardPayload}
                allItems={allItems}
                allCreatures={allCreatures}
              />
              <div>
                <label className="text-xs text-white/50 font-medium">
                  Raggio attivazione: <span className="text-[#F7C841]">{pinRewardRadius} m</span>
                </label>
                <input type="range" min={20} max={300} step={10} value={pinRewardRadius}
                  onChange={e => setPinRewardRadius(+e.target.value)}
                  className="w-full accent-[#F7C841] mt-1" />
                <div className="flex justify-between text-xs text-white/25"><span>20 m</span><span>300 m</span></div>
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPendingPin(null); setPinImageFile(null); setPinImagePreview(null)
                setPinRewardType('none'); setPinRewardPayload(''); setPinRewardRadius(50)
              }}
              className="flex-1 py-1.5 rounded-lg text-sm bg-white/8 text-white/60 border border-white/15 hover:bg-white/12 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={confirmPin}
              disabled={savingPin || !pinName.trim()}
              className="flex-1 py-1.5 rounded-lg text-sm bg-[#F7C841] text-black font-bold disabled:opacity-50 hover:brightness-105 transition-all"
            >
              {savingPin ? 'Salvataggio…' : '✓ Aggiungi pin'}
            </button>
          </div>
        </div>
      )}

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
