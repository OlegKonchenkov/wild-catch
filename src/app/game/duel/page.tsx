'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Rarity, Element } from '@/lib/types'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { motion, AnimatePresence } from 'framer-motion'

interface SquadCreature {
  playerCreatureId: string
  name: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  image_url: string
}

export default function DuelLobbyPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [creatures, setCreatures] = useState<SquadCreature[]>([])
  const [lineup, setLineup] = useState<(SquadCreature | null)[]>([null, null, null])
  const [noCreatures, setNoCreatures] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingCreatures, setLoadingCreatures] = useState(true)

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoadingCreatures(false); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadingCreatures(false); return }
      supabase
        .from('player_creatures')
        .select('id, creatures(name, element, rarity, hp, atk, image_url)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .then(({ data }) => {
          if (!data || data.length === 0) { setNoCreatures(true); setLoadingCreatures(false); return }
          const mapped: SquadCreature[] = (data as any[])
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
          setCreatures(mapped)
          if (mapped.length === 0) setNoCreatures(true)
          setLoadingCreatures(false)
        })
    })
  }, [supabase])

  function toggleCreature(creature: SquadCreature) {
    setLineup(prev => {
      const idx = prev.findIndex(c => c?.playerCreatureId === creature.playerCreatureId)
      if (idx !== -1) {
        // Remove from lineup, compact
        const next = prev.filter((_, i) => i !== idx)
        return [...next, null] as (SquadCreature | null)[]
      }
      // Add to first empty slot
      const emptyIdx = prev.findIndex(c => c === null)
      if (emptyIdx === -1) return prev
      const next = [...prev]
      next[emptyIdx] = creature
      return next
    })
  }

  function removeSlot(slotIdx: number) {
    setLineup(prev => {
      const next = prev.filter((_, i) => i !== slotIdx)
      return [...next, null] as (SquadCreature | null)[]
    })
  }

  async function connect(roomCode?: string) {
    const sessionId = localStorage.getItem('current_session_id')
    const filledLineup = lineup.filter(Boolean) as SquadCreature[]
    if (!sessionId || filledLineup.length !== 3 || loading) return
    setLoading(true)
    setError(null)
    try {
      const lineupPayload = filledLineup.map((cr, i) => ({
        playerCreatureId: cr.playerCreatureId,
        slot: i + 1,
      }))
      const body: Record<string, unknown> = { sessionId, lineup: lineupPayload }
      if (roomCode) body.roomCode = roomCode.toUpperCase()
      const res = await fetch('/api/game/duel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/game/duel/${data.duelId}`)
      } else {
        setError(data.error ?? 'Errore connessione')
        setLoading(false)
      }
    } catch {
      setError('Errore di rete')
      setLoading(false)
    }
  }

  const lineupFull = lineup.every(c => c !== null)

  if (noCreatures) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 mx-auto text-4xl">⚔️</div>
        </motion.div>
        <p className="text-white font-bold text-lg">Nessuna creatura disponibile</p>
        <p className="text-white/50 text-sm leading-relaxed">Cattura almeno 3 creature prima di sfidare qualcuno.</p>
        <button onClick={() => router.push('/game/map')}
          className="bg-[#3A9DBC] text-white font-bold py-3 px-6 rounded-xl cursor-pointer active:scale-95 transition-transform">
          Vai alla Mappa
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-2">
        <p className="text-xs text-[#E85D2F] font-bold tracking-widest uppercase mb-0.5">Arena 3v3</p>
        <h1 className="text-xl font-extrabold text-white">Seleziona la tua squadra</h1>
      </div>

      {/* Lineup slots — top 3 */}
      <div className="flex-none px-4 pb-3">
        <div className="flex gap-2">
          {lineup.map((cr, i) => {
            const color = cr ? RARITY_COLORS[cr.rarity] : null
            return (
              <button
                key={i}
                onClick={() => cr && removeSlot(i)}
                className="flex-1 rounded-2xl transition-all overflow-hidden"
                style={{
                  background: color ? `${color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${color ? color + '50' : 'rgba(255,255,255,0.08)'}`,
                  minHeight: 76,
                }}
              >
                {cr ? (
                  <div className="flex flex-col items-center py-1.5 gap-0.5">
                    <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">#{i + 1}</span>
                    <CreatureSprite imageUrl={cr.image_url} name={cr.name} animState="idle" size={42} />
                    <span className="text-[9px] text-white/60 truncate w-full text-center px-1 leading-tight">{cr.name}</span>
                    <span className="text-[8px] text-white/25 font-mono">HP {cr.hp}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[76px] gap-1">
                    <span className="text-2xl text-white/10">+</span>
                    <span className="text-[9px] text-white/20">Slot {i + 1}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <AnimatePresence>
          {lineupFull && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[10px] text-[#34D399] text-center mt-1.5 font-semibold"
            >
              Squadra pronta! Tocca uno slot per sostituire.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Creature picker list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        {loadingCreatures ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {creatures.map(cr => {
              const slotIdx = lineup.findIndex(l => l?.playerCreatureId === cr.playerCreatureId)
              const inLineup = slotIdx !== -1
              const canAdd = !inLineup && !lineupFull
              const rarityColor = RARITY_COLORS[cr.rarity]
              return (
                <motion.button
                  key={cr.playerCreatureId}
                  onClick={() => (canAdd || inLineup) ? toggleCreature(cr) : undefined}
                  whileTap={canAdd || inLineup ? { scale: 0.97 } : {}}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left"
                  style={{
                    background: inLineup ? `${rarityColor}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${inLineup ? rarityColor + '55' : 'rgba(255,255,255,0.08)'}`,
                    opacity: canAdd || inLineup ? 1 : 0.35,
                    cursor: canAdd || inLineup ? 'pointer' : 'default',
                  }}
                >
                  <CreatureSprite imageUrl={cr.image_url} name={cr.name} animState="idle" size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{cr.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]">{ELEMENT_EMOJI[cr.element]}</span>
                      <span className="text-[10px] text-white/35">HP {cr.hp} · ATK {cr.atk}</span>
                    </div>
                  </div>
                  {inLineup ? (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                      style={{ background: rarityColor }}
                    >
                      {slotIdx + 1}
                    </div>
                  ) : canAdd ? (
                    <div className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-white/25 text-xl shrink-0">
                      +
                    </div>
                  ) : null}
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* Connect section */}
      <div className="flex-none px-4 pb-4 pt-2 space-y-2 border-t border-white/8">
        <button
          onClick={() => connect()}
          disabled={!lineupFull || loading}
          className="w-full rounded-2xl py-4 font-extrabold text-white text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
          style={{
            background: lineupFull ? 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)' : 'rgba(255,255,255,0.06)',
            boxShadow: lineupFull && !loading ? '0 4px 20px rgba(232,93,47,0.4)' : 'none',
          }}
        >
          {loading && !joinCode ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <span className="flex items-center justify-center gap-2">⚔️ Crea Sfida</span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/25 text-xs">oppure unisciti con codice</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)); setError(null) }}
            placeholder="A B C D"
            maxLength={4}
            autoCapitalize="characters"
            inputMode="text"
            className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white font-mono text-xl text-center tracking-[0.5em] placeholder-white/15 focus:outline-none focus:border-[#3A9DBC] transition-colors"
          />
          <button
            onClick={() => connect(joinCode)}
            disabled={joinCode.length < 4 || !lineupFull || loading}
            className="px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
            style={{
              background: joinCode.length === 4 && lineupFull ? 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)' : 'rgba(255,255,255,0.05)',
              color: joinCode.length === 4 && lineupFull ? 'white' : 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {loading && joinCode.length === 4 ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : 'Entra'}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
