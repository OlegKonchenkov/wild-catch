'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import PrivacyPolicyModal from '@/components/legal/PrivacyPolicyModal'

interface SessionStats {
  id: string
  name: string
  status: string
  start_at: string | null
  end_at: string | null
  exp: number
  gold: number
  level: number
  creatures_caught: number
  duel_wins: number
  duel_total: number
}

/* ─── tiny helpers ─────────────────────────────── */
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

function StatCell({ val, label, color }: { val: number | string; label: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color ?? '#fff', marginBottom: 2 }}>{val}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

function statusMeta(status: string) {
  if (status === 'active') return { label: 'In corso', color: '#34D399', icon: '🟢' }
  if (status === 'ready')  return { label: 'In attesa', color: '#F7C841', icon: '🟡' }
  if (status === 'ended')  return { label: 'Terminata', color: 'rgba(255,255,255,0.25)', icon: '🏁' }
  return { label: status, color: 'rgba(255,255,255,0.25)', icon: '⚪' }
}

/* ─── main ─────────────────────────────────────── */
function HomeLobby() {
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading]     = useState(true)
  const [user, setUser]           = useState<User | null>(null)
  const [nickname, setNickname]   = useState<string | null>(null)
  const [sessions, setSessions]   = useState<SessionStats[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enteringSessionId, setEnteringSessionId] = useState<string | null>(null)

  // Invite code form
  const [code, setCode]           = useState(searchParams.get('code') ?? '')
  const [gdpr, setGdpr]           = useState(false)
  const [showJoin, setShowJoin]   = useState(!!searchParams.get('code'))
  const [joining, setJoining]     = useState(false)
  const [joinError, setJoinError] = useState('')
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)

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

  async function loadData() {
    // Phase 1 — profile + restore + sessions all in parallel
    const [profileRes, restoreRes, sessionsRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/auth/restore'),
      fetch('/api/game/sessions'),
    ])

    const [profile, restore, sessData] = await Promise.all([
      profileRes.ok ? profileRes.json() : Promise.resolve({}),
      restoreRes.json(),
      sessionsRes.ok ? sessionsRes.json() : Promise.resolve({ sessions: [] }),
    ])

    if (profile.nickname !== undefined) {
      setNickname(profile.nickname)
      setEditNick(profile.nickname ?? '')
    }
    if (profile.gdprAccepted) setGdpr(true)

    const { sessionId } = restore as { sessionId: string | null }
    if (sessionId) localStorage.setItem('current_session_id', sessionId)

    const loaded: SessionStats[] = sessData.sessions ?? []
    setSessions(loaded)

    // Auto-select: prefer active, then the restored session, then the first one
    if (loaded.length > 0) {
      const active = loaded.find(s => s.status === 'active')
      const restored = sessionId ? loaded.find(s => s.id === sessionId) : null
      setSelectedId(active?.id ?? restored?.id ?? null)
    }

    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      setUser(user)
      loadData()
    })
  }, [supabase, router])

  useEffect(() => {
    router.prefetch('/game/map')
  }, [router])

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
    if (!nickname) { setJoinError('Imposta prima il tuo nickname (vedi sopra)'); return }
    setJoining(true); setJoinError('')

    const consentRes = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acceptGdpr: true }),
    })
    if (!consentRes.ok) {
      const consentData = await consentRes.json().catch(() => ({}))
      setJoinError(consentData.error ?? "Impossibile registrare l'accettazione privacy")
      setJoining(false)
      return
    }

    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (!res.ok) { setJoinError(data.error ?? 'Codice non valido'); setJoining(false); return }
    localStorage.setItem('current_session_id', data.sessionId)
    window.location.assign(`/game/map?restored=${data.sessionId}`)
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

  function enterSession(sess: SessionStats) {
    if (enteringSessionId) return
    setEnteringSessionId(sess.id)
    localStorage.setItem('current_session_id', sess.id)
    router.push(`/game/map?restored=${sess.id}`)
  }

  const googleName  = user?.user_metadata?.full_name ?? user?.email ?? 'Giocatore'
  const displayName = nickname ?? googleName.split(' ')[0]
  const avatarUrl   = user?.user_metadata?.avatar_url
  const initials    = displayName.slice(0, 2).toUpperCase()
  const needsNickname  = nickname === null || nickname === ''
  const privacyController = process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER
  const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL

  const selected = sessions.find(s => s.id === selectedId) ?? null
  const isPlayable = selected && (selected.status === 'active' || selected.status === 'ready' || selected.status === 'ended')

  if (loading) {
    return (
      <div style={{
        minHeight: '100svh', background: 'linear-gradient(160deg, #0D1E2E 0%, #0A1520 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');
          @keyframes wc-spin { to { transform: rotate(360deg); } }
          @keyframes wc-pulse { 0%,100% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } }
          @keyframes wc-ripple {
            0% { transform: scale(0.6); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .wc-loader-ring {
            width: 72px; height: 72px; border-radius: 50%; position: relative;
            border: 3px solid rgba(58,188,168,0.15);
            border-top-color: #3ABCA8;
            animation: wc-spin 0.9s linear infinite;
          }
          .wc-loader-ring::before, .wc-loader-ring::after {
            content: ''; position: absolute; border-radius: 50%;
            border: 3px solid transparent;
          }
          .wc-loader-ring::before {
            inset: 8px; border-top-color: rgba(247,200,65,0.6);
            animation: wc-spin 1.4s linear infinite reverse;
          }
          .wc-loader-ring::after {
            inset: 18px; border-top-color: rgba(58,157,188,0.5);
            animation: wc-spin 2s linear infinite;
          }
          .wc-ripple {
            position: absolute; inset: 0; border-radius: 50%;
            border: 2px solid rgba(58,188,168,0.4);
            animation: wc-ripple 1.8s ease-out infinite;
          }
          .wc-ripple:nth-child(2) { animation-delay: 0.6s; }
          .wc-ripple:nth-child(3) { animation-delay: 1.2s; }
          .wc-dots span {
            width: 7px; height: 7px; border-radius: 50%;
            background: #3ABCA8; display: inline-block;
            animation: wc-pulse 1.2s ease-in-out infinite;
          }
          .wc-dots span:nth-child(2) { animation-delay: 0.2s; background: rgba(58,188,168,0.7); }
          .wc-dots span:nth-child(3) { animation-delay: 0.4s; background: rgba(58,188,168,0.4); }
        `}</style>
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <div className="wc-ripple" />
          <div className="wc-ripple" />
          <div className="wc-ripple" />
          <div className="wc-loader-ring" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: '#3ABCA8', letterSpacing: '0.06em', marginBottom: 8 }}>
            Daimon
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }} className="wc-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    )
  }

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
        .btn-logout { background: rgba(232,93,47,0.1); color: #E8724F; border: 1.5px solid rgba(232,93,47,0.38); box-shadow: 0 2px 10px rgba(232,93,47,0.1); font-weight: 600; }
        .btn-logout:hover:not(:disabled) { background: rgba(232,93,47,0.18); border-color: rgba(232,93,47,0.58); box-shadow: 0 4px 16px rgba(232,93,47,0.22); opacity: 1; transform: translateY(-1px); }
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
        .danger-zone {
          background: rgba(232,93,47,0.06); border: 1px solid rgba(232,93,47,0.2);
          border-radius: 12px; padding: 16px;
        }
        .sess-card {
          width: 100%; text-align: left;
          background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 13px 14px; margin-bottom: 8px;
          cursor: pointer; transition: border-color 0.18s, background 0.18s;
          display: flex; align-items: center; gap: 12;
          font-family: 'DM Sans', sans-serif;
        }
        .sess-card:hover { border-color: rgba(58,188,168,0.3); background: rgba(58,188,168,0.04); }
        .sess-card.selected { border-color: #3ABCA8; background: rgba(58,188,168,0.07); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .fade-in { animation: fadeIn 0.22s ease forwards; }
      `}</style>

      <div style={{ minHeight: '100svh', width: '100%', background: 'linear-gradient(160deg, #0D1E2E 0%, #0A1520 60%)', maxWidth: 480, margin: '0 auto', paddingBottom: 48 }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: '#3ABCA8', letterSpacing: '0.04em' }}>Daimon</span>
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
            Ciao, {displayName}
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
                <button className="btn btn-logout" onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Disconnetti
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

        {/* ── Sessions ── */}
        <Section title="Le tue sessioni">
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '20px 0' }}>
              Nessuna sessione ancora.<br />Partecipa al tuo primo evento!
            </div>
          ) : (
            <>
              {/* Session selector cards */}
              <div>
                {sessions.map(sess => {
                  const sm = statusMeta(sess.status)
                  const dateStr = sess.start_at
                    ? new Date(sess.start_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'
                  const isSelected = sess.id === selectedId
                  return (
                    <button
                      key={sess.id}
                      className={`sess-card${isSelected ? ' selected' : ''}`}
                      style={{ gap: 12 }}
                      onClick={() => setSelectedId(isSelected ? null : sess.id)}
                    >
                      {/* Status dot */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: sm.color, flexShrink: 0, boxShadow: sess.status === 'active' ? `0 0 8px ${sm.color}` : 'none' }} />
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sess.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                          {dateStr} · <span style={{ color: sm.color }}>{sm.label}</span>
                        </div>
                      </div>
                      {/* Quick stats */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#F7C841' }}>⚡ {sess.exp}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Lv {sess.level}</span>
                      </div>
                      {/* Chevron */}
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>›</span>
                    </button>
                  )
                })}
              </div>

              {/* Expanded stats for selected session */}
              {selected && (
                <div className="fade-in" style={{ marginTop: 4, marginBottom: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(58,188,168,0.2)', borderRadius: 16, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#3ABCA8', letterSpacing: '0.04em' }}>{selected.name}</div>
                    {selected.end_at && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        Terminata il {new Date(selected.end_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* 6-stat grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '12px 12px 4px' }}>
                    <StatCell val={selected.exp}             label="EXP"      color="#F7C841" />
                    <StatCell val={`Lv ${selected.level}`}  label="Livello"   color="#C084FC" />
                    <StatCell val={selected.gold}           label="Oro"       color="#F59E0B" />
                    <StatCell val={selected.creatures_caught} label="Creature" color="#34D399" />
                    <StatCell val={selected.duel_total}     label="Duelli"    color="#60A5FA" />
                    <StatCell
                      val={selected.duel_total > 0 ? `${Math.round((selected.duel_wins / selected.duel_total) * 100)}%` : '—'}
                      label="Win rate"
                      color="#F472B6"
                    />
                  </div>

                  {/* Rank label */}
                  <div style={{ padding: '8px 12px 12px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                      {selected.duel_total > 0 && `${selected.duel_wins} vittorie su ${selected.duel_total} duelli`}
                    </div>
                  </div>

                  {/* Enter session CTA */}
                  {isPlayable && (
                    <div style={{ padding: '0 12px 14px' }}>
                      <button
                        className="btn btn-teal"
                        style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.03em', padding: '14px 16px', boxShadow: '0 4px 20px rgba(58,188,168,0.35)' }}
                        disabled={enteringSessionId !== null}
                        onClick={() => enterSession(selected)}
                      >
                        {enteringSessionId === selected.id ? (
                          <><span className="spinner" /> Apertura...</>
                        ) : selected.status === 'ended' ? '🏁 Visualizza sessione' : selected.status === 'active' ? '▶ Entra nella sessione' : '▶ Rientra nella sessione'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── Join event ── */}
        <Section title="Partecipa a un evento">
          <Card>
            <div className="accordion-header" onClick={() => setShowJoin(v => !v)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(247,200,65,0.12)', border: '1px solid rgba(247,200,65,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎟️</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Inserisci codice invito</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Ricevuto dall&apos;organizzatore dell&apos;evento</div>
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
                    Ho letto l&apos;
                    <button
                      type="button"
                      onClick={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        setShowPrivacyPolicy(true)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        color: '#3ABCA8',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: 'inherit',
                        lineHeight: 'inherit',
                      }}
                    >
                      Informativa Privacy
                    </button>
                    {' '}e acconsento al trattamento dei dati necessari per partecipare all&apos;evento.
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

      </div>

      <PrivacyPolicyModal
        open={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
        controllerName={privacyController}
        contactEmail={privacyEmail}
      />
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
