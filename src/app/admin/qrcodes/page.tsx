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

function IconEye({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16" />
    </svg>
  )
}

function IconShare({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l8-5M8 12l8 5M6 13.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm12-6a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    </svg>
  )
}

function IconEdit({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconTrash({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-1 0v14H9V6" />
    </svg>
  )
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
}

function payloadToFields(type: QRCodeType, payload: any): Fields {
  const p = payload ?? {}
  switch (type) {
    case 'oggetto':
      return { item_id: String(p.item_id ?? ''), quantity: asNumber(p.quantity, 1) }
    case 'indizio':
      return {
        chapter_order: asNumber(p.chapter_order, 1),
        text: String(p.text ?? ''),
        image_url: String(p.image_url ?? ''),
      }
    case 'uovo':
      return { egg_rarity: String(p.egg_rarity ?? 'comune') }
    case 'boss':
      return {
        creature_id: String(p.creature_id ?? ''),
        level_override: asNumber(p.level_override, 10),
      }
    case 'evento':
      return {
        event_type: String(p.event_type ?? 'bonus_exp'),
        multiplier: asNumber(p.effect?.multiplier, 2),
        duration_minutes: asNumber(p.effect?.duration_minutes, 10),
      }
  }
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'bonus_exp': return 'Moltiplicatore EXP'
    case 'spawn_rate_boost': return 'Aumento spawn creature'
    case 'double_gold': return 'Oro raddoppiato'
    default: return eventType
  }
}

function getQrDescription(qr: any, items: any[], creatures: any[]): string {
  const payload = qr.payload ?? {}
  switch (qr.type as QRCodeType) {
    case 'oggetto': {
      const item = items.find(i => i.id === payload.item_id)
      const itemName = item?.name ?? 'Oggetto sconosciuto'
      const qty = asNumber(payload.quantity, 1)
      return `${itemName} ×${qty}`
    }
    case 'indizio': {
      const chapter = asNumber(payload.chapter_order, 1)
      const text = String(payload.text ?? '').trim()
      return text ? `Capitolo ${chapter}: ${text}` : `Indizio capitolo ${chapter}`
    }
    case 'uovo':
      return `Uovo rarità ${String(payload.egg_rarity ?? 'comune')}`
    case 'boss': {
      const creature = creatures.find(c => c.id === payload.creature_id)
      const creatureName = creature?.name ?? 'Creatura sconosciuta'
      const level = asNumber(payload.level_override, 10)
      return `${creatureName} livello ${level}`
    }
    case 'evento': {
      const eventType = getEventTypeLabel(String(payload.event_type ?? 'bonus_exp'))
      const multiplier = asNumber(payload.effect?.multiplier, 2)
      const minutes = asNumber(payload.effect?.duration_minutes, 10)
      return `${eventType} ×${multiplier} per ${minutes} min`
    }
    default:
      return TYPE_INFO[qr.type as QRCodeType]?.description ?? 'QR speciale'
  }
}

function getQrDetails(qr: any, items: any[], creatures: any[]) {
  const payload = qr.payload ?? {}
  const details: { label: string; value: string }[] = [
    { label: 'Etichetta', value: qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || 'QR' },
    { label: 'Tipo', value: TYPE_INFO[qr.type as QRCodeType]?.label ?? qr.type },
    { label: 'Descrizione', value: getQrDescription(qr, items, creatures) },
    {
      label: 'Utilizzi',
      value: qr.uses_remaining === null
        ? 'Illimitati'
        : qr.uses_remaining === 0
          ? 'Esaurito'
          : `${qr.uses_remaining} rimanenti`,
    },
    { label: 'Creato il', value: formatDateTime(qr.created_at) },
  ]

  switch (qr.type as QRCodeType) {
    case 'indizio':
      if (payload.image_url) details.push({ label: 'Immagine', value: 'Presente' })
      break
    case 'uovo':
      if (payload.egg_rarity) details.push({ label: 'Rarità', value: String(payload.egg_rarity) })
      break
    case 'evento':
      details.push({ label: 'Evento', value: getEventTypeLabel(String(payload.event_type ?? 'bonus_exp')) })
      break
    default:
      break
  }

  return details
}

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
function QRModal({
  qr, details, onClose, onDownload, onShare,
}: {
  qr: any
  details: { label: string; value: string }[]
  onClose: () => void
  onDownload: () => void
  onShare: () => void
}) {
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
        className="relative bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
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
        <div className="space-y-2 mb-4">
          {details.map(detail => (
            <div key={detail.label} className="flex justify-between items-start gap-4 text-xs">
              <span className="text-white/40 shrink-0">{detail.label}</span>
              <span className="text-white/75 text-right leading-relaxed">{detail.value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onShare}
            aria-label="Condividi QR"
            title="Condividi"
            className="inline-flex items-center justify-center bg-white/10 text-white w-full h-10 rounded-xl hover:bg-white/15 transition-colors"
          >
            <IconShare />
          </button>
          <button
            onClick={onDownload}
            aria-label="Scarica QR PNG"
            title="Scarica PNG"
            className="inline-flex items-center justify-center bg-[#3A9DBC] text-white w-full h-10 rounded-xl hover:brightness-110 transition-all"
          >
            <IconDownload />
          </button>
        </div>
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
  const [editingQrId, setEditingQrId]   = useState<string | null>(null)

  // Reference data for selects
  const [creatures, setCreatures]       = useState<any[]>([])
  const [items, setItems]               = useState<any[]>([])

  const [type, setType]                 = useState<QRCodeType>('oggetto')
  const [label, setLabel]               = useState('')
  const [fields, setFields]             = useState<Fields>(defaultFields('oggetto'))
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null)
  const [creating, setCreating]         = useState(false)
  const [error, setError]               = useState('')
  const [actionMsg, setActionMsg]       = useState<{ ok: boolean; text: string } | null>(null)
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

  function clearEditor(nextType: QRCodeType = type) {
    setEditingQrId(null)
    setType(nextType)
    setLabel('')
    setFields(defaultFields(nextType))
    setUsesRemaining(null)
    setError('')
  }

  function startEditing(qr: any) {
    const qrType = qr.type as QRCodeType
    setEditingQrId(qr.id)
    setType(qrType)
    setLabel(String(qr.label ?? ''))
    setUsesRemaining(typeof qr.uses_remaining === 'number' ? qr.uses_remaining : null)
    setFields(payloadToFields(qrType, qr.payload ?? {}))
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveQR() {
    setError('')
    setCreating(true)
    const isEditing = !!editingQrId
    const res = await fetch('/api/admin/qrcodes', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isEditing
          ? { qrId: editingQrId, type, payload: buildPayload(type, fields), usesRemaining, label }
          : { sessionId: selectedId, type, payload: buildPayload(type, fields), usesRemaining, label },
      ),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      if (isEditing) {
        setQrCodes(prev => prev.map(qr => (qr.id === editingQrId ? data.qrCode : qr)))
        setActionMsg({ ok: true, text: 'QR aggiornato correttamente' })
      } else {
        setQrCodes(prev => [data.qrCode, ...prev])
        setActionMsg({ ok: true, text: 'QR creato correttamente' })
      }
      clearEditor(type)
      setTimeout(() => setActionMsg(null), 2400)
    } else {
      setError(data.error ?? (isEditing ? 'Errore nel salvataggio' : 'Errore nella creazione'))
    }
  }

  async function deleteQR(qr: any) {
    const ok = window.confirm(`Eliminare definitivamente il QR "${qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || 'senza etichetta'}"?`)
    if (!ok) return

    const res = await fetch('/api/admin/qrcodes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrId: qr.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      setActionMsg({ ok: false, text: data.error ?? 'Eliminazione non riuscita' })
      setTimeout(() => setActionMsg(null), 2400)
      return
    }

    setQrCodes(prev => prev.filter(row => row.id !== qr.id))
    if (previewQr?.id === qr.id) setPreviewQr(null)
    if (editingQrId === qr.id) clearEditor(type)
    setActionMsg({ ok: true, text: 'QR eliminato' })
    setTimeout(() => setActionMsg(null), 2400)
  }

  function getQrActionLabel(qr: any) {
    return qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || 'QR'
  }

  function getQrDescriptionForUi(qr: any) {
    return getQrDescription(qr, items, creatures)
  }

  function getPreviewDetails(qr: any) {
    return getQrDetails(qr, items, creatures)
  }

  function getShareText(qr: any) {
    const title = getQrActionLabel(qr)
    const description = getQrDescriptionForUi(qr)
    return `${title}\n${description}`
  }

  function getDownloadName(qrId: string, qrLabel: string) {
    const safeLabel = qrLabel?.trim() ? qrLabel.trim() : qrId
    return `qr_${safeLabel}`.replace(/\s+/g, '_')
  }

  async function handleShare(qr: any) {
    const title = getQrActionLabel(qr)
    const text = getShareText(qr)
    try {
      if (navigator.share) {
        await navigator.share({ title, text })
        setActionMsg({ ok: true, text: 'QR condiviso' })
      } else {
        const copied = await copyText(text)
        setActionMsg({ ok: copied, text: copied ? 'Condivisione non disponibile: descrizione copiata' : 'Condivisione non riuscita' })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setActionMsg({ ok: false, text: 'Condivisione non riuscita' })
    } finally {
      setTimeout(() => setActionMsg(null), 2600)
    }
  }

  async function downloadQR(qrId: string, qrLabel: string) {
    const QRCode = await import('qrcode')
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrId, { width: 300 })
    const link = document.createElement('a')
    link.download = `${getDownloadName(qrId, qrLabel)}.png`
    link.href = canvas.toDataURL()
    link.click()
    setActionMsg({ ok: true, text: 'QR scaricato in PNG' })
    setTimeout(() => setActionMsg(null), 2400)
  }

  async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }

  // Build select options
  const creatureOptions = creatures.map(c => ({ value: c.id, label: c.name, sub: `${c.rarity} · ${c.element}` }))
  const itemOptions     = items.map(i => ({ value: i.id, label: i.name, sub: i.type }))

  const info = TYPE_INFO[type]

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">📷 QR Codes</h1>
      {actionMsg && (
        <p className={`mb-4 text-sm rounded-lg px-3 py-2 border ${
          actionMsg.ok
            ? 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
            : 'text-red-400 bg-red-400/10 border-red-400/30'
        }`}>
          {actionMsg.text}
        </p>
      )}

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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-white">
            {editingQrId ? 'Modifica QR Code' : 'Crea nuovo QR Code'}
          </h2>
          {editingQrId && (
            <button
              onClick={() => clearEditor(type)}
              className="text-xs bg-white/10 text-white/80 px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              Annulla modifica
            </button>
          )}
        </div>

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

        <button onClick={saveQR} disabled={creating || !selectedId}
          className="w-full bg-[#E85D2F] text-white font-bold py-2.5 rounded-lg disabled:opacity-50">
          {creating
            ? (editingQrId ? 'Salvataggio...' : 'Creazione...')
            : (editingQrId ? `💾 Salva modifiche — ${info.label}` : `${info.icon} Crea QR — ${info.label}`)}
        </button>
      </div>

      {/* QR list */}
      <div className="space-y-2">
        {qrCodes.length === 0 && <p className="text-white/30 text-sm">Nessun QR code per questa sessione.</p>}
        {qrCodes.map(qr => {
          const description = getQrDescriptionForUi(qr)
          return (
            <div
              key={qr.id}
              onClick={() => setPreviewQr(qr)}
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer hover:bg-white/8 transition-colors"
              title="Apri anteprima QR"
            >
              <span className="text-2xl">{TYPE_INFO[qr.type as QRCodeType]?.icon ?? '📷'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold">{getQrActionLabel(qr)}</p>
                <p className="text-xs text-white/45 truncate">{description}</p>
                <p className="text-xs text-white/40">{qr.uses_remaining === null ? '∞ usi illimitati' : `${qr.uses_remaining} usi rimanenti`}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewQr(qr) }}
                  aria-label="Apri preview QR"
                  title="Preview"
                  className="inline-flex items-center justify-center bg-white/10 text-white/80 w-9 h-9 rounded-lg hover:bg-white/15 transition-colors"
                >
                  <IconEye />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); startEditing(qr) }}
                  aria-label="Modifica QR"
                  title="Modifica"
                  className="inline-flex items-center justify-center bg-white/10 text-white/80 w-9 h-9 rounded-lg hover:bg-white/15 transition-colors"
                >
                  <IconEdit />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteQR(qr) }}
                  aria-label="Elimina QR"
                  title="Elimina"
                  className="inline-flex items-center justify-center bg-red-500/20 text-red-300 w-9 h-9 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {previewQr && (
        <QRModal
          qr={previewQr}
          details={getPreviewDetails(previewQr)}
          onClose={() => setPreviewQr(null)}
          onDownload={() => downloadQR(previewQr.id, previewQr.label)}
          onShare={() => handleShare(previewQr)}
        />
      )}
    </div>
  )
}

