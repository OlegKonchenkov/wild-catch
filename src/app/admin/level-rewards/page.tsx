'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Shared types ──────────────────────────────────────────────────────────────

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

interface CatchConfig {
  comune_rate: number
  non_comune_rate: number
  raro_rate: number
  epico_rate: number
  leggendario_rate: number
  mitologico_rate: number
  non_comune_level_bonus: number
  raro_level_bonus: number
  epico_level_bonus: number
  leggendario_level_bonus: number
  mitologico_level_bonus: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SPAWN: SpawnConfig = {
  non_comune_bonus: 0.02,
  raro_bonus: 0.10,
  epico_bonus: 0.20,
  leggendario_bonus: 0.40,
}

const DEFAULT_CATCH: CatchConfig = {
  comune_rate: 0.70,
  non_comune_rate: 0.45,
  raro_rate: 0.25,
  epico_rate: 0.12,
  leggendario_rate: 0.05,
  mitologico_rate: 0.0125,
  non_comune_level_bonus: 0,
  raro_level_bonus: 0,
  epico_level_bonus: 0,
  leggendario_level_bonus: 0,
  mitologico_level_bonus: 0,
}

const SPAWN_LABELS: Record<keyof SpawnConfig, { label: string; color: string }> = {
  non_comune_bonus: { label: '🟢 Non comune', color: '#4ade80' },
  raro_bonus:       { label: '🔵 Raro',        color: '#60a5fa' },
  epico_bonus:      { label: '🟣 Epico',        color: '#c084fc' },
  leggendario_bonus:{ label: '🟡 Leggendario',  color: '#fbbf24' },
}

const PREVIEW_LEVELS = [1, 5, 10, 15, 20]

const BASE_TIER_WEIGHTS: Record<string, number> = {
  comune: 65, non_comune: 22, raro: 7, epico: 4, leggendario: 2, mitologico: 0.5,
}

const ALL_RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico'] as const

const RARITY_BONUS_KEY: Partial<Record<string, keyof SpawnConfig>> = {
  non_comune:  'non_comune_bonus',
  raro:        'raro_bonus',
  epico:       'epico_bonus',
  leggendario: 'leggendario_bonus',
  mitologico:  'leggendario_bonus',
}

const RARITY_DISPLAY: Record<string, { label: string; color: string }> = {
  comune:      { label: 'Terrestre',      color: '#9ca3af' },
  non_comune:  { label: 'Non comune',  color: '#4ade80' },
  raro:        { label: 'Eroico',        color: '#60a5fa' },
  epico:       { label: 'Mostruoso',       color: '#c084fc' },
  leggendario: { label: 'Leggendario', color: '#fbbf24' },
  mitologico:  { label: 'Mitologico',  color: '#FF4D6D' },
}

// Catch rates have no level bonus for comune (it's already high)
const CATCH_RARITIES: Array<{ rarity: typeof ALL_RARITIES[number]; rateKey: keyof CatchConfig; bonusKey: keyof CatchConfig | null }> = [
  { rarity: 'comune',      rateKey: 'comune_rate',      bonusKey: null },
  { rarity: 'non_comune',  rateKey: 'non_comune_rate',  bonusKey: 'non_comune_level_bonus' },
  { rarity: 'raro',        rateKey: 'raro_rate',        bonusKey: 'raro_level_bonus' },
  { rarity: 'epico',       rateKey: 'epico_rate',       bonusKey: 'epico_level_bonus' },
  { rarity: 'leggendario', rateKey: 'leggendario_rate', bonusKey: 'leggendario_level_bonus' },
  { rarity: 'mitologico',  rateKey: 'mitologico_rate',  bonusKey: 'mitologico_level_bonus' },
]

const cls = 'w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3A9DBC]'

type Tab = 'livelli' | 'incontri' | 'cattura'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LevelRewardsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('livelli')

