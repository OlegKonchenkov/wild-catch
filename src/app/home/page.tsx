'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface SessionHistory {
  session_id: string
  exp: number
  joined_at: string
  sessions: { name: string; status: string; start_at: string | null } | null
}

function HomeLobby() {
  const supabase  = useMemo(() => createClient(), [])
  const router    = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser]         = useState<User | null>(null)
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [history, setHistory]   = useState<SessionHistory[]>([])
  const [totalCreatures, setTotalCreatures] = useState(0)
  const [code, setCode]         = useState(searchParams.get('code') ?? '')
  const [gdpr, setGdpr]         = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joining, setJoining]   = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      setUser(user)
      loadData(user.id)
    })
  }, [supabase, router])

  async function loadData(userId: string) {
    // Active session
    const restoreRes = await fetch('/api/auth/restore')
    const { sessionId } = await restoreRes.json()
    if (sessionId) {
      localStorage.setItem('current_session_id', sessionId)
      setActiveSession(sessionId)
    }

    // Session history
    const { data: ps } = await supabase
      .from('player_sessions')
      .select('session_id, exp, joined_at, sessions(name, status, start_at)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(10)
    if (ps) setHistory(ps as unknown as SessionHistory[])

    // Total creatures across all sessions
    const { count } = await supabase
      .from('player_creatures')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    setTotalCreatures(count ?? 0)
  }

  async function handleJoin() {
    if (!code || code.length < 4 || !gdpr || joining) return
    setJoining(true)
    setJoinError('')
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setJoinError(data.error ?? 'Codice non valido')
      setJoining(false)
      return
    }
    localStorage.setItem('current_session_id', data.sessionId)
    setJoinSuccess('Accesso all\'evento riuscito! Caricamento...')
    setTimeout(() => router.push('/game/map'), 800)
  }

  async function handleSignOut() {
    localStorage.removeItem('current_session_id')
    await supabase.auth.signOut()
    router.replace('/')
  }

  const avatar = user?.user_metadata?.avatar_url
  const name   = user?.user_metadata?.full_name ?? user?.email ?? 'Giocatore'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const sessionsPlayed = history.length
  const totalExp = history.reduce((s, ps) => s + (ps.exp ?? 0), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A1520; font-family: 'DM Sans', sans-serif; min-height: 100svh; }
        .home-root {
          min-height: 100svh;
          background: linear-gradient(160deg, #0D1E2E 0%, #0A1520 60%);
          padding: 0 0 40px;
          max-width: 480px; margin: 0 auto;
        }
        /* Header */
        .top-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .logo {
          font-family: 'Cinzel', serif;
          font-size: 18px; font-weight: 700;
          color: #3ABCA8; letter-spacing: 0.04em;
        }
        .avatar-wrap { display: flex; align-items: center; gap: 10px; }
        .avatar {
          width: 36px; height: 36px; border-radius: 50%;
          border: 2px solid rgba(58,188,168,0.4);
          overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(58,188,168,0.15); color: #3ABCA8;
          font-weight: 700; font-size: 13px;
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sign-out-btn {
          font-size: 11px; color: rgba(255,255,255,0.3);
          background: none; border: none; cursor: pointer;
          transition: color 0.2s; padding: 4px;
        }
        .sign-out-btn:hover { color: rgba(255,255,255,0.6); }

        /* Welcome */
        .welcome {
          padding: 24px 20px 0;
        }
        .welcome-name {
          font-size: 22px; font-weight: 700; color: #fff;
          margin-bottom: 2px;
        }
        .welcome-sub { font-size: 13px; color: rgba(255,255,255,0.35); }

        /* Stats row */
        .stats-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 10px; padding: 20px 20px 0;
        }
        .stat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 14px 12px; text-align: center;
        }
        .stat-val {
          font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 2px;
        }
        .stat-label {
          font-size: 10px; color: rgba(255,255,255,0.35);
          text-transform: uppercase; letter-spacing: 0.06em;
        }

        /* Section */
        .section { padding: 24px 20px 0; }
        .section-title {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(255,255,255,0.3); margin-bottom: 12px;
        }

        /* Active event banner */
        .active-banner {
          background: linear-gradient(135deg, rgba(58,188,168,0.12), rgba(58,188,168,0.06));
          border: 1px solid rgba(58,188,168,0.3);
          border-radius: 16px; padding: 16px 18px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .active-label { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 2px; }
        .active-title { font-size: 15px; font-weight: 700; color: #fff; }
        .resume-btn {
          background: #3ABCA8; color: #fff; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 700;
          padding: 10px 16px; border-radius: 10px; white-space: nowrap;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 2px 12px rgba(58,188,168,0.3);
        }
        .resume-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* Join event */
        .join-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; overflow: hidden;
        }
        .join-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; cursor: pointer;
        }
        .join-header-left { display: flex; align-items: center; gap: 12px; }
        .join-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(247,200,65,0.12); border: 1px solid rgba(247,200,65,0.25);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .join-title { font-size: 15px; font-weight: 600; color: #fff; }
        .join-sub { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 1px; }
        .chevron {
          color: rgba(255,255,255,0.3); font-size: 18px;
          transition: transform 0.2s;
        }
        .chevron.open { transform: rotate(180deg); }
        .join-body { padding: 0 18px 18px; border-top: 1px solid rgba(255,255,255,0.06); }
        .code-input {
          width: 100%; margin-top: 14px;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 13px 16px;
          text-align: center; font-size: 20px; font-weight: 700;
          letter-spacing: 0.25em; color: #fff; text-transform: uppercase;
          font-family: 'DM Sans', monospace; outline: none;
          transition: border-color 0.2s;
        }
        .code-input::placeholder { font-size: 13px; letter-spacing: 0.05em; font-weight: 400; color: rgba(255,255,255,0.2); }
        .code-input:focus { border-color: #F7C841; }
        .gdpr-wrap {
          display: flex; align-items: flex-start; gap: 10px;
          margin-top: 12px; cursor: pointer;
        }
        .gdpr-check {
          width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px;
          border: 1.5px solid rgba(255,255,255,0.2); border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; background: transparent;
        }
        .gdpr-check.on { background: #3ABCA8; border-color: #3ABCA8; }
        .gdpr-text { font-size: 11.5px; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .join-btn {
          width: 100%; margin-top: 14px;
          background: linear-gradient(135deg, #F7C841, #E0B020);
          color: #0F1F2E; font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 800; letter-spacing: 0.05em;
          padding: 14px; border-radius: 12px; border: none;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 3px 16px rgba(247,200,65,0.3);
        }
        .join-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .join-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
        .msg { margin-top: 10px; font-size: 12.5px; border-radius: 8px; padding: 9px 12px; }
        .msg.err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        .msg.ok  { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); color: #6ee7b7; }

        /* History */
        .history-list { display: flex; flex-direction: column; gap: 8px; }
        .history-item {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 12px 14px;
          display: flex; align-items: center; gap: 12px;
        }
        .hi-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          background: rgba(58,157,188,0.1); border: 1px solid rgba(58,157,188,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .hi-name { font-size: 14px; font-weight: 600; color: #fff; }
        .hi-meta { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .hi-exp {
          margin-left: auto; font-size: 13px; font-weight: 700;
          color: #F7C841; white-space: nowrap;
        }
        .empty { font-size: 13px; color: rgba(255,255,255,0.25); text-align: center; padding: 20px 0; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 14px; height: 14px; display: inline-block;
          border: 2px solid rgba(15,31,46,0.4); border-top-color: #0F1F2E;
          border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle;
        }
      `}</style>

      <div className="home-root">
        {/* Top bar */}
        <div className="top-bar">
          <span className="logo">🌿 WildCatch</span>
          <div className="avatar-wrap">
            <div className="avatar">
              {avatar ? <img src={avatar} alt={name} /> : initials}
            </div>
            <button className="sign-out-btn" onClick={handleSignOut} title="Esci">
              Esci
            </button>
          </div>
        </div>

        {/* Welcome */}
        <div className="welcome">
          <div className="welcome-name">Ciao, {name.split(' ')[0]} 👋</div>
          <div className="welcome-sub">Il tuo profilo WildCatch</div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {[
            { val: totalCreatures, label: 'Creature', icon: '🐾' },
            { val: sessionsPlayed, label: 'Sessioni',  icon: '🎮' },
            { val: totalExp,       label: 'EXP tot',  icon: '⚡' },
          ].map(({ val, label, icon }) => (
            <div key={label} className="stat-card">
              <div className="stat-val">{val}</div>
              <div className="stat-label">{icon} {label}</div>
            </div>
          ))}
        </div>

        {/* Active session */}
        {activeSession && (
          <div className="section">
            <div className="section-title">Evento in corso</div>
            <div className="active-banner">
              <div>
                <div className="active-label">Sessione attiva</div>
                <div className="active-title">
                  {history.find(h => h.session_id === activeSession)?.sessions?.name ?? 'Evento'}
                </div>
              </div>
              <button
                className="resume-btn"
                onClick={() => router.push('/game/map')}
              >
                ▶ Continua
              </button>
            </div>
          </div>
        )}

        {/* Join event */}
        <div className="section">
          <div className="section-title">Partecipa a un evento</div>
          <div className="join-card">
            <div className="join-header" onClick={() => setShowJoin(v => !v)}>
              <div className="join-header-left">
                <div className="join-icon">🎟️</div>
                <div>
                  <div className="join-title">Inserisci codice invito</div>
                  <div className="join-sub">Ricevuto dall'organizzatore dell'evento</div>
                </div>
              </div>
              <span className={`chevron ${showJoin ? 'open' : ''}`}>⌄</span>
            </div>

            {showJoin && (
              <div className="join-body">
                <input
                  className="code-input"
                  type="text"
                  placeholder="es. WILD2024"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoCapitalize="characters"
                />

                <label className="gdpr-wrap" onClick={() => setGdpr(v => !v)}>
                  <div className={`gdpr-check ${gdpr ? 'on' : ''}`}>
                    {gdpr && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="gdpr-text">
                    Accetto il trattamento dei dati personali ai sensi del GDPR (art. 6) per partecipare all'evento
                  </span>
                </label>

                <button
                  className="join-btn"
                  disabled={!code || code.length < 4 || !gdpr || joining}
                  onClick={handleJoin}
                >
                  {joining ? <><span className="spinner" /> Accesso...</> : '🎮 PARTECIPA ALL\'EVENTO'}
                </button>

                {joinError   && <div className="msg err">⚠ {joinError}</div>}
                {joinSuccess && <div className="msg ok">✓ {joinSuccess}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Session history */}
        <div className="section">
          <div className="section-title">Storico sessioni</div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="empty">Nessuna sessione ancora.<br />Partecipa al tuo primo evento!</div>
            ) : (
              history.map(ps => (
                <div key={ps.session_id} className="history-item">
                  <div className="hi-icon">🎮</div>
                  <div>
                    <div className="hi-name">{ps.sessions?.name ?? 'Sessione'}</div>
                    <div className="hi-meta">
                      {ps.sessions?.start_at
                        ? new Date(ps.sessions.start_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(ps.joined_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                      }
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>
                        {ps.sessions?.status === 'ended' ? 'Terminata' : ps.sessions?.status === 'active' ? 'In corso' : ps.sessions?.status ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div className="hi-exp">⚡ {ps.exp ?? 0}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeLobby />
    </Suspense>
  )
}
