'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { playEncounterSound } from '@/lib/game/battle-sounds'
import { startEncounterLoop } from '@/lib/game/sounds/battle-loop'
import { playCatchAttempt, playCatchFail, playCatchSuccess } from '@/lib/game/sounds/catch'
import { playKnockout, playFlee, playLevelUp, playDefeat } from '@/lib/game/sounds/events'
import AttackAnimation from '@/components/battle/AttackAnimation'
import { createClient } from '@/lib/supabase/client'
import { RARITY_COLORS, RARITY_LABELS, ELEMENT_EMOJI } from '@/lib/types'
import { getCatchHealthMultiplier } from '@/lib/game/rng'
import { STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import type { Creature, Element, Rarity } from '@/lib/types'

interface SquadCreature {
  pcId: string
  id: string
  name: string
  hp: number
  atk: number
  element: string
  rarity: string
  image_url: string | null
  attack_sound_url?: string | null
  attack_sound_duration_ms?: number | null
}

interface EncounterState {
  encounterId: string
  creature: Partial<Creature>
  wildHp: number
  wildHpMax: number
  catchMultiplier: number
  turns: number
  squadCreatures?: SquadCreature[]
}
interface InvItem {
  id: string
  quantity: number
  items: { id: string; name: string; type: string; effect_value: number }
}

// ── Element theme ──────────────────────────────────────────────────────────────
const ELEMENT_THEME: Record<string, { bg: string; glow: string; ground: string }> = {
  bosco:     { bg: '#030B05', glow: '#2ECC6A', ground: '#061408' },
  fiamma:    { bg: '#0D0305', glow: '#FF5520', ground: '#150505' },
  adriatico: { bg: '#020810', glow: '#00C4E8', ground: '#040C18' },
  terra:     { bg: '#0A0700', glow: '#D4A060', ground: '#120D02' },
  armonia:   { bg: '#08030F', glow: '#B060F8', ground: '#0E0518' },
}

const CATCH_STARS: Record<string, number> = {
  comune: 1, non_comune: 2, raro: 3, epico: 4, leggendario: 5, mitologico: 6
}

const THROW_MESSAGES = ['Lancio la rete!', 'Prendila!', 'Vai, cattura!', 'Ora o mai più!', 'È il momento!']
const FAIL_RESIST_MESSAGES = ['Ha rotto la rete!', 'Troppo forte, resiste...', 'Ha evitato la rete!', 'Si è liberata con un balzo!', 'Non era abbastanza...']
const FAIL_COUNTER_MESSAGES = ['Si è liberata e contrattacca!', 'Si è arrabbiata e risponde!', 'Ha sfondato la rete — attacca!']

// ── Battle dialogue ────────────────────────────────────────────────────────────
const FIGHT_PLAYER_MSGS = [
  (p: string, w: string) => `${p} scatta all'attacco su ${w}!`,
  (p: string, w: string) => `Vai ${p}, colpisci forte!`,
  (p: string, w: string) => `${p} si avventa su ${w}!`,
  (p: string, w: string) => `${p} sferra un colpo deciso!`,
  (p: string, w: string) => `Attacca, ${p}!`,
  (p: string, w: string) => `${p} punta dritta a ${w}!`,
]
const FIGHT_CRIT_MSGS = [
  '⚡ Colpo critico! Devastante!',
  '⚡ CRITICO! Che botta potente!',
  '⚡ Critico perfetto! Incredibile!',
  '⚡ Colpo critico! Senti quella forza!',
]
const WILD_COUNTER_MSGS = [
  (w: string) => `${w} risponde all'attacco!`,
  (w: string) => `${w} contrattacca furioso!`,
  (w: string) => `${w} non si arrende e colpisce!`,
  (w: string) => `${w} lancia un contrattacco!`,
  (w: string) => `${w} reagisce con tutta la forza!`,
]
function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ── Creature card (unified image + info) ──────────────────────────────────────
interface CardProps {
  imageUrl: string
  name: string
  element: string
  rarity: string
  currentHp: number
  maxHp: number
  atk?: number
  catchMultiplier?: number
  isWild?: boolean
  animState?: 'idle' | 'attack' | 'damage' | 'catch' | 'flee'
  fainting?: boolean
  side: 'left' | 'right'
  statusEffect?: StatusEffect | null
  statusTurnsLeft?: number
}

function formatCatchMultiplier(multiplier: number): string {
  if (Number.isInteger(multiplier)) return String(multiplier)
  return multiplier.toFixed(multiplier >= 2 ? 2 : 1).replace(/\.0$/, '')
}

function CreatureCard({ imageUrl, name, element, rarity, currentHp, maxHp, atk, catchMultiplier, isWild, animState = 'idle', fainting, side, statusEffect, statusTurnsLeft }: CardProps) {
  const rarityColor = RARITY_COLORS[rarity as Rarity] ?? '#64748b'
  const elemEmoji   = ELEMENT_EMOJI[element as keyof typeof ELEMENT_EMOJI] ?? '✦'
  const hpPct       = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const hpColor     = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'
  const stars       = CATCH_STARS[rarity] ?? 1
  const catchMult   = catchMultiplier ?? 1
  const catchBonusPct = Math.round((catchMult - 1) * 100)
  const catchFillPct  = Math.min(100, (catchMult - 1) / 2 * 100)
  const catchIntensity = Math.min(1, (catchMult - 1) / 2)

  const borderRadius = side === 'right'
    ? '16px 0 0 16px'
    : '0 16px 16px 0'

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
        filter: fainting ? 'grayscale(1)' : undefined,
        transition: 'filter 0.3s ease',
      }}
    >
      {fainting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <span style={{ fontSize: 32, lineHeight: 1 }}>💀</span>
          <span className="text-[10px] font-extrabold tracking-widest uppercase text-white/60">Svenuta</span>
        </motion.div>
      )}
      {/* ── Image section ── */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{
          width: 152,
          minHeight: 148,
          background: `linear-gradient(135deg, ${rarityColor}18 0%, transparent 70%)`,
        }}
      >
        {/* Net animation overlay (wild catch only) */}
        <AnimatePresence>
          {animState === 'catch' && isWild && (
            <motion.div key="net" className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              {/* SVG net drapes over the creature */}
              <motion.svg
                viewBox="0 0 140 140"
                width="140" height="140"
                className="absolute"
                style={{ filter: 'drop-shadow(0 0 10px rgba(58,188,168,0.85))' }}
                initial={{ opacity: 0, scale: 0.55, y: -30, rotate: -15 }}
                animate={{ opacity: [0, 1, 1, 0.8, 0], scale: [0.55, 1.05, 1, 0.95, 0.6], y: [-30, 0, 0, 0, 4], rotate: [-15, 5, 0, 0, 0] }}
                transition={{ duration: 1.3, times: [0, 0.22, 0.52, 0.82, 1], ease: 'easeOut' }}
              >
                {/* Outer rim */}
                <circle cx="70" cy="70" r="64" fill="rgba(58,188,168,0.06)" stroke="rgba(58,188,168,0.95)" strokeWidth="3"/>
                {/* Concentric rings */}
                <circle cx="70" cy="70" r="47" fill="none" stroke="rgba(58,188,168,0.60)" strokeWidth="1.5"/>
                <circle cx="70" cy="70" r="31" fill="none" stroke="rgba(58,188,168,0.48)" strokeWidth="1.3"/>
                <circle cx="70" cy="70" r="15" fill="none" stroke="rgba(58,188,168,0.38)" strokeWidth="1.1"/>
                {/* 8 radial spokes clipped to rim */}
                <line x1="6" y1="70" x2="134" y2="70" stroke="rgba(58,188,168,0.52)" strokeWidth="1.2"/>
                <line x1="70" y1="6" x2="70" y2="134" stroke="rgba(58,188,168,0.52)" strokeWidth="1.2"/>
                <line x1="24.7" y1="24.7" x2="115.3" y2="115.3" stroke="rgba(58,188,168,0.42)" strokeWidth="1.1"/>
                <line x1="115.3" y1="24.7" x2="24.7" y2="115.3" stroke="rgba(58,188,168,0.42)" strokeWidth="1.1"/>
                {/* Half-diagonal spokes for denser mesh */}
                <line x1="6" y1="30" x2="110" y2="134" stroke="rgba(58,188,168,0.22)" strokeWidth="0.9"/>
                <line x1="6" y1="110" x2="110" y2="6" stroke="rgba(58,188,168,0.22)" strokeWidth="0.9"/>
                <line x1="30" y1="6" x2="134" y2="110" stroke="rgba(58,188,168,0.22)" strokeWidth="0.9"/>
                <line x1="134" y1="30" x2="30" y2="134" stroke="rgba(58,188,168,0.22)" strokeWidth="0.9"/>
                {/* Center dot */}
                <circle cx="70" cy="70" r="3.5" fill="rgba(58,188,168,0.85)"/>
              </motion.svg>
              {/* Capture flash */}
              <motion.div
                className="absolute"
                style={{ width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(58,188,168,0.6) 0%, transparent 70%)' }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0, 1.8, 0] }}
                transition={{ duration: 0.4, delay: 0.58 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <CreatureSprite
          imageUrl={imageUrl}
          name={name}
          animState={animState}
          size={140}
          element={element as Element}
          rarity={rarity as Rarity}
          showAura
        />
      </div>

      {/* ── Info section ── */}
      <div className="flex-1 px-3.5 py-3 flex flex-col justify-between min-w-0">
        {/* Name + badges */}
        <div>
          <p className="font-extrabold text-white text-[15px] leading-tight truncate mb-2">{name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${rarityColor}22`, border: `1px solid ${rarityColor}55`, color: rarityColor }}
            >
              {RARITY_LABELS[rarity as Rarity]}
            </span>
            <span className="text-[13px] leading-none">{elemEmoji}</span>
            <span className="text-[10px] text-white/35 capitalize">{element}</span>
          </div>
          {statusEffect && STATUS_EFFECT_META[statusEffect] && (() => {
            const meta = STATUS_EFFECT_META[statusEffect]
            return (
              <div className="mt-1.5">
                <motion.span
                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 w-fit"
                  animate={{ opacity: [1, 0.65, 1], scale: [1, 0.96, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    background: `${meta.color}22`,
                    border: `1px solid ${meta.color}70`,
                    color: meta.color,
                    boxShadow: `0 0 10px ${meta.glow}, 0 0 20px ${meta.color}18`,
                  }}>
                  <span className="text-[11px] leading-none">{meta.emoji}</span>
                  <span>{meta.label}</span>
                  {statusTurnsLeft != null && statusTurnsLeft > 0 && (
                    <span className="opacity-50 text-[9px] font-bold ml-0.5">×{statusTurnsLeft}</span>
                  )}
                </motion.span>
              </div>
            )
          })()}
        </div>

        {/* Wild: catch stars + proportional HP catch bonus */}
        {isWild && (
          <div className="mt-1.5 space-y-1.5">
            {/* Difficulty stars */}
            <div className="flex gap-[2px]">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ fontSize: 11, color: i < stars ? '#FBBF24' : 'rgba(255,255,255,0.12)', lineHeight: 1 }}>★</span>
              ))}
            </div>
            {/* Catch bonus bar — appears proportionally as HP drops */}
            {catchMult > 1.0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${catchFillPct}%` }}
                    transition={{ duration: 0.5 }}
                    style={{
                      background: `rgba(52,211,153,${0.45 + catchIntensity * 0.55})`,
                      boxShadow: catchIntensity > 0.4 ? `0 0 5px rgba(52,211,153,${catchIntensity * 0.5})` : 'none',
                    }}
                  />
                </div>
                <span className="text-[9px] font-bold tabular-nums"
                  style={{ color: `rgba(52,211,153,${0.55 + catchIntensity * 0.45})` }}>
                  +{catchBonusPct}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Player: ATK stat */}
        {!isWild && atk !== undefined && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">ATK</span>
            <span className="text-[13px] font-extrabold" style={{ color: '#E85D2F' }}>{atk}</span>
          </div>
        )}

        {/* HP bar */}
        <div className="mt-2">
          <div className="h-[8px] rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.5 }}
              style={{ background: hpColor, boxShadow: `0 0 8px ${hpColor}90` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">HP</span>
            <span className="text-[10px] font-mono font-bold text-white/50">{currentHp}/{maxHp}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EncounterPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [state, setState]       = useState<EncounterState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [wildAnim, setWildAnim]     = useState<'idle' | 'damage' | 'catch' | 'flee'>('idle')
  const [playerAnim, setPlayerAnim] = useState<'idle' | 'attack' | 'damage'>('idle')
  const [attackAnim, setAttackAnim] = useState<{ key: number; element: string; rarity: string; side: 'left' | 'right'; soundUrl?: string | null; soundDurationMs?: number | null } | null>(null)
  const [catchPhase, setCatchPhase] = useState<'idle' | 'throwing' | 'hit'>('idle')
  const [showCatchSuccess, setShowCatchSuccess] = useState(false)
  const [message, setMessage]   = useState('')
  const [isCritMessage, setIsCritMessage] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [pendingAction, setPendingAction] = useState<'fight' | 'catch' | 'heal' | null>(null)
  const [result, setResult]     = useState<'caught' | 'fled' | 'evolved' | 'ko' | 'lost' | null>(null)
  const [caughtCreatureData, setCaughtCreatureData] = useState<any>(null)
  const [caughtExpGain, setCaughtExpGain]           = useState(0)
  const [caughtGoldGain, setCaughtGoldGain]         = useState(0)
  const [completedMissions, setCompletedMissions]   = useState<Array<{ title: string; rewardGold: number; rewardExp: number; levelUp?: { newLevel: number; goldReward: number } | null }>>([])
  const [missionRewardIdx, setMissionRewardIdx]     = useState(-1)
  const [playerCreature, setPlayerCreature] = useState<{
    name: string; maxHp: number; atk: number; element: string; rarity: string; imageUrl: string
    soundUrl?: string | null; soundDurationMs?: number | null
  } | null>(null)
  const [playerHp, setPlayerHp] = useState<number | null>(null)
  const [wildStatus, setWildStatus]       = useState<StatusEffect | null>(null)
  const [wildStatusTurns, setWildStatusTurns] = useState(0)
  const [playerStatus, setPlayerStatus]   = useState<StatusEffect | null>(null)
  const [playerStatusTurns, setPlayerStatusTurns] = useState(0)

  // Squad state
  const [squadCreatures, setSquadCreatures] = useState<SquadCreature[]>([])
  const [activeSlot, setActiveSlot]         = useState(0)
  const [slotHps, setSlotHps]               = useState<number[]>([])
  const [playerFainting, setPlayerFainting] = useState(false)

  const [reteItems, setReteItems]         = useState<InvItem[]>([])
  const [battagliaItems, setBattagliaItems] = useState<InvItem[]>([])
  const [pozioneItems, setPozioneItems]   = useState<InvItem[]>([])
  const [curaItems, setCuraItems]         = useState<InvItem[]>([])
  const [selectedReteId, setSelectedReteId]       = useState<string | null>(null)
  const [selectedBattagliaId, setSelectedBattagliaId] = useState<string | null>(null)
  const [selectedPozioneId, setSelectedPozioneId] = useState<string | null>(null)
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [introActive, setIntroActive] = useState(false)
  const stopEncounterLoopRef = useRef<(() => void) | null>(null)
  const [turnTimer, setTurnTimer] = useState(45)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoFightRef = useRef(false)

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(`encounter_${id}`)
    if (stored) {
      const parsed = JSON.parse(stored)
      setState({
        ...parsed,
        catchMultiplier: typeof parsed.catchMultiplier === 'number'
          ? parsed.catchMultiplier
          : getCatchHealthMultiplier(parsed.wildHp ?? 0, parsed.wildHpMax ?? 1),
      })
      const squad: SquadCreature[] = parsed.squadCreatures ?? []
      if (squad.length > 0) {
        setSquadCreatures(squad)
        setSlotHps(squad.map((c: SquadCreature) => c.hp))
        const lead = squad[0]
        setPlayerCreature({ name: lead.name, maxHp: lead.hp, atk: lead.atk, element: lead.element, imageUrl: lead.image_url ?? '', rarity: lead.rarity, soundUrl: lead.attack_sound_url, soundDurationMs: lead.attack_sound_duration_ms })
        setPlayerHp(lead.hp)
      }
      return
    }
    fetch(`/api/game/encounter/get?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.encounterId) { setLoadError(true); return }
        if (data.status && data.status !== 'active') {
          setResult(data.status === 'caught' ? 'caught' : 'fled')
          setState({ encounterId: data.encounterId, creature: data.creature, wildHp: 0, wildHpMax: data.wildHpMax ?? 100, catchMultiplier: 1, turns: 0 })
          return
        }
        const squad: SquadCreature[] = data.squadCreatures ?? []
        const s: EncounterState = {
          encounterId: data.encounterId, creature: data.creature,
          wildHp: data.wildHp, wildHpMax: data.wildHpMax,
          catchMultiplier: getCatchHealthMultiplier(data.wildHp, data.wildHpMax), turns: 0,
          squadCreatures: squad,
        }
        sessionStorage.setItem(`encounter_${id}`, JSON.stringify(s))
        setState(s)
        if (squad.length > 0) {
          setSquadCreatures(squad)
          setSlotHps(squad.map(c => c.hp))
          const lead = squad[0]
          setPlayerCreature({ name: lead.name, maxHp: lead.hp, atk: lead.atk, element: lead.element, imageUrl: lead.image_url ?? '', rarity: lead.rarity, soundUrl: lead.attack_sound_url, soundDurationMs: lead.attack_sound_duration_ms })
          setPlayerHp(lead.hp)
        }
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('player_inventory')
        .select('id, quantity, items(id, name, type, effect_value)')
        .eq('user_id', user.id).eq('session_id', sessionId).gt('quantity', 0)
        .then(({ data }) => {
          if (!data) return
          const rows = data as unknown as InvItem[]
          setReteItems(rows.filter(r => r.items?.type === 'rete'))
          setBattagliaItems(rows.filter(r => r.items?.type === 'battaglia'))
          setPozioneItems(rows.filter(r => r.items?.type === 'pozione'))
          setCuraItems(rows.filter(r => r.items?.type === 'cura'))
        })
    })
  }, [supabase])

  useEffect(() => {
    if (!state) return
    // If we already have squad data from state (sessionStorage restore), set up player creature from slot 0
    const squad = state.squadCreatures ?? []
    if (squad.length > 0 && squadCreatures.length === 0) {
      setSquadCreatures(squad)
      const hps = squad.map(c => c.hp)
      setSlotHps(hps)
      const lead = squad[0]
      setPlayerCreature({ name: lead.name, maxHp: lead.hp, atk: lead.atk, element: lead.element, imageUrl: lead.image_url ?? '', rarity: lead.rarity, soundUrl: lead.attack_sound_url, soundDurationMs: lead.attack_sound_duration_ms })
      setPlayerHp(lead.hp)
      return
    }
    if (squadCreatures.length > 0) return // already set up from fetch path

    supabase.from('encounters').select('player_creature_id').eq('id', state.encounterId).single()
      .then(async ({ data: enc }) => {
        if (!enc?.player_creature_id) return
        const { data: pc } = await supabase
          .from('player_creatures')
          .select('creatures(name, hp, atk, element, image_url, rarity, attack_sound_url, attack_sound_duration_ms)')
          .eq('id', enc.player_creature_id).single()
        if (pc) {
          const cr = (pc as any).creatures as { name: string; hp: number; atk: number; element: string; image_url: string; rarity: string; attack_sound_url: string | null; attack_sound_duration_ms: number | null }
          if (cr) {
            setPlayerCreature({ name: cr.name, maxHp: cr.hp, atk: cr.atk ?? 0, element: cr.element, imageUrl: cr.image_url ?? '', rarity: cr.rarity ?? 'comune', soundUrl: cr.attack_sound_url, soundDurationMs: cr.attack_sound_duration_ms })
            setPlayerHp(cr.hp)
          }
        }
      })
  }, [state?.encounterId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ─────────────────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTurnTimer(45)
    autoFightRef.current = false
    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          if (!autoFightRef.current) { autoFightRef.current = true; document.getElementById('wc-fight-btn')?.click() }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    if (state && !result) resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state?.encounterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger encounter intro animation + sound + background loop once when state is available
  useEffect(() => {
    if (state && !introActive) {
      setIntroActive(true)
      setShowIntro(true)
      playEncounterSound()
      stopEncounterLoopRef.current = startEncounterLoop()
    }
    return () => { stopEncounterLoopRef.current?.(); stopEncounterLoopRef.current = null }
  }, [state?.encounterId]) // eslint-disable-line react-hooks/exhaustive-deps

  function finishPendingAction() {
    setPendingAction(null)
    setLoading(false)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleFight() {
    if (!state || loading) return
    resetTimer(); setLoading(true); setPendingAction('fight'); setMessage(''); setIsCritMessage(false); setShowItemsModal(false)

    const actionStartedAt = Date.now()
    setPlayerAnim('attack')
    setAttackAnim({ key: Date.now(), element: playerCreature?.element ?? 'armonia', rarity: playerCreature?.rarity ?? 'comune', side: 'left', soundUrl: playerCreature?.soundUrl, soundDurationMs: playerCreature?.soundDurationMs })
    const attackReset = setTimeout(() => setPlayerAnim('idle'), 260)

    const activeItemId = selectedPozioneId ?? selectedBattagliaId ?? null
    const activeSquadPcId = squadCreatures.length > 0 ? squadCreatures[activeSlot]?.pcId : undefined
    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encounterId: state.encounterId,
        itemId: activeItemId,
        ...(activeSlot > 0 && activeSquadPcId ? { activePlayerCreatureId: activeSquadPcId } : {}),
      }),
    })
    const data = await res.json()

    if (selectedBattagliaId) setBattagliaItems(prev => prev.map(i => i.id === selectedBattagliaId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
    if (selectedPozioneId)   setPozioneItems(prev => prev.map(i => i.id === selectedPozioneId   ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
    setSelectedBattagliaId(null); setSelectedPozioneId(null)

    clearTimeout(attackReset)
    setPlayerAnim('idle')

    if (!res.ok) { setMessage(data.error); finishPendingAction(); return }

    const remainingAttackMs = Math.max(0, 260 - (Date.now() - actionStartedAt))
    if (remainingAttackMs > 0) await new Promise(r => setTimeout(r, remainingAttackMs))

    setWildAnim('damage')
    await new Promise(r => setTimeout(r, 380))
    setWildAnim('idle')

    setState(prev => prev ? { ...prev, wildHp: data.wildHpRemaining, catchMultiplier: data.catchMultiplier, turns: prev.turns + 1 } : null)

    if (data.fightResult === 'fled') {
      playKnockout()
      setWildAnim('flee'); setMessage(''); setResult('ko'); finishPendingAction(); return
    }

    const playerName = playerCreature?.name ?? 'la tua creatura'
    const wildName   = state.creature.name ?? 'creatura selvatica'
    if (data.playerCrit) {
      setIsCritMessage(true)
      setMessage(rnd(FIGHT_CRIT_MSGS))
    } else {
      setIsCritMessage(false)
      setMessage(rnd(FIGHT_PLAYER_MSGS)(playerName, wildName))
    }

    if (data.playerTookDamage && data.wildDamage > 0) {
      await new Promise(r => setTimeout(r, 280))

      // Wild creature counter-attack animation (side: 'right')
      setAttackAnim({
        key: Date.now() + 1,
        element: state.creature?.element ?? 'armonia',
        rarity: state.creature?.rarity ?? 'comune',
        side: 'right',
      })
      await new Promise(r => setTimeout(r, 320))
      setMessage(rnd(WILD_COUNTER_MSGS)(state.creature.name ?? 'creatura selvatica'))
      setIsCritMessage(false)

      const curHp = playerHp ?? playerCreature?.maxHp ?? 100
      const newHp = Math.max(0, curHp - data.wildDamage)

      // Update squad HP tracking
      if (squadCreatures.length > 0) {
        setSlotHps(prev => {
          const next = [...prev]
          next[activeSlot] = Math.max(0, (next[activeSlot] ?? squadCreatures[activeSlot]?.hp ?? 100) - data.wildDamage)
          return next
        })
      }

      setPlayerHp(newHp)
      setPlayerAnim('damage')
      await new Promise(r => setTimeout(r, 420))
      setPlayerAnim('idle')

      if (newHp <= 0) {
        playKnockout()
        // Show faint animation before switching creature
        setPlayerFainting(true)
        await new Promise(r => setTimeout(r, 1000))
        setPlayerFainting(false)
        // Try next squad creature
        if (squadCreatures.length > 0) {
          const nextSlot = activeSlot + 1
          if (nextSlot < squadCreatures.length) {
            const next = squadCreatures[nextSlot]
            setActiveSlot(nextSlot)
            setPlayerCreature({
              name: next.name, maxHp: next.hp, atk: next.atk,
              element: next.element, rarity: next.rarity, imageUrl: next.image_url ?? '',
            })
            setPlayerHp(slotHps[nextSlot] ?? next.hp)
            setMessage(`${squadCreatures[activeSlot].name} è svenuta! Entra ${next.name}!`)
            finishPendingAction()
            return
          }
        }
        playDefeat()
        setResult('lost')
        finishPendingAction()
        return
      }
    }

    // Status effect notifications + state updates
    if (data.statusEvents?.length) {
      for (const se of data.statusEvents as any[]) {
        if (se.turnPassed || se.selfHit) {
          const effect = se.type as StatusEffect
          const meta = STATUS_EFFECT_META[effect]
          if (se.target === 'player') {
            setMessage(`${meta?.emoji ?? ''} Hai saltato il turno (${meta?.label ?? effect})`)
            if (se.cleared) setPlayerStatus(null)
            else setPlayerStatusTurns(se.turnsLeft ?? 0)
          } else {
            setMessage(`${meta?.emoji ?? ''} ${state.creature.name} ha saltato il turno (${meta?.label ?? effect})`)
            if (se.cleared) setWildStatus(null)
            else setWildStatusTurns(se.turnsLeft ?? 0)
          }
          await new Promise(r => setTimeout(r, 700))
        }
      }
    }
    if (data.statusAppliedToWild) {
      const effect = data.statusAppliedToWild as StatusEffect
      const meta = STATUS_EFFECT_META[effect]
      setWildStatus(effect)
      setWildStatusTurns(data.wildNewStatusTurns ?? 0)
      setMessage(`${meta?.emoji ?? ''} ${state.creature.name} è afflitto da ${meta?.label ?? effect}!`)
      await new Promise(r => setTimeout(r, 600))
    }
    if (data.statusAppliedToPlayer) {
      const effect = data.statusAppliedToPlayer as StatusEffect
      const meta = STATUS_EFFECT_META[effect]
      setPlayerStatus(effect)
      setPlayerStatusTurns(data.playerNewStatusTurns ?? 0)
      setMessage(`${meta?.emoji ?? ''} Sei afflitto da ${meta?.label ?? effect}!`)
      await new Promise(r => setTimeout(r, 600))
    }

    if (data.levelUp) { playLevelUp(); window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp })) }
    window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
    finishPendingAction()
  }

  async function handleCatch() {
    if (!state || loading) return
    resetTimer(); setLoading(true); setPendingAction('catch'); setShowItemsModal(false)

    // ── Avvia animazione rete immediatamente ──────────────────────────────────
    const throwMsg = THROW_MESSAGES[Math.floor(Math.random() * THROW_MESSAGES.length)]
    setMessage(throwMsg)
    setCatchPhase('throwing')
    playCatchAttempt()

    // Fetch parallelo all'animazione; aspetta almeno 700 ms perché la rete arrivi
    const fetchPromise = fetch('/api/game/encounter/catch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: selectedReteId }),
    })
    const [res] = await Promise.all([fetchPromise, new Promise<void>(r => setTimeout(r, 700))])
    const data = await res.json()

    setSelectedReteId(null)
    if (selectedReteId) setReteItems(prev => prev.map(i => i.id === selectedReteId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))

    if (!res.ok) {
      setCatchPhase('idle')
      setMessage(data.error ?? 'Errore durante la cattura')
      finishPendingAction(); return
    }

    if (data.caught) {
      // Rete sparisce, parte l'animazione di cattura esistente
      setCatchPhase('idle')
      setMessage('')
      setWildAnim('catch')
      playCatchSuccess()
      setShowCatchSuccess(true)
      await new Promise(r => setTimeout(r, 1800))
      setShowCatchSuccess(false)
      const creatureId = data.newCreatureId ?? state.creature.id
      supabase.from('creatures')
        .select('name, hp, atk, def, element, rarity, image_url, description, status_effect, status_effect_chance')
        .eq('id', creatureId).single()
        .then(({ data: cr }) => { if (cr) setCaughtCreatureData(cr) })
      setCaughtExpGain(data.expGain ?? 0)
      setCaughtGoldGain(data.goldGain ?? 0)
      if (data.completedMissions?.length) setCompletedMissions(data.completedMissions)
      setResult(data.evolved ? 'evolved' : 'caught')
      if (data.levelUp) { playLevelUp(); window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp })) }
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      window.dispatchEvent(new CustomEvent('wc:refresh-bestiary'))
    } else if (data.fled) {
      setCatchPhase('idle')
      playFlee()
      setWildAnim('flee'); setMessage('La creatura è fuggita...'); setResult('fled')
    } else {
      // ── Cattura fallita: shake della rete + messaggio casuale ─────────────
      const failMsg = data.wildDamage > 0
        ? FAIL_COUNTER_MESSAGES[Math.floor(Math.random() * FAIL_COUNTER_MESSAGES.length)]
        : FAIL_RESIST_MESSAGES[Math.floor(Math.random() * FAIL_RESIST_MESSAGES.length)]
      playCatchFail()
      setCatchPhase('hit')
      setMessage(failMsg)
      await new Promise(r => setTimeout(r, 550))
      setCatchPhase('idle')

      if (data.wildDamage > 0) {
        // Wild creature counter-attack animation after failed catch
        setAttackAnim({
          key: Date.now() + 1,
          element: state.creature?.element ?? 'armonia',
          rarity: state.creature?.rarity ?? 'comune',
          side: 'right',
        })
        await new Promise(r => setTimeout(r, 320))

        const newHp = Math.max(0, (playerHp ?? playerCreature?.maxHp ?? 100) - data.wildDamage)
        if (squadCreatures.length > 0) {
          setSlotHps(prev => {
            const next = [...prev]
            next[activeSlot] = Math.max(0, (next[activeSlot] ?? squadCreatures[activeSlot]?.hp ?? 100) - data.wildDamage)
            return next
          })
        }
        setPlayerHp(newHp)
        setPlayerAnim('damage')
        await new Promise(r => setTimeout(r, 420))
        setPlayerAnim('idle')
        if (newHp <= 0) {
          setPlayerFainting(true)
          await new Promise(r => setTimeout(r, 1000))
          setPlayerFainting(false)
          if (squadCreatures.length > 0) {
            const nextSlot = activeSlot + 1
            if (nextSlot < squadCreatures.length) {
              const next = squadCreatures[nextSlot]
              setActiveSlot(nextSlot)
              setPlayerCreature({
                name: next.name, maxHp: next.hp, atk: next.atk,
                element: next.element, rarity: next.rarity, imageUrl: next.image_url ?? '',
              })
              setPlayerHp(slotHps[nextSlot] ?? next.hp)
              setMessage(`${squadCreatures[activeSlot].name} è svenuta! Entra ${next.name}!`)
              finishPendingAction()
              return
            }
          }
          setResult('lost')
          finishPendingAction()
          return
        }
      }
    }
    finishPendingAction()
  }

  async function handleHeal(itemId: string) {
    if (!state || loading) return
    resetTimer(); setLoading(true); setPendingAction('heal'); setShowItemsModal(false)
    const res = await fetch('/api/game/encounter/heal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId }),
    })
    const data = await res.json()
    if (res.ok && data.healed) {
      setCuraItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
      setPlayerHp(prev => prev !== null ? Math.min(data.maxHp, prev + data.healAmount) : data.healAmount)
      setMessage(`+${data.healAmount} HP ripristinati`)
    } else { setMessage(data.error ?? 'Cura fallita') }
    finishPendingAction()
  }

  async function handleFlee() {
    playFlee()
    if (state) {
      // Await flee so the encounter is 'fled' in DB before returning to map
      await fetch('/api/game/encounter/flee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: state.encounterId }),
      }).catch(() => {})
    }
    router.back()
  }

  // ── Loading / error ───────────────────────────────────────────────────────────
  if (!state) {
    if (loadError) return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center" style={{ background: '#060C18' }}>
        <div className="text-5xl">😶</div>
        <p className="text-white font-bold">Incontro non trovato</p>
        <p className="text-white/50 text-sm">L'incontro potrebbe essere già terminato.</p>
        <button onClick={() => router.push('/game/map')}
          className="mt-2 px-8 py-3 rounded-2xl font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#3A9DBC,#2a7a99)', boxShadow: '0 4px 20px rgba(58,157,188,0.35)' }}>
          Torna alla mappa
        </button>
      </div>
    )
    return (
      <div className="flex flex-col h-full overflow-hidden relative" style={{ background: '#030610' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/15 animate-pulse" />
        </div>
      </div>
    )
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const wildElem    = state.creature.element ?? 'bosco'
  const playerElem  = playerCreature?.element ?? 'adriatico'
  const wildTheme   = ELEMENT_THEME[wildElem]   ?? ELEMENT_THEME.bosco
  const playerTheme = ELEMENT_THEME[playerElem] ?? ELEMENT_THEME.adriatico
  const wildRarityColor = RARITY_COLORS[state.creature.rarity as Rarity ?? 'comune']
  const hasItems = reteItems.length > 0 || battagliaItems.length > 0 || pozioneItems.length > 0 || curaItems.length > 0
  const timerPct    = (turnTimer / 45) * 100
  const timerUrgent = turnTimer <= 10

  const activeItemLabel = selectedReteId ? '🎯' : selectedBattagliaId ? '⚔️' : selectedPozioneId ? '🧪' : null
  const selectedReteMult = reteItems.find(i => i.id === selectedReteId)?.items.effect_value ?? 1
  const catchInfoParts = [
    state.catchMultiplier > 1.0 ? `+${Math.round((state.catchMultiplier - 1) * 100)}% cattura` : null,
    selectedReteMult > 1 ? `Rete ×${selectedReteMult}` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col h-full overflow-hidden relative">

      {/* ── THEMATIC BACKGROUND ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(170deg, ${wildTheme.bg} 0%, #060C18 50%, ${playerTheme.bg} 100%)` }} />
        {/* Wild element glow (top-right) */}
        <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse 75% 55% at 88% 18%, ${wildTheme.glow}50 0%, transparent 65%)` }} />
        {/* Player element glow (bottom-left) */}
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse 65% 45% at 12% 82%, ${playerTheme.glow}50 0%, transparent 65%)` }} />
        {/* Mid-field shadow */}
        <div className="absolute inset-x-0 opacity-40" style={{ top: '38%', height: '24%', background: 'linear-gradient(transparent, rgba(0,0,0,0.5) 50%, transparent)' }} />
        {/* Ground line */}
        <div className="absolute inset-x-0 opacity-15" style={{ top: '48%', height: '1px', background: `linear-gradient(90deg, transparent 0%, ${wildTheme.glow}80 30%, ${playerTheme.glow}80 70%, transparent 100%)` }} />
      </div>

      {/* ── BATTLE FIELD (flex-1) ── */}
      <div className="relative z-10 flex-1 min-h-0">

        {/* WILD CARD — top, flush to right edge */}
        <div className="absolute z-10" style={{ top: 12, right: 0, left: '12%' }}>
          <motion.div
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 80, damping: 14, delay: 1.5 }}
          >
            <CreatureCard
              imageUrl={state.creature.image_url ?? ''}
              name={state.creature.name ?? '?'}
              element={wildElem}
              rarity={state.creature.rarity ?? 'comune'}
              currentHp={state.wildHp}
              maxHp={state.wildHpMax}
              catchMultiplier={state.catchMultiplier}
              isWild
              animState={wildAnim}
              side="right"
              statusEffect={wildStatus}
              statusTurnsLeft={wildStatusTurns}
            />
          </motion.div>
        </div>

        {/* PLAYER CARD — bottom, flush to left edge */}
        <div className="absolute z-10" style={{ bottom: 12, left: 0, right: '12%' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlot}
              initial={{ opacity: 0, x: activeSlot === 0 ? -380 : -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.28, ease: 'easeIn' } }}
              transition={activeSlot === 0
                ? { type: 'spring', stiffness: 80, damping: 14, delay: 1.9 }
                : { duration: 0.28, ease: 'easeOut' }}
            >
              <CreatureCard
                imageUrl={playerCreature?.imageUrl ?? ''}
                name={playerCreature?.name ?? '...'}
                element={playerElem}
                rarity={playerCreature?.rarity ?? 'comune'}
                currentHp={playerHp ?? playerCreature?.maxHp ?? 0}
                maxHp={playerCreature?.maxHp ?? 100}
                atk={playerCreature?.atk}
                animState={playerAnim}
                fainting={playerFainting}
                side="left"
                statusEffect={playerStatus}
                statusTurnsLeft={playerStatusTurns}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Attack animation overlay ── */}
        {attackAnim && (
          <AttackAnimation
            key={attackAnim.key}
            element={attackAnim.element}
            rarity={attackAnim.rarity}
            side={attackAnim.side}
            soundUrl={attackAnim.soundUrl}
            soundDurationMs={attackAnim.soundDurationMs}
            onComplete={() => setAttackAnim(null)}
          />
        )}

        {/* VS / message — center */}
        <div className="absolute inset-x-0 z-10" style={{ top: '46%', transform: 'translateY(-50%)' }}>
          <div className="flex items-center justify-center px-4">
            <AnimatePresence mode="wait">
              {message ? (
                <motion.div
                  key={message}
                  initial={{ opacity: 0, scale: isCritMessage ? 1.2 : 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full text-center"
                  style={isCritMessage
                    ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.5)', color: '#FB923C', maxWidth: 220 }
                    : { background: 'rgba(247,200,65,0.14)', border: '1px solid rgba(247,200,65,0.35)', color: '#F7C841', maxWidth: 200 }
                  }
                >
                  {message}
                </motion.div>
              ) : (
                <div className="w-9 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold tracking-widest text-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  VS
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── NET THROW OVERLAY ── */}
        <AnimatePresence>
          {catchPhase !== 'idle' && (
            <motion.div
              key="net-overlay"
              className="absolute inset-0 z-20 pointer-events-none overflow-hidden"
              initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Net SVG thrown from player to creature sprite */}
              <motion.svg
                viewBox="0 0 80 80"
                width="80" height="80"
                className="absolute"
                style={{ filter: 'drop-shadow(0 0 10px rgba(58,188,168,0.85))' }}
                initial={{ top: '74%', left: '14%', scale: 0.35, opacity: 0, rotate: -30 }}
                animate={
                  catchPhase === 'throwing'
                    ? { top: '10%', left: '18%', scale: 1, opacity: 1, rotate: 320 }
                    : { x: [0, -10, 10, -6, 6, 0], scale: [1, 1.18, 0.88, 1.06, 0.92, 0], opacity: [1, 1, 1, 0.9, 0.4, 0] }
                }
                transition={
                  catchPhase === 'throwing'
                    ? { duration: 0.58, ease: [0.25, 0.46, 0.45, 0.94] }
                    : { duration: 0.52, ease: 'easeOut' }
                }
              >
                {/* Outer rim */}
                <circle cx="40" cy="40" r="36" fill="rgba(58,188,168,0.07)" stroke="rgba(58,188,168,0.95)" strokeWidth="2.8"/>
                {/* Concentric rings */}
                <circle cx="40" cy="40" r="26" fill="none" stroke="rgba(58,188,168,0.62)" strokeWidth="1.4"/>
                <circle cx="40" cy="40" r="16" fill="none" stroke="rgba(58,188,168,0.48)" strokeWidth="1.2"/>
                <circle cx="40" cy="40" r="7"  fill="none" stroke="rgba(58,188,168,0.36)" strokeWidth="1"/>
                {/* 8 radial spokes */}
                <line x1="4"    y1="40"   x2="76"   y2="40"   stroke="rgba(58,188,168,0.55)" strokeWidth="1.1"/>
                <line x1="40"   y1="4"    x2="40"   y2="76"   stroke="rgba(58,188,168,0.55)" strokeWidth="1.1"/>
                <line x1="14.5" y1="14.5" x2="65.5" y2="65.5" stroke="rgba(58,188,168,0.44)" strokeWidth="1"/>
                <line x1="65.5" y1="14.5" x2="14.5" y2="65.5" stroke="rgba(58,188,168,0.44)" strokeWidth="1"/>
                {/* Denser mesh diagonals */}
                <line x1="4"  y1="22" x2="58" y2="76" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8"/>
                <line x1="4"  y1="58" x2="58" y2="4"  stroke="rgba(58,188,168,0.22)" strokeWidth="0.8"/>
                <line x1="22" y1="4"  x2="76" y2="58" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8"/>
                <line x1="76" y1="22" x2="22" y2="76" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8"/>
                {/* Center dot */}
                <circle cx="40" cy="40" r="3" fill="rgba(58,188,168,0.85)"/>
              </motion.svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CATCH SUCCESS BANNER ── */}
        <AnimatePresence>
          {showCatchSuccess && (
            <motion.div
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: [0.5, 1.12, 1.0], opacity: [0, 1, 1], y: [20, -6, 0] }}
                exit={{ scale: 0.85, opacity: 0, y: -20 }}
                transition={{ duration: 0.45, times: [0, 0.55, 1] }}
                className="flex flex-col items-center gap-1 px-7 py-4 rounded-3xl"
                style={{
                  background: 'rgba(4, 18, 10, 0.82)',
                  border: '1.5px solid rgba(52,211,153,0.55)',
                  boxShadow: '0 0 40px rgba(52,211,153,0.35), 0 8px 32px rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Sparkle ring */}
                <motion.div
                  className="text-3xl leading-none"
                  animate={{ rotate: [0, 15, -10, 8, 0], scale: [1, 1.2, 0.95, 1.1, 1] }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  ✨
                </motion.div>
                <span style={{
                  fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em',
                  color: '#34D399',
                  textShadow: '0 0 20px rgba(52,211,153,0.8), 0 0 40px rgba(52,211,153,0.4)',
                }}>
                  Catturata!
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(52,211,153,0.65)', letterSpacing: '0.05em' }}>
                  {state?.creature?.name ?? 'Creatura'} aggiunta alla squadra
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── SQUAD BAR (only if 2+ creatures) ── */}
      {!result && squadCreatures.length >= 2 && (
        <div className="shrink-0 px-3 pb-1.5 z-10">
          <div className="flex gap-1.5">
            {squadCreatures.map((cr, idx) => {
              const hp = slotHps[idx] ?? cr.hp
              const hpPct = Math.max(0, Math.min(100, (hp / cr.hp) * 100))
              const hpColor = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'
              const isActive = idx === activeSlot
              const isFainted = hp <= 0
              return (
                <div
                  key={cr.pcId}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all"
                  style={{
                    background: isActive
                      ? 'rgba(255,255,255,0.1)'
                      : isFainted ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                    border: isActive
                      ? '1px solid rgba(255,255,255,0.22)'
                      : '1px solid rgba(255,255,255,0.07)',
                    opacity: isFainted ? 0.35 : 1,
                  }}
                >
                  {/* Creature tiny icon */}
                  {cr.image_url ? (
                    <img
                      src={cr.image_url}
                      alt={cr.name}
                      className="w-6 h-6 object-contain shrink-0"
                      style={{ filter: isFainted ? 'grayscale(1)' : 'none' }}
                    />
                  ) : (
                    <span className="text-sm shrink-0 leading-none">{ELEMENT_EMOJI[cr.element as keyof typeof ELEMENT_EMOJI] ?? '✦'}</span>
                  )}
                  {/* HP bar */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-white/50 truncate leading-none mb-0.5">{cr.name}</p>
                    <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        animate={{ width: `${hpPct}%` }}
                        transition={{ duration: 0.4 }}
                        style={{ background: hpColor }}
                      />
                    </div>
                  </div>
                  {/* Active indicator */}
                  {isActive && !isFainted && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                  )}
                  {isFainted && (
                    <span className="text-[9px] text-red-400/60 shrink-0 font-bold">✕</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TIMER BAR ── */}
      {!result && (
        <div className="shrink-0 px-4 pb-1.5 z-10">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ width: `${timerPct}%`, background: timerUrgent ? '#EF4444' : '#34D399' }}
                animate={timerUrgent ? { opacity: [1, 0.4, 1] } : {}}
                transition={timerUrgent ? { duration: 0.5, repeat: Infinity } : {}}
              />
            </div>
            <span className={`text-[11px] font-mono font-bold w-6 text-right shrink-0 ${timerUrgent ? 'text-red-400' : 'text-white/35'}`}>{turnTimer}</span>
          </div>
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}
      {!result && (
        <div className="shrink-0 px-3 pb-3 z-10">
          <div className={`grid gap-2 ${hasItems ? 'grid-cols-4' : 'grid-cols-3'}`}>

            <motion.button onClick={handleCatch} disabled={loading} whileTap={{ scale: 0.93 }}
              className="rounded-2xl py-[14px] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(145deg,#E85D2F,#c94a20)', boxShadow: '0 4px 18px rgba(232,93,47,0.4)' }}>
              {pendingAction === 'catch'
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="text-base leading-none">🎯</span>}
              <span className="text-[10px] font-extrabold text-white tracking-wide">CATTURA</span>
              {catchInfoParts.length > 0 && (
                <span className="text-[8px] text-[#F7C841] font-bold">
                  {catchInfoParts.join(' • ')}
                </span>
              )}
            </motion.button>

            <motion.button id="wc-fight-btn" onClick={handleFight} disabled={loading || state.turns >= 5} whileTap={{ scale: 0.93 }}
              className="rounded-2xl py-[14px] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(145deg,#7B4DB8,#5c3a8c)', boxShadow: '0 4px 18px rgba(123,77,184,0.4)' }}>
              {pendingAction === 'fight'
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="text-base leading-none">⚔️</span>}
              <span className="text-[10px] font-extrabold text-white tracking-wide">LOTTA</span>
              <span className="text-[8px] text-white/40 font-bold">{state.turns}/5</span>
            </motion.button>

            {hasItems && (
              <motion.button onClick={() => setShowItemsModal(true)} whileTap={{ scale: 0.93 }}
                className="rounded-2xl py-[14px] flex flex-col items-center justify-center gap-0.5 relative"
                style={{
                  background: activeItemLabel ? 'rgba(247,200,65,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${activeItemLabel ? 'rgba(247,200,65,0.4)' : 'rgba(255,255,255,0.09)'}`,
                }}>
                <span className="text-base leading-none">{activeItemLabel ?? '🎒'}</span>
                <span className="text-[10px] font-extrabold tracking-wide" style={{ color: activeItemLabel ? '#F7C841' : 'rgba(255,255,255,0.5)' }}>
                  {activeItemLabel ? 'ATTIVO' : 'OGGETTI'}
                </span>
              </motion.button>
            )}

            <motion.button onClick={handleFlee} whileTap={{ scale: 0.93 }}
              className="rounded-2xl py-[14px] flex flex-col items-center justify-center gap-0.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <span className="text-base leading-none">🏃</span>
              <span className="text-[10px] font-extrabold text-white/40 tracking-wide">FUGGI</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* ── ITEMS MODAL (bottom sheet) ── */}
      <AnimatePresence>
        {showItemsModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
            onClick={() => setShowItemsModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="w-full rounded-t-3xl pb-6"
              style={{ background: '#080E1A', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between px-5 pb-3">
                <h3 className="text-white font-extrabold text-base">Oggetti di battaglia</h3>
                <button onClick={() => setShowItemsModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.07)' }}>✕</button>
              </div>

              <div className="px-4 space-y-4 max-h-[55vh] overflow-y-auto">

                {reteItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">🎯 Reti — bonus cattura</p>
                    <div className="flex flex-col gap-1.5">
                      {reteItems.map(inv => (
                        <button key={inv.id}
                          onClick={() => { setSelectedReteId(prev => prev === inv.id ? null : inv.id); setShowItemsModal(false) }}
                          className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all"
                          style={{
                            background: selectedReteId === inv.id ? 'rgba(58,157,188,0.18)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${selectedReteId === inv.id ? 'rgba(58,157,188,0.6)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: 'rgba(58,157,188,0.15)' }}>🎯</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{inv.items.name}</p>
                            {inv.items.effect_value > 1 && <p className="text-xs text-[#34D399]">×{inv.items.effect_value} cattura</p>}
                          </div>
                          <span className="text-xs text-white/30 shrink-0">×{inv.quantity}</span>
                          {selectedReteId === inv.id && <div className="w-2 h-2 rounded-full bg-[#3A9DBC] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {battagliaItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">⚔️ Potenziamento — +ATK</p>
                    <div className="flex flex-col gap-1.5">
                      {battagliaItems.map(inv => (
                        <button key={inv.id}
                          onClick={() => { setSelectedBattagliaId(prev => prev === inv.id ? null : inv.id); setShowItemsModal(false) }}
                          className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all"
                          style={{
                            background: selectedBattagliaId === inv.id ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${selectedBattagliaId === inv.id ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: 'rgba(251,191,36,0.15)' }}>⚔️</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{inv.items.name}</p>
                            {inv.items.effect_value > 0 && <p className="text-xs text-[#FBBF24]">+{inv.items.effect_value}% ATK</p>}
                          </div>
                          <span className="text-xs text-white/30 shrink-0">×{inv.quantity}</span>
                          {selectedBattagliaId === inv.id && <div className="w-2 h-2 rounded-full bg-[#FBBF24] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pozioneItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">🧪 Pozione — annulla debolezza</p>
                    <div className="flex flex-col gap-1.5">
                      {pozioneItems.map(inv => (
                        <button key={inv.id}
                          onClick={() => { setSelectedPozioneId(prev => prev === inv.id ? null : inv.id); setShowItemsModal(false) }}
                          className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all"
                          style={{
                            background: selectedPozioneId === inv.id ? 'rgba(123,77,184,0.18)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${selectedPozioneId === inv.id ? 'rgba(123,77,184,0.6)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: 'rgba(123,77,184,0.15)' }}>🧪</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{inv.items.name}</p>
                            <p className="text-xs text-[#C084FC]">Annulla svantaggio elemento</p>
                          </div>
                          <span className="text-xs text-white/30 shrink-0">×{inv.quantity}</span>
                          {selectedPozioneId === inv.id && <div className="w-2 h-2 rounded-full bg-[#7B4DB8] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {curaItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">💚 Cura — ripristina HP (salta turno)</p>
                    <div className="flex flex-col gap-1.5">
                      {curaItems.map(inv => (
                        <button key={inv.id}
                          onClick={() => handleHeal(inv.id)}
                          disabled={loading}
                          className="flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all disabled:opacity-40"
                          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)' }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: 'rgba(52,211,153,0.15)' }}>💚</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{inv.items.name}</p>
                            {inv.items.effect_value > 0 && <p className="text-xs text-[#34D399]">+{inv.items.effect_value}% HP</p>}
                          </div>
                          <span className="text-xs text-white/30 shrink-0">×{inv.quantity}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT OVERLAY: flee / ko ── */}
      <AnimatePresence>
        {(result === 'fled' || result === 'ko' || result === 'lost') && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-40 px-6"
            style={{ background: 'rgba(4,8,18,0.94)', backdropFilter: 'blur(16px)' }}
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="flex flex-col items-center text-center"
            >
              <div className="text-7xl mb-5">{result === 'lost' ? '💀' : result === 'ko' ? '💥' : '💨'}</div>
              <p className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {result === 'lost' ? 'Sconfitta!' : result === 'ko' ? 'Knock Out!' : 'Fuggita'}
              </p>
              {result === 'lost' && (
                <p className="text-white/50 text-sm mb-6">La tua creatura è esausta.</p>
              )}
              {result !== 'lost' && state.creature.name && (
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-base text-white/50">{state.creature.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${wildRarityColor}25`, color: wildRarityColor, border: `1px solid ${wildRarityColor}50` }}>
                    {RARITY_LABELS[state.creature.rarity as Rarity]}
                  </span>
                </div>
              )}
              <motion.button onClick={() => router.push('/game/map')} whileTap={{ scale: 0.96 }}
                className="w-full py-4 rounded-2xl font-extrabold text-white/60 text-base"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                Continua
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT OVERLAY: caught / evolved — bestiary reveal card ── */}
      <AnimatePresence>
        {(result === 'caught' || result === 'evolved') && (() => {
          const cr = caughtCreatureData
          const crElem   = cr?.element ?? wildElem
          const crRarity = cr?.rarity  ?? (state.creature.rarity ?? 'comune')
          const crTheme  = ELEMENT_THEME[crElem] ?? ELEMENT_THEME.bosco
          const crRarityColor = RARITY_COLORS[crRarity as Rarity] ?? '#64748b'
          const crElemEmoji   = ELEMENT_EMOJI[crElem as keyof typeof ELEMENT_EMOJI] ?? '✦'
          const isEvolved = result === 'evolved'

          return (
            <>
              {/* Backdrop */}
              <motion.div
                key="catch-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)' }}
              />

              {/* Sliding card */}
              <motion.div
                key="catch-card"
                initial={{ y: '100%' }} animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 260, delay: 0.1 }}
                className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-y-auto"
                style={{
                  background: '#080E1A',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderBottom: 'none',
                  maxHeight: '88vh',
                }}
              >
                {/* Element-tinted header + sprite */}
                <div className="relative pt-5 pb-2" style={{
                  background: `linear-gradient(180deg, ${crTheme.glow}18 0%, transparent 100%)`,
                }}>
                  {/* Drag handle */}
                  <div className="flex justify-center mb-3">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>

                  {/* Caught / Evolved badge */}
                  <div className="flex justify-center mb-3">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.35 }}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-full font-extrabold text-sm"
                      style={{
                        background: isEvolved ? '#F7C841' : crTheme.glow,
                        color: '#080E1A',
                        boxShadow: `0 4px 20px ${isEvolved ? 'rgba(247,200,65,0.5)' : `${crTheme.glow}60`}`,
                      }}
                    >
                      {isEvolved ? '✨ Evoluzione!' : '🎯 Catturato!'}
                    </motion.div>
                  </div>

                  {/* Sprite */}
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
                    >
                      <CreatureSprite
                        imageUrl={cr?.image_url ?? state.creature.image_url ?? ''}
                        name={cr?.name ?? state.creature.name ?? ''}
                        animState="idle"
                        size={160}
                        element={crElem as Element}
                        rarity={crRarity as Rarity}
                        showAura
                      />
                    </motion.div>
                  </div>
                </div>

                {/* Info */}
                <div className="px-5 pb-8">
                  {/* Name + element + rarity */}
                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {cr?.name ?? state.creature.name}
                    </h3>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-base">{crElemEmoji}</span>
                      <span className="text-xs capitalize text-white/40">{crElem}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${crRarityColor}22`, color: crRarityColor, border: `1px solid ${crRarityColor}55` }}>
                        {RARITY_LABELS[crRarity as Rarity]}
                      </span>
                    </div>
                    {cr?.description && (
                      <p className="text-sm text-white/45 mt-3 leading-relaxed">{cr.description}</p>
                    )}
                  </div>

                  {/* Stats */}
                  {cr && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: 'HP',  value: cr.hp,  color: '#F87171' },
                        { label: 'ATK', value: cr.atk, color: '#FB923C' },
                        { label: 'DEF', value: cr.def, color: '#60A5FA' },
                      ].map(s => (
                        <motion.div key={s.label}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.45 + (s.label === 'HP' ? 0 : s.label === 'ATK' ? 0.06 : 0.12) }}
                          className="rounded-xl p-3 text-center"
                          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${s.color}20` }}
                        >
                          <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-[10px] text-white/35 mt-0.5 font-semibold uppercase tracking-wider">{s.label}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Status effect ability */}
                  {cr?.status_effect && STATUS_EFFECT_META[cr.status_effect as StatusEffect] && (() => {
                    const effect = cr.status_effect as StatusEffect
                    const meta = STATUS_EFFECT_META[effect]
                    const chancePercent = Math.round((cr.status_effect_chance ?? 0.15) * 100)
                    const EFFECT_DURATIONS: Record<StatusEffect, string> = {
                      paralisi: '1 turno', confusione: '3 turni', sonno: '2 turni', veleno: 'Finché in campo',
                    }
                    const EFFECT_DESCRIPTIONS: Record<StatusEffect, string> = {
                      paralisi:   'Blocca l\'avversario per 1 turno',
                      confusione: '50% chance di colpire se stesso per 3 turni',
                      sonno:      'L\'avversario salta i turni per 2 turni',
                      veleno:     'Perde il 10% degli HP dopo ogni attacco',
                    }
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.52 }}
                        className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
                        style={{ background: `${meta.color}0e`, border: `1px solid ${meta.color}40`, boxShadow: `0 0 14px ${meta.glow}` }}
                      >
                        <motion.span
                          className="text-2xl shrink-0"
                          animate={{ scale: [1, 1.12, 1], opacity: [1, 0.7, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {meta.emoji}
                        </motion.span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[13px] font-extrabold" style={{ color: meta.color }}>{meta.label}</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                              {chancePercent}% per attacco
                            </span>
                          </div>
                          <p className="text-[11px] text-white/45 leading-snug">{EFFECT_DESCRIPTIONS[effect]}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {EFFECT_DURATIONS[effect]}
                        </span>
                      </motion.div>
                    )
                  })()}

                  {/* EXP + Gold gained */}
                  {(caughtExpGain > 0 || caughtGoldGain > 0) && (
                    <motion.div
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.55 }}
                      className="grid grid-cols-2 gap-2 mb-5"
                    >
                      {caughtExpGain > 0 && (
                        <div className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                          <span className="text-sm text-white/50">EXP</span>
                          <span className="font-extrabold text-[#34D399]">+{caughtExpGain}</span>
                        </div>
                      )}
                      {caughtGoldGain > 0 && (
                        <div className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: 'rgba(247,200,65,0.08)', border: '1px solid rgba(247,200,65,0.2)' }}>
                          <span className="text-sm text-white/50">Oro</span>
                          <span className="font-extrabold" style={{ color: '#F7C841' }}>+{caughtGoldGain}</span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Continua */}
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    onClick={() => { if (completedMissions.length > 0) { setMissionRewardIdx(0) } else { router.push('/game/map') } }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                    style={{
                      background: `linear-gradient(135deg, ${crTheme.glow} 0%, ${crTheme.glow}99 100%)`,
                      boxShadow: `0 4px 24px ${crTheme.glow}45`,
                    }}
                  >
                    {completedMissions.length > 0 ? 'Vedi ricompense' : 'Continua'}
                  </motion.button>
                </div>
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>

      {/* ── Mission reward overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {missionRewardIdx >= 0 && missionRewardIdx < completedMissions.length && (() => {
          const mission = completedMissions[missionRewardIdx]
          const isLast  = missionRewardIdx === completedMissions.length - 1
          const advance = () => {
            if (mission.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: mission.levelUp }))
            if (isLast) { router.push('/game/map') }
            else        { setMissionRewardIdx(i => i + 1) }
          }
          return (
            <motion.div
              key={`mission-${missionRewardIdx}`}
              className="absolute inset-0 z-[70] flex flex-col items-center justify-center px-6"
              style={{ background: 'rgba(2,4,12,0.94)', backdropFilter: 'blur(18px)' }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Glow ring */}
              <motion.div
                className="absolute rounded-full"
                style={{ width: 220, height: 220, background: 'radial-gradient(circle, rgba(251,191,36,0.18) 0%, transparent 70%)' }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              />

              {/* Badge */}
              <motion.div
                className="relative text-5xl mb-4"
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
              >
                🏆
              </motion.div>

              {/* Header label */}
              <motion.p
                className="text-xs font-bold tracking-widest uppercase mb-2"
                style={{ color: 'rgba(251,191,36,0.7)' }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              >
                Missione completata
              </motion.p>

              {/* Mission title */}
              <motion.h2
                className="text-center font-extrabold text-white text-xl mb-6 leading-snug"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              >
                {mission.title}
              </motion.h2>

              {/* Rewards */}
              <motion.div
                className="w-full flex flex-col gap-3 mb-6"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
              >
                {mission.rewardExp > 0 && (
                  <div className="flex items-center justify-between rounded-2xl px-5 py-3"
                    style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
                    <span className="text-sm text-white/50">EXP ricompensa</span>
                    <span className="font-extrabold text-[#34D399] text-base">+{mission.rewardExp} EXP</span>
                  </div>
                )}
                {mission.rewardGold > 0 && (
                  <div className="flex items-center justify-between rounded-2xl px-5 py-3"
                    style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.22)' }}>
                    <span className="text-sm text-white/50">Oro ricompensa</span>
                    <span className="font-extrabold text-[#FBBF24] text-base">+{mission.rewardGold} 🪙</span>
                  </div>
                )}
                {mission.levelUp && (
                  <div className="flex items-center justify-between rounded-2xl px-5 py-3"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.30)' }}>
                    <span className="text-sm text-white/50">Livello raggiunto</span>
                    <span className="font-extrabold text-[#A855F7] text-base">Lv. {mission.levelUp.newLevel} ✦</span>
                  </div>
                )}
              </motion.div>

              {/* Step indicator */}
              {completedMissions.length > 1 && (
                <motion.div className="flex gap-1.5 mb-5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
                  {completedMissions.map((_, i) => (
                    <div key={i} className="rounded-full transition-all duration-300"
                      style={{
                        width: i === missionRewardIdx ? 20 : 6, height: 6,
                        background: i <= missionRewardIdx ? '#FBBF24' : 'rgba(255,255,255,0.2)',
                      }} />
                  ))}
                </motion.div>
              )}

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                onClick={advance}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{ background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', boxShadow: '0 4px 24px rgba(251,191,36,0.35)' }}
              >
                {isLast ? 'Torna alla mappa' : 'Prossima ricompensa'}
              </motion.button>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* ── ENCOUNTER INTRO OVERLAY (Pokemon-style wipe) ── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            className="absolute inset-0 z-[100] overflow-hidden pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 2.6, times: [0, 0.65, 1.0] }}
            onAnimationComplete={() => setShowIntro(false)}
            style={{ background: '#010306' }}
          >
            {/* Pre-glow: soft element pulse before the burst */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: '50%', left: '50%',
                width: 10, height: 10,
                marginTop: -5, marginLeft: -5,
                background: wildTheme.glow,
                filter: 'blur(16px)',
              }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 12, 28], opacity: [0, 0.55, 0] }}
              transition={{ duration: 1.1, times: [0, 0.55, 1], ease: 'easeOut', delay: 0.05 }}
            />
            {/* White burst ring — primary explosion */}
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 22, height: 22, marginTop: -11, marginLeft: -11, background: 'white' }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 110, opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.1, 0.85, 0.28, 1], delay: 0.2 }}
            />
            {/* Element ring — softer, blooms behind */}
            <motion.div
              className="absolute rounded-full"
              style={{ top: '50%', left: '50%', width: 16, height: 16, marginTop: -8, marginLeft: -8, background: wildTheme.glow, filter: 'blur(6px)' }}
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 85, opacity: 0 }}
              transition={{ duration: 1.0, delay: 0.3, ease: [0.1, 0.85, 0.28, 1] }}
            />
            {/* Expanding border ring — adds crispness */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: '50%', left: '50%',
                width: 8, height: 8,
                marginTop: -4, marginLeft: -4,
                border: `2px solid ${wildTheme.glow}CC`,
                filter: 'blur(1px)',
              }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: [1, 45, 90], opacity: [1, 0.45, 0] }}
              transition={{ duration: 1.0, delay: 0.38, times: [0, 0.55, 1], ease: 'easeOut' }}
            />
            {/* Second ripple ring — follow-up wave */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: '50%', left: '50%',
                width: 12, height: 12,
                marginTop: -6, marginLeft: -6,
                border: `1.5px solid ${wildTheme.glow}88`,
                filter: 'blur(2px)',
              }}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: [1, 30, 70], opacity: [0.8, 0.35, 0] }}
              transition={{ duration: 1.2, delay: 0.55, times: [0, 0.50, 1], ease: 'easeOut' }}
            />
            {/* White flash — peak brightness */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 0] }}
              transition={{ duration: 0.7, delay: 0.42, times: [0, 0.28, 0.6, 1] }}
              style={{ background: `radial-gradient(ellipse 85% 65% at center, white 0%, ${wildTheme.glow}65 42%, transparent 72%)` }}
            />
            {/* Element flash — second wave, colored */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.45, 0] }}
              transition={{ duration: 0.65, delay: 0.80, times: [0, 0.4, 1] }}
              style={{ background: `radial-gradient(ellipse 70% 55% at center, ${wildTheme.glow}90 0%, ${wildTheme.glow}30 55%, transparent 80%)` }}
            />
            {/* Ambient glow — brief breathe before fade */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.20, 0] }}
              transition={{ duration: 0.9, delay: 1.0, times: [0, 0.45, 1] }}
              style={{ background: `radial-gradient(ellipse 60% 50% at center, ${wildTheme.glow}55 0%, transparent 65%)` }}
            />
            {/* Starburst scanlines — 12 directions */}
            {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map((angle, i) => (
              <motion.div
                key={angle}
                className="absolute"
                style={{
                  top: '50%', left: '50%',
                  width: 2.5, height: '200%',
                  marginLeft: -1.25,
                  transformOrigin: 'top center',
                  rotate: `${angle}deg`,
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.85) 32%, rgba(255,255,255,0.85) 68%, transparent 100%)',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 1], opacity: [0, 0.95, 0] }}
                transition={{
                  duration: 1.1,
                  delay: 0.28 + i * 0.018,
                  times: [0, 0.22, 1],
                  ease: 'easeOut',
                }}
              />
            ))}
            {/* Second scanline wave — element-colored, wider */}
            {[7.5, 22.5, 37.5, 52.5, 67.5, 82.5, 97.5, 112.5, 127.5, 142.5, 157.5, 172.5].map((angle, i) => (
              <motion.div
                key={`b-${angle}`}
                className="absolute"
                style={{
                  top: '50%', left: '50%',
                  width: 4, height: '200%',
                  marginLeft: -2,
                  transformOrigin: 'top center',
                  rotate: `${angle}deg`,
                  background: `linear-gradient(to bottom, transparent 0%, ${wildTheme.glow}50 35%, ${wildTheme.glow}50 65%, transparent 100%)`,
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 1], opacity: [0, 0.6, 0] }}
                transition={{
                  duration: 1.4,
                  delay: 0.50 + i * 0.018,
                  times: [0, 0.20, 1],
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
