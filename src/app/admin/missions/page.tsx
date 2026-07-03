'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminInlineSpinner, AdminListSkeleton } from '@/components/admin/AdminLoading'
import type { Json } from '@/types/database'

interface Mission {
  id: string
  chapter_order: number
  title: string
  description: string
  type: string
  target: string
  target_count: number
  reward_gold: number
  reward_exp: number
  reward_items: Array<{ item_id: string; quantity: number }>
  reward_creature_id: string | null
  is_required: boolean
  session_id: string | null
  unlock_level: number | null
  unlock_after_mission_id: string | null
  recurrence?: 'daily' | 'weekly' | 'monthly' | null
  reward_extra?: Array<{ type: string; payload: Record<string, unknown> }> | null
}

interface Creature  { id: string; name: string; rarity: string; element: string }
interface Item      { id: string; name: string; type: string }
interface QRCode    { id: string; label: string; type: string; manual_code?: string | null }
interface SessionRow { id: string; name: string; status: string }

/* ── Mission types ────────────────────────────── */
const MISSION_TYPES = [
  {
    value: 'cattura',
    label: 'Cattura creatura',
    hint: 'Il giocatore deve catturare una creatura specifica (o qualsiasi, se target vuoto)',
    targetType: 'creature' as const,
    targetLabel: 'Creatura da catturare',
    targetHint: 'Seleziona la creatura specifica. Lascia vuoto = qualsiasi creatura',
    countLabel: 'Quante creature catturare',
  },
  {
    value: 'duel',
    label: 'Duello PvP',
    hint: 'Il giocatore deve vincere un duello contro un altro giocatore',
    targetType: null,
    targetLabel: '',
    targetHint: '',
    countLabel: 'Quanti duelli vincere',
  },
  {
    value: 'qr',
    label: 'Scansione QR',
    hint: 'Il giocatore deve scansionare un QR specifico oppure N QR diversi della sessione',
    targetType: 'qr' as const,
    targetLabel: 'QR code da scansionare',
    targetHint: 'Seleziona un QR specifico. Lascia vuoto = contano solo QR univoci diversi, non scansioni ripetute dello stesso codice',
    countLabel: 'Quanti QR univoci scansionare',
  },
  {
    value: 'walk',
    label: 'Cammino (metri)',
    hint: 'Il giocatore deve percorrere una distanza in metri tracking GPS',
    targetType: null,
    targetLabel: '',
    targetHint: '',
    countLabel: 'Distanza in metri da percorrere',
  },
  {
    value: 'collect',
    label: 'Raccolta oggetti',
    hint: 'Il giocatore deve raccogliere un certo numero di oggetti (da QR o negozio)',
    targetType: 'item' as const,
    targetLabel: 'Oggetto da raccogliere',
    targetHint: 'Seleziona l\'oggetto specifico. Lascia vuoto = qualsiasi oggetto',
    countLabel: 'Quanti oggetti raccogliere',
  },
]

