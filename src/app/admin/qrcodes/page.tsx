'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageInput } from '@/components/admin/ImageInput'
import { AdminInlineSpinner, AdminListSkeleton } from '@/components/admin/AdminLoading'
import type { QRCodeType } from '@/lib/types'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'

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
const TYPE_INFO: Record<QRCodeType, { label: string; icon: string; description: string; color?: string }> = {
  oggetto:  { label: 'Oggetto',           icon: '🎁', description: 'Il giocatore ottiene un oggetto nello zaino.' },
  indizio:  { label: 'Indizio',           icon: '🔍', description: 'Il giocatore riceve un testo/immagine narrativo.' },
  uovo:     { label: 'Uovo',              icon: '🥚', description: 'Il giocatore ottiene un uovo da incubare e schiudere.' },
  boss:     { label: 'Capo Palestra',     icon: '👑', description: 'Avvia uno scontro speciale 3v3 contro il Capo Palestra.', color: '#F7C841' },
  evento:   { label: 'Evento speciale',   icon: '⚡', description: 'Attiva un bonus temporaneo per il giocatore.' },
  creatura: { label: 'Creatura',          icon: '🐾', description: 'Il giocatore riceve direttamente una creatura nella sua collezione.', color: '#C084FC' },
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

/* ── Default payload fields per type ─────────── */
type Fields = Record<string, string | number>

function defaultFields(t: QRCodeType): Fields {
  switch (t) {
    case 'oggetto': return { item_id: '', quantity: 1 }
    case 'indizio': return { chapter_order: 1, text: '', image_url: '' }
    case 'uovo':    return { egg_rarity: 'comune', steps_required: 0 }
    case 'boss':    return {
      boss_c1: '', boss_lv1: 10,
      boss_c2: '', boss_lv2: 10,
      boss_c3: '', boss_lv3: 10,
      reward_gold: 200, reward_exp: 100,
    }
    case 'evento':  return { event_type: 'bonus_exp', multiplier: 2, duration_minutes: 10 }
    case 'creatura': return { creature_id: '' }
  }
}

function payloadToFields(type: QRCodeType, payload: any): Fields {
  const p = payload ?? {}
  switch (type) {
    case 'oggetto':
      return { item_id: String(p.item_id ?? ''), quantity: asNumber(p.quantity, 1) }
    case 'indizio':
      return { chapter_order: asNumber(p.chapter_order, 1), text: String(p.text ?? ''), image_url: String(p.image_url ?? '') }
    case 'uovo':
      return { egg_rarity: String(p.egg_rarity ?? 'comune'), steps_required: asNumber(p.steps_required, 0) }
    case 'boss': {
      // Support both legacy {creature_id, level_override} and new {creatures:[...]}
      const creatures: any[] = Array.isArray(p.creatures)
        ? p.creatures
        : p.creature_id ? [{ creature_id: p.creature_id, level_override: p.level_override }] : []
      return {
        boss_c1: creatures[0]?.creature_id ?? '',
        boss_lv1: asNumber(creatures[0]?.level_override, 10),
        boss_c2: creatures[1]?.creature_id ?? '',
        boss_lv2: asNumber(creatures[1]?.level_override, 10),
        boss_c3: creatures[2]?.creature_id ?? '',
        boss_lv3: asNumber(creatures[2]?.level_override, 10),
        reward_gold: asNumber(p.reward?.gold, 200),
        reward_exp: asNumber(p.reward?.exp, 100),
      }
    }
    case 'evento':
      return { event_type: String(p.event_type ?? 'bonus_exp'), multiplier: asNumber(p.effect?.multiplier, 2), duration_minutes: asNumber(p.effect?.duration_minutes, 10) }
    case 'creatura':
      return { creature_id: String(p.creature_id ?? '') }
  }
}

function buildPayload(t: QRCodeType, f: Fields): any {
  switch (t) {
    case 'oggetto': return { item_id: f.item_id, quantity: Number(f.quantity) }
    case 'indizio': return { chapter_order: Number(f.chapter_order), text: f.text, image_url: f.image_url || null }
    case 'uovo':    return { egg_rarity: f.egg_rarity, steps_required: Number(f.steps_required ?? 0) }
    case 'boss': {
      const creatures = [
        { creature_id: f.boss_c1, level_override: Number(f.boss_lv1) },
        { creature_id: f.boss_c2, level_override: Number(f.boss_lv2) },
        { creature_id: f.boss_c3, level_override: Number(f.boss_lv3) },
      ].filter(c => c.creature_id)
      return {
        creatures,
        reward: { gold: Number(f.reward_gold), exp: Number(f.reward_exp) },
      }
    }
    case 'evento':   return { event_type: f.event_type, effect: { multiplier: Number(f.multiplier), duration_minutes: Number(f.duration_minutes) } }
    case 'creatura': return { creature_id: f.creature_id }
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
      return `${item?.name ?? 'Oggetto'} ×${asNumber(payload.quantity, 1)}`
    }
    case 'indizio': {
      const text = String(payload.text ?? '').trim()
      return text ? `Cap. ${asNumber(payload.chapter_order, 1)}: ${text.slice(0, 50)}` : `Indizio capitolo ${asNumber(payload.chapter_order, 1)}`
    }
    case 'uovo':
      return `Uovo ${String(payload.egg_rarity ?? 'comune')}${payload.steps_required > 0 ? ` · ${payload.steps_required} passi` : ' · immediato'}`
    case 'boss': {
      const creatureList: any[] = Array.isArray(payload.creatures)
        ? payload.creatures
        : payload.creature_id ? [{ creature_id: payload.creature_id }] : []
      const names = creatureList
        .map(e => creatures.find(c => c.id === e.creature_id)?.name ?? '?')
        .filter(Boolean)
        .join(', ')
      return names ? `Squadra: ${names}` : 'Boss non configurato'
    }
    case 'evento': {
      return `${getEventTypeLabel(String(payload.event_type ?? 'bonus_exp'))} ×${asNumber(payload.effect?.multiplier, 2)} · ${asNumber(payload.effect?.duration_minutes, 10)} min`
    }
    case 'creatura': {
      const c = creatures.find(cr => cr.id === payload.creature_id)
      return c ? `${c.name} (${c.rarity})` : 'Creatura non selezionata'
    }
    default:
      return TYPE_INFO[qr.type as QRCodeType]?.description ?? 'QR speciale'
  }
}

