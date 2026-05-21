'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AttackAnimation from '@/components/battle/AttackAnimation'
import BattleAtmosphere from '@/components/battle/BattleAtmosphere'
import ImmersiveBattleLayout, { type ImmersiveDamage, type ImmersiveNotice } from '@/components/battle/ImmersiveBattleLayout'
import type { BattleAction } from '@/components/battle/ActionBar'
import type { SquadMember } from '@/components/battle/SquadBar'
import { IconFlask, IconSword } from '@/components/battle/icons'
import CombatFortuneBadge from '@/components/game/CombatFortuneBadge'
import CreatureCard from '@/components/game/boss/CreatureCard'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import { playBossSound } from '@/lib/game/battle-sounds'
import { startBossLoop } from '@/lib/game/sounds/battle-loop'
import {
  ELEMENT_THEME,
  DEFAULT_THEME,
  BOSS_THEME,
  type BossSlot,
  type PlayerSlot,
  type BattagliaItem,
  type CombatFortuneInfo,
} from '@/components/game/boss/types'

export default function BattleScreen({
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
  curaItems,
  selectedItemId,
  onSelectItem,
  onHeal,
  onSwitch,
  switchNotice,
  fortuneNotice,
  critNotice,
  statusNotice,
  bossFainting,
  playerFainting,
  attackAnim,
  onAttackAnimComplete,
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
  lastDamage: { amount: number; target: 'me' | 'boss'; id: number; isCrit?: boolean } | null
  battagliaItems: BattagliaItem[]
  curaItems: BattagliaItem[]
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  onHeal: (itemId: string) => void
  onSwitch: (playerCreatureId: string) => void
  switchNotice: string | null
  fortuneNotice: { id: number; text: string; tone: CombatFortuneInfo['tone'] } | null
  critNotice: { id: number } | null
  statusNotice: { id: number; emoji: string; text: string; color: string; glow: string } | null
  bossFainting: boolean
  playerFainting: boolean
  attackAnim: { key: number; element: string; rarity: string; side: 'left' | 'right'; soundUrl?: string | null; soundDurationMs?: number | null } | null
  onAttackAnimComplete: () => void
}) {
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [pendingSwitchCreatureId, setPendingSwitchCreatureId] = useState<string | null>(null)
  const [showBossIntro, setShowBossIntro] = useState(true)
  const [turnTimer, setTurnTimer] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoFightRef = useRef(false)
  const onAttackRef = useRef(onAttack)
  useEffect(() => { onAttackRef.current = onAttack })

  useEffect(() => {
    playBossSound()
    const stopLoop = startBossLoop()
    return () => { stopLoop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTurnTimer(30)
    autoFightRef.current = false
    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          if (!autoFightRef.current) {
            autoFightRef.current = true
            onAttackRef.current()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    if (!attacking && !bossAttacking) {
      resetTimer()
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [attacking, bossAttacking]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeBoss = bossLineup[bossActiveSlot]
  const activePlayer = playerLineup.find(c => c.is_active && !c.fainted)
  const playerSleeping = activePlayer?.active_status === 'sonno'

  useEffect(() => {
    if (playerSleeping && selectedItemId) onSelectItem(null)
  }, [onSelectItem, playerSleeping, selectedItemId])

  if (!activeBoss || !activePlayer) return null

  const bossLineupDots = bossLineup.map((c, i) => ({
    color: '#F7C841',
    isActive: i === bossActiveSlot && !c.fainted,
    fainted: c.fainted,
  }))
  const playerLineupDots = [...playerLineup]
    .sort((a, b) => a.slot - b.slot)
    .map(c => ({
      color: RARITY_COLORS[c.rarity] ?? '#3A9DBC',
      isActive: c.is_active,
      fainted: c.fainted,
    }))

  const playerTheme = ELEMENT_THEME[activePlayer.element] ?? DEFAULT_THEME
  const selectedItem = battagliaItems.find(it => it.inventoryId === selectedItemId)
  const renderLegacyBattleUi = process.env.NEXT_PUBLIC_BATTLE_LEGACY_UI === '1'
  const bossDamage: ImmersiveDamage | null = lastDamage
    ? {
        id: lastDamage.id,
        amount: lastDamage.amount,
        target: lastDamage.target === 'boss' ? 'enemy' : 'player',
        kind: lastDamage.isCrit ? 'crit' : 'damage',
        label: lastDamage.isCrit ? 'CRITICO! x1.75' : undefined,
      }
    : null
  const bossNotice: ImmersiveNotice | null = statusNotice
    ? { id: `status-${statusNotice.id}`, text: `${statusNotice.emoji} ${statusNotice.text}`, color: statusNotice.color, glow: statusNotice.glow }
    : critNotice
      ? { id: `crit-${critNotice.id}`, text: 'CRITICO! x1.75', critical: true, color: '#FB923C', glow: 'rgba(249,115,22,.5)' }
      : bossAttacking
        ? { id: 'boss-turn', text: 'Capo Palestra attacca!', color: '#F7C841', glow: 'rgba(247,200,65,.42)' }
        : switchNotice
          ? { id: `switch-${switchNotice}`, text: switchNotice, color: '#C084FC', glow: 'rgba(192,132,252,.35)' }
          : fortuneNotice
            ? { id: `fortune-${fortuneNotice.id}`, text: fortuneNotice.text, color: '#F0CE7A', glow: 'rgba(240,206,122,.34)' }
            : log[log.length - 1]
              ? { id: `log-${log.length}`, text: log[log.length - 1], color: 'rgba(255,255,255,.78)', glow: 'rgba(255,255,255,.16)' }
              : null
  const bossSquadMembers: SquadMember[] = [...playerLineup].sort((a, b) => a.slot - b.slot).map(slot => ({
    id: slot.player_creature_id,
    name: slot.name,
    element: slot.element,
    hp: slot.current_hp,
    maxHp: slot.max_hp,
    imageUrl: slot.sprite_url ?? slot.image_url,
    active: slot.is_active,
    fainted: slot.fainted,
  }))
  const bossActions: BattleAction[] = [
    {
      id: 'items',
      label: selectedItemId ? 'Boost' : 'Oggetti',
      icon: <IconFlask size={19} />,
      tone: selectedItemId ? 'gold' : 'dark',
      onClick: () => setShowItemsModal(true),
      disabled: attacking || bossAttacking || (battagliaItems.length === 0 && curaItems.length === 0),
    },
    {
      id: 'attack',
      label: playerSleeping ? 'Passa' : 'Attacca',
      icon: <IconSword size={21} />,
      primary: true,
      tone: selectedItemId ? 'gold' : 'orange',
      sub: selectedItem ? `+${selectedItem.effectValue}% ATK` : undefined,
      onClick: onAttack,
      disabled: attacking || bossAttacking,
      loading: attacking,
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden select-none relative" style={{ background: BOSS_THEME.bg }}>
      {!renderLegacyBattleUi && (
      <ImmersiveBattleLayout
        enemy={{
          name: activeBoss.name,
          element: activeBoss.element,
          rarity: activeBoss.rarity ?? 'leggendario',
          currentHp: activeBoss.current_hp,
          maxHp: activeBoss.max_hp,
          atk: activeBoss.atk,
          imageUrl: activeBoss.image_url,
          spriteUrl: activeBoss.sprite_url,
          animState: bossAnimState,
          fainting: bossFainting,
          statusEffect: activeBoss.active_status,
          statusTurnsLeft: activeBoss.status_turns_left,
        }}
        player={{
          name: activePlayer.name,
          element: activePlayer.element,
          rarity: activePlayer.rarity,
          currentHp: activePlayer.current_hp,
          maxHp: activePlayer.max_hp,
          atk: activePlayer.atk,
          imageUrl: activePlayer.image_url,
          spriteUrl: activePlayer.sprite_url,
          animState,
          fainting: playerFainting,
          statusEffect: activePlayer.active_status,
          statusTurnsLeft: activePlayer.status_turns_left,
        }}
        freeze={!!critNotice || !!lastDamage?.isCrit}
        bossGold="#F7C841"
        seamPct={44}
        notice={bossNotice}
        damage={bossDamage}
        attackAnimation={attackAnim}
        onAttackAnimationComplete={onAttackAnimComplete}
        squad={bossSquadMembers}
        onSwitch={setPendingSwitchCreatureId}
        switchDisabled={attacking || bossAttacking}
        timerSeconds={!bossAttacking ? turnTimer : undefined}
        timerTotal={30}
        actions={bossActions}
      />
      )}
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[65%] h-[55%]" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(247,200,65,0.22) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[65%] h-[50%]" style={{ background: `radial-gradient(ellipse at 20% 80%, ${playerTheme.glow}22 0%, transparent 70%)` }} />
        <div className="absolute inset-x-0" style={{ top: '38%', height: '24%', background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />
        <div className="absolute inset-x-0" style={{ top: '48%', height: 1, background: `linear-gradient(90deg, transparent, ${playerTheme.glow}18, rgba(247,200,65,0.18), transparent)` }} />
      </div>

      {/* Animated ambience — boss gold vs the player's element */}
      <BattleAtmosphere a="#F7C841" b={playerTheme.glow} />

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

      {/* Items modal */}
      <AnimatePresence>
        {showItemsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowItemsModal(false)}
              className="absolute inset-0 z-20"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl overflow-hidden"
              style={{ background: 'rgba(8,14,28,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}
            >
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <p className="font-extrabold text-white text-base">Oggetti Battaglia</p>
                <button
                  onClick={() => setShowItemsModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-4 pb-6 flex flex-col gap-3">
                {!playerSleeping && battagliaItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">
                      ⚔️ Battaglia — potenzia ATK questo turno
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {battagliaItems.map(item => (
                        <button
                          key={item.inventoryId}
                          onClick={() => {
                            onSelectItem(selectedItemId === item.inventoryId ? null : item.inventoryId)
                            setShowItemsModal(false)
                          }}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                          style={{
                            background: selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)'}`,
                          }}
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
                  </div>
                )}
                {curaItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">
                      💚 Cura — ripristina HP (il boss attacca)
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {curaItems.map(item => (
                        <button
                          key={item.inventoryId}
                          onClick={() => {
                            onHeal(item.inventoryId)
                            setShowItemsModal(false)
                          }}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'rgba(52,211,153,0.1)' }}>
                            💚
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{item.name}</p>
                            <p className="text-xs text-[#34D399]">+{item.effectValue}% HP</p>
                          </div>
                          <span className="text-sm font-bold text-white/35 shrink-0">×{item.quantity}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {renderLegacyBattleUi && (
        <>
      {/* BATTLE FIELD */}
      <div className="relative flex-1 z-10 overflow-hidden">
        {/* Boss card */}
        <motion.div
          className="absolute z-10"
          style={{ top: 12, right: 0, left: '8%' }}
          animate={
            bossAnimState === 'attack'
              ? { x: -14, scale: 1.03 }
              : bossAnimState === 'damage'
                ? { x: 8, opacity: 0.6 }
                : { x: 0, scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`boss-${bossActiveSlot}`}
              initial={{ opacity: 0, x: showBossIntro ? 340 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={showBossIntro ? { type: 'spring', stiffness: 80, damping: 14, delay: 3.3 } : { duration: 0.25 }}
            >
              <CreatureCard
                imageUrl={activeBoss.sprite_url || activeBoss.image_url}
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
                fainting={bossFainting}
                statusEffect={activeBoss.active_status}
                statusTurnsLeft={activeBoss.status_turns_left}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Player card */}
        <motion.div
          className="absolute z-10"
          style={{ bottom: 12, left: 0, right: '8%' }}
          animate={
            animState === 'attack'
              ? { x: 14, scale: 1.03 }
              : animState === 'damage'
                ? { x: -8, opacity: 0.6 }
                : { x: 0, scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activePlayer.player_creature_id}
              initial={{ opacity: 0, x: showBossIntro ? -340 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={showBossIntro ? { type: 'spring', stiffness: 80, damping: 14, delay: 4.0 } : { duration: 0.25 }}
            >
              <CreatureCard
                imageUrl={activePlayer.sprite_url ?? activePlayer.image_url}
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
                fainting={playerFainting}
                statusEffect={activePlayer.active_status}
                statusTurnsLeft={activePlayer.status_turns_left}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Attack animation overlay */}
        {attackAnim && (
          <AttackAnimation
            key={attackAnim.key}
            element={attackAnim.element}
            rarity={attackAnim.rarity}
            side={attackAnim.side}
            soundUrl={attackAnim.soundUrl}
            soundDurationMs={attackAnim.soundDurationMs}
            onComplete={onAttackAnimComplete}
          />
        )}

        {/* Damage floats */}
        <AnimatePresence>
          {lastDamage?.target === 'boss' && (
            <motion.div
              key={`boss-dmg-${lastDamage.id}`}
              initial={{ opacity: 1, y: 0, scale: lastDamage.isCrit ? 1.4 : 1 }}
              animate={{ opacity: 0, y: -80, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute pointer-events-none z-50"
              style={{ top: '28%', left: '50%', transform: 'translateX(-50%)' }}
            >
              <span
                style={
                  lastDamage.isCrit
                    ? { color: '#FB923C', fontSize: 44, fontWeight: 900, textShadow: '0 0 28px rgba(249,115,22,0.95), 0 0 56px rgba(249,115,22,0.5), 0 2px 8px rgba(0,0,0,0.9)' }
                    : { color: '#EF4444', fontSize: 38, fontWeight: 900, textShadow: '0 0 24px rgba(239,68,68,0.9), 0 0 48px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.9)' }
                }
              >
                -{lastDamage.amount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {lastDamage?.target === 'me' && (
            <motion.div
              key={`me-dmg-${lastDamage.id}`}
              initial={{ opacity: 1, y: 0, scale: lastDamage.isCrit ? 1.4 : 1 }}
              animate={{ opacity: 0, y: -80, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute pointer-events-none z-50"
              style={{ bottom: '32%', left: '50%', transform: 'translateX(-50%)' }}
            >
              <span
                style={
                  lastDamage.isCrit
                    ? { color: '#FB923C', fontSize: 44, fontWeight: 900, textShadow: '0 0 28px rgba(249,115,22,0.95), 0 0 56px rgba(249,115,22,0.5), 0 2px 8px rgba(0,0,0,0.9)' }
                    : { color: '#EF4444', fontSize: 38, fontWeight: 900, textShadow: '0 0 24px rgba(239,68,68,0.9), 0 0 48px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.9)' }
                }
              >
                -{lastDamage.amount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: '46%', transform: 'translateY(-50%)' }}>
          <div className="flex items-center justify-center px-4">
            <AnimatePresence mode="wait">
              {statusNotice && (
                <motion.div
                  key={`status-center-${statusNotice.id}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full text-center"
                  style={{
                    background: `${statusNotice.color}18`,
                    border: `1px solid ${statusNotice.color}55`,
                    color: statusNotice.color,
                    boxShadow: `0 0 12px ${statusNotice.glow}`,
                    maxWidth: 240,
                  }}
                >
                  {statusNotice.emoji} {statusNotice.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Turn / Log strip */}
      <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-1.5">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
        <AnimatePresence mode="wait">
          {critNotice ? (
            <motion.div
              key={`crit-${critNotice.id}`}
              initial={{ opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold"
              style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.55)', color: '#FB923C' }}
            >
              ⚡ CRITICO! ×1.75
            </motion.div>
          ) : bossAttacking ? (
            <motion.div
              key="boss-turn"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(247,200,65,0.15)', border: '1px solid rgba(247,200,65,0.4)' }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[#F7C841]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold text-[#F7C841]">Capo Palestra attacca!</span>
            </motion.div>
          ) : switchNotice ? (
            <motion.div
              key="switch"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="text-[10px] font-bold text-[#C084FC] px-3 py-1 rounded-full"
              style={{ background: 'rgba(123,77,184,0.18)', border: '1px solid rgba(123,77,184,0.4)' }}
            >
              ✨ {switchNotice}
            </motion.div>
          ) : fortuneNotice ? (
            <motion.div
              key={`fortune-${fortuneNotice.id}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
            >
              <CombatFortuneBadge text={fortuneNotice.text} tone={fortuneNotice.tone} />
            </motion.div>
          ) : (
            <AnimatePresence>
              {log[log.length - 1] && (
                <motion.span
                  key={log.length}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
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

      {/* SQUAD BAR */}
      {playerLineup.length >= 2 && (
        <div className="shrink-0 px-3 pb-1.5 z-10">
          <div className="flex gap-1.5">
            {[...playerLineup].sort((a, b) => a.slot - b.slot).map(slot => {
              const hpPct = Math.max(0, Math.min(100, (slot.current_hp / slot.max_hp) * 100))
              const hpColor = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'
              const isActive = slot.is_active
              const isFainted = slot.fainted
              const canSwitch = !attacking && !bossAttacking && !isActive && !isFainted
              return (
                <div
                  key={slot.player_creature_id}
                  onClick={() => canSwitch && setPendingSwitchCreatureId(slot.player_creature_id)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.1)' : isFainted ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                    border:     isActive ? '1px solid rgba(255,255,255,0.22)' : canSwitch ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.07)',
                    opacity:    isFainted ? 0.35 : 1,
                    cursor:     canSwitch ? 'pointer' : 'default',
                  }}
                >
                  {(slot.sprite_url || slot.image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slot.sprite_url ?? slot.image_url}
                      alt={slot.name}
                      className="w-6 h-6 object-contain shrink-0"
                      style={{ filter: isFainted ? 'grayscale(1)' : 'none' }}
                    />
                  ) : (
                    <span className="text-sm shrink-0 leading-none">
                      {ELEMENT_EMOJI[slot.element as keyof typeof ELEMENT_EMOJI] ?? '✦'}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-white/50 truncate leading-none mb-0.5">{slot.name}</p>
                    <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        animate={{ width: `${hpPct}%` }}
                        transition={{ duration: 0.4 }}
                        style={{ background: hpColor }}
                      />
                    </div>
                  </div>
                  {isActive && !isFainted && <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
                  {canSwitch && <span className="text-[9px] text-white/50 shrink-0">↻</span>}
                  {isFainted && <span className="text-[9px] text-red-400/60 shrink-0 font-bold">✕</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TIMER BAR */}
      {(() => {
        const timerPct = (turnTimer / 30) * 100
        const timerUrgent = turnTimer <= 10
        return (
          <div className="shrink-0 px-4 pb-1 z-10">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${timerPct}%`,
                    background: bossAttacking ? 'rgba(247,200,65,0.4)' : timerUrgent ? '#EF4444' : '#34D399',
                  }}
                  animate={timerUrgent && !bossAttacking ? { opacity: [1, 0.4, 1] } : {}}
                  transition={timerUrgent && !bossAttacking ? { duration: 0.5, repeat: Infinity } : {}}
                />
              </div>
              {!bossAttacking && (
                <span className={`text-[11px] font-mono font-bold w-6 text-right shrink-0 ${timerUrgent ? 'text-red-400' : 'text-white/35'}`}>
                  {turnTimer}
                </span>
              )}
            </div>
          </div>
        )
      })()}

      {/* ACTIONS */}
      <div className="shrink-0 px-4 pb-5 pt-1 z-10 flex gap-2">
        {(battagliaItems.length > 0 || curaItems.length > 0) && (
          <motion.button
            onClick={() => setShowItemsModal(true)}
            whileTap={{ scale: 0.95 }}
            className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
            style={{
              background: selectedItemId ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
              border:     `1px solid ${selectedItemId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.09)'}`,
            }}
          >
            <span className="text-lg leading-none">🗡️</span>
            {selectedItemId && <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />}
          </motion.button>
        )}

        <motion.button
          onClick={onAttack}
          disabled={attacking || bossAttacking}
          whileTap={!attacking && !bossAttacking ? { scale: 0.95 } : {}}
          className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base disabled:cursor-not-allowed transition-all"
          style={{
            background:
              bossAttacking ? 'rgba(247,200,65,0.08)'
              : attacking  ? 'rgba(255,255,255,0.06)'
              : selectedItemId ? 'linear-gradient(135deg, #FBBF24 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
            boxShadow:
              !attacking && !bossAttacking
                ? selectedItemId
                  ? '0 4px 20px rgba(251,191,36,0.35)'
                  : '0 4px 20px rgba(232,93,47,0.4)'
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
              {playerSleeping
                ? '💤 Passa'
                : `⚔️ ${selectedItem ? `Attacca (+${selectedItem.effectValue}% ATK)` : 'Attacca!'}`}
            </span>
          )}
        </motion.button>
      </div>

        </>
      )}

      {/* BOSS INTRO OVERLAY */}
      <AnimatePresence>
        {showBossIntro && (
          <motion.div
            className="absolute inset-0 z-[100] overflow-hidden pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 1, 1, 0] }}
            transition={{ duration: 4.0, times: [0, 0.42, 0.68, 0.82, 1.0] }}
            onAnimationComplete={() => setShowBossIntro(false)}
            style={{ background: '#070400' }}
          >
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 10, height: 10, marginTop: -5, marginLeft: -5, background: '#F7C841', filter: 'blur(18px)' }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 16, 35], opacity: [0, 0.7, 0] }}
              transition={{ duration: 1.1, times: [0, 0.5, 1], ease: 'easeOut', delay: 0.05 }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 22, height: 22, marginTop: -11, marginLeft: -11, background: 'white' }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 110, opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.1, 0.85, 0.28, 1], delay: 0.2 }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 16, height: 16, marginTop: -8, marginLeft: -8, background: '#F7C841', filter: 'blur(6px)' }}
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 85, opacity: 0 }}
              transition={{ duration: 1.0, delay: 0.3, ease: [0.1, 0.85, 0.28, 1] }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 8, height: 8, marginTop: -4, marginLeft: -4, border: '2px solid rgba(247,200,65,0.9)', filter: 'blur(1px)' }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: [1, 45, 90], opacity: [1, 0.5, 0] }}
              transition={{ duration: 1.0, delay: 0.38, times: [0, 0.55, 1], ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 14, height: 14, marginTop: -7, marginLeft: -7, border: '1.5px solid rgba(247,200,65,0.6)', filter: 'blur(2px)' }}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: [1, 28, 65], opacity: [0.8, 0.4, 0] }}
              transition={{ duration: 1.3, delay: 0.58, times: [0, 0.5, 1], ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 0] }}
              transition={{ duration: 0.7, delay: 0.42, times: [0, 0.28, 0.6, 1] }}
              style={{ background: 'radial-gradient(ellipse 85% 65% at center, white 0%, rgba(247,200,65,0.7) 42%, transparent 72%)' }}
            />
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 0.65, delay: 0.8, times: [0, 0.4, 1] }}
              style={{ background: 'radial-gradient(ellipse 70% 55% at center, rgba(247,200,65,0.85) 0%, rgba(247,200,65,0.25) 55%, transparent 80%)' }}
            />
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.28, 0.12, 0.28, 0] }}
              transition={{ duration: 2.4, delay: 1.2, times: [0, 0.2, 0.5, 0.75, 1] }}
              style={{ background: 'radial-gradient(ellipse 65% 55% at center, rgba(247,200,65,0.5) 0%, transparent 65%)' }}
            />
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.12, 1.02, 0.85] }}
              transition={{ duration: 2.8, delay: 0.9, times: [0, 0.1, 0.72, 1.0] }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.3em', color: 'rgba(247,200,65,0.85)', textTransform: 'uppercase' }}>
                Capo Palestra
              </span>
              <span
                style={{
                  fontSize: 68,
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: 'white',
                  textShadow: '0 0 40px rgba(247,200,65,0.9), 0 0 80px rgba(247,200,65,0.5), 0 4px 16px rgba(0,0,0,0.9)',
                  lineHeight: 1.1,
                }}
              >
                💀
              </span>
            </motion.div>
            {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map((angle, i) => (
              <motion.div
                key={angle}
                className="absolute"
                style={{
                  top: '50%', left: '50%', width: 2.5, height: '200%', marginLeft: -1.25,
                  transformOrigin: 'top center',
                  rotate: `${angle}deg`,
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(247,200,65,0.7) 32%, rgba(247,200,65,0.7) 68%, transparent 100%)',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 1], opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.1, delay: 0.28 + i * 0.018, times: [0, 0.22, 1], ease: 'easeOut' }}
              />
            ))}
            {[7.5, 22.5, 37.5, 52.5, 67.5, 82.5, 97.5, 112.5, 127.5, 142.5, 157.5, 172.5].map((angle, i) => (
              <motion.div
                key={`b-${angle}`}
                className="absolute"
                style={{
                  top: '50%', left: '50%', width: 4, height: '200%', marginLeft: -2,
                  transformOrigin: 'top center',
                  rotate: `${angle}deg`,
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(247,200,65,0.4) 35%, rgba(247,200,65,0.4) 65%, transparent 100%)',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 1], opacity: [0, 0.65, 0] }}
                transition={{ duration: 1.5, delay: 0.52 + i * 0.018, times: [0, 0.2, 1], ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SWITCH CONFIRM MODAL */}
      <AnimatePresence>
        {pendingSwitchCreatureId && (() => {
          const slot = playerLineup.find(c => c.player_creature_id === pendingSwitchCreatureId)
          if (!slot) return null
          return (
            <motion.div
              key="boss-switch-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end justify-center pb-10"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPendingSwitchCreatureId(null)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="bg-[#111827] rounded-3xl px-6 py-5 mx-4 w-full max-w-sm"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                onClick={e => e.stopPropagation()}
              >
                <p className="text-white/60 text-sm text-center mb-3">Cambia creatura?</p>
                {(slot.sprite_url || slot.image_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.sprite_url ?? slot.image_url} alt={slot.name} className="w-16 h-16 object-contain mx-auto mb-2" />
                )}
                <p className="text-white font-bold text-center text-lg mb-1">{slot.name}</p>
                <p className="text-white/40 text-xs text-center mb-4">Il Capo Palestra potrà contrattaccare</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingSwitchCreatureId(null)}
                    className="flex-1 py-3 rounded-2xl text-white/50 text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => {
                      const pcId = pendingSwitchCreatureId
                      setPendingSwitchCreatureId(null)
                      resetTimer()
                      onSwitch(pcId)
                    }}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
                  >
                    ↻ Cambia
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
