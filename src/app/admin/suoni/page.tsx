'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminInlineSpinner } from '@/components/admin/AdminLoading'

type Slot = 'map' | 'encounter' | 'duel' | 'boss' | 'intro'

interface Override {
  id: string
  session_id: string | null
  slot: Slot
  file_url: string
  file_name: string | null
  enabled: boolean
  updated_at: string
}

interface SessionRow { id: string; name: string }

const SLOT_META: Record<Slot, { label: string; icon: string; defaultDesc: string }> = {
  map:       { label: 'Suono mappa',         icon: '🗺️', defaultDesc: 'Default: ambient foresta sintetizzato (G major)' },
  encounter: { label: 'Suono incontri',      icon: '⚔️', defaultDesc: 'Default: battle loop D dorian sintetizzato' },
  duel:      { label: 'Suono duelli',        icon: '🥊', defaultDesc: 'Default: battle loop A minor sintetizzato' },
  boss:      { label: 'Scontro capopalestra', icon: '👑', defaultDesc: 'Default: battle loop D minor epico sintetizzato' },
  intro:     { label: 'Intro tutorial',      icon: '🎬', defaultDesc: 'Default: /audio/bgm.mp3 (BGM onboarding)' },
}

const SLOTS: Slot[] = ['map', 'encounter', 'duel', 'boss', 'intro']

/**
 * Admin page to manage audio overrides per slot. The selected scope ("global"
 * or a specific session) determines which row each slot card targets.
 *
 * Workflow per slot:
 *   1. Upload a file → POST /api/admin/upload → returns a Supabase public URL
 *   2. POST that URL to /api/admin/audio-overrides with the scope+slot
 *   3. The row is created (or replaced if one already existed for that scope)
 *
 * Toggle "Attivo": PATCH the row's `enabled` flag — playback falls back to the
 * default synth when disabled, no need to remove the file.
 *
 * "Rimuovi" deletes the row outright (uploaded files in storage are left as
 * orphans — same convention as /admin/items).
 */
