'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import type { ItemType } from '@/lib/types'
import { STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { GameListSkeleton } from '@/components/game/GameLoading'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'

const USABLE_FROM_BACKPACK: ItemType[] = ['esca', 'uovo']

const TYPE_META: Record<ItemType, { icon: string; label: string; hint: string; color: string }> = {
  rete:      { icon: '🎯', label: 'Rete',      hint: 'Aumenta la probabilità di cattura',    color: '#3A9DBC' },
  esca:      { icon: '🍖', label: 'Esca',       hint: 'Attira creature rare nelle vicinanze', color: '#34D399' },
  uovo:      { icon: '🥚', label: 'Uovo',       hint: 'Incuba una nuova creatura casuale',    color: '#C084FC' },
  battaglia: { icon: '⚔️', label: 'Battaglia', hint: 'Potenzia ATK in duello',               color: '#FBBF24' },
  pozione:   { icon: '🧪', label: 'Pozione',   hint: 'Neutralizza debolezza elementale',     color: '#F472B6' },
  cura:      { icon: '💊', label: 'Cura',       hint: 'Ripristina HP creatura in battaglia',  color: '#34D399' },
}

const RARITY_COLOR: Record<string, string> = {
  comune:      '#9CA3AF',
  non_comune:  '#34D399',
  raro:        '#3A9DBC',
  epico:       '#C084FC',
  leggendario: '#FBBF24',
  mitologico:  '#FF4D6D',
}

const RARITY_LABEL: Record<string, string> = {
  comune:      'Terrestre',
  non_comune:  'Arcaico',
  raro:        'Eroico',
  epico:       'Mostruoso',
  leggendario: 'Leggendario',
  mitologico:  'Mitologico',
}

const EGG_ICON: Record<string, string> = {
  comune:      '🥚',
  non_comune:  '🪺',
  raro:        '💎',
  epico:       '🔮',
  leggendario: '⭐',
  mitologico:  '🌌',
}

interface InventoryRow {
  id: string
  quantity: number
  items: {
    id: string
    name: string
    type: ItemType
    description: string
    effect_value: number
    shop_price: number
  }
}

interface PlayerEgg {
  id: string
  egg_rarity: string
  steps_required: number
  steps_at_pickup: number
  steps_progress: number
  can_hatch: boolean
  created_at: string
}

interface HatchResult {
  id: string
  name: string
  rarity: string
  element: string
  image_url: string | null
  sprite_url: string | null
  status_effect?: string | null
  status_effect_chance?: number | null
}

// ── Hatching animation overlay ──────────────────────────────────────────────
function HatchingAnimation({
  result,
  onDone,
}: {
  result: HatchResult | null
  onDone: () => void
}) {
  const [phase, setPhase] = useState<'shake' | 'crack' | 'reveal'>('shake')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('crack'), 900)
    const t2 = setTimeout(() => setPhase('reveal'), 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const rarityColor = result ? (RARITY_COLOR[result.rarity] ?? '#9CA3AF') : '#9CA3AF'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
         onClick={phase === 'reveal' ? onDone : undefined}>
      <AnimatePresence mode="wait">
        {phase === 'shake' && (
          <motion.div key="shake"
            animate={{ x: [-6, 6, -6, 6, 0], rotate: [-8, 8, -8, 8, 0] }}
            transition={{ duration: 0.8, repeat: 1 }}
            className="text-8xl select-none">
            🥚
          </motion.div>
        )}
        {phase === 'crack' && (
          <motion.div key="crack"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.3, 0.9, 1.4] }}
            transition={{ duration: 0.9 }}
            className="text-8xl select-none">
            🐣
          </motion.div>
        )}
        {phase === 'reveal' && result && (
          <motion.div key="reveal"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex flex-col items-center gap-4 px-8 w-full max-w-xs">
            <div className="text-4xl mb-1">✨</div>
            {result.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={result.image_url} alt={result.name}
                className="w-32 h-32 object-contain rounded-2xl"
                style={{ filter: `drop-shadow(0 0 16px ${rarityColor})` }} />
            ) : (
              <div className="w-32 h-32 rounded-2xl flex items-center justify-center text-6xl"
                style={{ background: `${rarityColor}22` }}>
                🐾
              </div>
            )}
            <div className="text-center">
              <p className="text-white font-extrabold text-xl">{result.name}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: rarityColor }}>
                {RARITY_LABEL[result.rarity] ?? result.rarity}
              </p>
            </div>
            {result.status_effect && STATUS_EFFECT_META[result.status_effect as StatusEffect] && (() => {
              const meta = STATUS_EFFECT_META[result.status_effect as StatusEffect]
              const chancePercent = Math.round((result.status_effect_chance ?? 0.15) * 100)
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, type: 'spring', stiffness: 280, damping: 22 }}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 w-full"
                  style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}45`, boxShadow: `0 0 16px ${meta.glow}` }}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-xl"
                  >{meta.emoji}</motion.span>
                  <div className="flex-1">
                    <p className="text-[12px] font-extrabold" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="text-[10px] text-white/40">~{chancePercent}% per attacco</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                    Abilità
                  </span>
                </motion.div>
              )
            })()}
            <p className="text-white/40 text-xs mt-2">Tocca per continuare</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Egg card ─────────────────────────────────────────────────────────────────
function EggCard({
  egg,
  onHatch,
  hatching,
}: {
  egg: PlayerEgg
  onHatch: (id: string) => void
  hatching: string | null
}) {
  const color = RARITY_COLOR[egg.egg_rarity] ?? '#9CA3AF'
  const label = RARITY_LABEL[egg.egg_rarity] ?? egg.egg_rarity
  const icon  = EGG_ICON[egg.egg_rarity] ?? '🥚'
  const pct   = egg.steps_required > 0
    ? Math.min(100, Math.round((egg.steps_progress / egg.steps_required) * 100))
    : 100

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center gap-3 rounded-2xl p-3 border transition-all"
      style={{ background: `${color}0a`, borderColor: `${color}28` }}
    >
      {/* Animated egg icon */}
      <motion.div
        animate={egg.can_hatch ? { scale: [1, 1.08, 1], rotate: [-4, 4, -4, 4, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
        style={{ background: `${color}18` }}
      >
        {icon}
      </motion.div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="font-bold text-white text-sm">Uovo</p>
          <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
            style={{ background: `${color}20`, color }}>
            {label}
          </span>
        </div>

        {egg.steps_required > 0 ? (
          <>
            <div className="w-full h-1.5 rounded-full bg-white/10 mt-1 mb-0.5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs" style={{ color: egg.can_hatch ? color : 'rgba(255,255,255,0.35)' }}>
              {egg.can_hatch
                ? 'Pronto a schiudersi!'
                : `${egg.steps_progress} / ${egg.steps_required} passi`}
            </p>
          </>
        ) : (
          <p className="text-xs" style={{ color }}>Schiusura immediata</p>
        )}
      </div>

      {/* Hatch button */}
      <div className="shrink-0">
        <button
          onClick={() => onHatch(egg.id)}
          disabled={!egg.can_hatch || hatching === egg.id}
          className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-30"
          style={egg.can_hatch ? { background: `${color}28`, color, border: `1px solid ${color}55` } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {hatching === egg.id ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : '🐣 Schiudi'}
        </button>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BackpackPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [eggs, setEggs]           = useState<PlayerEgg[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<ItemType | 'all'>('all')
  const [usingId, setUsingId]     = useState<string | null>(null)
  const [hatchingId, setHatchingId] = useState<string | null>(null)
  const [hatchResult, setHatchResult] = useState<HatchResult | null>(null)
  const { toast, showSuccess, showApiError, showError, dismiss } = useGameToast()
  const supabase   = useMemo(() => createClient(), [])
  const userIdRef  = useRef<string | null>(null)
  const sessionRef = useRef<string | null>(null)

  function fetchInventory() {
    const uid = userIdRef.current
    const sid = sessionRef.current
    if (!uid || !sid) return
    supabase
      .from('player_inventory')
      .select('id, quantity, items(id, name, type, description, effect_value, shop_price)')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .gt('quantity', 0)
      .order('quantity', { ascending: false })
      .then(({ data }) => { if (data) setInventory(data as unknown as InventoryRow[]) })
  }

  const fetchEggs = useCallback(() => {
    const sid = sessionRef.current
    if (!sid) return
    fetch(`/api/game/eggs?sessionId=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.eggs) setEggs(d.eggs) })
  }, [])

  async function handleUse(row: InventoryRow) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    setUsingId(row.id)
    try {
      const res = await fetch('/api/game/item/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: row.id, sessionId }),
      })
      const data = await res.json()
      if (data.used) {
        showSuccess(data.message ?? 'Oggetto usato!')
        setInventory(prev => prev.map(r =>
          r.id === row.id ? { ...r, quantity: r.quantity - 1 } : r
        ).filter(r => r.quantity > 0))
        if (data.incubating) {
          fetchEggs()
        }
        if (data.activatedUntil) {
          localStorage.setItem('esca_active_until', data.activatedUntil)
          window.dispatchEvent(new CustomEvent('wc:esca-activated', { detail: { until: data.activatedUntil } }))
        }
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      } else {
        showApiError(res.status, data.error ?? 'Errore nell\'uso dell\'oggetto')
      }
    } catch {
      showApiError(0, 'Errore di rete')
    }
    setUsingId(null)
  }

  async function handleHatch(eggId: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    setHatchingId(eggId)
    try {
      const res = await fetch(`/api/game/eggs/${eggId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (data.hatched) {
        setEggs(prev => prev.filter(e => e.id !== eggId))
        setHatchResult(data.creature)
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      } else {
        showApiError(res.status, data.error ?? 'Schiusura fallita')
      }
    } catch {
      showError('Errore di rete')
    }
    setHatchingId(null)
  }

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }
    sessionRef.current = sessionId

    getCurrentUser(supabase).then(user => {
      if (!user) { setLoading(false); return }
      userIdRef.current = user.id

      supabase
        .from('player_inventory')
        .select('id, quantity, items(id, name, type, description, effect_value, shop_price)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .gt('quantity', 0)
        .order('quantity', { ascending: false })
        .then(({ data }) => {
          if (data) setInventory(data as unknown as InventoryRow[])
          setLoading(false)
        })

      fetchEggs()

      // Realtime: re-fetch whenever inventory changes (shop, QR rewards, item use)
      const channel = supabase
        .channel(`backpack-inv-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_inventory',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchInventory())
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_eggs',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchEggs())
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })

    window.addEventListener('wc:refresh-backpack', fetchInventory)
    return () => window.removeEventListener('wc:refresh-backpack', fetchInventory)
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const types = [...new Set(inventory.map(r => r.items?.type).filter(Boolean))] as ItemType[]
  const filtered = filter === 'all' ? inventory : inventory.filter(r => r.items?.type === filter)
  const totalItems = inventory.reduce((s, r) => s + r.quantity, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Hatching overlay */}
      <AnimatePresence>
        {hatchResult && (
          <HatchingAnimation
            result={hatchResult}
            onDone={() => setHatchResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-[#0A1520]/80">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-extrabold tracking-tight">🎒 Zaino</h1>
          {totalItems > 0 && (
            <span className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
              {totalItems} oggetti
            </span>
          )}
        </div>

        {/* Type filter pills */}
        {types.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button
              onClick={() => setFilter('all')}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                filter === 'all' ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50 hover:text-white'
              }`}
            >
              Tutti
            </button>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                  filter === t ? 'text-white' : 'bg-white/5 text-white/50 hover:text-white'
                }`}
                style={filter === t ? { backgroundColor: TYPE_META[t].color } : undefined}
              >
                {TYPE_META[t].icon} {TYPE_META[t].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <GameListSkeleton rows={4} />
        ) : (
          <>
            {/* ── Eggs section ─────────────────────────────────── */}
            {eggs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                  Uova ({eggs.length})
                </p>
                <div className="space-y-2">
                  <AnimatePresence>
                    {eggs.map(egg => (
                      <EggCard
                        key={egg.id}
                        egg={egg}
                        onHatch={handleHatch}
                        hatching={hatchingId}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ── Items section ─────────────────────────────────── */}
            {eggs.length > 0 && inventory.length > 0 && (
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                Oggetti
              </p>
            )}

            {filtered.length === 0 && eggs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="text-5xl opacity-20">🎒</span>
                <p className="text-white/30 text-sm">
                  {filter === 'all' ? 'Lo zaino è vuoto' : `Nessun oggetto di tipo ${TYPE_META[filter]?.label}`}
                </p>
                {filter !== 'all' && (
                  <button onClick={() => setFilter('all')} className="text-xs text-[#3A9DBC] hover:text-white transition-colors">
                    Mostra tutti
                  </button>
                )}
              </div>
            ) : filtered.length === 0 && filter !== 'all' ? (
              <div className="text-center py-8">
                <p className="text-white/30 text-sm">Nessun oggetto di tipo {TYPE_META[filter]?.label}</p>
                <button onClick={() => setFilter('all')} className="text-xs text-[#3A9DBC] hover:text-white transition-colors mt-2">
                  Mostra tutti
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(row => {
                  const item = row.items
                  if (!item) return null
                  const meta = TYPE_META[item.type] ?? { icon: '📦', label: item.type, hint: '', color: '#9CA3AF' }
                  const usable = USABLE_FROM_BACKPACK.includes(item.type as ItemType)
                  const isUsing = usingId === row.id

                  return (
                    <motion.div
                      key={row.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-stretch rounded-2xl border overflow-hidden"
                      style={{ background: `${meta.color}0a`, borderColor: `${meta.color}28` }}
                    >
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                          style={{ background: `${meta.color}18` }}
                        >
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <p className="font-bold text-white text-sm">{item.name}</p>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
                              style={{ background: `${meta.color}20`, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-white/45 leading-relaxed">{item.description}</p>
                          )}
                          {item.effect_value > 0 && (
                            <p className="text-xs mt-0.5" style={{ color: meta.color }}>
                              {(item.type === 'rete' || item.type === 'esca') ? `×${item.effect_value}` : `+${item.effect_value}%`}{' '}{meta.hint}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side */}
                      {usable ? (
                        /* ── Full-height use button ── */
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => handleUse(row)}
                          disabled={isUsing}
                          className="shrink-0 flex flex-col items-center justify-center gap-0.5 px-5 min-w-[72px] relative overflow-hidden disabled:opacity-60"
                          style={{ background: `${meta.color}28`, borderLeft: `1px solid ${meta.color}35` }}
                        >
                          {/* Pulse glow behind button */}
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            animate={{ opacity: [0, 0.18, 0] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: meta.color }}
                          />
                          {isUsing ? (
                            <div
                              className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                              style={{ borderColor: meta.color, borderTopColor: 'transparent' }}
                            />
                          ) : (
                            <>
                              <span className="text-base leading-none relative z-10">✨</span>
                              <span className="font-extrabold text-sm relative z-10" style={{ color: meta.color }}>Usa</span>
                              <span className="text-[10px] font-semibold relative z-10" style={{ color: `${meta.color}99` }}>×{row.quantity}</span>
                            </>
                          )}
                        </motion.button>
                      ) : (
                        /* ── Quantity + price (non-usable) ── */
                        <div className="shrink-0 flex flex-col items-end justify-center gap-1 px-3">
                          <div
                            className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg font-extrabold text-sm"
                            style={{ background: `${meta.color}22`, color: meta.color }}
                          >
                            ×{row.quantity}
                          </div>
                          {item.shop_price > 0 && (
                            <p className="text-xs text-white/25">💰{item.shop_price}</p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
