'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { motion, AnimatePresence } from 'framer-motion'
import { EQUIPMENT_SLOTS, EQUIPMENT_SLOT_META } from '@/lib/game/equipment'
import { scaleCombatStats } from '@/lib/game/combat'
import { RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
import type { EquipmentSlot, Rarity } from '@/lib/types'

interface EquipItemInfo {
  id: string
  name: string
  type: EquipmentSlot
  description: string | null
  image_url: string | null
  rarity: Rarity | null
  bonus_hp: number
  bonus_atk: number
  bonus_def: number
}
interface EquippedRow { slot: EquipmentSlot; item_id: string; items: EquipItemInfo | null }
interface InvRow { id: string; quantity: number; items: EquipItemInfo | null }

export default function EquipmentManager({
  sessionId, playerCreatureId, baseHp, baseAtk, baseDef, playerLevel, onChanged,
}: {
  sessionId: string | null
  playerCreatureId: string
  baseHp: number
  baseAtk: number
  baseDef: number
  playerLevel: number
  onChanged?: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [equipped, setEquipped] = useState<EquippedRow[]>([])
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerSlot, setPickerSlot] = useState<EquipmentSlot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    if (!sessionId) { setLoading(false); return }
    const user = await getCurrentUser(supabase)
    if (!user) { setLoading(false); return }
    const [eqRes, invRes] = await Promise.all([
      fetch(`/api/game/creature/equipment?playerCreatureId=${playerCreatureId}`).then(r => r.json()).catch(() => ({ equipment: [] })),
      supabase
        .from('player_inventory')
        .select('id, quantity, items(id, name, type, description, image_url, rarity, bonus_hp, bonus_atk, bonus_def)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .gt('quantity', 0),
    ])
    setEquipped((eqRes.equipment ?? []) as EquippedRow[])
    const inv = ((invRes.data ?? []) as unknown as InvRow[]).filter(
      r => r.items && (EQUIPMENT_SLOTS as string[]).includes(r.items.type),
    )
    setInventory(inv)
    setLoading(false)
  }, [supabase, sessionId, playerCreatureId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() fetches then sets state; mirrors the app-wide data-load pattern
  useEffect(() => { load() }, [load])

  const bySlot = useMemo(() => {
    const m: Partial<Record<EquipmentSlot, EquippedRow>> = {}
    for (const e of equipped) m[e.slot] = e
    return m
  }, [equipped])

  const bonus = useMemo(() => {
    let hp = 0, atk = 0, def = 0
    for (const e of equipped) {
      hp += e.items?.bonus_hp ?? 0
      atk += e.items?.bonus_atk ?? 0
      def += e.items?.bonus_def ?? 0
    }
    return { hp, atk, def }
  }, [equipped])

  const baseStats = scaleCombatStats({ hp: baseHp, atk: baseAtk, def: baseDef }, playerLevel)
  const effStats = scaleCombatStats({ hp: baseHp, atk: baseAtk, def: baseDef }, playerLevel, bonus)

  async function equip(slot: EquipmentSlot, itemId: string) {
    if (!sessionId || busy) return
    setBusy(true); setError('')
    const res = await fetch('/api/game/creature/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerCreatureId, slot, itemId }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    setPickerSlot(null)
    await load()
    onChanged?.()
  }

  async function unequip(slot: EquipmentSlot) {
    if (!sessionId || busy) return
    setBusy(true); setError('')
    const res = await fetch('/api/game/creature/equipment', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerCreatureId, slot }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    await load()
    onChanged?.()
  }

  if (loading) {
    return <p className="text-white/30 text-sm py-6 text-center">Carico equipaggiamento…</p>
  }

  const STAT_COLORS = { hp: '#F87171', atk: '#FB923C', def: '#60A5FA' }

  return (
    <div className="space-y-4">
      {/* Effective stats summary */}
      <div>
        <p className="text-[11px] text-white/35 uppercase tracking-widest font-bold mb-2.5">Statistiche con equip</p>
        <div className="grid grid-cols-3 gap-2">
          {(['hp', 'atk', 'def'] as const).map(k => {
            const label = k.toUpperCase()
            const color = STAT_COLORS[k]
            const eff = effStats[k]
            const baseV = baseStats[k]
            const diff = eff - baseV
            return (
              <div key={k} className="rounded-xl p-3 text-center"
                style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                <p className="text-xl font-black" style={{ color }}>{eff}</p>
                <p className="text-[10px] font-bold text-white/50 mt-0.5">{label}</p>
                {diff > 0 && (
                  <p className="text-[10px] font-bold mt-1" style={{ color: '#34D399' }}>+{diff}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Slots */}
      <div className="space-y-2">
        {EQUIPMENT_SLOTS.map(slot => {
          const meta = EQUIPMENT_SLOT_META[slot]
          const eq = bySlot[slot]
          const it = eq?.items ?? null
          const rColor = it?.rarity ? RARITY_COLORS[it.rarity] : meta.color
          return (
            <div key={slot} className="rounded-xl px-3 py-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${rColor}30` }}>
              <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
                style={{ background: `${meta.color}14` }}>
                {it?.image_url
                  ? <img src={it.image_url} alt="" className="w-full h-full object-contain p-1" />
                  : <span className="text-xl">{meta.emoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">{meta.label}</p>
                {it ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{it.name}</p>
                      {it.rarity && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: `${rColor}1A`, color: rColor, border: `1px solid ${rColor}40` }}>
                          {RARITY_LABELS[it.rarity]}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {it.bonus_hp ? <span className="mr-2 text-[#34D399]">+{it.bonus_hp} HP</span> : null}
                      {it.bonus_atk ? <span className="mr-2 text-[#FB923C]">+{it.bonus_atk} ATK</span> : null}
                      {it.bonus_def ? <span className="mr-2 text-[#60A5FA]">+{it.bonus_def} DEF</span> : null}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/30 italic">Slot vuoto</p>
                )}
              </div>
              {it ? (
                <button onClick={() => unequip(slot)} disabled={busy}
                  className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg text-red-300 bg-red-500/10 border border-red-500/20 disabled:opacity-40">
                  Rimuovi
                </button>
              ) : (
                <button onClick={() => { setError(''); setPickerSlot(slot) }} disabled={busy}
                  className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg text-[#3ABCA8] bg-[#3ABCA8]/10 border border-[#3ABCA8]/25 disabled:opacity-40">
                  Equipaggia
                </button>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>
      )}

      {/* Picker */}
      <AnimatePresence>
        {pickerSlot && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setPickerSlot(null) }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-md bg-[#0d1e2e] border-t border-white/15 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-sm">
                  {EQUIPMENT_SLOT_META[pickerSlot].emoji} Scegli — {EQUIPMENT_SLOT_META[pickerSlot].label}
                </h3>
                <button onClick={() => setPickerSlot(null)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
              </div>
              {(() => {
                const list = inventory.filter(r => r.items?.type === pickerSlot)
                if (list.length === 0) {
                  return <p className="text-white/30 text-sm text-center py-6">Nessun pezzo per questo slot nello zaino.</p>
                }
                return (
                  <div className="space-y-2">
                    {list.map(r => {
                      const it = r.items!
                      const rColor = it.rarity ? RARITY_COLORS[it.rarity] : '#888'
                      return (
                        <button key={r.id} disabled={busy}
                          onClick={() => equip(pickerSlot, it.id)}
                          className="w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 disabled:opacity-50"
                          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${rColor}30` }}>
                          <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center overflow-hidden bg-white/5">
                            {it.image_url
                              ? <img src={it.image_url} alt="" className="w-full h-full object-contain p-1" />
                              : <span className="text-lg">{EQUIPMENT_SLOT_META[pickerSlot].emoji}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white truncate">{it.name}</p>
                              {it.rarity && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                  style={{ background: `${rColor}1A`, color: rColor, border: `1px solid ${rColor}40` }}>
                                  {RARITY_LABELS[it.rarity]}
                                </span>
                              )}
                              <span className="text-[9px] text-white/40">×{r.quantity}</span>
                            </div>
                            <p className="text-[10px] text-white/40 mt-0.5">
                              {it.bonus_hp ? <span className="mr-2 text-[#34D399]">+{it.bonus_hp} HP</span> : null}
                              {it.bonus_atk ? <span className="mr-2 text-[#FB923C]">+{it.bonus_atk} ATK</span> : null}
                              {it.bonus_def ? <span className="mr-2 text-[#60A5FA]">+{it.bonus_def} DEF</span> : null}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
