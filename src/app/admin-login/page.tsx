'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('resume') !== '1') return
    setLoading(true)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); setError('Accesso non riuscito. Riprova.'); return }
      const { data: isAdmin } = await supabase.rpc('is_admin')
      if (isAdmin) {
        router.replace('/admin')
      } else {
        await supabase.auth.signOut()
        setError('Questo account non ha privilegi admin.')
        setLoading(false)
      }
    })
  }, [searchParams, supabase, router])

  async function handleAdminLogin() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin-login%3Fresume%3D1`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const authError = searchParams.get('error')

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; font-family: var(--font-dm-sans), sans-serif; }

        .ar {
          position: fixed; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 24px 20px;
        }

        /* same BG image, blue-tinted overlay */
        .ar-bg {
          position: absolute; inset: 0;
          background-image: url('/login-bg.webp');
          background-size: cover; background-position: center top;
          z-index: 0;
          animation: bgDrift 18s ease-in-out infinite alternate;
        }
        @keyframes bgDrift {
          from { transform: scale(1.04) translateY(0); }
          to   { transform: scale(1.08) translateY(-12px); }
        }
        .ar-overlay {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(
            160deg,
            rgba(8,16,48,0.88) 0%,
            rgba(4,10,32,0.82) 50%,
            rgba(6,14,40,0.92) 100%
          );
        }
        /* subtle blue hex grid */
        .ar-grid {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background-image:
            linear-gradient(rgba(60,100,220,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(60,100,220,0.06) 1px, transparent 1px);
          background-size: 44px 44px;
        }
        .ar-glow {
          position: absolute; z-index: 2; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
          width: 340px; height: 340px;
          background: radial-gradient(circle, rgba(45,91,227,0.20) 0%, transparent 65%);
          top: -80px; left: 50%; transform: translateX(-50%);
          animation: glowPulse 5s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }

        /* card */
        .ar-card {
          position: relative; z-index: 10;
          width: 100%; max-width: 340px;
          background: rgba(8,18,40,0.88);
          border: 1px solid rgba(60,100,220,0.22);
          border-radius: 24px; padding: 36px 28px 32px;
          backdrop-filter: blur(28px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 24px 60px rgba(0,0,0,0.55),
            0 0 40px rgba(45,91,227,0.12);
          text-align: center;
          animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* shield SVG emblem */
        .ar-emblem {
          width: 60px; height: 60px; margin: 0 auto 16px;
          background: linear-gradient(135deg, rgba(45,91,227,0.2), rgba(20,50,160,0.12));
          border: 1px solid rgba(60,100,220,0.35);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 30px rgba(45,91,227,0.25), inset 0 1px 0 rgba(255,255,255,0.07);
          animation: emblemPulse 4s ease-in-out infinite;
        }
        @keyframes emblemPulse {
          0%,100% { box-shadow: 0 0 24px rgba(45,91,227,0.2), inset 0 1px 0 rgba(255,255,255,0.07); }
          50%      { box-shadow: 0 0 44px rgba(45,91,227,0.38), inset 0 1px 0 rgba(255,255,255,0.1); }
        }

        .ar-title {
          font-family: var(--font-cinzel), serif;
          font-size: 20px; font-weight: 600;
          color: #fff; letter-spacing: 0.08em; margin-bottom: 4px;
        }
        .ar-sub {
          font-size: 12px; color: rgba(255,255,255,0.32);
          letter-spacing: 0.05em; margin-bottom: 28px;
        }

        .ar-divider {
          height: 1px; background: linear-gradient(90deg, transparent, rgba(60,100,220,0.25), transparent);
          margin-bottom: 24px;
        }

        /* stats row */
        .ar-stats {
          display: flex; gap: 1px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; overflow: hidden;
          margin-bottom: 24px;
        }
        .ar-stat {
          flex: 1; padding: 10px 8px; text-align: center;
          background: rgba(8,18,40,0.6);
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .ar-stat + .ar-stat { border-left: 1px solid rgba(255,255,255,0.06); }
        .ar-stat-icon { color: rgba(60,130,220,0.8); }
        .ar-stat-label { font-size: 10px; color: rgba(255,255,255,0.3); letter-spacing: 0.04em; }

        /* button */
        .ar-btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(135deg, #2D5BE3 0%, #1E3FA8 100%);
          color: #fff; font-family: var(--font-dm-sans), sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 15px 20px; border-radius: 12px; border: none;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(45,91,227,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          position: relative; overflow: hidden;
        }
        .ar-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .ar-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(45,91,227,0.5), inset 0 1px 0 rgba(255,255,255,0.12); }
        .ar-btn:active { transform: translateY(0); }
        .ar-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .ar-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ar-error {
          display: flex; align-items: flex-start; gap: 8px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.22);
          border-radius: 10px; padding: 10px 12px; margin-top: 14px; text-align: left;
          font-size: 12.5px; color: #fca5a5; line-height: 1.4;
        }

        .ar-back {
          position: relative; z-index: 10;
          margin-top: 20px; font-size: 12px;
          color: rgba(255,255,255,0.22); text-decoration: none;
          transition: color 0.2s; display: block; text-align: center;
        }
        .ar-back:hover { color: rgba(255,255,255,0.5); }
      `}</style>

      <div className="ar">
        <div className="ar-bg" />
        <div className="ar-overlay" />
        <div className="ar-grid" />
        <div className="ar-glow" />

        <div className="ar-card">
          {/* Shield SVG */}
          <div className="ar-emblem">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z"
                fill="rgba(60,110,230,0.25)" stroke="rgba(100,150,255,0.7)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="rgba(150,190,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="ar-title">Pannello Admin</div>
          <div className="ar-sub">Accesso riservato agli organizzatori</div>
          <div className="ar-divider" />

          {/* Quick-info row */}
          <div className="ar-stats">
            <div className="ar-stat">
              <svg className="ar-stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M14 17.5h7M17.5 14v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span className="ar-stat-label">Sessioni</span>
            </div>
            <div className="ar-stat">
              <svg className="ar-stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span className="ar-stat-label">Giocatori</span>
            </div>
            <div className="ar-stat">
              <svg className="ar-stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
              <span className="ar-stat-label">Creature</span>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div className="ar-spinner" />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {searchParams.get('resume') ? 'Verifica permessi…' : 'Connessione…'}
              </span>
            </div>
          ) : (
            <button className="ar-btn" onClick={handleAdminLogin} disabled={loading}>
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="rgba(255,255,255,0.9)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="rgba(255,255,255,0.9)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="rgba(255,255,255,0.9)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Accedi con Google
            </button>
          )}

          {(error || authError) && (
            <div className="ar-error">
              <span>⚠</span>
              <span>{error || 'Accesso non riuscito. Riprova.'}</span>
            </div>
          )}
        </div>

        <a href="/" className="ar-back">← Torna alla pagina giocatori</a>
      </div>
    </>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  )
}
