'use client'
import { useState, useEffect, useMemo } from 'react'
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

const MISSION_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'cattura',  label: 'Cattura creatura',  hint: 'Il giocatore deve catturare una creatura specifica' },
  { value: 'duel',     label: 'Duello PvP',         hint: 'Il giocatore deve vincere un duello contro altri giocatori' },
  { value: 'qr',       label: 'Scansione QR',       hint: 'Il giocatore deve scansionare un QR code specifico' },
  { value: 'walk',     label: 'Cammino (metri)',     hint: 'Il giocatore deve percorrere una distanza in metri' },
  { value: 'collect',  label: 'Raccolta oggetti',   hint: 'Il giocatore deve raccogliere un numero di oggetti' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

export default function AdminMissions() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: 'cattura', target: '',
    target_count: 1, reward_gold: 50, reward_exp: 100,
    chapter_order: 1, is_required: false,
  })
  const [saving, setSaving] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) } })
  }, [supabase])

  const loadMissions = (sid: string) => {
    supabase.from('missions').select('*').eq('session_id', sid).order('chapter_order')
      .then(({ data }) => { if (data) setMissions(data as Mission[]) })
  }

  useEffect(() => { if (selectedId) loadMissions(selectedId) }, [selectedId])

  const selectedTypeInfo = MISSION_TYPES.find(t => t.value === form.type)

  async function handleSave() {
    if (!selectedId || !form.title.trim()) return
    setSaving(true)
    await supabase.from('missions').insert({ ...form, session_id: selectedId })
    setShowForm(false)
    setForm({ title: '', description: '', type: 'cattura', target: '', target_count: 1, reward_gold: 50, reward_exp: 100, chapter_order: missions.length + 1, is_required: false })
    loadMissions(selectedId)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa missione?')) return
    await supabase.from('missions').delete().eq('id', id)
    setMissions(ms => ms.filter(m => m.id !== id))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">🎯 Missioni</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm">
          {showForm ? '✕ Annulla' : '+ Nuova missione'}
        </button>
      </div>

      {/* Session selector */}
      <div className="mb-4">
        <label className="block text-xs text-white/50 mb-1">Sessione di riferimento</label>
        <select
          value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 w-full"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      {/* Creation form */}
      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="font-bold text-white text-base">Nuova missione</h2>

          <Field label="Titolo missione *" hint="Nome breve mostrato al giocatore nella lista missioni">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="es. Cattura il Drago di Fuoco"
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          </Field>

          <Field label="Descrizione" hint="Testo esteso che spiega come completare la missione">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="es. Trova e cattura la creatura Ignis nelle zone vulcaniche..."
              rows={2} className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm resize-none" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo missione" hint={selectedTypeInfo?.hint}>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
                {MISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            <Field
              label="Target"
              hint={
                form.type === 'cattura' ? 'Nome della creatura da catturare (es. Ignis)' :
                form.type === 'qr'      ? "ID o etichetta del QR code da scansionare" :
                form.type === 'walk'    ? 'Lascia vuoto (si usa solo target_count)' :
                'Identificativo dell\'oggetto o azione'
              }
            >
              <input value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                placeholder={form.type === 'cattura' ? 'es. Ignis' : form.type === 'walk' ? '— non necessario —' : 'es. item_id...'}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            </Field>

            <Field
              label={form.type === 'walk' ? 'Distanza da percorrere (metri)' : 'Quantità richiesta'}
              hint={
                form.type === 'cattura' ? 'Quante creature catturare' :
                form.type === 'duel'    ? 'Quanti duelli vincere' :
                form.type === 'walk'    ? 'Distanza in metri da percorrere' :
                'Numero di unità da completare'
              }
            >
              <input type="number" value={form.target_count} min={1}
                onChange={e => setForm(f => ({ ...f, target_count: +e.target.value }))}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            </Field>

            <Field label="Ordine capitolo" hint="Posizione nella sequenza delle missioni (1 = prima missione)">
              <input type="number" value={form.chapter_order} min={1}
                onChange={e => setForm(f => ({ ...f, chapter_order: +e.target.value }))}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            </Field>

            <Field label="Ricompensa Oro 🪙" hint="Oro assegnato al completamento">
              <input type="number" value={form.reward_gold} min={0}
                onChange={e => setForm(f => ({ ...f, reward_gold: +e.target.value }))}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            </Field>

            <Field label="Ricompensa EXP ✨" hint="Punti esperienza assegnati al completamento">
              <input type="number" value={form.reward_exp} min={0}
                onChange={e => setForm(f => ({ ...f, reward_exp: +e.target.value }))}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_required}
              onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
            <span>
              <strong>Missione obbligatoria</strong>
              <span className="text-white/40 ml-1">— i giocatori devono completarla per avanzare</span>
            </span>
          </label>

          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="w-full bg-[#E85D2F] text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Salvataggio...' : '✅ Salva Missione'}
          </button>
        </div>
      )}

      {/* Mission list */}
      {missions.length === 0 ? (
        <p className="text-white/40 text-sm">Nessuna missione per questa sessione.</p>
      ) : (
        <div className="space-y-2">
          {missions.map(m => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">
                    {m.is_required ? '⭐ ' : ''}{m.chapter_order}. {m.title}
                  </p>
                  {m.description && <p className="text-xs text-white/50 mt-0.5">{m.description}</p>}
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/40">
                    <span className="bg-white/5 px-2 py-0.5 rounded">{MISSION_TYPES.find(t => t.value === m.type)?.label ?? m.type}</span>
                    {m.target && <span>🎯 {m.target}</span>}
                    <span>×{m.target_count}</span>
                    <span>🪙 {m.reward_gold}</span>
                    <span>✨ {m.reward_exp} EXP</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(m.id)}
                  className="text-red-400 hover:text-red-300 text-sm px-2 shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