function getQrDetails(qr: any, items: any[], creatures: any[], sessions: any[]) {
  const payload = qr.payload ?? {}
  const sessionName = sessions.find(s => s.id === qr.session_id)?.name
  const details: { label: string; value: string }[] = [
    { label: 'Etichetta', value: qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || 'QR' },
    { label: 'Tipo', value: TYPE_INFO[qr.type as QRCodeType]?.label ?? qr.type },
    { label: 'Sessione', value: sessionName ? `🎯 ${sessionName}` : '🌐 Tutte le sessioni' },
    { label: 'Descrizione', value: getQrDescription(qr, items, creatures) },
    {
      label: 'Utilizzi',
      value: qr.uses_remaining === null ? 'Illimitati' : qr.uses_remaining === 0 ? 'Esaurito' : `${qr.uses_remaining} rimanenti`,
    },
    { label: 'Riscatto', value: qr.unique_per_user ? '🔒 1 per utente' : '♾ Multiplo' },
    { label: 'Creato il', value: formatDateTime(qr.created_at) },
  ]

  if (qr.type === 'boss') {
    const reward = payload.reward
    if (reward) details.push({ label: 'Ricompensa vittoria', value: `💰 ${reward.gold} oro · ✨ ${reward.exp} EXP` })
  }

  return details
}

