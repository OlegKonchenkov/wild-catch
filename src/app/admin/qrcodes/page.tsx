'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QRCodeType } from '@/lib/types'

/* ── Per-type field definitions ─────────────────────────── */
type FieldDef = {
  key: string
  label: string
  hint: string
  type: 'text' | 'number' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  defaultValue: string | number
  optional?: boolean
}

const TYPE_INFO: Record<QRCodeType, { label: string; icon: string; description: string; fields: FieldDef[] }> = {
  oggetto: {
    label: 'Oggetto', icon: '🎁',
    description: 'Il giocatore ottiene un oggetto dallo zaino quando scansiona questo QR.',
    fields: [
      { key: 'item_id',  label: 'ID Oggetto (UUID)',  hint: 'Copia l\'ID dall\'elenco oggetti nel database', type: 'text', defaultValue: '' },
      { key: 'quantity', label: 'Quantità',            hint: 'Quanti oggetti riceve il giocatore', type: 'number', defaultValue: 1 },
    ],
  },
  indizio: {
    label: 'Indizio', icon: '🔍',
    description: 'Il giocatore riceve un testo/immagine che lo guida verso il prossimo obiettivo.',
    fields: [
      { key: 'chapter_order', label: 'Capitolo di riferimento', hint: 'A quale capitolo/missione appartiene questo indizio (numero)', type: 'number', defaultValue: 1 },
      { key: 'text',          label: 'Testo dell\'indizio',      hint: 'Il messaggio narrativo mostrato al giocatore', type: 'textarea', defaultValue: '' },
      { key: 'image_url',     label: 'URL immagine (opzionale)', hint: 'Link a un\'immagine da mostrare insieme al testo', type: 'text', defaultValue: '', optional: true },
    ],
  },
  uovo: {
    label: 'Uovo creatura', icon: '🥚',
    description: 'Il giocatore ottiene un uovo che si schiude in una creatura casuale del pool selezionato.',
    fields: [
      {
        key: 'egg_rarity', label: 'Rarità dell\'uovo', hint: 'Determina la rarità delle creature ottenibili',
        type: 'select', defaultValue: 'comune',
        options: [
          { value: 'comune',    label: '⚪ Comune' },
          { value: 'raro',      label: '🔵 Raro' },
          { value: 'epico',     label: '🟣 Epico' },
          { value: 'leggendario', label: '🟡 Leggendario' },
        ],
      },
    ],
  },
  boss: {
    label: 'Boss', icon: '💀',
    description: 'Il giocatore affronta un boss — creatura speciale con livello elevato.',
    fields: [
      { key: 'creature_id',    label: 'ID Creatura boss (UUID)', hint: 'UUID della creatura che farà da boss (dalla sezione Creature)', type: 'text', defaultValue: '' },
      { key: 'level_override', label: 'Livello del boss',        hint: 'Livello con cui la creatura appare come boss (default: 10)', type: 'number', defaultValue: 10 },
    ],
  },
  evento: {
    label: 'Evento speciale', icon: '⚡',
    description: 'Attiva un bonus temporaneo per il giocatore che scansiona.',
    fields: [
      {
        key: 'event_type', label: 'Tipo di bonus', hint: 'Quale effetto si attiva',
        type: 'select', defaultValue: 'bonus_exp',
        options: [
          { value: 'bonus_exp',         label: '✨ Moltiplicatore EXP' },
          { value: 'spawn_rate_boost',  label: '🐾 Aumento spawn creature' },
          { value: 'double_gold',       label: '🪙 Oro raddoppiato' },
        ],
      },
      { key: 'multiplier',        label: 'Moltiplicatore',      hint: 'es. 2 = doppio, 3 = triplo', type: 'number', defaultValue: 2 },
      { key: 'duration_minutes',  label: 'Durata (minuti)',      hint: 'Per quanti minuti rimane attivo il bonus', type: 'number', defaultValue: 10 },
    ],
  },
}

function buildDefaultFields(t: QRCodeType): Record<string, string | number> {
  const obj: Record<string, string | number> = {}
  TYPE_INFO[t].fields.forEach(f => { obj[f.key] = f.defaultValue })
  return obj
}

function buildPayload(t: QRCodeType, fields: Record<string, string | number>): any {
  if (t === 'uovo') return { egg_rarity: fields.egg_rarity, creature_pool: [] }
  if (t === 'evento') return { event_type: fields.event_type, effect: { multiplier: Number(fields.multiplier), duration_minutes: Number(fields.duration_minutes) } }
  const out: any = {}
  TYPE_INFO[t].fields.forEach(f => {
    if (fields[f.key] !== '' || !f.optional) {
      out[f.key] = f.type === 'number' ? Number(fields[f.key]) : fields[f.key]
    }
  })
  return out
}

