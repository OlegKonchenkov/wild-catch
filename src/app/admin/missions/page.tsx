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

const MISSION_TYPES = ['cattura', 'duel', 'qr', 'walk', 'collect']

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
          {showForm ? '✕ Annulla' : '+ Nuova'}
        </button>
      </div>

      <div className="mb-4">
        <select
          value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 w-full"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titolo missione" className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descrizione" rows={2} className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
              {MISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              placeholder="Target (es. Ignis)" className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: +e.target.value }))}
              placeholder="Quantità" className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={form.chapter_order} onChange={e => setForm(f => ({ ...f, chapter_order: +e.target.value }))}
              placeholder="Ordine capitolo" className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={form.reward_gold} onChange={e => setForm(f => ({ ...f, reward_gold: +e.target.value }))}
              placeholder="Oro ricompensa" className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={form.reward_exp} onChange={e => setForm(f => ({ ...f, reward_exp: +e.target.value }))}
              placeholder="EXP ricompensa" className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
            Missione obbligatoria
          </label>
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#E85D2F] text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Salva Missione'}
          </button>
        </div>
      )}

      {missions.length === 0 ? (
        <p className="text-white/40 text-sm">Nessuna missione. Creane una!</p>
      ) : (
        <div className="space-y-2">
          {missions.map(m => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">
                    {m.is_required ? '⭐ ' : ''}{m.chapter_order}. {m.title}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">{m.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-white/40">
                    <span>{m.type} · {m.target} ×{m.target_count}</span>
                    <span>🪙 {m.reward_gold} · ✨ {m.reward_exp} EXP</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(m.id)}
                  className="text-red-400 hover:text-red-300 text-sm px-2">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
