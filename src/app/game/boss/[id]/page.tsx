'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import CombatFortuneBadge from '@/components/game/CombatFortuneBadge'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Element, Rarity } from '@/lib/types'

interface BossSlot {
  slot: number
  creature_id: string
  name: string
  element: Element
  level?: number
  atk: number
  def?: number
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
  rarity: Rarity
  level?: number
  atk: number
  def?: number
  max_hp: number
  current_hp: number
  fainted: boolean
  is_active: boolean
  image_url: string
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

interface CombatFortuneInfo {
  multiplier: number
  deltaPercent: number
  tone: 'lucky' | 'rough' | 'steady'
  label: string
  isUnderdog: boolean
}

// ── Element theme ──────────────────────────────────────────────────────────────
const ELEMENT_THEME: Record<string, { bg: string; glow: string; ground: string }> = {
  bosco:     { bg: '#030B05', glow: '#2ECC6A', ground: '#061408' },
  fiamma:    { bg: '#0D0305', glow: '#FF5520', ground: '#150505' },
  adriatico: { bg: '#020810', glow: '#00C4E8', ground: '#040C18' },
  terra:     { bg: '#0A0700', glow: '#D4A060', ground: '#120D02' },
  armonia:   { bg: '#08030F', glow: '#B060F8', ground: '#0E0518' },
}
const DEFAULT_THEME = { bg: '#060C18', glow: '#3A9DBC', ground: '#080E1E' }
const BOSS_THEME    = { bg: '#0D0205', glow: '#F7C841', ground: '#120309' }

/* ── Creature Card ──────────────────────────────────────────────────────────── */

interface CardProps {
  imageUrl: string
  name: string
  element: string
  rarity: string
  currentHp: number
  maxHp: number
  atk?: number
  animState?: 'idle' | 'attack' | 'damage'
  side: 'left' | 'right'
  lineup?: Array<{ color: string; isActive: boolean; fainted: boolean }>
  lineupLabel?: string
  isBoss?: boolean
}

function CreatureCard({ imageUrl, name, element, rarity, currentHp, maxHp, atk, animState = 'idle', side, lineup, lineupLabel, isBoss }: CardProps) {
  const spriteSize = typeof window !== 'undefined'
    ? Math.round(Math.min(window.innerWidth * 0.35, window.innerHeight * 0.2, 158))
    : 122
  const imageWidth = spriteSize + 10
  const rarityColor = isBoss ? '#F7C841' : (RARITY_COLORS[rarity as Rarity] ?? '#64748b')
  const elemEmoji   = ELEMENT_EMOJI[element as keyof typeof ELEMENT_EMOJI] ?? '✦'
  const hpPct       = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const hpColor     = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'

  const borderRadius = side === 'right' ? '16px 0 0 16px' : '0 16px 16px 0'

  return (
    <div
      className="flex overflow-hidden relative"
      style={{
        borderRadius,
        background: 'rgba(4,8,18,0.92)',
        border: `1px solid ${rarityColor}45`,
        borderRight: side === 'right' ? 'none' : `1px solid ${rarityColor}45`,
        borderLeft:  side === 'left'  ? 'none' : `1px solid ${rarityColor}45`,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 16px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${rarityColor}18`,
      }}
    >
      {/* ── Image section ── */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{
          width: imageWidth,
          background: `linear-gradient(135deg, ${rarityColor}18 0%, transparent 70%)`,
        }}
      >
        <CreatureSprite
          imageUrl={imageUrl}
          name={name}
          animState={animState}
          size={spriteSize}
          element={element as Element}
          rarity={rarity as Rarity}
          showAura
        />
        {isBoss && (
          <div className="absolute top-1.5 left-1.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: 'rgba(247,200,65,0.2)', border: '1px solid rgba(247,200,65,0.5)', color: '#F7C841' }}>
            BOSS
          </div>
        )}
      </div>

      {/* ── Info section ── */}
      <div className="flex-1 px-3 py-2.5 flex flex-col justify-between min-w-0">
        {/* Name + badges */}
        <div>
          <p className="font-extrabold text-white text-[13px] leading-tight truncate mb-1.5">{name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isBoss ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(247,200,65,0.15)', border: '1px solid rgba(247,200,65,0.4)', color: '#F7C841' }}>
                Capo Palestra
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${rarityColor}22`, border: `1px solid ${rarityColor}55`, color: rarityColor }}>
                {rarity?.replace('_', ' ')}
              </span>
            )}
            <span className="text-[11px] leading-none">{elemEmoji}</span>
            <span className="text-[9px] text-white/35 capitalize">{element}</span>
          </div>
        </div>

