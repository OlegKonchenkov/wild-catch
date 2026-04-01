'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
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

  const myActive    = myLineup.find(l => l.is_active)
  const oppActive   = oppLineup.find(l => l.is_active)
  const myActiveCr  = myActive?.player_creatures?.creatures
  const oppActiveCr = oppActive?.player_creatures?.creatures
  const myHp        = myActive?.current_hp ?? 0
  const myHpMax     = myActiveCr?.hp ?? 100
  const oppHp       = oppActive?.current_hp ?? 0
  const oppHpMax    = oppActiveCr?.hp ?? 100

  const myHpPct  = Math.max(0, (myHp / myHpMax) * 100)
  const oppHpPct = Math.max(0, (oppHp / oppHpMax) * 100)

  const hpBarColor = (pct: number) => pct > 50 ? '#34D399' : pct > 25 ? '#FBBF24' : '#EF4444'

  const turnColor = isMyTurn ? '#34D399' : '#64748b'
  const turnLabel = isMyTurn ? 'Il tuo turno' : 'Turno avversario'

  const oppRarityColor = oppActiveCr ? RARITY_COLORS[oppActiveCr.rarity] : '#64748b'
  const myRarityColor  = myActiveCr  ? RARITY_COLORS[myActiveCr.rarity]  : '#3A9DBC'

  return (
    <div className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'linear-gradient(180deg, #060C18 0%, #0D1828 45%, #060C18 100%)' }}>

      {/* ── Atmospheric glows ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 opacity-20 blur-3xl rounded-full"
          style={{ background: oppRarityColor }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-40 opacity-18 blur-3xl rounded-full"
          style={{ background: myRarityColor }} />
      </div>

      {/* ── Waiting overlay ── */}
      <AnimatePresence>
        {waiting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-30"
            style={{ background: 'rgba(6,12,24,0.95)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ border: '2px solid rgba(232,93,47,0.4)', boxShadow: '0 0 30px rgba(232,93,47,0.3)' }}>
                ⚔️
              </div>
            </motion.div>
            <p className="text-xl font-extrabold text-white mb-1">In attesa...</p>
            <p className="text-white/40 text-sm mb-6">L'avversario sta per entrare</p>
            {duel?.room_code && (
              <div className="rounded-2xl px-6 py-4 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
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

      {/* ── Result overlay ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-30 px-6"
            style={{ background: 'rgba(6,12,24,0.96)', backdropFilter: 'blur(14px)' }}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="text-7xl mb-5">{result === 'won' ? '🏆' : '💀'}</div>
              <p className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                {result === 'won' ? 'Vittoria!' : 'Sconfitta'}
              </p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                style={{
                  background: result === 'won' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${result === 'won' ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                <span className="font-extrabold text-base" style={{ color: result === 'won' ? '#34D399' : 'rgba(255,255,255,0.35)' }}>
                  {result === 'won' ? '+30 EXP · +20 punti' : '0 EXP'}
                </span>
              </div>
              <motion.button
                onClick={() => { window.dispatchEvent(new CustomEvent('wc:refresh-stats')); router.push('/game/map') }}
                whileTap={{ scale: 0.96 }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{ background: 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)', boxShadow: '0 4px 20px rgba(58,157,188,0.35)' }}
              >
                Torna alla Mappa
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OPPONENT ZONE (top ~42%) ── */}
      <div className="relative z-10 shrink-0" style={{ height: '42%' }}>

        {/* Opponent sprite — top-right */}
        <div className="absolute top-3 right-3 z-10">
          <motion.div className="relative">
            <AnimatePresence>
              {lastDamage?.target === 'opp' && (
                <motion.div
                  key={`opp-dmg-${lastDamage.amount}`}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -30, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 font-extrabold text-[#E85D2F] text-xl pointer-events-none z-20"
                  style={{ textShadow: '0 0 12px rgba(232,93,47,0.9)' }}
                >
                  -{lastDamage.amount}
                </motion.div>
              )}
            </AnimatePresence>
            {oppActiveCr ? (
              <CreatureSprite
                imageUrl={oppActiveCr.image_url}
                name={oppActiveCr.name}
                animState={oppAnimState}
                size={125}
                element={oppActiveCr.element}
                rarity={oppActiveCr.rarity}
                showAura
              />
            ) : (
              <div className="w-[125px] h-[125px] rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
          </motion.div>
        </div>

        {/* Opponent info card — bottom-left of opponent zone */}
        <div className="absolute bottom-3 left-4 z-10" style={{ maxWidth: 'calc(55%)' }}>
          {oppActiveCr ? (
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(6,12,24,0.90)',
                border: `1px solid ${oppRarityColor}40`,
                backdropFilter: 'blur(12px)',
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${oppRarityColor}15`,
              }}>
              <div className="px-3 pt-2.5 pb-2.5">
                {/* Lineup dots */}
                <div className="flex items-center gap-1 mb-1.5">
                  <p className="text-[9px] text-white/25 uppercase tracking-wider flex-1">Avversario</p>
                  <div className="flex gap-1">
                    {[...oppLineup].sort((a, b) => a.slot - b.slot).map(entry => {
                      const cr = entry.player_creatures?.creatures
                      const color = cr ? RARITY_COLORS[cr.rarity] : '#64748b'
                      const isFainted = !!entry.fainted_at
                      return (
                        <div key={entry.id} className="w-2 h-2 rounded-full"
                          style={{
                            background: isFainted ? 'rgba(255,255,255,0.1)' : color,
                            opacity: isFainted ? 0.3 : entry.is_active ? 1 : 0.55,
                            boxShadow: entry.is_active ? `0 0 4px ${color}` : 'none',
                          }} />
                      )
                    })}
                  </div>
                </div>
                <p className="font-extrabold text-white text-sm leading-tight truncate mb-1.5 tracking-wide">
                  {oppActiveCr.name}
                </p>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${oppRarityColor}25`, color: oppRarityColor, border: `1px solid ${oppRarityColor}50` }}>
                    {oppActiveCr.rarity?.replace('_', ' ')}
                  </span>
                  <span className="text-xs">{ELEMENT_EMOJI[oppActiveCr.element]}</span>
                  <span className="text-[10px] text-white/35 capitalize">{oppActiveCr.element}</span>
                </div>
                {/* HP bar */}
                <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${oppHpPct}%` }}
                    transition={{ duration: 0.5 }}
                    style={{
                      background: hpBarColor(oppHpPct),
                      boxShadow: `0 0 8px ${hpBarColor(oppHpPct)}80`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">HP</span>
                  <span className="text-[10px] font-mono font-bold text-white/45">{oppHp}/{oppHpMax}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-24 w-44 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          )}
        </div>
      </div>

      {/* ── SEPARATOR ── */}
      <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-1">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
        <AnimatePresence mode="wait">
          {switchNotice ? (
            <motion.div key="switch" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-[#C084FC]"
              style={{ background: 'rgba(123,77,184,0.18)', border: '1px solid rgba(123,77,184,0.4)' }}>
              ✨ {switchNotice}
            </motion.div>
          ) : (
            <motion.div key={isMyTurn ? 'my' : 'opp'} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: `${turnColor}15`, border: `1px solid ${turnColor}40` }}>
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: turnColor }}
                animate={isMyTurn ? { scale: [1, 1.5, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-[10px] font-bold" style={{ color: turnColor }}>{turnLabel}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Battle log */}
        <AnimatePresence>
          {log[0] && (
            <motion.span key={log[0] + log.length} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="text-[10px] font-semibold text-white/35">
              {log[0]}
            </motion.span>
          )}
        </AnimatePresence>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
      </div>

      {/* ── PLAYER ZONE (~38%) ── */}
      <div className="relative z-10 shrink-0" style={{ height: '38%' }}>

        {/* Player sprite — bottom-left */}
        <div className="absolute bottom-2 left-3 z-10">
          <motion.div className="relative">
            <AnimatePresence>
              {lastDamage?.target === 'me' && (
                <motion.div
                  key={`me-dmg-${lastDamage.amount}`}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -30, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 font-extrabold text-red-400 text-xl pointer-events-none z-20"
                  style={{ textShadow: '0 0 12px rgba(248,113,113,0.9)' }}
                >
                  -{lastDamage.amount}
                </motion.div>
              )}
            </AnimatePresence>
            {myActiveCr ? (
              <CreatureSprite
                imageUrl={myActiveCr.image_url}
                name={myActiveCr.name}
                animState={animState}
                size={130}
                element={myActiveCr.element}
                rarity={myActiveCr.rarity}
                showAura
              />
            ) : (
              <div className="w-[130px] h-[130px] rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
          </motion.div>
        </div>

        {/* Player info card — top-right of player zone */}
        <div className="absolute top-3 right-4 z-10" style={{ maxWidth: 'calc(55%)' }}>
          {myActiveCr ? (
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(6,12,24,0.90)',
                border: `1px solid ${myRarityColor}40`,
                backdropFilter: 'blur(12px)',
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${myRarityColor}15`,
              }}>
              <div className="px-3 pt-2.5 pb-2.5">
                {/* Lineup dots */}
                <div className="flex items-center gap-1 mb-1.5 justify-end">
                  <div className="flex gap-1">
                    {[...myLineup].sort((a, b) => a.slot - b.slot).map(entry => {
                      const cr = entry.player_creatures?.creatures
                      const color = cr ? RARITY_COLORS[cr.rarity] : '#3A9DBC'
                      const isFainted = !!entry.fainted_at
                      return (
                        <div key={entry.id} className="w-2 h-2 rounded-full"
                          style={{
                            background: isFainted ? 'rgba(255,255,255,0.1)' : color,
                            opacity: isFainted ? 0.3 : entry.is_active ? 1 : 0.55,
                            boxShadow: entry.is_active ? `0 0 4px ${color}` : 'none',
                          }} />
                      )
                    })}
                  </div>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider">Tu</p>
                </div>
                <p className="font-extrabold text-white text-sm leading-tight truncate mb-1.5 tracking-wide text-right">
                  {myActiveCr.name}
                </p>
                <div className="flex items-center gap-1.5 mb-2 justify-end">
                  <span className="text-[10px] text-white/35 capitalize">{myActiveCr.element}</span>
                  <span className="text-xs">{ELEMENT_EMOJI[myActiveCr.element]}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${myRarityColor}25`, color: myRarityColor, border: `1px solid ${myRarityColor}50` }}>
                    {myActiveCr.rarity?.replace('_', ' ')}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${myHpPct}%` }}
                    transition={{ duration: 0.5 }}
                    style={{
                      background: hpBarColor(myHpPct),
                      boxShadow: `0 0 8px ${hpBarColor(myHpPct)}80`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">HP</span>
                  <span className="text-[10px] font-mono font-bold text-white/45">{myHp}/{myHpMax}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-24 w-44 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          )}
        </div>
      </div>

      {/* ── ACTIONS ── */}
      {!result && !waiting && (
        <div className="shrink-0 px-4 pb-4 pt-1 z-10 flex flex-col gap-2">

          {/* Battaglia items */}
          <AnimatePresence>
            {showItems && battagliaItems.length > 0 && isMyTurn && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="flex flex-col gap-1.5 pb-1">
                  {battagliaItems.map(item => (
                    <button key={item.inventoryId}
                      onClick={() => setSelectedItemId(selectedItemId === item.inventoryId ? null : item.inventoryId)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                      style={{
                        background: selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selectedItemId === item.inventoryId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                      <span className="text-lg">⚔️</span>
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

          <div className="flex gap-2">
            {/* Items toggle */}
            {battagliaItems.length > 0 && (
              <motion.button
                onClick={() => { if (isMyTurn) setShowItems(s => !s) }}
                whileTap={{ scale: 0.95 }}
                className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  background: showItems ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${showItems ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.09)'}`,
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
              className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base disabled:cursor-not-allowed transition-all"
              style={{
                background: isMyTurn
                  ? selectedItemId
                    ? 'linear-gradient(135deg, #FBBF24 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: isMyTurn && !attacking
                  ? selectedItemId ? '0 4px 20px rgba(251,191,36,0.35)' : '0 4px 20px rgba(232,93,47,0.4)'
                  : 'none',
                border: !isMyTurn ? '1px solid rgba(255,255,255,0.08)' : 'none',
                opacity: attacking ? 0.7 : 1,
              }}
            >
              {attacking ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isMyTurn ? (
                <span className="flex items-center justify-center gap-2">
                  ⚔️ {selectedItemId ? 'Attacca (+ATK)' : 'Attacca'}
                </span>
              ) : (
                <span className="text-white/35 text-sm">In attesa del tuo turno...</span>
              )}
            </motion.button>

            {/* Surrender */}
            <motion.button
              onClick={handleSurrender}
              whileTap={{ scale: 0.95 }}
              className="w-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
