'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BonusItem { item_id: string; quantity: number }

interface LevelReward {
  id: string
  level: number
  gold: number
  item_id: string | null
  item_qty: number
  bonus_items: BonusItem[]
  description: string
  items?: { id: string; name: string; type: string } | null
}

interface Item { id: string; name: string; type: string }

interface SpawnConfig {
  non_comune_bonus: number
  raro_bonus: number
  epico_bonus: number
  leggendario_bonus: number
}

const DEFAULT_SPAWN: SpawnConfig = {
  non_comune_bonus: 0.02,
  raro_bonus: 0.10,
  epico_bonus: 0.20,
  leggendario_bonus: 0.40,
}

const SPAWN_LABELS: Record<keyof SpawnConfig, { label: string; color: string }> = {
  non_comune_bonus: { label: '🟢 Non comune', color: '#4ade80' },
  raro_bonus:       { label: '🔵 Raro',        color: '#60a5fa' },
  epico_bonus:      { label: '🟣 Epico',        color: '#c084fc' },
  leggendario_bonus:{ label: '🟡 Leggendario',  color: '#fbbf24' },
}

const PREVIEW_LEVELS = [1, 5, 10, 15, 20]

const cls = 'w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3A9DBC]'

export default function LevelRewardsPage() {
  const [rewards, setRewards]       = useState<LevelReward[]>([])
  const [items, setItems]           = useState<Item[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState<number | null>(null)
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const [form, setForm]             = useState({ gold: 0, bonus_items: [] as BonusItem[], description: '' })
  const [success, setSuccess]       = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)

  // Spawn config
  const [sessions, setSessions]         = useState<{ id: string; name: string }[]>([])
  const [spawnSessionId, setSpawnSessionId] = useState('')
  const [spawnConfig, setSpawnConfig]   = useState<SpawnConfig>({ ...DEFAULT_SPAWN })
  const [spawnLoading, setSpawnLoading] = useState(false)
  const [spawnSaving, setSpawnSaving]   = useState(false)
  const [spawnSuccess, setSpawnSuccess] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/level-rewards').then(r => r.json()),
      fetch('/api/admin/items').then(r => r.json()),
    ]).then(([rwData, itData]) => {
      setRewards(rwData.rewards ?? [])
      setItems(itData.items ?? [])
      setLoading(false)
    })
    supabase.from('sessions').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0]) setSpawnSessionId(data[0].id) } })
  }, [supabase])

  useEffect(() => {
    if (!spawnSessionId) return
    setSpawnLoading(true)
    fetch(`/api/admin/spawn-config?sessionId=${spawnSessionId}`)
      .then(r => r.json())
      .then(d => { if (d.config) setSpawnConfig(d.config) })
      .finally(() => setSpawnLoading(false))
  }, [spawnSessionId])

  function initBonusItems(reward: LevelReward): BonusItem[] {
    // Prefer bonus_items array; fall back to legacy item_id/item_qty
    if (reward.bonus_items?.length) return reward.bonus_items
    if (reward.item_id) return [{ item_id: reward.item_id, quantity: reward.item_qty || 1 }]
    return []
  }

  function startEdit(reward: LevelReward) {
    setEditingLevel(reward.level)
    setForm({
      gold: reward.gold,
      bonus_items: initBonusItems(reward),
      description: reward.description ?? '',
    })
    setError(null)
    setSuccess(null)
  }

  async function saveReward(level: number) {
    setSaving(level); setError(null)
    const res = await fetch('/api/admin/level-rewards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        gold: form.gold,
        bonus_items: form.bonus_items,
        item_id: form.bonus_items[0]?.item_id ?? null,
        item_qty: form.bonus_items[0]?.quantity ?? 1,
        description: form.description,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setRewards(prev => prev.map(r => r.level === level ? { ...r, ...data.reward } : r))
      setSuccess(level); setEditingLevel(null)
      setTimeout(() => setSuccess(null), 2000)
    } else {
      setError(data.error ?? 'Errore salvataggio')
    }
    setSaving(null)
  }

  function addBonusItem() {
    setForm(f => ({ ...f, bonus_items: [...f.bonus_items, { item_id: '', quantity: 1 }] }))
  }

  function updateBonusItem(idx: number, field: keyof BonusItem, value: string | number) {
    setForm(f => ({
      ...f,
      bonus_items: f.bonus_items.map((bi, i) => i === idx ? { ...bi, [field]: value } : bi),
    }))
  }

  function removeBonusItem(idx: number) {
    setForm(f => ({ ...f, bonus_items: f.bonus_items.filter((_, i) => i !== idx) }))
  }

  async function saveSpawnConfig() {
    if (!spawnSessionId) return
    setSpawnSaving(true)
    const res = await fetch('/api/admin/spawn-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: spawnSessionId, ...spawnConfig }),
    })
    if (res.ok) {
      setSpawnSuccess(true)
      setTimeout(() => setSpawnSuccess(false), 2000)
    }
    setSpawnSaving(false)
  }

  // Preview table: effective weight multiplier = 1 + bonus × level
  function multiplierAt(bonus: number, level: number) {
    return (1 + bonus * level).toFixed(2)
  }

  const itemName = (id: string) => items.find(i => i.id === id)?.name ?? id.slice(0, 8) + '…'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🏆 Ricompense per Livello</h1>
        <p className="text-white/40 text-sm mt-1">
          Oro e oggetti assegnati automaticamente al level-up
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map(reward => {
            const isEditing = editingLevel === reward.level
            const isSaving  = saving === reward.level
            const isSuccess = success === reward.level
            const bonusItems = initBonusItems(reward)

            return (
              <div key={reward.level} className="rounded-2xl border transition-all" style={{
                background: isEditing ? 'rgba(58,157,188,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isEditing ? 'rgba(58,157,188,0.4)' : 'rgba(255,255,255,0.08)'}`,
              }}>
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
                        <input type="number" min={0} value={form.gold}
                          onChange={e => setForm(f => ({ ...f, gold: Number(e.target.value) }))}
                          className={cls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Descrizione</label>
                        <input type="text" value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="es. Cacciatore esperto"
                          className={cls} />
                      </div>
                    </div>

                    {/* Bonus items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] text-white/40 uppercase tracking-wider">Oggetti bonus</label>
                        <button type="button" onClick={addBonusItem}
                          className="text-xs text-[#3A9DBC] hover:text-[#3A9DBC]/80 font-semibold">
                          + Aggiungi oggetto
                        </button>
                      </div>
                      {form.bonus_items.length === 0 ? (
                        <p className="text-xs text-white/25 italic">Nessun oggetto bonus · tocca "Aggiungi oggetto"</p>
                      ) : (
                        <div className="space-y-2">
                          {form.bonus_items.map((bi, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <select value={bi.item_id}
                                onChange={e => updateBonusItem(idx, 'item_id', e.target.value)}
                                className="flex-1 bg-[#0F1F2E] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#3A9DBC]">
                                <option value="">— Seleziona oggetto —</option>
                                {items.map(item => (
                                  <option key={item.id} value={item.id}>{item.name} ({item.type})</option>
                                ))}
                              </select>
                              <input type="number" min={1} value={bi.quantity}
                                onChange={e => updateBonusItem(idx, 'quantity', Number(e.target.value))}
                                className="w-16 bg-[#0F1F2E] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:border-[#3A9DBC]"
                                placeholder="Qty" />
                              <button type="button" onClick={() => removeBonusItem(idx)}
                                className="text-red-400/50 hover:text-red-400 text-xs px-1.5 py-1.5 rounded transition-colors">
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                    <div className="flex gap-2">
                      <button onClick={() => saveReward(reward.level)} disabled={isSaving}
                        className="flex-1 bg-[#3A9DBC] text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                        {isSaving ? 'Salvataggio...' : 'Salva'}
                      </button>
                      <button onClick={() => setEditingLevel(null)}
                        className="px-4 py-2 rounded-xl text-sm text-white/50 bg-white/5 border border-white/10">
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => startEdit(reward)}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{
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
                    <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                      {reward.gold > 0 && (
                        <span className="text-xs text-[#D4A96A] font-semibold">💰 {reward.gold}</span>
                      )}
                      {bonusItems.map((bi, idx) => bi.item_id && (
                        <span key={idx} className="text-xs text-white/40">
                          +{bi.quantity}× {itemName(bi.item_id)}
                        </span>
                      ))}
                      <span className="text-white/20 text-xs">✏️</span>
                    </div>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add new level */}
      <button
        onClick={() => {
          const maxLevel = rewards.length > 0 ? Math.max(...rewards.map(r => r.level)) : 0
          const newLevel = maxLevel + 1
          if (rewards.some(r => r.level === newLevel)) return
          const newReward: LevelReward = { id: `new-${newLevel}`, level: newLevel, gold: 0, item_id: null, item_qty: 1, bonus_items: [], description: '' }
          setRewards(prev => [...prev, newReward])
          setEditingLevel(newLevel)
          setForm({ gold: 0, bonus_items: [], description: '' })
          setError(null); setSuccess(null)
        }}
        className="w-full mt-3 py-3 rounded-2xl text-sm font-bold text-[#3A9DBC] border border-dashed transition-all hover:bg-[#3A9DBC]/08"
        style={{ borderColor: 'rgba(58,157,188,0.35)', background: 'rgba(58,157,188,0.04)' }}
      >
        + Aggiungi livello {rewards.length > 0 ? Math.max(...rewards.map(r => r.level)) + 1 : 1}
      </button>

      <p className="text-white/20 text-xs text-center mt-4 mb-10 leading-relaxed">
        Tocca un livello per modificarne la ricompensa. Le modifiche hanno effetto immediato per i futuri level-up.
      </p>

      {/* ── Spawn Config Section ── */}
      <div className="border-t border-white/10 pt-8">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">🎲 Probabilità Creature (per sessione)</h2>
          <p className="text-white/40 text-sm mt-1">
            Configura quanto spesso appaiono creature di rarità superiore man mano che il giocatore sale di livello.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-white/50 mb-1">Sessione</label>
          <select value={spawnSessionId} onChange={e => setSpawnSessionId(e.target.value)}
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {spawnLoading ? (
          <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {(Object.keys(SPAWN_LABELS) as (keyof SpawnConfig)[]).map(key => {
                const meta = SPAWN_LABELS[key]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</label>
                      <span className="text-xs text-white/40 font-mono">
                        +{(spawnConfig[key] * 100).toFixed(0)}% per livello
                      </span>
                    </div>
                    <input type="range" min={0} max={1} step={0.01}
                      value={spawnConfig[key]}
                      onChange={e => setSpawnConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                      className="w-full accent-[#3A9DBC]"
                    />
                  </div>
                )
              })}
            </div>

            {/* Preview table */}
            <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden mb-4">
              <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 pt-3 pb-2 font-semibold">
                Moltiplicatore peso spawn (×base) per livello
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-3 py-2 text-white/40 font-semibold">Rarità</th>
                      {PREVIEW_LEVELS.map(lv => (
                        <th key={lv} className="text-center px-2 py-2 text-white/40 font-semibold">Lv.{lv}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(SPAWN_LABELS) as (keyof SpawnConfig)[]).map(key => (
                      <tr key={key} className="border-b border-white/5">
                        <td className="px-3 py-2 font-semibold" style={{ color: SPAWN_LABELS[key].color }}>
                          {SPAWN_LABELS[key].label.replace(/[🟢🔵🟣🟡] /, '')}
                        </td>
                        {PREVIEW_LEVELS.map(lv => (
                          <td key={lv} className="text-center px-2 py-2 text-white/60 font-mono">
                            ×{multiplierAt(spawnConfig[key], lv)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-2 text-white/30">Comune</td>
                      {PREVIEW_LEVELS.map(lv => (
                        <td key={lv} className="text-center px-2 py-2 text-white/30 font-mono">×1.00</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={saveSpawnConfig} disabled={spawnSaving || !spawnSessionId}
              className={`w-full font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${
                spawnSuccess
                  ? 'bg-[#34d399] text-white'
                  : 'bg-[#3A9DBC] text-white'
              }`}>
              {spawnSaving ? 'Salvataggio...' : spawnSuccess ? '✓ Salvato!' : 'Salva configurazione spawn'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
