'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  is_required: boolean
}

interface Creature { id: string; name: string; rarity: string; element: string }
interface Item     { id: string; name: string; type: string }
interface QRCode   { id: string; label: string; type: string }

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
    hint: 'Il giocatore deve scansionare un QR code specifico della sessione',
    targetType: 'qr' as const,
    targetLabel: 'QR code da scansionare',
    targetHint: 'Seleziona quale QR code deve essere scansionato',
    countLabel: 'Quante volte scansionare',
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
  chapter_order: 1, is_required: false,
}

/* ── Page ────────────────────────────────────── */
export default function AdminMissions() {
  const [sessions, setSessions]   = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [missions, setMissions]   = useState<Mission[]>([])

  // Reference data for target selects
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [items, setItems]         = useState<Item[]>([])
  const [qrCodes, setQrCodes]     = useState<QRCode[]>([])

  // panel: null | 'new' | Mission (edit)
  const [panel, setPanel]         = useState<null | 'new' | Mission>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const supabase = useMemo(() => createClient(), [])

  /* ── Load sessions ── */
  useEffect(() => {
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) } })
  }, [supabase])

  /* ── Load missions when session changes ── */
  function loadMissions(sid: string) {
    supabase.from('missions').select('*').eq('session_id', sid).order('chapter_order')
      .then(({ data }) => { if (data) setMissions(data as Mission[]) })
  }
  useEffect(() => { if (selectedId) loadMissions(selectedId) }, [selectedId])

  /* ── Load reference data for selects ── */
  useEffect(() => {
    fetch('/api/admin/creatures').then(r => r.json()).then(d => setCreatures(d.creatures ?? []))
    fetch('/api/admin/items').then(r => r.json()).then(d => setItems(d.items ?? []))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/qrcodes?sessionId=${selectedId}`)
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
        value: q.id,
        label: q.label || q.id.slice(0, 12),
        sub: q.type,
      }))
    }
    return []
  }, [typeInfo.targetType, creatures, items, qrCodes])

  /* ── Open panels ── */
  function openNew() {
    setForm({ ...EMPTY_FORM, chapter_order: missions.length + 1 })
    setFormError(''); setPanel('new')
  }

  function openEdit(m: Mission) {
    setForm({
      title: m.title, description: m.description, type: m.type, target: m.target,
      target_count: m.target_count, reward_gold: m.reward_gold, reward_exp: m.reward_exp,
      chapter_order: m.chapter_order, is_required: m.is_required,
    })
    setFormError(''); setPanel(m)
  }

  function closePanel() { setPanel(null); setFormError('') }

  /* ── Save ── */
  async function handleSave() {
    if (!selectedId || !form.title.trim()) { setFormError('Titolo obbligatorio'); return }
    setSaving(true); setFormError('')
    const isEdit = panel !== null && panel !== 'new'

    if (isEdit) {
      const { error } = await supabase.from('missions').update({ ...form }).eq('id', (panel as Mission).id)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('missions').insert({ ...form, session_id: selectedId })
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
          className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm">
          + Nuova missione
        </button>
      </div>

      {/* Session selector */}
      <div className="mb-4">
        <label className="block text-xs text-white/50 mb-1">Sessione</label>
        <select value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
      </div>

      {/* Chapter order info box */}
      <div className="bg-[#3A9DBC]/8 border border-[#3A9DBC]/20 rounded-xl px-4 py-3 mb-4">
        <p className="text-xs text-white/50 leading-relaxed">
          <span className="text-[#3A9DBC] font-semibold">ℹ Ordine lista:</span>{' '}
          Il numero "Posizione nella lista" controlla solo l'ordine visivo in cui i giocatori vedono le missioni. Non sblocca né blocca nulla — tutte le missioni sono attive simultaneamente. Usa numeri bassi per le missioni più importanti (1 = prima in lista).
        </p>
      </div>

      {/* Missions list */}
      {missions.length === 0 ? (
        <p className="text-white/40 text-sm">Nessuna missione per questa sessione.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {missions.map(m => (
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

              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_required}
                  onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
                <span>
                  <strong>Missione obbligatoria</strong>
                  <span className="text-white/40 ml-1">— mostrata in evidenza ai giocatori</span>
                </span>
              </label>

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
