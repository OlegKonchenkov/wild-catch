'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import CombatFortuneBadge from '@/components/game/CombatFortuneBadge'
import MissionRewardModal from '@/components/game/MissionRewardModal'
import type { CompletedMissionInfo } from '@/components/game/MissionRewardModal'
import { scaleCombatStats } from '@/lib/game/combat'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Element, Rarity } from '@/lib/types'

interface LineupEntry {
  id: string
  user_id: string
  slot: number
  player_creature_id: string
  current_hp: number
  is_active: boolean
  fainted_at: string | null
  player_creatures: {
    creatures: {
      name: string
      element: Element
      rarity: Rarity
      hp: number
      atk: number
      def: number
      image_url: string
    }
  }
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

// ── Creature card (unified image + info) ──────────────────────────────────────
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
}

function CreatureCard({ imageUrl, name, element, rarity, currentHp, maxHp, atk, animState = 'idle', side, lineup, lineupLabel }: CardProps) {
  const spriteSize = typeof window !== 'undefined'
    ? Math.round(Math.min(window.innerWidth * 0.35, window.innerHeight * 0.2, 158))
    : 122
  const imageWidth = spriteSize + 10
  const rarityColor = RARITY_COLORS[rarity as Rarity] ?? '#64748b'
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
      </div>

      {/* ── Info section ── */}
      <div className="flex-1 px-3 py-2.5 flex flex-col justify-between min-w-0">
        {/* Name + badges */}
        <div>
          <p className="font-extrabold text-white text-[13px] leading-tight truncate mb-1.5">{name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${rarityColor}22`, border: `1px solid ${rarityColor}55`, color: rarityColor }}
            >
              {rarity?.replace('_', ' ')}
            </span>
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

        {/* ATK stat (player only) */}
        {atk !== undefined && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider">ATK</span>
            <span className="text-[11px] font-extrabold" style={{ color: '#E85D2F' }}>{atk}</span>
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

function getScaledLineupStats(entry: LineupEntry | undefined, playerLevels: Record<string, number>) {
  const creature = entry?.player_creatures?.creatures
  if (!entry || !creature) return null

  return scaleCombatStats(
    { hp: creature.hp, atk: creature.atk, def: creature.def ?? 0 },
    playerLevels[entry.user_id] ?? 1,
  )
}

function formatFortuneText(fortune: CombatFortuneInfo | null | undefined): string | null {
  if (!fortune) return null
  if (fortune.deltaPercent === 0) return fortune.label

  const sign = fortune.deltaPercent > 0 ? '+' : ''
  return `${fortune.label} ${sign}${fortune.deltaPercent}%`
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DuelPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [duel, setDuel]                     = useState<any>(null)
  const [myLineup, setMyLineup]             = useState<LineupEntry[]>([])
  const [oppLineup, setOppLineup]           = useState<LineupEntry[]>([])
  const [log, setLog]                       = useState<string[]>([])
  const [waiting, setWaiting]               = useState(true)
  const [result, setResult]                 = useState<'won' | 'lost' | null>(null)
  const [animState, setAnimState]           = useState<'idle' | 'attack' | 'damage'>('idle')
  const [oppAnimState, setOppAnimState]     = useState<'idle' | 'attack' | 'damage'>('idle')
  const [userId, setUserId]                 = useState<string | null>(null)
  const [myRole, setMyRole]                 = useState<'challenger' | 'opponent' | null>(null)
  const [isMyTurn, setIsMyTurn]             = useState(false)
  const [attacking, setAttacking]           = useState(false)
  const attackingRef = useRef(false)
  const [lastDamage, setLastDamage]         = useState<{ amount: number; target: 'me' | 'opp'; id: number } | null>(null)
  const [battagliaItems, setBattagliaItems] = useState<BattagliaItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [switchNotice, setSwitchNotice]     = useState<string | null>(null)
  const [fortuneNotice, setFortuneNotice]   = useState<{ id: number; text: string; tone: CombatFortuneInfo['tone'] } | null>(null)
  const [playerLevels, setPlayerLevels]     = useState<Record<string, number>>({})
  const [completedMissions, setCompletedMissions] = useState<CompletedMissionInfo[]>([])
  const [showMissionModal, setShowMissionModal] = useState(false)

  const [turnTimer, setTurnTimer] = useState(30)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoFightRef = useRef(false)

  const realtimeUpdatedRef = useRef(false)
  const surrenderedRef     = useRef(false)
  const duelStatusRef      = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  function flashFortuneNotice(fortune: CombatFortuneInfo | null | undefined) {
    const text = formatFortuneText(fortune)
    if (!text || !fortune) return

    const id = Date.now()
    setFortuneNotice({ id, text, tone: fortune.tone })
    setTimeout(() => {
      setFortuneNotice(current => current?.id === id ? null : current)
    }, 1800)
  }

  const loadPlayerLevels = useCallback(async (sessionId: string | undefined, duelUserIds: Array<string | null | undefined>) => {
    const uniqueIds = Array.from(new Set(duelUserIds.filter((value): value is string => Boolean(value))))
    if (!sessionId || uniqueIds.length === 0) return

    const { data } = await supabase
      .from('player_sessions')
      .select('user_id, level')
      .eq('session_id', sessionId)
      .in('user_id', uniqueIds)

    if (!data) return

    setPlayerLevels(prev => ({
      ...prev,
      ...Object.fromEntries((data as Array<{ user_id: string; level: number | null }>).map(row => [row.user_id, row.level ?? 1])),
    }))
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: duelData } = await supabase
        .from('duels')
        .select('*')
        .eq('id', id)
        .single()

      if (!duelData) return
      setDuel(duelData)
      duelStatusRef.current = duelData.status
      if (!realtimeUpdatedRef.current) setWaiting(duelData.status === 'waiting')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const role: 'challenger' | 'opponent' = duelData.challenger_id === user.id ? 'challenger' : 'opponent'
      setMyRole(role)
      await loadPlayerLevels(duelData.session_id, [duelData.challenger_id, duelData.opponent_id])

      if (duelData.status === 'active') setIsMyTurn(duelData.current_turn === role)

      const { data: lineups } = await supabase
        .from('duel_lineups')
        .select('*, player_creatures(*, creatures(name, element, rarity, hp, atk, def, image_url))')
        .eq('duel_id', id)
        .order('slot', { ascending: true })

      if (lineups) {
        const mine = lineups.filter((l: LineupEntry) => l.user_id === user.id)
        const opp  = lineups.filter((l: LineupEntry) => l.user_id !== user.id)
        setMyLineup(mine)
        setOppLineup(opp)
      }

      const sessionId = localStorage.getItem('current_session_id')
      if (sessionId) {
        const { data: inv } = await supabase
          .from('player_inventory')
          .select('id, quantity, items(name, effect_value, type)')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .gt('quantity', 0)
        const filtered = ((inv ?? []) as any[])
          .filter(r => r.items?.type === 'battaglia')
          .map(r => ({ inventoryId: r.id, name: r.items.name, effectValue: r.items.effect_value, quantity: r.quantity }))
        setBattagliaItems(filtered)
      }
    }

    init()

    const channel = supabase
      .channel(`duel:${id}`)
      .on('broadcast', { event: 'duel_action' }, ({ payload }) => {
        const { actorId, damage, fortune, nextTurn, itemUsed, switchedTo } = payload

        setUserId(currentId => {
          const iAttacked = actorId === currentId
          if (iAttacked) {
            setOppAnimState('damage')
            setLastDamage({ amount: damage, target: 'opp', id: Date.now() })
            setTimeout(() => { setOppAnimState('idle'); setLastDamage(null) }, 900)
          } else {
            setAnimState('damage')
            setLastDamage({ amount: damage, target: 'me', id: Date.now() })
            setTimeout(() => { setAnimState('idle'); setLastDamage(null) }, 900)
          }
          if (nextTurn && currentId) {
            setMyRole(role => { setIsMyTurn(nextTurn === role); return role })
          }
          return currentId
        })

        if (switchedTo) {
          setSwitchNotice(`${switchedTo.name} entra in battaglia!`)
          setTimeout(() => setSwitchNotice(null), 2500)
        }

        flashFortuneNotice(fortune as CombatFortuneInfo | undefined)

        const atkLabel = itemUsed ? '⚔️+🗡️' : '⚔️'
        const fortuneText = formatFortuneText(fortune as CombatFortuneInfo | undefined)
        setLog(prev => [`${atkLabel} ${damage} danno${fortuneText ? ` · ${fortuneText}` : ''}!`, ...prev.slice(0, 3)])
      })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duel_lineups', filter: `duel_id=eq.${id}` },
        ({ new: updated }) => {
          const updateLineup = (prev: LineupEntry[]) =>
            prev.map(l => l.id === updated.id ? { ...l, ...updated } : l)
          setMyLineup(prev => {
            if (prev.some(l => l.id === updated.id)) return updateLineup(prev)
            return prev
          })
          setOppLineup(prev => {
            if (prev.some(l => l.id === updated.id)) return updateLineup(prev)
            return prev
          })
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${id}` },
        ({ new: updated }) => {
          duelStatusRef.current = updated.status
          if (updated.status === 'ended') {
            supabase.auth.getUser().then(({ data: { user } }) => {
              setResult(updated.winner_id === user?.id ? 'won' : 'lost')
              setIsMyTurn(false)
              window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
            })
          }
          realtimeUpdatedRef.current = true
          setWaiting(updated.status === 'waiting')

          if (updated.status === 'active' && updated.current_turn) {
            setMyRole(role => { setIsMyTurn(updated.current_turn === role); return role })
            loadPlayerLevels(updated.session_id, [updated.challenger_id, updated.opponent_id]).catch(() => {})
            // Re-fetch all lineups to get opponent's creatures (they were inserted, not updated)
            supabase.from('duel_lineups')
              .select('*, player_creatures(*, creatures(name, element, rarity, hp, atk, def, image_url))')
              .eq('duel_id', id)
              .order('slot', { ascending: true })
              .then(({ data: freshLineups }) => {
                if (!freshLineups) return
                supabase.auth.getUser().then(({ data: { user } }) => {
                  if (!user) return
                  const mine = freshLineups.filter((l: LineupEntry) => l.user_id === user.id)
                  const opp  = freshLineups.filter((l: LineupEntry) => l.user_id !== user.id)
                  setMyLineup(mine)
                  setOppLineup(opp)
                })
              })
          }
        })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (duelStatusRef.current === 'waiting') {
        fetch('/api/game/duel/connect', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duelId: id }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [id, loadPlayerLevels, supabase])

  useEffect(() => {
    if (myLineup.length === 0 || result || waiting || surrenderedRef.current) return
    const allFainted = myLineup.length > 0 && myLineup.every(l => l.fainted_at !== null)
    if (allFainted) {
      surrenderedRef.current = true
      setIsMyTurn(false)
      fetch('/api/game/duel/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duelId: id, action: 'surrender' }),
      })
    }
  }, [myLineup, result, waiting, id])

  // ── Turn timer ────────────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTurnTimer(30)
    autoFightRef.current = false
    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          if (!autoFightRef.current) { autoFightRef.current = true; document.getElementById('wc-duel-atk-btn')?.click() }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    if (isMyTurn && !result && !waiting) {
      resetTimer()
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setTurnTimer(30)
      autoFightRef.current = false
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isMyTurn, result, waiting]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAttack() {
    if (attackingRef.current || !isMyTurn) return
    if (timerRef.current) clearInterval(timerRef.current)
    autoFightRef.current = true
    attackingRef.current = true
    setAttacking(true)
    setAnimState('attack')
    setTimeout(() => setAnimState('idle'), 400)

    const body: Record<string, string> = { duelId: id, action: 'attack' }
    if (selectedItemId) body.itemId = selectedItemId

    const res = await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
      if (data.duelOver) {
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        if (data.completedMissions?.length) setCompletedMissions(data.completedMissions)
      }
    }

    if (selectedItemId && res.ok) {
      setBattagliaItems(prev => prev
        .map(it => it.inventoryId === selectedItemId ? { ...it, quantity: it.quantity - 1 } : it)
        .filter(it => it.quantity > 0)
      )
      setSelectedItemId(null)
      setShowItemsModal(false)
    }
    attackingRef.current = false
    setAttacking(false)
  }

  async function handleSurrender() {
    setIsMyTurn(false)
    await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: id, action: 'surrender' }),
    })
  }

  const myActive    = myLineup.find(l => l.is_active)
  const oppActive   = oppLineup.find(l => l.is_active)
  const myActiveCr  = myActive?.player_creatures?.creatures
  const oppActiveCr = oppActive?.player_creatures?.creatures
  const myCombatStats = getScaledLineupStats(myActive, playerLevels)
  const oppCombatStats = getScaledLineupStats(oppActive, playerLevels)
  const myHp        = myActive?.current_hp ?? 0
  const myHpMax     = myCombatStats?.hp ?? myActiveCr?.hp ?? 100
  const oppHp       = oppActive?.current_hp ?? 0
  const oppHpMax    = oppCombatStats?.hp ?? oppActiveCr?.hp ?? 100

  // ── Element-themed background ──────────────────────────────────────────────
  const myTheme  = ELEMENT_THEME[myActiveCr?.element ?? '']  ?? DEFAULT_THEME
  const oppTheme = ELEMENT_THEME[oppActiveCr?.element ?? ''] ?? DEFAULT_THEME

  // ── Lineup dot arrays ──────────────────────────────────────────────────────
  const myLineupDots = [...myLineup].sort((a, b) => a.slot - b.slot).map(entry => ({
    color: entry.player_creatures?.creatures ? RARITY_COLORS[entry.player_creatures.creatures.rarity] : '#3A9DBC',
    isActive: entry.is_active,
    fainted: !!entry.fainted_at,
  }))
  const oppLineupDots = [...oppLineup].sort((a, b) => a.slot - b.slot).map(entry => ({
    color: entry.player_creatures?.creatures ? RARITY_COLORS[entry.player_creatures.creatures.rarity] : '#64748b',
    isActive: entry.is_active,
    fainted: !!entry.fainted_at,
  }))

  const turnColor = isMyTurn ? '#34D399' : '#64748b'
  const turnLabel = isMyTurn ? 'Il tuo turno' : 'Turno avversario'

  const selectedItem = battagliaItems.find(it => it.inventoryId === selectedItemId)

  return (
    <div className="flex flex-col h-full overflow-hidden relative"
      style={{ background: oppTheme.bg }}>

      {/* ── Element-themed battle background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Opponent element glow — top-right */}
        <div className="absolute top-0 right-0 w-[65%] h-[50%]"
          style={{ background: `radial-gradient(ellipse at 80% 20%, ${oppTheme.glow}30 0%, transparent 70%)` }} />
        {/* My element glow — bottom-left */}
        <div className="absolute bottom-0 left-0 w-[65%] h-[50%]"
          style={{ background: `radial-gradient(ellipse at 20% 80%, ${myTheme.glow}22 0%, transparent 70%)` }} />
        {/* Mid-field shadow */}
        <div className="absolute inset-x-0" style={{
          top: '38%', height: '24%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
        }} />
        {/* Ground line */}
        <div className="absolute inset-x-0" style={{ top: '48%', height: 1, background: `linear-gradient(90deg, transparent, ${myTheme.glow}20, ${oppTheme.glow}20, transparent)` }} />
      </div>

      {/* ── Waiting overlay ── */}
      <AnimatePresence>
        {waiting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-30"
            style={{ background: 'rgba(4,8,18,0.96)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ border: '2px solid rgba(232,93,47,0.4)', boxShadow: '0 0 30px rgba(232,93,47,0.3)' }}>
                ⚔️
              </div>
            </motion.div>
            <p className="text-xl font-extrabold text-white mb-1">In attesa...</p>
            <p className="text-white/40 text-sm mb-6">L'avversario sta per entrare</p>
            {duel?.room_code && (
              <div className="rounded-2xl px-6 py-4 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Codice Stanza</p>
                <motion.p
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-3xl font-mono font-extrabold text-[#E85D2F] tracking-[0.3em]"
                >
                  {duel.room_code}
                </motion.p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Result overlay ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-30 px-6"
            style={{ background: 'rgba(4,8,18,0.96)', backdropFilter: 'blur(14px)' }}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="text-7xl mb-5">{result === 'won' ? '🏆' : '💀'}</div>
              <p className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {result === 'won' ? 'Vittoria!' : 'Sconfitta'}
              </p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                style={{
                  background: result === 'won' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${result === 'won' ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                <span className="font-extrabold text-base" style={{ color: result === 'won' ? '#34D399' : 'rgba(255,255,255,0.35)' }}>
                  {result === 'won' ? '+30 EXP · +20 punti' : '0 EXP'}
                </span>
              </div>
              <motion.button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
                  if (result === 'won' && completedMissions.length > 0) {
                    setShowMissionModal(true)
                  } else {
                    router.push('/game/map')
                  }
                }}
                whileTap={{ scale: 0.96 }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{ background: 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)', boxShadow: '0 4px 20px rgba(58,157,188,0.35)' }}
              >
                {result === 'won' && completedMissions.length > 0 ? 'Vedi ricompense' : 'Torna alla Mappa'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mission reward overlay (shown after duel win) ── */}
      {showMissionModal && (
        <MissionRewardModal
          missions={completedMissions}
          onDone={() => { setShowMissionModal(false); router.push('/game/map') }}
        />
      )}

      {/* ── Items bottom-sheet modal ── */}
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
                      setSelectedItemId(selectedItemId === item.inventoryId ? null : item.inventoryId)
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

        {/* Opponent card — top-right, flush to right edge */}
        <div className="absolute z-10" style={{ top: 12, right: 0, left: '8%' }}>
          {oppActiveCr ? (
            <CreatureCard
              imageUrl={oppActiveCr.image_url}
              name={oppActiveCr.name}
              element={oppActiveCr.element}
              rarity={oppActiveCr.rarity}
              currentHp={oppHp}
              maxHp={oppHpMax}
              animState={oppAnimState}
              side="right"
              lineup={oppLineupDots}
            />
          ) : (
            <div className="h-[100px] rounded-l-2xl animate-pulse mx-0" style={{ background: 'rgba(255,255,255,0.04)' }} />
          )}
        </div>

        {/* Standalone damage floats — outside cards to avoid overflow-hidden clipping */}
        <AnimatePresence>
          {lastDamage?.target === 'opp' && (
            <motion.div
              key={`opp-dmg-${lastDamage.id}`}
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

        {/* Player card — bottom-left, flush to left edge */}
        <div className="absolute z-10" style={{ bottom: 12, left: 0, right: '8%' }}>
          {myActiveCr ? (
            <CreatureCard
              imageUrl={myActiveCr.image_url}
              name={myActiveCr.name}
              element={myActiveCr.element}
              rarity={myActiveCr.rarity}
              currentHp={myHp}
              maxHp={myHpMax}
              atk={myCombatStats?.atk ?? myActiveCr.atk}
              animState={animState}
              side="left"
              lineup={myLineupDots}
              lineupLabel="Tu"
            />
          ) : (
            <div className="h-[100px] rounded-r-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          )}
        </div>
      </div>

      {/* ── Turn indicator + log ── */}
      <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-1.5">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
        <AnimatePresence mode="wait">
          {switchNotice ? (
            <motion.div key="switch" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-[#C084FC]"
              style={{ background: 'rgba(123,77,184,0.18)', border: '1px solid rgba(123,77,184,0.4)' }}>
              ✨ {switchNotice}
            </motion.div>
          ) : fortuneNotice ? (
            <motion.div key={`fortune-${fortuneNotice.id}`} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}>
              <CombatFortuneBadge text={fortuneNotice.text} tone={fortuneNotice.tone} />
            </motion.div>
          ) : (
            <motion.div key={isMyTurn ? 'my' : 'opp'} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: `${turnColor}15`, border: `1px solid ${turnColor}40` }}>
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: turnColor }}
                animate={isMyTurn ? { scale: [1, 1.5, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-[10px] font-bold" style={{ color: turnColor }}>{turnLabel}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {log[0] && (
            <motion.span key={log[0] + log.length} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="text-[10px] font-semibold text-white/35">
              {log[0]}
            </motion.span>
          )}
        </AnimatePresence>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
      </div>

      {/* ── SQUAD BAR ── */}
      {!result && !waiting && myLineup.length >= 2 && (
        <div className="shrink-0 px-3 pb-1.5 z-10">
          <div className="flex gap-1.5">
            {[...myLineup].sort((a, b) => a.slot - b.slot).map(entry => {
              const cr = entry.player_creatures?.creatures
              if (!cr) return null
              const hpPct = Math.max(0, Math.min(100, (entry.current_hp / cr.hp) * 100))
              const hpColor = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'
              const isActive = entry.is_active
              const isFainted = !!entry.fainted_at
              return (
                <div key={entry.id} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.1)' : isFainted ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                    border: isActive ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.07)',
                    opacity: isFainted ? 0.35 : 1,
                  }}>
                  {cr.image_url ? (
                    <img src={cr.image_url} alt={cr.name} className="w-6 h-6 object-contain shrink-0"
                      style={{ filter: isFainted ? 'grayscale(1)' : 'none' }} />
                  ) : (
                    <span className="text-sm shrink-0 leading-none">{ELEMENT_EMOJI[cr.element as keyof typeof ELEMENT_EMOJI] ?? '✦'}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-white/50 truncate leading-none mb-0.5">{cr.name}</p>
                    <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <motion.div className="h-full rounded-full" animate={{ width: `${hpPct}%` }} transition={{ duration: 0.4 }} style={{ background: hpColor }} />
                    </div>
                  </div>
                  {isActive && !isFainted && <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
                  {isFainted && <span className="text-[9px] text-red-400/60 shrink-0 font-bold">✕</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TIMER BAR ── */}
      {!result && !waiting && isMyTurn && (() => {
        const timerPct    = (turnTimer / 30) * 100
        const timerUrgent = turnTimer <= 10
        return (
          <div className="shrink-0 px-4 pb-1 z-10">
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
        )
      })()}

      {/* ── ACTIONS ── */}
      {!result && !waiting && (
        <div className="shrink-0 px-4 pb-5 pt-1 z-10 flex gap-2">

          {/* Items toggle button */}
          {battagliaItems.length > 0 && (
            <motion.button
              onClick={() => { if (isMyTurn) setShowItemsModal(true) }}
              whileTap={{ scale: 0.95 }}
              className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
              style={{
                background: selectedItemId ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${selectedItemId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.09)'}`,
                opacity: isMyTurn ? 1 : 0.4,
              }}
            >
              <span className="text-lg leading-none">🗡️</span>
              {selectedItemId && <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />}
            </motion.button>
          )}

          {/* Attack button */}
          <motion.button
            id="wc-duel-atk-btn"
            onClick={handleAttack}
            disabled={attacking || !isMyTurn}
            whileTap={isMyTurn ? { scale: 0.95 } : {}}
            className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base disabled:cursor-not-allowed transition-all"
            style={{
              background: isMyTurn
                ? selectedItemId
                  ? 'linear-gradient(135deg, #FBBF24 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)'
                : 'rgba(255,255,255,0.06)',
              boxShadow: isMyTurn && !attacking
                ? selectedItemId ? '0 4px 20px rgba(251,191,36,0.35)' : '0 4px 20px rgba(232,93,47,0.4)'
                : 'none',
              border: !isMyTurn ? '1px solid rgba(255,255,255,0.08)' : 'none',
              opacity: attacking ? 0.7 : 1,
            }}
          >
            {attacking ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isMyTurn ? (
              <span className="flex items-center justify-center gap-2">
                ⚔️ {selectedItem ? `Attacca (+${selectedItem.effectValue}% ATK)` : 'Attacca'}
              </span>
            ) : (
              <span className="text-white/35 text-sm">In attesa del tuo turno...</span>
            )}
          </motion.button>

          {/* Surrender */}
          <motion.button
            onClick={handleSurrender}
            whileTap={{ scale: 0.95 }}
            className="w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  )
}
