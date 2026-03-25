'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function JoinFlow() {
  const [code, setCode] = useState('')
  const [gdprAccepted, setGdprAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  // After OAuth redirect back here with ?resume=1
  useEffect(() => {
    if (searchParams.get('resume') !== '1') return
    const pending = sessionStorage.getItem('pending_code')
    if (!pending) { router.replace('/game/map'); return }
    sessionStorage.removeItem('pending_code')
    setLoading(true)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pending }),
      }).then(async res => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Errore durante l\'accesso')
          setLoading(false)
        } else {
          localStorage.setItem('current_session_id', data.sessionId)
          router.replace('/game/map')
        }
      })
    })
  }, [searchParams, supabase, router])

  // Advance steps automatically
  useEffect(() => {
    if (code.length >= 6) setStep(s => s < 2 ? 2 : s)
    else setStep(1)
  }, [code])

  useEffect(() => {
    if (gdprAccepted && code.length >= 6) setStep(3)
    else if (code.length >= 6) setStep(2)
  }, [gdprAccepted, code])

  async function handleSubmit() {
    if (!gdprAccepted || code.length < 6 || loading) return
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      sessionStorage.setItem('pending_code', code.toUpperCase())
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      })
      return
    }
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Errore'); setLoading(false); return }
    localStorage.setItem('current_session_id', data.sessionId)
    router.push('/game/map')
  }

  const authError = searchParams.get('error')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        :root {
          --bg: #0A1A12;
          --bg2: #0F2318;
          --teal: #3ABCA8;
          --orange: #E8602F;
          --gold: #F0C040;
          --muted: rgba(255,255,255,0.4);
          --border: rgba(255,255,255,0.08);
          --step-active: #3ABCA8;
          --step-done: #34d399;
          --step-inactive: rgba(255,255,255,0.15);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); font-family: 'DM Sans', sans-serif; }

        .join-root {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          position: relative;
          overflow: hidden;
        }

        /* Background grid pattern */
        .join-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(58,188,168,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(58,188,168,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        /* Glow orbs */
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
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
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 380px;
          background: rgba(15, 35, 24, 0.85);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 32px 28px;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .logo-area { text-align: center; margin-bottom: 32px; }
        .logo-icon {
          width: 52px; height: 52px;
          background: linear-gradient(135deg, var(--teal), #2AA896);
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin-bottom: 12px;
          box-shadow: 0 4px 20px rgba(58,188,168,0.3);
        }
        .logo-title {
          font-family: 'Cinzel', serif;
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.04em;
        }
        .logo-sub {
          font-size: 12px;
          color: var(--teal);
          margin-top: 4px;
          letter-spacing: 0.02em;
        }

        /* Steps */
        .steps { display: flex; flex-direction: column; gap: 0; margin-bottom: 8px; }

        .step-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding-bottom: 4px;
        }

        .step-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
        }

        .step-num {
          width: 28px; height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .step-num.inactive {
          background: var(--step-inactive);
          color: rgba(255,255,255,0.35);
          border: 1px solid transparent;
        }
        .step-num.active {
          background: rgba(58,188,168,0.15);
          color: var(--teal);
          border: 1px solid var(--teal);
          box-shadow: 0 0 12px rgba(58,188,168,0.25);
        }
        .step-num.done {
          background: rgba(52,211,153,0.15);
          color: var(--step-done);
          border: 1px solid var(--step-done);
        }

        .step-line {
          width: 1px;
          flex: 1;
          min-height: 16px;
          margin: 4px 0;
          background: var(--border);
          transition: background 0.3s;
        }
        .step-line.lit { background: rgba(58,188,168,0.3); }

        .step-content { flex: 1; padding-top: 4px; padding-bottom: 16px; }
        .step-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
          transition: color 0.3s;
        }
        .step-label.inactive { color: rgba(255,255,255,0.25); }
        .step-label.active { color: var(--teal); }
        .step-label.done { color: var(--step-done); }

        /* Code input */
        .code-input-wrap {
          position: relative;
          transition: opacity 0.3s;
        }
        .code-input-wrap.disabled { opacity: 0.35; pointer-events: none; }
        .code-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: 12px 16px;
          text-align: center;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 0.25em;
          color: #fff;
          font-family: 'DM Sans', monospace;
          text-transform: uppercase;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
        }
        .code-input::placeholder { color: rgba(255,255,255,0.2); font-size: 14px; letter-spacing: 0.05em; font-weight: 400; }
        .code-input:focus {
          border-color: var(--teal);
          box-shadow: 0 0 0 3px rgba(58,188,168,0.12);
        }
        .code-hint { font-size: 11px; color: var(--muted); margin-top: 6px; text-align: center; }

        /* GDPR */
        .gdpr-wrap {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          transition: opacity 0.3s;
          padding: 2px 0;
        }
        .gdpr-wrap.disabled { opacity: 0.3; pointer-events: none; }
        .gdpr-check {
          width: 18px; height: 18px;
          border: 1.5px solid rgba(255,255,255,0.2);
          border-radius: 5px;
          flex-shrink: 0;
          margin-top: 1px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          background: transparent;
        }
        .gdpr-check.checked {
          background: var(--teal);
          border-color: var(--teal);
        }
        .gdpr-text { font-size: 11.5px; color: rgba(255,255,255,0.55); line-height: 1.5; }

        /* CTA button */
        .cta-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: linear-gradient(135deg, var(--orange), #CC4A1E);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 15px 20px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(232,96,47,0.35);
          margin-top: 4px;
        }
        .cta-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(232,96,47,0.4); }
        .cta-btn:active:not(:disabled) { transform: translateY(0); }
        .cta-btn:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }

        .google-icon { width: 18px; height: 18px; flex-shrink: 0; }

        /* Error */
        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          padding: 10px 12px;
          margin-top: 16px;
        }
        .error-box span { font-size: 12.5px; color: #fca5a5; line-height: 1.4; }

        /* Loading spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        .admin-link {
          margin-top: 24px;
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.2);
        }
        .admin-link a {
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          transition: color 0.2s;
        }
        .admin-link a:hover { color: rgba(255,255,255,0.6); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card { animation: fadeUp 0.5s ease both; }
      `}</style>

      <div className="join-root">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="card">
          <div className="logo-area">
            <div className="logo-icon">🌿</div>
            <div className="logo-title">WildCatch</div>
            <div className="logo-sub">La prima avventura outdoor italiana</div>
          </div>

          {loading && searchParams.get('resume') === '1' ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.5)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>Accesso in corso...</div>
            </div>
          ) : (
            <div className="steps">
              {/* Step 1: Codice */}
              <div className="step-item">
                <div className="step-left">
                  <div className={`step-num ${step === 1 ? 'active' : step > 1 ? 'done' : 'inactive'}`}>
                    {step > 1 ? '✓' : '1'}
                  </div>
                  <div className={`step-line ${step > 1 ? 'lit' : ''}`} />
                </div>
                <div className="step-content">
                  <div className={`step-label ${step === 1 ? 'active' : step > 1 ? 'done' : 'inactive'}`}>
                    Codice invito
                  </div>
                  <div className="code-input-wrap">
                    <input
                      className="code-input"
                      type="text"
                      placeholder="es. WILD2024"
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                    <div className="code-hint">Ricevuto dall'organizzatore dell'evento</div>
                  </div>
                </div>
              </div>

              {/* Step 2: GDPR */}
              <div className="step-item">
                <div className="step-left">
                  <div className={`step-num ${step === 2 ? 'active' : step > 2 ? 'done' : 'inactive'}`}>
                    {step > 2 ? '✓' : '2'}
                  </div>
                  <div className={`step-line ${step > 2 ? 'lit' : ''}`} />
                </div>
                <div className="step-content">
                  <div className={`step-label ${step === 2 ? 'active' : step > 2 ? 'done' : 'inactive'}`}>
                    Consenso privacy
                  </div>
                  <label className={`gdpr-wrap ${step < 2 ? 'disabled' : ''}`} onClick={() => step >= 2 && setGdprAccepted(v => !v)}>
                    <div className={`gdpr-check ${gdprAccepted ? 'checked' : ''}`}>
                      {gdprAccepted && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="gdpr-text">
                      Accetto il trattamento dei dati personali ai sensi del GDPR (art. 6) per partecipare al gioco
                    </span>
                  </label>
                </div>
              </div>

              {/* Step 3: Accedi */}
              <div className="step-item">
                <div className="step-left">
                  <div className={`step-num ${step === 3 ? 'active' : 'inactive'}`}>3</div>
                </div>
                <div className="step-content" style={{ paddingBottom: 0 }}>
                  <div className={`step-label ${step === 3 ? 'active' : 'inactive'}`}>
                    Accedi con Google
                  </div>
                  <button
                    className="cta-btn"
                    disabled={step < 3 || loading}
                    onClick={handleSubmit}
                  >
                    {loading ? (
                      <><div className="spinner" />Connessione...</>
                    ) : (
                      <>
                        <svg className="google-icon" viewBox="0 0 24 24">
                          <path fill="#fff" fillOpacity=".9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#fff" fillOpacity=".9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#fff" fillOpacity=".9" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#fff" fillOpacity=".9" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        PARTECIPA CON GOOGLE
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(error || authError) && (
            <div className="error-box">
              <span>⚠</span>
              <span>{error || (authError === 'auth' ? 'Accesso non riuscito. Riprova.' : authError)}</span>
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

export default function JoinPage() {
  return (
    <Suspense>
      <JoinFlow />
    </Suspense>
  )
}
