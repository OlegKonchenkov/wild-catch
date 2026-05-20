'use client'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const TEAL = '#3ABCA8'

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '14px 18px' }}>{children}</div>
}

function Head({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>🔔</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{title}</span>
      {right}
    </div>
  )
}

const noteStyle: React.CSSProperties = {
  fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5,
  margin: '6px 0 0', paddingLeft: 36,
}

export default function PushOptIn() {
  const { state, busy, subscribe, unsubscribe } = usePushNotifications()
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [actionsOpen, setActionsOpen] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only env detection
    setIosNeedsInstall(isIOS && !standalone)
  }, [])

  async function sendTest() {
    setTestState('sending')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      setTestState(res.ok ? 'sent' : 'error')
    } catch {
      setTestState('error')
    }
    setTimeout(() => setTestState('idle'), 4000)
  }

  if (state === 'loading') {
    return <Shell><Head title="Notifiche push" /><p style={noteStyle}>Verifica supporto…</p></Shell>
  }

  if (state === 'unsupported') {
    return (
      <Shell>
        <Head title="Notifiche push" />
        <p style={noteStyle}>
          {iosNeedsInstall
            ? <>📲 Su iPhone/iPad: <strong>Condividi</strong> → <strong>Aggiungi alla schermata Home</strong>, poi apri l&apos;app da lì e torna qui per attivarle.</>
            : <>⚠️ Questo browser non supporta le notifiche push.</>}
        </p>
      </Shell>
    )
  }

  if (state === 'unconfigured') {
    return (
      <Shell>
        <Head title="Notifiche push" />
        <p style={{ ...noteStyle, color: 'rgba(251,191,36,0.75)' }}>
          🔧 Non ancora configurate sul server. Amministratore: imposta le variabili
          <strong> VAPID</strong> e riavvia/redeploy l&apos;app.
        </p>
      </Shell>
    )
  }

  if (state === 'denied') {
    return (
      <Shell>
        <Head title="Notifiche push" />
        <p style={noteStyle}>
          🔕 Bloccate dal browser. Riattivale dalle impostazioni del sito (icona lucchetto
          nella barra indirizzi) e ricarica.
        </p>
      </Shell>
    )
  }

  if (state === 'subscribed') {
    // Riga "pulita" come le altre preferenze; le azioni stanno dentro un
    // pannello che si apre cliccando l'ingranaggio.
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
          <span style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              Notifiche
            </div>
            <div style={{ fontSize: 12, color: TEAL, marginTop: 2 }}>Attive</div>
          </div>
          <button
            type="button"
            onClick={() => setActionsOpen(v => !v)}
            aria-label={actionsOpen ? 'Nascondi opzioni notifiche' : 'Mostra opzioni notifiche'}
            aria-expanded={actionsOpen}
            title="Opzioni notifiche"
            style={{
              width: 36, height: 36, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: actionsOpen ? 'rgba(58,188,168,0.18)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${actionsOpen ? 'rgba(58,188,168,0.45)' : 'rgba(255,255,255,0.1)'}`,
              color: actionsOpen ? TEAL : 'rgba(255,255,255,0.6)',
              fontSize: 16, lineHeight: 1, transition: 'background 0.18s, border-color 0.18s, color 0.18s',
            }}
          >⚙️</button>
        </div>
        {actionsOpen && (
          <div style={{ display: 'flex', gap: 8, padding: '0 18px 14px 54px' }}>
            <button
              onClick={sendTest}
              disabled={testState === 'sending'}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: testState === 'sending' ? 0.6 : 1,
              }}
            >
              {testState === 'sending' ? 'Invio…'
                : testState === 'sent' ? '✅ Inviata'
                : testState === 'error' ? '⚠ Errore'
                : 'Invia notifica di prova'}
            </button>
            <button
              onClick={unsubscribe}
              disabled={busy}
              style={{
                padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: 'transparent', color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                opacity: busy ? 0.5 : 1,
              }}
            >
              Disattiva
            </button>
          </div>
        )}
      </div>
    )
  }

  // state === 'default'
  return (
    <Shell>
      <Head title="Notifiche push" />
      <p style={noteStyle}>
        Ti avvisiamo solo per eventi importanti — duelli, missioni, livelli, boss e
        comunicazioni degli organizzatori. Facoltative, disattivabili quando vuoi.
      </p>
      <button
        onClick={subscribe}
        disabled={busy}
        style={{
          width: 'calc(100% - 36px)', marginLeft: 36, marginTop: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${TEAL} 0%, #2FA593 100%)`,
          color: '#06231E', fontSize: 14, fontWeight: 800, letterSpacing: '0.01em',
          boxShadow: '0 6px 18px rgba(58,188,168,0.28)',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? '⏳ Attivazione…' : '🔔 Attiva notifiche'}
      </button>
    </Shell>
  )
}