        {/* Lineup dots */}
        {lineup && lineup.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {lineupLabel && (
              <span className="text-[8px] text-white/25 uppercase tracking-wider">{lineupLabel}</span>
            )}
            <div className="flex gap-1">
              {lineup.map((dot, i) => (
                <div key={i} className="w-2 h-2 rounded-full"
                  style={{
                    background: dot.fainted ? 'rgba(255,255,255,0.1)' : dot.color,
                    opacity: dot.fainted ? 0.3 : dot.isActive ? 1 : 0.55,
                    boxShadow: dot.isActive ? `0 0 4px ${dot.color}` : 'none',
                  }} />
              ))}
            </div>
          </div>
        )}

        {/* ATK stat */}
        {atk !== undefined && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider">ATK</span>
            <span className="text-[11px] font-extrabold" style={{ color: isBoss ? '#F7C841' : '#E85D2F' }}>{atk}</span>
          </div>
        )}

        {/* HP bar */}
        <div className="mt-1.5">
          <div className="h-[7px] rounded-full overflow-hidden mb-[3px]" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.5 }}
              style={{ background: hpColor, boxShadow: `0 0 6px ${hpColor}90` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-wider text-white/25">HP</span>
            <span className="text-[9px] font-mono font-bold text-white/50">{currentHp}/{maxHp}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatFortuneText(fortune: CombatFortuneInfo | null | undefined): string | null {
  if (!fortune) return null
  if (fortune.deltaPercent === 0) return fortune.label

  const sign = fortune.deltaPercent > 0 ? '+' : ''
  return `${fortune.label} ${sign}${fortune.deltaPercent}%`
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(247,200,65,0.12)', border: '1px solid rgba(247,200,65,0.3)' }}>
            <span className="text-xl">💀</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Capo Palestra</h1>
            <p className="text-white/40 text-xs">{bossName} ti sfida! Scegli la tua squadra</p>
          </div>
        </div>

        {/* Boss lineup preview — with images */}
        <div className="flex items-center gap-2 mt-3">
          {bossLineup.map((bc, i) => (
            <div key={i} className="flex-1 flex items-center gap-2 rounded-xl px-2 py-1.5"
              style={{ background: 'rgba(247,200,65,0.06)', border: '1px solid rgba(247,200,65,0.2)' }}>
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0"
                style={{ background: 'rgba(247,200,65,0.1)' }}>
                {bc.image_url
                  ? <img src={bc.image_url} alt={bc.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-base">{ELEMENT_EMOJI[bc.element] ?? '?'}</div>
                }
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white/80 truncate">{bc.name}</p>
                <p className="text-[9px] text-white/35">{ELEMENT_EMOJI[bc.element]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Squad slots — with images */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-semibold">La tua squadra ({filledCount}/3)</p>
        <div className="flex gap-2">
          {lineup.map((c, i) => (
            <button
              key={i}
              onClick={() => c && onRemoveSlot(i)}
              className="flex-1 rounded-xl border-2 transition-all overflow-hidden"
              style={{
                height: 64,
                borderColor: c ? 'rgba(58,157,188,0.6)' : 'rgba(255,255,255,0.12)',
                borderStyle: c ? 'solid' : 'dashed',
                background: c ? 'rgba(58,157,188,0.08)' : 'rgba(255,255,255,0.02)',
              }}
            >
              {c ? (
                <div className="flex items-center gap-1.5 h-full px-2">
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0"
                    style={{ background: `${RARITY_COLORS[c.rarity]}18` }}>
                    {c.image_url
                      ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-base">{ELEMENT_EMOJI[c.element]}</div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-white truncate">{c.name}</p>
                    <p className="text-[9px]" style={{ color: RARITY_COLORS[c.rarity] }}>{c.rarity}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-white/20 text-2xl font-light">+</span>
                </div>
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
              className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-all"
              style={{
                borderColor: inLineup ? 'rgba(58,157,188,0.5)' : 'rgba(255,255,255,0.07)',
                background: inLineup ? 'rgba(58,157,188,0.08)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                style={{ background: `${RARITY_COLORS[c.rarity]}18` }}>
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xl">{ELEMENT_EMOJI[c.element]}</div>
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
              {inLineup && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(58,157,188,0.2)', border: '1px solid rgba(58,157,188,0.5)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3A9DBC" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={onConfirm}
          disabled={filledCount < 3 || starting}
          className="w-full text-white font-extrabold py-3.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{
            background: filledCount < 3 || starting ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
            boxShadow: filledCount >= 3 && !starting ? '0 4px 20px rgba(232,93,47,0.4)' : 'none',
          }}
        >
          {starting ? 'Inizio battaglia...' : filledCount < 3 ? `Seleziona ancora ${3 - filledCount}` : '⚔️ Inizia la battaglia!'}
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
  bossAttacking,
  log,
  animState,
  bossAnimState,
  lastDamage,
  battagliaItems,
  selectedItemId,
  onSelectItem,
  switchNotice,
  fortuneNotice,
}: {
  bossLineup: BossSlot[]
  playerLineup: PlayerSlot[]
  bossActiveSlot: number
  onAttack: () => void
  attacking: boolean
  bossAttacking: boolean
  log: string[]
  animState: 'idle' | 'attack' | 'damage'
  bossAnimState: 'idle' | 'attack' | 'damage'
  lastDamage: { amount: number; target: 'me' | 'boss'; id: number } | null
  battagliaItems: BattagliaItem[]
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  switchNotice: string | null
  fortuneNotice: { id: number; text: string; tone: CombatFortuneInfo['tone'] } | null
}) {
  const [showItemsModal, setShowItemsModal] = useState(false)

  const activeBoss   = bossLineup[bossActiveSlot]
  const activePlayer = playerLineup.find(c => c.is_active && !c.fainted)

  if (!activeBoss || !activePlayer) return null

  // Build lineup dots
  const bossLineupDots = bossLineup.map((c, i) => ({
    color: '#F7C841',
    isActive: i === bossActiveSlot && !c.fainted,
    fainted: c.fainted,
  }))
  const playerLineupDots = [...playerLineup].sort((a, b) => a.slot - b.slot).map(c => ({
    color: RARITY_COLORS[c.rarity] ?? '#3A9DBC',
    isActive: c.is_active,
    fainted: c.fainted,
  }))

  // Element-themed background
  const playerTheme = ELEMENT_THEME[activePlayer.element] ?? DEFAULT_THEME
  const selectedItem = battagliaItems.find(it => it.inventoryId === selectedItemId)

  return (
    <div className="flex flex-col h-full overflow-hidden select-none relative"
      style={{ background: BOSS_THEME.bg }}>

      {/* ── Atmospheric background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Boss glow — top-right */}
        <div className="absolute top-0 right-0 w-[65%] h-[55%]"
          style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(247,200,65,0.22) 0%, transparent 70%)' }} />
        {/* Player element glow — bottom-left */}
        <div className="absolute bottom-0 left-0 w-[65%] h-[50%]"
          style={{ background: `radial-gradient(ellipse at 20% 80%, ${playerTheme.glow}22 0%, transparent 70%)` }} />
        {/* Mid shadow */}
        <div className="absolute inset-x-0" style={{
          top: '38%', height: '24%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
        }} />
        {/* Ground line */}
        <div className="absolute inset-x-0" style={{
          top: '48%', height: 1,
          background: `linear-gradient(90deg, transparent, ${playerTheme.glow}18, rgba(247,200,65,0.18), transparent)`,
        }} />
      </div>

      {/* Switch notice */}
      <AnimatePresence>
        {switchNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-xl px-4 py-2 text-sm font-bold text-[#C084FC] text-center"
            style={{ background: 'rgba(123,77,184,0.18)', border: '1px solid rgba(123,77,184,0.4)', backdropFilter: 'blur(8px)' }}
          >
            ✨ {switchNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Items modal ── */}
      <AnimatePresence>
        {showItemsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowItemsModal(false)}
              className="absolute inset-0 z-20"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl overflow-hidden"
              style={{ background: 'rgba(8,14,28,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}
            >
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <p className="font-extrabold text-white text-base">Oggetti Battaglia</p>
                <button onClick={() => setShowItemsModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="px-4 pb-6 flex flex-col gap-2">
                {battagliaItems.map(item => (
                  <button key={item.inventoryId}
                    onClick={() => {
                      onSelectItem(selectedItemId === item.inventoryId ? null : item.inventoryId)
                      setShowItemsModal(false)
                    }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                    style={{
                      background: selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      ⚔️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      <p className="text-xs text-[#FBBF24]">+{item.effectValue}% ATK</p>
                    </div>
                    <span className="text-sm font-bold text-white/35 shrink-0">×{item.quantity}</span>
                    {selectedItemId === item.inventoryId && (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#FBBF24' }} />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── BATTLE FIELD ── */}
      <div className="relative flex-1 z-10 overflow-hidden">
        {/* Boss card — top-right, flush to right edge */}
        <motion.div
          className="absolute z-10"
          style={{ top: 12, right: 0, left: '8%' }}
          animate={
            bossAnimState === 'attack' ? { x: -14, scale: 1.03 } :
            bossAnimState === 'damage' ? { x: 8, opacity: 0.6 } :
            { x: 0, scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.15 }}
        >
          <CreatureCard
            imageUrl={activeBoss.image_url || activeBoss.sprite_url}
            name={activeBoss.name}
            element={activeBoss.element}
            rarity="leggendaria"
            currentHp={activeBoss.current_hp}
            maxHp={activeBoss.max_hp}
            atk={activeBoss.atk}
            animState={bossAnimState}
            side="right"
            lineup={bossLineupDots}
            lineupLabel="Boss"
            isBoss
          />
        </motion.div>

        {/* Player card — bottom-left, flush to left edge */}
        <motion.div
          className="absolute z-10"
          style={{ bottom: 12, left: 0, right: '8%' }}
          animate={
            animState === 'attack' ? { x: 14, scale: 1.03 } :
            animState === 'damage' ? { x: -8, opacity: 0.6 } :
            { x: 0, scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activePlayer.player_creature_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <CreatureCard
                imageUrl={activePlayer.image_url}
                name={activePlayer.name}
                element={activePlayer.element}
                rarity={activePlayer.rarity}
                currentHp={activePlayer.current_hp}
                maxHp={activePlayer.max_hp}
                atk={activePlayer.atk}
                animState={animState}
                side="left"
                lineup={playerLineupDots}
                lineupLabel="Tu"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── Standalone damage floats (outside cards, not clipped) ── */}
        <AnimatePresence>
          {lastDamage?.target === 'boss' && (
            <motion.div
              key={`boss-dmg-${lastDamage.id}`}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -80, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute pointer-events-none z-50"
              style={{ top: '28%', left: '50%', transform: 'translateX(-50%)' }}
            >
              <span style={{ color: '#EF4444', fontSize: 38, fontWeight: 900, textShadow: '0 0 24px rgba(239,68,68,0.9), 0 0 48px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.9)' }}>
                -{lastDamage.amount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {lastDamage?.target === 'me' && (
            <motion.div
              key={`me-dmg-${lastDamage.id}`}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -80, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute pointer-events-none z-50"
              style={{ bottom: '32%', left: '50%', transform: 'translateX(-50%)' }}
            >
              <span style={{ color: '#EF4444', fontSize: 38, fontWeight: 900, textShadow: '0 0 24px rgba(239,68,68,0.9), 0 0 48px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.9)' }}>
                -{lastDamage.amount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Turn / Log strip ── */}
      <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-1.5">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
        <AnimatePresence mode="wait">
          {bossAttacking ? (
            <motion.div key="boss-turn"
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(247,200,65,0.15)', border: '1px solid rgba(247,200,65,0.4)' }}
            >
              <motion.div className="w-1.5 h-1.5 rounded-full bg-[#F7C841]"
                animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              <span className="text-[10px] font-bold text-[#F7C841]">Capo Palestra attacca!</span>
            </motion.div>
          ) : switchNotice ? (
            <motion.div key="switch" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              className="text-[10px] font-bold text-[#C084FC] px-3 py-1 rounded-full"
              style={{ background: 'rgba(123,77,184,0.18)', border: '1px solid rgba(123,77,184,0.4)' }}>
              ✨ {switchNotice}
            </motion.div>
          ) : fortuneNotice ? (
            <motion.div key={`fortune-${fortuneNotice.id}`} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}>
              <CombatFortuneBadge text={fortuneNotice.text} tone={fortuneNotice.tone} />
            </motion.div>
          ) : (
            <AnimatePresence>
              {log[log.length - 1] && (
                <motion.span
                  key={log.length}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="text-[10px] font-semibold text-white/35 text-center"
                >
                  {log[log.length - 1]}
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </AnimatePresence>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
      </div>

      {/* ── ACTIONS ── */}
      <div className="shrink-0 px-4 pb-5 pt-1 z-10 flex gap-2">
        {/* Items button */}
        {battagliaItems.length > 0 && (
          <motion.button
            onClick={() => setShowItemsModal(true)}
            whileTap={{ scale: 0.95 }}
            className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
            style={{
              background: selectedItemId ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${selectedItemId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.09)'}`,
            }}
          >
            <span className="text-lg leading-none">🗡️</span>
            {selectedItemId && <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />}
          </motion.button>
        )}

        {/* Attack button */}
        <motion.button
          onClick={onAttack}
          disabled={attacking || bossAttacking}
          whileTap={!attacking && !bossAttacking ? { scale: 0.95 } : {}}
          className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base disabled:cursor-not-allowed transition-all"
          style={{
            background: bossAttacking
              ? 'rgba(247,200,65,0.08)'
              : attacking
                ? 'rgba(255,255,255,0.06)'
                : selectedItemId
                  ? 'linear-gradient(135deg, #FBBF24 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
            boxShadow: !attacking && !bossAttacking
              ? selectedItemId ? '0 4px 20px rgba(251,191,36,0.35)' : '0 4px 20px rgba(232,93,47,0.4)'
              : 'none',
            border: bossAttacking ? '1px solid rgba(247,200,65,0.25)' : 'none',
            opacity: attacking || bossAttacking ? 0.7 : 1,
          }}
        >
          {bossAttacking ? (
            <span className="text-[#F7C841]/60 text-sm">Turno del Capo Palestra...</span>
          ) : attacking ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2">
              ⚔️ {selectedItem ? `Attacca (+${selectedItem.effectValue}% ATK)` : 'Attacca!'}
            </span>
          )}
        </motion.button>
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
        <div className="w-full rounded-2xl p-4 space-y-2"
          style={{ background: 'rgba(247,200,65,0.06)', border: '1px solid rgba(247,200,65,0.2)' }}>
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3 text-center">Ricompense</p>
          <div className="grid grid-cols-2 gap-2">
            {(reward.gold ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(247,200,65,0.08)', border: '1px solid rgba(247,200,65,0.2)' }}>
                <span className="text-lg">🪙</span>
                <div>
                  <p className="font-extrabold text-sm" style={{ color: '#F7C841' }}>{reward.gold}</p>
                  <p className="text-white/30 text-xs">Oro</p>
                </div>
              </div>
            )}
            {(reward.exp ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(58,157,188,0.08)', border: '1px solid rgba(58,157,188,0.2)' }}>
                <span className="text-lg">✨</span>
                <div>
                  <p className="font-extrabold text-sm" style={{ color: '#3A9DBC' }}>{reward.exp}</p>
                  <p className="text-white/30 text-xs">EXP</p>
                </div>
              </div>
            )}
          </div>
          {levelUp && (
            <div className="mt-2 text-center">
              <span className="text-sm font-bold" style={{ color: '#F7C841' }}>⭐ Level Up! Livello {levelUp.newLevel}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onExit}
        className="w-full text-white font-extrabold py-4 rounded-2xl text-base"
        style={{
          background: won ? 'linear-gradient(135deg, #F7C841 0%, #d4a030 100%)' : 'rgba(255,255,255,0.08)',
          boxShadow: won ? '0 4px 20px rgba(247,200,65,0.35)' : 'none',
          color: won ? '#0D0205' : 'white',
        }}
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
  const [bossAttacking, setBossAttacking] = useState(false)
  const attackingRef = useRef(false)
  const [log, setLog]                     = useState<string[]>([])
  const [animState, setAnimState]         = useState<'idle' | 'attack' | 'damage'>('idle')
  const [bossAnimState, setBossAnimState] = useState<'idle' | 'attack' | 'damage'>('idle')
  const [lastDamage, setLastDamage]       = useState<{ amount: number; target: 'me' | 'boss'; id: number } | null>(null)
  const [battagliaItems, setBattagliaItems] = useState<BattagliaItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [switchNotice, setSwitchNotice]   = useState<string | null>(null)
  const [fortuneNotice, setFortuneNotice] = useState<{ id: number; text: string; tone: CombatFortuneInfo['tone'] } | null>(null)
  const [finalResult, setFinalResult]     = useState<{ won: boolean; reward: any; levelUp: any } | null>(null)

  const addLog = (msg: string) => setLog(prev => [...prev.slice(-9), msg])

  function flashFortuneNotice(fortune: CombatFortuneInfo | null | undefined) {
    const text = formatFortuneText(fortune)
    if (!text || !fortune) return

    const id = Date.now()
    setFortuneNotice({ id, text, tone: fortune.tone })
    setTimeout(() => {
      setFortuneNotice(current => current?.id === id ? null : current)
    }, 1800)
  }

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')

    async function load() {
      const fightRes = await fetch(`/api/game/boss/${id}`)
      if (!fightRes.ok) { setError('Boss fight non trovato'); setLoading(false); return }
      const { fight: f } = await fightRes.json()
      setFight(f)

      if (f.status === 'won' || f.status === 'lost') {
        setFinalResult({
          won: f.status === 'won',
          reward: f.status === 'won' && !f.reward_claimed ? f.reward : null,
          levelUp: null,
        })
        setLoading(false)
        return
      }

      if (f.status === 'active') {
        setBossLineup(f.boss_lineup)
        setPlayerLineup(f.player_lineup)
        setBossActiveSlot(f.boss_active_slot)
        addLog('La battaglia è in corso...')
      }

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

          // Patch player lineup with image_url from creature data (fixes resumed fights
          // where the JSONB was saved before image_url was added to the API response)
          if (f.status === 'active') {
            const imgById: Record<string, string> = {}
            mapped.forEach(c => { if (c.image_url) imgById[c.playerCreatureId] = c.image_url })
            setPlayerLineup((prev: PlayerSlot[]) =>
              prev.map(slot => ({ ...slot, image_url: slot.image_url || imgById[slot.player_creature_id] || '' }))
            )
          }

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
    addLog('La battaglia contro il Capo Palestra è iniziata!')
    setStarting(false)
  }

  async function handleAttack() {
    if (attackingRef.current) return
    attackingRef.current = true
    setAttacking(true)
    setAnimState('attack')
    setTimeout(() => setAnimState('idle'), 300)

    const res = await fetch(`/api/game/boss/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'attack', itemId: selectedItemId || undefined }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); attackingRef.current = false; setAttacking(false); return }

    setSelectedItemId(null)
    if (selectedItemId) {
      setBattagliaItems(prev => prev.map(item =>
        item.inventoryId === selectedItemId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ).filter(item => item.quantity > 0))
    }

    setBossLineup(data.bossLineup)
    setPlayerLineup(data.playerLineup)
    const newBossSlot = data.bossLineup.findIndex((c: BossSlot) => !c.fainted)
    setBossActiveSlot(newBossSlot === -1 ? 0 : newBossSlot)

    const isOver = data.status === 'won' || data.status === 'lost'
    const activePlayer = data.playerLineup.find((c: PlayerSlot) => c.is_active)
    const playerFortuneText = formatFortuneText(data.playerFortune as CombatFortuneInfo | undefined)
    addLog(`${activePlayer?.name ?? 'Tu'} colpisce per ${data.playerDamage} danni${playerFortuneText ? ` · ${playerFortuneText}` : ''}!`)
    flashFortuneNotice(data.playerFortune as CombatFortuneInfo | undefined)

    // Phase 1: player attacks boss
    setLastDamage({ amount: data.playerDamage, target: 'boss', id: Date.now() })
    setBossAnimState('damage')

    setTimeout(() => {
      setBossAnimState('idle')
      setLastDamage(null)

      if (!isOver && data.bossDamage > 0) {
        // Phase 2: boss counter-attacks (2 seconds total from player attack)
        setBossAttacking(true)
        setTimeout(() => {
          setBossAttacking(false)
          setLastDamage({ amount: data.bossDamage, target: 'me', id: Date.now() })
          setAnimState('damage')
          const bossFortuneText = formatFortuneText(data.bossFortune as CombatFortuneInfo | undefined)
          addLog(`Il Capo Palestra risponde con ${data.bossDamage} danni${bossFortuneText ? ` · ${bossFortuneText}` : ''}!`)
          flashFortuneNotice(data.bossFortune as CombatFortuneInfo | undefined)

          if (data.bossSwitchedTo) {
            setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`)
            setTimeout(() => setSwitchNotice(null), 2000)
          }
          if (data.playerSwitchedTo) {
            setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`)
            setTimeout(() => setSwitchNotice(null), 2000)
          }

          setTimeout(() => {
            setAnimState('idle')
            setLastDamage(null)
            attackingRef.current = false
            setAttacking(false)  // re-enable only after both animations done
          }, 900)
        }, 1100)  // boss "thinks" for ~1s then strikes
      } else {
        // Boss fainted or game over — no counter-attack
        if (data.bossSwitchedTo) {
          setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`)
          setTimeout(() => setSwitchNotice(null), 2000)
        }
        if (isOver) {
          window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
          if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
          setTimeout(() => {
            setFinalResult({ won: data.won, reward: data.reward, levelUp: data.levelUp })
          }, 400)
        }
        attackingRef.current = false
        setAttacking(false)
      }
    }, 900)
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
      <div className="flex items-center justify-center h-full" style={{ background: BOSS_THEME.bg }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(247,200,65,0.4)', borderTopColor: '#F7C841' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6" style={{ background: BOSS_THEME.bg }}>
        <span className="text-4xl">❌</span>
        <p className="text-red-400 text-center">{error}</p>
        <button onClick={() => router.back()} className="text-[#3A9DBC] underline text-sm">Torna indietro</button>
      </div>
    )
  }

  if (finalResult) {
    return (
      <div className="h-full" style={{ background: BOSS_THEME.bg }}>
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
    <div className="h-full text-white flex flex-col overflow-hidden relative" style={{ background: BOSS_THEME.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 z-10 relative"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => router.back()} className="text-white/40 text-sm">← Indietro</button>
        <span className="text-sm font-bold" style={{ color: 'rgba(247,200,65,0.7)' }}>💀 Capo Palestra</span>
        {fight?.status === 'active' && (
          <button onClick={handleSurrender} className="text-red-400/50 text-xs">Arrenditi</button>
        )}
        {fight?.status !== 'active' && <span className="w-16" />}
      </div>

      {fight?.status === 'selecting' || fight?.status === undefined ? (
        loadingCreatures ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(247,200,65,0.3)', borderTopColor: '#F7C841' }} />
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
            bossAttacking={bossAttacking}
            log={log}
            animState={animState}
            bossAnimState={bossAnimState}
            lastDamage={lastDamage}
            battagliaItems={battagliaItems}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            switchNotice={switchNotice}
            fortuneNotice={fortuneNotice}
          />
        </div>
      )}
    </div>
  )
}
