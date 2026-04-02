'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { createClient } from '@/lib/supabase/client'
import { RARITY_COLORS, ELEMENT_EMOJI } from '@/lib/types'
import type { Creature, Element, Rarity } from '@/lib/types'

interface EncounterState {
  encounterId: string
  creature: Partial<Creature>
  wildHp: number
  wildHpMax: number
  catchBonus: number
  turns: number
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
  comune: 1, non_comune: 2, raro: 3, epico: 4, leggendario: 5
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
  catchBonus?: number
  isWild?: boolean
  animState?: 'idle' | 'attack' | 'damage' | 'catch' | 'flee'
  side: 'left' | 'right'
}

function CreatureCard({ imageUrl, name, element, rarity, currentHp, maxHp, atk, catchBonus, isWild, animState = 'idle', side }: CardProps) {
  const rarityColor = RARITY_COLORS[rarity as Rarity] ?? '#64748b'
  const elemEmoji   = ELEMENT_EMOJI[element as keyof typeof ELEMENT_EMOJI] ?? '✦'
  const hpPct       = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const hpColor     = hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444'
  const stars       = CATCH_STARS[rarity] ?? 1
  const isWeakened  = isWild && hpPct < 30

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
          width: 100,
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
                initial={{ width: 120, height: 120, opacity: 0 }}
                animate={{ width: [120, 120, 45, 5], height: [120, 120, 45, 5], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.4, times: [0, 0.12, 0.62, 1], ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute text-[#3A9DBC] font-extrabold"
                style={{ fontSize: 16, textShadow: '0 0 10px rgba(58,157,188,0.9)' }}
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
          size={95}
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

        {/* Wild: catch stars + weakened/bonus */}
        {isWild && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-[1.5px]">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ fontSize: 9, color: i < stars ? '#FBBF24' : 'rgba(255,255,255,0.12)', lineHeight: 1 }}>★</span>
              ))}
            </div>
            {isWeakened && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
                indebolita!
              </span>
            )}
            {(catchBonus ?? 0) > 0 && (
              <span className="text-[9px] font-bold text-[#34D399]">+{Math.round((catchBonus ?? 0) * 100)}%</span>
            )}
          </div>
        )}

        {/* Player: ATK stat */}
        {!isWild && atk !== undefined && (
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
  const [result, setResult]     = useState<'caught' | 'fled' | 'evolved' | 'ko' | null>(null)
  const [playerCreature, setPlayerCreature] = useState<{
    name: string; maxHp: number; atk: number; element: string; rarity: string; imageUrl: string
  } | null>(null)
  const [playerHp, setPlayerHp] = useState<number | null>(null)

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
    if (stored) { setState(JSON.parse(stored)); return }
    fetch(`/api/game/encounter/get?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.encounterId) { setLoadError(true); return }
        if (data.status && data.status !== 'active') {
          setResult(data.status === 'caught' ? 'caught' : 'fled')
          setState({ encounterId: data.encounterId, creature: data.creature, wildHp: 0, wildHpMax: data.wildHpMax ?? 100, catchBonus: 0, turns: 0 })
          return
        }
        const s: EncounterState = {
          encounterId: data.encounterId, creature: data.creature,
          wildHp: data.wildHp, wildHpMax: data.wildHpMax,
          catchBonus: data.wildHp <= data.wildHpMax * 0.3 ? 0.20 : 0, turns: 0,
        }
        sessionStorage.setItem(`encounter_${id}`, JSON.stringify(s))
        setState(s)
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
  }, [state?.encounterId, supabase])

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
    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: activeItemId }),
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

    setState(prev => prev ? { ...prev, wildHp: data.wildHpRemaining, catchBonus: data.catchBonus, turns: prev.turns + 1 } : null)

    if (data.fightResult === 'fled') {
      setWildAnim('flee'); setMessage(''); setResult('ko'); setLoading(false); return
    }

    setMessage(data.fightResult === 'catchable'
      ? `HP basso! Bonus cattura +${Math.round(data.catchBonus * 100)}%`
      : `Danno: ${data.playerDamage} (×${data.elementMultiplier.toFixed(1)})`)

    if (data.playerTookDamage && data.wildDamage > 0) {
      await new Promise(r => setTimeout(r, 280))
      setPlayerHp(prev => prev !== null ? Math.max(0, prev - data.wildDamage) : null)
      setPlayerAnim('damage')
      await new Promise(r => setTimeout(r, 420))
      setPlayerAnim('idle')
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
      setResult(data.evolved ? 'evolved' : 'caught')
      if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      window.dispatchEvent(new CustomEvent('wc:refresh-bestiary'))
    } else if (data.fled) {
      setWildAnim('flee'); setMessage('La creatura è fuggita...'); setResult('fled')
    } else {
      if (data.wildDamage > 0) {
        setPlayerHp(prev => prev !== null ? Math.max(0, prev - data.wildDamage) : null)
        setPlayerAnim('damage')
        await new Promise(r => setTimeout(r, 420))
        setPlayerAnim('idle')
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
      fetch('/api/game/encounter/flee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: state.encounterId }),
        keepalive: true,
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
        <div className="absolute z-10" style={{ top: 12, right: 0, left: '22%' }}>
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
              catchBonus={state.catchBonus}
              isWild
              animState={wildAnim}
              side="right"
            />
          </motion.div>
        </div>

        {/* PLAYER CARD — bottom, flush to left edge */}
        <div className="absolute z-10" style={{ bottom: 12, left: 0, right: '22%' }}>
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
              {(state.catchBonus > 0 || selectedReteId) && (
                <span className="text-[8px] text-[#F7C841] font-bold">
                  +{Math.round((state.catchBonus + (reteItems.find(i => i.id === selectedReteId)?.items.effect_value ?? 0) / 100) * 100)}%
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
                            {inv.items.effect_value > 0 && <p className="text-xs text-[#34D399]">+{inv.items.effect_value}% cattura</p>}
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

      {/* ── RESULT OVERLAY ── */}
      <AnimatePresence>
        {result && (
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
              <div className="text-7xl mb-5">
                {result === 'caught' ? '🎯' : result === 'evolved' ? '✨' : result === 'ko' ? '💥' : '💨'}
              </div>
              <p className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {result === 'caught' ? 'Catturato!' : result === 'evolved' ? 'Evoluzione!' : result === 'ko' ? 'Knock Out!' : 'Fuggita'}
              </p>
              {state.creature.name && (
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-base text-white/50">{state.creature.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${wildRarityColor}25`, color: wildRarityColor, border: `1px solid ${wildRarityColor}50` }}>
                    {state.creature.rarity?.replace('_', ' ')}
                  </span>
                </div>
              )}
              <motion.button onClick={() => router.push('/game/map')} whileTap={{ scale: 0.96 }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{
                  background: result !== 'fled' ? 'linear-gradient(135deg,#3A9DBC,#2a7a99)' : 'rgba(255,255,255,0.08)',
                  boxShadow: result !== 'fled' ? '0 4px 24px rgba(58,157,188,0.45)' : 'none',
                  border: result === 'fled' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                }}>
                Continua
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
