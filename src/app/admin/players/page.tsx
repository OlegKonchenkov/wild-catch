'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Player {
  userId: string
  email: string
  level: number
  exp: number
  score: number
  gold: number
  joinedAt: string
}

export default function PlayersPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
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
    const interval = setInterval(fetchPlayers, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedId])

  async function sendNotify() {
    if (!selectedId || !notifyTitle.trim() || !notifyMessage.trim()) return
    setNotifyLoading(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedId, title: notifyTitle, message: notifyMessage }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Notifica inviata con successo!' })
        setNotifyTitle('')
        setNotifyMessage('')
        setTimeout(() => setFeedback(null), 5000)
      } else {
        const data = await res.json()
        setFeedback({ type: 'error', text: data.error ?? 'Errore durante l\'invio' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Errore di rete' })
    } finally {
      setNotifyLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Giocatori</h1>

      <div className="flex gap-2 mb-6">
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Players table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-8">
        {loadingPlayers && players.length === 0 ? (
          <p className="text-white/50 text-sm p-4">Caricamento giocatori...</p>
        ) : players.length === 0 ? (
          <p className="text-white/50 text-sm p-4">Nessun giocatore in questa sessione.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-center px-4 py-3">Liv.</th>
                <th className="text-center px-4 py-3">EXP</th>
                <th className="text-center px-4 py-3">Punteggio</th>
                <th className="text-center px-4 py-3">Oro</th>
                <th className="text-left px-4 py-3">Iscritto il</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.userId} className={`border-b border-white/5 ${i === 0 ? 'text-[#FFD700]' : 'text-white'}`}>
                  <td className="px-4 py-3 font-mono text-xs">{p.email || p.userId.slice(0, 8) + '…'}</td>
                  <td className="text-center px-4 py-3">{p.level}</td>
                  <td className="text-center px-4 py-3">{p.exp}</td>
                  <td className="text-center px-4 py-3 font-bold">{p.score}</td>
                  <td className="text-center px-4 py-3">{p.gold}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {new Date(p.joinedAt).toLocaleDateString('it-IT')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {players.length > 0 && (
          <p className="text-white/30 text-xs px-4 py-2">{players.length} giocatori · aggiornamento automatico ogni 30s</p>
        )}
      </div>

      {/* Notify section */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h2 className="text-lg font-bold mb-3">Invia Notifica</h2>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Titolo notifica"
            value={notifyTitle}
            onChange={e => setNotifyTitle(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/30"
          />
          <textarea
            placeholder="Messaggio..."
            value={notifyMessage}
            onChange={e => setNotifyMessage(e.target.value)}
            rows={3}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/30 resize-none"
          />
          <button
            onClick={sendNotify}
            disabled={notifyLoading || !selectedId || !notifyTitle.trim() || !notifyMessage.trim()}
            className="bg-[#3A9DBC] text-white font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {notifyLoading ? 'Invio in corso...' : 'Invia Notifica a tutti i giocatori'}
          </button>

          {feedback && (
            <p className={`text-sm font-medium ${feedback.type === 'success' ? 'text-[#34d399]' : 'text-red-400'}`}>
              {feedback.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
