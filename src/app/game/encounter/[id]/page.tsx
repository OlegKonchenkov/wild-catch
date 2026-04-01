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

export default function EncounterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [state, setState] = useState<EncounterState | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Separate animation states for wild creature and player creature
  const [wildAnim, setWildAnim]     = useState<'idle' | 'damage' | 'catch' | 'flee'>('idle')
  const [playerAnim, setPlayerAnim] = useState<'idle' | 'attack' | 'damage'>('idle')

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'caught' | 'fled' | 'evolved' | null>(null)
  const [playerCreature, setPlayerCreature] = useState<{
    name: string; maxHp: number; element: string; rarity: string; imageUrl: string
  } | null>(null)
  const [playerHp, setPlayerHp] = useState<number | null>(null)

  const [reteItems, setReteItems] = useState<InvItem[]>([])
  const [battagliaItems, setBattagliaItems] = useState<InvItem[]>([])
  const [pozioneItems, setPozioneItems] = useState<InvItem[]>([])
  const [curaItems, setCuraItems] = useState<InvItem[]>([])
  const [selectedReteId, setSelectedReteId] = useState<string | null>(null)
  const [selectedBattagliaId, setSelectedBattagliaId] = useState<string | null>(null)
  const [selectedPozioneId, setSelectedPozioneId] = useState<string | null>(null)
  const [showItems, setShowItems] = useState(false)
  const [turnTimer, setTurnTimer] = useState(45)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoFightRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`encounter_${id}`)
    if (stored) {
      setState(JSON.parse(stored))
      return
    }
    fetch(`/api/game/encounter/get?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.encounterId) { setLoadError(true); return }
        if (data.status && data.status !== 'active') {
          setResult(data.status === 'caught' ? 'caught' : 'fled')
          setState({ encounterId: data.encounterId, creature: data.creature, wildHp: 0, wildHpMax: data.wildHpMax ?? 100, catchBonus: 0, turns: 0 })
          return
        }
        const newState: EncounterState = {
          encounterId: data.encounterId,
          creature: data.creature,
          wildHp: data.wildHp,
          wildHpMax: data.wildHpMax,
          catchBonus: data.wildHp <= data.wildHpMax * 0.3 ? 0.20 : 0,
          turns: 0,
        }
        sessionStorage.setItem(`encounter_${id}`, JSON.stringify(newState))
        setState(newState)
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('player_inventory')
        .select('id, quantity, items(id, name, type, effect_value)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .gt('quantity', 0)
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
    supabase
      .from('encounters')
      .select('player_creature_id')
      .eq('id', state.encounterId)
      .single()
      .then(async ({ data: enc }) => {
        if (!enc?.player_creature_id) return
        const { data: pc } = await supabase
          .from('player_creatures')
          .select('creatures(name, hp, element, image_url, rarity)')
          .eq('id', enc.player_creature_id)
          .single()
        if (pc) {
          const cr = (pc as any).creatures as { name: string; hp: number; element: string; image_url: string; rarity: string }
          if (cr) {
            setPlayerCreature({ name: cr.name, maxHp: cr.hp, element: cr.element, imageUrl: cr.image_url ?? '', rarity: cr.rarity ?? 'comune' })
            setPlayerHp(cr.hp)
          }
        }
      })
  }, [state?.encounterId, supabase])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTurnTimer(45)
    autoFightRef.current = false
    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          if (!autoFightRef.current) {
            autoFightRef.current = true
            document.getElementById('wc-fight-btn')?.click()
          }
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

  async function handleFight() {
    if (!state || loading) return
    resetTimer()
    setLoading(true)
    setMessage('')
    setShowItems(false)

    const activeItemId = selectedPozioneId ?? selectedBattagliaId ?? null

    // Fire API call
    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: activeItemId }),
    })
    const data = await res.json()

    // Consume items immediately
    if (selectedBattagliaId) {
      setBattagliaItems(prev => prev.map(i => i.id === selectedBattagliaId
        ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
    }
    if (selectedPozioneId) {
      setPozioneItems(prev => prev.map(i => i.id === selectedPozioneId
        ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
    }
    setSelectedBattagliaId(null)
    setSelectedPozioneId(null)

    if (!res.ok) { setMessage(data.error); setLoading(false); return }

    // ── Sequential battle animation ──────────────────────────────────────
    // 1. Player lunges at wild creature
    setPlayerAnim('attack')
    await new Promise(r => setTimeout(r, 350))
    setPlayerAnim('idle')

    // 2. Wild creature shakes from the hit
    setWildAnim('damage')
    await new Promise(r => setTimeout(r, 380))
    setWildAnim('idle')

    // Update wild HP after hit animation
    setState(prev => prev ? {
      ...prev,
      wildHp: data.wildHpRemaining,
      catchBonus: data.catchBonus,
      turns: prev.turns + 1,
    } : null)

    if (data.fightResult === 'fled') {
      setWildAnim('flee')
      setMessage('La creatura è fuggita!')
      setResult('fled')
      setLoading(false)
      return
    }

    if (data.fightResult === 'catchable') {
      setMessage(`HP basso! Bonus cattura +${Math.round(data.catchBonus * 100)}%`)
    } else {
      setMessage(`Danno: ${data.playerDamage} (×${data.elementMultiplier.toFixed(1)})`)
    }

    // 3. Wild counter-attacks player (if it happened)
    if (data.playerTookDamage && data.wildDamage > 0) {
      await new Promise(r => setTimeout(r, 280)) // brief pause before counter
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
    resetTimer()
    setLoading(true)
    setShowItems(false)

    const res = await fetch('/api/game/encounter/catch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: selectedReteId }),
    })
    const data = await res.json()
    setSelectedReteId(null)
    if (selectedReteId) {
      setReteItems(prev => prev.map(i => i.id === selectedReteId
        ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
    }

    if (data.caught) {
      // Trigger catch animation — net ring + sprite shrink play together
      setWildAnim('catch')
      // Wait long enough for the full dramatic effect (net: 1.4s, creature shrinks at 0.6s)
      await new Promise(r => setTimeout(r, 1800))
      setResult(data.evolved ? 'evolved' : 'caught')
      setMessage(data.evolved ? '✨ Evoluzione!' : 'Catturato!')
      if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      window.dispatchEvent(new CustomEvent('wc:refresh-bestiary'))
    } else if (data.fled) {
      setWildAnim('flee')
      setMessage('La creatura è fuggita...')
      setResult('fled')
    } else {
      // Catch failed — wild counter-attacks
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
    resetTimer()
    setLoading(true)
    setShowItems(false)
    const res = await fetch('/api/game/encounter/heal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId }),
    })
    const data = await res.json()
    if (res.ok && data.healed) {
      setCuraItems(prev => prev.map(i => i.id === itemId
        ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
      setPlayerHp(prev => prev !== null ? Math.min(data.maxHp, prev + data.healAmount) : data.healAmount)
      setMessage(`+${data.healAmount} HP ripristinati`)
    } else {
      setMessage(data.error ?? 'Cura fallita')
    }
    setLoading(false)
  }

  function handleFlee() {
    router.back()
  }

  if (!state) {
    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center"
          style={{ background: 'linear-gradient(160deg, #080E18 0%, #0D1A28 100%)' }}>
          <div className="text-5xl">😶</div>
          <p className="text-white font-bold">Incontro non trovato</p>
          <p className="text-white/50 text-sm">L'incontro potrebbe essere già terminato.</p>
          <button onClick={() => router.push('/game/map')}
            className="mt-2 px-8 py-3 rounded-2xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #3A9DBC, #2a7a99)', boxShadow: '0 4px 20px rgba(58,157,188,0.35)' }}>
            Torna alla mappa
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-full"
        style={{ background: 'linear-gradient(160deg, #080E18 0%, #0D1A28 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#3A9DBC] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Caricamento incontro...</p>
        </div>
      </div>
    )
  }

  const wildRarityColor = RARITY_COLORS[state.creature.rarity ?? 'comune']
  const wildElementEmoji = ELEMENT_EMOJI[state.creature.element ?? 'fiamma']
  const hpPercent = Math.max(0, (state.wildHp / state.wildHpMax) * 100)
  const playerHpPercent = playerCreature && playerHp !== null
    ? Math.max(0, (playerHp / playerCreature.maxHp) * 100) : 100
  const hasItems = reteItems.length > 0 || battagliaItems.length > 0 || pozioneItems.length > 0 || curaItems.length > 0
  const timerPct = (turnTimer / 45) * 100
  const timerUrgent = turnTimer <= 10

  const hpBarColor = (pct: number) => pct > 50 ? '#34D399' : pct > 25 ? '#FBBF24' : '#EF4444'

  return (
    <div className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'linear-gradient(170deg, #060C18 0%, #0C1A28 30%, #0A1E1A 65%, #060C18 100%)' }}>

      {/* ── Atmospheric glows ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[70%] h-[55%] opacity-25 blur-3xl"
          style={{ background: `radial-gradient(ellipse at 80% 20%, ${wildRarityColor}50 0%, transparent 65%)` }} />
        <div className="absolute bottom-0 left-0 w-[60%] h-[45%] opacity-18 blur-3xl"
          style={{ background: 'radial-gradient(ellipse at 20% 80%, rgba(58,157,188,0.6) 0%, transparent 65%)' }} />
      </div>

      {/* ── WILD ZONE (top ~45%) ── */}
      <div className="relative z-10 shrink-0" style={{ height: '43%' }}>

        {/* Info card — bottom-left of wild zone */}
        <div className="absolute bottom-3 left-4 z-10" style={{ maxWidth: 'calc(50% + 8px)' }}>
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(6,12,24,0.90)',
              border: `1px solid ${wildRarityColor}45`,
              backdropFilter: 'blur(12px)',
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${wildRarityColor}20`,
            }}
          >
            <div className="px-3 pt-2.5 pb-2.5">
              <p className="font-extrabold text-white text-sm leading-tight truncate mb-1.5 tracking-wide">
                {state.creature.name}
              </p>
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${wildRarityColor}25`, border: `1px solid ${wildRarityColor}55`, color: wildRarityColor }}>
                  {state.creature.rarity?.replace('_', ' ')}
                </span>
                <span className="text-sm leading-none">{wildElementEmoji}</span>
                <span className="text-[10px] text-white/40 capitalize">{state.creature.element}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <motion.div className="h-full rounded-full"
                  animate={{ width: `${hpPercent}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: hpBarColor(hpPercent), boxShadow: `0 0 8px ${hpBarColor(hpPercent)}80` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">HP</span>
                <span className="text-[10px] font-mono font-bold text-white/50">{state.wildHp}/{state.wildHpMax}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Wild sprite — top-right */}
        <div className="absolute top-3 right-3 z-10">
          <motion.div
            initial={{ x: 60, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative"
          >
            {/* Net catch ring — plays when wildAnim === 'catch' */}
            <AnimatePresence>
              {wildAnim === 'catch' && (
                <motion.div
                  key="catch-net"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                >
                  {/* Primary contracting ring */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{
                      border: '3px solid rgba(58,157,188,1)',
                      boxShadow: '0 0 30px rgba(58,157,188,0.95), 0 0 80px rgba(58,157,188,0.5)',
                    }}
                    initial={{ width: 240, height: 240, opacity: 0 }}
                    animate={{ width: [240, 240, 100, 20, 4], height: [240, 240, 100, 20, 4], opacity: [0, 1, 1, 0.8, 0] }}
                    transition={{ duration: 1.4, times: [0, 0.12, 0.6, 0.88, 1], ease: 'easeInOut' }}
                  />
                  {/* Inner fill */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(58,157,188,0.35) 0%, transparent 70%)' }}
                    initial={{ width: 240, height: 240, opacity: 0 }}
                    animate={{ width: [240, 240, 100, 20, 4], height: [240, 240, 100, 20, 4], opacity: [0, 0.9, 0.7, 0.4, 0] }}
                    transition={{ duration: 1.4, times: [0, 0.12, 0.6, 0.88, 1], ease: 'easeInOut' }}
                  />
                  {/* Sparkle at the moment of capture */}
                  <motion.div
                    className="absolute text-[#3A9DBC] text-2xl font-extrabold"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.8, 1.5, 0] }}
                    transition={{ duration: 0.5, delay: 0.75 }}
                  >
                    ✦
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <CreatureSprite
              imageUrl={state.creature.image_url ?? ''}
              name={state.creature.name ?? ''}
              animState={wildAnim}
              size={150}
              element={state.creature.element as Element}
              rarity={state.creature.rarity as Rarity}
              showAura
            />
          </motion.div>
        </div>
      </div>

      {/* ── SEPARATOR ── */}
      <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-1">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07))' }} />
        <AnimatePresence mode="wait">
          {message ? (
            <motion.div
              key={message}
              initial={{ opacity: 0, scale: 0.85, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: 'rgba(247,200,65,0.12)',
                border: '1px solid rgba(247,200,65,0.3)',
                color: '#F7C841',
                maxWidth: 200,
                textAlign: 'center',
              }}
            >
              {message}
            </motion.div>
          ) : (
            <div className="w-8 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold tracking-widest text-white/25"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              VS
            </div>
          )}
        </AnimatePresence>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.07), transparent)' }} />
      </div>

      {/* ── PLAYER ZONE (~30%) ── */}
      <div className="relative z-10 shrink-0" style={{ height: '30%' }}>

        {/* Player sprite — bottom-left */}
        <div className="absolute bottom-2 left-4 z-10">
          {playerCreature ? (
            <motion.div
              initial={{ x: -40, opacity: 0, scale: 0.85 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <CreatureSprite
                imageUrl={playerCreature.imageUrl}
                name={playerCreature.name}
                animState={playerAnim}
                size={115}
                element={playerCreature.element as Element}
                rarity={playerCreature.rarity as Rarity}
                showAura
              />
            </motion.div>
          ) : (
            <div className="w-[115px] h-[115px] rounded-2xl animate-pulse"
              style={{ background: 'rgba(58,157,188,0.1)', border: '1px solid rgba(58,157,188,0.2)' }} />
          )}
        </div>

        {/* Player info card — top-right */}
        {playerCreature && playerHp !== null && (
          <div className="absolute top-3 right-4 z-10" style={{ maxWidth: 'calc(50% + 8px)' }}>
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(6,12,24,0.90)',
                border: '1px solid rgba(58,157,188,0.35)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(58,157,188,0.12)',
              }}
            >
              <div className="px-3 pt-2.5 pb-2.5">
                <p className="font-extrabold text-white text-sm leading-tight truncate mb-1.5 tracking-wide">
                  {playerCreature.name}
                </p>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-sm leading-none">
                    {ELEMENT_EMOJI[playerCreature.element as keyof typeof ELEMENT_EMOJI] ?? ''}
                  </span>
                  <span className="text-[10px] text-white/40 capitalize">{playerCreature.element}</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div className="h-full rounded-full"
                    animate={{ width: `${playerHpPercent}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ background: hpBarColor(playerHpPercent), boxShadow: `0 0 8px ${hpBarColor(playerHpPercent)}80` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">HP</span>
                  <span className="text-[10px] font-mono font-bold text-white/50">{playerHp}/{playerCreature.maxHp}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* ── TIMER BAR ── */}
      {!result && (
        <div className="shrink-0 px-4 pb-1.5 z-10">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ width: `${timerPct}%`, background: timerUrgent ? '#EF4444' : '#34D399' }}
                animate={timerUrgent ? { opacity: [1, 0.45, 1] } : {}}
                transition={timerUrgent ? { duration: 0.5, repeat: Infinity } : {}}
              />
            </div>
            <span className={`text-[11px] font-mono font-bold w-6 text-right shrink-0 ${timerUrgent ? 'text-red-400' : 'text-white/35'}`}>
              {turnTimer}
            </span>
          </div>
        </div>
      )}

      {/* ── ITEMS PANEL ── */}
      <AnimatePresence>
        {showItems && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 px-3 overflow-hidden z-10"
          >
            <div className="rounded-2xl p-3 mb-2 space-y-3"
              style={{ background: 'rgba(6,12,24,0.92)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>

              {reteItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5">Reti — bonus cattura</p>
                  <div className="flex flex-wrap gap-2">
                    {reteItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => setSelectedReteId(prev => prev === inv.id ? null : inv.id)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border"
                        style={{
                          background: selectedReteId === inv.id ? '#3A9DBC20' : 'rgba(255,255,255,0.05)',
                          borderColor: selectedReteId === inv.id ? '#3A9DBC' : 'rgba(255,255,255,0.1)',
                          color: selectedReteId === inv.id ? '#3A9DBC' : 'rgba(255,255,255,0.7)',
                        }}>
                        🎯 {inv.items.name}
                        {inv.items.effect_value > 0 && <span className="text-[#34D399]">+{inv.items.effect_value}%</span>}
                        <span className="opacity-40">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {battagliaItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5">Potenziamento — +ATK</p>
                  <div className="flex flex-wrap gap-2">
                    {battagliaItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => setSelectedBattagliaId(prev => prev === inv.id ? null : inv.id)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border"
                        style={{
                          background: selectedBattagliaId === inv.id ? '#FBBF2420' : 'rgba(255,255,255,0.05)',
                          borderColor: selectedBattagliaId === inv.id ? '#FBBF24' : 'rgba(255,255,255,0.1)',
                          color: selectedBattagliaId === inv.id ? '#FBBF24' : 'rgba(255,255,255,0.7)',
                        }}>
                        ⚔️ {inv.items.name}
                        {inv.items.effect_value > 0 && <span className="text-[#FBBF24]">+{inv.items.effect_value}%</span>}
                        <span className="opacity-40">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {pozioneItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5">Pozione — annulla debolezza</p>
                  <div className="flex flex-wrap gap-2">
                    {pozioneItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => setSelectedPozioneId(prev => prev === inv.id ? null : inv.id)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border"
                        style={{
                          background: selectedPozioneId === inv.id ? '#7B4DB820' : 'rgba(255,255,255,0.05)',
                          borderColor: selectedPozioneId === inv.id ? '#7B4DB8' : 'rgba(255,255,255,0.1)',
                          color: selectedPozioneId === inv.id ? '#C084FC' : 'rgba(255,255,255,0.7)',
                        }}>
                        🧪 {inv.items.name}
                        <span className="opacity-40">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {curaItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5">Cura — ripristina HP</p>
                  <div className="flex flex-wrap gap-2">
                    {curaItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => handleHeal(inv.id)}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border disabled:opacity-40"
                        style={{ background: '#34D39920', borderColor: '#34D39960', color: '#34D399' }}>
                        💚 {inv.items.name}
                        {inv.items.effect_value > 0 && <span>+{inv.items.effect_value}%</span>}
                        <span className="opacity-40">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACTION BUTTONS ── */}
      {!result && (
        <div className="shrink-0 px-3 pb-3 z-10">
          <div className={`grid gap-2 ${hasItems ? 'grid-cols-4' : 'grid-cols-3'}`}>

            <motion.button
              onClick={handleCatch}
              disabled={loading}
              whileTap={{ scale: 0.94 }}
              className="relative overflow-hidden rounded-2xl py-4 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: 'linear-gradient(145deg, #E85D2F 0%, #c94a20 100%)', boxShadow: '0 4px 18px rgba(232,93,47,0.4)' }}
            >
              <span className="text-lg leading-none">🎯</span>
              <span className="text-[11px] font-extrabold text-white tracking-wide">CATTURA</span>
              {(state.catchBonus > 0 || selectedReteId) && (
                <span className="text-[9px] text-[#F7C841] font-bold">
                  +{Math.round((state.catchBonus + (reteItems.find(i => i.id === selectedReteId)?.items.effect_value ?? 0) / 100) * 100)}%
                </span>
              )}
            </motion.button>

            <motion.button
              id="wc-fight-btn"
              onClick={handleFight}
              disabled={loading || state.turns >= 5}
              whileTap={{ scale: 0.94 }}
              className="relative overflow-hidden rounded-2xl py-4 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: 'linear-gradient(145deg, #7B4DB8 0%, #5c3a8c 100%)', boxShadow: '0 4px 18px rgba(123,77,184,0.4)' }}
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="text-lg leading-none">⚔️</span>
              }
              <span className="text-[11px] font-extrabold text-white tracking-wide">LOTTA</span>
              <span className="text-[9px] text-white/45 font-bold">{state.turns}/5</span>
            </motion.button>

            {hasItems && (
              <motion.button
                onClick={() => setShowItems(v => !v)}
                whileTap={{ scale: 0.94 }}
                className="rounded-2xl py-4 flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  background: showItems || selectedReteId || selectedBattagliaId ? 'rgba(247,200,65,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${showItems || selectedReteId || selectedBattagliaId ? 'rgba(247,200,65,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <span className="text-lg leading-none">🎒</span>
                <span className="text-[11px] font-extrabold tracking-wide"
                  style={{ color: showItems || selectedReteId || selectedBattagliaId ? '#F7C841' : 'rgba(255,255,255,0.55)' }}>
                  {selectedReteId || selectedBattagliaId ? '1 SEL.' : 'OGGETTI'}
                </span>
              </motion.button>
            )}

            <motion.button
              onClick={handleFlee}
              whileTap={{ scale: 0.94 }}
              className="rounded-2xl py-4 flex flex-col items-center justify-center gap-1"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <span className="text-lg leading-none">🏃</span>
              <span className="text-[11px] font-extrabold text-white/45 tracking-wide">FUGGI</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* ── RESULT OVERLAY ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-40 px-6"
            style={{ background: 'rgba(6,12,24,0.93)', backdropFilter: 'blur(14px)' }}
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="flex flex-col items-center text-center"
            >
              <div className="text-7xl mb-5">
                {result === 'caught' ? '🎯' : result === 'evolved' ? '✨' : '💨'}
              </div>
              <p className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {result === 'caught' ? 'Catturato!' : result === 'evolved' ? 'Evoluzione!' : 'Fuggita'}
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
              <motion.button
                onClick={() => router.push('/game/map')}
                whileTap={{ scale: 0.96 }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{
                  background: result === 'caught' || result === 'evolved'
                    ? 'linear-gradient(135deg, #3A9DBC, #2a7a99)'
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: result === 'caught' || result === 'evolved'
                    ? '0 4px 24px rgba(58,157,188,0.45)' : 'none',
                  border: result === 'fled' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                }}
              >
                Continua
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
