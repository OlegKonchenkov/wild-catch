'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Element, Rarity } from '@/lib/types'

interface LineupEntry {
  id: string
  user_id: string
  slot: number
  player_creature_id: string
  current_hp: number
  is_active: boolean
  fainted_at: string | null
  player_creatures: {
    creatures: {
      name: string
      element: Element
      rarity: Rarity
      hp: number
      atk: number
      image_url: string
    }
  }
}

interface BattagliaItem {
  inventoryId: string
  name: string
  effectValue: number
  quantity: number
}

export default function DuelPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [duel, setDuel]                     = useState<any>(null)
  const [myLineup, setMyLineup]             = useState<LineupEntry[]>([])
  const [oppLineup, setOppLineup]           = useState<LineupEntry[]>([])
  const [log, setLog]                       = useState<string[]>([])
  const [waiting, setWaiting]               = useState(true)
  const [result, setResult]                 = useState<'won' | 'lost' | null>(null)
  const [animState, setAnimState]           = useState<'idle' | 'attack' | 'damage'>('idle')
  const [oppAnimState, setOppAnimState]     = useState<'idle' | 'attack' | 'damage'>('idle')
  const [userId, setUserId]                 = useState<string | null>(null)
  const [myRole, setMyRole]                 = useState<'challenger' | 'opponent' | null>(null)
  const [isMyTurn, setIsMyTurn]             = useState(false)
  const [attacking, setAttacking]           = useState(false)
  const [lastDamage, setLastDamage]         = useState<{ amount: number; target: 'me' | 'opp' } | null>(null)
  const [battagliaItems, setBattagliaItems] = useState<BattagliaItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showItems, setShowItems]           = useState(false)
  const [switchNotice, setSwitchNotice]     = useState<string | null>(null)

  const realtimeUpdatedRef = useRef(false)
  const surrenderedRef     = useRef(false)
  const duelStatusRef      = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Load duel + lineups + role
  useEffect(() => {
    async function init() {
      const { data: duelData } = await supabase
        .from('duels')
        .select('*')
        .eq('id', id)
        .single()

      if (!duelData) return
      setDuel(duelData)
      duelStatusRef.current = duelData.status
      if (!realtimeUpdatedRef.current) setWaiting(duelData.status === 'waiting')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const role: 'challenger' | 'opponent' = duelData.challenger_id === user.id ? 'challenger' : 'opponent'
      setMyRole(role)

      if (duelData.status === 'active') setIsMyTurn(role === 'challenger')

      // Load lineups
      const { data: lineups } = await supabase
        .from('duel_lineups')
        .select('*, player_creatures(*, creatures(name, element, rarity, hp, atk, image_url))')
        .eq('duel_id', id)
        .order('slot', { ascending: true })

      if (lineups) {
        const mine = lineups.filter((l: LineupEntry) => l.user_id === user.id)
        const opp  = lineups.filter((l: LineupEntry) => l.user_id !== user.id)
        setMyLineup(mine)
        setOppLineup(opp)
      }

      // Load battaglia items
      const sessionId = localStorage.getItem('current_session_id')
      if (sessionId) {
        const { data: inv } = await supabase
          .from('player_inventory')
          .select('id, quantity, items(name, effect_value, type)')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .gt('quantity', 0)
        const filtered = ((inv ?? []) as any[])
          .filter(r => r.items?.type === 'battaglia')
          .map(r => ({ inventoryId: r.id, name: r.items.name, effectValue: r.items.effect_value, quantity: r.quantity }))
        setBattagliaItems(filtered)
      }
    }

    init()

    // Realtime: broadcast duel_action
    const channel = supabase
      .channel(`duel:${id}`)
      .on('broadcast', { event: 'duel_action' }, ({ payload }) => {
        const { actorId, damage, nextTurn, itemUsed, switchedTo } = payload

        setUserId(currentId => {
          const iAttacked = actorId === currentId
          if (iAttacked) {
            setOppAnimState('damage')
            setLastDamage({ amount: damage, target: 'opp' })
            setTimeout(() => { setOppAnimState('idle'); setLastDamage(null) }, 700)
          } else {
            setAnimState('damage')
            setLastDamage({ amount: damage, target: 'me' })
            setTimeout(() => { setAnimState('idle'); setLastDamage(null) }, 700)
          }
          if (nextTurn && currentId) {
            setMyRole(role => { setIsMyTurn(nextTurn === role); return role })
          }
          return currentId
        })

        if (switchedTo) {
          setSwitchNotice(`${switchedTo.name} entra in battaglia!`)
          setTimeout(() => setSwitchNotice(null), 2500)
        }

        const atkLabel = itemUsed ? '⚔️+🗡️' : '⚔️'
        setLog(prev => [`${atkLabel} ${damage} danno!`, ...prev.slice(0, 3)])
      })
      // Realtime lineup HP updates
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duel_lineups', filter: `duel_id=eq.${id}` },
        ({ new: updated }) => {
          const updateLineup = (prev: LineupEntry[]) =>
            prev.map(l => l.id === updated.id ? { ...l, ...updated } : l)
          setMyLineup(prev => {
            if (prev.some(l => l.id === updated.id)) return updateLineup(prev)
            return prev
          })
          setOppLineup(prev => {
            if (prev.some(l => l.id === updated.id)) return updateLineup(prev)
            return prev
          })
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${id}` },
        ({ new: updated }) => {
          duelStatusRef.current = updated.status
          if (updated.status === 'ended') {
            supabase.auth.getUser().then(({ data: { user } }) => {
              setResult(updated.winner_id === user?.id ? 'won' : 'lost')
              setIsMyTurn(false)
              window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
            })
          }
          realtimeUpdatedRef.current = true
          setWaiting(updated.status === 'waiting')

          if (updated.status === 'active' && updated.current_turn) {
            setMyRole(role => { setIsMyTurn(updated.current_turn === role); return role })
          }
        })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      // Cancel the duel if player leaves while still waiting
      if (duelStatusRef.current === 'waiting') {
        fetch('/api/game/duel/connect', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duelId: id }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [id, supabase])

  // Auto-surrender when all my creatures faint
  useEffect(() => {
    if (myLineup.length === 0 || result || waiting || surrenderedRef.current) return
    const allFainted = myLineup.length > 0 && myLineup.every(l => l.fainted_at !== null)
    if (allFainted) {
      surrenderedRef.current = true
      setIsMyTurn(false)
      fetch('/api/game/duel/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duelId: id, action: 'surrender' }),
      })
    }
  }, [myLineup, result, waiting, id])

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

  const myActive  = myLineup.find(l => l.is_active)
  const oppActive = oppLineup.find(l => l.is_active)
  const myActiveCr  = myActive?.player_creatures?.creatures
  const oppActiveCr = oppActive?.player_creatures?.creatures
  const myHp        = myActive?.current_hp ?? 0
  const myHpMax     = myActiveCr?.hp ?? 100
  const oppHp       = oppActive?.current_hp ?? 0
  const oppHpMax    = oppActiveCr?.hp ?? 100

  const turnColor = isMyTurn ? '#34D399' : '#94a3b8'
  const turnLabel = isMyTurn ? 'Il tuo turno' : 'Turno avversario'

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
              <div className="w-20 h-20 rounded-full border-2 border-[#E85D2F]/40 flex items-center justify-center text-4xl"
                style={{ boxShadow: '0 0 30px rgba(232,93,47,0.3)' }}>
                ⚔️
              </div>
            </motion.div>
            <p className="text-xl font-extrabold text-white mb-1">In attesa...</p>
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
                  +{result === 'won' ? '30 EXP · +20 punti' : '0 EXP'}
                </span>
              </div>
              <button
                onClick={() => { window.dispatchEvent(new CustomEvent('wc:refresh-stats')); router.push('/game/map') }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base cursor-pointer active:scale-[0.97] transition-transform"
                style={{ background: 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)', boxShadow: '0 4px 20px rgba(58,157,188,0.35)' }}
              >
                Torna alla Mappa
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OPPONENT SECTION ── */}
      <div className="flex-none px-4 pt-3 pb-1 relative z-10">
        {/* Opponent lineup bar */}
        <LineupBar lineup={oppLineup} label="Avversario" />
        {/* Opponent active creature HP */}
        <div className="mt-2">
          {oppActiveCr
            ? <HPBar current={oppHp} max={oppHpMax} label={oppActiveCr.name} />
            : <div className="h-4 bg-white/5 rounded-full animate-pulse" />
          }
        </div>
      </div>

      {/* Opponent sprite */}
      <div className="flex-none flex justify-center pt-1 relative z-10">
        <motion.div
          animate={
            oppAnimState === 'damage' ? { x: [0, 8, -8, 6, -6, 0], transition: { duration: 0.35 } } :
            oppAnimState === 'attack' ? { y: [0, 6, 0],            transition: { duration: 0.25 } } : {}
          }
          className="relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={oppActive?.id ?? 'opp-loading'}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              {oppActiveCr
                ? <CreatureSprite
                    imageUrl={oppActiveCr.image_url}
                    name={oppActiveCr.name}
                    animState={oppAnimState}
                    size={100}
                    element={oppActiveCr.element}
                    rarity={oppActiveCr.rarity}
                    showAura
                  />
                : <div className="w-[100px] h-[100px] rounded-full bg-white/5 animate-pulse" />
              }
            </motion.div>
          </AnimatePresence>
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

      {/* Turn indicator + Switch notice */}
      <div className="flex-none flex items-center gap-3 px-4 py-1 relative z-10">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
        <AnimatePresence mode="wait">
          {switchNotice ? (
            <motion.div
              key="switch"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7B4DB8]/20 border border-[#7B4DB8]/40"
            >
              <span className="text-[10px] font-bold text-[#C084FC]">✨ {switchNotice}</span>
            </motion.div>
          ) : (
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
          )}
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
      <div className="flex-none flex justify-center pt-1 relative z-10">
        <motion.div
          animate={
            animState === 'damage' ? { x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.35 } } :
            animState === 'attack' ? { y: [0, -6, 0],            transition: { duration: 0.25 } } : {}
          }
          className="relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={myActive?.id ?? 'my-loading'}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              {myActiveCr
                ? <CreatureSprite
                    imageUrl={myActiveCr.image_url}
                    name={myActiveCr.name}
                    animState={animState}
                    size={120}
                    element={myActiveCr.element}
                    rarity={myActiveCr.rarity}
                    showAura
                  />
                : <div className="w-[120px] h-[120px] rounded-full bg-white/5 animate-pulse" />
              }
            </motion.div>
          </AnimatePresence>
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

      {/* ── MY SECTION ── */}
      <div className="flex-none px-4 pt-1 pb-2 relative z-10">
        {myActiveCr
          ? <HPBar current={myHp} max={myHpMax} label={myActiveCr.name} />
          : <div className="h-4 bg-white/5 rounded-full animate-pulse" />
        }
        <div className="mt-1.5">
          <LineupBar lineup={myLineup} label="La tua squadra" reverse />
        </div>
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
                <span className="text-lg leading-none">🗡️</span>
                {selectedItemId && <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />}
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
                  <>⚔️ {selectedItemId ? 'Attacca (+ATK)' : 'Attacca'}</>
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

// ── Lineup bar component ───────────────────────────────────────────────────────
function LineupBar({ lineup, label, reverse }: {
  lineup: LineupEntry[]
  label: string
  reverse?: boolean
}) {
  if (lineup.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-[9px] text-white/25 uppercase tracking-widest">{label}</p>
        <div className="flex gap-1">
          {[1,2,3].map(i => <div key={i} className="w-4 h-4 rounded-full bg-white/5 animate-pulse" />)}
        </div>
      </div>
    )
  }

  const sorted = [...lineup].sort((a, b) => a.slot - b.slot)

  return (
    <div className={`flex items-center gap-2 ${reverse ? 'flex-row-reverse' : ''}`}>
      <p className="text-[9px] text-white/25 uppercase tracking-widest shrink-0">{label}</p>
      <div className={`flex gap-1.5 ${reverse ? 'flex-row-reverse' : ''}`}>
        {sorted.map(entry => {
          const cr = entry.player_creatures?.creatures
          const color = cr ? RARITY_COLORS[cr.rarity] : '#94a3b8'
          const isFainted = !!entry.fainted_at
          const isActive  = entry.is_active
          const hpPct = cr ? Math.max(0, (entry.current_hp / cr.hp) * 100) : 0

          return (
            <div
              key={entry.id}
              className="relative w-5 h-5 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: isFainted ? 'rgba(255,255,255,0.05)' : `${color}30`,
                border: `1.5px solid ${isActive ? color : isFainted ? 'rgba(255,255,255,0.1)' : color + '60'}`,
                boxShadow: isActive ? `0 0 6px ${color}80` : 'none',
                opacity: isFainted ? 0.4 : 1,
              }}
              title={cr?.name ?? `Slot ${entry.slot}`}
            >
              {isFainted ? (
                <span className="text-[8px] text-white/30 font-bold">✕</span>
              ) : (
                <span className="text-[7px]" style={{ color }}>
                  {Math.round(hpPct)}
                </span>
              )}
              {/* HP fill indicator along bottom */}
              {!isFainted && (
                <div
                  className="absolute bottom-0 left-0 h-[3px] transition-all duration-500"
                  style={{ width: `${hpPct}%`, background: hpPct > 50 ? '#34D399' : hpPct > 25 ? '#FBBF24' : '#EF4444' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
