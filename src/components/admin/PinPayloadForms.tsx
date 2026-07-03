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

const RARITY_LABEL: Record<string, string> = {
  comune: 'Terrestre', non_comune: 'Arcaico', raro: 'Eroico',
  epico: 'Mostruoso', leggendario: 'Leggendario', mitologico: 'Mitologico',
}
const EGG_RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']

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
          {EGG_RARITIES.map(r => (
            <option key={r} value={r}>{RARITY_LABEL[r]}</option>
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
        {allCreatures.map(c => <option key={c.id} value={c.id}>{c.name} ({RARITY_LABEL[c.rarity] ?? c.rarity})</option>)}
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

export function PinPayloadBoss({ allCreatures, allItems, value, onChange }: {
  allCreatures: { id: string; name: string; rarity: string }[]
  allItems: { id: string; name: string; type: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const p = parsePayload(value)

  // Support both legacy {creature_id, level_override} and new {creatures:[...]}
  const rawCreatures: any[] = Array.isArray(p.creatures)
    ? p.creatures
    : (p.creature_id ? [{ creature_id: p.creature_id, level_override: p.level_override }] : [])

  const c1 = (rawCreatures[0]?.creature_id as string) ?? ''
  const l1 = (rawCreatures[0]?.level_override as number) ?? 10
  const c2 = (rawCreatures[1]?.creature_id as string) ?? ''
  const l2 = (rawCreatures[1]?.level_override as number) ?? 10
  const c3 = (rawCreatures[2]?.creature_id as string) ?? ''
  const l3 = (rawCreatures[2]?.level_override as number) ?? 10
  const isGym          = p.gym === true
  const extraArr       = Array.isArray(p.extra) ? p.extra as Array<{ type: string; payload: any }>
                        : Array.isArray((p.reward as any)?.extra) ? (p.reward as any).extra : []
  const extraPackId    = (extraArr.find((e: any) => e.type === 'bustina')?.payload?.pack_id as string) ?? ''
  const extraGemme     = (extraArr.find((e: any) => e.type === 'gemme')?.payload?.amount as number) ?? 0
  const [lootPacks, setLootPacks] = useState<{ id: string; name: string }[]>([])
  useState(() => {
    fetch('/api/admin/catalog/packs').then(r => r.json())
      .then(d => setLootPacks(((d.rows ?? []) as { id: string; name: string }[]).map(x => ({ id: x.id, name: x.name }))))
      .catch(() => {})
    return undefined
  })
  const goldReward     = ((p.reward as any)?.gold        as number) ?? 200
  const expReward      = ((p.reward as any)?.exp         as number) ?? 100
  const itemIdReward   = ((p.reward as any)?.item_id     as string) ?? ''
  const itemQtyReward  = ((p.reward as any)?.item_qty    as number) ?? 1
  const creatureReward = ((p.reward as any)?.creature_id as string) ?? ''

  function save(
    nc1: string, nl1: number, nc2: string, nl2: number, nc3: string, nl3: number,
    gold: number, exp: number, itemId: string, itemQty: number, rewardCreatureId: string,
    gym: boolean = isGym,
    packId: string = extraPackId,
    gemmeAmt: number = extraGemme,
  ) {
    const creatures = [
      { creature_id: nc1, level_override: nl1 },
      { creature_id: nc2, level_override: nl2 },
      { creature_id: nc3, level_override: nl3 },
    ].filter(c => c.creature_id)
    const reward: Record<string, unknown> = { gold, exp }
    if (itemId)          { reward.item_id = itemId; reward.item_qty = itemQty }
    if (rewardCreatureId) reward.creature_id = rewardCreatureId
    const extra: Array<{ type: string; payload: Record<string, unknown> }> = []
    if (packId)       extra.push({ type: 'bustina', payload: { pack_id: packId } })
    if (gemmeAmt > 0) extra.push({ type: 'gemme', payload: { amount: gemmeAmt } })
    if (extra.length > 0) reward.extra = extra
    onChange(encodePayload({ creatures, reward, ...(gym ? { gym: true } : {}) }))
  }

  const slots = [
    { cid: c1, lv: l1, label: 'Creatura 1 (obbligatoria)' },
    { cid: c2, lv: l2, label: 'Creatura 2 (opzionale)' },
    { cid: c3, lv: l3, label: 'Creatura 3 (opzionale)' },
  ]

  return (
    <div className="space-y-3">
      {slots.map(({ cid, lv, label }, i) => {
        const vals = [c1, c2, c3]
        const lvls = [l1, l2, l3]
        return (
          <div key={i} className="space-y-1.5 border border-white/10 rounded-xl p-3">
            <label className={LABEL + ' font-semibold'}>{label}</label>
            <select
              value={cid}
              onChange={e => {
                const nv = [...vals]; nv[i] = e.target.value
                save(nv[0], lvls[0], nv[1], lvls[1], nv[2], lvls[2], goldReward, expReward, itemIdReward, itemQtyReward, creatureReward)
              }}
              className={SELECT}
            >
              <option value="">— Nessuna —</option>
              {allCreatures.map(c => <option key={c.id} value={c.id}>{c.name} ({RARITY_LABEL[c.rarity] ?? c.rarity})</option>)}
            </select>
            {cid && (
              <div>
                <label className={LABEL}>Livello</label>
                <input type="number" min={1} max={20} value={lv}
                  onChange={e => {
                    const nv = [...lvls]; nv[i] = +e.target.value
                    save(vals[0], nv[0], vals[1], nv[1], vals[2], nv[2], goldReward, expReward, itemIdReward, itemQtyReward, creatureReward)
                  }}
                  className={INPUT} />
              </div>
            )}
          </div>
        )
      })}

      <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-[#E6C989]/25 bg-[#E6C989]/5 p-3">
        <input type="checkbox" checked={isGym}
          onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, expReward, itemIdReward, itemQtyReward, creatureReward, e.target.checked)}
          className="w-4 h-4 accent-[#E6C989] mt-0.5" />
        <span className="text-sm text-white/80">
          🏰 Palestra presidiabile
          <span className="block text-[11px] text-white/40 mt-0.5">
            Sempre risfidabile: chi vince la presidia, la difesa decade col tempo e lo spodestato incassa la rendita.
            Tieni le ricompense modeste — vengono erogate a ogni vittoria.
          </span>
        </span>
      </label>

      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider pt-1">Ricompense vittoria</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Gold</label>
          <input type="number" min={0} value={goldReward}
            onChange={e => save(c1, l1, c2, l2, c3, l3, +e.target.value, expReward, itemIdReward, itemQtyReward, creatureReward)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>EXP</label>
          <input type="number" min={0} value={expReward}
            onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, +e.target.value, itemIdReward, itemQtyReward, creatureReward)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>🎴 Bustina bonus (opzionale)</label>
          <select value={extraPackId}
            onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, expReward, itemIdReward, itemQtyReward, creatureReward, isGym, e.target.value, extraGemme)}
            className={SELECT}>
            <option value="">— Nessuna —</option>
            {lootPacks.map(pk => <option key={pk.id} value={pk.id}>{pk.name}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>💎 Gemme bonus</label>
          <input type="number" min={0} value={extraGemme}
            onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, expReward, itemIdReward, itemQtyReward, creatureReward, isGym, extraPackId, Math.max(0, +e.target.value))}
            className={INPUT} />
        </div>
      </div>

      <div className="border border-white/10 rounded-xl p-3 space-y-2">
        <label className={LABEL + ' font-semibold'}>Oggetto bonus (opzionale)</label>
        <select value={itemIdReward}
          onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, expReward, e.target.value, itemQtyReward, creatureReward)}
          className={SELECT}>
          <option value="">— Nessuno —</option>
          {allItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
        {itemIdReward && (
          <div>
            <label className={LABEL}>Quantità</label>
            <input type="number" min={1} max={99} value={itemQtyReward}
              onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, expReward, itemIdReward, +e.target.value, creatureReward)}
              className={INPUT} />
          </div>
        )}
      </div>

      <div className="border border-white/10 rounded-xl p-3 space-y-2">
        <label className={LABEL + ' font-semibold'}>Creatura bonus (opzionale)</label>
        <select value={creatureReward}
          onChange={e => save(c1, l1, c2, l2, c3, l3, goldReward, expReward, itemIdReward, itemQtyReward, e.target.value)}
          className={SELECT}>
          <option value="">— Nessuna —</option>
          {allCreatures.map(c => <option key={c.id} value={c.id}>{c.name} ({RARITY_LABEL[c.rarity] ?? c.rarity})</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Enigma ────────────────────────────────────────────────────────────────────

export function PinPayloadEnigma({ allEnigmi, value, onChange }: {
  allEnigmi: { id: string; title: string; difficulty: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const p = parsePayload(value)
  const enigmaId = (p.enigma_id as string) ?? ''

  const DIFF_LABEL: Record<string, string> = { facile: '🟢 Facile', medio: '🟡 Medio', difficile: '🔴 Difficile' }
  const selected = allEnigmi.find(e => e.id === enigmaId)

  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Enigma</label>
        <select
          value={enigmaId}
          onChange={e => onChange(encodePayload({ enigma_id: e.target.value }))}
          className={SELECT}
        >
          <option value="">— Seleziona enigma —</option>
          {allEnigmi.map(e => (
            <option key={e.id} value={e.id}>
              {e.title} ({DIFF_LABEL[e.difficulty] ?? e.difficulty})
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <p className="text-xs text-white/40">
          Difficoltà: <span className="text-[#3A9DBC]/80">{DIFF_LABEL[selected.difficulty] ?? selected.difficulty}</span>
        </p>
      )}
      {allEnigmi.length === 0 && (
        <p className="text-xs text-white/30 italic">Nessun enigma disponibile per questa sessione. Creane uno in <strong>🧩 Enigmi</strong>.</p>
      )}
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

// ── Loot / currency (bustina · forziere · premio · gemme) ─────────────────────

export function PinPayloadLoot({ type, value, onChange }: {
  type: 'bustina' | 'forziere' | 'premio' | 'gemme'
  value: string
  onChange: (v: string) => void
}) {
  const p = parsePayload(value)
  const [opts, setOpts] = useState<{ id: string; name: string }[]>([])

  useState(() => {
    if (type === 'gemme') return
    const table = type === 'bustina' ? 'packs' : type === 'forziere' ? 'chests' : 'special_prizes'
    fetch(`/api/admin/catalog/${table}`).then(r => r.json()).then(d => setOpts((d.rows ?? []).map((x: any) => ({ id: x.id, name: x.name })))).catch(() => {})
    return undefined
  })

  if (type === 'gemme') {
    const amount = (p.amount as number) ?? 10
    return (
      <div>
        <label className={LABEL}>Quantità gemme</label>
        <input type="number" min={1} value={amount}
          onChange={e => onChange(encodePayload({ amount: Math.max(1, +e.target.value) }))} className={INPUT} />
      </div>
    )
  }

  const key = type === 'bustina' ? 'pack_id' : type === 'forziere' ? 'chest_id' : 'prize_id'
  const selected = (p[key] as string) ?? ''
  const label = type === 'bustina' ? 'Bustina' : type === 'forziere' ? 'Forziere' : 'Premio'
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <select value={selected} onChange={e => onChange(encodePayload({ [key]: e.target.value }))} className={SELECT}>
        <option value="">— Seleziona {label.toLowerCase()} —</option>
        {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}

// ── Reward type dispatcher ────────────────────────────────────────────────────

export function PinPayloadFields({ type, value, onChange, allItems, allCreatures, allEnigmi }: {
  type: string
  value: string
  onChange: (v: string) => void
  allItems: { id: string; name: string; type: string }[]
  allCreatures: { id: string; name: string; rarity: string }[]
  allEnigmi?: { id: string; title: string; difficulty: string }[]
}) {
  if (type === 'oggetto')  return <PinPayloadOggetto  allItems={allItems}         value={value} onChange={onChange} />
  if (type === 'uovo')     return <PinPayloadUovo                                  value={value} onChange={onChange} />
  if (type === 'creatura') return <PinPayloadCreatura allCreatures={allCreatures}  value={value} onChange={onChange} />
  if (type === 'indizio')  return <PinPayloadIndizio                               value={value} onChange={onChange} />
  if (type === 'boss')     return <PinPayloadBoss     allCreatures={allCreatures} allItems={allItems} value={value} onChange={onChange} />
  if (type === 'evento')   return <PinPayloadEvento                                value={value} onChange={onChange} />
  if (type === 'enigma')   return <PinPayloadEnigma   allEnigmi={allEnigmi ?? []}  value={value} onChange={onChange} />
  if (type === 'bustina' || type === 'forziere' || type === 'premio' || type === 'gemme')
    return <PinPayloadLoot type={type} value={value} onChange={onChange} />
  return null
}
