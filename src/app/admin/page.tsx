'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  sessionName: string; sessionStatus: string
  endAt: string | null; startAt: string | null; durationMinutes: number | null
  playerCount: number; encounterTotal: number; caughtCount: number
  duelCount: number; activeDuels: number
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bozza', ready: 'Pronta', active: 'Attiva', ended: 'Terminata',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', ready: '#F7C841', active: '#34d399', ended: '#ef4444',
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function resolveEndAt(stats: Stats): Date | null {
  if (stats.endAt) return new Date(stats.endAt)
  if (stats.startAt && stats.durationMinutes) {
    return new Date(new Date(stats.startAt).getTime() + stats.durationMinutes * 60000)
  }
  return null
}

function LiveTimer({ stats }: { stats: Stats }) {
  const [display, setDisplay] = useState('')
  const [pct, setPct] = useState(100)
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    function tick() {
      const end = resolveEndAt(stats)
      if (!end) { setDisplay('--:--'); setPct(100); return }

      const now = Date.now()
      const remaining = end.getTime() - now

      if (remaining <= 0) {
        setDisplay('Terminata'); setPct(0); setUrgent(false); return
      }

      setDisplay(formatDuration(remaining))
      setUrgent(remaining < 5 * 60 * 1000)

      // Progress from start to end
      if (stats.startAt) {
        const total = end.getTime() - new Date(stats.startAt).getTime()
        const elapsed = now - new Date(stats.startAt).getTime()
        setPct(Math.max(0, Math.min(100, 100 - (elapsed / total) * 100)))
      }
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [stats.endAt, stats.startAt, stats.durationMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  if (stats.sessionStatus !== 'active') return null

  return (
    <div className={`rounded-2xl border p-4 mb-5 ${urgent ? 'border-red-500/40 bg-red-500/8' : 'border-[#34d399]/30 bg-[#34d399]/6'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Tempo rimasto</span>
        {urgent && <span className="text-xs text-red-400 font-bold animate-pulse">⚠️ Meno di 5 minuti!</span>}
      </div>
      <p className={`text-4xl font-mono font-bold tracking-tight ${urgent ? 'text-red-400' : 'text-[#34d399]'}`}>
        {display}
      </p>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-red-400' : 'bg-[#34d399]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {stats.startAt && (
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>Avviata {new Date(stats.startAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
          {resolveEndAt(stats) && (
            <span>Fine prevista {resolveEndAt(stats)!.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifText, setNotifText] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const loadSessions = () =>
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0] && !selectedId) setSelectedId(data[0].id) } })

  useEffect(() => {
    loadSessions()
    const channel = supabase
      .channel('admin-dashboard-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return
    const fetchStats = () => {
      fetch(`/api/admin/dashboard?sessionId=${selectedId}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => { setStats(data); setError(null) })
        .catch(e => setError(`Errore caricamento stats (${e})`))
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
    // Re-fetch stats immediately — realtime channel aggiorna sessions dropdown
    fetch(`/api/admin/dashboard?sessionId=${selectedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data) })
  }

  const catchRate = stats && stats.encounterTotal > 0
    ? Math.round((stats.caughtCount / stats.encounterTotal) * 100)
    : null

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>
      {error && (
        <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg p-2">{error}</p>
      )}

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
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: `${STATUS_COLOR[stats.sessionStatus]}18`,
                color: STATUS_COLOR[stats.sessionStatus],
                border: `1px solid ${STATUS_COLOR[stats.sessionStatus]}40`,
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stats.sessionStatus === 'active' ? 'animate-pulse' : ''}`}
                style={{ background: STATUS_COLOR[stats.sessionStatus] }} />
              {STATUS_LABEL[stats.sessionStatus] ?? stats.sessionStatus}
            </span>
            <span className="text-white/40 text-xs">{stats.sessionName}</span>
          </div>

          {/* Live timer — only for active sessions */}
          <LiveTimer stats={stats} />

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Giocatori', value: stats.playerCount, color: '#3A9DBC', icon: '👤' },
              { label: 'Catture', value: stats.caughtCount, color: '#34d399', icon: '🎯' },
              { label: 'Incontri', value: stats.encounterTotal, color: '#E85D2F', icon: '⚔️' },
              { label: 'Duelli', value: stats.duelCount, color: '#7B4DB8', icon: '🥊' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">{icon}</p>
                <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">Tasso cattura</p>
                <p className="text-xl font-bold text-[#34d399] mt-0.5">
                  {catchRate !== null ? `${catchRate}%` : '—'}
                </p>
              </div>
              <span className="text-2xl opacity-40">📊</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">Duelli attivi</p>
                <p className="text-xl font-bold text-[#7B4DB8] mt-0.5">{stats.activeDuels}</p>
              </div>
              <span className="text-2xl opacity-40">⚡</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={notifText} onChange={e => setNotifText(e.target.value)}
                placeholder="Messaggio broadcast ai giocatori..."
                className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
                onKeyDown={e => e.key === 'Enter' && sendNotification()}
              />
              <button onClick={sendNotification}
                disabled={!notifText.trim()}
                className="bg-[#3A9DBC] text-white px-4 rounded-lg font-bold text-sm disabled:opacity-40">
                📢
              </button>
            </div>

            {stats.sessionStatus === 'active' && (
              <button onClick={closeSession}
                className="w-full bg-red-600/20 text-red-400 border border-red-500/30 font-bold py-3 rounded-xl hover:bg-red-600/30 transition-colors">
                🔴 Termina Sessione Ora
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
