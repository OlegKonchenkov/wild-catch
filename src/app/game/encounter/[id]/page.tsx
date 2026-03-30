'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'
import { createClient } from '@/lib/supabase/client'
import { RARITY_COLORS, ELEMENT_EMOJI } from '@/lib/types'
import type { Creature } from '@/lib/types'

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
  const [animState, setAnimState] = useState<'idle' | 'attack' | 'damage' | 'catch' | 'flee'>('idle')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'caught' | 'fled' | 'evolved' | null>(null)
  const [playerCreature, setPlayerCreature] = useState<{ name: string; maxHp: number; element: string } | null>(null)
  const [playerHp, setPlayerHp] = useState<number | null>(null)

  // Item selection state
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
    // Try sessionStorage first (fast path — set by map page popup)
    const stored = sessionStorage.getItem(`encounter_${id}`)
    if (stored) {
      setState(JSON.parse(stored))
      return
    }

    // Fallback: fetch encounter from server (direct URL navigation, page refresh, etc.)
    fetch(`/api/game/encounter/get?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.encounterId) { setLoadError(true); return }
        // Ended encounter — show result screen instead of blocking
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
      .catch(() => { /* leave as loading */ })
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
          .select('creatures(name, hp, element)')
          .eq('id', enc.player_creature_id)
          .single()
        if (pc) {
          const cr = (pc as any).creatures as { name: string; hp: number; element: string }
          if (cr) {
            setPlayerCreature({ name: cr.name, maxHp: cr.hp, element: cr.element })
            setPlayerHp(cr.hp)
          }
        }
      })
  }, [state?.encounterId, supabase])

  // REQ-BAT-04: timer 45s per turno — auto-attack quando scade
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTurnTimer(45)
    autoFightRef.current = false
    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          if (!autoFightRef.current) {
            autoFightRef.current = true
            // trigger auto-attack
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

    // REQ-INV-04: pass pozione (anti-weakness) or battaglia item to fight
    const activeItemId = selectedPozioneId ?? selectedBattagliaId ?? null
    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: activeItemId }),
    })
    const data = await res.json()
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

    if (data.playerTookDamage) {
      setAnimState('damage')
      await new Promise(r => setTimeout(r, 400))
    }
    setAnimState('idle')

    if (data.playerTookDamage && data.wildDamage > 0) {
      setPlayerHp(prev => prev !== null ? Math.max(0, prev - data.wildDamage) : null)
    }

    setState(prev => prev ? {
      ...prev,
      wildHp: data.wildHpRemaining,
      catchBonus: data.catchBonus,
      turns: prev.turns + 1,
    } : null)

    if (data.fightResult === 'fled') {
      setAnimState('flee')
      setMessage('La creatura è fuggita!')
      setResult('fled')
    } else if (data.fightResult === 'catchable') {
      setMessage(`HP basso! Bonus cattura +${Math.round(data.catchBonus * 100)}% 🎯`)
    } else {
      setMessage(`Danno inflitto: ${data.playerDamage} (×${data.elementMultiplier.toFixed(1)})`)
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
      setAnimState('catch')
      await new Promise(r => setTimeout(r, 700))
      setResult(data.evolved ? 'evolved' : 'caught')
      setMessage(data.evolved ? '✨ Evoluzione!' : '✅ Catturato!')
      if (data.levelUp) window.dispatchEvent(new CustomEvent('wc:level-up', { detail: data.levelUp }))
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      window.dispatchEvent(new CustomEvent('wc:refresh-bestiary'))
    } else if (data.fled) {
      setAnimState('flee')
      setMessage('La creatura è fuggita...')
      setResult('fled')
    } else {
      // Counter-attack: encounter continues
      if (data.wildDamage > 0) {
        setPlayerHp(prev => prev !== null ? Math.max(0, prev - data.wildDamage) : null)
        setAnimState('damage')
        await new Promise(r => setTimeout(r, 400))
        setAnimState('idle')
        setMessage(`Cattura fallita! La creatura contrattacca (-${data.wildDamage} HP)`)
      } else {
        setMessage('Cattura fallita! La creatura resiste...')
      }
    }
    setLoading(false)
  }

  // REQ-PRO-03: healing item — restores player HP, skips attack turn
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
      setMessage(`+${data.healAmount} HP ripristinati 💚`)
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
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
          <p className="text-4xl">😶</p>
          <p className="text-white font-bold">Incontro non trovato</p>
          <p className="text-white/50 text-sm">L'incontro potrebbe essere già terminato.</p>
          <button onClick={() => router.push('/game/map')} className="bg-[#3A9DBC] text-white font-bold py-3 px-8 rounded-xl">
            Torna alla mappa
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-full text-white">
        Caricamento incontro...
      </div>
    )
  }

  const rarityColor = RARITY_COLORS[state.creature.rarity ?? 'comune']
  const elementEmoji = ELEMENT_EMOJI[state.creature.element ?? 'fiamma']
  const hasItems = reteItems.length > 0 || battagliaItems.length > 0 || pozioneItems.length > 0 || curaItems.length > 0
  const timerPct = (turnTimer / 45) * 100
  const timerUrgent = turnTimer <= 10

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0F1F2E] via-[#122030] to-[#1A2E20] overflow-hidden">

      {/* ── BATTLE FIELD ─────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">

        {/* Wild creature — top right (Pokémon avversario) */}
        <div className="absolute top-3 right-3 left-1/2 flex flex-col items-end gap-1.5">
          {/* Wild HP card */}
          <div className="bg-[#0A1520]/85 backdrop-blur-sm rounded-xl px-3 py-2 w-full max-w-[160px] border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider truncate max-w-[90px]">
                {state.creature.name}
              </span>
              <span className="text-[10px]">{elementEmoji}</span>
            </div>
            <HPBar current={state.wildHp} max={state.wildHpMax} label="" />
            <p className="text-right text-[9px] text-white/30 mt-0.5 font-mono">
              {state.wildHp}/{state.wildHpMax}
            </p>
          </div>
          {/* Rarity badge */}
          <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-bold"
            style={{ backgroundColor: rarityColor + 'cc' }}>
            {state.creature.rarity?.replace('_',' ')}
          </span>
        </div>

        {/* Wild sprite — top-right area */}
        <motion.div
          className="absolute top-2 right-4"
          animate={animState === 'damage' ? { x: [-6, 6, -4, 4, 0] } :
                   animState === 'flee'   ? { x: [0, 60], opacity: [1, 0] } :
                   animState === 'catch'  ? { scale: [1, 0.8, 0.6, 0.1], opacity: [1, 1, 0.8, 0] } :
                   { y: [0, -4, 0] }}
          transition={animState === 'idle'
            ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.5 }}
        >
          <CreatureSprite
            imageUrl={state.creature.image_url ?? ''}
            name={state.creature.name ?? ''}
            animState="idle"
            size={130}
          />
        </motion.div>

        {/* Player creature — bottom left (Pokémon del giocatore) */}
        <div className="absolute bottom-3 left-3 right-1/2 flex flex-col gap-1.5">
          {playerCreature && playerHp !== null && (
            <div className="bg-[#0A1520]/85 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider truncate max-w-[90px]">
                  {playerCreature.name}
                </span>
                <span className="text-[10px]">
                  {ELEMENT_EMOJI[playerCreature.element as keyof typeof ELEMENT_EMOJI] ?? ''}
                </span>
              </div>
              <HPBar current={playerHp} max={playerCreature.maxHp} label="" />
              <p className="text-[9px] text-white/30 mt-0.5 font-mono">
                {playerHp}/{playerCreature.maxHp}
              </p>
            </div>
          )}
        </div>

        {/* Player sprite placeholder — bottom left */}
        <motion.div
          className="absolute bottom-16 left-4"
          animate={animState === 'attack' ? { x: [0, 20, 0] } :
                   animState === 'damage' ? { x: [-4, 4, -2, 2, 0], opacity: [1, 0.5, 1, 0.5, 1] } :
                   { y: [0, -3, 0] }}
          transition={animState === 'idle'
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }
            : { duration: 0.35 }}
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-[#3A9DBC]/30 to-[#3A9DBC]/10 border border-[#3A9DBC]/30 flex items-center justify-center text-3xl">
            {playerCreature ? (ELEMENT_EMOJI[playerCreature.element as keyof typeof ELEMENT_EMOJI] ?? '⚔️') : '⚔️'}
          </div>
        </motion.div>

        {/* Battle message — center */}
        <AnimatePresence>
          {message && (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-1/3 left-4 right-4 bg-[#0A1520]/90 border border-white/10 rounded-xl px-3 py-2 text-center backdrop-blur-sm"
            >
              <p className="text-sm text-[#F7C841] font-semibold">{message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── TIMER BAR ──────────────────────────────────────── */}
      {!result && (
        <div className="px-4 pb-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full transition-colors"
                style={{ width: `${timerPct}%`, background: timerUrgent ? '#EF4444' : '#34D399' }}
                animate={timerUrgent ? { opacity: [1, 0.5, 1] } : {}}
                transition={timerUrgent ? { duration: 0.5, repeat: Infinity } : {}}
              />
            </div>
            <span className={`text-xs font-mono font-bold w-6 text-right ${timerUrgent ? 'text-red-400' : 'text-white/40'}`}>
              {turnTimer}
            </span>
          </div>
        </div>
      )}

      {/* ── ITEMS PANEL ────────────────────────────────────── */}
      <AnimatePresence>
        {showItems && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 overflow-hidden"
          >
            <div className="rounded-2xl border border-white/10 bg-[#0A1520]/90 p-3 space-y-3 mb-2">
              {reteItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Reti — bonus cattura</p>
                  <div className="flex flex-wrap gap-2">
                    {reteItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => setSelectedReteId(prev => prev === inv.id ? null : inv.id)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border ${
                          selectedReteId === inv.id ? 'bg-[#3A9DBC] text-white border-[#3A9DBC]' : 'bg-white/5 text-white/70 border-white/10'
                        }`}>
                        🎯 {inv.items.name}
                        {inv.items.effect_value > 0 && <span className="text-[#34D399]">+{inv.items.effect_value}%</span>}
                        <span className="opacity-50">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {battagliaItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Potenziamenti — bonus ATK</p>
                  <div className="flex flex-wrap gap-2">
                    {battagliaItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => setSelectedBattagliaId(prev => prev === inv.id ? null : inv.id)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border ${
                          selectedBattagliaId === inv.id ? 'bg-[#FBBF24] text-[#0F1F2E] border-[#FBBF24]' : 'bg-white/5 text-white/70 border-white/10'
                        }`}>
                        ⚔️ {inv.items.name}
                        {inv.items.effect_value > 0 && <span className="text-[#FBBF24]">+{inv.items.effect_value}%</span>}
                        <span className="opacity-50">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {pozioneItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Pozione — annulla debolezza</p>
                  <div className="flex flex-wrap gap-2">
                    {pozioneItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => setSelectedPozioneId(prev => prev === inv.id ? null : inv.id)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border ${
                          selectedPozioneId === inv.id ? 'bg-[#7B4DB8] text-white border-[#7B4DB8]' : 'bg-white/5 text-white/70 border-white/10'
                        }`}>
                        🧪 {inv.items.name}
                        <span className="opacity-50">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {curaItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Cura — ripristina HP (salta turno)</p>
                  <div className="flex flex-wrap gap-2">
                    {curaItems.map(inv => (
                      <button key={inv.id}
                        onClick={() => handleHeal(inv.id)}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border bg-[#34D399]/15 text-[#34D399] border-[#34D399]/40 disabled:opacity-40">
                        💚 {inv.items.name}
                        {inv.items.effect_value > 0 && <span>+{inv.items.effect_value}%</span>}
                        <span className="opacity-50">×{inv.quantity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACTION BUTTONS ─────────────────────────────────── */}
      {!result && (
        <div className="grid grid-cols-4 gap-2 px-3 pb-3">
          <button onClick={handleCatch} disabled={loading}
            className="relative bg-[#E85D2F] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50 flex flex-col items-center gap-0.5">
            <span>🎯</span>
            <span className="text-xs">CATTURA</span>
            {(state.catchBonus > 0 || selectedReteId) && (
              <span className="text-[10px] text-[#F7C841]">
                +{Math.round((state.catchBonus + (reteItems.find(i => i.id === selectedReteId)?.items.effect_value ?? 0) / 100) * 100)}%
              </span>
            )}
          </button>
          <button id="wc-fight-btn" onClick={handleFight}
            disabled={loading || state.turns >= 5}
            className="bg-[#7B4DB8] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50 flex flex-col items-center gap-0.5">
            <span>⚔️</span>
            <span className="text-xs">LOTTA</span>
            <span className="text-[10px] text-white/50">{state.turns}/5</span>
          </button>
          {hasItems && (
            <button onClick={() => setShowItems(v => !v)}
              className={`font-bold py-4 rounded-xl text-sm transition-all border flex flex-col items-center gap-0.5 ${
                showItems || selectedReteId || selectedBattagliaId
                  ? 'bg-[#F7C841]/20 text-[#F7C841] border-[#F7C841]/40'
                  : 'bg-white/5 text-white/60 border-white/10'
              }`}>
              <span>🎒</span>
              <span className="text-xs">{selectedReteId || selectedBattagliaId ? '1 selz.' : 'OGGETTI'}</span>
            </button>
          )}
          <button onClick={handleFlee}
            className={`bg-white/8 text-white font-bold py-4 rounded-xl text-sm flex flex-col items-center gap-0.5 ${hasItems ? '' : 'col-span-2'}`}>
            <span>🏃</span>
            <span className="text-xs">FUGGI</span>
          </button>
        </div>
      )}

      {/* Result overlay */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="text-2xl font-bold text-white mb-4">
            {result === 'caught' ? '✅ Catturato!' : result === 'evolved' ? '✨ Evoluzione!' : '💨 Fuggita'}
          </p>
          <button
            onClick={() => router.push('/game/map')}
            className="bg-[#3A9DBC] text-white font-bold py-3 px-8 rounded-xl"
          >
            Continua
          </button>
        </motion.div>
      )}
    </div>
  )
}
