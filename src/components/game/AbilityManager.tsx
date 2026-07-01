'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { canLearnAbility, type Ability } from '@/lib/game/abilities'
import { RARITY_COLORS, RARITY_LABELS, type Element, type Rarity } from '@/lib/types'
import ElementIcon from '@/components/ui/ElementIcon'
import { CATEGORY_META, abilityAccent, buildAbilityChips, AbilityGlyph } from '@/components/game/ability-visuals'

interface MovesetRow { slot_index: number; ability_id: string; abilities: Ability | null }
interface TokenRow { ability_id: string; quantity: number; abilities: Ability | null }

const MAX_SLOTS = 4

function StatChips({ ability, max }: { ability: Ability; max?: number }) {
  const chips = buildAbilityChips(ability)
  const shown = max ? chips.slice(0, max) : chips
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {shown.map(c => (
        <span key={c.key} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none"
          style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30` }}>
          {c.label}
        </span>
      ))}
    </div>
  )
}

export default function AbilityManager({
  sessionId, playerCreatureId, element, rarity, playerLevel, onChanged,
}: {
  sessionId: string | null
  playerCreatureId: string
  element: Element
  rarity: Rarity
  playerLevel: number
  onChanged?: () => void
}) {
  const [moveset, setMoveset] = useState<MovesetRow[]>([])
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [learning, setLearning] = useState<Ability | null>(null) // ability pending a slot choice

  const load = useCallback(async () => {
    if (!sessionId) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/game/creature/abilities?playerCreatureId=${playerCreatureId}&sessionId=${sessionId}`)
      const d = await res.json()
      setMoveset((d.moveset ?? []) as MovesetRow[])
      setTokens((d.tokens ?? []) as TokenRow[])
    } catch { /* keep prior */ }
    setLoading(false)
  }, [sessionId, playerCreatureId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() fetches then sets; app-wide data-load pattern
  useEffect(() => { load() }, [load])

  const bySlot = useMemo(() => {
    const m: (MovesetRow | null)[] = [null, null, null, null]
    for (const r of moveset) if (r.slot_index >= 0 && r.slot_index < MAX_SLOTS) m[r.slot_index] = r
    return m
  }, [moveset])

  const knownIds = useMemo(() => new Set(moveset.map(r => r.ability_id)), [moveset])
  const knownCount = moveset.length
  const firstFreeSlot = bySlot.findIndex(s => s === null)

  async function learn(abilityId: string, slotIndex: number) {
    if (!sessionId || busy) return
    setBusy(true); setError('')
    const res = await fetch('/api/game/creature/abilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerCreatureId, abilityId, slotIndex }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    setLearning(null)
    await load()
    onChanged?.()
  }

  async function forget(slotIndex: number) {
    if (busy) return
    setBusy(true); setError('')
    const res = await fetch('/api/game/creature/abilities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId, slotIndex }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    await load()
    onChanged?.()
  }

  if (loading) {
    return <p className="text-white/30 text-sm py-6 text-center">Carico le abilità…</p>
  }

  // Split owned tokens into learnable-now vs blocked (with a reason).
  const ownedAbilities = tokens
    .filter(t => t.abilities && !knownIds.has(t.ability_id))
    .map(t => {
      const a = t.abilities!
      const gate = canLearnAbility({ ability: a, element, rarity, playerLevel, ownsToken: t.quantity > 0 })
      return { ability: a, quantity: t.quantity, gate }
    })
  const learnable = ownedAbilities.filter(o => o.gate.ok)
  const blocked = ownedAbilities.filter(o => !o.gate.ok)

  return (
    <div className="space-y-4">
      {/* Base attack — always available, free */}
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(96,205,221,0.14)' }}>
          <ElementIcon element={element} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white">Attacco base</p>
          <p className="text-[10px] text-white/40">Sempre disponibile · non occupa slot</p>
        </div>
        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Innato</span>
      </div>

      {/* Moveset slots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-bold">Mosse conosciute</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(184,139,240,0.15)', border: '1px solid rgba(184,139,240,0.3)', color: '#C084FC' }}>
            {knownCount} / {MAX_SLOTS}
          </span>
        </div>
        <div className="space-y-2">
          {bySlot.map((row, slot) => {
            const a = row?.abilities ?? null
            const accent = a ? abilityAccent(a) : '#3ABCA8'
            const cat = a ? CATEGORY_META[a.category] : null
            return (
              <div key={slot} className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${a ? `${accent}40` : 'rgba(255,255,255,0.07)'}` }}>
                <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center relative overflow-hidden"
                  style={{ background: a ? `${accent}18` : 'rgba(255,255,255,0.03)' }}>
                  {a ? <AbilityGlyph ability={a} size={22} /> : <span className="text-white/20 text-lg font-black">{slot + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  {a ? (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[13px] font-bold text-white truncate">{a.name}</p>
                        {a.element && <ElementIcon element={a.element} size={12} />}
                        {cat && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${cat.color}1a`, color: cat.color }}>{cat.label}</span>
                        )}
                      </div>
                      <StatChips ability={a} max={4} />
                    </>
                  ) : (
                    <p className="text-sm text-white/25 italic">Slot libero</p>
                  )}
                </div>
                {a && (
                  <button onClick={() => forget(slot)} disabled={busy}
                    className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-red-300 bg-red-500/10 border border-red-500/20 disabled:opacity-40">
                    Dimentica
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>
      )}

      {/* Learnable abilities from the backpack */}
      <div>
        <p className="text-[11px] text-white/35 uppercase tracking-widest font-bold mb-2">
          Abilità apprendibili {learnable.length > 0 && <span className="text-[#34D399]">({learnable.length})</span>}
        </p>
        {learnable.length === 0 && blocked.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-4 rounded-xl bg-white/[0.03] border border-white/5">
            Nessun token abilità nello zaino. Ottienili da missioni, QR, boss, pin ed enigmi!
          </p>
        ) : (
          <div className="space-y-2">
            {learnable.map(({ ability, quantity }) => {
              const accent = abilityAccent(ability)
              return (
                <motion.button
                  key={ability.id}
                  whileTap={{ scale: 0.98 }}
                  disabled={busy}
                  onClick={() => {
                    setError('')
                    if (firstFreeSlot === -1) setLearning(ability) // full → ask which to overwrite
                    else learn(ability.id, firstFreeSlot)
                  }}
                  className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 disabled:opacity-50 transition-all relative overflow-hidden"
                  style={{ background: `${accent}0c`, border: `1px solid ${accent}33` }}
                >
                  <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: accent }} />
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${accent}18` }}>
                    <AbilityGlyph ability={ability} size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-bold text-white truncate">{ability.name}</p>
                      {ability.element && <ElementIcon element={ability.element} size={12} />}
                      {ability.rarity && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: `${RARITY_COLORS[ability.rarity]}1a`, color: RARITY_COLORS[ability.rarity] }}>
                          {RARITY_LABELS[ability.rarity]}
                        </span>
                      )}
                      {quantity > 1 && <span className="text-[9px] text-white/40">×{quantity}</span>}
                    </div>
                    <StatChips ability={ability} max={4} />
                  </div>
                  <span className="shrink-0 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg"
                    style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
                    Impara
                  </span>
                </motion.button>
              )
            })}

            {/* Blocked (locked) tokens with the reason */}
            {blocked.map(({ ability, gate }) => {
              const accent = abilityAccent(ability)
              return (
                <div key={ability.id} className="w-full rounded-xl px-3 py-2.5 flex items-center gap-3 opacity-70"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center grayscale" style={{ background: `${accent}10` }}>
                    <AbilityGlyph ability={ability} size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-bold text-white/60 truncate">{ability.name}</p>
                      {ability.element && <ElementIcon element={ability.element} size={12} />}
                    </div>
                    <p className="text-[10px] text-white/35 mt-0.5">Descrizione: {ability.description}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
                    🔒 {gate.reason}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Overwrite picker — when all 4 slots are full */}
      <AnimatePresence>
        {learning && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setLearning(null) }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-md bg-[#0d1e2e] border-t border-white/15 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-white text-sm">Sostituisci una mossa</h3>
                <button onClick={() => setLearning(null)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
              </div>
              <p className="text-[11px] text-white/40 mb-4">
                Le mosse sono piene. Scegli quale dimenticare per imparare <span className="text-white font-semibold">{learning.name}</span>.
                <br />La mossa dimenticata andrà persa.
              </p>
              <div className="space-y-2">
                {bySlot.map((row, slot) => {
                  const a = row?.abilities
                  if (!a) return null
                  const accent = abilityAccent(a)
                  return (
                    <button key={slot} disabled={busy}
                      onClick={() => learn(learning.id, slot)}
                      className="w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}30` }}>
                      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${accent}18` }}>
                        <AbilityGlyph ability={a} size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{a.name}</p>
                        <p className="text-[10px] text-white/40">Slot {slot + 1}</p>
                      </div>
                      <span className="text-[10px] font-bold text-red-300">Sostituisci</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