export default function QRCodesPage() {
  const [sessions, setSessions]       = useState<any[]>([])
  const [selectedId, setSelectedId]   = useState('')
  const [qrCodes, setQrCodes]         = useState<any[]>([])
  const [type, setType]               = useState<QRCodeType>('oggetto')
  const [label, setLabel]             = useState('')
  const [fields, setFields]           = useState<Record<string, string | number>>(buildDefaultFields('oggetto'))
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null)
  const [creating, setCreating]       = useState(false)
  const [error, setError]             = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/qrcodes?sessionId=${selectedId}`)
      .then(r => r.json()).then(d => setQrCodes(d.qrCodes ?? []))
  }, [selectedId])

  function handleTypeChange(t: QRCodeType) {
    setType(t)
    setFields(buildDefaultFields(t))
    setError('')
  }

  function setField(key: string, val: string | number) {
    setFields(prev => ({ ...prev, [key]: val }))
  }

  async function createQR() {
    setError('')
    const payload = buildPayload(type, fields)
    setCreating(true)
    const res = await fetch('/api/admin/qrcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, type, payload, usesRemaining, label }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setQrCodes(prev => [data.qrCode, ...prev])
      setLabel('')
      setFields(buildDefaultFields(type))
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
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-2">Tipo di QR Code</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {(Object.keys(TYPE_INFO) as QRCodeType[]).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-colors ${
                  type === t
                    ? 'bg-[#3A9DBC]/20 border-[#3A9DBC] text-[#3A9DBC]'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                }`}
              >
                <span className="text-xl">{TYPE_INFO[t].icon}</span>
                {TYPE_INFO[t].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/35 mt-2 italic">{info.description}</p>
        </div>

        {/* Label */}
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1">Etichetta QR (identificativo visivo)</label>
          <p className="text-xs text-white/30 mb-1.5">Nome descrittivo per riconoscere questo QR nell'elenco (es. "Stazione A", "Indizio bosco")</p>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="es. Stazione A"
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* Dynamic fields per type */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Contenuto del QR</p>
          {info.fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-white/60 mb-1">
                {f.label}{f.optional && <span className="text-white/30 ml-1">(opzionale)</span>}
              </label>
              <p className="text-xs text-white/30 mb-1.5">{f.hint}</p>
              {f.type === 'select' ? (
                <select
                  value={String(fields[f.key] ?? f.defaultValue)}
                  onChange={e => setField(f.key, e.target.value)}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
                >
                  {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={String(fields[f.key] ?? '')}
                  onChange={e => setField(f.key, e.target.value)}
                  rows={3}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm resize-none"
                />
              ) : (
                <input
                  type={f.type}
                  value={fields[f.key] ?? f.defaultValue}
                  onChange={e => setField(f.key, f.type === 'number' ? +e.target.value : e.target.value)}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {/* Uses remaining */}
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1">Numero di utilizzi massimi</label>
          <p className="text-xs text-white/30 mb-1.5">Lascia vuoto per utilizzi illimitati. Utile per QR esclusivi (es. 1 solo uso).</p>
          <input type="number" placeholder="∞ illimitati"
            value={usesRemaining ?? ''}
            onChange={e => setUsesRemaining(e.target.value ? +e.target.value : null)}
            className="w-40 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>}

        <button onClick={createQR} disabled={creating || !selectedId}
          className="w-full bg-[#E85D2F] text-white font-bold py-2.5 rounded-lg disabled:opacity-50">
          {creating ? 'Creazione...' : `${info.icon} Crea QR — ${info.label}`}
        </button>
      </div>

      {/* QR list */}
      <div className="space-y-2">
        {qrCodes.length === 0 && (
          <p className="text-white/30 text-sm">Nessun QR code creato per questa sessione.</p>
        )}
        {qrCodes.map(qr => (
          <div key={qr.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-2xl">{TYPE_INFO[qr.type as QRCodeType]?.icon ?? '📷'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">{qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || qr.type}</p>
              <p className="text-xs text-white/40 font-mono truncate">{qr.id}</p>
              <p className="text-xs text-white/40">
                {qr.uses_remaining === null ? '∞ usi illimitati' : `${qr.uses_remaining} usi rimanenti`}
              </p>
            </div>
            <button onClick={() => downloadQR(qr.id, qr.label)}
              className="bg-[#3A9DBC] text-white px-3 py-1.5 rounded-lg text-sm shrink-0">
              ⬇ PNG
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
