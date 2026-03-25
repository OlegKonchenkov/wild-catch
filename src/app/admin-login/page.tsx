'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  // After OAuth returns here with ?resume=1, check is_admin
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
    setLoading(true)
    setError('')
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
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08101A; font-family: 'DM Sans', sans-serif; }

        .admin-root {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          position: relative;
          overflow: hidden;
        }
        .admin-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(58,100,188,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(58,100,188,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .orb {
          position: fixed; border-radius: 50%;
          filter: blur(90px); pointer-events: none; z-index: 0;
        }
        .orb-1 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(58,100,188,0.15) 0%, transparent 70%);
          top: -80px; left: 50%; transform: translateX(-50%);
        }
        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 340px;
          background: rgba(10, 20, 35, 0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          padding: 36px 28px;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
          text-align: center;
          animation: fadeUp 0.4s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shield {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #2D5BE3, #1E3FA8);
          border-radius: 16px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 28px;
          margin-bottom: 16px;
          box-shadow: 0 4px 20px rgba(45,91,227,0.35);
        }
        .title {
          font-family: 'Cinzel', serif;
          font-size: 22px; font-weight: 700;
          color: #fff; margin-bottom: 6px;
        }
        .sub { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 32px; }
        .btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: #2D5BE3;
          color: #fff; font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.05em;
          padding: 14px 20px; border-radius: 12px; border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 20px rgba(45,91,227,0.4);
        }
        .btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.35; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .error-box {
          display: flex; align-items: flex-start; gap: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px; padding: 10px 12px; margin-top: 16px; text-align: left;
        }
        .error-box span { font-size: 12.5px; color: #fca5a5; line-height: 1.4; }
        .back-link {
          margin-top: 24px; font-size: 12px; color: rgba(255,255,255,0.25);
          text-decoration: none; transition: color 0.2s; display: block; text-align: center;
        }
        .back-link:hover { color: rgba(255,255,255,0.5); }
        .divider { width: 40px; height: 1px; background: rgba(255,255,255,0.08); margin: 0 auto 24px; }
      `}</style>

      <div className="admin-root">
        <div className="orb orb-1" />
        <div className="card">
          <div className="shield">🛡️</div>
          <div className="title">Pannello Admin</div>
          <div className="sub">Accesso riservato agli organizzatori</div>
          <div className="divider" />

          {loading ? (
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div className="spinner" />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {searchParams.get('resume') ? 'Verifica permessi...' : 'Connessione...'}
              </span>
            </div>
          ) : (
            <button className="btn" onClick={handleAdminLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="rgba(255,255,255,0.85)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="rgba(255,255,255,0.85)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="rgba(255,255,255,0.85)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="rgba(255,255,255,0.85)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              ACCEDI CON GOOGLE
            </button>
          )}

          {(error || authError) && (
            <div className="error-box">
              <span>⚠</span>
              <span>{error || 'Accesso non riuscito. Riprova.'}</span>
            </div>
          )}
        </div>
        <a href="/" className="back-link">← Torna alla pagina giocatori</a>
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
