'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Profile {
  exp: number
  gold: number
  level: number
  nickname: string
  avatar_url: string | null
  creatures_caught: number
}

interface LeaderboardEntry {
  rank: number
  user_id: string
  nickname: string
  score: number
  isMe: boolean
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function ProfileContent() {
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingBoard, setLoadingBoard]     = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const searchParams = useSearchParams()
  const sessionEnded = searchParams.get('ended') === '1'

  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('current_session_id') : null

  const fetchProfile = useCallback(async () => {
    if (!sessionId) return
    setLoadingProfile(true)
    const res = await fetch(`/api/game/profile?sessionId=${sessionId}`)
    if (res.ok) setProfile(await res.json())
    else setError('Impossibile caricare il profilo')
    setLoadingProfile(false)
  }, [sessionId])

  const fetchLeaderboard = useCallback(async () => {
    if (!sessionId) return
    setLoadingBoard(true)
    const res = await fetch(`/api/game/leaderboard?sessionId=${sessionId}`)
    if (res.ok) {
      const d = await res.json()
      setLeaderboard(d.leaderboard ?? [])
    }
    setLoadingBoard(false)
  }, [sessionId])

  useEffect(() => {
    fetchProfile()
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [fetchProfile, fetchLeaderboard])

  const myEntry = leaderboard.find(e => e.isMe)

  return (
    <div className="h-full overflow-y-auto p-4 pb-6">
      {sessionEnded && (
        <div className="bg-[#7B4DB8]/20 border border-[#7B4DB8]/50 rounded-2xl p-4 mb-4 text-center">
          <p className="text-2xl font-bold text-white">🏆 Evento Terminato!</p>
          <p className="text-white/60 text-sm mt-1">La classifica finale è stata generata</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-sm mb-4">{error}</div>
      )}

      {/* Profile card */}
      {loadingProfile ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 animate-pulse h-28" />
      ) : profile ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-[#3A9DBC]/20 border border-[#3A9DBC]/30 flex items-center justify-center text-xl shrink-0">
              {profile.avatar_url
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                : '👤'}
            </div>
            <div>
              <p className="font-bold text-white text-base">{profile.nickname}</p>
              <p className="text-sm text-[#3A9DBC]">Livello {profile.level}</p>
            </div>
            {myEntry && (
              <div className="ml-auto text-right">
                <p className="text-xl font-extrabold">{MEDAL[myEntry.rank] ?? `#${myEntry.rank}`}</p>
                <p className="text-xs text-white/40">in classifica</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/20 rounded-xl py-2">
              <p className="text-[#F7C841] font-extrabold text-lg">{profile.exp}</p>
              <p className="text-xs text-white/40">EXP</p>
            </div>
            <div className="bg-black/20 rounded-xl py-2">
              <p className="text-[#D4A96A] font-extrabold text-lg">{profile.gold}</p>
              <p className="text-xs text-white/40">Oro</p>
            </div>
            <div className="bg-black/20 rounded-xl py-2">
              <p className="text-white font-extrabold text-lg">{profile.creatures_caught}</p>
              <p className="text-xs text-white/40">🐾 Creature</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Live leaderboard */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-extrabold text-white">🏆 Classifica Live</h2>
        <button onClick={fetchLeaderboard} className="text-xs text-[#3A9DBC] hover:text-white transition-colors">↻ Aggiorna</button>
      </div>

      {loadingBoard ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="bg-white/5 rounded-xl h-12 animate-pulse" />)}
        </div>
      ) : leaderboard.length === 0 ? (
        <p className="text-center text-white/30 py-8 text-sm">Nessun giocatore ancora</p>
      ) : (
        <div className="space-y-1.5">
          {leaderboard.map(entry => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                entry.isMe
                  ? 'bg-[#3A9DBC]/15 border border-[#3A9DBC]/40'
                  : 'bg-white/4 border border-white/8'
              }`}
            >
              <span className={`font-extrabold text-base w-8 text-center shrink-0 ${
                entry.rank === 1 ? 'text-[#F7C841]' :
                entry.rank === 2 ? 'text-gray-300' :
                entry.rank === 3 ? 'text-[#D4A96A]' : 'text-white/30 text-sm'
              }`}>
                {MEDAL[entry.rank] ?? `#${entry.rank}`}
              </span>
              <span className={`flex-1 text-sm font-semibold truncate ${entry.isMe ? 'text-[#3A9DBC]' : 'text-white'}`}>
                {entry.nickname}{entry.isMe && ' (tu)'}
              </span>
              <span className="text-[#F7C841] font-bold text-sm shrink-0">{entry.score} pt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-white/30 text-sm">Caricamento...</div>}>
      <ProfileContent />
    </Suspense>
  )
}