/* ── Copyable code ───────────────────────────── */
function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="mb-4">
      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1.5">Codice alternativo</p>
      <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
        <code className="flex-1 text-[11px] text-[#3A9DBC] font-mono break-all leading-relaxed">{code}</code>
        <button
          onClick={copy}
          className="shrink-0 text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
          style={{ background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(58,157,188,0.12)', color: copied ? '#34D399' : '#3A9DBC', border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(58,157,188,0.25)'}` }}
        >
          {copied ? '✓' : 'Copia'}
        </button>
      </div>
    </div>
  )
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
  const isBoss = qr.type === 'boss'

  useEffect(() => {
    if (!canvasRef.current) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, qr.id, {
        width: 220, margin: 2,
        color: { dark: '#0F1F2E', light: '#ffffff' },
      })
    })
  }, [qr.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className={`relative bg-[#0d1e2e] border rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto ${isBoss ? 'border-[#F7C841]/40' : 'border-white/20'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{info?.icon ?? '📷'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{qr.label || info?.label || qr.type}</p>
            <p className="text-xs text-white/40">{info?.description}</p>
          </div>
          {qr.unique_per_user && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">🔒 1/utente</span>
          )}
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none ml-1">✕</button>
        </div>

        <div className="flex justify-center bg-white rounded-xl p-3 mb-4">
          <canvas ref={canvasRef} />
        </div>

        {/* Short manual fallback code */}
        {qr.manual_code && <CopyableCode code={qr.manual_code} />}

        <div className="space-y-2 mb-4">
          {details.map(detail => (
            <div key={detail.label} className="flex justify-between items-start gap-4 text-xs">
              <span className="text-white/40 shrink-0">{detail.label}</span>
              <span className="text-white/75 text-right leading-relaxed">{detail.value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onShare} className="inline-flex items-center justify-center bg-white/10 text-white w-full h-10 rounded-xl hover:bg-white/15 transition-colors">
            <IconShare />
          </button>
          <button onClick={onDownload} className="inline-flex items-center justify-center bg-[#3A9DBC] text-white w-full h-10 rounded-xl hover:brightness-110 transition-all">
            <IconDownload />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────── */
export default function QRCodesPage() {
  const [sessions, setSessions]               = useState<any[]>([])
  const [selectedId, setSelectedId]           = useState('all')
  const [qrCodes, setQrCodes]                 = useState<any[]>([])
  const [previewQr, setPreviewQr]             = useState<any | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingQrCodes, setLoadingQrCodes]   = useState(false)
  const [editorOpen, setEditorOpen]           = useState(false)
  const [editingQrId, setEditingQrId]         = useState<string | null>(null)

  const [creatures, setCreatures] = useState<any[]>([])
  const [items, setItems]         = useState<any[]>([])

  const [type, setType]               = useState<QRCodeType>('oggetto')
  const [label, setLabel]             = useState('')
  const [fields, setFields]           = useState<Fields>(defaultFields('oggetto'))
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null)
  // scope: '' = current session, 'global' = all sessions
  const [scopeSessionId, setScopeSessionId] = useState<string>('')
  const [uniquePerUser, setUniquePerUser]   = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [creating, setCreating]     = useState(false)
  const [error, setError]           = useState('') // form-level validation errors (inline)
  const { toast, showSuccess, showError: showToastError, dismiss } = useGameToast()
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })
      .then(() => setLoadingSessions(false), () => setLoadingSessions(false))
    fetch('/api/admin/creatures').then(r => r.json()).then(d => setCreatures(d.creatures ?? []))
    fetch('/api/admin/items').then(r => r.json()).then(d => setItems(d.items ?? []))
  }, [supabase])

  useEffect(() => {
    setLoadingQrCodes(true)
    const qs = selectedId !== 'all' ? `?sessionId=${selectedId}` : '?sessionId=all'
    fetch(`/api/admin/qrcodes${qs}`)
      .then(r => r.json()).then(d => setQrCodes(d.qrCodes ?? []))
      .finally(() => setLoadingQrCodes(false))
  }, [selectedId])

  function handleTypeChange(t: QRCodeType) {
    setType(t)
    setFields(defaultFields(t))
    setError('')
    // Boss: default to 1 per user, but admin can override
    setUniquePerUser(t === 'boss')
  }

  function setField(key: string, val: string | number) {
    setFields(prev => ({ ...prev, [key]: val }))
  }

  function openNewEditor() {
    setEditingQrId(null)
    setType('oggetto')
    setLabel('')
    setFields(defaultFields('oggetto'))
    setUsesRemaining(null)
    setScopeSessionId(selectedId !== 'all' ? selectedId : sessions[0]?.id ?? '')
    setUniquePerUser(false)
    setManualCode('')
    setError('')
    setEditorOpen(true)
  }

  function clearEditor() {
    setEditingQrId(null); setType('oggetto'); setLabel('')
    setFields(defaultFields('oggetto')); setUsesRemaining(null)
    setUniquePerUser(false); setManualCode(''); setError(''); setEditorOpen(false)
  }

  function startEditing(qr: any) {
    const qrType = qr.type as QRCodeType
    setPreviewQr(null)
    setEditingQrId(qr.id)
    setType(qrType)
    setLabel(String(qr.label ?? ''))
    setUsesRemaining(typeof qr.uses_remaining === 'number' ? qr.uses_remaining : null)
    setScopeSessionId(qr.session_id ?? '')
    setUniquePerUser(qr.unique_per_user ?? (qrType === 'boss'))
    setFields(payloadToFields(qrType, qr.payload ?? {}))
    setManualCode(String(qr.manual_code ?? ''))
    setError('')
    setEditorOpen(true)
  }

  async function saveQR() {
    setError(''); setCreating(true)
    const isEditing = !!editingQrId
    const body: Record<string, unknown> = {
      type,
      payload: buildPayload(type, fields),
      usesRemaining,
      label,
      uniquePerUser,
      sessionId: scopeSessionId || null,
      manualCode: manualCode.trim() || undefined,
    }
    if (isEditing) body.qrId = editingQrId

    const res = await fetch('/api/admin/qrcodes', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      if (isEditing) {
        setQrCodes(prev => prev.map(qr => qr.id === editingQrId ? data.qrCode : qr))
        showSuccess('QR aggiornato')
      } else {
        setQrCodes(prev => [data.qrCode, ...prev])
        showSuccess('QR creato')
      }
      clearEditor()
    } else {
      setError(data.error ?? (isEditing ? 'Errore nel salvataggio' : 'Errore nella creazione'))
    }
  }

  async function deleteQR(qr: any) {
    const ok = window.confirm(`Eliminare definitivamente il QR "${qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || 'senza etichetta'}"?`)
    if (!ok) return
    const res = await fetch('/api/admin/qrcodes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrId: qr.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToastError(data.error ?? 'Eliminazione non riuscita'); return
    }
    setQrCodes(prev => prev.filter(row => row.id !== qr.id))
    if (previewQr?.id === qr.id) setPreviewQr(null)
    if (editingQrId === qr.id) clearEditor()
    showSuccess('QR eliminato')
  }

  async function downloadQR(qrId: string, qrLabel: string) {
    const QRCode = await import('qrcode')
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrId, { width: 300 })
    const link = document.createElement('a')
    link.download = `qr_${(qrLabel || qrId).replace(/\s+/g, '_')}.png`
    link.href = canvas.toDataURL(); link.click()
    showSuccess('QR scaricato in PNG')
  }

  async function handleShare(qr: any) {
    const title = qr.label || TYPE_INFO[qr.type as QRCodeType]?.label || 'QR'
    const text = getQrDescription(qr, items, creatures)
    try {
      if (navigator.share) { await navigator.share({ title, text }) }
      else {
        const ok = await copyText(text)
        if (ok) showSuccess('Testo copiato'); else showToastError('Condivisione non riuscita')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  async function copyText(text: string) {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
    const ta = document.createElement('textarea')
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta); return ok
  }

  const creatureOptions = creatures.map(c => ({ value: c.id, label: c.name, sub: `${c.rarity} · ${c.element}` }))
  const itemOptions     = items.map(i => ({ value: i.id, label: i.name, sub: i.type }))
  const info = TYPE_INFO[type]
  const isBossType = type === 'boss'

  const sessionName = (sid: string | null) => sessions.find(s => s.id === sid)?.name ?? null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">📷 QR Codes</h1>
        <button onClick={openNewEditor}
          className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm">
          + Nuovo QR Code
        </button>
      </div>

      <GameToast toast={toast} onDismiss={dismiss} />

      {/* Session selector — includes "all sessions" option */}
      <div className="mb-4">
        <label className="block text-xs text-white/50 mb-1">Visualizza sessione</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          disabled={loadingSessions}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 disabled:opacity-50">
          <option value="all">📋 Tutte le sessioni</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {loadingSessions && <div className="mt-2"><AdminInlineSpinner label="Caricamento sessioni..." /></div>}
      </div>

      {/* Search + type filter */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cerca per etichetta, descrizione…"
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/30 outline-none focus:border-[#3A9DBC]/60"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tutti i tipi</option>
          {(Object.entries(TYPE_INFO) as [QRCodeType, typeof TYPE_INFO[QRCodeType]][]).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>

      {/* QR list */}
      <div className="space-y-2">
        {loadingQrCodes && qrCodes.length === 0 && <AdminListSkeleton rows={5} itemClassName="h-[78px]" />}
        {!loadingQrCodes && qrCodes.length === 0 && (
          <p className="text-white/30 text-sm">Nessun QR code trovato.</p>
        )}
        {qrCodes.filter(qr => {
          if (filterType && qr.type !== filterType) return false
          if (!search.trim()) return true
          const q = search.toLowerCase()
          const description = getQrDescription(qr, items, creatures)
          return (
            (qr.label ?? '').toLowerCase().includes(q) ||
            description.toLowerCase().includes(q) ||
            (qr.manual_code ?? '').toLowerCase().includes(q)
          )
        }).map(qr => {
          const typeInfo = TYPE_INFO[qr.type as QRCodeType]
          const description = getQrDescription(qr, items, creatures)
          const isBoss = qr.type === 'boss'
          const sname = sessionName(qr.session_id)
          return (
            <div key={qr.id}
              onClick={() => setPreviewQr(qr)}
              className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer hover:bg-white/8 transition-colors ${
                isBoss
                  ? 'bg-[#F7C841]/5 border-[#F7C841]/25 hover:bg-[#F7C841]/8'
                  : 'bg-white/5 border-white/10'
              }`}>
              <span className="text-2xl shrink-0">{typeInfo?.icon ?? '📷'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`text-sm font-bold ${isBoss ? 'text-[#F7C841]' : 'text-white'}`}>
                    {qr.label || typeInfo?.label || qr.type}
                  </p>
                  {qr.unique_per_user && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold">🔒 1/utente</span>
                  )}
                  {sname && selectedId === 'all' && (
                    <span className="text-[10px] bg-[#3A9DBC]/15 text-[#3A9DBC]/80 border border-[#3A9DBC]/20 px-1.5 py-0.5 rounded-full">🎯 {sname}</span>
                  )}
                  {!qr.session_id && (
                    <span className="text-[10px] bg-white/8 text-white/40 border border-white/10 px-1.5 py-0.5 rounded-full">🌐 Globale</span>
                  )}
                </div>
                <p className="text-xs text-white/45 truncate mt-0.5">{description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-white/30">
                    {qr.uses_remaining === null ? '∞ illimitati' : `${qr.uses_remaining} usi rimanenti`}
                  </span>
                  {qr.manual_code && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(58,157,188,0.12)', color: '#3A9DBC', border: '1px solid rgba(58,157,188,0.25)' }}>
                      {qr.manual_code}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={e => { e.stopPropagation(); setPreviewQr(qr) }}
                  className="inline-flex items-center justify-center bg-white/10 text-white/80 w-9 h-9 rounded-lg hover:bg-white/15 transition-colors">
                  <IconEye />
                </button>
                <button onClick={e => { e.stopPropagation(); startEditing(qr) }}
                  className="inline-flex items-center justify-center bg-white/10 text-white/80 w-9 h-9 rounded-lg hover:bg-white/15 transition-colors">
                  <IconEdit />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteQR(qr) }}
                  className="inline-flex items-center justify-center bg-red-500/20 text-red-300 w-9 h-9 rounded-lg hover:bg-red-500/30 transition-colors">
                  <IconTrash />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) clearEditor() }}>
          <div className={`bg-[#0d1e2e] border rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto ${isBossType ? 'border-[#F7C841]/30' : 'border-white/20'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {editingQrId ? '✏️ Modifica QR Code' : '+ Nuovo QR Code'}
              </h2>
              <button onClick={clearEditor} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              {/* Type selector */}
              <Field label="Tipo di QR Code">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
                  {(Object.keys(TYPE_INFO) as QRCodeType[]).map(t => (
                    <button key={t} onClick={() => handleTypeChange(t)}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-colors ${
                        type === t
                          ? t === 'boss'
                            ? 'bg-[#F7C841]/20 border-[#F7C841] text-[#F7C841]'
                            : 'bg-[#3A9DBC]/20 border-[#3A9DBC] text-[#3A9DBC]'
                          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                      }`}>
                      <span className="text-xl">{TYPE_INFO[t].icon}</span>
                      {TYPE_INFO[t].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/35 mt-2 italic">{info.description}</p>
              </Field>

              {/* Boss banner */}
              {isBossType && (
                <div className="bg-[#F7C841]/8 border border-[#F7C841]/25 rounded-xl px-4 py-3">
                  <p className="text-[#F7C841] text-xs font-semibold">👑 QR Capo Palestra</p>
                  <p className="text-white/50 text-xs mt-1 leading-relaxed">
                    Configura la squadra del boss (fino a 3 creature) e la ricompensa per i giocatori che la sconfiggono.
                  </p>
                </div>
              )}

              {/* Label */}
              <Field label="Etichetta QR" hint="Nome visivo per riconoscerlo nell'elenco (es. 'Stazione A', 'Capo Palestra Arena')">
                <input value={label} onChange={e => setLabel(e.target.value)}
                  placeholder={isBossType ? 'es. Capo Palestra — Arena Sud' : 'es. Stazione A'}
                  className={cls} autoFocus />
              </Field>

              {/* Manual fallback code */}
              <Field label="Codice manuale (piano B)" hint="Massimo 6 caratteri — usato dai giocatori se il QR non si scansiona. Lascia vuoto per generarlo in automatico.">
                <div className="flex items-center gap-2">
                  <input
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="es. BOSS01"
                    maxLength={6}
                    className="w-36 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase"
                  />
                  {editingQrId && manualCode && (
                    <span className="text-xs text-white/40 font-mono">{manualCode.length}/6</span>
                  )}
                  {!editingQrId && (
                    <span className="text-xs text-white/30 italic">{manualCode ? `${manualCode.length}/6` : 'auto-generato'}</span>
                  )}
                </div>
              </Field>

              {/* Dynamic fields per type */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Contenuto del QR</p>

                {type === 'oggetto' && (
                  <>
                    <Field label="Oggetto da consegnare" hint="Seleziona l'oggetto che il giocatore riceverà">
                      <SearchSelect options={itemOptions} value={String(fields.item_id)} onChange={v => setField('item_id', v)} placeholder="Seleziona oggetto..." />
                    </Field>
                    <Field label="Quantità">
                      <input type="number" value={fields.quantity} min={1} onChange={e => setField('quantity', +e.target.value)} className={cls} />
                    </Field>
                  </>
                )}

                {type === 'indizio' && (
                  <>
                    <Field label="Capitolo di riferimento" hint="A quale missione/capitolo appartiene questo indizio">
                      <input type="number" value={fields.chapter_order} min={1} onChange={e => setField('chapter_order', +e.target.value)} className={cls} />
                    </Field>
                    <Field label="Testo dell'indizio">
                      <textarea value={String(fields.text)} onChange={e => setField('text', e.target.value)}
                        rows={3} className={cls + ' resize-none'} placeholder="es. Il segreto si nasconde tra le rovine al tramonto..." />
                    </Field>
                    <ImageInput label="Immagine (opzionale)" hint="Mostrata insieme al testo"
                      value={String(fields.image_url)} onChange={v => setField('image_url', v)} optional />
                  </>
                )}

                {type === 'uovo' && (
                  <>
                    <Field label="Rarità dell'uovo" hint="Determina il pool di creature ottenibili dalla schiusura">
                      <select value={String(fields.egg_rarity)} onChange={e => setField('egg_rarity', e.target.value)} className={cls}>
                        <option value="comune">⚪ Terrestre</option>
                        <option value="non_comune">🟢 Arcaico</option>
                        <option value="raro">🔵 Eroico</option>
                        <option value="epico">🟣 Mostruoso</option>
                        <option value="leggendario">🟡 Leggendario</option>
                        <option value="mitologico">🌌 Mitologico</option>
                      </select>
                    </Field>
                    <Field label="Passi di incubazione" hint="Quanti passi il giocatore deve percorrere dal ritiro dell'uovo prima di poterlo schiudere. 0 = immediato.">
                      <input type="number" min={0} step={50} value={fields.steps_required ?? 0}
                        onChange={e => setField('steps_required', +e.target.value)} className={cls} />
                    </Field>
                  </>
                )}

                {type === 'boss' && (
                  <>
                    {/* 3 creature slots */}
                    {([1, 2, 3] as const).map(slot => (
                      <div key={slot} className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold text-[#F7C841]/70">Slot {slot}{slot === 1 ? ' (obbligatorio)' : ' (opzionale)'}</p>
                        <Field label="Creatura boss">
                          <SearchSelect
                            options={creatureOptions}
                            value={String(fields[`boss_c${slot}`])}
                            onChange={v => setField(`boss_c${slot}`, v)}
                            placeholder={slot === 1 ? 'Seleziona creatura…' : 'Vuoto = non usato'}
                          />
                        </Field>
                        <Field label="Livello" hint="Livello della creatura boss: influenza HP, ATK e DEF in battaglia">
                          <input type="number" value={fields[`boss_lv${slot}`]} min={1} max={50}
                            onChange={e => setField(`boss_lv${slot}`, +e.target.value)} className={cls} />
                        </Field>
                      </div>
                    ))}

                    {/* Reward */}
                    <div className="bg-[#34d399]/5 border border-[#34d399]/20 rounded-xl p-3">
                      <p className="text-xs font-semibold text-[#34d399]/70 mb-3">🏆 Ricompensa vittoria</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Oro 💰">
                          <input type="number" value={fields.reward_gold} min={0}
                            onChange={e => setField('reward_gold', +e.target.value)} className={cls} />
                        </Field>
                        <Field label="EXP ✨">
                          <input type="number" value={fields.reward_exp} min={0}
                            onChange={e => setField('reward_exp', +e.target.value)} className={cls} />
                        </Field>
                      </div>
                    </div>
                  </>
                )}

                {type === 'evento' && (
                  <>
                    <Field label="Tipo di bonus">
                      <select value={String(fields.event_type)} onChange={e => setField('event_type', e.target.value)} className={cls}>
                        <option value="bonus_exp">✨ Moltiplicatore EXP</option>
                        <option value="spawn_rate_boost">🐾 Aumento spawn creature</option>
                        <option value="double_gold">🪙 Oro raddoppiato</option>
                      </select>
                    </Field>
                    <Field label="Moltiplicatore" hint="es. 2 = doppio effetto, 3 = triplo">
                      <input type="number" value={fields.multiplier} min={1} step={0.5} onChange={e => setField('multiplier', +e.target.value)} className={cls} />
                    </Field>
                    <Field label="Durata (minuti)">
                      <input type="number" value={fields.duration_minutes} min={1} onChange={e => setField('duration_minutes', +e.target.value)} className={cls} />
                    </Field>
                  </>
                )}

                {type === 'creatura' && (
                  <Field label="Creatura" hint="La creatura verrà aggiunta alla collezione del giocatore (o incrementa i duplicati se già posseduta)">
                    <SearchSelect
                      options={creatures.map(c => ({ value: c.id, label: c.name, sub: `${c.rarity} · ${c.element}` }))}
                      value={String(fields.creature_id ?? '')}
                      onChange={v => setField('creature_id', v)}
                      placeholder="Cerca creatura…"
                    />
                  </Field>
                )}
              </div>

              {/* Scope & limits section */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Impostazioni</p>

                <Field label="Disponibile in" hint="Lascia vuoto per renderlo utilizzabile in tutte le sessioni">
                  <select className={cls} value={scopeSessionId}
                    onChange={e => setScopeSessionId(e.target.value)}>
                    <option value="">🌐 Tutte le sessioni</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>🎯 {s.name}</option>)}
                  </select>
                </Field>

                <Field label="Utilizzi massimi" hint="Lascia vuoto per utilizzi illimitati.">
                  <input type="number" placeholder="∞ illimitati" min={1}
                    value={usesRemaining ?? ''}
                    onChange={e => setUsesRemaining(e.target.value ? +e.target.value : null)}
                    className="w-40 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
                </Field>

                {/* unique_per_user toggle */}
                <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border ${
                  uniquePerUser
                    ? 'bg-amber-500/8 border-amber-500/25'
                    : 'bg-white/3 border-white/8'
                }`}>
                  <input
                    type="checkbox"
                    id="unique_per_user"
                    checked={uniquePerUser}
                    onChange={e => setUniquePerUser(e.target.checked)}
                    className="mt-0.5 accent-amber-400"
                  />
                  <label htmlFor="unique_per_user" className="text-sm cursor-pointer select-none">
                    <span className={`font-semibold ${uniquePerUser ? 'text-amber-400' : 'text-white/80'}`}>
                      🔒 Riscattabile 1 sola volta per utente
                    </span>
                    <p className="text-xs text-white/35 mt-0.5 leading-relaxed">
                      Ogni utente può scansionare questo QR una sola volta, indipendentemente dagli utilizzi totali.
                    </p>
                  </label>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={clearEditor}
                  className="flex-1 bg-white/5 border border-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-sm">
                  Annulla
                </button>
                <button onClick={saveQR} disabled={creating}
                  className={`flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 ${isBossType ? 'bg-[#F7C841] text-[#0d1e2e]' : 'bg-[#E85D2F] text-white'}`}>
                  {creating
                    ? (editingQrId ? 'Salvataggio...' : 'Creazione...')
                    : (editingQrId ? 'Salva modifiche' : 'Crea QR Code')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewQr && (
        <QRModal
          qr={previewQr}
          details={getQrDetails(previewQr, items, creatures, sessions)}
          onClose={() => setPreviewQr(null)}
          onDownload={() => downloadQR(previewQr.id, previewQr.label)}
          onShare={() => handleShare(previewQr)}
        />
      )}
    </div>
  )
}
