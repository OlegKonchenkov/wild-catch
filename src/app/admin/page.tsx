'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminInlineSpinner, AdminListSkeleton } from '@/components/admin/AdminLoading'

interface Stats {
  sessionName: string; sessionStatus: string
  endAt: string | null; startAt: string | null; durationMinutes: number | null
  playerCount: number; encounterTotal: number; caughtCount: number
  duelCount: number; activeDuels: number
  bossCount: number; bossWins: number
}

type DetailType = 'catches' | 'encounters' | 'duels' | 'bosses'

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
      if (remaining <= 0) { setDisplay('Terminata'); setPct(0); setUrgent(false); return }
      setDisplay(formatDuration(remaining))
      setUrgent(remaining < 5 * 60 * 1000)
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

const DETAIL_CONFIG: Record<DetailType, { title: string; icon: string; emptyLabel: string }> = {
  catches:    { title: 'Catture',           icon: '🎯', emptyLabel: 'Nessuna cattura ancora' },
  encounters: { title: 'Incontri',          icon: '⚔️', emptyLabel: 'Nessun incontro ancora' },
  duels:      { title: 'Duelli',            icon: '🥊', emptyLabel: 'Nessun duello ancora' },
  bosses:     { title: 'Incontri Boss',     icon: '👑', emptyLabel: 'Nessun boss affrontato' },
}

const RARITY_COLOR: Record<string, string> = {
  comune: '#94a3b8', non_comune: '#34d399', raro: '#3A9DBC',
  epico: '#7B4DB8', leggendario: '#F7C841',
}

function DetailRow({ detail, row }: { detail: DetailType; row: any }) {
  if (detail === 'catches') {
    const creature = row.creatures as any
    const player = row.player_sessions?.profiles as any
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">🎯</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{creature?.name ?? '?'}</p>
            <p className="text-xs text-white/40">{player?.nickname ?? row.player_sessions?.user_id?.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {creature?.rarity && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
              color: RARITY_COLOR[creature.rarity] ?? '#94a3b8',
              background: `${RARITY_COLOR[creature.rarity] ?? '#94a3b8'}20`,
            }}>{creature.rarity}</span>
          )}
          <span className="text-[10px] text-white/30">
            {new Date(row.caught_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    )
  }
  if (detail === 'encounters') {
    const creature = row.creatures as any
    const player = row.player_sessions?.profiles as any
    const statusColor: Record<string, string> = { caught: '#34d399', fled: '#ef4444', active: '#F7C841' }
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">⚔️</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{creature?.name ?? '?'}</p>
            <p className="text-xs text-white/40">{player?.nickname ?? row.player_sessions?.user_id?.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
            color: statusColor[row.status] ?? '#94a3b8',
            background: `${statusColor[row.status] ?? '#94a3b8'}20`,
          }}>{row.status}</span>
          <span className="text-[10px] text-white/30">
            {new Date(row.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    )
  }
  if (detail === 'duels') {
    const statusColor: Record<string, string> = { active: '#F7C841', completed: '#34d399', cancelled: '#ef4444' }
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">🥊</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">Duello</p>
            <p className="text-xs text-white/40">
              {row.winner_id ? `Vincitore: ${row.winner_id.slice(0, 8)}…` : 'In corso'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
            color: statusColor[row.status] ?? '#94a3b8',
            background: `${statusColor[row.status] ?? '#94a3b8'}20`,
          }}>{row.status}</span>
          <span className="text-[10px] text-white/30">
            {new Date(row.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    )
  }
  if (detail === 'bosses') {
    const statusColor: Record<string, string> = { won: '#34d399', lost: '#ef4444', active: '#F7C841' }
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">👑</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">Boss Fight</p>
            <p className="text-xs text-white/40">
              {Array.isArray(row.boss_lineup) ? `${row.boss_lineup.length} boss` : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
            color: statusColor[row.status] ?? '#94a3b8',
            background: `${statusColor[row.status] ?? '#94a3b8'}20`,
          }}>{row.status}</span>
          <span className="text-[10px] text-white/30">
            {new Date(row.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    )
  }
  return null
}

