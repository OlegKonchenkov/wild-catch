'use client'
import { useEffect, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function Landing() {
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const searchParams = useSearchParams()

  // If already authenticated → restore session or go to lobby
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      // Check for an active game session
      const res = await fetch('/api/auth/restore')
      const { sessionId } = await res.json()
      if (sessionId) {
        localStorage.setItem('current_session_id', sessionId)
        router.replace('/game/map')
      } else {
        router.replace('/home')
      }
    })
  }, [supabase, router])

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  const authError = searchParams.get('error')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A1A12; font-family: 'DM Sans', sans-serif; }
        .root {
          min-height: 100svh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 24px 20px; position: relative; overflow: hidden;
        }
        .root::before {
          content: ''; position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(58,188,168,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(58,188,168,0.04) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .orb {
          position: fixed; border-radius: 50%;
          filter: blur(80px); pointer-events: none; z-index: 0;
        }
        .orb-1 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(58,188,168,0.18) 0%, transparent 70%);
          top: -80px; right: -60px;
        }
        .orb-2 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(232,96,47,0.12) 0%, transparent 70%);
          bottom: -60px; left: -40px;
        }
        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 340px;
          background: rgba(15,35,24,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px; padding: 40px 28px;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
          text-align: center;
          animation: fadeUp 0.5s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .logo-icon {
          width: 72px; height: 72px;
          background: linear-gradient(135deg, #3ABCA8, #2AA896);
          border-radius: 22px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 36px; margin-bottom: 16px;
          box-shadow: 0 4px 24px rgba(58,188,168,0.35);
        }
        .title {
          font-family: 'Cinzel', serif;
          font-size: 28px; font-weight: 700;
          color: #fff; letter-spacing: 0.04em; margin-bottom: 6px;
        }
        .sub {
          font-size: 13px; color: rgba(255,255,255,0.4);
          margin-bottom: 36px; line-height: 1.5;
        }
        .btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(135deg, #E8602F, #CC4A1E);
          color: #fff; font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 700; letter-spacing: 0.06em;
          padding: 15px 20px; border-radius: 14px; border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(232,96,47,0.35);
        }
        .btn:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(232,96,47,0.4); }
        .btn:active { transform: translateY(0); }
        .error-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px; padding: 10px 12px; margin-top: 16px;
          font-size: 12.5px; color: #fca5a5; text-align: left;
        }
        .admin-link {
          margin-top: 28px; font-size: 12px;
          color: rgba(255,255,255,0.2); text-align: center; position: relative; z-index: 1;
        }
        .admin-link a {
          color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.2s;
        }
        .admin-link a:hover { color: rgba(255,255,255,0.6); }
        .features {
          display: flex; gap: 8px; margin-bottom: 28px; justify-content: center;
        }
        .feat {
          font-size: 11px; color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 4px 10px;
        }
      `}</style>

      <div className="root">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="card">
          <div className="logo-icon">🌿</div>
          <div className="title">Daimon</div>
          <div className="sub">La prima avventura outdoor italiana.<br />Cattura creature, esplora, sfida gli altri.</div>

          <div className="features">
            <span className="feat">📍 GPS</span>
            <span className="feat">🐾 Creature</span>
            <span className="feat">⚔️ Duelli</span>
          </div>

          <button className="btn" onClick={handleGoogleLogin}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="rgba(255,255,255,0.9)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="rgba(255,255,255,0.9)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="rgba(255,255,255,0.9)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            ENTRA CON GOOGLE
          </button>

          {authError && (
            <div className="error-box">
              <span>⚠</span>
              <span>Accesso non riuscito. Riprova.</span>
            </div>
          )}
        </div>

        <div className="admin-link">
          Sei un organizzatore? <a href="/admin-login">Accesso admin →</a>
        </div>
      </div>
    </>
  )
}

export default function LandingPage() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  )
}