  // Level rewards
  const [rewards, setRewards]           = useState<LevelReward[]>([])
  const [items, setItems]               = useState<Item[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState<number | null>(null)
  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const [form, setForm]                 = useState({ gold: 0, bonus_items: [] as BonusItem[], description: '' })
  const [success, setSuccess]           = useState<number | null>(null)
  const [error, setError]               = useState<string | null>(null)

  // EXP config
  const [expConfig, setExpConfig]   = useState<{ level: number; exp_to_next: number }[]>([])
  const [expSaving, setExpSaving]   = useState<number | null>(null)
  const [expSuccess, setExpSuccess] = useState<number | null>(null)

  // Spawn config
  const [sessions, setSessions]             = useState<{ id: string; name: string }[]>([])
  const [spawnSessionId, setSpawnSessionId] = useState('')
  const [spawnConfig, setSpawnConfig]       = useState<SpawnConfig>({ ...DEFAULT_SPAWN })
  const [spawnLoading, setSpawnLoading]     = useState(false)
  const [spawnSaving, setSpawnSaving]       = useState(false)
  const [spawnSuccess, setSpawnSuccess]     = useState(false)

  // Catch config
  const [catchConfig, setCatchConfig]   = useState<CatchConfig>({ ...DEFAULT_CATCH })
  const [catchLoading, setCatchLoading] = useState(false)
  const [catchSaving, setCatchSaving]   = useState(false)
  const [catchSuccess, setCatchSuccess] = useState(false)
  const [catchError, setCatchError]     = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/level-rewards').then(r => r.json()),
      fetch('/api/admin/items').then(r => r.json()),
      fetch('/api/admin/exp-config').then(r => r.json()),
    ]).then(([rwData, itData, expData]) => {
      setRewards(rwData.rewards ?? [])
      setItems(itData.items ?? [])
      setExpConfig(expData.config ?? [])
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

  useEffect(() => {
    if (activeTab !== 'cattura') return
    setCatchLoading(true)
    fetch('/api/admin/catch-config')
      .then(r => r.json())
      .then(d => { if (d.config) setCatchConfig(d.config) })
      .finally(() => setCatchLoading(false))
  }, [activeTab])

  // ── Level reward helpers ───────────────────────────────────────────────────

  function initBonusItems(reward: LevelReward): BonusItem[] {
    if (reward.bonus_items?.length) return reward.bonus_items
    if (reward.item_id) return [{ item_id: reward.item_id, quantity: reward.item_qty || 1 }]
    return []
  }

  function startEdit(reward: LevelReward) {
    setEditingLevel(reward.level)
    setForm({ gold: reward.gold, bonus_items: initBonusItems(reward), description: reward.description ?? '' })
    setError(null); setSuccess(null)
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
    setForm(f => ({ ...f, bonus_items: f.bonus_items.map((bi, i) => i === idx ? { ...bi, [field]: value } : bi) }))
  }
  function removeBonusItem(idx: number) {
    setForm(f => ({ ...f, bonus_items: f.bonus_items.filter((_, i) => i !== idx) }))
  }

  async function saveExpRow(level: number, expToNext: number) {
    setExpSaving(level)
    const res = await fetch('/api/admin/exp-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, exp_to_next: expToNext }),
    })
    if (res.ok) {
      setExpConfig(prev => prev.map(r => r.level === level ? { ...r, exp_to_next: expToNext } : r))
      setExpSuccess(level); setTimeout(() => setExpSuccess(null), 1500)
    }
    setExpSaving(null)
  }

  // ── Spawn helpers ──────────────────────────────────────────────────────────

  async function saveSpawnConfig() {
    if (!spawnSessionId) return
    setSpawnSaving(true)
    const res = await fetch('/api/admin/spawn-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: spawnSessionId, ...spawnConfig }),
    })
    if (res.ok) { setSpawnSuccess(true); setTimeout(() => setSpawnSuccess(false), 2000) }
    setSpawnSaving(false)
  }

  function multiplierAt(bonus: number, level: number) { return (1 + bonus * level).toFixed(2) }

  function encounterPctsAt(level: number): Record<string, number> {
    const weights = Object.fromEntries(ALL_RARITIES.map(r => {
      const bonusKey = RARITY_BONUS_KEY[r]
      const bonus = bonusKey ? spawnConfig[bonusKey] : 0
      return [r, BASE_TIER_WEIGHTS[r] * (1 + bonus * level)]
    }))
    const total = Object.values(weights).reduce((s, w) => s + w, 0)
    return Object.fromEntries(ALL_RARITIES.map(r => [r, (weights[r] / total) * 100]))
  }

  // ── Catch helpers ──────────────────────────────────────────────────────────

  async function saveCatchConfig() {
    setCatchSaving(true); setCatchError(null)
    const res = await fetch('/api/admin/catch-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catchConfig),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.config) setCatchConfig(data.config)
      setCatchSuccess(true); setTimeout(() => setCatchSuccess(false), 2000)
    } else {
      setCatchError(data.error ?? 'Errore salvataggio')
    }
    setCatchSaving(false)
  }

  // Effective catch rate at a given level (difficulty=normal=×1.0, HP=full=×1.0)
  function catchRateAt(rateKey: keyof CatchConfig, bonusKey: keyof CatchConfig | null, level: number): number {
    const base = catchConfig[rateKey] as number
    const bonus = bonusKey ? (catchConfig[bonusKey] as number) * level : 0
    return Math.min(1.0, base + bonus)
  }

  const itemName = (id: string) => items.find(i => i.id === id)?.name ?? id.slice(0, 8) + '…'

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'livelli',   label: 'Livelli',     icon: '🏆' },
    { key: 'incontri',  label: 'P.Incontri',  icon: '🎲' },
    { key: 'cattura',   label: 'P.Cattura',   icon: '🎯' },
  ]

  return (
    <div className="max-w-2xl">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white/5 border border-white/10 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={activeTab === tab.key
              ? { background: 'rgba(58,157,188,0.25)', color: '#3A9DBC', border: '1px solid rgba(58,157,188,0.4)' }
              : { color: 'rgba(255,255,255,0.4)' }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══ TAB: LIVELLI ══════════════════════════════════════════════════════ */}
      {activeTab === 'livelli' && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">🏆 Ricompense per Livello</h1>
            <p className="text-white/40 text-sm mt-1">Oro e oggetti assegnati automaticamente al level-up</p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
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

          <button
            onClick={() => {
              const maxLevel = rewards.length > 0 ? Math.max(...rewards.map(r => r.level)) : 0
              const newLevel = maxLevel + 1
              if (rewards.some(r => r.level === newLevel)) return
              setRewards(prev => [...prev, { id: `new-${newLevel}`, level: newLevel, gold: 0, item_id: null, item_qty: 1, bonus_items: [], description: '' }])
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

          {/* EXP Curve */}
          {expConfig.length > 0 && (
            <div className="border-t border-white/10 pt-8">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white">⚡ Curva EXP per Livello</h2>
                <p className="text-white/40 text-sm mt-1">
                  EXP necessaria per avanzare da ogni livello al successivo. Globale per tutte le sessioni.
                </p>
              </div>
              <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left px-3 py-2 text-white/40 font-semibold">Livello</th>
                        <th className="text-center px-3 py-2 text-white/40 font-semibold">EXP per avanzare</th>
                        <th className="text-right px-3 py-2 text-white/40 font-semibold">Totale cumulativo</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {expConfig.map((row, idx) => {
                        const cumulative = expConfig.slice(0, idx + 1).reduce((s, r) => s + r.exp_to_next, 0)
                        const isSaving  = expSaving === row.level
                        const isSuccess = expSuccess === row.level
                        return (
                          <tr key={row.level} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 text-white/60 font-mono">Lv {row.level} → {row.level + 1}</td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number" min={1} max={9999}
                                value={row.exp_to_next}
                                onChange={e => setExpConfig(prev =>
                                  prev.map(r => r.level === row.level ? { ...r, exp_to_next: Number(e.target.value) || 1 } : r)
                                )}
                                className="w-20 bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-[#3A9DBC]"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-white/35 font-mono">{cumulative} EXP</td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => saveExpRow(row.level, row.exp_to_next)}
                                disabled={isSaving}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                                style={{
                                  background: isSuccess ? 'rgba(52,211,153,0.2)' : 'rgba(58,157,188,0.15)',
                                  color: isSuccess ? '#34D399' : '#3A9DBC',
                                  border: `1px solid ${isSuccess ? 'rgba(52,211,153,0.4)' : 'rgba(58,157,188,0.3)'}`,
                                }}>
                                {isSaving ? '…' : isSuccess ? '✓' : 'Salva'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-white/20 text-xs text-center mt-2">
                Modifica il valore e clicca Salva sulla riga. Ha effetto immediato sui nuovi guadagni EXP.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: P.INCONTRI ═══════════════════════════════════════════════════ */}
      {activeTab === 'incontri' && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">🎲 Probabilità Incontri</h1>
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

              {/* Multiplier preview */}
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
                        <td className="px-3 py-2 text-white/30">Terrestre</td>
                        {PREVIEW_LEVELS.map(lv => (
                          <td key={lv} className="text-center px-2 py-2 text-white/30 font-mono">×1.00</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Encounter % preview */}
              <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden mb-4">
                <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 pt-3 pb-2 font-semibold">
                  % incontro per rarità per livello
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
                      {ALL_RARITIES.map(rarity => {
                        const display = RARITY_DISPLAY[rarity]
                        return (
                          <tr key={rarity} className="border-b border-white/5">
                            <td className="px-3 py-2 font-semibold" style={{ color: display.color }}>{display.label}</td>
                            {PREVIEW_LEVELS.map(lv => {
                              const pct = encounterPctsAt(lv)[rarity]
                              return (
                                <td key={lv} className="text-center px-2 py-2 font-mono"
                                  style={{ color: pct < 1 ? '#a78bfa' : pct < 5 ? '#c084fc' : pct < 15 ? '#60a5fa' : pct < 40 ? '#4ade80' : '#9ca3af' }}>
                                  {pct.toFixed(1)}%
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button onClick={saveSpawnConfig} disabled={spawnSaving || !spawnSessionId}
                className={`w-full font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${
                  spawnSuccess ? 'bg-[#34d399] text-white' : 'bg-[#3A9DBC] text-white'
                }`}>
                {spawnSaving ? 'Salvataggio...' : spawnSuccess ? '✓ Salvato!' : 'Salva configurazione spawn'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ TAB: P.CATTURA ════════════════════════════════════════════════════ */}
      {activeTab === 'cattura' && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">🎯 Probabilità Cattura</h1>
            <p className="text-white/40 text-sm mt-1">
              Tasso base di cattura per rarità (HP pieno, difficoltà normale). Il bonus livello aumenta la probabilità
              di cattura man mano che il giocatore sale di livello.
            </p>
          </div>

          {catchLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Per-rarity sliders */}
              <div className="space-y-4 mb-6">
                {CATCH_RARITIES.map(({ rarity, rateKey, bonusKey }) => {
                  const display = RARITY_DISPLAY[rarity]
                  const rate = catchConfig[rateKey] as number
                  const bonus = bonusKey ? catchConfig[bonusKey] as number : 0
                  return (
                    <div key={rarity} className="rounded-xl p-3 border" style={{
                      background: `${display.color}08`,
                      borderColor: `${display.color}25`,
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold" style={{ color: display.color }}>{display.label}</span>
                        <span className="text-xs text-white/30 font-mono ml-auto">{(rate * 100).toFixed(1)}% base</span>
                      </div>

                      {/* Base rate slider */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-white/40 uppercase tracking-wider">Tasso base</label>
                          <span className="text-[10px] font-mono" style={{ color: display.color }}>
                            {(rate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.005}
                          value={rate}
                          onChange={e => setCatchConfig(c => ({ ...c, [rateKey]: Number(e.target.value) }))}
                          className="w-full"
                          style={{ accentColor: display.color }}
                        />
                      </div>

                      {/* Level bonus slider — only for non-comune */}
                      {bonusKey && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-white/40 uppercase tracking-wider">Bonus per livello</label>
                            <span className="text-[10px] font-mono text-white/40">
                              +{(bonus * 100).toFixed(2)}% / lv
                            </span>
                          </div>
                          <input
                            type="range" min={0} max={0.05} step={0.001}
                            value={bonus}
                            onChange={e => setCatchConfig(c => ({ ...c, [bonusKey]: Number(e.target.value) }))}
                            className="w-full accent-[#3A9DBC]"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Preview table */}
              <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden mb-4">
                <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 pt-3 pb-2 font-semibold">
                  % cattura per rarità per livello (difficoltà normale, HP pieno)
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
                      {CATCH_RARITIES.map(({ rarity, rateKey, bonusKey }) => {
                        const display = RARITY_DISPLAY[rarity]
                        return (
                          <tr key={rarity} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 font-semibold" style={{ color: display.color }}>{display.label}</td>
                            {PREVIEW_LEVELS.map(lv => {
                              const pct = catchRateAt(rateKey, bonusKey, lv) * 100
                              return (
                                <td key={lv} className="text-center px-2 py-2 font-mono"
                                  style={{ color: pct >= 60 ? '#4ade80' : pct >= 30 ? '#60a5fa' : pct >= 10 ? '#c084fc' : '#f87171' }}>
                                  {pct.toFixed(1)}%
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-white/20 px-3 pb-3 mt-1">
                  Il bonus livello si applica solo alle rarità superiori a Terrestre. Valori sopra 100% vengono troncati a 100%.
                </p>
              </div>

              {catchError && (
                <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mb-3">{catchError}</p>
              )}

              <button
                onClick={saveCatchConfig}
                disabled={catchSaving}
                className="w-full font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
                style={{
                  background: catchSuccess ? '#34d399' : '#3A9DBC',
                  color: 'white',
                }}
              >
                {catchSaving ? 'Salvataggio...' : catchSuccess ? '✓ Salvato!' : 'Salva configurazione cattura'}
              </button>

              <p className="text-white/20 text-xs text-center mt-3 leading-relaxed">
                Globale per tutte le sessioni. Le modifiche hanno effetto immediato sui successivi tentativi di cattura.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
