'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [oppAnimState, setOppAnimState] = useState<'idle' | 'attack' | 'damage'>('idle')
  const [userId, setUserId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<'challenger' | 'opponent' | null>(null)
  const [attacking, setAttacking] = useState(false)
  const [lastDamage, setLastDamage] = useState<number | null>(null)
  const realtimeUpdatedRef = useRef(false)
  const surrenderedRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
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

    const channel = supabase
      .channel(`duel:${id}`)
      .on('broadcast', { event: 'duel_action' }, ({ payload }) => {
        const { actorId, damage } = payload
        setUserId(currentId => {
          if (actorId === currentId) {
            setOpponentHp(prev => Math.max(0, prev - damage))
            setOppAnimState('damage')
            setLastDamage(damage)
            setTimeout(() => { setOppAnimState('idle'); setLastDamage(null) }, 600)
          } else {
            setMyHp(prev => Math.max(0, prev - damage))
            setAnimState('damage')
            setLastDamage(damage)
            setTimeout(() => { setAnimState('idle'); setLastDamage(null) }, 600)
          }
          return currentId
        })
        setLog(prev => [`💥 ${damage} danno!`, ...prev.slice(0, 3)])
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
    if (attacking) return
    setAttacking(true)
    setAnimState('attack')
    setTimeout(() => setAnimState('idle'), 400)
    await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: id, action: 'attack' }),
    })
    setAttacking(false)
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
    <div className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #111827 50%, #0a0f1a 100%)' }}>

      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full opacity-15 blur-3xl"
          style={{ background: '#7B4DB8' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full opacity-15 blur-3xl"
          style={{ background: '#E85D2F' }} />
      </div>

      {/* Waiting overlay */}
      <AnimatePresence>
        {waiting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-30"
            style={{ background: 'rgba(10,15,26,0.95)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6"
            >
              <div className="w-20 h-20 rounded-full border-2 border-[#E85D2F]/40 flex items-center justify-center"
                style={{ boxShadow: '0 0 30px rgba(232,93,47,0.3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#E85D2F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                  <path d="M14.5 17.5L3 6V3h3l11.5 11.5M16.5 15.5l1.5 1.5M8 2l4 4M2 8l4 4M5 15l-2 2 2 2 2-2M15 5l2-2 2 2-2 2"/>
                </svg>
              </div>
            </motion.div>
            <p className="text-xl font-extrabold text-white mb-2">In attesa...</p>
            <p className="text-white/40 text-sm mb-6">L'avversario sta per entrare</p>
            {duel?.room_code && (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center">
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

      {/* Result overlay */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-30"
            style={{ background: 'rgba(10,15,26,0.96)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-center px-6"
            >
              <div className="text-6xl mb-4">{result === 'won' ? '🏆' : '💀'}</div>
              <p className="text-3xl font-extrabold text-white mb-2">
                {result === 'won' ? 'Vittoria!' : 'Sconfitta'}
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                style={{
                  background: result === 'won' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${result === 'won' ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                <span className="text-xl font-extrabold" style={{ color: result === 'won' ? '#34D399' : 'rgba(255,255,255,0.4)' }}>
                  +{result === 'won' ? 15 : 5} EXP
                </span>
              </div>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
                  router.push('/game/map')
                }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base cursor-pointer active:scale-[0.97] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)',
                  boxShadow: '0 4px 20px rgba(58,157,188,0.35)',
                }}
              >
                Torna alla Mappa
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OPPONENT SECTION (top) ── */}
      <div className="flex-none px-4 pt-4 pb-2 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/30 uppercase tracking-widest">Avversario</p>
          {oppCr && (
            <p className="text-xs font-bold text-white/50 truncate max-w-[120px]">{oppCr.name}</p>
          )}
        </div>
        {oppCr ? (
          <HPBar current={opponentHp} max={opponentHpMax} label="" />
        ) : (
          <div className="h-4 bg-white/5 rounded-full animate-pulse" />
        )}
      </div>

      {/* Opponent sprite */}
      <div className="flex-none flex justify-center py-2 relative z-10">
        <motion.div
          animate={
            oppAnimState === 'damage'
              ? { x: [0, 8, -8, 6, -6, 0], transition: { duration: 0.35 } }
              : oppAnimState === 'attack'
              ? { y: [0, 6, 0], transition: { duration: 0.25 } }
              : {}
          }
          className="relative"
        >
          {oppCr ? (
            <CreatureSprite imageUrl={oppCr.image_url} name={oppCr.name} animState={oppAnimState} size={110} />
          ) : (
            <div className="w-[110px] h-[110px] rounded-full bg-white/5 animate-pulse" />
          )}
          <AnimatePresence>
            {lastDamage !== null && animState !== 'damage' && (
              <motion.div
                key={lastDamage + 'opp'}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -30, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute -top-2 left-1/2 -translate-x-1/2 font-extrabold text-[#E85D2F] text-lg pointer-events-none"
                style={{ textShadow: '0 0 10px rgba(232,93,47,0.8)' }}
              >
                -{lastDamage}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* VS divider */}
      <div className="flex-none flex items-center gap-3 px-6 py-1 relative z-10">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08))' }} />
        <span className="text-xs font-bold text-white/15 tracking-widest">VS</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)' }} />
      </div>

      {/* Battle log */}
      <div className="flex-none px-4 h-8 overflow-hidden relative z-10">
        <AnimatePresence>
          {log[0] && (
            <motion.p
              key={log[0]}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-center font-semibold text-white/50"
            >
              {log[0]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Player sprite */}
      <div className="flex-none flex justify-center py-2 relative z-10">
        <motion.div
          animate={
            animState === 'damage'
              ? { x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.35 } }
              : animState === 'attack'
              ? { y: [0, -6, 0], transition: { duration: 0.25 } }
              : {}
          }
          className="relative"
        >
          {myCr ? (
            <CreatureSprite imageUrl={myCr.image_url} name={myCr.name} animState={animState} size={130} />
          ) : (
            <div className="w-[130px] h-[130px] rounded-full bg-white/5 animate-pulse" />
          )}
          <AnimatePresence>
            {lastDamage !== null && animState === 'damage' && (
              <motion.div
                key={lastDamage + 'me'}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -30, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute -top-2 left-1/2 -translate-x-1/2 font-extrabold text-red-400 text-lg pointer-events-none"
                style={{ textShadow: '0 0 10px rgba(248,113,113,0.8)' }}
              >
                -{lastDamage}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── PLAYER SECTION (bottom) ── */}
      <div className="flex-none px-4 pt-2 pb-2 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/30 uppercase tracking-widest">La tua creatura</p>
          {myCr && (
            <p className="text-xs font-bold text-white/50 truncate max-w-[120px]">{myCr.name}</p>
          )}
        </div>
        {myCr ? (
          <HPBar current={myHp} max={myHpMax} label="" />
        ) : (
          <div className="h-4 bg-white/5 rounded-full animate-pulse" />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-none px-4 pb-4 pt-2 relative z-10">
        {!result && !waiting && (
          <div className="flex gap-2">
            <motion.button
              onClick={handleAttack}
              disabled={attacking}
              whileTap={{ scale: 0.95 }}
              className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base cursor-pointer disabled:opacity-60"
              style={{
                background: attacking
                  ? 'linear-gradient(135deg, #c04a22 0%, #a03a18 100%)'
                  : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
                boxShadow: attacking ? 'none' : '0 4px 20px rgba(232,93,47,0.4)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {attacking ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M14.5 17.5L3 6V3h3l11.5 11.5M16.5 15.5l1.5 1.5M8 2l4 4M2 8l4 4M5 15l-2 2 2 2 2-2M15 5l2-2 2 2-2 2"/>
                    </svg>
                    Attacca
                  </>
                )}
              </span>
            </motion.button>
            <motion.button
              onClick={handleSurrender}
              whileTap={{ scale: 0.95 }}
              className="w-14 rounded-2xl flex items-center justify-center cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
