'use client'
import { useEffect, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function Landing() {
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
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
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }

        .login-root {
          position: fixed; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-end;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── Background image ── */
        .bg-img {
          position: absolute; inset: 0;
          background-image: url('/login-bg.webp');
          background-size: cover;
          background-position: center top;
          z-index: 0;
          animation: bgDrift 18s ease-in-out infinite alternate;
        }
        @keyframes bgDrift {
          from { transform: scale(1.04) translateY(0px); }
          to   { transform: scale(1.08) translateY(-12px); }
        }

        /* ── Gradient overlays ── */
        .bg-grad-bottom {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(
            to top,
            rgba(4,10,20,0.97) 0%,
            rgba(4,10,20,0.80) 35%,
            rgba(4,10,20,0.30) 60%,
            rgba(4,10,20,0.05) 100%
          );
        }
        .bg-grad-top {
          position: absolute; top: 0; left: 0; right: 0; height: 30%;
          z-index: 1;
          background: linear-gradient(to bottom, rgba(4,10,20,0.55) 0%, transparent 100%);
        }

        /* ── Floating orbs / particles ── */
        .orb {
          position: absolute; border-radius: 50%;
          filter: blur(60px); pointer-events: none; z-index: 1;
        }
        .orb-teal {
          width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(58,188,168,0.22) 0%, transparent 70%);
          top: 15%; right: -40px;
          animation: orbFloat1 8s ease-in-out infinite;
        }
        .orb-coral {
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(232,96,47,0.16) 0%, transparent 70%);
          top: 35%; left: -30px;
          animation: orbFloat2 10s ease-in-out infinite;
        }
        .orb-blue {
          width: 180px; height: 180px;
          background: radial-gradient(circle, rgba(74,120,220,0.14) 0%, transparent 70%);
          bottom: 45%; right: 10%;
          animation: orbFloat3 12s ease-in-out infinite;
        }
        @keyframes orbFloat1 {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(16px) scale(0.97); }
        }
        @keyframes orbFloat3 {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }

        /* ── Particles ── */
        .particles { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
        .particle {
          position: absolute; border-radius: 50%;
          background: rgba(58,188,168,0.55);
          animation: particleRise linear infinite;
        }
        @keyframes particleRise {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-120vh) scale(0.3); opacity: 0; }
        }

        /* ── Logo area ── */
        .logo-wrap {
          position: relative; z-index: 10;
          text-align: center; margin-bottom: 8px;
          animation: fadeDown 0.9s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .logo-emblem {
          width: 64px; height: 64px; margin: 0 auto 10px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(58,188,168,0.15), rgba(58,188,168,0.05));
          border: 1px solid rgba(58,188,168,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          box-shadow: 0 0 40px rgba(58,188,168,0.25), inset 0 1px 0 rgba(255,255,255,0.08);
          animation: emblemPulse 3s ease-in-out infinite;
        }
        @keyframes emblemPulse {
          0%,100% { box-shadow: 0 0 30px rgba(58,188,168,0.2), inset 0 1px 0 rgba(255,255,255,0.08); }
          50%      { box-shadow: 0 0 55px rgba(58,188,168,0.38), inset 0 1px 0 rgba(255,255,255,0.1); }
        }
        .logo-title {
          font-family: 'Cinzel', serif;
          font-size: 38px; font-weight: 700;
          color: #fff; letter-spacing: 0.12em;
          text-shadow: 0 2px 30px rgba(58,188,168,0.4), 0 0 60px rgba(58,188,168,0.15);
        }
        .logo-sub {
          font-size: 11px; font-weight: 400;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.35em; text-transform: uppercase;
          margin-top: 4px;
        }

        /* ── Bottom card ── */
        .bottom-card {
          position: relative; z-index: 10;
          width: 100%; max-width: 390px;
          padding: 28px 24px 40px;
          background: linear-gradient(
            160deg,
            rgba(12,24,40,0.92) 0%,
            rgba(6,14,26,0.96) 100%
          );
          border-top: 1px solid rgba(58,188,168,0.18);
          border-left: 1px solid rgba(255,255,255,0.05);
          border-right: 1px solid rgba(255,255,255,0.05);
          border-radius: 28px 28px 0 0;
          backdrop-filter: blur(24px);
          animation: slideUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.15s both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tagline {
          font-size: 15px; font-weight: 300; font-style: italic;
          color: rgba(255,255,255,0.45);
          text-align: center; margin-bottom: 24px;
          line-height: 1.55;
        }
        .tagline em { font-style: normal; color: rgba(58,188,168,0.85); font-weight: 500; }

        .feat-row {
          display: flex; gap: 16px; justify-content: center;
          margin-bottom: 28px;
        }
        .feat {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 500;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.05em; text-transform: uppercase;
        }
        .feat-icon {
          width: 36px; height: 36px;
          background: rgba(58,188,168,0.08);
          border: 1px solid rgba(58,188,168,0.2);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: rgba(58,188,168,0.75);
        }

        .btn-google {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(135deg, #E8602F 0%, #C8461A 100%);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 16px 20px; border-radius: 14px; border: none;
          cursor: pointer;
          box-shadow: 0 4px 24px rgba(232,96,47,0.38), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          position: relative; overflow: hidden;
        }
        .btn-google::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .btn-google:hover  { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(232,96,47,0.48), inset 0 1px 0 rgba(255,255,255,0.1); }
        .btn-google:active { transform: translateY(0); opacity: 0.9; }

        .divider {
          display: flex; align-items: center; gap: 10px;
          margin: 20px 0; color: rgba(255,255,255,0.15); font-size: 11px;
        }
        .divider::before, .divider::after {
          content: ''; flex: 1;
          height: 1px; background: rgba(255,255,255,0.08);
        }

        .error-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px; padding: 10px 12px; margin-top: 14px;
          font-size: 12.5px; color: #fca5a5;
        }

        .admin-link {
          margin-top: 20px; font-size: 11.5px;
          color: rgba(255,255,255,0.18); text-align: center;
        }
        .admin-link a {
          color: rgba(255,255,255,0.32); text-decoration: none;
          transition: color 0.2s;
        }
        .admin-link a:hover { color: rgba(255,255,255,0.55); }
      `}</style>

      <div className="login-root">
        {/* Background */}
        <div className="bg-img" />
        <div className="bg-grad-bottom" />
        <div className="bg-grad-top" />

        {/* Orbs */}
        <div className="orb orb-teal" />
        <div className="orb orb-coral" />
        <div className="orb orb-blue" />

        {/* Floating particles */}
        <div className="particles">
          {[
            { left: '12%',  size: 3, dur: '14s', delay: '0s'   },
            { left: '28%',  size: 2, dur: '18s', delay: '3s'   },
            { left: '45%',  size: 4, dur: '11s', delay: '1.5s' },
            { left: '62%',  size: 2, dur: '16s', delay: '5s'   },
            { left: '78%',  size: 3, dur: '13s', delay: '2s'   },
            { left: '88%',  size: 2, dur: '20s', delay: '7s'   },
            { left: '35%',  size: 2, dur: '15s', delay: '9s'   },
          ].map((p, i) => (
            <div key={i} className="particle" style={{
              left: p.left, bottom: '-10px',
              width: p.size, height: p.size,
              animationDuration: p.dur, animationDelay: p.delay,
            }} />
          ))}
        </div>

        {/* Logo — sits above the card */}
        <div className="logo-wrap" style={{ paddingBottom: 32 }}>
          <div className="logo-emblem">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M14.5 9.5L20 4M20 4h-4M20 4v4" stroke="rgba(58,188,168,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 14.5L4 20M4 20h4M4 20v-4" stroke="rgba(58,188,168,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.5 9.5l-5 5" stroke="rgba(58,188,168,0.7)" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="1.2" fill="rgba(58,188,168,0.6)"/>
            </svg>
          </div>
          <div className="logo-title">DAIMON</div>
          <div className="logo-sub">Adriatic Creature Hunt</div>
        </div>

        {/* Bottom card */}
        <div className="bottom-card">
          <p className="tagline">
            Cattura <em>creature mitologiche</em>,<br />esplora la costa e sfida gli altri.
          </p>

          <div className="feat-row">
            <div className="feat">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.6"/>
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
              </div>
              Esplora
            </div>
            <div className="feat">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                </svg>
              </div>
              Daimon
            </div>
            <div className="feat">
              <div className="feat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M14.5 2.5l-5 5M9.5 2.5l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M5 8h14l-1.5 9.5a2 2 0 01-2 1.5h-7a2 2 0 01-2-1.5L5 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  <path d="M9 12l1.5 1.5L15 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              Duelli
            </div>
          </div>

          <button className="btn-google" onClick={handleGoogleLogin}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="rgba(255,255,255,0.9)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="rgba(255,255,255,0.9)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="rgba(255,255,255,0.9)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entra con Google
          </button>

          {authError && (
            <div className="error-box">
              <span>⚠</span>
              <span>Accesso non riuscito. Riprova.</span>
            </div>
          )}

          <div className="admin-link">
            Sei un organizzatore? <a href="/admin-login">Accesso admin →</a>
          </div>
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
