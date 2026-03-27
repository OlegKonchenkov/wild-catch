'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminInlineSpinner, AdminListSkeleton } from '@/components/admin/AdminLoading'

interface LeaderboardEntry {
  user_id: string
  nickname: string
  level: number
  exp: number
  gold: number
  caught_count: number
}

export default function AdminLeaderboard() {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loading, setLoading]   = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) } })
      .then(() => setLoadingSessions(false), () => setLoadingSessions(false))
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return

    async function load() {
      setLoading(true)
      // Step 1: player_sessions ordered by exp
      const { data: players } = await supabase
        .from('player_sessions')
        .select('user_id, level, exp, gold')
        .eq('session_id', selectedId!)
        .order('exp', { ascending: false })

      if (!players || players.length === 0) { setEntries([]); setLoading(false); return }

      const userIds = players.map(p => p.user_id)

      // Step 2: nicknames (separate query — no FK join ambiguity)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nickname')
        .in('user_id', userIds)

      const nickMap: Record<string, string> = {}
      for (const p of profiles ?? []) nickMap[p.user_id] = p.nickname ?? 'Anonimo'

      // Step 3: caught creatures count per player
      const counts = await Promise.all(players.map(async p => {
        const { count } = await supabase
          .from('player_creatures')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', p.user_id)
          .eq('session_id', selectedId!)
        return { ...p, caught_count: count ?? 0 }
      }))

      setEntries(counts.map(p => ({
        user_id: p.user_id,
        nickname: nickMap[p.user_id] ?? 'Anonimo',
        level: p.level,
        exp: p.exp,
        gold: p.gold,
        caught_count: p.caught_count,
      })))
      setLoading(false)
    }

    load()
  }, [selectedId, supabase])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">🏆 Classifica</h1>

      <div className="mb-4">
        <select
          value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)} disabled={loadingSessions}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 w-full disabled:opacity-50"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
        {loadingSessions && (
          <div className="mt-2">
            <AdminInlineSpinner label="Caricamento sessioni..." />
          </div>
        )}
      </div>

      {loading ? (
        <AdminListSkeleton rows={4} itemClassName="h-16" />
      ) : entries.length === 0 ? (
        <p className="text-white/40 text-sm">Nessun giocatore in questa sessione.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={e.user_id}
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-xl w-8 text-center shrink-0">{medals[i] ?? `#${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{e.nickname}</p>
                <p className="text-xs text-white/40">Lv {e.level} · {e.exp} EXP · {e.caught_count} 🐾</p>
              </div>
              <span className="text-[#F7C841] font-bold text-sm shrink-0">🪙 {e.gold}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
