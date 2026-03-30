'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Element, Rarity } from '@/lib/types'

interface BossSlot {
  slot: number
  creature_id: string
  name: string
  element: Element
  atk: number
  max_hp: number
  current_hp: number
  fainted: boolean
  image_url: string
  sprite_url: string
}

interface PlayerSlot {
  slot: number
  player_creature_id: string
  name: string
  element: Element
  atk: number
  max_hp: number
  current_hp: number
  fainted: boolean
  is_active: boolean
}

interface SquadCreature {
  playerCreatureId: string
  name: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  image_url: string
}

interface BattagliaItem {
  inventoryId: string
  name: string
  effectValue: number
  quantity: number
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

function BossLineupBar({ lineup, activeSlot }: { lineup: BossSlot[]; activeSlot: number }) {
  return (
    <div className="flex items-center gap-2">
      {lineup.map((c, i) => {
        const hpPct = c.max_hp > 0 ? (c.current_hp / c.max_hp) * 100 : 0
        const isActive = i === activeSlot && !c.fainted
        return (
          <div key={i} className="relative">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
              c.fainted
                ? 'border-white/15 bg-white/5 opacity-30'
                : isActive
                  ? 'border-red-400 bg-red-500/20 shadow-lg shadow-red-500/30'
                  : 'border-white/30 bg-white/10'
            }`}>
              {c.fainted ? '✕' : ELEMENT_EMOJI[c.element] ?? '?'}
            </div>
            {/* HP bar under indicator */}
            {!c.fainted && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${hpPct}%`,
                    background: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PlayerLineupBar({ lineup }: { lineup: PlayerSlot[] }) {
  return (
    <div className="flex items-center gap-2">
      {lineup.map((c, i) => {
        const hpPct = c.max_hp > 0 ? (c.current_hp / c.max_hp) * 100 : 0
        return (
          <div key={i} className="relative">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
              c.fainted
                ? 'border-white/15 bg-white/5 opacity-30'
                : c.is_active
                  ? 'border-[#3A9DBC] bg-[#3A9DBC]/20 shadow-lg shadow-[#3A9DBC]/30'
                  : 'border-white/30 bg-white/10'
            }`}>
              {c.fainted ? '✕' : ELEMENT_EMOJI[c.element] ?? '?'}
            </div>
            {!c.fainted && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${hpPct}%`,
                    background: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Squad Selector ─────────────────────────────────────────────────────────── */

function SquadSelector({
  creatures,
  lineup,
  onToggle,
  onRemoveSlot,
  onConfirm,
  bossName,
  bossLineup,
  starting,
}: {
  creatures: SquadCreature[]
  lineup: (SquadCreature | null)[]
  onToggle: (c: SquadCreature) => void
  onRemoveSlot: (i: number) => void
  onConfirm: () => void
  bossName: string
  bossLineup: BossSlot[]
  starting: boolean
}) {
  const filledCount = lineup.filter(Boolean).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">💀</span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Capo Palestra</h1>
            <p className="text-white/40 text-xs">{bossName} ti sfida! Scegli la tua squadra</p>
          </div>
        </div>

        {/* Boss lineup preview */}
        <div className="flex items-center gap-2 mt-2">
          {bossLineup.map((bc, i) => (
            <div key={i} className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
              <span className="text-sm">{ELEMENT_EMOJI[bc.element] ?? '?'}</span>
              <span className="text-xs text-white/60">{bc.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Squad slots */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-semibold">La tua squadra ({filledCount}/3)</p>
        <div className="flex gap-2">
          {lineup.map((c, i) => (
            <button
              key={i}
              onClick={() => c && onRemoveSlot(i)}
              className={`flex-1 h-14 rounded-xl border-2 flex flex-col items-center justify-center text-xs transition-all ${
                c
                  ? 'border-[#3A9DBC]/60 bg-[#3A9DBC]/10'
                  : 'border-dashed border-white/20 bg-white/3'
              }`}
            >
              {c ? (
                <>
                  <span className="text-base">{ELEMENT_EMOJI[c.element]}</span>
                  <span className="text-white/70 font-semibold truncate w-full text-center px-1">{c.name}</span>
                </>
              ) : (
                <span className="text-white/20 text-lg">+</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Creature list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {creatures.map(c => {
          const inLineup = lineup.some(l => l?.playerCreatureId === c.playerCreatureId)
          return (
            <button
              key={c.playerCreatureId}
              onClick={() => onToggle(c)}
              className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-all ${
                inLineup
                  ? 'border-[#3A9DBC]/60 bg-[#3A9DBC]/10'
                  : 'border-white/8 bg-white/4 hover:bg-white/8'
              }`}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  : <span className="text-xl">{ELEMENT_EMOJI[c.element]}</span>
                }
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-white text-sm truncate">{c.name}</p>
                <p className="text-xs" style={{ color: RARITY_COLORS[c.rarity] }}>{c.rarity}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-white/40">HP {c.hp}</p>
                <p className="text-xs text-white/40">ATK {c.atk}</p>
              </div>
              {inLineup && <span className="text-[#3A9DBC] text-sm">✓</span>}
            </button>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={onConfirm}
          disabled={filledCount < 3 || starting}
          className="w-full bg-red-500 hover:bg-red-400 disabled:bg-white/10 disabled:text-white/30 text-white font-extrabold py-3.5 rounded-xl text-sm transition-all"
        >
          {starting ? 'Inizio battaglia...' : filledCount < 3 ? `Seleziona ${3 - filledCount} creature` : '⚔️ Inizia la battaglia!'}
        </button>
      </div>
    </div>
  )
}

/* ── Battle Screen ──────────────────────────────────────────────────────────── */

function BattleScreen({
  bossLineup,
  playerLineup,
  bossActiveSlot,
  onAttack,
  attacking,
  log,
  animState,
  bossAnimState,
  lastDamage,
  battagliaItems,
  selectedItemId,
  onSelectItem,
  showItems,
  onToggleItems,
  switchNotice,
}: {
  bossLineup: BossSlot[]
  playerLineup: PlayerSlot[]
  bossActiveSlot: number
  onAttack: () => void
  attacking: boolean
  log: string[]
  animState: 'idle' | 'attack' | 'damage'
  bossAnimState: 'idle' | 'attack' | 'damage'
  lastDamage: { amount: number; target: 'me' | 'boss' } | null
  battagliaItems: BattagliaItem[]
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  showItems: boolean
  onToggleItems: () => void
  switchNotice: string | null
}) {
  const activeBoss   = bossLineup[bossActiveSlot]
  const activePlayer = playerLineup.find(c => c.is_active && !c.fainted)

  if (!activeBoss || !activePlayer) return null

  const bossHpPct   = activeBoss.max_hp   > 0 ? (activeBoss.current_hp   / activeBoss.max_hp)   * 100 : 0
  const playerHpPct = activePlayer.max_hp > 0 ? (activePlayer.current_hp / activePlayer.max_hp) * 100 : 0

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Switch notice */}
      <AnimatePresence>
        {switchNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#0a1520]/90 border border-white/20 rounded-xl px-4 py-2 text-sm font-bold text-white text-center shadow-xl"
          >
            {switchNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Boss HUD */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="bg-white/4 border border-white/8 rounded-2xl px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">{ELEMENT_EMOJI[activeBoss.element]}</span>
              <span className="font-extrabold text-white text-sm">{activeBoss.name}</span>
              <span className="text-xs text-red-400/60">👿 Boss</span>
            </div>
            <BossLineupBar lineup={bossLineup} activeSlot={bossActiveSlot} />
          </div>
          <HPBar current={activeBoss.current_hp} max={activeBoss.max_hp} />
          <p className="text-right text-xs text-white/40 mt-0.5">
            {activeBoss.current_hp}/{activeBoss.max_hp}
          </p>
        </div>
      </div>

      {/* Battle arena */}
      <div className="flex-1 relative flex items-center justify-around px-4 overflow-hidden">
        {/* Boss sprite (top right, slightly smaller) */}
        <motion.div
          className="absolute top-4 right-8"
          animate={bossAnimState === 'attack' ? { x: -20, scale: 1.05 } : bossAnimState === 'damage' ? { x: 10, opacity: 0.5 } : { x: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <div className="relative">
            {activeBoss.sprite_url
              ? <img src={activeBoss.sprite_url} alt={activeBoss.name} className="w-28 h-28 object-contain drop-shadow-lg" />
              : <div className="w-28 h-28 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-5xl">
                  {ELEMENT_EMOJI[activeBoss.element]}
                </div>
            }
            {/* Damage number */}
            <AnimatePresence>
              {lastDamage?.target === 'boss' && (
                <motion.div
                  key={lastDamage.amount}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -30 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg font-extrabold text-[#F7C841]"
                >
                  -{lastDamage.amount}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* VS divider */}
        <div className="absolute inset-x-0 top-1/2 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/20 font-bold">VS</div>
        </div>

        {/* Player sprite (bottom left) */}
        <motion.div
          className="absolute bottom-4 left-8"
          animate={animState === 'attack' ? { x: 20, scale: 1.1 } : animState === 'damage' ? { x: -10, opacity: 0.5 } : { x: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePlayer.player_creature_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <CreatureSprite
                  imageUrl={''}
                  name={activePlayer.name}
                  size={112}
                />
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {lastDamage?.target === 'me' && (
                <motion.div
                  key={lastDamage.amount}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -30 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg font-extrabold text-red-400"
                >
                  -{lastDamage.amount}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Player HUD */}
      <div className="px-4 pb-2 shrink-0">
        <div className="bg-[#3A9DBC]/8 border border-[#3A9DBC]/20 rounded-2xl px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">{ELEMENT_EMOJI[activePlayer.element]}</span>
              <span className="font-extrabold text-white text-sm">{activePlayer.name}</span>
            </div>
            <PlayerLineupBar lineup={playerLineup} />
          </div>
          <HPBar current={activePlayer.current_hp} max={activePlayer.max_hp} />
          <p className="text-right text-xs text-white/40 mt-0.5">
            {activePlayer.current_hp}/{activePlayer.max_hp}
          </p>
        </div>
      </div>

      {/* Battle log */}
      <div className="mx-4 mb-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2 h-12 overflow-hidden shrink-0">
        <AnimatePresence mode="wait">
          {log.length > 0 && (
            <motion.p
              key={log[log.length - 1]}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-white/70 leading-relaxed"
            >
              {log[log.length - 1]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 shrink-0 space-y-2">
        {/* Items */}
        {battagliaItems.length > 0 && (
          <div>
            <button
              onClick={onToggleItems}
              className="text-xs text-white/40 underline mb-1"
            >
              {showItems ? '▲ Nascondi oggetti' : `▼ Usa oggetto ${selectedItemId ? '(selezionato)' : ''}`}
            </button>
            <AnimatePresence>
              {showItems && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 pb-2">
                    {battagliaItems.map(item => (
                      <button
                        key={item.inventoryId}
                        onClick={() => onSelectItem(selectedItemId === item.inventoryId ? null : item.inventoryId)}
                        className={`flex-1 text-xs py-2 px-3 rounded-xl border font-semibold transition-all ${
                          selectedItemId === item.inventoryId
                            ? 'bg-[#FBBF24]/20 border-[#FBBF24]/50 text-[#FBBF24]'
                            : 'bg-white/5 border-white/10 text-white/50'
                        }`}
                      >
                        ⚔️ +{item.effectValue}%<br/>
                        <span className="text-white/30">×{item.quantity}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Attack button */}
        <button
          onClick={onAttack}
          disabled={attacking}
          className="w-full bg-red-500 hover:bg-red-400 disabled:bg-white/10 disabled:text-white/30 text-white font-extrabold py-4 rounded-2xl text-base transition-all active:scale-95 shadow-lg shadow-red-500/20"
        >
          {attacking ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Attacco...
            </span>
          ) : (
            '⚔️ Attacca!'
          )}
        </button>
      </div>
    </div>
  )
}

/* ── Result Screen ──────────────────────────────────────────────────────────── */

function ResultScreen({
  won,
  reward,
  levelUp,
  onExit,
}: {
  won: boolean
  reward: any
  levelUp: { newLevel: number; goldReward: number } | null
  onExit: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-7xl"
      >
        {won ? '🏆' : '💀'}
      </motion.div>

      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-1">
          {won ? 'Vittoria!' : 'Sconfitta'}
        </h2>
        <p className="text-white/50 text-sm">
          {won ? 'Hai sconfitto il Capo Palestra!' : 'Il Capo Palestra è troppo forte...'}
        </p>
      </div>

      {won && reward && (
        <div className="w-full bg-[#3A9DBC]/10 border border-[#3A9DBC]/25 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3 text-center">Ricompense</p>
          <div className="grid grid-cols-2 gap-2">
            {(reward.gold ?? 0) > 0 && (
              <div className="flex items-center gap-2 bg-[#F7C841]/8 border border-[#F7C841]/20 rounded-xl px-3 py-2.5">
                <span className="text-lg">🪙</span>
                <div>
                  <p className="text-[#F7C841] font-extrabold text-sm">{reward.gold}</p>
                  <p className="text-white/30 text-xs">Oro</p>
                </div>
              </div>
            )}
            {(reward.exp ?? 0) > 0 && (
              <div className="flex items-center gap-2 bg-[#3A9DBC]/8 border border-[#3A9DBC]/20 rounded-xl px-3 py-2.5">
                <span className="text-lg">✨</span>
                <div>
                  <p className="text-[#3A9DBC] font-extrabold text-sm">{reward.exp}</p>
                  <p className="text-white/30 text-xs">EXP</p>
                </div>
              </div>
            )}
          </div>
          {levelUp && (
            <div className="mt-2 text-center">
              <span className="text-sm font-bold text-[#F7C841]">⭐ Level Up! Livello {levelUp.newLevel}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onExit}
        className="w-full bg-[#3A9DBC] text-white font-extrabold py-4 rounded-2xl text-base"
      >
        {won ? 'Continua →' : 'Torna al gioco'}
      </button>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export default function BossFightPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [fight, setFight]             = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Squad selector state
  const [allCreatures, setAllCreatures] = useState<SquadCreature[]>([])
  const [lineup, setLineup]             = useState<(SquadCreature | null)[]>([null, null, null])
  const [starting, setStarting]         = useState(false)
  const [loadingCreatures, setLoadingCreatures] = useState(true)

  // Battle state
  const [bossLineup, setBossLineup]       = useState<BossSlot[]>([])
  const [playerLineup, setPlayerLineup]   = useState<PlayerSlot[]>([])
  const [bossActiveSlot, setBossActiveSlot]     = useState(0)
  const [attacking, setAttacking]         = useState(false)
  const [log, setLog]                     = useState<string[]>([])
  const [animState, setAnimState]         = useState<'idle' | 'attack' | 'damage'>('idle')
  const [bossAnimState, setBossAnimState] = useState<'idle' | 'attack' | 'damage'>('idle')
  const [lastDamage, setLastDamage]       = useState<{ amount: number; target: 'me' | 'boss' } | null>(null)
  const [battagliaItems, setBattagliaItems] = useState<BattagliaItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showItems, setShowItems]         = useState(false)
  const [switchNotice, setSwitchNotice]   = useState<string | null>(null)
  const [finalResult, setFinalResult]     = useState<{ won: boolean; reward: any; levelUp: any } | null>(null)

  const addLog = (msg: string) => setLog(prev => [...prev.slice(-9), msg])

  // Load fight + creatures
  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')

    async function load() {
      const fightRes = await fetch(`/api/game/boss/${id}`)
      if (!fightRes.ok) { setError('Boss fight non trovato'); setLoading(false); return }
      const { fight: f } = await fightRes.json()
      setFight(f)

      if (f.status === 'won' || f.status === 'lost') {
        setFinalResult({ won: f.status === 'won', reward: f.reward, levelUp: null })
        setLoading(false)
        return
      }

      if (f.status === 'active') {
        setBossLineup(f.boss_lineup)
        setPlayerLineup(f.player_lineup)
        setBossActiveSlot(f.boss_active_slot)
        addLog('La battaglia è in corso...')
      }

      // Load player creatures for squad selection or items
      if (sessionId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const [crRes, invRes] = await Promise.all([
            supabase.from('player_creatures')
              .select('id, creatures(name, element, rarity, hp, atk, image_url)')
              .eq('user_id', user.id)
              .eq('session_id', sessionId),
            supabase.from('player_inventory')
              .select('id, quantity, items(name, type, effect_value)')
              .eq('user_id', user.id)
              .eq('session_id', sessionId)
              .gt('quantity', 0),
          ])

          const mapped: SquadCreature[] = ((crRes.data ?? []) as any[])
            .filter(pc => pc.creatures)
            .map(pc => ({
              playerCreatureId: pc.id,
              name: pc.creatures.name,
              element: pc.creatures.element,
              rarity: pc.creatures.rarity,
              hp: pc.creatures.hp,
              atk: pc.creatures.atk,
              image_url: pc.creatures.image_url,
            }))
          setAllCreatures(mapped)

          const bItems: BattagliaItem[] = ((invRes.data ?? []) as any[])
            .filter(inv => inv.items?.type === 'battaglia' && inv.quantity > 0)
            .map(inv => ({
              inventoryId: inv.id,
              name: inv.items.name,
              effectValue: inv.items.effect_value,
              quantity: inv.quantity,
            }))
          setBattagliaItems(bItems)
        }
      }

      setLoadingCreatures(false)
      setLoading(false)
    }

    load()
  }, [id, supabase])

  function toggleCreature(c: SquadCreature) {
    setLineup(prev => {
      const idx = prev.findIndex(l => l?.playerCreatureId === c.playerCreatureId)
      if (idx !== -1) {
        const next = prev.filter((_, i) => i !== idx)
        return [...next, null] as (SquadCreature | null)[]
      }
      const emptyIdx = prev.findIndex(l => l === null)
      if (emptyIdx === -1) return prev
      const next = [...prev]
      next[emptyIdx] = c
      return next
    })
  }

  function removeSlot(i: number) {
    setLineup(prev => {
      const next = prev.filter((_, j) => j !== i)
      return [...next, null] as (SquadCreature | null)[]
    })
  }

  async function confirmLineup() {
    const filled = lineup.filter(Boolean) as SquadCreature[]
    if (filled.length !== 3) return
    setStarting(true)
    const res = await fetch(`/api/game/boss/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        lineup: filled.map((c, i) => ({ playerCreatureId: c.playerCreatureId, slot: i })),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setStarting(false); return }

    setBossLineup(data.bossLineup)
    setPlayerLineup(data.playerLineup)
    setBossActiveSlot(0)
    setFight((prev: any) => ({ ...prev, status: 'active' }))
    addLog(`La battaglia contro il Capo Palestra è iniziata!`)
    setStarting(false)
  }

  async function handleAttack() {
    if (attacking) return
    setAttacking(true)

    // Attack animation
    setAnimState('attack')
    setTimeout(() => setAnimState('idle'), 300)

    const res = await fetch(`/api/game/boss/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'attack', itemId: selectedItemId || undefined }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setAttacking(false); return }

    setSelectedItemId(null)
    if (selectedItemId) {
      setBattagliaItems(prev => prev.map(item =>
        item.inventoryId === selectedItemId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ).filter(item => item.quantity > 0))
    }

    // Update state from response
    setBossLineup(data.bossLineup)
    setPlayerLineup(data.playerLineup)
    const newBossSlot = data.bossLineup.findIndex((c: BossSlot) => !c.fainted)
    setBossActiveSlot(newBossSlot === -1 ? 0 : newBossSlot)

    // Damage animations
    setLastDamage({ amount: data.playerDamage, target: 'boss' })
    setBossAnimState('damage')
    setTimeout(() => {
      setBossAnimState('idle')
      if (data.bossDamage > 0) {
        setLastDamage({ amount: data.bossDamage, target: 'me' })
        setAnimState('damage')
        setTimeout(() => setAnimState('idle'), 300)
      }
    }, 300)

    // Log
    const activePlayer = data.playerLineup.find((c: PlayerSlot) => c.is_active)
    addLog(`${activePlayer?.name ?? 'Tu'} colpisce per ${data.playerDamage} danni!`)
    if (data.bossDamage > 0) {
      addLog(`Il boss risponde con ${data.bossDamage} danni!`)
    }

    if (data.bossSwitchedTo) {
      setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`)
      setTimeout(() => setSwitchNotice(null), 2000)
    }
    if (data.playerSwitchedTo) {
      setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`)
      setTimeout(() => setSwitchNotice(null), 2000)
    }

    if (data.status === 'won' || data.status === 'lost') {
      setTimeout(() => {
        setFinalResult({ won: data.won, reward: data.reward, levelUp: data.levelUp })
      }, 800)
    }

    setAttacking(false)
  }

  async function handleSurrender() {
    await fetch(`/api/game/boss/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'surrender' }),
    })
    router.replace('/game/missions')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <span className="text-4xl">❌</span>
        <p className="text-red-400 text-center">{error}</p>
        <button onClick={() => router.back()} className="text-[#3A9DBC] underline text-sm">Torna indietro</button>
      </div>
    )
  }

  if (finalResult) {
    return (
      <div className="h-full bg-[#0A1520]">
        <ResultScreen
          won={finalResult.won}
          reward={finalResult.reward}
          levelUp={finalResult.levelUp}
          onExit={() => router.replace('/game/missions')}
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-[#0A1520] text-white flex flex-col overflow-hidden relative">
      {/* Header with back/surrender */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-white/8">
        <button onClick={() => router.back()} className="text-white/40 text-sm">← Indietro</button>
        <span className="text-sm font-bold text-white/60">💀 Capo Palestra</span>
        {fight?.status === 'active' && (
          <button onClick={handleSurrender} className="text-red-400/60 text-xs">Arrenditi</button>
        )}
        {fight?.status !== 'active' && <span className="w-16" />}
      </div>

      {fight?.status === 'selecting' || fight?.status === undefined ? (
        loadingCreatures ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <SquadSelector
              creatures={allCreatures}
              lineup={lineup}
              onToggle={toggleCreature}
              onRemoveSlot={removeSlot}
              onConfirm={confirmLineup}
              bossName={fight?.boss_lineup?.[0]?.name ?? 'Boss'}
              bossLineup={fight?.boss_lineup ?? []}
              starting={starting}
            />
          </div>
        )
      ) : (
        <div className="flex-1 overflow-hidden relative">
          <BattleScreen
            bossLineup={bossLineup}
            playerLineup={playerLineup}
            bossActiveSlot={bossActiveSlot}
            onAttack={handleAttack}
            attacking={attacking}
            log={log}
            animState={animState}
            bossAnimState={bossAnimState}
            lastDamage={lastDamage}
            battagliaItems={battagliaItems}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            showItems={showItems}
            onToggleItems={() => setShowItems(v => !v)}
            switchNotice={switchNotice}
          />
        </div>
      )}
    </div>
  )
}
