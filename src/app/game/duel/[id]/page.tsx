'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'

export default function DuelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [duel, setDuel] = useState<any>(null)
  const [myHp, setMyHp] = useState(100)
  const [opponentHp, setOpponentHp] = useState(100)
  const [myHpMax, setMyHpMax] = useState(100)
  const [opponentHpMax, setOpponentHpMax] = useState(100)
  const [log, setLog] = useState<string[]>([])
  const [waiting, setWaiting] = useState(true)
  const [result, setResult] = useState<'won' | 'lost' | null>(null)
  const [animState, setAnimState] = useState<'idle' | 'attack' | 'damage'>('idle')
  const [userId, setUserId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<'challenger' | 'opponent' | null>(null)
  const realtimeUpdatedRef = useRef(false)
  const surrenderedRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // Fetch duel data and determine player role together
    supabase
      .from('duels')
      .select('*, challenger_creature:player_creatures!challenger_creature_id(*, creatures(*)), opponent_creature:player_creatures!opponent_creature_id(*, creatures(*))')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        setDuel(data)
        if (!realtimeUpdatedRef.current) setWaiting(data.status === 'waiting')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const role = data.challenger_id === user.id ? 'challenger' : 'opponent'
        setMyRole(role)

        const myCrData = role === 'challenger'
          ? (data as any).challenger_creature?.creatures
          : (data as any).opponent_creature?.creatures
        const oppCrData = role === 'challenger'
          ? (data as any).opponent_creature?.creatures
          : (data as any).challenger_creature?.creatures

        if (myCrData) { setMyHp(myCrData.hp); setMyHpMax(myCrData.hp) }
        if (oppCrData) { setOpponentHp(oppCrData.hp); setOpponentHpMax(oppCrData.hp) }
      })

    // Subscribe to duel actions
    const channel = supabase
      .channel(`duel:${id}`)
      .on('broadcast', { event: 'duel_action' }, ({ payload }) => {
        const { actorId, damage } = payload
        // If I am the attacker, opponent takes damage; if I am defender, I take damage
        setUserId(currentId => {
          if (actorId === currentId) {
            setOpponentHp(prev => Math.max(0, prev - damage))
            setAnimState('attack')
          } else {
            setMyHp(prev => Math.max(0, prev - damage))
            setAnimState('damage')
          }
          return currentId
        })
        setTimeout(() => setAnimState('idle'), 400)
        setLog(prev => [`💥 Danno: ${damage}`, ...prev.slice(0, 4)])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${id}` },
        ({ new: updated }) => {
          if (updated.status === 'ended') {
            supabase.auth.getUser().then(({ data: { user } }) => {
              setResult(updated.winner_id === user?.id ? 'won' : 'lost')
            })
          }
          realtimeUpdatedRef.current = true
          setWaiting(updated.status === 'waiting')
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, supabase])

  // When my HP reaches 0, auto-surrender so the server ends the duel and awards EXP
  useEffect(() => {
    if (myHp === 0 && !result && !waiting && !surrenderedRef.current) {
      surrenderedRef.current = true
      fetch('/api/game/duel/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duelId: id, action: 'surrender' }),
      })
    }
  }, [myHp, result, waiting, id])

  async function handleAttack() {
    await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: id, action: 'attack' }),
    })
  }

  async function handleSurrender() {
    await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: id, action: 'surrender' }),
    })
  }

  const myCr = myRole === 'opponent'
    ? duel?.opponent_creature?.creatures
    : duel?.challenger_creature?.creatures
  const oppCr = myRole === 'opponent'
    ? duel?.challenger_creature?.creatures
    : duel?.opponent_creature?.creatures

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0F1F2E] via-[#1A1A2E] to-[#0F1F2E] p-4">
      {waiting && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0F1F2E]/90 z-20">
          <div className="text-center">
            <p className="text-xl font-bold text-white mb-2">In attesa dell&apos;avversario...</p>
            <p className="text-[#3A9DBC] text-sm">Codice stanza: <span className="font-mono text-xl">{duel?.room_code}</span></p>
          </div>
        </div>
      )}

      {/* Opponent */}
      <div className="text-center mb-2">
        <p className="text-sm text-white/50">Avversario</p>
        {oppCr && <HPBar current={opponentHp} max={opponentHpMax} label={oppCr.name} />}
      </div>

      <div className="flex justify-around flex-1 items-center">
        <div className="opacity-70">
          {oppCr && <CreatureSprite imageUrl={oppCr.image_url} name={oppCr.name} animState="idle" size={140} />}
        </div>
        <div className="text-4xl font-bold text-white/20">VS</div>
        <div>
          {myCr && <CreatureSprite imageUrl={myCr.image_url} name={myCr.name} animState={animState} size={140} />}
        </div>
      </div>

      {/* My HP */}
      <div className="mb-4">
        <p className="text-sm text-white/50 mb-1 text-right">La tua creatura</p>
        {myCr && <HPBar current={myHp} max={myHpMax} label={myCr.name} />}
      </div>

      {/* Log */}
      <div className="h-12 overflow-hidden mb-3">
        {log.map((l, i) => (
          <p key={i} className="text-xs text-white/60 text-center">{l}</p>
        ))}
      </div>

      {/* Actions */}
      {!result && !waiting && (
        <div className="flex gap-2">
          <button onClick={handleAttack} className="flex-1 bg-[#E85D2F] text-white font-bold py-4 rounded-xl">⚔️ ATTACCA</button>
          <button onClick={handleSurrender} className="bg-white/10 text-white px-4 rounded-xl">🏳️</button>
        </div>
      )}

      {result && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <p className="text-3xl font-bold text-white mb-1">
            {result === 'won' ? '🏆 Vittoria!' : '💀 Sconfitta'}
          </p>
          <p className={`text-xl font-bold mb-5 ${result === 'won' ? 'text-[#34D399]' : 'text-white/40'}`}>
            +{result === 'won' ? 15 : 5} EXP
          </p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
              router.push('/game/map')
            }}
            className="bg-[#3A9DBC] text-white font-bold py-3 px-8 rounded-xl"
          >
            Torna alla Mappa
          </button>
        </motion.div>
      )}
    </div>
  )
}
