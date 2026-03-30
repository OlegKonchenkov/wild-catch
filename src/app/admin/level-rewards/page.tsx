'use client'
import { useState, useEffect } from 'react'

interface LevelReward {
  id: string
  level: number
  gold: number
  item_id: string | null
  item_qty: number
  description: string
  items?: { id: string; name: string; type: string } | null
}

interface Item { id: string; name: string; type: string }

export default function LevelRewardsPage() {
  const [rewards, setRewards]   = useState<LevelReward[]>([])
  const [items, setItems]       = useState<Item[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<number | null>(null)
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const [form, setForm]         = useState({ gold: 0, item_id: '', item_qty: 1, description: '' })
  const [success, setSuccess]   = useState<number | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/level-rewards').then(r => r.json()),
      fetch('/api/admin/items').then(r => r.json()),
    ]).then(([rwData, itData]) => {
      setRewards(rwData.rewards ?? [])
      setItems(itData.items ?? [])
      setLoading(false)
    })
  }, [])

  function startEdit(reward: LevelReward) {
    setEditingLevel(reward.level)
    setForm({
      gold: reward.gold,
      item_id: reward.item_id ?? '',
      item_qty: reward.item_qty ?? 1,
      description: reward.description ?? '',
    })
    setError(null)
    setSuccess(null)
  }

  async function saveReward(level: number) {
    setSaving(level)
    setError(null)
    const res = await fetch('/api/admin/level-rewards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        gold: form.gold,
        item_id: form.item_id || null,
        item_qty: form.item_qty,
        description: form.description,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setRewards(prev => prev.map(r => r.level === level ? { ...r, ...data.reward } : r))
      setSuccess(level)
      setEditingLevel(null)
      setTimeout(() => setSuccess(null), 2000)
    } else {
      setError(data.error ?? 'Errore salvataggio')
    }
    setSaving(null)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Ricompense per Livello</h1>
        <p className="text-white/40 text-sm mt-1">
          Configura oro e oggetti assegnati automaticamente al level-up
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map(reward => {
            const isEditing = editingLevel === reward.level
            const isSaving = saving === reward.level
            const isSuccess = success === reward.level

            return (
              <div
                key={reward.level}
                className="rounded-2xl border transition-all"
                style={{
                  background: isEditing ? 'rgba(58,157,188,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isEditing ? 'rgba(58,157,188,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {isEditing ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-full bg-[#F7C841]/20 border border-[#F7C841]/40 flex items-center justify-center">
                        <span className="text-sm font-extrabold text-[#F7C841]">{reward.level}</span>
                      </div>
                      <span className="text-white font-bold">Livello {reward.level}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Oro 💰</label>
                        <input
                          type="number"
                          min={0}
                          value={form.gold}
                          onChange={e => setForm(f => ({ ...f, gold: Number(e.target.value) }))}
                          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3A9DBC]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Quantità oggetto</label>
                        <input
                          type="number"
                          min={1}
                          value={form.item_qty}
                          onChange={e => setForm(f => ({ ...f, item_qty: Number(e.target.value) }))}
                          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3A9DBC]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Oggetto bonus (opzionale)</label>
                      <select
                        value={form.item_id}
                        onChange={e => setForm(f => ({ ...f, item_id: e.target.value }))}
                        className="w-full bg-[#0F1F2E] border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3A9DBC]"
                      >
                        <option value="">— Nessun oggetto —</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name} ({item.type})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Descrizione</label>
                      <input
                        type="text"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="es. Cacciatore esperto"
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3A9DBC]"
                      />
                    </div>

                    {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveReward(reward.level)}
                        disabled={isSaving}
                        className="flex-1 bg-[#3A9DBC] text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50"
                      >
                        {isSaving ? 'Salvataggio...' : 'Salva'}
                      </button>
                      <button
                        onClick={() => setEditingLevel(null)}
                        className="px-4 py-2 rounded-xl text-sm text-white/50 bg-white/5 border border-white/10"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => startEdit(reward)}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isSuccess ? 'rgba(52,211,153,0.2)' : 'rgba(247,200,65,0.1)',
                        border: `1px solid ${isSuccess ? 'rgba(52,211,153,0.5)' : 'rgba(247,200,65,0.3)'}`,
                      }}>
                      <span className="text-sm font-extrabold" style={{ color: isSuccess ? '#34D399' : '#F7C841' }}>
                        {isSuccess ? '✓' : reward.level}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">Livello {reward.level}</p>
                      {reward.description && (
                        <p className="text-white/40 text-xs truncate">{reward.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {reward.gold > 0 && (
                        <span className="text-xs text-[#D4A96A] font-semibold">💰 {reward.gold}</span>
                      )}
                      {reward.items?.name && (
                        <span className="text-xs text-white/40">+{reward.item_qty}× {reward.items.name}</span>
                      )}
                      <span className="text-white/20 text-xs">✏️</span>
                    </div>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-white/20 text-xs text-center mt-6 leading-relaxed">
        Tocca un livello per modificarne la ricompensa. Le modifiche hanno effetto immediato per i futuri level-up.
      </p>
    </div>
  )
}
