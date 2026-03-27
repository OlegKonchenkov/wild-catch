'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminInlineSpinner, AdminTableSkeleton } from '@/components/admin/AdminLoading'

interface Player {
  userId: string
  nickname?: string
  email: string
  level: number
  exp: number
  score: number
  gold: number
  joinedAt: string
}

interface NotifyTarget { userId?: string; label: string }

export default function PlayersPage() {
  const [sessions, setSessions]         = useState<any[]>([])
  const [selectedId, setSelectedId]     = useState('')
  const [players, setPlayers]           = useState<Player[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  // Notify — shared state for both "all" and single-player
  const [notifyTarget, setNotifyTarget] = useState<NotifyTarget | null>(null)
  const [notifyTitle, setNotifyTitle]   = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [feedback, setFeedback]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions')
      .select('id, name, status')
      .then(({ data }) => {
        if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
      })
      .then(() => setLoadingSessions(false), () => setLoadingSessions(false))
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false

    async function fetchPlayers() {
      setLoadingPlayers(true)
      try {
        const res = await fetch(`/api/admin/players?sessionId=${encodeURIComponent(selectedId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setPlayers(data.players ?? [])
      } finally {
        if (!cancelled) setLoadingPlayers(false)
      }
    }

    fetchPlayers()
    const channel = supabase
      .channel(`admin-players-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_sessions', filter: `session_id=eq.${selectedId}` },
        () => fetchPlayers())
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [selectedId, supabase])

  async function sendNotify() {
    if (!notifyTarget || !notifyTitle.trim() || !notifyMessage.trim()) return
    setNotifyLoading(true); setFeedback(null)
    try {
      const body: any = { title: notifyTitle, message: notifyMessage }
      if (notifyTarget.userId) {
        body.userId = notifyTarget.userId
      } else {
        body.sessionId = selectedId
      }
      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: `Notifica inviata a ${notifyTarget.label}` })
        setNotifyTitle(''); setNotifyMessage('')
        setTimeout(() => { setFeedback(null); setNotifyTarget(null) }, 3000)
      } else {
        const d = await res.json()
        setFeedback({ type: 'error', text: d.error ?? 'Errore durante l\'invio' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Errore di rete' })
    } finally {
      setNotifyLoading(false)
    }
  }

  function openNotifyAll() {
    setNotifyTarget({ label: 'tutti i giocatori' })
    setNotifyTitle(''); setNotifyMessage(''); setFeedback(null)
  }

  function openNotifyPlayer(p: Player) {
    setNotifyTarget({ userId: p.userId, label: p.nickname || p.email || p.userId.slice(0, 8) })
    setNotifyTitle(''); setNotifyMessage(''); setFeedback(null)
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">👥 Giocatori</h1>

      {/* Session selector */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="block text-xs text-white/50 mb-1">Sessione</label>
          <select
            value={selectedId} onChange={e => setSelectedId(e.target.value)}
            disabled={loadingSessions}
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 disabled:opacity-50"
          >
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>
          {loadingSessions && (
            <div className="mt-2">
              <AdminInlineSpinner label="Caricamento sessioni..." />
            </div>
          )}
        </div>
        <div className="flex items-end">
          <button
            onClick={openNotifyAll}
            disabled={!selectedId || players.length === 0}
            className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40"
          >
            📢 Notifica tutti
          </button>
        </div>
      </div>

      {/* Players table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-8">
        {loadingPlayers && players.length === 0 ? (
          <div className="p-4">
            <AdminTableSkeleton rows={5} columns={6} />
          </div>
        ) : players.length === 0 ? (
          <p className="text-white/50 text-sm p-4">Nessun giocatore in questa sessione.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs">
                  <th className="text-left px-4 py-3 font-semibold">Giocatore</th>
                  <th className="text-center px-3 py-3 font-semibold">Liv.</th>
                  <th className="text-center px-3 py-3 font-semibold">EXP</th>
                  <th className="text-center px-3 py-3 font-semibold">Punteggio</th>
                  <th className="text-center px-3 py-3 font-semibold">Oro</th>
                  <th className="text-center px-3 py-3 font-semibold">Notifica</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.userId} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i === 0 ? 'text-[#FFD700]' : 'text-white'}`}>
                    <td className="px-4 py-3">
                      <div>
                        {p.nickname && <p className="font-bold text-sm">{p.nickname}</p>}
                        <p className="text-xs text-white/40 font-mono">{p.email || p.userId.slice(0, 12) + '…'}</p>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3 font-bold">{p.level}</td>
                    <td className="text-center px-3 py-3">{p.exp}</td>
                    <td className="text-center px-3 py-3 font-bold">{p.score}</td>
                    <td className="text-center px-3 py-3">{p.gold}</td>
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => openNotifyPlayer(p)}
                        className="text-[#3A9DBC]/60 hover:text-[#3A9DBC] text-lg transition-colors"
                        title={`Invia notifica a ${p.nickname || p.email}`}
                      >
                        📢
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {players.length > 0 && (
          <p className="text-white/25 text-xs px-4 py-2">{players.length} giocatori · aggiornamento automatico ogni 30s</p>
        )}
      </div>

      {/* Notify modal */}
      {notifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setNotifyTarget(null) }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">📢 Invia Notifica</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Destinatario: <span className="text-[#3A9DBC] font-semibold">{notifyTarget.label}</span>
                </p>
              </div>
              <button onClick={() => setNotifyTarget(null)}
                className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Titolo notifica</label>
                <input
                  type="text"
                  placeholder="es. Bonus attivato!"
                  value={notifyTitle}
                  onChange={e => setNotifyTitle(e.target.value)}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/25"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Messaggio</label>
                <textarea
                  placeholder="es. Hai ricevuto un bonus EXP ×2 per i prossimi 10 minuti!"
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/25 resize-none"
                />
              </div>

              {feedback && (
                <p className={`text-sm font-medium px-3 py-2 rounded-lg ${
                  feedback.type === 'success'
                    ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20'
                    : 'bg-red-400/10 text-red-400 border border-red-400/20'
                }`}>
                  {feedback.text}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setNotifyTarget(null)}
                  className="flex-1 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm">
                  Annulla
                </button>
                <button
                  onClick={sendNotify}
                  disabled={notifyLoading || !notifyTitle.trim() || !notifyMessage.trim()}
                  className="flex-1 bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                >
                  {notifyLoading ? 'Invio...' : 'Invia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
