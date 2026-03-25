'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  sessionName: string; sessionStatus: string; endAt: string | null
  playerCount: number; encounterTotal: number; caughtCount: number
  duelCount: number; activeDuels: number
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [notifText, setNotifText] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) } })
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    const fetchStats = () => {
      fetch(`/api/admin/dashboard?sessionId=${selectedId}`)
        .then(r => r.json()).then(setStats)
    }
    fetchStats()
    const i = setInterval(fetchStats, 10000)
    return () => clearInterval(i)
  }, [selectedId])

  async function sendNotification() {
    if (!selectedId || !notifText.trim()) return
    await fetch('/api/admin/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, title: 'Annuncio', body: notifText }),
    })
    setNotifText('')
  }

  async function closeSession() {
    if (!selectedId || !confirm('Chiudere la sessione ora?')) return
    await fetch('/api/admin/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId }),
    })
    window.location.reload()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>

      {/* Session selector */}
      <div className="mb-4">
        <select
          value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 w-full"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Giocatori', value: stats.playerCount, color: '#3A9DBC' },
              { label: 'Catture', value: stats.caughtCount, color: '#34d399' },
              { label: 'Duelli', value: stats.duelCount, color: '#7B4DB8' },
              { label: 'Incontri', value: stats.encounterTotal, color: '#E85D2F' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={notifText} onChange={e => setNotifText(e.target.value)}
                placeholder="Messaggio broadcast..."
                className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={sendNotification}
                className="bg-[#3A9DBC] text-white px-4 rounded-lg font-bold text-sm">
                📢
              </button>
            </div>

            {stats.sessionStatus === 'active' && (
              <button onClick={closeSession}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">
                🔴 Termina Sessione Ora
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
