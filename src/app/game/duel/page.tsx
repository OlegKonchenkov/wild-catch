'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Rarity, Element } from '@/lib/types'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { motion, AnimatePresence } from 'framer-motion'

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
      const { data: { user } } = await supabase.auth.getUser()
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

      const duelEntries: HistoryEntry[] = (duelsRes.data ?? []).map((d: any) => ({
        id: d.id,
        type: 'duel',
        date: d.ended_at ?? d.started_at ?? '',
        result: d.status === 'ended' ? (d.winner_id === user.id ? 'won' : 'lost') : 'unknown',
        label: `Duello · ${d.room_code ?? '—'}`,
        detail: d.status === 'cancelled' ? 'Annullato' : d.winner_id === user.id ? 'Vittoria' : 'Sconfitta',
      }))

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
  image_url: string
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
  const [error, setError] = useState<string | null>(null)
  const [loadingCreatures, setLoadingCreatures] = useState(true)
  const [pendingConnect, setPendingConnect] = useState<{ roomCode?: string } | null>(null)
  const { history, loading: historyLoading } = useHistory(supabase)

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
          const RARITY_ORDER = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']
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
    setError(null)
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
        setError(data.error ?? 'Errore connessione')
        setLoading(false)
      }
    } catch {
      setError('Errore di rete')
      setLoading(false)
    }
  }

  const filledCount = lineup.filter(Boolean).length
  const lineupReady = filledCount >= 1

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
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
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30 pt-16">
              <span className="text-5xl">📜</span>
              <p className="text-sm">Nessun duello disputato</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(entry => {
                const isBoss = entry.type === 'boss'
                const isWon  = entry.result === 'won'
                const isLost = entry.result === 'lost'
                const time   = entry.date ? new Date(entry.date).toLocaleString('it-IT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl"
                    style={{
                      background: isWon ? 'rgba(52,211,153,0.08)' : isLost ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isWon ? 'rgba(52,211,153,0.25)' : isLost ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    }}
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
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
                    <CreatureSprite
                      imageUrl={cr.image_url}
                      name={cr.name}
                      animState="idle"
                      size={46}
                      element={cr.element}
                      rarity={cr.rarity}
                    />
                    <span className="text-[9px] text-white/75 truncate w-full text-center px-1 leading-tight font-semibold">{cr.name}</span>
                    <span className="text-[8px] text-white/30 font-mono">HP {cr.hp}</span>
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
                  <div
                    className="shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{
                      width: 52, height: 52,
                      background: `radial-gradient(circle at 50% 55%, ${rarityColor}20 0%, ${rarityColor}08 70%, transparent 100%)`,
                      border: `1.5px solid ${inLineup ? rarityColor + '70' : rarityColor + '25'}`,
                      boxShadow: inLineup ? `0 0 10px ${rarityColor}35` : 'none',
                    }}
                  >
                    <CreatureSprite
                      imageUrl={cr.image_url}
                      name={cr.name}
                      animState="idle"
                      size={44}
                      element={cr.element}
                      rarity={cr.rarity}
                    />
                  </div>
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
            onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)); setError(null) }}
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
                L'avversario potrebbe averne di più — sei sicuro di voler combattere così?
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
