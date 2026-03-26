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

/* ─── tiny helpers ─────────────────────────────── */
function Stat({ val, label, icon }: { val: number | string; label: string; icon: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{val}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{icon} {label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px 20px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${accent}12, transparent)` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent ? accent + '33' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 16, overflow: 'hidden',
    }}>{children}</div>
  )
}

/* ─── main ─────────────────────────────────────── */
function HomeLobby() {
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser]           = useState<User | null>(null)
  const [nickname, setNickname]   = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<{ id: string; name: string } | null>(null)
  const [history, setHistory]     = useState<SessionHistory[]>([])
  const [totalCreatures, setTotalCreatures] = useState(0)

  // Invite code form
  const [code, setCode]           = useState(searchParams.get('code') ?? '')
  const [gdpr, setGdpr]           = useState(false)
  const [showJoin, setShowJoin]   = useState(!!searchParams.get('code'))
  const [joining, setJoining]     = useState(false)
  const [joinError, setJoinError] = useState('')

  // Nickname prompt
  const [nickInput, setNickInput] = useState('')
  const [nickSaving, setNickSaving] = useState(false)
  const [nickError, setNickError]   = useState('')

  // Settings panel
  const [showSettings, setShowSettings] = useState(false)
  const [editNick, setEditNick]   = useState('')
  const [savingNick, setSavingNick] = useState(false)
  const [editingNickInline, setEditingNickInline] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]   = useState(false)
  const [settingMsg, setSettingMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      setUser(user)
      loadData(user.id)
    })
  }, [supabase, router])

  async function loadData(userId: string) {
    // Phase 1 — profile + restore in parallel (both independent)
    const [profileRes, restoreRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/auth/restore'),
    ])

    const [profile, restore] = await Promise.all([
      profileRes.ok ? profileRes.json() : Promise.resolve({}),
      restoreRes.json(),
    ])

    if (profile.nickname !== undefined) {
      setNickname(profile.nickname)
      setEditNick(profile.nickname ?? '')
    }

    const { sessionId } = restore as { sessionId: string | null }
    if (sessionId) localStorage.setItem('current_session_id', sessionId)

    // Phase 2 — session name + history + creature count all in parallel
    await Promise.all([
      // Session name (only if we have a sessionId)
      sessionId
        ? supabase.from('sessions').select('name').eq('id', sessionId).single()
            .then(({ data: s }) => setActiveSession({ id: sessionId, name: s?.name ?? 'Evento' }))
        : Promise.resolve(),

      // Session history
      supabase
        .from('player_sessions')
        .select('session_id, exp, joined_at, sessions(name, status, start_at)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(10)
        .then(({ data: ps }) => { if (ps) setHistory(ps as unknown as SessionHistory[]) }),

      // Total creatures
      supabase
        .from('player_creatures')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .then(({ count }) => setTotalCreatures(count ?? 0)),
    ])
  }

  async function saveNickname(nick: string) {
    setNickSaving(true); setNickError('')
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nick }),
    })
    const d = await res.json()
    if (!res.ok) { setNickError(d.error ?? 'Errore'); setNickSaving(false); return false }
    setNickname(nick); setNickSaving(false); return true
  }

  async function handleJoin() {
    if (!code || code.length < 4 || !gdpr || joining) return
    // Require nickname before joining
    if (!nickname) { setJoinError('Imposta prima il tuo nickname (vedi sopra)'); return }
    setJoining(true); setJoinError('')
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (!res.ok) { setJoinError(data.error ?? 'Codice non valido'); setJoining(false); return }
    localStorage.setItem('current_session_id', data.sessionId)
    router.push('/game/map')
  }

  async function handleUpdateNick() {
    setSavingNick(true); setSettingMsg(null)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: editNick }),
    })
    const d = await res.json()
    if (!res.ok) { setSettingMsg({ ok: false, text: d.error ?? 'Errore' }) }
    else { setNickname(editNick); setSettingMsg({ ok: true, text: 'Nickname aggiornato!' }) }
    setSavingNick(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'ELIMINA') return
    setDeleting(true)
    localStorage.removeItem('current_session_id')
    await fetch('/api/profile', { method: 'DELETE' })
    await supabase.auth.signOut()
    router.replace('/')
  }

  async function handleSignOut() {
    localStorage.removeItem('current_session_id')
    await supabase.auth.signOut()
    router.replace('/')
  }

  const googleName  = user?.user_metadata?.full_name ?? user?.email ?? 'Giocatore'
  const displayName = nickname ?? googleName.split(' ')[0]
  const avatarUrl   = user?.user_metadata?.avatar_url
  const initials    = displayName.slice(0, 2).toUpperCase()
  const sessionsPlayed = history.length
  const totalExp       = history.reduce((s, ps) => s + (ps.exp ?? 0), 0)
  const needsNickname  = nickname === null || nickname === ''

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A1520; font-family: 'DM Sans', sans-serif; min-height: 100svh; }
        .hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0; }
        .input {
          width: 100%;
          background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 12px 14px;
          font-family: 'DM Sans', sans-serif; font-size: 16px; color: #fff; outline: none;
          transition: border-color 0.2s;
        }
        .input::placeholder { color: rgba(255,255,255,0.2); font-size: 14px; }
        .input:focus { border-color: #3ABCA8; }
        .input.code-style {
          text-align: center; font-size: 20px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
        }
        .input.code-style:focus { border-color: #F7C841; }
        .btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-family: 'DM Sans', sans-serif; font-weight: 700; letter-spacing: 0.04em;
          border: none; border-radius: 12px; cursor: pointer; width: 100%;
          transition: opacity 0.2s, transform 0.15s;
          padding: 13px 16px; font-size: 14px;
        }
        .btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .btn-teal { background: #3ABCA8; color: #fff; box-shadow: 0 3px 14px rgba(58,188,168,0.3); }
        .btn-gold { background: linear-gradient(135deg, #F7C841, #E0B020); color: #0F1F2E; box-shadow: 0 3px 14px rgba(247,200,65,0.3); }
        .btn-red  { background: rgba(232,93,47,0.15); color: #E85D2F; border: 1px solid rgba(232,93,47,0.3); box-shadow: none; }
        .btn-ghost { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); box-shadow: none; border: 1px solid rgba(255,255,255,0.08); }
        .msg { border-radius: 8px; padding: 9px 12px; font-size: 12.5px; margin-top: 8px; }
        .msg.err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        .msg.ok  { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); color: #6ee7b7; }
        .gdpr-wrap { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; cursor: pointer; }
        .gdpr-box {
          width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px;
          border: 1.5px solid rgba(255,255,255,0.2); border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; background: transparent;
        }
        .gdpr-box.on { background: #3ABCA8; border-color: #3ABCA8; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 14px; height: 14px; display: inline-block;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle;
        }
        .spinner.dark { border: 2px solid rgba(15,31,46,0.3); border-top-color: #0F1F2E; }
        .accordion-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; cursor: pointer;
        }
        .accordion-body { padding: 0 18px 18px; border-top: 1px solid rgba(255,255,255,0.06); }
        .chevron { color: rgba(255,255,255,0.3); transition: transform 0.2s; font-style: normal; }
        .chevron.open { transform: rotate(180deg); }
        .hi-item {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 12px 14px; margin-bottom: 8px;
        }
        .hi-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          background: rgba(58,157,188,0.1); border: 1px solid rgba(58,157,188,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .danger-zone {
          background: rgba(232,93,47,0.06); border: 1px solid rgba(232,93,47,0.2);
          border-radius: 12px; padding: 16px;
        }
      `}</style>

      <div style={{ minHeight: '100svh', width: '100%', background: 'linear-gradient(160deg, #0D1E2E 0%, #0A1520 60%)', maxWidth: 480, margin: '0 auto', paddingBottom: 48 }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: '#3ABCA8', letterSpacing: '0.04em' }}>🌿 WildCatch</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => { setShowSettings(v => !v); setSettingMsg(null); setEditingNickInline(false) }}
              style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(58,188,168,0.4)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(58,188,168,0.15)', color: '#3ABCA8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              title="Profilo"
            >
              {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </button>
          </div>
        </div>

        {/* ── Welcome ── */}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
            Ciao, {displayName} 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {user?.email}
          </div>
        </div>

        {/* ── Inline nickname ── */}
        {!needsNickname && !showSettings && (
          <div style={{ padding: '10px 20px 0' }}>
            {!editingNickInline ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(58,188,168,0.08)', border: '1px solid rgba(58,188,168,0.18)', borderRadius: 20, padding: '5px 12px 5px 10px' }}>
                <span style={{ fontSize: 13 }}>🎮</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>{nickname}</span>
                <button
                  onClick={() => { setEditingNickInline(true); setEditNick(nickname ?? ''); setSettingMsg(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: '0 0 0 4px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                  title="Modifica nickname"
                >
                  ✏️
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={editNick}
                    onChange={e => setEditNick(e.target.value)}
                    maxLength={24}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-teal"
                    style={{ width: 'auto', paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}
                    disabled={editNick.trim().length < 2 || savingNick}
                    onClick={async () => { await handleUpdateNick(); setEditingNickInline(false) }}
                  >
                    {savingNick ? <span className="spinner" /> : 'Salva'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ width: 'auto', paddingLeft: 12, paddingRight: 12, flexShrink: 0 }}
                    onClick={() => { setEditingNickInline(false); setEditNick(nickname ?? '') }}
                  >
                    ✕
                  </button>
                </div>
                {settingMsg && <div className={`msg ${settingMsg.ok ? 'ok' : 'err'}`}>{settingMsg.ok ? '✓' : '⚠'} {settingMsg.text}</div>}
              </div>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '20px 20px 0' }}>
          <Stat val={totalCreatures} label="Creature" icon="🐾" />
          <Stat val={sessionsPlayed} label="Sessioni"  icon="🎮" />
          <Stat val={totalExp}       label="EXP tot"   icon="⚡" />
        </div>

        {/* ── Nickname prompt (one-time) ── */}
        {needsNickname && !showSettings && (
          <Section title="🎯 Imposta il tuo nickname">
            <Card accent="#F7C841">
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Come vuoi essere chiamato?</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>Verrà mostrato nelle classifiche e nelle statistiche</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="es. WildHunter99"
                    value={nickInput}
                    onChange={e => setNickInput(e.target.value)}
                    maxLength={24}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-gold"
                    style={{ width: 'auto', paddingLeft: 20, paddingRight: 20 }}
                    disabled={nickInput.trim().length < 2 || nickSaving}
                    onClick={async () => { const ok = await saveNickname(nickInput.trim()); if (ok) setNickInput('') }}
                  >
                    {nickSaving ? <span className="spinner dark" /> : 'Salva'}
                  </button>
                </div>
                {nickError && <div className="msg err">⚠ {nickError}</div>}
              </div>
            </Card>
          </Section>
        )}

        {/* ── Settings panel ── */}
        {showSettings && (
          <Section title="Impostazioni profilo">
            <Card>
              {/* Nickname */}
              <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>NICKNAME</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Inserisci nickname" value={editNick} onChange={e => setEditNick(e.target.value)} maxLength={24} style={{ flex: 1 }} />
                  <button
                    className="btn btn-teal"
                    style={{ width: 'auto', paddingLeft: 18, paddingRight: 18 }}
                    disabled={editNick.trim().length < 2 || savingNick}
                    onClick={handleUpdateNick}
                  >
                    {savingNick ? <span className="spinner" /> : 'Salva'}
                  </button>
                </div>
                {settingMsg && <div className={`msg ${settingMsg.ok ? 'ok' : 'err'}`}>{settingMsg.ok ? '✓' : '⚠'} {settingMsg.text}</div>}
              </div>

              {/* Account info */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>ACCOUNT</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>📧 {user?.email}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                  Registrato il {user?.created_at ? new Date(user.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </div>
              </div>

              {/* Sign out */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button className="btn btn-ghost" onClick={handleSignOut}>
                  🚪 Disconnetti
                </button>
              </div>

              {/* Delete account */}
              <div style={{ padding: '16px 18px' }}>
                <div className="danger-zone">
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E85D2F', marginBottom: 4 }}>⚠ Elimina account</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.5 }}>
                    Tutti i tuoi dati verranno eliminati permanentemente. Questa azione è irreversibile.
                    Scrivi <strong style={{ color: '#E85D2F' }}>ELIMINA</strong> per confermare.
                  </div>
                  <input
                    className="input"
                    placeholder='Scrivi "ELIMINA" per confermare'
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  <button
                    className="btn btn-red"
                    disabled={deleteConfirm !== 'ELIMINA' || deleting}
                    onClick={handleDeleteAccount}
                  >
                    {deleting ? <><span className="spinner" /> Eliminazione...</> : '🗑 Elimina account definitivamente'}
                  </button>
                </div>
              </div>
            </Card>
          </Section>
        )}

        {/* ── Active session ── */}
        {activeSession && (
          <Section title="Evento in corso">
            <Card accent="#3ABCA8">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Sessione attiva</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{activeSession.name}</div>
                </div>
                <button
                  onClick={() => router.push('/game/map')}
                  style={{ background: '#3ABCA8', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 10, whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(58,188,168,0.3)', transition: 'opacity 0.2s' }}
                >
                  ▶ Continua
                </button>
              </div>
            </Card>
          </Section>
        )}

        {/* ── Join event ── */}
        <Section title="Partecipa a un evento">
          <Card>
            <div className="accordion-header" onClick={() => setShowJoin(v => !v)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(247,200,65,0.12)', border: '1px solid rgba(247,200,65,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎟️</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Inserisci codice invito</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Ricevuto dall'organizzatore dell'evento</div>
                </div>
              </div>
              <em className={`chevron ${showJoin ? 'open' : ''}`}>⌄</em>
            </div>

            {showJoin && (
              <div className="accordion-body">
                <input
                  className="input code-style"
                  type="text"
                  placeholder="es. WILD2024"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoCapitalize="characters"
                  style={{ marginTop: 14 }}
                />

                <label className="gdpr-wrap" onClick={() => setGdpr(v => !v)}>
                  <div className={`gdpr-box ${gdpr ? 'on' : ''}`}>
                    {gdpr && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    Accetto il trattamento dei dati personali ai sensi del GDPR (art. 6) per partecipare all'evento
                  </span>
                </label>

                {needsNickname && (
                  <div className="msg err" style={{ marginTop: 12 }}>
                    ⚠ Imposta prima il tuo nickname (vedi sezione sopra)
                  </div>
                )}

                <button
                  className="btn btn-gold"
                  style={{ marginTop: 14 }}
                  disabled={!code || code.length < 4 || !gdpr || joining || needsNickname}
                  onClick={handleJoin}
                >
                  {joining ? <><span className="spinner dark" /> Accesso...</> : '🎮 PARTECIPA ALL\'EVENTO'}
                </button>

                {joinError && <div className="msg err">⚠ {joinError}</div>}
              </div>
            )}
          </Card>
        </Section>

        {/* ── Session history ── */}
        <Section title="Storico sessioni">
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '20px 0' }}>
              Nessuna sessione ancora.<br />Partecipa al tuo primo evento!
            </div>
          ) : (
            <div>
              {history.map(ps => {
                const isPlayable = ps.sessions?.status === 'active' || ps.sessions?.status === 'ready'
                return (
                  <div key={ps.session_id} className="hi-item">
                    <div className="hi-icon">🎮</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{ps.sessions?.name ?? 'Sessione'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {ps.sessions?.start_at
                          ? new Date(ps.sessions.start_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                          : new Date(ps.joined_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                        }
                        {' · '}
                        <span style={{ color: ps.sessions?.status === 'active' ? '#34D399' : ps.sessions?.status === 'ready' ? '#F7C841' : 'rgba(255,255,255,0.25)' }}>
                          {ps.sessions?.status === 'ended' ? 'Terminata' : ps.sessions?.status === 'active' ? 'In corso' : ps.sessions?.status === 'ready' ? 'In attesa' : ps.sessions?.status ?? '—'}
                        </span>
                      </div>
                    </div>
                    {isPlayable ? (
                      <button
                        onClick={() => { localStorage.setItem('current_session_id', ps.session_id); router.push('/game/map') }}
                        style={{ background: '#3ABCA8', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 8, whiteSpace: 'nowrap' }}
                      >
                        ▶ Gioca
                      </button>
                    ) : ps.sessions?.status === 'ended' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F7C841', whiteSpace: 'nowrap' }}>⚡ {ps.exp ?? 0}</div>
                        <button
                          onClick={() => { localStorage.setItem('current_session_id', ps.session_id); router.push('/game/map') }}
                          style={{ background: 'rgba(123,77,184,0.3)', color: '#C084FC', border: '1px solid rgba(123,77,184,0.5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}
                        >
                          👁 Vedi
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F7C841', whiteSpace: 'nowrap' }}>⚡ {ps.exp ?? 0}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
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
