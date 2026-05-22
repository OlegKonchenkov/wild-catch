'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { RARITY_COLORS } from '@/lib/types'
import type { Rarity, Element } from '@/lib/types'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import CreatureRosterRow from '@/components/game/CreatureRosterRow'
import { motion, AnimatePresence } from 'framer-motion'
import { scaleCombatStats } from '@/lib/game/combat'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'

interface HistoryEntry {
  id: string
  type: 'duel' | 'boss'
  date: string
  result: 'won' | 'lost' | 'unknown'
  label: string
  detail?: string
}

function useHistory(supabase: ReturnType<typeof createClient>) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sessionId = localStorage.getItem('current_session_id')
      const user = await getCurrentUser(supabase)
      if (!user || !sessionId) { setLoading(false); return }

      const [duelsRes, bossRes] = await Promise.all([
        supabase
          .from('duels')
          .select('id, status, winner_id, challenger_id, opponent_id, started_at, ended_at, room_code')
          .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
          .eq('session_id', sessionId)
          .in('status', ['ended', 'cancelled'])
          .order('ended_at', { ascending: false })
          .limit(30),
        supabase
          .from('boss_fights')
          .select('id, status, reward_claimed, started_at, ended_at, boss_lineup')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .in('status', ['won', 'lost'])
          .order('ended_at', { ascending: false })
          .limit(20),
      ])

      // Resolve opponent nicknames for duels
      interface DuelRow { id: string; status: string; winner_id: string | null; challenger_id: string; opponent_id: string | null; started_at: string | null; ended_at: string | null; room_code: string | null }
      const duels = (duelsRes.data ?? []) as DuelRow[]
      const opponentIds = Array.from(new Set(
        duels.map(d => d.challenger_id === user.id ? d.opponent_id : d.challenger_id).filter((v): v is string => Boolean(v))
      ))
      const nicknameMap: Record<string, string> = {}
      if (opponentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nickname')
          .in('user_id', opponentIds)
        for (const p of (profiles ?? []) as Array<{ user_id: string; nickname: string | null }>) {
          if (p.nickname) nicknameMap[p.user_id] = p.nickname
        }
      }

      const duelEntries: HistoryEntry[] = duels.map(d => {
        const oppId = d.challenger_id === user.id ? d.opponent_id : d.challenger_id
        const oppNick = oppId ? nicknameMap[oppId] : null
        const isCancelled = d.status === 'cancelled' || (d.status === 'ended' && !d.winner_id)
        return {
          id: d.id,
          type: 'duel',
          date: d.ended_at ?? d.started_at ?? '',
          result: isCancelled ? 'unknown' : (d.winner_id === user.id ? 'won' : 'lost'),
          label: oppNick ? `⚔️ vs ${oppNick}` : `Duello · ${d.room_code ?? '—'}`,
          detail: isCancelled ? 'Annullato' : d.winner_id === user.id ? 'Vittoria' : 'Sconfitta',
        }
      })

      const bossEntries: HistoryEntry[] = (bossRes.data ?? []).map((b: any) => {
        const bossName = b.boss_lineup?.[0]?.name ?? 'Boss'
        return {
          id: b.id,
          type: 'boss',
          date: b.ended_at ?? b.started_at ?? '',
          result: b.status === 'won' ? 'won' : 'lost',
          label: `👑 ${bossName}`,
          detail: b.status === 'won' ? 'Vittoria' : 'Sconfitta',
        }
      })

      const combined = [...duelEntries, ...bossEntries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setHistory(combined)
      setLoading(false)
    }
    load()
  }, [supabase])

  return { history, loading }
}

interface SquadCreature {
  playerCreatureId: string
  name: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  def: number
  image_url: string
  sprite_cutout_url?: string | null
  sprite_url?: string | null
}

