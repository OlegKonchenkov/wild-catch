'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'
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

export default function EncounterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [state, setState] = useState<EncounterState | null>(null)
  const [animState, setAnimState] = useState<'idle' | 'attack' | 'damage' | 'catch' | 'flee'>('idle')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'caught' | 'fled' | 'evolved' | null>(null)

  useEffect(() => {
    // Load encounter from sessionStorage (set by map page when encounter triggered)
    const stored = sessionStorage.getItem(`encounter_${id}`)
    if (stored) setState(JSON.parse(stored))
  }, [id])

  async function handleFight() {
    if (!state || loading) return
    setLoading(true)
    setMessage('')

    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId }),
    })
    const data = await res.json()

    if (!res.ok) { setMessage(data.error); setLoading(false); return }

    if (data.playerTookDamage) {
      setAnimState('damage')
      await new Promise(r => setTimeout(r, 400))
    }
    setAnimState('idle')

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

    setLoading(false)
  }

  async function handleCatch() {
    if (!state || loading) return
    setLoading(true)

    const res = await fetch('/api/game/encounter/catch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId }),
    })
    const data = await res.json()

    if (data.caught) {
      setAnimState('catch')
      await new Promise(r => setTimeout(r, 700))
      setResult(data.evolved ? 'evolved' : 'caught')
      setMessage(data.evolved ? '✨ Evoluzione!' : '✅ Catturato!')
    } else {
      setAnimState('flee')
      setMessage('La creatura è fuggita...')
      setResult('fled')
    }
    setLoading(false)
  }

  function handleFlee() {
    router.back()
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        Caricamento incontro...
      </div>
    )
  }

  const rarityColor = RARITY_COLORS[state.creature.rarity ?? 'comune']
  const elementEmoji = ELEMENT_EMOJI[state.creature.element ?? 'fiamma']

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

      {/* Action buttons */}
      {!result && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCatch}
            disabled={loading}
            className="bg-[#E85D2F] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            🎯 CATTURA
            {state.catchBonus > 0 && (
              <div className="text-xs text-[#F7C841]">+{Math.round(state.catchBonus * 100)}%</div>
            )}
          </button>
          <button
            onClick={handleFight}
            disabled={loading || state.turns >= 5}
            className="bg-[#7B4DB8] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            ⚔️ COMBATTI
            <div className="text-xs text-white/70">{state.turns}/5</div>
          </button>
          <button
            onClick={handleFlee}
            className="bg-white/10 text-white font-bold py-4 rounded-xl text-sm"
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
