'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

interface LeaderboardEntry {
  rank: number
  nickname: string
  score: number
  creatures_caught: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [hallOfFame, setHallOfFame] = useState<any[]>([])
  const searchParams = useSearchParams()
  const sessionEnded = searchParams.get('ended') === '1'
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      // Profile
      supabase.from('player_sessions').select('*, profiles!player_sessions_user_id_fkey(nickname, avatar_url)')
        .eq('user_id', user.id).eq('session_id', sessionId).single()
        .then(({ data }) => { if (data) setProfile(data) })

      // Hall of fame
      supabase.from('hall_of_fame').select('*')
        .eq('user_id', user.id).order('awarded_at', { ascending: false }).limit(5)
        .then(({ data }) => { if (data) setHallOfFame(data) })
    })

    // Leaderboard — polling every 30s
    function fetchLeaderboard() {
      supabase
        .from('player_sessions')
        .select('exp, user_id, profiles!player_sessions_user_id_fkey(nickname)')
        .eq('session_id', sessionId)
        .order('exp', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          if (data) {
            setLeaderboard(data.map((p: any, i: number) => ({
              rank: i + 1,
              nickname: (p.profiles as any)?.nickname ?? 'Anonimo',
              score: p.exp,
              creatures_caught: 0,
            })))
          }
        })
    }

    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [supabase])

  return (
    <div className="h-full overflow-y-auto p-4">
      {sessionEnded && (
        <div className="bg-[#7B4DB8]/20 border border-[#7B4DB8] rounded-xl p-4 mb-4 text-center">
          <p className="text-2xl font-bold text-white">🏆 Evento Terminato!</p>
          <p className="text-white/70 text-sm mt-1">La classifica finale è stata generata</p>
        </div>
      )}

      {/* Profile card */}
      {profile && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#3A9DBC] flex items-center justify-center text-xl">
              👤
            </div>
            <div>
              <p className="font-bold text-white">{(profile as any)?.profiles?.nickname ?? 'Anonimo'}</p>
              <p className="text-sm text-[#3A9DBC]">Livello {profile.level}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div><p className="text-[#F7C841] font-bold">{profile.exp}</p><p className="text-xs text-white/50">EXP</p></div>
            <div><p className="text-[#D4A96A] font-bold">{profile.gold}</p><p className="text-xs text-white/50">Oro</p></div>
            <div><p className="text-white font-bold">{profile.level}</p><p className="text-xs text-white/50">Livello</p></div>
          </div>
        </div>
      )}

      {/* Live leaderboard */}
      <h2 className="text-lg font-bold text-white mb-3">Classifica Live</h2>
      <div className="space-y-2 mb-6">
        {leaderboard.map(entry => (
          <div key={entry.rank} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
            <span className={`font-bold text-lg w-8 text-center ${
              entry.rank === 1 ? 'text-[#F7C841]' :
              entry.rank === 2 ? 'text-gray-300' :
              entry.rank === 3 ? 'text-[#D4A96A]' : 'text-white/40'
            }`}>
              {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
            </span>
            <span className="flex-1 text-white text-sm">{entry.nickname}</span>
            <span className="text-[#F7C841] font-bold text-sm">{entry.score} pt</span>
          </div>
        ))}
        {leaderboard.length === 0 && (
          <p className="text-center text-white/30 py-4">Caricamento classifica...</p>
        )}
      </div>

      {/* Hall of Fame */}
      {hallOfFame.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-[#F7C841] mb-3">🏆 Hall of Fame</h2>
          <div className="space-y-2">
            {hallOfFame.map(hof => (
              <div key={hof.id} className="bg-[#F7C841]/10 border border-[#F7C841]/30 rounded-xl p-3">
                <div className="flex justify-between">
                  <span className="text-white font-bold">{hof.season_label}</span>
                  <span className="text-[#F7C841]">#{hof.rank}</span>
                </div>
                <p className="text-sm text-white/60">{hof.score} punti · {hof.creatures_caught} creature</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
