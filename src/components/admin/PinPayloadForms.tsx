'use client'
import { useState } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parsePayload(raw: string): Record<string, unknown> {
  try { return raw ? JSON.parse(raw) : {} } catch { return {} }
}
export function encodePayload(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
}

const INPUT = 'w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60'
const SELECT = 'w-full bg-[#0F1F2E] border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3A9DBC]/60'
const LABEL = 'block text-xs text-white/50 mb-1'

// ── Oggetto ───────────────────────────────────────────────────────────────────

export function PinPayloadOggetto({ allItems, value, onChange }: {
  allItems: { id: string; name: string; type: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const p = parsePayload(value)
  const itemId = (p.item_id as string) ?? ''
  const qty    = (p.quantity as number) ?? 1
  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Oggetto</label>
        <select value={itemId} onChange={e => onChange(encodePayload({ item_id: e.target.value, quantity: qty }))} className={SELECT}>
          <option value="">— Seleziona oggetto —</option>
          {allItems.map(it => <option key={it.id} value={it.id}>{it.name} ({it.type})</option>)}
        </select>
      </div>
      <div>
        <label className={LABEL}>Quantità</label>
        <input type="number" min={1} max={99} value={qty}
          onChange={e => onChange(encodePayload({ item_id: itemId, quantity: Math.max(1, +e.target.value) }))}
          className={INPUT} />
      </div>
    </div>
  )
}

// ── Uovo ──────────────────────────────────────────────────────────────────────

export function PinPayloadUovo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p       = parsePayload(value)
  const rarity  = (p.egg_rarity as string) ?? 'comune'
  const steps   = (p.steps_required as number) ?? 0
  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Rarità uovo</label>
        <select value={rarity} onChange={e => onChange(encodePayload({ egg_rarity: e.target.value, steps_required: steps }))} className={SELECT}>
          {['comune','non_comune','raro','epico','leggendario','mitologico'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Passi per schiudersi (0 = immediato)</label>
        <input type="number" min={0} max={9999} value={steps}
          onChange={e => onChange(encodePayload({ egg_rarity: rarity, steps_required: Math.max(0, +e.target.value) }))}
          className={INPUT} />
      </div>
    </div>
  )
}

// ── Creatura ──────────────────────────────────────────────────────────────────

export function PinPayloadCreatura({ allCreatures, value, onChange }: {
  allCreatures: { id: string; name: string; rarity: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const p   = parsePayload(value)
  const cid = (p.creature_id as string) ?? ''
  return (
    <div>
      <label className={LABEL}>Creatura</label>
      <select value={cid} onChange={e => onChange(encodePayload({ creature_id: e.target.value }))} className={SELECT}>
        <option value="">— Seleziona creatura —</option>
        {allCreatures.map(c => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
      </select>
    </div>
  )
}

// ── Indizio ───────────────────────────────────────────────────────────────────
// Supports both direct image upload and manual URL.

export function PinPayloadIndizio({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p            = parsePayload(value)
  const text         = (p.text as string) ?? ''
  const chapterOrder = (p.chapter_order as number) ?? 1
  const imageUrl     = (p.image_url as string) ?? ''
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState<string | null>(imageUrl || null)

  function update(updates: Record<string, unknown>) {
    onChange(encodePayload({ text, chapter_order: chapterOrder, image_url: imageUrl, ...updates }))
  }

  async function handleImageFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const json = await res.json()
      const url = json.url ?? ''
      setPreview(url)
      update({ image_url: url })
    }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Ordine capitolo</label>
        <input type="number" min={1} value={chapterOrder}
          onChange={e => update({ chapter_order: +e.target.value })}
          className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Testo indizio</label>
        <textarea value={text} rows={3}
          onChange={e => update({ text: e.target.value })}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#3A9DBC]/60" />
      </div>
      <div className="space-y-1.5">
        <label className={LABEL}>Immagine indizio <span className="text-white/30">(opzionale)</span></label>
        {/* Upload file */}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
          className="w-full text-xs text-white/60 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white/70 hover:file:bg-white/15 cursor-pointer" />
        {uploading && <p className="text-xs text-white/40">Caricamento…</p>}
        {/* Or manual URL */}
        <input value={imageUrl} placeholder="oppure incolla URL immagine…"
          onChange={e => { setPreview(e.target.value || null); update({ image_url: e.target.value }) }}
          className={INPUT + ' text-xs'} />
        {/* Preview */}
        {preview && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Anteprima" className="w-full rounded-lg object-cover max-h-28" />
            <button type="button"
              onClick={() => { setPreview(null); update({ image_url: '' }) }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80">
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Boss ──────────────────────────────────────────────────────────────────────

export function PinPayloadBoss({ allCreatures, value, onChange }: {
  allCreatures: { id: string; name: string; rarity: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const p          = parsePayload(value)
  const cid        = (p.creature_id as string) ?? ''
  const level      = (p.level_override as number) ?? 5
  const goldReward = ((p.reward as any)?.gold as number) ?? 100
  const expReward  = ((p.reward as any)?.exp  as number) ?? 50
  const upd = (updates: object) => onChange(encodePayload({
    creature_id: cid, level_override: level,
    reward: { gold: goldReward, exp: expReward },
    ...updates,
  }))
  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Creatura boss</label>
        <select value={cid} onChange={e => upd({ creature_id: e.target.value })} className={SELECT}>
          <option value="">— Seleziona creatura —</option>
          {allCreatures.map(c => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Livello boss</label>
          <input type="number" min={1} max={20} value={level}
            onChange={e => upd({ level_override: +e.target.value })} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Gold reward</label>
          <input type="number" min={0} value={goldReward}
            onChange={e => upd({ reward: { gold: +e.target.value, exp: expReward } })} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>EXP reward</label>
          <input type="number" min={0} value={expReward}
            onChange={e => upd({ reward: { gold: goldReward, exp: +e.target.value } })} className={INPUT} />
        </div>
      </div>
    </div>
  )
}

// ── Evento ────────────────────────────────────────────────────────────────────

export function PinPayloadEvento({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p         = parsePayload(value)
  const eventType = (p.event_type as string) ?? ''
  const effect    = (p.effect as string) ?? ''
  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Tipo evento</label>
        <input value={eventType} placeholder="es. spawn_boost, gold_rain…"
          onChange={e => onChange(encodePayload({ event_type: e.target.value, effect }))}
          className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Descrizione effetto</label>
        <textarea value={effect} rows={2} placeholder="Testo mostrato al giocatore…"
          onChange={e => onChange(encodePayload({ event_type: eventType, effect: e.target.value }))}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#3A9DBC]/60" />
      </div>
    </div>
  )
}

// ── Reward type dispatcher ────────────────────────────────────────────────────

export function PinPayloadFields({ type, value, onChange, allItems, allCreatures }: {
  type: string
  value: string
  onChange: (v: string) => void
  allItems: { id: string; name: string; type: string }[]
  allCreatures: { id: string; name: string; rarity: string }[]
}) {
  if (type === 'oggetto')  return <PinPayloadOggetto  allItems={allItems}         value={value} onChange={onChange} />
  if (type === 'uovo')     return <PinPayloadUovo                                  value={value} onChange={onChange} />
  if (type === 'creatura') return <PinPayloadCreatura allCreatures={allCreatures}  value={value} onChange={onChange} />
  if (type === 'indizio')  return <PinPayloadIndizio                               value={value} onChange={onChange} />
  if (type === 'boss')     return <PinPayloadBoss     allCreatures={allCreatures}  value={value} onChange={onChange} />
  if (type === 'evento')   return <PinPayloadEvento                                value={value} onChange={onChange} />
  return null
}
