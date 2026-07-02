'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminListSkeleton } from '@/components/admin/AdminLoading'
import type { Enigma, EnigmaDifficulty, EnigmaFrammento, EnigmaSuggerimento } from '@/lib/types'

// ─── Shared styles ───────────────────────────────────────────────────────────
const cls =
  'w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25 focus:outline-none focus:border-[#3A9DBC]/60'

const DIFFICULTY_COLOR: Record<EnigmaDifficulty, string> = {
  facile: '#34D399',
  medio: '#FBBF24',
  difficile: '#EF4444',
}
const DIFFICULTY_LABEL: Record<EnigmaDifficulty, string> = {
  facile: 'Facile',
  medio: 'Medio',
  difficile: 'Difficile',
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors"
    >
      <span>{title}</span>
      <span className="text-white/40">{open ? '▲' : '▼'}</span>
    </button>
  )
}

function ImageUrlField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (url: string) => void
  placeholder?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const d = await res.json()
    if (res.ok) {
      onChange(d.url)
    } else {
      setUploadError(d.error ?? 'Errore upload')
    }
    setUploading(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-xs placeholder:text-white/25 focus:outline-none focus:border-[#3A9DBC]/60"
          placeholder={placeholder ?? 'https://... oppure carica →'}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className="shrink-0 px-3 py-2 bg-white/10 border border-white/20 text-white/70 text-xs rounded-lg hover:bg-white/15 disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? '⏳' : '📷 Carica'}
        </button>
      </div>
      {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── Form state types ────────────────────────────────────────────────────────
type RewardType = 'none' | 'exp' | 'gold' | 'oggetto' | 'creatura'

interface FrammentoForm {
  title: string
  description: string
  image_url: string
  video_url: string
}

interface SuggerimentoForm {
  text: string
  image_url: string
}

// Valore sentinel per "nessuna sessione" = enigma globale
const GLOBAL_SESSION_ID = '__global__'

interface EnigmaForm {
  title: string
  description: string
  session_id: string  // GLOBAL_SESSION_ID → null in API
  difficulty: EnigmaDifficulty
  solution: string
  reward_type: RewardType
  reward_amount: number
  reward_item_id: string
  reward_quantity: number
  reward_creature_id: string
  lock_enabled: boolean
  lock_alphabet: string
  frammenti: FrammentoForm[]
  suggerimenti: SuggerimentoForm[]
}

const EMPTY_FORM: EnigmaForm = {
  title: '',
  description: '',
  session_id: GLOBAL_SESSION_ID,
  difficulty: 'medio',
  solution: '',
  reward_type: 'none',
  reward_amount: 0,
  reward_item_id: '',
  reward_quantity: 1,
  reward_creature_id: '',
  lock_enabled: false,
  lock_alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  frammenti: [],
  suggerimenti: [],
}

function enigmaToForm(e: Enigma): EnigmaForm {
  let reward_type: RewardType = 'none'
  let reward_amount = 0
  let reward_item_id = ''
  let reward_quantity = 1
  let reward_creature_id = ''

  if (e.reward_type === 'exp' || e.reward_type === 'gold') {
    reward_type = e.reward_type
    reward_amount = (e.reward_payload?.amount as number) ?? 0
  } else if (e.reward_type === 'oggetto') {
    reward_type = 'oggetto'
    reward_item_id = (e.reward_payload?.item_id as string) ?? ''
    reward_quantity = (e.reward_payload?.quantity as number) ?? 1
  } else if (e.reward_type === 'creatura') {
    reward_type = 'creatura'
    reward_creature_id = (e.reward_payload?.creature_id as string) ?? ''
  }

  return {
    title: e.title,
    description: e.description ?? '',
    session_id: e.session_id ?? GLOBAL_SESSION_ID,
    difficulty: e.difficulty,
    solution: e.solution,
    reward_type,
    reward_amount,
    reward_item_id,
    reward_quantity,
    reward_creature_id,
    lock_enabled: !!e.lock_config,
    lock_alphabet: e.lock_config?.alphabet ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    frammenti: (e.frammenti ?? []).map(f => ({
      title: f.title,
      description: f.description ?? '',
      image_url: f.image_url ?? '',
      video_url: f.video_url ?? '',
    })),
    suggerimenti: (e.suggerimenti ?? []).map(s => ({
      text: s.text,
      image_url: s.image_url ?? '',
    })),
  }
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function EnigmiPage() {
  const [enigmi, setEnigmi] = useState<Enigma[]>([])
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  const [creatures, setCreatures] = useState<{ id: string; name: string }[]>([])
  const [sessionFilter, setSessionFilter] = useState<string>('')
  const [panel, setPanel] = useState<null | 'new' | Enigma>(null)
  const [form, setForm] = useState<EnigmaForm>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [frammentoOpen, setFrammentoOpen] = useState(true)
  const [suggerimentoOpen, setSuggerimentoOpen] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  // Load sessions, items, creatures on mount
  useEffect(() => {
    supabase
      .from('sessions')
      .select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSessions(data)
      })
    supabase
      .from('items')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setItems(data)
      })
    supabase
      .from('creatures')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setCreatures(data)
      })
  }, [supabase])

  // Load enigmi when session filter changes
  useEffect(() => {
    if (sessionFilter) {
      loadEnigmi(sessionFilter)
    } else {
      setEnigmi([])
    }
  }, [sessionFilter])

  async function loadEnigmi(sid: string) {
    setLoading(true)
    const apiId = sid === GLOBAL_SESSION_ID ? 'global' : sid
    const res = await fetch(`/api/admin/enigmi?sessionId=${apiId}`)
    const d = await res.json()
    setEnigmi(d.enigmi ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, session_id: sessionFilter || GLOBAL_SESSION_ID })
    setError('')
    setFrammentoOpen(true)
    setSuggerimentoOpen(true)
    setPanel('new')
  }

  function openEdit(enigma: Enigma) {
    setForm(enigmaToForm(enigma))
    setError('')
    setFrammentoOpen(true)
    setSuggerimentoOpen(true)
    setPanel(enigma)
  }

  function closePanel() {
    setPanel(null)
    setError('')
  }

  function buildPayload() {
    let reward_type: string | null = null
    let reward_payload: Record<string, unknown> | null = null

    if (form.reward_type === 'exp' || form.reward_type === 'gold') {
      reward_type = form.reward_type
      reward_payload = { amount: Number(form.reward_amount) || 0 }
    } else if (form.reward_type === 'oggetto') {
      reward_type = 'oggetto'
      reward_payload = {
        item_id: form.reward_item_id,
        quantity: Number(form.reward_quantity) || 1,
      }
    } else if (form.reward_type === 'creatura') {
      reward_type = 'creatura'
      reward_payload = { creature_id: form.reward_creature_id }
    }

    return {
      // GLOBAL_SESSION_ID → null = enigma globale (tutte le sessioni)
      session_id: form.session_id === GLOBAL_SESSION_ID ? null : form.session_id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      solution: form.solution.trim(),
      difficulty: form.difficulty,
      reward_type,
      reward_payload,
      lock_config: form.lock_enabled
        ? { alphabet: form.lock_alphabet.toUpperCase(), length: form.solution.trim().length }
        : null,
      frammenti: form.frammenti.map((f, i) => ({
        title: f.title.trim(),
        description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
        video_url: f.video_url.trim() || null,
        order_index: i,
      })),
      suggerimenti: form.suggerimenti.map((s, i) => ({
        text: s.text.trim(),
        image_url: s.image_url.trim() || null,
        order_index: i,
      })),
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Titolo obbligatorio'); return }
    if (!form.solution.trim()) { setError('Soluzione obbligatoria'); return }
    if (form.lock_enabled) {
      const alpha = form.lock_alphabet.toUpperCase()
      if (alpha.length < 2) { setError("L'alfabeto del lucchetto deve avere almeno 2 caratteri"); return }
      const sol = form.solution.trim().toUpperCase()
      const missing = [...new Set(sol.split('').filter(c => !alpha.includes(c)))]
      if (missing.length > 0) { setError(`Il lucchetto non può comporre la soluzione: mancano ${missing.join(', ')} nell'alfabeto`); return }
      if (sol.length > 8) { setError('Con il lucchetto la soluzione può avere al massimo 8 caratteri'); return }
    }
    for (const f of form.frammenti) {
      if (!f.title.trim()) { setError('Ogni frammento deve avere un titolo'); return }
    }
    for (const s of form.suggerimenti) {
      if (!s.text.trim()) { setError('Ogni suggerimento deve avere un testo'); return }
    }

    setSaving(true)
    setError('')

    const isEdit = panel !== null && panel !== 'new'
    const payload = buildPayload()

    const url = isEdit
      ? `/api/admin/enigmi/${(panel as Enigma).id}`
      : '/api/admin/enigmi'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await res.json()
    setSaving(false)

    if (!res.ok) { setError(d.error ?? 'Errore nel salvataggio'); return }

    const saved: Enigma = d.enigma
    if (isEdit) {
      setEnigmi(prev => prev.map(e => e.id === (panel as Enigma).id ? saved : e))
    } else {
      setEnigmi(prev => [saved, ...prev])
    }
    closePanel()
  }

  async function handleDelete(enigma: Enigma) {
    if (!confirm(`Eliminare l'enigma "${enigma.title}"?\nFrammenti e suggerimenti collegati saranno rimossi.`)) return
    setDeletingId(enigma.id)
    await fetch(`/api/admin/enigmi/${enigma.id}`, { method: 'DELETE' })
    setEnigmi(prev => prev.filter(e => e.id !== enigma.id))
    setDeletingId(null)
  }

  // ── Frammenti helpers ──────────────────────────────────────────────────────
  function addFrammento() {
    setForm(f => ({
      ...f,
      frammenti: [...f.frammenti, { title: '', description: '', image_url: '', video_url: '' }],
    }))
  }

  function removeFrammento(i: number) {
    setForm(f => ({ ...f, frammenti: f.frammenti.filter((_, j) => j !== i) }))
  }

  function updateFrammento(i: number, patch: Partial<FrammentoForm>) {
    setForm(f => {
      const arr = [...f.frammenti]
      arr[i] = { ...arr[i], ...patch }
      return { ...f, frammenti: arr }
    })
  }

  // ── Suggerimenti helpers ───────────────────────────────────────────────────
  function addSuggerimento() {
    setForm(f => ({
      ...f,
      suggerimenti: [...f.suggerimenti, { text: '', image_url: '' }],
    }))
  }

  function removeSuggerimento(i: number) {
    setForm(f => ({ ...f, suggerimenti: f.suggerimenti.filter((_, j) => j !== i) }))
  }

  function updateSuggerimento(i: number, patch: Partial<SuggerimentoForm>) {
    setForm(f => {
      const arr = [...f.suggerimenti]
      arr[i] = { ...arr[i], ...patch }
      return { ...f, suggerimenti: arr }
    })
  }

  const sessionName = (sid: string | null) => {
    if (!sid) return '🌍 Globale'
    return sessions.find(s => s.id === sid)?.name ?? sid
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🧩 Enigmi</h1>
        <button
          onClick={openNew}
          className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm"
        >
          + Nuovo Enigma
        </button>
      </div>

      {/* Session filter */}
      <div className="mb-4">
        <select
          value={sessionFilter}
          onChange={e => setSessionFilter(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm w-full max-w-xs"
        >
          <option value="">📋 Seleziona una sessione...</option>
          <option value={GLOBAL_SESSION_ID}>🌍 Globale (tutte le sessioni)</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              🎮 {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {!sessionFilter ? (
        <p className="text-white/30 text-sm mt-8 text-center">
          Seleziona una sessione per visualizzare gli enigmi.
        </p>
      ) : loading ? (
        <AdminListSkeleton rows={4} itemClassName="h-[90px]" />
      ) : enigmi.length === 0 ? (
        <p className="text-white/30 text-sm">Nessun enigma in questa sessione.</p>
      ) : (
        <div className="space-y-2">
          {enigmi.map(enigma => {
            const diffColor = DIFFICULTY_COLOR[enigma.difficulty]
            const diffLabel = DIFFICULTY_LABEL[enigma.difficulty]
            const frCount = enigma.frammenti?.length ?? 0
            const sugCount = enigma.suggerimenti?.length ?? 0
            return (
              <div
                key={enigma.id}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white text-sm">{enigma.title}</p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: diffColor + '22', color: diffColor }}
                    >
                      {diffLabel}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {enigma.session_id ? `🎮 ${sessionName(enigma.session_id)}` : '🌍 Globale'}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-white/30">🧩 {frCount} frammenti</span>
                    <span className="text-xs text-white/30">💡 {sugCount} suggerimenti</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 mt-0.5">
                  <button
                    onClick={() => openEdit(enigma)}
                    className="text-[#3A9DBC] hover:text-[#3A9DBC]/80 text-sm px-2 py-1 rounded transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(enigma)}
                    disabled={deletingId === enigma.id}
                    className="text-red-400/60 hover:text-red-400 text-sm px-2 py-1 rounded transition-colors disabled:opacity-30"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
          <p className="text-white/25 text-xs pt-1">{enigmi.length} enigmi</p>
        </div>
      )}

      {/* Panel overlay */}
      {panel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={closePanel} />
          <div className="w-full max-w-lg bg-[#0D1E2E] border-l border-white/10 overflow-y-auto flex flex-col">
            {/* Panel header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-lg">
                {panel === 'new' ? 'Nuovo Enigma' : 'Modifica Enigma'}
              </h2>
              <button onClick={closePanel} className="text-white/40 hover:text-white text-xl">
                ×
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 p-4 space-y-5 overflow-y-auto">

              {/* ── Section 1: Info Base ─────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  Info Base
                </p>

                <Field label="Titolo *">
                  <input
                    className={cls}
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="es. Il Tesoro Nascosto"
                    autoFocus
                  />
                </Field>

                <Field label="Descrizione">
                  <textarea
                    className={cls}
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrizione opzionale dell'enigma..."
                  />
                </Field>

                <Field
                  label="Sessione"
                  hint="Lascia 'Globale' per rendere l'enigma disponibile in tutte le sessioni"
                >
                  <select
                    className={cls}
                    value={form.session_id}
                    onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}
                  >
                    <option value={GLOBAL_SESSION_ID}>🌍 Globale (tutte le sessioni)</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Difficoltà *">
                  <div className="flex gap-2">
                    {(['facile', 'medio', 'difficile'] as EnigmaDifficulty[]).map(d => {
                      const active = form.difficulty === d
                      const color = DIFFICULTY_COLOR[d]
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-all"
                          style={{
                            borderColor: active ? color : 'rgba(255,255,255,0.15)',
                            backgroundColor: active ? color + '22' : 'rgba(255,255,255,0.05)',
                            color: active ? color : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {DIFFICULTY_LABEL[d]}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </div>

              {/* ── Section 2: Soluzione ─────────────────────────────── */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  Soluzione
                </p>

                <Field
                  label="Soluzione *"
                  hint="La soluzione non è mai visibile ai giocatori"
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none">
                      🔒
                    </span>
                    <input
                      className={cls + ' pl-9'}
                      value={form.solution}
                      onChange={e => setForm(f => ({ ...f, solution: e.target.value }))}
                      placeholder="es. PESCE_SPADA"
                    />
                  </div>
                </Field>

                {/* Lucchetto a rulli */}
                <div className="rounded-xl border border-[#E6C989]/25 bg-[#E6C989]/5 p-3 space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.lock_enabled}
                      onChange={e => setForm(f => ({ ...f, lock_enabled: e.target.checked }))}
                      className="w-4 h-4 accent-[#E6C989]" />
                    <span className="text-sm text-white/80">🎰 Input a lucchetto (rulli)</span>
                  </label>
                  {form.lock_enabled && (
                    <>
                      <Field label="Alfabeto dei rulli">
                        <input className={cls + ' font-mono uppercase'}
                          value={form.lock_alphabet}
                          onChange={e => setForm(f => ({ ...f, lock_alphabet: e.target.value.toUpperCase() }))}
                          placeholder="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" />
                      </Field>
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        Il giocatore compone la soluzione ruotando {Math.max(1, form.solution.trim().length)} rulli
                        con questi caratteri (max 8). Ogni carattere della soluzione deve essere presente nell&apos;alfabeto.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* ── Section 3: Ricompensa ────────────────────────────── */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  Ricompensa (opzionale)
                </p>

                <Field label="Tipo ricompensa">
                  <select
                    className={cls}
                    value={form.reward_type}
                    onChange={e =>
                      setForm(f => ({ ...f, reward_type: e.target.value as RewardType }))
                    }
                  >
                    <option value="none">Nessuna</option>
                    <option value="exp">EXP</option>
                    <option value="gold">Oro</option>
                    <option value="oggetto">Oggetto</option>
                    <option value="creatura">Creatura</option>
                  </select>
                </Field>

                {(form.reward_type === 'exp' || form.reward_type === 'gold') && (
                  <Field label={form.reward_type === 'exp' ? 'Quantità EXP' : 'Quantità Oro'}>
                    <input
                      type="number"
                      min={0}
                      className={cls}
                      value={form.reward_amount}
                      onChange={e =>
                        setForm(f => ({ ...f, reward_amount: +e.target.value }))
                      }
                    />
                  </Field>
                )}

                {form.reward_type === 'oggetto' && (
                  <div className="space-y-3">
                    <Field label="Oggetto">
                      <select
                        className={cls}
                        value={form.reward_item_id}
                        onChange={e =>
                          setForm(f => ({ ...f, reward_item_id: e.target.value }))
                        }
                      >
                        <option value="">— Seleziona oggetto —</option>
                        {items.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantità">
                      <input
                        type="number"
                        min={1}
                        className={cls}
                        value={form.reward_quantity}
                        onChange={e =>
                          setForm(f => ({ ...f, reward_quantity: Math.max(1, +e.target.value) }))
                        }
                      />
                    </Field>
                  </div>
                )}

                {form.reward_type === 'creatura' && (
                  <Field label="Creatura">
                    <select
                      className={cls}
                      value={form.reward_creature_id}
                      onChange={e =>
                        setForm(f => ({ ...f, reward_creature_id: e.target.value }))
                      }
                    >
                      <option value="">— Seleziona creatura —</option>
                      {creatures.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              {/* ── Section 4: Frammenti ─────────────────────────────── */}
              <div className="border-t border-white/10 pt-4">
                <SectionHeader
                  title={`🧩 Frammenti (${form.frammenti.length})`}
                  open={frammentoOpen}
                  onToggle={() => setFrammentoOpen(o => !o)}
                />

                {frammentoOpen && (
                  <div className="space-y-3 mt-2">
                    {form.frammenti.map((fr, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3 relative"
                      >
                        <button
                          type="button"
                          onClick={() => removeFrammento(i)}
                          className="absolute top-2 right-2 text-red-400/60 hover:text-red-400 text-lg leading-none"
                        >
                          ×
                        </button>
                        <p className="text-xs font-semibold text-white/40">Frammento {i + 1}</p>

                        <Field label="Titolo *">
                          <input
                            className={cls}
                            value={fr.title}
                            onChange={e => updateFrammento(i, { title: e.target.value })}
                            placeholder="es. Il primo indizio"
                          />
                        </Field>

                        <Field label="Descrizione">
                          <textarea
                            className={cls}
                            rows={2}
                            value={fr.description}
                            onChange={e => updateFrammento(i, { description: e.target.value })}
                            placeholder="Descrizione opzionale..."
                          />
                        </Field>

                        <Field label="Immagine URL">
                          <ImageUrlField
                            value={fr.image_url}
                            onChange={url => updateFrammento(i, { image_url: url })}
                          />
                        </Field>

                        <Field label="Video URL (opzionale)">
                          <input
                            className={cls}
                            value={fr.video_url}
                            onChange={e => updateFrammento(i, { video_url: e.target.value })}
                            placeholder="https://youtube.com/..."
                          />
                        </Field>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addFrammento}
                      className="w-full py-2 border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/40 rounded-lg text-sm transition-colors"
                    >
                      ＋ Aggiungi frammento
                    </button>
                  </div>
                )}
              </div>

              {/* ── Section 5: Suggerimenti ──────────────────────────── */}
              <div className="border-t border-white/10 pt-4">
                <SectionHeader
                  title={`💡 Suggerimenti (${form.suggerimenti.length})`}
                  open={suggerimentoOpen}
                  onToggle={() => setSuggerimentoOpen(o => !o)}
                />

                {suggerimentoOpen && (
                  <div className="space-y-3 mt-2">
                    {form.suggerimenti.map((sg, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3 relative"
                      >
                        <button
                          type="button"
                          onClick={() => removeSuggerimento(i)}
                          className="absolute top-2 right-2 text-red-400/60 hover:text-red-400 text-lg leading-none"
                        >
                          ×
                        </button>
                        <p className="text-xs font-semibold text-white/40">Suggerimento {i + 1}</p>

                        <Field label="Testo *">
                          <textarea
                            className={cls}
                            rows={2}
                            value={sg.text}
                            onChange={e => updateSuggerimento(i, { text: e.target.value })}
                            placeholder="es. Cerca vicino all'acqua..."
                          />
                        </Field>

                        <Field label="Immagine URL">
                          <ImageUrlField
                            value={sg.image_url}
                            onChange={url => updateSuggerimento(i, { image_url: url })}
                          />
                        </Field>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addSuggerimento}
                      className="w-full py-2 border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/40 rounded-lg text-sm transition-colors"
                    >
                      ＋ Aggiungi suggerimento
                    </button>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  ⚠ {error}
                </p>
              )}
            </div>

            {/* Panel footer */}
            <div className="p-4 border-t border-white/10 flex gap-2 shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
              <button
                onClick={closePanel}
                className="px-4 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/10"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
