'use client'
import { useCallback, useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type PushState = 'unsupported' | 'unconfigured' | 'default' | 'denied' | 'subscribed' | 'loading'

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)

  // Browser capability is separate from server configuration so the UI can
  // explain *why* push is unavailable instead of rendering nothing.
  const browserSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  const hasVapidKey = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const supported = browserSupported && hasVapidKey

  useEffect(() => {
    if (!browserSupported) { setState('unsupported'); return }
    if (!hasVapidKey) { setState('unconfigured'); return }
    let cancelled = false
    ;(async () => {
      try {
        if (Notification.permission === 'denied') { if (!cancelled) setState('denied'); return }
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (cancelled) return
        if (existing && Notification.permission === 'granted') setState('subscribed')
        else setState('default')
      } catch {
        if (!cancelled) setState('default')
      }
    })()
    return () => { cancelled = true }
  }, [browserSupported, hasVapidKey])

  const subscribe = useCallback(async () => {
    if (!supported || busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'default')
        return
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ) as unknown as BufferSource,
        })
      }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      setState(res.ok ? 'subscribed' : 'default')
    } catch {
      setState('default')
    } finally {
      setBusy(false)
    }
  }, [supported, busy])

  const unsubscribe = useCallback(async () => {
    if (!supported || busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      setState('default')
    } catch {
      /* keep current state */
    } finally {
      setBusy(false)
    }
  }, [supported, busy])

  return { state, busy, supported, subscribe, unsubscribe }
}