function DetailModal({ detail, sessionId, onClose }: {
  detail: DetailType; sessionId: string; onClose: () => void
}) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const cfg = DETAIL_CONFIG[detail]

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/dashboard?sessionId=${sessionId}&detail=${detail}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [detail, sessionId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0D1E2E] border border-white/15 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white">{cfg.icon} {cfg.title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">{rows.length} risultati</span>
            <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
          </div>
        </div>
        <div className="px-5 overflow-y-auto flex-1 py-2">
          {loading ? (
            <AdminListSkeleton rows={6} itemClassName="h-10" />
          ) : rows.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">{cfg.emptyLabel}</p>
          ) : (
            rows.map((row, i) => <DetailRow key={row.id ?? i} detail={detail} row={row} />)
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notifText, setNotifText] = useState('')
  const [activeDetail, setActiveDetail] = useState<DetailType | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const loadSessions = () =>
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0] && !selectedId) setSelectedId(data[0].id) } })

  useEffect(() => {
    loadSessions().then(() => setLoadingSessions(false), () => setLoadingSessions(false))
    const channel = supabase
      .channel('admin-dashboard-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return
    const fetchStats = () => {
      setLoadingStats(true)
      fetch(`/api/admin/dashboard?sessionId=${selectedId}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => { setStats(data); setError(null) })
        .catch(e => setError(`Errore caricamento stats (${e})`))
        .finally(() => setLoadingStats(false))
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
      body: JSON.stringify({ sessionId: selectedId, title: 'Annuncio', message: notifText }),
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
        {!loadingSessions && sessions.length === 0 && (
          <p className="text-white/40 text-xs mt-2">Nessuna sessione disponibile.</p>
        )}
      </div>

      {loadingStats && !stats && (
        <div className="space-y-4 mb-5">
          <AdminListSkeleton rows={1} itemClassName="h-[44px]" />
          <AdminListSkeleton rows={4} itemClassName="h-[132px]" className="grid grid-cols-2 md:grid-cols-4 gap-3" />
          <AdminListSkeleton rows={2} itemClassName="h-[72px]" className="grid grid-cols-2 gap-3" />
          <AdminListSkeleton rows={2} itemClassName="h-[44px]" />
        </div>
      )}

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

          {/* Live timer */}
          <LiveTimer stats={stats} />

          {/* Stats grid — clickable */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {([
              { label: 'Giocatori', value: stats.playerCount, color: '#3A9DBC', icon: '👤', detail: null },
              { label: 'Catture', value: stats.caughtCount, color: '#34d399', icon: '🎯', detail: 'catches' as DetailType },
              { label: 'Incontri', value: stats.encounterTotal, color: '#E85D2F', icon: '⚔️', detail: 'encounters' as DetailType },
              { label: 'Duelli', value: stats.duelCount, color: '#7B4DB8', icon: '🥊', detail: 'duels' as DetailType },
              { label: 'Boss Fight', value: stats.bossCount, color: '#F7C841', icon: '👑', detail: 'bosses' as DetailType },
            ] as const).map(({ label, value, color, icon, detail }) => (
              <div
                key={label}
                onClick={() => detail && selectedId && setActiveDetail(detail)}
                className={`bg-white/5 border border-white/10 rounded-xl p-4 text-center transition-colors ${
                  detail ? 'cursor-pointer hover:bg-white/10 hover:border-white/20 active:scale-95' : ''
                }`}
              >
                <p className="text-2xl mb-1">{icon}</p>
                <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
                {detail && <p className="text-[9px] text-white/20 mt-0.5">Tocca per dettagli</p>}
              </div>
            ))}
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div
              onClick={() => selectedId && setActiveDetail('catches')}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
            >
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

          {/* Boss secondary stat */}
          {stats.bossCount > 0 && (
            <div
              onClick={() => selectedId && setActiveDetail('bosses')}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between mb-5 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div>
                <p className="text-xs text-white/50">Boss sconfitti</p>
                <p className="text-xl font-bold text-[#F7C841] mt-0.5">{stats.bossWins} / {stats.bossCount}</p>
              </div>
              <span className="text-2xl opacity-40">👑</span>
            </div>
          )}

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

      {/* Detail modal */}
      {activeDetail && selectedId && (
        <DetailModal
          detail={activeDetail}
          sessionId={selectedId}
          onClose={() => setActiveDetail(null)}
        />
      )}
    </div>
  )
}
