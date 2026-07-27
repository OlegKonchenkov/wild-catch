'use client'
import { useEffect, useState } from 'react'
import { GiSmartphone } from 'react-icons/gi'

// ── Install (Add-to-Home-Screen) nudge ──────────────────────────────────────
// A slim, one-shot bottom banner that invites the player to install the PWA.
// Deliberately NOT a full-screen modal — it must never feel like a nag:
//   • shown once per device, remembered in localStorage (dismiss OR install);
//   • never when the app is already running standalone (installed);
//   • delayed so it appears after the player is engaged, not on cold paint;
//   • Android  → captures `beforeinstallprompt`, offers a real Installa button;
//   • iOS Safari → shows the manual Condividi → Aggiungi a Home instructions
//     (iOS fires no beforeinstallprompt, and only Safari can add a real PWA).
//
// Positioned above the bottom nav via `bottomOffset` (measured nav height).

const GOLD = '#F7C841'
const DONE_KEY = 'wc:install-prompt:v1' // set on dismiss or install → never re-show
const SHOW_DELAY_MS = 12_000

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [show, setShow] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    let alreadyDone = true
    try { alreadyDone = localStorage.getItem(DONE_KEY) === '1' } catch { /* private mode */ }
    if (alreadyDone) return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return // already installed

    const ua = navigator.userAgent || ''
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS
    // A2HS on iOS only works from Safari — Chrome/Firefox iOS can't install PWAs.
    const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)

    let timer: ReturnType<typeof setTimeout> | null = null

    function onBeforeInstall(e: Event) {
      // Suppress Chrome's default mini-infobar; we drive the prompt ourselves.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('android')
      if (!timer) timer = setTimeout(() => setShow(true), SHOW_DELAY_MS)
    }
    function onInstalled() {
      try { localStorage.setItem(DONE_KEY, '1') } catch { /* noop */ }
      setShow(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    if (isIOSSafari) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only platform detection
      setMode('ios')
      timer = setTimeout(() => setShow(true), SHOW_DELAY_MS)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer) clearTimeout(timer)
    }
  }, [])

  function remember() { try { localStorage.setItem(DONE_KEY, '1') } catch { /* noop */ } }
  function dismiss() { setShow(false); remember() }

  async function install() {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice // accepted or dismissed — either way, stop nagging
    } catch { /* prompt already consumed */ }
    setShow(false)
    remember()
  }

  if (!show || !mode) return null

  return (
    <>
        {/* Plain CSS entrance (wc-rise-in, fill-mode both) — the resting state
            is the visible end-frame, so the banner can never get stuck
            invisible or mispositioned by a JS-animation quirk. */}
        <div
          className="wc-rise-in fixed left-0 right-0 z-[9500] flex justify-center px-3 pointer-events-none"
          // The bottom nav's measured height already includes its safe-area
          // padding, so only add the inset ourselves when the nav is hidden.
          style={{ bottom: bottomOffset > 0 ? `${bottomOffset + 14}px` : 'calc(env(safe-area-inset-bottom) + 14px)' }}
        >
          <div
            className="pointer-events-auto relative w-full max-w-[420px] overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(168deg, #14293b 0%, #0d1e2e 60%, #0a1826 100%)',
              border: `1px solid ${GOLD}55`,
              boxShadow: '0 18px 44px -12px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,236,150,0.14)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${GOLD}e6, transparent)` }}
            />
            <div className="relative flex items-center gap-3 p-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `radial-gradient(circle at 38% 30%, ${GOLD}33 0%, rgba(9,21,37,0.9) 72%)`,
                  border: `1.5px solid ${GOLD}`,
                  boxShadow: `0 0 14px ${GOLD}44`,
                }}
              >
                <GiSmartphone size={22} color={GOLD} style={{ filter: `drop-shadow(0 0 5px ${GOLD}88)` }} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="wc-display text-[14px] font-bold leading-tight text-white">
                  Installa Daimon
                </p>
                {mode === 'android' ? (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/55">
                    Aggiungila alla schermata Home per giocare a schermo intero, anche offline.
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/55">
                    Tocca <strong className="text-white/80">Condividi</strong> <span aria-hidden>⎋</span> in basso, poi{' '}
                    <strong className="text-white/80">Aggiungi alla schermata Home</strong>.
                  </p>
                )}
              </div>

              {mode === 'android' && (
                <button
                  onClick={install}
                  className="shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-extrabold text-[#06121a] transition-transform active:scale-[0.97]"
                  style={{ background: `linear-gradient(180deg, ${GOLD}, ${GOLD}cc)`, boxShadow: `0 5px 14px ${GOLD}44` }}
                >
                  Installa
                </button>
              )}

              <button
                onClick={dismiss}
                aria-label="Chiudi"
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:text-white/80"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
    </>
  )
}
