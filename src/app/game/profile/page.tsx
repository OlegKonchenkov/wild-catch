'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

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

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({
  label, value, color, icon,
}: {
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
  const [sessions, setSessions]         = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([])
  const [nickname, setNickname]         = useState('')
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingBoard, setLoadingBoard]       = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const router      = useRouter()
  const searchParams = useSearchParams()
  const sessionEnded = searchParams.get('ended') === '1'

  // ── Load sessions list ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/game/sessions')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { sessions: SessionSummary[] }) => {
        const list = d.sessions ?? []
        setSessions(list)

        // Auto-select the session that's stored in localStorage, else first in list
        const currentId = typeof window !== 'undefined'
          ? localStorage.getItem('current_session_id')
          : null
        const autoId = (currentId && list.find(s => s.id === currentId))
          ? currentId
          : list[0]?.id ?? null
        setSelectedId(autoId)

        // Fetch profile identity (nickname / avatar) from any session
        if (list.length > 0) {
          fetch(`/api/game/profile?sessionId=${list[0].id}`)
            .then(r => r.ok ? r.json() : null)
            .then(p => { if (p?.nickname) { setNickname(p.nickname); setAvatarUrl(p.avatar_url) } })
            .catch(() => {})
        }
      })
      .catch(() => setError('Impossibile caricare le sessioni'))
      .finally(() => setLoadingSessions(false))
  }, [])

  // ── Load leaderboard for selected session ─────────────────────────────────
  const fetchBoard = useCallback(async (sid: string) => {
    setLoadingBoard(true)
    try {
      const r = await fetch(`/api/game/leaderboard?sessionId=${sid}`)
      if (r.ok) setLeaderboard((await r.json()).leaderboard ?? [])
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) fetchBoard(selectedId)
  }, [selectedId, fetchBoard])

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedSession = sessions.find(s => s.id === selectedId) ?? null
  const myRank = leaderboard.find(e => e.isMe)?.rank ?? null
  const currentStoredId = typeof window !== 'undefined' ? localStorage.getItem('current_session_id') : null
  const isCurrentSession = selectedId === currentStoredId

  const totalExp       = sessions.reduce((s, x) => s + x.exp, 0)
  const totalCreatures = sessions.reduce((s, x) => s + x.creatures_caught, 0)
  const totalDuelWins  = sessions.reduce((s, x) => s + x.duel_wins, 0)

  function enterSession() {
    if (!selectedId) return
    if (typeof window !== 'undefined') localStorage.setItem('current_session_id', selectedId)
    // Full reload so GameShell re-initialises with the new session
    window.location.href = '/game/map'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto pb-8">

      {/* ── Session-ended banner ── */}
      {sessionEnded && (
        <div className="bg-[#7B4DB8]/20 border-b border-[#7B4DB8]/40 px-4 py-3 text-center">
          <p className="text-lg font-bold text-white">🏆 Evento Terminato!</p>
          <p className="text-white/50 text-xs mt-0.5">La classifica finale è stata generata</p>
        </div>
      )}

      {/* ── Identity banner ── */}
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
              {loadingSessions ? '...' : nickname || 'Cacciatore'}
            </p>
            {sessions.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-white/40">
                <span>{sessions.length} {sessions.length === 1 ? 'sessione' : 'sessioni'}</span>
                <span className="text-[#F7C841]/80">{totalExp.toLocaleString('it-IT')} EXP tot.</span>
                <span>🐾 {totalCreatures}</span>
                <span>⚔️ {totalDuelWins}W</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Sessions list ── */}
      <div className="px-4">
        <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2.5">
          Seleziona una sessione
        </p>

        {loadingSessions ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 text-white/30 text-sm">
            <p className="text-3xl mb-2">🎮</p>
            <p>Non hai ancora partecipato a nessuna sessione</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => {
              const st      = SESSION_STATUS[session.status] ?? SESSION_STATUS.draft
              const selected = session.id === selectedId
              return (
                <motion.button
                  key={session.id}
                  onClick={() => setSelectedId(session.id)}
                  whileTap={{ scale: 0.985 }}
                  className="w-full text-left rounded-xl px-3 py-2.5 transition-all cursor-pointer"
                  style={{
                    border: `1px solid ${selected ? st.color + '70' : 'rgba(255,255,255,0.08)'}`,
                    background: selected ? st.color + '12' : 'rgba(255,255,255,0.03)',
                    boxShadow: selected
                      ? `0 0 0 1px ${st.color}30, 0 4px 16px ${st.color}15`
                      : 'none',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">{session.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                          style={{ background: st.color + '22', color: st.color, border: `1px solid ${st.color}44` }}>
                          {st.label}
                        </span>
                        {session.id === currentStoredId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-[#3A9DBC]/15 text-[#3A9DBC] border border-[#3A9DBC]/30">
                            attiva
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-white/30">
                        {session.start_at && <span>{fmtDate(session.start_at)}</span>}
                        <span className="text-[#F7C841]/60">{session.exp.toLocaleString('it-IT')} EXP</span>
                        <span>🐾 {session.creatures_caught}</span>
                        {session.duel_total > 0 && <span>⚔️ {session.duel_wins}/{session.duel_total}W</span>}
                      </div>
                    </div>
                    <div className="text-xs shrink-0" style={{ color: selected ? st.color : 'rgba(255,255,255,0.15)' }}>
                      ▸
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Selected session detail ── */}
      <AnimatePresence mode="wait">
        {selectedSession && (
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="px-4 mt-4 space-y-3"
          >
            {/* Stats card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2.5">
                Statistiche — {selectedSession.name}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="EXP"    value={selectedSession.exp.toLocaleString('it-IT')}      color="#F7C841" icon="✨" />
                <StatBox label="Livello" value={selectedSession.level}                            color="#3A9DBC" icon="⬆️" />
                <StatBox
                  label="Classifica"
                  value={
                    loadingBoard ? '…' :
                    myRank ? (MEDAL[myRank] ?? `#${myRank}`) : '—'
                  }
                  color="#C084FC" icon="🏆"
                />
                <StatBox label="Creature" value={selectedSession.creatures_caught}               color="#34D399" icon="🐾" />
                <StatBox label="Oro"      value={selectedSession.gold.toLocaleString('it-IT')}   color="#D4A96A" icon="🪙" />
                <StatBox
                  label={`Duelli ${selectedSession.duel_wins}/${selectedSession.duel_total}`}
                  value={
                    selectedSession.duel_total > 0
                      ? `${Math.round((selectedSession.duel_wins / selectedSession.duel_total) * 100)}%`
                      : '—'
                  }
                  color="#E85D2F" icon="⚔️"
                />
              </div>
            </div>

            {/* Enter session CTA */}
            {(selectedSession.status === 'active' || selectedSession.status === 'ready') && (
              <button
                onClick={enterSession}
                className="w-full py-3 rounded-xl font-extrabold text-sm transition-all active:scale-95"
                style={isCurrentSession ? {
                  background: 'rgba(58,157,188,0.12)',
                  color: '#3A9DBC',
                  border: '1px solid rgba(58,157,188,0.35)',
                } : {
                  background: 'linear-gradient(135deg, #3A9DBC 0%, #2980a0 100%)',
                  color: 'white',
                  boxShadow: '0 4px 18px rgba(58,157,188,0.45)',
                }}
              >
                {isCurrentSession
                  ? '✓ Sessione attiva — torna alla mappa'
                  : '⚡ Entra in questa sessione'}
              </button>
            )}

            {/* Leaderboard */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold">Classifica</p>
                <button
                  onClick={() => fetchBoard(selectedId!)}
                  className="text-xs text-[#3A9DBC] hover:text-white transition-colors"
                >
                  ↻ Aggiorna
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
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                        entry.isMe
                          ? 'bg-[#3A9DBC]/12 border border-[#3A9DBC]/35'
                          : 'bg-white/[0.04] border border-white/[0.07]'
                      }`}
                    >
                      <span className={`font-extrabold text-base w-8 text-center shrink-0 ${
                        entry.rank === 1 ? 'text-[#F7C841]'  :
                        entry.rank === 2 ? 'text-gray-300'   :
                        entry.rank === 3 ? 'text-[#D4A96A]'  : 'text-white/25 text-sm'
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
      </AnimatePresence>
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
