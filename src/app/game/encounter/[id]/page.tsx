'use client'
import { useState, useEffect, useMemo } from 'react'
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
  const [selectedReteId, setSelectedReteId] = useState<string | null>(null)
  const [selectedBattagliaId, setSelectedBattagliaId] = useState<string | null>(null)
  const [showItems, setShowItems] = useState(false)

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

  async function handleFight() {
    if (!state || loading) return
    setLoading(true)
    setMessage('')
    setShowItems(false)

    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId, itemId: selectedBattagliaId }),
    })
    const data = await res.json()
    setSelectedBattagliaId(null)
    // Remove used item from local list
    if (selectedBattagliaId) {
      setBattagliaItems(prev => prev.map(i => i.id === selectedBattagliaId
        ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
    }

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
  const hasItems = reteItems.length > 0 || battagliaItems.length > 0

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0F1F2E] to-[#1A3A2E] p-4">
      {/* Creature header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white">{state.creature.name}</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-lg">{elementEmoji}</span>
          <span className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
            style={{ backgroundColor: rarityColor }}>
            {state.creature.rarity}
          </span>
        </div>
      </div>

      {/* Creature sprite */}
      <div className="flex-1 flex items-center justify-center">
        <CreatureSprite
          imageUrl={state.creature.image_url ?? ''}
          name={state.creature.name ?? ''}
          animState={animState}
          size={240}
        />
      </div>

      {/* HP bar */}
      <div className="mb-4">
        <HPBar current={state.wildHp} max={state.wildHpMax} label="HP Creatura" />
      </div>

      {/* Player creature HP bar */}
      {playerCreature && playerHp !== null && (
        <div className="mb-3">
          <HPBar
            current={playerHp}
            max={playerCreature.maxHp}
            label={`${ELEMENT_EMOJI[playerCreature.element as keyof typeof ELEMENT_EMOJI] ?? ''} ${playerCreature.name}`}
          />
        </div>
      )}

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center text-sm text-[#F7C841] mb-3"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Items panel (slide-up) */}
      <AnimatePresence>
        {showItems && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="mb-3 rounded-2xl border border-white/10 bg-[#0A1520]/90 p-3 space-y-3"
          >
            {reteItems.length > 0 && (
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Reti — bonus cattura</p>
                <div className="flex flex-wrap gap-2">
                  {reteItems.map(inv => (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedReteId(prev => prev === inv.id ? null : inv.id)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border ${
                        selectedReteId === inv.id
                          ? 'bg-[#3A9DBC] text-white border-[#3A9DBC]'
                          : 'bg-white/5 text-white/70 border-white/10'
                      }`}
                    >
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
                    <button
                      key={inv.id}
                      onClick={() => setSelectedBattagliaId(prev => prev === inv.id ? null : inv.id)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all border ${
                        selectedBattagliaId === inv.id
                          ? 'bg-[#FBBF24] text-[#0F1F2E] border-[#FBBF24]'
                          : 'bg-white/5 text-white/70 border-white/10'
                      }`}
                    >
                      ⚔️ {inv.items.name}
                      {inv.items.effect_value > 0 && <span className="text-[#FBBF24]">+{inv.items.effect_value}%</span>}
                      <span className="opacity-50">×{inv.quantity}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!result && (
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={handleCatch}
            disabled={loading}
            className="relative bg-[#E85D2F] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            🎯 CATTURA
            {(state.catchBonus > 0 || selectedReteId) && (
              <div className="text-xs text-[#F7C841]">
                +{Math.round((state.catchBonus + (reteItems.find(i => i.id === selectedReteId)?.items.effect_value ?? 0) / 100) * 100)}%
              </div>
            )}
          </button>
          <button
            onClick={handleFight}
            disabled={loading || state.turns >= 5}
            className="bg-[#7B4DB8] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            ⚔️ LOTTA
            <div className="text-xs text-white/70">{state.turns}/5</div>
          </button>
          {hasItems && (
            <button
              onClick={() => setShowItems(v => !v)}
              className={`font-bold py-4 rounded-xl text-sm transition-all border ${
                showItems || selectedReteId || selectedBattagliaId
                  ? 'bg-[#F7C841]/20 text-[#F7C841] border-[#F7C841]/40'
                  : 'bg-white/5 text-white/60 border-white/10'
              }`}
            >
              🎒 {selectedReteId || selectedBattagliaId ? '1 item' : 'OGGETTI'}
            </button>
          )}
          <button
            onClick={handleFlee}
            className={`bg-white/10 text-white font-bold py-4 rounded-xl text-sm ${hasItems ? '' : 'col-span-2'}`}
          >
            🏃 FUGGI
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
