'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { GameProfileSkeleton } from '@/components/game/GameLoading'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionSummary {
  id: string
  name: string
  status: 'draft' | 'ready' | 'active' | 'ended'
  start_at: string | null
  end_at: string | null
  exp: number
  gold: number
  level: number
  creatures_caught: number
  duel_wins: number
  duel_total: number
}

interface LeaderboardEntry {
  rank: number
  user_id: string
  nickname: string
  score: number
  isMe: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  draft:  { label: 'Bozza',    color: '#64748b' },
  ready:  { label: 'Pronta',   color: '#F7C841' },
  active: { label: 'In Corso', color: '#34D399' },
  ended:  { label: 'Conclusa', color: '#7B4DB8' },
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon: string
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-black/25 rounded-xl py-2.5 px-1.5 text-center">
      <p className="font-extrabold text-base leading-none" style={{ color }}>{value}</p>
      <p className="text-[10px] text-white/35 mt-1 leading-tight">{icon} {label}</p>
    </div>
  )
}

// ─── Main content ─────────────────────────────────────────────────────────────

function ProfileContent() {
  const [session, setSession]           = useState<SessionSummary | null>(null)
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([])
  const [nickname, setNickname]         = useState('')
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const { toast, showError, dismiss }   = useGameToast()

  const searchParams = useSearchParams()
  const sessionEnded = searchParams.get('ended') === '1'

  const fetchBoard = useCallback(async (sid: string) => {
    setLoadingBoard(true)
    try {
      const r = await fetch(`/api/game/leaderboard?sessionId=${sid}`)
      if (r.ok) setLeaderboard((await r.json()).leaderboard ?? [])
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  // Load current session only
  useEffect(() => {
    const currentId = typeof window !== 'undefined'
      ? localStorage.getItem('current_session_id')
      : null

    async function loadProfile() {
      try {
        const sessionsPromise = fetch('/api/game/sessions')
          .then(r => r.ok ? r.json() : Promise.reject())

        const eagerProfilePromise = currentId
          ? fetch(`/api/game/profile?sessionId=${currentId}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null)

        const eagerBoardPromise = currentId
          ? fetch(`/api/game/leaderboard?sessionId=${currentId}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null)

        const [sessionsData, eagerProfile, eagerBoard] = await Promise.all([
          sessionsPromise,
          eagerProfilePromise,
          eagerBoardPromise,
        ])

        const list: SessionSummary[] = sessionsData.sessions ?? []
        const selectedSession: SessionSummary | null = (currentId ? list.find(x => x.id === currentId) : null)
          ?? list[0]
          ?? null

        setSession(selectedSession)

        const selectedId = selectedSession?.id ?? null
        if (!selectedId) return

        if (selectedId === currentId) {
          if (eagerProfile?.nickname) {
            setNickname(eagerProfile.nickname)
            setAvatarUrl(eagerProfile.avatar_url)
          }
          if (eagerBoard?.leaderboard) {
            setLeaderboard(eagerBoard.leaderboard)
          } else {
            fetchBoard(selectedId)
          }
          return
        }

        const [profileData] = await Promise.all([
          fetch(`/api/game/profile?sessionId=${selectedId}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null),
          fetchBoard(selectedId),
        ])

        if (profileData?.nickname) {
          setNickname(profileData.nickname)
          setAvatarUrl(profileData.avatar_url)
        }
      } catch {
        showError('Impossibile caricare i dati')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [fetchBoard])

  // ── Derived ───────────────────────────────────────────────────────────────
  const myRank = leaderboard.find(e => e.isMe)?.rank ?? null
  const st = session ? (SESSION_STATUS[session.status] ?? SESSION_STATUS.draft) : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto pb-8 relative">

      {/* Session-ended banner */}
      {sessionEnded && (
        <div className="bg-[#7B4DB8]/20 border-b border-[#7B4DB8]/40 px-4 py-3 text-center">
          <p className="text-lg font-bold text-white">🏆 Evento Terminato!</p>
          <p className="text-white/50 text-xs mt-0.5">La classifica finale è stata generata</p>
        </div>
      )}

      {/* Identity banner */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden"
            style={{ background: 'rgba(58,157,188,0.2)', border: '2px solid rgba(58,157,188,0.4)' }}>
            {avatarUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-white text-base truncate">
              {loading ? '...' : nickname || 'Cacciatore'}
            </p>
            {session && st && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs truncate text-white/40">{session.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                  style={{ background: st.color + '22', color: st.color, border: `1px solid ${st.color}44` }}>
                  {st.label}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {loading ? (
        <GameProfileSkeleton />
      ) : !session ? (
        <div className="text-center py-16 text-white/30 text-sm px-8">
          <p className="text-4xl mb-3">🎮</p>
          <p>Non hai ancora partecipato a nessuna sessione</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="px-4 space-y-3"
        >
          {/* Stats card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2.5">
              Le tue statistiche
            </p>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="EXP"     value={session.exp.toLocaleString('it-IT')}  color="#F7C841" icon="✨" />
              <StatBox label="Livello" value={session.level}                         color="#3A9DBC" icon="⬆️" />
              <StatBox
                label="Classifica"
                value={loadingBoard ? '…' : myRank ? (MEDAL[myRank] ?? `#${myRank}`) : '—'}
                color="#C084FC" icon="🏆"
              />
              <StatBox label="Creature"  value={session.creatures_caught}            color="#34D399" icon="🐾" />
              <StatBox label="Oro"       value={session.gold.toLocaleString('it-IT')} color="#D4A96A" icon="🪙" />
              <StatBox
                label={`Duelli ${session.duel_wins}/${session.duel_total}`}
                value={session.duel_total > 0
                  ? `${Math.round((session.duel_wins / session.duel_total) * 100)}%`
                  : '—'}
                color="#E85D2F" icon="⚔️"
              />
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold">
                Classifica — {session.name}
              </p>
              <button
                onClick={() => fetchBoard(session.id)}
                className="text-xs text-[#3A9DBC] hover:text-white transition-colors"
              >
                ↻
              </button>
            </div>

            {loadingBoard ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-11 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-white/25 py-5 text-sm">Nessun giocatore ancora</p>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.map(entry => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      entry.isMe
                        ? 'bg-[#3A9DBC]/12 border border-[#3A9DBC]/35'
                        : 'bg-white/[0.04] border border-white/[0.07]'
                    }`}
                  >
                    <span className={`font-extrabold text-base w-8 text-center shrink-0 ${
                      entry.rank === 1 ? 'text-[#F7C841]' :
                      entry.rank === 2 ? 'text-gray-300'  :
                      entry.rank === 3 ? 'text-[#D4A96A]' : 'text-white/25 text-sm'
                    }`}>
                      {MEDAL[entry.rank] ?? `#${entry.rank}`}
                    </span>
                    <span className={`flex-1 text-sm font-semibold truncate ${
                      entry.isMe ? 'text-[#3A9DBC]' : 'text-white'
                    }`}>
                      {entry.nickname}{entry.isMe && ' (tu)'}
                    </span>
                    <span className="text-[#F7C841] font-bold text-sm shrink-0">
                      {entry.score.toLocaleString('it-IT')} pt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center text-white/30 text-sm">
        Caricamento...
      </div>
    }>
      <ProfileContent />
    </Suspense>
  )
}