/* ── Searchable select ───────────────────────── */
function SearchSelect({
  options, value, onChange, placeholder, label, hint,
}: {
  options: { value: string; label: string; sub?: string }[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  hint?: string
}) {
  const [open, setOpen]     = useState(false)
  const [q, setQ]           = useState('')
  const ref                 = useRef<HTMLDivElement>(null)
  const selected            = options.find(o => o.value === value)

  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) || (o.sub ?? '').toLowerCase().includes(q.toLowerCase()))
    : options

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQ('')
      }
    }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5">{hint}</p>}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setQ('') }}
          className="w-full flex items-center justify-between bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-left"
        >
          {selected
            ? <span className="text-white">{selected.label}<span className="text-white/40 ml-2 text-xs">{selected.sub}</span></span>
            : <span className="text-white/30">{placeholder}</span>
          }
          <span className="text-white/40 ml-2">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#0d1e2e] border border-white/20 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-white/10">
              <input
                autoFocus
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Cerca..."
                className="w-full bg-white/10 text-white text-sm border border-white/20 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQ('') }}
                className="w-full text-left px-4 py-2 text-sm text-white/30 hover:bg-white/5"
              >
                — Nessuno / Qualsiasi
              </button>
              {filtered.map(o => (
                <button
                  key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQ('') }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center justify-between ${value === o.value ? 'bg-[#3A9DBC]/10 text-[#3A9DBC]' : 'text-white'}`}
                >
                  <span>{o.label}</span>
                  {o.sub && <span className="text-xs text-white/40 ml-2">{o.sub}</span>}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-white/30 text-sm">Nessun risultato</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Field wrapper ───────────────────────────── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

const cls = 'w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25'

const EMPTY_FORM = {
  title: '', description: '', type: 'cattura', target: '',
  target_count: 1, reward_gold: 50, reward_exp: 100,
  reward_items: [] as Array<{ item_id: string; quantity: number }>,
  reward_creature_id: '' as string,
  unlock_level: '' as number | '',
  unlock_after_mission_id: '' as string,
  chapter_order: 1, is_required: false, scope_session_id: '',
  recurrence: '' as '' | 'daily' | 'weekly' | 'monthly',
  reward_extra_json: '' as string,
}

/* ── Page ────────────────────────────────────── */
export default function AdminMissions() {
  const [sessions, setSessions]   = useState<SessionRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [missions, setMissions]   = useState<Mission[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMissions, setLoadingMissions] = useState(false)

  // Reference data for target selects
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [items, setItems]         = useState<Item[]>([])
  const [qrCodes, setQrCodes]     = useState<QRCode[]>([])

  const [search, setSearch]        = useState('')
  const [filterType, setFilterType] = useState('')

  // panel: null | 'new' | Mission (edit)
  const [panel, setPanel]         = useState<null | 'new' | Mission>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const supabase = useMemo(() => createClient(), [])

  /* ── Load sessions ── */
  useEffect(() => {
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })
      .then(() => setLoadingSessions(false), () => setLoadingSessions(false))
  }, [supabase])

  /* ── Load missions when session changes ── */
  function loadMissions(sid: string) {
    setLoadingMissions(true)
    const query = sid
      ? supabase.from('missions').select('*').eq('session_id', sid).order('chapter_order')
      : supabase.from('missions').select('*').order('chapter_order')
    query
      .then(({ data }) => { if (data) setMissions(data as unknown as Mission[]) })
      .then(() => setLoadingMissions(false), () => setLoadingMissions(false))
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadMissions(selectedId) }, [selectedId])

  /* ── Load reference data for selects ── */
  useEffect(() => {
    fetch('/api/admin/creatures').then(r => r.json()).then(d => setCreatures(d.creatures ?? []))
    fetch('/api/admin/items').then(r => r.json()).then(d => setItems(d.items ?? []))
  }, [])

  useEffect(() => {
    const sid = selectedId || 'all'
    fetch(`/api/admin/qrcodes?sessionId=${sid}`)
      .then(r => r.json()).then(d => setQrCodes(d.qrCodes ?? []))
  }, [selectedId])

  /* ── Build target options based on mission type ── */
  const typeInfo = MISSION_TYPES.find(t => t.value === form.type)!

  const targetOptions = useMemo(() => {
    if (typeInfo.targetType === 'creature') {
      return creatures.map(c => ({
        value: c.name,
        label: c.name,
        sub: `${c.rarity} · ${c.element}`,
      }))
    }
    if (typeInfo.targetType === 'item') {
      return items.map(i => ({
        value: i.name,
        label: i.name,
        sub: i.type,
      }))
    }
    if (typeInfo.targetType === 'qr') {
      return qrCodes.map(q => ({
        value: q.manual_code || q.id,
        label: q.label || q.manual_code || q.id.slice(0, 12),
        sub: [q.type, q.manual_code].filter(Boolean).join(' · '),
      }))
    }
    return []
  }, [typeInfo.targetType, creatures, items, qrCodes])

  const prerequisiteOptions = useMemo(() => {
    const scopeSessionId = form.scope_session_id || null
    const currentId = panel !== null && panel !== 'new' ? (panel as Mission).id : null
    return missions
      .filter(m => {
        if (m.id === currentId) return false
        if (scopeSessionId === null) return m.session_id === null
        return m.session_id === scopeSessionId || m.session_id === null
      })
      .sort((a, b) => a.chapter_order - b.chapter_order)
  }, [form.scope_session_id, missions, panel])

  /* ── Open panels ── */
  function openNew() {
    setForm({ ...EMPTY_FORM, chapter_order: missions.length + 1 })
    setFormError(''); setPanel('new')
  }

  function openEdit(m: Mission) {
    setForm({
      title: m.title, description: m.description, type: m.type, target: m.target,
      target_count: m.target_count, reward_gold: m.reward_gold, reward_exp: m.reward_exp,
      reward_items: m.reward_items ?? [],
      reward_creature_id: m.reward_creature_id ?? '',
      unlock_level: m.unlock_level ?? '',
      unlock_after_mission_id: m.unlock_after_mission_id ?? '',
      chapter_order: m.chapter_order, is_required: m.is_required,
      scope_session_id: m.session_id ?? '',
      recurrence: (m.recurrence ?? '') as '' | 'daily' | 'weekly' | 'monthly',
      reward_extra_json: Array.isArray(m.reward_extra) && m.reward_extra.length > 0
        ? JSON.stringify(m.reward_extra, null, 2) : '',
    })
    setFormError(''); setPanel(m)
  }

  function closePanel() { setPanel(null); setFormError('') }

  /* ── Save ── */
  async function handleSave() {
    if (!form.title.trim()) { setFormError('Titolo obbligatorio'); return }
    const unlockLevel = form.unlock_level === '' ? null : Number(form.unlock_level)
    if (unlockLevel !== null && (!Number.isFinite(unlockLevel) || unlockLevel < 1)) {
      setFormError('Il livello di sblocco deve essere vuoto oppure maggiore o uguale a 1')
      return
    }
    const unlockAfterMissionId = form.unlock_after_mission_id || null
    let rewardExtra: Array<{ type: string; payload: Record<string, unknown> }> | null = null
    if (form.reward_extra_json.trim()) {
      try {
        const parsed = JSON.parse(form.reward_extra_json)
        if (!Array.isArray(parsed)) throw new Error('not an array')
        rewardExtra = parsed
      } catch {
        setFormError('Ricompense extra: JSON non valido — deve essere un array [{"type":"...","payload":{...}}]')
        return
      }
    }
    if (panel !== null && panel !== 'new' && unlockAfterMissionId === (panel as Mission).id) {
      setFormError('Una missione non può sbloccare sé stessa')
      return
    }
    if (panel !== null && panel !== 'new' && unlockAfterMissionId) {
      const prerequisite = missions.find(m => m.id === unlockAfterMissionId)
      if (prerequisite?.unlock_after_mission_id === (panel as Mission).id) {
        setFormError('Dipendenza circolare diretta tra missioni')
        return
      }
    }
    setSaving(true); setFormError('')
    const isEdit = panel !== null && panel !== 'new'

    const formFields = {
      title: form.title,
      description: form.description,
      type: form.type,
      target: form.target,
      target_count: form.target_count,
      reward_gold: form.reward_gold,
      reward_exp: form.reward_exp,
      chapter_order: form.chapter_order,
      is_required: form.is_required,
      recurrence: form.recurrence || null,
      reward_extra: rewardExtra as unknown as Json,
    }
    const sessionIdToSave = form.scope_session_id || null
    const rewardItems = form.reward_items.filter(ri => ri.item_id)
    const rewardCreatureId = form.reward_creature_id || null
    const unlockFields = {
      unlock_level: unlockLevel,
      unlock_after_mission_id: unlockAfterMissionId,
    }
    if (isEdit) {
      const { error } = await supabase.from('missions')
        .update({ ...formFields, ...unlockFields, session_id: sessionIdToSave, reward_items: rewardItems, reward_creature_id: rewardCreatureId })
        .eq('id', (panel as Mission).id)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('missions')
        .insert({ ...formFields, ...unlockFields, session_id: sessionIdToSave, reward_items: rewardItems, reward_creature_id: rewardCreatureId })
      if (error) { setFormError(error.message); setSaving(false); return }
    }

    loadMissions(selectedId)
    setSaving(false)
    closePanel()
  }

  /* ── Delete ── */
  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa missione?')) return
    await supabase.from('missions').delete().eq('id', id)
    setMissions(ms => ms.filter(m => m.id !== id))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">🎯 Missioni</h1>
        <button onClick={openNew}
          className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
          + Nuova missione
        </button>
      </div>

      {/* Session selector */}
      <div className="mb-4">
        <label className="block text-xs text-white/50 mb-1">Sessione</label>
        <select value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
          disabled={loadingSessions}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 disabled:opacity-50">
          <option value="">📋 Tutte le sessioni</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
        {loadingSessions && (
          <div className="mt-2">
            <AdminInlineSpinner label="Caricamento sessioni..." />
          </div>
        )}
      </div>

      {/* Search + type filter */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cerca per titolo, obiettivo…"
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/30 outline-none focus:border-[#3A9DBC]/60"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tutti i tipi</option>
          {MISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Chapter order info box */}
      <div className="bg-[#3A9DBC]/8 border border-[#3A9DBC]/20 rounded-xl px-4 py-3 mb-4">
        <p className="text-xs text-white/50 leading-relaxed">
          <span className="text-[#3A9DBC] font-semibold">ℹ Ordine lista:</span>{' '}
          Il numero &quot;Posizione nella lista&quot; controlla l&apos;ordine visivo. Lo sblocco si configura nel pannello missione: senza requisiti è subito attiva, con requisiti resta visibile ma bloccata finché il giocatore raggiunge il livello richiesto o completa la missione prerequisito.
        </p>
      </div>

      {/* Missions list */}
      {loadingMissions && missions.length === 0 ? (
        <AdminListSkeleton rows={5} itemClassName="h-[88px]" />
      ) : missions.length === 0 ? (
        <p className="text-white/40 text-sm">Nessuna missione per questa sessione.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {missions.filter(m => {
            if (filterType && m.type !== filterType) return false
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return (
              m.title.toLowerCase().includes(q) ||
              m.description?.toLowerCase().includes(q) ||
              m.target?.toLowerCase().includes(q)
            )
          }).map(m => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">
                    <span className="text-white/30 mr-1">#{m.chapter_order}</span>
                    {m.is_required ? '⭐ ' : ''}{m.title}
                  </p>
                  {m.description && <p className="text-xs text-white/50 mt-0.5">{m.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-xs bg-white/8 border border-white/10 text-white/50 px-2 py-0.5 rounded">
                      {MISSION_TYPES.find(t => t.value === m.type)?.label ?? m.type}
                    </span>
                    {m.target && (
                      <span className="text-xs text-white/40">🎯 {m.target.length > 20 ? m.target.slice(0, 20) + '…' : m.target}</span>
                    )}
                    <span className="text-xs text-white/40">×{m.target_count}</span>
                    <span className="text-xs text-[#F7C841]/70">🪙 {m.reward_gold}</span>
                    <span className="text-xs text-white/40">✨ {m.reward_exp} EXP</span>
                    {m.unlock_level && (
                      <span className="text-xs text-[#C084FC]/70">🔒 Lv {m.unlock_level}</span>
                    )}
                    {m.unlock_after_mission_id && (
                      <span className="text-xs text-[#C084FC]/70">🔒 Dopo missione</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(m)}
                    className="text-[#3A9DBC]/60 hover:text-[#3A9DBC] text-sm px-2 py-1 rounded transition-colors">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(m.id)}
                    className="text-red-400/50 hover:text-red-400 text-sm px-2 py-1 rounded transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel modal */}
      {panel !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closePanel() }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {panel === 'new' ? '+ Nuova missione' : `✏️ Modifica missione`}
              </h2>
              <button onClick={closePanel} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <Field label="Titolo missione *">
                <input className={cls} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="es. Cattura il Drago di Fuoco" autoFocus />
              </Field>

              <Field label="Descrizione" hint="Testo esteso mostrato al giocatore">
                <textarea className={cls} rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="es. Trova e cattura la creatura Ignis..." />
              </Field>

              <Field label="Tipo missione" hint={typeInfo.hint}>
                <select className={cls} value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value, target: '' }))}>
                  {MISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <Field label="Ricorrenza 🔁" hint="Le missioni ricorrenti si rinnovano a ogni periodo (fuso Europe/Rome): progressi azzerati e ricompense di nuovo riscuotibili. Ideali per le sessioni Avventura.">
                <select className={cls} value={form.recurrence}
                  onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as '' | 'daily' | 'weekly' | 'monthly' }))}>
                  <option value="">Una tantum (default)</option>
                  <option value="daily">Giornaliera — si rinnova ogni giorno</option>
                  <option value="weekly">Settimanale — si rinnova ogni lunedì</option>
                  <option value="monthly">Mensile — si rinnova il 1° del mese</option>
                </select>
              </Field>

              {/* Smart target select — only shown when type has a target */}
              {typeInfo.targetType !== null && (
                <SearchSelect
                  label={typeInfo.targetLabel}
                  hint={typeInfo.targetHint}
                  options={targetOptions}
                  value={form.target}
                  onChange={v => setForm(f => ({ ...f, target: v }))}
                  placeholder={`Seleziona ${typeInfo.targetLabel.toLowerCase()}...`}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label={typeInfo.countLabel}>
                  <input type="number" className={cls} value={form.target_count} min={1}
                    onChange={e => setForm(f => ({ ...f, target_count: +e.target.value }))} />
                </Field>

                <Field
                  label="Posizione nella lista"
                  hint="Ordine visivo (1 = prima in lista). Non sblocca/blocca missioni."
                >
                  <input type="number" className={cls} value={form.chapter_order} min={1}
                    onChange={e => setForm(f => ({ ...f, chapter_order: +e.target.value }))} />
                </Field>

                <Field label="Ricompensa Oro 🪙">
                  <input type="number" className={cls} value={form.reward_gold} min={0}
                    onChange={e => setForm(f => ({ ...f, reward_gold: +e.target.value }))} />
                </Field>

                <Field label="Ricompensa EXP ✨">
                  <input type="number" className={cls} value={form.reward_exp} min={0}
                    onChange={e => setForm(f => ({ ...f, reward_exp: +e.target.value }))} />
                </Field>
              </div>

              <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-white/60">🔒 Sblocco missione</p>
                  <p className="text-xs text-white/30 mt-0.5 leading-relaxed">
                    Lascia entrambi vuoti per renderla subito attiva. Se imposti livello e missione prerequisito, basta una delle due condizioni.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Livello minimo">
                    <input
                      type="number"
                      className={cls}
                      value={form.unlock_level}
                      min={1}
                      placeholder="Subito"
                      onChange={e => setForm(f => ({
                        ...f,
                        unlock_level: e.target.value === '' ? '' : Math.max(1, +e.target.value),
                      }))}
                    />
                  </Field>
                  <Field label="Dopo missione">
                    <select
                      className={cls}
                      value={form.unlock_after_mission_id}
                      onChange={e => setForm(f => ({ ...f, unlock_after_mission_id: e.target.value }))}
                    >
                      <option value="">Nessuna</option>
                      {prerequisiteOptions.map(m => (
                        <option key={m.id} value={m.id}>
                          #{m.chapter_order} {m.title}{m.session_id ? '' : ' (globale)'}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Reward creature */}
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">🐾 Creatura in ricompensa <span className="font-normal text-white/30">(opzionale)</span></label>
                <select
                  value={form.reward_creature_id}
                  onChange={e => setForm(f => ({ ...f, reward_creature_id: e.target.value }))}
                  className={cls}
                >
                  <option value="">— Nessuna creatura —</option>
                  {creatures.map((c: Creature) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.rarity} · {c.element})</option>
                  ))}
                </select>
              </div>

              {/* Reward items */}
              <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-white/60">🎒 Oggetti in ricompensa</p>
                {form.reward_items.map((ri, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={ri.item_id}
                      onChange={e => setForm(f => {
                        const arr = [...f.reward_items]; arr[i] = { ...arr[i], item_id: e.target.value }
                        return { ...f, reward_items: arr }
                      })}
                      className="flex-1 bg-[#0F1F2E] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs"
                    >
                      <option value="">— Seleziona oggetto —</option>
                      {items.map((it: Item) => <option key={it.id} value={it.id}>{it.name} ({it.type})</option>)}
                    </select>
                    <input type="number" min={1} value={ri.quantity}
                      onChange={e => setForm(f => {
                        const arr = [...f.reward_items]; arr[i] = { ...arr[i], quantity: Math.max(1, +e.target.value) }
                        return { ...f, reward_items: arr }
                      })}
                      className="w-14 bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs text-center"
                    />
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, reward_items: f.reward_items.filter((_, j) => j !== i) }))}
                      className="text-red-400/60 hover:text-red-400 text-sm px-1">×</button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, reward_items: [...f.reward_items, { item_id: '', quantity: 1 }] }))}
                  className="text-xs text-[#3A9DBC] font-semibold hover:text-[#5AB5D0]">
                  + Aggiungi oggetto
                </button>
              </div>

              {/* Reward extra: qualsiasi tipo del dispenser (bustina/forziere/gemme/…) */}
              <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-1.5">
                <label className="block text-xs font-semibold text-white/60">🎴 Ricompense extra <span className="font-normal text-white/30">(opzionale — JSON)</span></label>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  Array di ricompense aggiuntive dispensate al completamento, di qualsiasi tipo (bustina, forziere,
                  gemme, premio, personaggio, opera, aneddoto…). Es: <code className="text-white/45">{'[{"type":"bustina","payload":{"pack_id":"..."}},{"type":"gemme","payload":{"amount":10}}]'}</code>
                </p>
                <textarea
                  value={form.reward_extra_json}
                  onChange={e => setForm(f => ({ ...f, reward_extra_json: e.target.value }))}
                  placeholder='[{"type":"bustina","payload":{"pack_id":"<id bustina>"}}]'
                  rows={3}
                  className="w-full bg-[#0F1F2E] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs font-mono resize-y"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_required}
                  onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
                <span>
                  <strong>Missione obbligatoria</strong>
                  <span className="text-white/40 ml-1">— mostrata in evidenza ai giocatori</span>
                </span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Disponibile in</label>
                <p className="text-xs text-white/30 mb-1.5">Lascia vuoto per renderla visibile in tutte le sessioni</p>
                <select className={cls} value={form.scope_session_id}
                  onChange={e => setForm(f => ({ ...f, scope_session_id: e.target.value, unlock_after_mission_id: '' }))}>
                  <option value="">🌐 Tutte le sessioni</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>🎯 {s.name}</option>)}
                </select>
              </div>

              {formError && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={closePanel}
                  className="flex-1 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm">
                  Annulla
                </button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="flex-1 bg-[#E85D2F] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                  {saving ? 'Salvataggio...' : panel === 'new' ? 'Crea missione' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
