'use client'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const wrap = 'mx-4 mt-2 mb-1 rounded-xl px-3 py-2'

export default function PushOptIn() {
  const { state, busy, subscribe, unsubscribe } = usePushNotifications()
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only env detection (navigator/matchMedia)
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

  if (state === 'loading') return null

  // iOS Safari (not installed): Web Push is impossible until added to Home.
  if (state === 'unsupported') {
    if (iosNeedsInstall) {
      return (
        <div className={`${wrap} text-[11px] leading-relaxed text-white/55`}
          style={{ background: 'rgba(58,188,168,0.08)', border: '1px solid rgba(58,188,168,0.22)' }}>
          📲 Per ricevere le notifiche su iPhone/iPad: tocca <strong>Condividi</strong> →{' '}
          <strong>Aggiungi alla schermata Home</strong>, poi apri l&apos;app da lì e
          riattiva le notifiche da qui.
        </div>
      )
    }
    return (
      <div className={`${wrap} text-[11px] text-white/40`}
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        ⚠️ Questo browser non supporta le notifiche push.
      </div>
    )
  }

  // Browser is fine but the server has no VAPID key configured yet.
  if (state === 'unconfigured') {
    return (
      <div className={`${wrap} text-[11px] leading-relaxed text-white/45`}
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
        🔧 Notifiche non ancora configurate sul server. Se sei l&apos;amministratore:
        imposta le variabili <strong>VAPID</strong> e riavvia l&apos;app.
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={`${wrap} text-[11px] text-white/40`}
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        🔕 Notifiche bloccate dal browser — riattivale dalle impostazioni del sito.
      </div>
    )
  }

  if (state === 'subscribed') {
    return (
      <div className={wrap}
        style={{ background: 'rgba(58,188,168,0.10)', border: '1px solid rgba(58,188,168,0.3)' }}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold" style={{ color: '#3ABCA8' }}>
            🔔 Notifiche push attive
          </span>
          <button onClick={unsubscribe} disabled={busy}
            className="text-[11px] font-bold text-white/45 hover:text-white/70 disabled:opacity-40 shrink-0">
            Disattiva
          </button>
        </div>
        <button onClick={sendTest} disabled={testState === 'sending'}
          className="mt-2 w-full rounded-lg py-1.5 text-[11px] font-bold disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
          {testState === 'sending' ? 'Invio…'
            : testState === 'sent' ? '✅ Inviata — controlla la notifica'
            : testState === 'error' ? '⚠ Errore invio'
            : 'Invia notifica di prova'}
        </button>
      </div>
    )
  }

  // state === 'default'
  return (
    <div className="mx-4 mt-2 mb-1">
      <button onClick={subscribe} disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
        style={{ background: 'rgba(58,188,168,0.16)', color: '#3ABCA8', border: '1px solid rgba(58,188,168,0.4)' }}>
        {busy ? '⏳ Attivazione…' : '🔔 Attiva notifiche push'}
      </button>
      <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-white/35">
        Ti avvisiamo solo per eventi importanti (duelli, missioni, livelli, boss e
        comunicazioni degli organizzatori). Facoltative e disattivabili quando vuoi.
      </p>
    </div>
  )
}
