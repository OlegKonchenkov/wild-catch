'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { createClient } from '@/lib/supabase/client'
import { RARITY_COLORS, RARITY_LABELS, ELEMENT_EMOJI } from '@/lib/types'
import { getCatchHealthMultiplier } from '@/lib/game/rng'
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
  side: 'left' | 'right'
}

function formatCatchMultiplier(multiplier: number): string {
  if (Number.isInteger(multiplier)) return String(multiplier)
  return multiplier.toFixed(multiplier >= 2 ? 2 : 1).replace(/\.0$/, '')
}

function CreatureCard({ imageUrl, name, element, rarity, currentHp, maxHp, atk, catchMultiplier, isWild, animState = 'idle', side }: CardProps) {
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
      className="flex overflow-hidden"
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
          width: 152,
          minHeight: 148,
          background: `linear-gradient(135deg, ${rarityColor}18 0%, transparent 70%)`,
        }}
      >
        {/* Net animation overlay (wild catch only) */}
        <AnimatePresence>
          {animState === 'catch' && isWild && (
            <motion.div key="net" className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <motion.div
                className="absolute rounded-full"
                style={{ border: '2.5px solid rgba(58,157,188,1)', boxShadow: '0 0 18px rgba(58,157,188,0.9), 0 0 40px rgba(58,157,188,0.5)' }}
                initial={{ width: 148, height: 148, opacity: 0 }}
                animate={{ width: [148, 148, 55, 5], height: [148, 148, 55, 5], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.4, times: [0, 0.12, 0.62, 1], ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute text-[#3A9DBC] font-extrabold"
                style={{ fontSize: 20, textShadow: '0 0 10px rgba(58,157,188,0.9)' }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 2, 0] }}
                transition={{ duration: 0.45, delay: 0.72 }}
              >
                ✦
              </motion.div>
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
              {rarity?.replace('_', ' ')}
            </span>
            <span className="text-[13px] leading-none">{elemEmoji}</span>
            <span className="text-[10px] text-white/35 capitalize">{element}</span>
          </div>
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
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<'caught' | 'fled' | 'evolved' | 'ko' | 'lost' | null>(null)
  const [caughtCreatureData, setCaughtCreatureData] = useState<any>(null)
  const [caughtExpGain, setCaughtExpGain]           = useState(0)
  const [completedMissions, setCompletedMissions]   = useState<Array<{ title: string; rewardGold: number; rewardExp: number; levelUp?: { newLevel: number; goldReward: number } | null }>>([])
  const [missionRewardIdx, setMissionRewardIdx]     = useState(-1)
  const [playerCreature, setPlayerCreature] = useState<{
    name: string; maxHp: number; atk: number; element: string; rarity: string; imageUrl: string
  } | null>(null)
  const [playerHp, setPlayerHp] = useState<number | null>(null)

  // Squad state
  const [squadCreatures, setSquadCreatures] = useState<SquadCreature[]>([])
  const [activeSlot, setActiveSlot]         = useState(0)
  const [slotHps, setSlotHps]               = useState<number[]>([])

  const [reteItems, setReteItems]         = useState<InvItem[]>([])
  const [battagliaItems, setBattagliaItems] = useState<InvItem[]>([])
  const [pozioneItems, setPozioneItems]   = useState<InvItem[]>([])
  const [curaItems, setCuraItems]         = useState<InvItem[]>([])
  const [selectedReteId, setSelectedReteId]       = useState<string | null>(null)
  const [selectedBattagliaId, setSelectedBattagliaId] = useState<string | null>(null)
  const [selectedPozioneId, setSelectedPozioneId] = useState<string | null>(null)
  const [showItemsModal, setShowItemsModal] = useState(false)
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
        setPlayerCreature({ name: lead.name, maxHp: lead.hp, atk: lead.atk, element: lead.element, imageUrl: lead.image_url ?? '', rarity: lead.rarity })
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
          setPlayerCreature({ name: lead.name, maxHp: lead.hp, atk: lead.atk, element: lead.element, imageUrl: lead.image_url ?? '', rarity: lead.rarity })
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
      setPlayerCreature({ name: lead.name, maxHp: lead.hp, atk: lead.atk, element: lead.element, imageUrl: lead.image_url ?? '', rarity: lead.rarity })
      setPlayerHp(lead.hp)
      return
    }
    if (squadCreatures.length > 0) return // already set up from fetch path

    supabase.from('encounters').select('player_creature_id').eq('id', state.encounterId).single()
      .then(async ({ data: enc }) => {
        if (!enc?.player_creature_id) return
        const { data: pc } = await supabase
          .from('player_creatures')
          .select('creatures(name, hp, atk, element, image_url, rarity)')
          .eq('id', enc.player_creature_id).single()
        if (pc) {
          const cr = (pc as any).creatures as { name: string; hp: number; atk: number; element: string; image_url: string; rarity: string }
          if (cr) {
            setPlayerCreature({ name: cr.name, maxHp: cr.hp, atk: cr.atk ?? 0, element: cr.element, imageUrl: cr.image_url ?? '', rarity: cr.rarity ?? 'comune' })
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

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleFight() {
    if (!state || loading) return
    resetTimer(); setLoading(true); setMessage(''); setShowItemsModal(false)

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

    if (!res.ok) { setMessage(data.error); setLoading(false); return }

    // Sequential: player attacks → wild shakes → (optional) wild counter → player shakes
    setPlayerAnim('attack')
    await new Promise(r => setTimeout(r, 350))
    setPlayerAnim('idle')

    setWildAnim('damage')
    await new Promise(r => setTimeout(r, 380))
    setWildAnim('idle')

    setState(prev => prev ? { ...prev, wildHp: data.wildHpRemaining, catchMultiplier: data.catchMultiplier, turns: prev.turns + 1 } : null)

    if (data.fightResult === 'fled') {
      setWildAnim('flee'); setMessage(''); setResult('ko'); setLoading(false); return
    }

    const bonusPct = Math.round((data.catchMultiplier - 1) * 100)
    const elemStr = data.elementMultiplier !== 1 ? ` (×${data.elementMultiplier.toFixed(1)})` : ''
    const bonusStr = bonusPct > 0 ? ` · +${bonusPct}% 🎯` : ''
    setMessage(`Danno: ${data.playerDamage}${elemStr}${bonusStr}`)

    if (data.playerTookDamage && data.wildDamage > 0) {
      await new Promise(r => setTimeout(r, 280))
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
            setLoading(false)
            return
          }
        }
        setResult('lost')
        setLoading(false)
        return
      }
    }

    if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
    window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
    setLoading(false)
  }

  async function handleCatch() {
    if (!state || loading) return
    resetTimer(); setLoading(true); setShowItemsModal(false)

    const res = await fetch('/api/game/encounter/catch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: selectedReteId }),
    })
    const data = await res.json()
    setSelectedReteId(null)
    if (selectedReteId) setReteItems(prev => prev.map(i => i.id === selectedReteId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))

    if (data.caught) {
      setWildAnim('catch')
      await new Promise(r => setTimeout(r, 1800))
      // Fetch full creature data for the reveal card (atk, def, description)
      const creatureId = data.newCreatureId ?? state.creature.id
      supabase.from('creatures')
        .select('name, hp, atk, def, element, rarity, image_url, description')
        .eq('id', creatureId).single()
        .then(({ data: cr }) => { if (cr) setCaughtCreatureData(cr) })
      setCaughtExpGain(data.expGain ?? 0)
      if (data.completedMissions?.length) setCompletedMissions(data.completedMissions)
      setResult(data.evolved ? 'evolved' : 'caught')
      if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      window.dispatchEvent(new CustomEvent('wc:refresh-bestiary'))
    } else if (data.fled) {
      setWildAnim('flee'); setMessage('La creatura è fuggita...'); setResult('fled')
    } else {
      if (data.wildDamage > 0) {
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
              setLoading(false)
              return
            }
          }
          setResult('lost')
          setLoading(false)
          return
        }
        setMessage(`Cattura fallita! Contrattacco (-${data.wildDamage} HP)`)
      } else {
        setMessage('Cattura fallita! La creatura resiste...')
      }
    }
    setLoading(false)
  }

  async function handleHeal(itemId: string) {
    if (!state || loading) return
    resetTimer(); setLoading(true); setShowItemsModal(false)
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
    setLoading(false)
  }

  async function handleFlee() {
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
      <div className="flex items-center justify-center h-full" style={{ background: '#060C18' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#3A9DBC] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Caricamento incontro...</p>
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
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
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
            />
          </motion.div>
        </div>

        {/* PLAYER CARD — bottom, flush to left edge */}
        <div className="absolute z-10" style={{ bottom: 12, left: 0, right: '12%' }}>
          <motion.div
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
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
              side="left"
            />
          </motion.div>
        </div>

        {/* VS / message — center */}
        <div className="absolute inset-x-0 z-10" style={{ top: '46%', transform: 'translateY(-50%)' }}>
          <div className="flex items-center justify-center px-4">
            <AnimatePresence mode="wait">
              {message ? (
                <motion.div
                  key={message}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full text-center"
                  style={{ background: 'rgba(247,200,65,0.14)', border: '1px solid rgba(247,200,65,0.35)', color: '#F7C841', maxWidth: 200 }}
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
              <span className="text-base leading-none">🎯</span>
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
              {loading
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
                    {state.creature.rarity?.replace('_', ' ')}
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
                        {crRarity?.replace('_', ' ')}
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

                  {/* EXP gained */}
                  {caughtExpGain > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.55 }}
                      className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
                      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
                    >
                      <span className="text-sm text-white/50">EXP guadagnata</span>
                      <span className="font-extrabold text-[#34D399]">+{caughtExpGain} EXP</span>
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
    </div>
  )
}
