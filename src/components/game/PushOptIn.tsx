'use client'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushOptIn() {
  const { state, busy, subscribe, unsubscribe } = usePushNotifications()

  if (state === 'unsupported' || state === 'loading') return null

  if (state === 'denied') {
    return (
      <div className="mx-4 mt-2 mb-1 rounded-xl px-3 py-2 text-[11px] text-white/40"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        🔕 Notifiche bloccate dal browser — abilitale dalle impostazioni del sito.
      </div>
    )
  }

  if (state === 'subscribed') {
    return (
      <div className="mx-4 mt-2 mb-1 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
        style={{ background: 'rgba(58,188,168,0.10)', border: '1px solid rgba(58,188,168,0.3)' }}>
        <span className="text-[11px] font-semibold" style={{ color: '#3ABCA8' }}>
          🔔 Notifiche push attive
        </span>
        <button
          onClick={unsubscribe}
          disabled={busy}
          className="text-[11px] font-bold text-white/45 hover:text-white/70 disabled:opacity-40 shrink-0"
        >
          Disattiva
        </button>
      </div>
    )
  }

  // state === 'default'
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      className="mx-4 mt-2 mb-1 w-[calc(100%-2rem)] flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
      style={{ background: 'rgba(58,188,168,0.16)', color: '#3ABCA8', border: '1px solid rgba(58,188,168,0.4)' }}
    >
      {busy ? '⏳ Attivazione…' : '🔔 Attiva notifiche push'}
    </button>
  )
}