export default function DuelLobbyPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<'arena' | 'storico'>('arena')
  const [creatures, setCreatures] = useState<SquadCreature[]>([])
  const [lineup, setLineup] = useState<(SquadCreature | null)[]>([null, null, null])
  const [noCreatures, setNoCreatures] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCreatures, setLoadingCreatures] = useState(true)
  const { toast, showApiError, dismiss } = useGameToast()
  const [pendingConnect, setPendingConnect] = useState<{ roomCode?: string } | null>(null)
  const [playerLevel, setPlayerLevel] = useState(1)
  const { history, loading: historyLoading } = useHistory(supabase)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [activeDuel, setActiveDuel] = useState<{ id: string; roomCode: string | null } | null>(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [duelLineupCache, setDuelLineupCache] = useState<Record<string, { userId: string; slot: number; name: string; rarity: string; element: string }[]>>({})

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    getCurrentUser(supabase).then(user => {
      if (!user || !sessionId) { setLoadingCreatures(false); return }
      setMyUserId(user.id)
      // Check for an active duel the user can rejoin
      supabase.from('duels').select('id, room_code')
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .eq('session_id', sessionId)
        .in('status', ['waiting', 'active'])
        .order('started_at', { ascending: false })
        .limit(1).maybeSingle()
        .then(({ data: d }) => { if (d) setActiveDuel({ id: d.id, roomCode: d.room_code }) })
      Promise.all([
        supabase
          .from('player_creatures')
          .select('id, creatures(name, element, rarity, hp, atk, def, image_url, sprite_cutout_url, sprite_url)')
          .eq('user_id', user.id)
          .eq('session_id', sessionId),
        supabase
          .from('player_sessions')
          .select('level')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .single(),
        supabase
          .from('creature_equipment')
          .select('player_creature_id, items(bonus_hp, bonus_atk, bonus_def)')
          .eq('user_id', user.id)
          .eq('session_id', sessionId),
      ]).then(([creaturesRes, levelRes, equipRes]) => {
        const data = creaturesRes.data
        if (levelRes.data) setPlayerLevel((levelRes.data as { level?: number | null }).level ?? 1)
          if (!data || data.length === 0) { setNoCreatures(true); setLoadingCreatures(false); return }
          const equipMap: Record<string, { hp: number; atk: number; def: number }> = {}
          for (const r of ((equipRes.data ?? []) as any[])) {
            const acc = equipMap[r.player_creature_id] ?? { hp: 0, atk: 0, def: 0 }
            acc.hp  += r.items?.bonus_hp  ?? 0
            acc.atk += r.items?.bonus_atk ?? 0
            acc.def += r.items?.bonus_def ?? 0
            equipMap[r.player_creature_id] = acc
          }
          const RARITY_ORDER = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']
          const mapped: SquadCreature[] = (data as any[])
            .filter(pc => pc.creatures)
            .map(pc => {
              const b = equipMap[pc.id] ?? { hp: 0, atk: 0, def: 0 }
              return {
              playerCreatureId: pc.id,
              name: pc.creatures.name,
              element: pc.creatures.element,
              rarity: pc.creatures.rarity,
              hp: pc.creatures.hp + b.hp,
              atk: pc.creatures.atk + b.atk,
              def: (pc.creatures.def ?? 0) + b.def,
              image_url: pc.creatures.image_url,
              sprite_cutout_url: pc.creatures.sprite_cutout_url ?? null,
              sprite_url: pc.creatures.sprite_url ?? null,
              }
            })
            .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
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
    if (!sessionId || filledLineup.length === 0 || loading) return
    // Warn when fewer than 3 creatures selected
    if (filledLineup.length < 3) {
      setPendingConnect({ roomCode })
      return
    }
    await doConnect(filledLineup, roomCode)
  }

  async function doConnect(filledLineup: SquadCreature[], roomCode?: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    setLoading(true)
    setPendingConnect(null)
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
        showApiError(res.status, data.error ?? 'Errore connessione')
        setLoading(false)
      }
    } catch {
      showApiError(0, 'Errore di rete')
      setLoading(false)
    }
  }

  const filledCount = lineup.filter(Boolean).length
  const lineupReady = filledCount >= 1

  const RARITY_DISPLAY: Record<string, { label: string; color: string }> = {
    comune:      { label: 'Terrestre',   color: '#7AB87A' },
    non_comune:  { label: 'Arcaico',     color: '#4A9FD4' },
    raro:        { label: 'Eroico',      color: '#E8A820' },
    epico:       { label: 'Mostruoso',   color: '#7B4DB8' },
    leggendario: { label: 'Leggendario', color: '#C8352A' },
    mitologico:  { label: 'Mitologico',  color: '#FF4D6D' },
  }

  async function loadDuelLineup(duelId: string) {
    if (duelLineupCache[duelId]) return
    const { data } = await supabase
      .from('duel_lineups')
      .select('user_id, slot, player_creatures(creatures(name, element, rarity))')
      .eq('duel_id', duelId)
      .order('slot', { ascending: true })
    if (data) {
      const mapped = (data as unknown as Array<{ user_id: string; slot: number; player_creatures: { creatures: { name: string; element: string; rarity: string } | null } | null }>).map(r => ({
        userId: r.user_id as string,
        slot: r.slot as number,
        name: (r.player_creatures?.creatures?.name ?? '?') as string,
        rarity: (r.player_creatures?.creatures?.rarity ?? '') as string,
        element: (r.player_creatures?.creatures?.element ?? '') as string,
      }))
      setDuelLineupCache(prev => ({ ...prev, [duelId]: mapped }))
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Toast — fixed above everything */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {/* Header + tabs — single compact row */}
      <div className="flex-none px-4 pt-3 pb-2 flex items-center gap-3">
        <h1 className="text-base font-extrabold text-white shrink-0 flex items-center gap-1.5">
          <span className="text-[#E85D2F]">⚔️</span> Duelli
        </h1>
        <div className="flex flex-1 gap-1 bg-white/5 rounded-xl p-1">
          {(['arena', 'storico'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
              style={{
                background: activeTab === tab ? 'rgba(232,93,47,0.9)' : 'transparent',
                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
              }}
            >
              {tab === 'arena' ? '⚔️ Arena' : '📜 Storico'}
            </button>
          ))}
        </div>
      </div>

      {/* Storico tab */}
      {activeTab === 'storico' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {historyLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-white/30 pt-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-512.png"
                alt=""
                style={{
                  width: 120, height: 120, objectFit: 'contain', opacity: 0.8,
                  WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 56%, transparent 76%)',
                  maskImage: 'radial-gradient(circle at 50% 50%, #000 56%, transparent 76%)',
                  filter: 'drop-shadow(0 5px 16px rgba(0,0,0,0.4))',
                }}
              />
              <p className="text-sm -mt-1">Nessun duello disputato</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(entry => {
                const isBoss = entry.type === 'boss'
                const isWon  = entry.result === 'won'
                const isLost = entry.result === 'lost'
                const time   = entry.date ? new Date(entry.date).toLocaleString('it-IT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                const isExpanded = expandedHistoryId === entry.id
                const cachedLineup = duelLineupCache[entry.id]
                const myCreatures  = cachedLineup?.filter(r => r.userId === myUserId) ?? []
                const oppCreatures = cachedLineup?.filter(r => r.userId !== myUserId) ?? []

                return (
                  <div key={entry.id} className="rounded-xl overflow-hidden" style={{
                    border: `1px solid ${isWon ? 'rgba(52,211,153,0.25)' : isLost ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    {/* Row header — clickable */}
                    <button
                      onClick={() => {
                        setExpandedHistoryId(isExpanded ? null : entry.id)
                        if (!isExpanded && entry.type === 'duel') loadDuelLineup(entry.id)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-white/5 transition-colors"
                      style={{ background: isWon ? 'rgba(52,211,153,0.08)' : isLost ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)' }}
                    >
                      <span className="text-2xl shrink-0">{isBoss ? '👑' : '⚔️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{entry.label}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{time}</p>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: isWon ? 'rgba(52,211,153,0.15)' : isLost ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                          color: isWon ? '#34D399' : isLost ? '#F87171' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {entry.detail}
                      </span>
                      <motion.span
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.18 }}
                        className="text-white/25 text-sm leading-none shrink-0 ml-1"
                      >›</motion.span>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1" style={{ background: isWon ? 'rgba(52,211,153,0.04)' : isLost ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)' }}>
                            {entry.type === 'duel' && (
                              <>
                                {!cachedLineup ? (
                                  <div className="flex gap-1.5 py-1">
                                    {[1,2,3].map(i => <div key={i} className="h-6 w-16 rounded-lg bg-white/5 animate-pulse" />)}
                                  </div>
                                ) : (
                                  <div className="space-y-2 mt-1">
                                    {/* My creatures */}
                                    {myCreatures.length > 0 && (
                                      <div>
                                        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">La tua squadra</p>
                                        <div className="flex flex-wrap gap-1">
                                          {myCreatures.map((cr, i) => {
                                            const rd = RARITY_DISPLAY[cr.rarity]
                                            return (
                                              <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                style={{ background: rd ? `${rd.color}18` : 'rgba(255,255,255,0.07)', color: rd?.color ?? 'rgba(255,255,255,0.5)', border: `1px solid ${rd ? rd.color + '35' : 'rgba(255,255,255,0.1)'}` }}>
                                                {cr.name}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {/* Opponent creatures */}
                                    {oppCreatures.length > 0 && (
                                      <div>
                                        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Avversario</p>
                                        <div className="flex flex-wrap gap-1">
                                          {oppCreatures.map((cr, i) => {
                                            const rd = RARITY_DISPLAY[cr.rarity]
                                            return (
                                              <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                {cr.name}
                                                {rd && <span className="ml-1 opacity-60" style={{ color: rd.color }}>·</span>}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {myCreatures.length === 0 && oppCreatures.length === 0 && (
                                      <p className="text-[11px] text-white/25">Dettagli squadra non disponibili</p>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                            {entry.type === 'boss' && (
                              <p className="text-[11px] text-white/40 mt-1">Sfida al Boss</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Rejoin banner */}
      <AnimatePresence>
        {activeDuel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mx-4 mb-2 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(232,93,47,0.12)', border: '1px solid rgba(232,93,47,0.35)' }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} className="text-xl shrink-0">⚔️</motion.div>
              <button onClick={() => router.push(`/game/duel/${activeDuel.id}`)} className="flex-1 text-left min-w-0">
                <p className="text-sm font-extrabold text-[#E85D2F]">Duello in corso</p>
                <p className="text-xs text-white/50 truncate">{activeDuel.roomCode ? `Stanza ${activeDuel.roomCode}` : 'Tocca per rientrare'}</p>
              </button>
              <button
                onClick={() => router.push(`/game/duel/${activeDuel.id}`)}
                className="text-xs font-bold text-[#E85D2F] shrink-0 px-2"
              >Rientra →</button>
              <button
                onClick={async () => {
                  const duelId = activeDuel.id
                  setActiveDuel(null)
                  await fetch('/api/game/duel/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duelId, action: 'surrender' }),
                  })
                }}
                className="text-xs font-bold shrink-0 px-2 py-1 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >Annulla</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arena tab content */}
      {activeTab === 'arena' && (<>

      {noCreatures ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 mx-auto text-4xl">⚔️</div>
          <p className="text-white font-bold text-lg">Nessuna creatura disponibile</p>
          <p className="text-white/50 text-sm leading-relaxed">Cattura almeno una creatura prima di sfidare qualcuno.</p>
          <button onClick={() => router.push('/game/map')}
            className="bg-[#3A9DBC] text-white font-bold py-3 px-6 rounded-xl cursor-pointer active:scale-95 transition-transform">
            Vai alla Mappa
          </button>
        </div>
      ) : (<>

      {/* Lineup slots — top 3 */}
      <div className="flex-none px-4 pb-3">
        <div className="flex gap-2">
          {lineup.map((cr, i) => {
            const color = cr ? RARITY_COLORS[cr.rarity] : null
            const scaled = cr ? scaleCombatStats({ hp: cr.hp, atk: cr.atk, def: cr.def }, playerLevel) : null
            return (
              <motion.button
                key={i}
                onClick={() => cr && removeSlot(i)}
                whileTap={cr ? { scale: 0.95 } : {}}
                className="flex-1 rounded-2xl transition-all overflow-hidden relative"
                style={{
                  background: color
                    ? `radial-gradient(circle at 50% 40%, ${color}28 0%, ${color}0e 60%, transparent 100%)`
                    : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${color ? color + '70' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: color ? `0 0 20px ${color}30, inset 0 0 12px ${color}10` : 'none',
                  minHeight: 88,
                }}
              >
                {cr ? (
                  <div className="flex flex-col items-center py-2 gap-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: color + 'aa' }}>#{i + 1}</span>
                    <CreatureDiorama creature={cr} size={48} rounded={12} anchor="center" showAura={false} className="w-14 h-14" sizes="96px" />
                    <span className="text-[9px] text-white/75 truncate w-full text-center px-1 leading-tight font-semibold">{cr.name}</span>
                    {scaled && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {([
                          { label: 'HP', value: scaled.hp, color: '#F87171' },
                          { label: 'ATK', value: scaled.atk, color: '#FB923C' },
                          { label: 'DEF', value: scaled.def, color: '#60A5FA' },
                        ] as const).map(stat => (
                          <span
                            key={stat.label}
                            className="text-[8px] font-bold px-1 py-0.5 rounded-md"
                            style={{
                              color: stat.color,
                              background: `${stat.color}14`,
                              border: `1px solid ${stat.color}22`,
                            }}
                          >
                            {stat.label} {stat.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[88px] gap-1">
                    <span className="text-2xl text-white/10">+</span>
                    <span className="text-[9px] text-white/20">Slot {i + 1}</span>
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>
        <AnimatePresence>
          {lineupReady && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`text-[10px] text-center mt-1.5 font-semibold ${filledCount === 3 ? 'text-[#34D399]' : 'text-[#FBBF24]'}`}
            >
              {filledCount === 3 ? 'Squadra completa! Tocca uno slot per sostituire.' : `${filledCount}/3 creature — puoi combattere lo stesso`}
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
              const canAdd = !inLineup && filledCount < 3
              const scaled = scaleCombatStats({ hp: cr.hp, atk: cr.atk, def: cr.def }, playerLevel)
              return (
                <CreatureRosterRow
                  key={cr.playerCreatureId}
                  creature={cr}
                  hp={scaled.hp}
                  atk={scaled.atk}
                  def={scaled.def}
                  selected={inLineup}
                  selectedBadge={slotIdx + 1}
                  addable={canAdd}
                  onClick={() => toggleCreature(cr)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Connect section */}
      <div className="flex-none px-4 pb-3 pt-2 space-y-2 border-t border-white/8">
        <button
          onClick={() => connect()}
          disabled={!lineupReady || loading}
          className="w-full rounded-2xl py-3 font-extrabold text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
          style={{
            background: lineupReady ? 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)' : 'rgba(255,255,255,0.06)',
            boxShadow: lineupReady && !loading ? '0 4px 18px rgba(232,93,47,0.4)' : 'none',
          }}
        >
          {loading && !joinCode ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <span className="flex items-center justify-center gap-2">
              ⚔️ {filledCount < 3 && filledCount > 0 ? `Crea Sfida (${filledCount}/3)` : 'Crea Sfida'}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-white/20 text-[10px]">o unisciti con codice</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)) }}
            placeholder="ABCD"
            maxLength={4}
            autoCapitalize="characters"
            inputMode="text"
            className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono text-lg text-center tracking-[0.4em] placeholder-white/15 focus:outline-none focus:border-[#3A9DBC] transition-colors"
          />
          <button
            onClick={() => connect(joinCode)}
            disabled={joinCode.length < 4 || !lineupReady || loading}
            className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
            style={{
              background: joinCode.length === 4 && lineupReady ? 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)' : 'rgba(255,255,255,0.05)',
              color: joinCode.length === 4 && lineupReady ? 'white' : 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {loading && joinCode.length === 4 ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : 'Entra'}
          </button>
        </div>

      </div>
      </>)}
      </>)}

      {/* Confirmation modal — fewer than 3 creatures */}
      <AnimatePresence>
        {pendingConnect && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPendingConnect(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-x-4 z-50 rounded-3xl p-5"
              style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.1)', top: '50%', marginTop: '-160px' }}
            >
              <div className="text-4xl text-center mb-3">⚠️</div>
              <p className="text-white font-extrabold text-center text-base mb-1">
                Squadra incompleta
              </p>
              <p className="text-white/50 text-sm text-center mb-5 leading-relaxed">
                Stai usando solo <span className="text-[#FBBF24] font-bold">{filledCount}/3</span> creature.
                L&apos;avversario potrebbe averne di più — sei sicuro di voler combattere così?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setPendingConnect(null) }}
                  className="w-full py-3 rounded-2xl font-bold text-sm text-white"
                  style={{ background: 'rgba(58,157,188,0.15)', border: '1px solid rgba(58,157,188,0.4)', color: '#3A9DBC' }}
                >
                  Aggiungi più creature
                </button>
                <button
                  onClick={() => {
                    const filled = lineup.filter(Boolean) as SquadCreature[]
                    doConnect(filled, pendingConnect.roomCode)
                  }}
                  disabled={loading}
                  className="w-full py-3 rounded-2xl font-extrabold text-sm text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)' }}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Combatti lo stesso'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

