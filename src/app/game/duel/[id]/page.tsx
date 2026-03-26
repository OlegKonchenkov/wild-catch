'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'

interface BattagliaItem {
  inventoryId: string
  name: string
  effectValue: number
  quantity: number
}

export default function DuelPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [duel, setDuel]                 = useState<any>(null)
  const [myHp, setMyHp]                 = useState(100)
  const [opponentHp, setOpponentHp]     = useState(100)
  const [myHpMax, setMyHpMax]           = useState(100)
  const [opponentHpMax, setOpponentHpMax] = useState(100)
  const [log, setLog]                   = useState<string[]>([])
  const [waiting, setWaiting]           = useState(true)
  const [result, setResult]             = useState<'won' | 'lost' | null>(null)
  const [animState, setAnimState]       = useState<'idle' | 'attack' | 'damage'>('idle')
  const [oppAnimState, setOppAnimState] = useState<'idle' | 'attack' | 'damage'>('idle')
  const [userId, setUserId]             = useState<string | null>(null)
  const [myRole, setMyRole]             = useState<'challenger' | 'opponent' | null>(null)
  const [isMyTurn, setIsMyTurn]         = useState(false)
  const [attacking, setAttacking]       = useState(false)
  const [lastDamage, setLastDamage]     = useState<{ amount: number; target: 'me' | 'opp' } | null>(null)
  const [battagliaItems, setBattagliaItems] = useState<BattagliaItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showItems, setShowItems]       = useState(false)

  const realtimeUpdatedRef = useRef(false)
  const surrenderedRef     = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  // Load duel + determine role
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

        const myCrData  = role === 'challenger' ? (data as any).challenger_creature?.creatures : (data as any).opponent_creature?.creatures
        const oppCrData = role === 'challenger' ? (data as any).opponent_creature?.creatures   : (data as any).challenger_creature?.creatures

        if (myCrData)  { setMyHp(myCrData.hp);  setMyHpMax(myCrData.hp) }
        if (oppCrData) { setOpponentHp(oppCrData.hp); setOpponentHpMax(oppCrData.hp) }

        // Challenger always goes first
        if (data.status === 'active') {
          setIsMyTurn(role === 'challenger')
        }

        // Load battaglia items for this session
        const sessionId = localStorage.getItem('current_session_id')
        if (sessionId) {
          const { data: inv } = await supabase
            .from('player_inventory')
            .select('id, quantity, items(name, effect_value, type)')
            .eq('user_id', user.id)
            .eq('session_id', sessionId)
            .gt('quantity', 0)
          const filtered = (inv ?? [])
            .filter((r: any) => r.items?.type === 'battaglia')
            .map((r: any) => ({
              inventoryId: r.id,
              name: r.items.name,
              effectValue: r.items.effect_value,
              quantity: r.quantity,
            }))
          setBattagliaItems(filtered)
        }
      })

    const channel = supabase
      .channel(`duel:${id}`)
      .on('broadcast', { event: 'duel_action' }, ({ payload }) => {
        const { actorId, damage, nextTurn, itemUsed } = payload

        setUserId(currentId => {
          const iAttacked = actorId === currentId
          if (iAttacked) {
            setOpponentHp(prev => Math.max(0, prev - damage))
            setOppAnimState('damage')
            setLastDamage({ amount: damage, target: 'opp' })
            setTimeout(() => { setOppAnimState('idle'); setLastDamage(null) }, 700)
          } else {
            setMyHp(prev => Math.max(0, prev - damage))
            setAnimState('damage')
            setLastDamage({ amount: damage, target: 'me' })
            setTimeout(() => { setAnimState('idle'); setLastDamage(null) }, 700)
          }

          // Update turn based on nextTurn from server
          if (nextTurn && currentId) {
            setMyRole(role => {
              setIsMyTurn(nextTurn === role)
              return role
            })
          }

          return currentId
        })

        const atkLabel = itemUsed ? '⚔️+🗡️' : '⚔️'
        setLog(prev => [`${atkLabel} ${damage} danno!`, ...prev.slice(0, 3)])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${id}` },
        ({ new: updated }) => {
          if (updated.status === 'ended') {
            supabase.auth.getUser().then(({ data: { user } }) => {
              setResult(updated.winner_id === user?.id ? 'won' : 'lost')
              setIsMyTurn(false)
              window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
            })
          }
          realtimeUpdatedRef.current = true
          setWaiting(updated.status === 'waiting')

          // Sync turn from DB update (covers the joiner)
          if (updated.status === 'active' && updated.current_turn) {
            setMyRole(role => {
              setIsMyTurn(updated.current_turn === role)
              return role
            })
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, supabase])

  // Auto-surrender when my HP hits 0
  useEffect(() => {
    if (myHp === 0 && !result && !waiting && !surrenderedRef.current) {
      surrenderedRef.current = true
      setIsMyTurn(false)
      fetch('/api/game/duel/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duelId: id, action: 'surrender' }),
      })
    }
  }, [myHp, result, waiting, id])

  async function handleAttack() {
    if (attacking || !isMyTurn) return
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
      if (data.duelOver) window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
    }

    // If item was used, decrement local count and clear selection
    if (selectedItemId && res.ok) {
      setBattagliaItems(prev => prev
        .map(it => it.inventoryId === selectedItemId ? { ...it, quantity: it.quantity - 1 } : it)
        .filter(it => it.quantity > 0)
      )
      setSelectedItemId(null)
      setShowItems(false)
    }

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

  const myCr  = myRole === 'opponent' ? duel?.opponent_creature?.creatures  : duel?.challenger_creature?.creatures
  const oppCr = myRole === 'opponent' ? duel?.challenger_creature?.creatures : duel?.opponent_creature?.creatures

  const turnLabel = isMyTurn ? 'Il tuo turno' : 'Turno avversario'
  const turnColor = isMyTurn ? '#34D399' : '#94a3b8'

  return (
    <div className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #111827 50%, #0a0f1a 100%)' }}>

      {/* Ambient glow */}
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

      {/* ── OPPONENT ── */}
      <div className="flex-none px-4 pt-4 pb-1 relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-white/30 uppercase tracking-widest">Avversario</p>
          {oppCr && <p className="text-xs font-bold text-white/40 truncate max-w-[140px]">{oppCr.name}</p>}
        </div>
        {oppCr
          ? <HPBar current={opponentHp} max={opponentHpMax} label="" />
          : <div className="h-4 bg-white/5 rounded-full animate-pulse" />
        }
      </div>

      {/* Opponent sprite */}
      <div className="flex-none flex justify-center pt-1 pb-1 relative z-10">
        <motion.div
          animate={
            oppAnimState === 'damage' ? { x: [0, 8, -8, 6, -6, 0], transition: { duration: 0.35 } } :
            oppAnimState === 'attack' ? { y: [0, 6, 0],             transition: { duration: 0.25 } } : {}
          }
          className="relative"
        >
          {oppCr
            ? <CreatureSprite imageUrl={oppCr.image_url} name={oppCr.name} animState={oppAnimState} size={100} />
            : <div className="w-[100px] h-[100px] rounded-full bg-white/5 animate-pulse" />
          }
          <AnimatePresence>
            {lastDamage?.target === 'opp' && (
              <motion.div
                key={`opp-${lastDamage.amount}`}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -28, scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65 }}
                className="absolute -top-1 left-1/2 -translate-x-1/2 font-extrabold text-[#E85D2F] text-lg pointer-events-none"
                style={{ textShadow: '0 0 10px rgba(232,93,47,0.8)' }}
              >
                -{lastDamage.amount}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Turn indicator + VS */}
      <div className="flex-none flex items-center gap-3 px-4 py-1 relative z-10">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
        <AnimatePresence mode="wait">
          <motion.div
            key={isMyTurn ? 'my' : 'opp'}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: `${turnColor}18`, border: `1px solid ${turnColor}40` }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: turnColor }} />
            <span className="text-[10px] font-bold" style={{ color: turnColor }}>{turnLabel}</span>
          </motion.div>
        </AnimatePresence>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
      </div>

      {/* Battle log */}
      <div className="flex-none px-4 h-7 overflow-hidden relative z-10">
        <AnimatePresence>
          {log[0] && (
            <motion.p
              key={log[0] + log.length}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-center font-semibold text-white/45"
            >
              {log[0]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Player sprite */}
      <div className="flex-none flex justify-center pt-1 pb-1 relative z-10">
        <motion.div
          animate={
            animState === 'damage' ? { x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.35 } } :
            animState === 'attack' ? { y: [0, -6, 0],            transition: { duration: 0.25 } } : {}
          }
          className="relative"
        >
          {myCr
            ? <CreatureSprite imageUrl={myCr.image_url} name={myCr.name} animState={animState} size={120} />
            : <div className="w-[120px] h-[120px] rounded-full bg-white/5 animate-pulse" />
          }
          <AnimatePresence>
            {lastDamage?.target === 'me' && (
              <motion.div
                key={`me-${lastDamage.amount}`}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -28, scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65 }}
                className="absolute -top-1 left-1/2 -translate-x-1/2 font-extrabold text-red-400 text-lg pointer-events-none"
                style={{ textShadow: '0 0 10px rgba(248,113,113,0.8)' }}
              >
                -{lastDamage.amount}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── MY HP ── */}
      <div className="flex-none px-4 pt-1 pb-2 relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-white/30 uppercase tracking-widest">La tua creatura</p>
          {myCr && <p className="text-xs font-bold text-white/40 truncate max-w-[140px]">{myCr.name}</p>}
        </div>
        {myCr
          ? <HPBar current={myHp} max={myHpMax} label="" />
          : <div className="h-4 bg-white/5 rounded-full animate-pulse" />
        }
      </div>

      {/* ── ACTIONS ── */}
      {!result && !waiting && (
        <div className="flex-none px-4 pb-4 pt-1 relative z-10 flex flex-col gap-2">

          {/* Battaglia items picker */}
          {battagliaItems.length > 0 && isMyTurn && (
            <AnimatePresence>
              {showItems && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-1.5 pb-1">
                    {battagliaItems.map(item => (
                      <button
                        key={item.inventoryId}
                        onClick={() => setSelectedItemId(selectedItemId === item.inventoryId ? null : item.inventoryId)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer"
                        style={{
                          background: selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        <span className="text-xl">⚔️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-[#FBBF24]">+{item.effectValue}% ATK</p>
                        </div>
                        <span className="text-xs text-white/30 shrink-0">×{item.quantity}</span>
                        {selectedItemId === item.inventoryId && (
                          <div className="w-4 h-4 rounded-full bg-[#FBBF24] flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 12 12" fill="white" className="w-2.5 h-2.5">
                              <path d="M2 6l2.5 2.5L10 3.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <div className="flex gap-2">
            {/* Items toggle */}
            {battagliaItems.length > 0 && (
              <motion.button
                onClick={() => { if (isMyTurn) setShowItems(s => !s) }}
                whileTap={{ scale: 0.95 }}
                className="w-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all"
                style={{
                  background: showItems ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${showItems ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  opacity: isMyTurn ? 1 : 0.4,
                }}
              >
                <span className="text-lg leading-none">⚔️</span>
                {selectedItemId && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                )}
              </motion.button>
            )}

            {/* Attack button */}
            <motion.button
              onClick={handleAttack}
              disabled={attacking || !isMyTurn}
              whileTap={isMyTurn ? { scale: 0.95 } : {}}
              className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base cursor-pointer disabled:cursor-not-allowed transition-all"
              style={{
                background: isMyTurn
                  ? selectedItemId
                    ? 'linear-gradient(135deg, #FBBF24 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: isMyTurn && !attacking
                  ? selectedItemId ? '0 4px 20px rgba(251,191,36,0.35)' : '0 4px 20px rgba(232,93,47,0.4)'
                  : 'none',
                opacity: attacking ? 0.7 : 1,
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {attacking ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isMyTurn ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M14.5 17.5L3 6V3h3l11.5 11.5M16.5 15.5l1.5 1.5M8 2l4 4M2 8l4 4M5 15l-2 2 2 2 2-2M15 5l2-2 2 2-2 2"/>
                    </svg>
                    {selectedItemId ? 'Attacca (+ATK)' : 'Attacca'}
                  </>
                ) : (
                  <span className="text-white/40 text-sm">In attesa...</span>
                )}
              </span>
            </motion.button>

            {/* Surrender */}
            <motion.button
              onClick={handleSurrender}
              whileTap={{ scale: 0.95 }}
              className="w-14 rounded-2xl flex items-center justify-center cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}
