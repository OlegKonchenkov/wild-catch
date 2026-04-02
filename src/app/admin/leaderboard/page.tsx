'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminListSkeleton } from '@/components/admin/AdminLoading'

interface PlayerRow {
  user_id: string
  nickname: string
  level: number
  exp: number
  score: number
  gold: number
  steps_walked: number
  creatures: number
  duel_wins: number
  duel_played: number
}

interface SessionMeta {
  id: string
  name: string
  status: string
  start_at: string | null
  end_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#64748b', ready: '#F7C841', active: '#34D399', ended: '#7B4DB8',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Bozza', ready: 'Pronta', active: 'Attiva', ended: 'Conclusa',
}

const MEDAL_GRADIENT: Record<number, string> = {
  1: 'linear-gradient(135deg,#a06a00 0%,#F7C841 50%,#a06a00 100%)',
  2: 'linear-gradient(135deg,#555 0%,#ccc 50%,#555 100%)',
  3: 'linear-gradient(135deg,#6b3b00 0%,#D4A96A 50%,#6b3b00 100%)',
}
const MEDAL_COLOR: Record<number, string> = {
  1: '#F7C841', 2: '#ccc', 3: '#D4A96A',
}
const MEDAL_BORDER: Record<number, string> = {
  1: 'rgba(247,200,65,0.45)', 2: 'rgba(200,200,200,0.35)', 3: 'rgba(212,169,106,0.4)',
}
const MEDAL_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminLeaderboard() {
  const [sessions, setSessions]         = useState<SessionMeta[]>([])
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [rows, setRows]                 = useState<PlayerRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loading, setLoading]           = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // Load sessions list
  useEffect(() => {
    supabase.from('sessions')
      .select('id, name, status, start_at, end_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) { setSessions(data as SessionMeta[]); if (data[0]) setSelectedId(data[0].id) }
        setLoadingSessions(false)
      }, () => setLoadingSessions(false))
  }, [supabase])

  const loadLeaderboard = useCallback(async (sid: string) => {
    setLoading(true)
    setRows([])
    try {
      // 1. All player stats — single query ordered by score
      const { data: players } = await supabase
        .from('player_sessions')
        .select('user_id, level, exp, score, gold, steps_walked')
        .eq('session_id', sid)
        .order('score', { ascending: false })

      if (!players?.length) return

      const userIds = players.map(p => p.user_id)

      // 2. Nicknames — single query
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, nickname').in('user_id', userIds)
      const nickMap: Record<string, string> = Object.fromEntries(
        (profiles ?? []).map(p => [p.user_id, p.nickname ?? 'Anonimo'])
      )

      // 3. Creature counts — single query, aggregate client-side
      const { data: creatures } = await supabase
        .from('player_creatures').select('user_id').eq('session_id', sid)
      const creatureMap: Record<string, number> = {}
      for (const c of creatures ?? []) creatureMap[c.user_id] = (creatureMap[c.user_id] ?? 0) + 1

      // 4. Duel stats — single query, aggregate client-side
      const { data: duels } = await supabase
        .from('duels')
        .select('winner_id, challenger_id, opponent_id')
        .eq('session_id', sid)
        .eq('status', 'ended')
      const duelPlayed: Record<string, number> = {}
      const duelWins: Record<string, number>   = {}
      for (const d of duels ?? []) {
        if (d.challenger_id) duelPlayed[d.challenger_id] = (duelPlayed[d.challenger_id] ?? 0) + 1
        if (d.opponent_id)   duelPlayed[d.opponent_id]   = (duelPlayed[d.opponent_id]   ?? 0) + 1
        if (d.winner_id)     duelWins[d.winner_id]       = (duelWins[d.winner_id]       ?? 0) + 1
      }

      setRows(players.map(p => ({
        user_id:      p.user_id,
        nickname:     nickMap[p.user_id] ?? 'Anonimo',
        level:        p.level ?? 1,
        exp:          p.exp ?? 0,
        score:        p.score ?? 0,
        gold:         p.gold ?? 0,
        steps_walked: p.steps_walked ?? 0,
        creatures:    creatureMap[p.user_id] ?? 0,
        duel_wins:    duelWins[p.user_id]    ?? 0,
        duel_played:  duelPlayed[p.user_id]  ?? 0,
      })))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (selectedId) loadLeaderboard(selectedId)
  }, [selectedId, loadLeaderboard])

  const selectedSession = sessions.find(s => s.id === selectedId)
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div className="max-w-2xl space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">🏆 Classifica</h1>
        {selectedId && !loading && (
          <button
            onClick={() => loadLeaderboard(selectedId)}
            className="text-xs text-[#3A9DBC] bg-[#3A9DBC]/10 border border-[#3A9DBC]/25 px-3 py-1.5 rounded-lg transition-colors font-semibold hover:bg-[#3A9DBC]/20"
          >
            ↻ Aggiorna
          </button>
        )}
      </div>

      {/* Session selector */}
      {loadingSessions ? (
        <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-2 flex-wrap">
            {sessions.map(s => {
              const color    = STATUS_COLOR[s.status] ?? '#64748b'
              const selected = s.id === selectedId
              return (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: selected ? color + '18' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected ? color + '55' : 'rgba(255,255,255,0.1)'}`,
                    color: selected ? 'white' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="truncate max-w-[150px]">{s.name}</span>
                  <span className="text-[10px] opacity-55 shrink-0">{STATUS_LABEL[s.status]}</span>
                </button>
              )
            })}
          </div>
          {selectedSession && (
            <p className="text-[11px] text-white/25 px-1">
              {fmtDate(selectedSession.start_at) ?? 'Data non definita'}
              {selectedSession.end_at && ` → ${fmtDate(selectedSession.end_at)}`}
              {!loading && rows.length > 0 && (
                <span className="ml-2 text-[#3A9DBC]/70">
                  {rows.length} giocator{rows.length === 1 ? 'e' : 'i'}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <AdminListSkeleton rows={5} itemClassName="h-14" />
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-white/25">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm">Nessun giocatore in questa sessione</p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* Top 3 — podium cards */}
          {top3.map((row, i) => {
            const rank = i + 1
            return (
              <div key={row.user_id} className="rounded-2xl p-px" style={{ background: MEDAL_GRADIENT[rank] }}>
                <div className="rounded-[14px] px-4 py-3 flex items-center gap-3"
                  style={{ background: 'rgba(10,18,30,0.9)' }}>

                  <span className="text-2xl w-9 text-center shrink-0">{MEDAL_EMOJI[rank]}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold text-white text-sm truncate">{row.nickname}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: MEDAL_BORDER[rank], color: MEDAL_COLOR[rank], border: `1px solid ${MEDAL_BORDER[rank]}` }}>
                        Lv {row.level}
                      </span>
                    </div>
                    <div className="flex gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-white/40 flex-wrap">
                      <span>{row.exp.toLocaleString('it-IT')} EXP</span>
                      <span>🐾 {row.creatures}</span>
                      {row.duel_played > 0 && <span>⚔️ {row.duel_wins}/{row.duel_played}W</span>}
                      {row.steps_walked > 0 && <span>👟 {row.steps_walked.toLocaleString('it-IT')} m</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-base leading-none" style={{ color: MEDAL_COLOR[rank] }}>
                      {row.score.toLocaleString('it-IT')} pt
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5">🪙 {row.gold.toLocaleString('it-IT')}</p>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Positions 4+ — compact table */}
          {rest.length > 0 && (
            <div className="rounded-2xl border border-white/8 overflow-hidden">
              {/* Column headers */}
              <div className="grid px-4 py-2 border-b border-white/8 text-[9px] uppercase tracking-widest text-white/25 font-bold"
                style={{ gridTemplateColumns: '2.2rem 1fr 5.5rem 4rem 2.5rem 2.5rem 2.5rem' }}>
                <span>#</span>
                <span>Giocatore</span>
                <span className="text-right">Punti</span>
                <span className="text-right">EXP</span>
                <span className="text-center">🐾</span>
                <span className="text-center">⚔️</span>
                <span className="text-center">👟</span>
              </div>

              {rest.map((row, i) => (
                <div key={row.user_id}
                  className="grid items-center px-4 py-2.5 border-b border-white/5 last:border-0 text-sm"
                  style={{
                    gridTemplateColumns: '2.2rem 1fr 5.5rem 4rem 2.5rem 2.5rem 2.5rem',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                  }}>
                  <span className="text-white/30 font-bold text-xs text-center">#{i + 4}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate text-[13px]">{row.nickname}</p>
                    <p className="text-[10px] text-white/30">Lv {row.level}</p>
                  </div>
                  <span className="text-right font-bold text-[#F7C841] text-[13px]">
                    {row.score.toLocaleString('it-IT')}
                  </span>
                  <span className="text-right text-white/45 text-xs">
                    {row.exp.toLocaleString('it-IT')}
                  </span>
                  <span className="text-center text-white/55 text-xs">{row.creatures}</span>
                  <span className="text-center text-white/55 text-xs">
                    {row.duel_played > 0 ? `${row.duel_wins}/${row.duel_played}` : '—'}
                  </span>
                  <span className="text-center text-white/45 text-[11px]">
                    {row.steps_walked > 0 ? row.steps_walked.toLocaleString('it-IT') : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
