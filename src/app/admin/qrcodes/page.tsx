'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageInput } from '@/components/admin/ImageInput'
import type { QRCodeType } from '@/lib/types'

/* ── Searchable select ───────────────────────── */
function SearchSelect({
  options, value, onChange, placeholder,
}: {
  options: { value: string; label: string; sub?: string }[]
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [open, setOpen]   = useState(false)
  const [q, setQ]         = useState('')
  const ref               = useRef<HTMLDivElement>(null)
  const selected          = options.find(o => o.value === value)
  const filtered          = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) || (o.sub ?? '').toLowerCase().includes(q.toLowerCase()))
    : options

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ('') }
    }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setQ('') }}
        className="w-full flex items-center justify-between bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-left">
        {selected
          ? <span className="text-white">{selected.label}<span className="text-white/40 ml-2 text-xs">{selected.sub}</span></span>
          : <span className="text-white/30">{placeholder}</span>
        }
        <span className="text-white/40 ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#0d1e2e] border border-white/20 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Cerca..."
              className="w-full bg-white/10 text-white text-sm border border-white/20 rounded-lg px-3 py-1.5 outline-none" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-4 py-3 text-white/30 text-sm">Nessun risultato</p>
              : filtered.map(o => (
                  <button key={o.value} type="button"
                    onClick={() => { onChange(o.value); setOpen(false); setQ('') }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center justify-between ${value === o.value ? 'bg-[#3A9DBC]/10 text-[#3A9DBC]' : 'text-white'}`}>
                    <span>{o.label}</span>
                    {o.sub && <span className="text-xs text-white/40 ml-2">{o.sub}</span>}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Per-type field definitions ─────────────── */
const TYPE_INFO: Record<QRCodeType, { label: string; icon: string; description: string }> = {
  oggetto: { label: 'Oggetto',        icon: '🎁', description: 'Il giocatore ottiene un oggetto dallo zaino.' },
  indizio: { label: 'Indizio',        icon: '🔍', description: 'Il giocatore riceve un testo/immagine narrativo.' },
  uovo:    { label: 'Uovo creatura',  icon: '🥚', description: 'Il giocatore ottiene un uovo da schiudere.' },
  boss:    { label: 'Boss',           icon: '💀', description: 'Il giocatore affronta una creatura boss.' },
  evento:  { label: 'Evento speciale',icon: '⚡',  description: 'Attiva un bonus temporaneo per il giocatore.' },
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}
const cls = 'w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm'

/* ── Default payload fields per type ─────────── */
type Fields = Record<string, string | number>

function defaultFields(t: QRCodeType): Fields {
  switch (t) {
    case 'oggetto': return { item_id: '', quantity: 1 }
    case 'indizio': return { chapter_order: 1, text: '', image_url: '' }
    case 'uovo':    return { egg_rarity: 'comune' }
    case 'boss':    return { creature_id: '', level_override: 10 }
    case 'evento':  return { event_type: 'bonus_exp', multiplier: 2, duration_minutes: 10 }
  }
}

function buildPayload(t: QRCodeType, f: Fields): any {
  switch (t) {
    case 'oggetto': return { item_id: f.item_id, quantity: Number(f.quantity) }
    case 'indizio': return { chapter_order: Number(f.chapter_order), text: f.text, image_url: f.image_url || null }
    case 'uovo':    return { egg_rarity: f.egg_rarity, creature_pool: [] }
    case 'boss':    return { creature_id: f.creature_id, level_override: Number(f.level_override) }
    case 'evento':  return { event_type: f.event_type, effect: { multiplier: Number(f.multiplier), duration_minutes: Number(f.duration_minutes) } }
  }
}

/* ── QR Preview Modal ────────────────────────── */
function QRModal({ qr, onClose, onDownload }: { qr: any; onClose: () => void; onDownload: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const info = TYPE_INFO[qr.type as QRCodeType]

  useEffect(() => {
    if (!canvasRef.current) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, qr.id, {
        width: 220,
        margin: 2,
        color: { dark: '#0F1F2E', light: '#ffffff' },
      })
    })
  }, [qr.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 max-w-xs w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{info?.icon ?? '📷'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{qr.label || info?.label || qr.type}</p>
            <p className="text-xs text-white/40">{info?.label} · {info?.description}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none ml-1">✕</button>
        </div>

        {/* QR canvas */}
        <div className="flex justify-center bg-white rounded-xl p-3 mb-4">
          <canvas ref={canvasRef} />
        </div>

        {/* Meta */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">ID</span>
            <span className="text-white/60 font-mono">{qr.id.slice(0, 8)}…</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Usi rimanenti</span>
            <span className={`font-bold ${qr.uses_remaining === 0 ? 'text-red-400' : qr.uses_remaining === null ? 'text-[#34d399]' : 'text-[#F7C841]'}`}>
              {qr.uses_remaining === null ? '∞ illimitati' : qr.uses_remaining === 0 ? '⛔ Esaurito' : `${qr.uses_remaining} rimasti`}
            </span>
          </div>
        </div>

        <button onClick={onDownload}
          className="w-full bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm">
          ⬇ Scarica PNG
        </button>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────── */
export default function QRCodesPage() {
  const [sessions, setSessions]         = useState<any[]>([])
  const [selectedId, setSelectedId]     = useState('')
  const [qrCodes, setQrCodes]           = useState<any[]>([])
  const [previewQr, setPreviewQr]       = useState<any | null>(null)

  // Reference data for selects
  const [creatures, setCreatures]       = useState<any[]>([])
  const [items, setItems]               = useState<any[]>([])

  const [type, setType]                 = useState<QRCodeType>('oggetto')
  const [label, setLabel]               = useState('')
  const [fields, setFields]             = useState<Fields>(defaultFields('oggetto'))
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null)
  const [creating, setCreating]         = useState(false)
  const [error, setError]               = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
    // Load creatures and items for selects
    fetch('/api/admin/creatures').then(r => r.json()).then(d => setCreatures(d.creatures ?? []))
    fetch('/api/admin/items').then(r => r.json()).then(d => setItems(d.items ?? []))
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/qrcodes?sessionId=${selectedId}`)
      .then(r => r.json()).then(d => setQrCodes(d.qrCodes ?? []))
  }, [selectedId])

  function handleTypeChange(t: QRCodeType) {
    setType(t); setFields(defaultFields(t)); setError('')
  }

  function setField(key: string, val: string | number) {
    setFields(prev => ({ ...prev, [key]: val }))
  }

  async function createQR() {
    setError('')
    setCreating(true)
    const res = await fetch('/api/admin/qrcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, type, payload: buildPayload(type, fields), usesRemaining, label }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setQrCodes(prev => [data.qrCode, ...prev])
      setLabel(''); setFields(defaultFields(type))
    } else {
      setError(data.error ?? 'Errore nella creazione')
    }
  }

  async function downloadQR(qrId: string, qrLabel: string) {
    const QRCode = await import('qrcode')
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrId, { width: 300 })
    const link = document.createElement('a')
    link.download = `qr_${qrLabel || qrId}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  // Build select options
  const creatureOptions = creatures.map(c => ({ value: c.id, label: c.name, sub: `${c.rarity} · ${c.element}` }))
  const itemOptions     = items.map(i => ({ value: i.id, label: i.name, sub: i.type }))

  const info = TYPE_INFO[type]

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">📷 QR Codes</h1>

      {/* Session selector */}
      <div className="mb-4">
        <label className="block text-xs text-white/50 mb-1">Sessione</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Create form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 space-y-4">
        <h2 className="font-bold text-white">Crea nuovo QR Code</h2>

        {/* Type selector */}
        <Field label="Tipo di QR Code">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
            {(Object.keys(TYPE_INFO) as QRCodeType[]).map(t => (
              <button key={t} onClick={() => handleTypeChange(t)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-colors ${
                  type === t ? 'bg-[#3A9DBC]/20 border-[#3A9DBC] text-[#3A9DBC]' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                }`}>
                <span className="text-xl">{TYPE_INFO[t].icon}</span>
                {TYPE_INFO[t].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/35 mt-2 italic">{info.description}</p>
        </Field>

        {/* Label */}
        <Field label="Etichetta QR" hint="Nome visivo per riconoscere questo QR nell'elenco (es. 'Stazione A')">
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="es. Stazione A" className={cls} />
        </Field>

        {/* Dynamic fields per type */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Contenuto del QR</p>

          {type === 'oggetto' && (
            <>
              <Field label="Oggetto da consegnare" hint="Seleziona l'oggetto che il giocatore riceverà scansionando questo QR">
                <SearchSelect
                  options={itemOptions}
                  value={String(fields.item_id)}
                  onChange={v => setField('item_id', v)}
                  placeholder="Seleziona oggetto..."
                />
              </Field>
              <Field label="Quantità" hint="Quanti oggetti riceve il giocatore">
                <input type="number" value={fields.quantity} min={1} onChange={e => setField('quantity', +e.target.value)} className={cls} />
              </Field>
            </>
          )}

          {type === 'indizio' && (
            <>
              <Field label="Capitolo di riferimento" hint="A quale missione/capitolo appartiene questo indizio">
                <input type="number" value={fields.chapter_order} min={1} onChange={e => setField('chapter_order', +e.target.value)} className={cls} />
              </Field>
              <Field label="Testo dell'indizio" hint="Il messaggio narrativo mostrato al giocatore">
                <textarea value={String(fields.text)} onChange={e => setField('text', e.target.value)}
                  rows={3} className={cls + ' resize-none'} placeholder="es. Il segreto si nasconde tra le rovine al tramonto..." />
              </Field>
              <ImageInput
                label="Immagine (opzionale)"
                hint="Immagine mostrata insieme al testo dell'indizio"
                value={String(fields.image_url)}
                onChange={v => setField('image_url', v)}
                optional
              />
            </>
          )}

          {type === 'uovo' && (
            <Field label="Rarità dell'uovo" hint="Determina la rarità delle creature ottenibili dall'uovo">
              <select value={String(fields.egg_rarity)} onChange={e => setField('egg_rarity', e.target.value)} className={cls}>
                <option value="comune">⚪ Comune</option>
                <option value="raro">🔵 Raro</option>
                <option value="epico">🟣 Epico</option>
                <option value="leggendario">🟡 Leggendario</option>
              </select>
            </Field>
          )}

          {type === 'boss' && (
            <>
              <Field label="Creatura boss" hint="Seleziona la creatura che apparirà come boss da scansionare">
                <SearchSelect
                  options={creatureOptions}
                  value={String(fields.creature_id)}
                  onChange={v => setField('creature_id', v)}
                  placeholder="Seleziona creatura..."
                />
              </Field>
              <Field label="Livello del boss" hint="Livello con cui la creatura appare come boss (più alto = più difficile)">
                <input type="number" value={fields.level_override} min={1} onChange={e => setField('level_override', +e.target.value)} className={cls} />
              </Field>
            </>
          )}

          {type === 'evento' && (
            <>
              <Field label="Tipo di bonus" hint="Quale effetto si attiva quando il giocatore scansiona">
                <select value={String(fields.event_type)} onChange={e => setField('event_type', e.target.value)} className={cls}>
                  <option value="bonus_exp">✨ Moltiplicatore EXP</option>
                  <option value="spawn_rate_boost">🐾 Aumento spawn creature</option>
                  <option value="double_gold">🪙 Oro raddoppiato</option>
                </select>
              </Field>
              <Field label="Moltiplicatore" hint="es. 2 = doppio effetto, 3 = triplo">
                <input type="number" value={fields.multiplier} min={1} step={0.5} onChange={e => setField('multiplier', +e.target.value)} className={cls} />
              </Field>
              <Field label="Durata (minuti)" hint="Per quanti minuti rimane attivo il bonus">
                <input type="number" value={fields.duration_minutes} min={1} onChange={e => setField('duration_minutes', +e.target.value)} className={cls} />
              </Field>
            </>
          )}
        </div>

        {/* Uses remaining */}
        <Field label="Utilizzi massimi" hint="Lascia vuoto per utilizzi illimitati. Utile per QR esclusivi (es. 1 solo uso).">
          <input type="number" placeholder="∞ illimitati" min={1}
            value={usesRemaining ?? ''}
            onChange={e => setUsesRemaining(e.target.value ? +e.target.value : null)}
            className="w-40 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
        </Field>

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>}

        <button onClick={createQR} disabled={creating || !selectedId}
          className="w-full bg-[#E85D2F] text-white font-bold py-2.5 rounded-lg disabled:opacity-50">
          {creating ? 'Creazione...' : `${info.icon} Crea QR — ${info.label}`}
        </button>
      </div>

      {/* QR list */}
      <div className="space-y-2">
        {qrCodes.length === 0 && <p className="text-white/30 text-sm">Nessun QR code per questa sessione.</p>}
        {qrCodes.map(qr => (
          <div key={qr.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-2xl">{TYPE_INFO[qr.type as QRCodeType]?.icon ?? '📷'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">{qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || qr.type}</p>
              <p className="text-xs text-white/40 font-mono truncate">{qr.id}</p>
              <p className="text-xs text-white/40">{qr.uses_remaining === null ? '∞ usi illimitati' : `${qr.uses_remaining} usi rimanenti`}</p>
            </div>
            <button onClick={() => downloadQR(qr.id, qr.label)}
              className="bg-[#3A9DBC] text-white px-3 py-1.5 rounded-lg text-sm shrink-0">⬇ PNG</button>
          </div>
        ))}
      </div>
    </div>
  )
}