export default function SuoniPage() {
  const supabase = useMemo(() => createClient(), [])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [scope, setScope] = useState<string>('global') // 'global' | <session_id>
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadAll() {
    setLoading(true)
    const { data: ss } = await supabase
      .from('sessions')
      .select('id, name')
      .order('created_at', { ascending: false })
    if (ss) setSessions(ss)

    const res = await fetch(`/api/admin/audio-overrides?sessionId=${encodeURIComponent(scope)}`)
    if (res.ok) {
      const d = await res.json()
      setOverrides(d.overrides ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  function bySlot(slot: Slot): Override | undefined {
    return overrides.find(o => o.slot === slot)
  }

  async function handleUpload(slot: Slot, file: File) {
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const upJson = await up.json()
    if (!up.ok) {
      setError(upJson.error ?? 'Errore upload')
      return
    }
    const res = await fetch('/api/admin/audio-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: scope === 'global' ? null : scope,
        slot,
        fileUrl: upJson.url,
        fileName: file.name,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Errore salvataggio')
      return
    }
    await loadAll()
  }

  async function handleToggle(o: Override) {
    const res = await fetch(`/api/admin/audio-overrides/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !o.enabled }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Errore aggiornamento')
      return
    }
    await loadAll()
  }

  async function handleRemove(o: Override) {
    if (!confirm(`Rimuovere l'override per "${SLOT_META[o.slot].label}"? Tornerà al suono default.`)) return
    const res = await fetch(`/api/admin/audio-overrides/${o.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Errore rimozione')
      return
    }
    await loadAll()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">🎵 Suoni del gioco</h1>
      <p className="text-white/50 text-sm mb-5">
        Per ogni slot puoi caricare un audio personalizzato (mp3/ogg/wav, max 10MB) che
        sostituirà il suono di default in loop. Rimuovendo l&apos;override (o disattivandolo)
        il gioco torna al suono di default.
      </p>

      <div className="mb-4 flex gap-2 items-center">
        <label className="text-xs text-white/60">Ambito:</label>
        <select
          value={scope}
          onChange={e => setScope(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value="global">🌐 Globale (tutte le sessioni)</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>📍 {s.name}</option>
          ))}
        </select>
      </div>

      <p className="text-[11px] text-white/40 mb-4 leading-snug">
        L&apos;override <strong>per sessione</strong> vince su quello <strong>globale</strong>.
        Se nessuno dei due è presente o entrambi sono disattivati, il gioco usa il default sintetizzato.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <AdminInlineSpinner label="Caricamento..." />
      ) : (
        <div className="space-y-3">
          {SLOTS.map(slot => {
            const o = bySlot(slot)
            return <SlotCard
              key={slot}
              slot={slot}
              override={o}
              onUpload={file => handleUpload(slot, file)}
              onToggle={() => o && handleToggle(o)}
              onRemove={() => o && handleRemove(o)}
            />
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SlotCard({
  slot, override, onUpload, onToggle, onRemove,
}: {
  slot: Slot
  override: Override | undefined
  onUpload: (f: File) => void | Promise<void>
  onToggle: () => void | Promise<void>
  onRemove: () => void | Promise<void>
}) {
  const meta = SLOT_META[slot]
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Local preview of the override file. Stored separately from the actual
  // playback engine — pure UI affordance to let the admin sanity-check what
  // they uploaded before pushing it live to players.
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [previewing, setPreviewing] = useState(false)

  function togglePreview() {
    if (!override) return
    if (!previewRef.current) {
      const a = new Audio(override.file_url)
      a.loop = false
      a.addEventListener('ended', () => setPreviewing(false))
      previewRef.current = a
    }
    if (previewing) {
      previewRef.current.pause()
      previewRef.current.currentTime = 0
      setPreviewing(false)
    } else {
      previewRef.current.play().then(() => setPreviewing(true)).catch(() => {})
    }
  }

  useEffect(() => () => {
    // Cleanup preview audio if the card unmounts mid-playback
    if (previewRef.current) {
      previewRef.current.pause()
      previewRef.current.src = ''
    }
  }, [])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    await onUpload(f)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const active = override?.enabled
  const hasOverride = !!override

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-sm flex items-center gap-2">
            <span className="text-base">{meta.icon}</span>
            {meta.label}
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">{meta.defaultDesc}</p>
        </div>
        {hasOverride && (
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            active
              ? 'text-[#34d399] border-[#34d399]/40 bg-[#34d399]/10'
              : 'text-white/40 border-white/15 bg-white/5'
          }`}>
            {active ? 'Attivo' : 'Disattivato'}
          </span>
        )}
      </div>

      {hasOverride ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePreview}
              className="shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-sm flex items-center justify-center"
              title={previewing ? 'Stop preview' : 'Play preview'}
            >
              {previewing ? '⏹' : '▶︎'}
            </button>
            <p className="text-xs text-white/70 truncate flex-1" title={override!.file_url}>
              {override!.file_name ?? override!.file_url.split('/').pop()}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => { setBusy(true); await onToggle(); setBusy(false) }}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50"
            >
              {active ? 'Disattiva (usa default)' : 'Riattiva override'}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#3A9DBC]/40 text-[#3A9DBC] hover:bg-[#3A9DBC]/10 disabled:opacity-50"
            >
              {uploading ? '⏳ Caricamento...' : '🔁 Sostituisci file'}
            </button>
            <button
              onClick={async () => { setBusy(true); await onRemove(); setBusy(false) }}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              🗑 Rimuovi
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#3A9DBC]/40 text-[#3A9DBC] hover:bg-[#3A9DBC]/10 disabled:opacity-50"
          >
            {uploading ? '⏳ Caricamento...' : '➕ Carica audio personalizzato'}
          </button>
          <p className="text-[10px] text-white/30 mt-1.5">Nessun override: il gioco usa il suono di default.</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"
        className="hidden"
        onChange={onFile}
      />
    </div>
  )
}
