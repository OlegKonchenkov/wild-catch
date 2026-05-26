'use client'
import { useEffect, useRef, useState } from 'react'
import { GiSpeaker, GiSpeakerOff } from 'react-icons/gi'
import { isMusicMuted, setMusicMuted, onPrefsChange } from '@/lib/audioPrefs'

/**
 * Singleton background-music controller.
 *
 * Plays `public/audio/bgm.mp3` on a low-volume loop across the entire
 * `/game` route group, with:
 *   - Mute toggle (floating bottom-left), persisted in localStorage
 *   - First-user-gesture autoplay unlock (modern browsers block autoplay
 *     before any interaction; we attach a one-shot pointer listener so
 *     playback starts as soon as the user taps anywhere)
 *   - Auto-pause when the tab is hidden (saves CPU + respects user)
 *   - Graceful no-op if the asset is missing — the button hides and no
 *     console errors are emitted
 *
 * Designed to be mounted exactly ONCE per page (in GameShell). Multiple
 * mounts would stack audio elements; React renders should not duplicate
 * this component.
 */

const BGM_SRC = '/audio/bgm.mp3'
const BASE_VOLUME = 0.35

/**
 * The intro audio source is resolved at mount time:
 *   1. Try fetch the admin-uploaded override for slot='intro' (global +
 *      optionally per-session if a session is active)
 *   2. Fall back to the bundled default at /audio/bgm.mp3
 *
 * Onboarding may happen before any session is joined, so sessionId is
 * optional — we still pick up a global intro override.
 */
async function resolveIntroSrc(): Promise<string> {
  if (typeof window === 'undefined') return BGM_SRC
  const sessionId = (() => {
    try { return window.localStorage.getItem('current_session_id') } catch { return null }
  })()
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  try {
    const res = await fetch(`/api/game/audio-overrides${qs}`, { cache: 'no-store' })
    if (!res.ok) return BGM_SRC
    const data = (await res.json()) as { overrides?: Array<{ slot: string; file_url: string }> }
    const intro = data.overrides?.find(o => o.slot === 'intro')
    return intro?.file_url ?? BGM_SRC
  } catch {
    return BGM_SRC
  }
}

export default function BgmController() {
  const [src, setSrc] = useState<string>(BGM_SRC)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Music mute is now a persisted player preference (Impostazioni). Start
  // from `false` for SSR/hydration safety, then sync from the stored pref
  // on mount and stay in sync if it's toggled elsewhere (settings panel).
  const [muted, setMuted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read client-only pref + subscribe
    setMuted(isMusicMuted())
    return onPrefsChange(() => setMuted(isMusicMuted()))
  }, [])
  // `available` flips false on `error` event (404 or decode failure). We
  // start optimistic and let the asset's load failure hide the UI — that
  // way deploys without the file simply look like the feature isn't on.
  const [available, setAvailable] = useState(true)
  // Tracks whether the first user gesture has happened. Browsers reject
  // .play() before that with a NotAllowedError; we silently swallow it
  // and try again from the gesture handler.
  const unlockedRef = useRef(false)

  // Audio element setup. We create the element imperatively (instead of
  // rendering <audio>) so its lifetime is decoupled from any conditional
  // JSX and the same element survives muted/unmuted toggles without
  // restarting the loop.
  // Resolve the intro src once on mount (admin override → default).
  useEffect(() => {
    let cancelled = false
    resolveIntroSrc().then(resolved => {
      if (!cancelled) setSrc(resolved)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = BASE_VOLUME
    audioRef.current = audio

    // Try to start immediately. The user reached the onboarding slides via a
    // click (Home → "Partecipa" / starter pick), so the document already has
    // "sticky activation" and .play() succeeds right away — the intro music
    // begins WITH the first slide instead of only after the first "Avanti"
    // (the reported bug). If the browser still blocks it (no prior gesture,
    // e.g. a hard reload onto this page), the one-shot gesture listener below
    // retries on the next tap/key. Muted → never auto-play.
    if (!muted) {
      audio.play().then(() => { unlockedRef.current = true }).catch(() => { /* gesture listener retries */ })
    }

    const onError = () => setAvailable(false)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [src])

  // First-gesture unlock. Modern browsers require a user gesture before
  // any .play() will succeed. We listen once for pointerdown/keydown and
  // call play() from inside that handler.
  useEffect(() => {
    if (!available) return
    const tryPlay = () => {
      // Remember the gesture FIRST — even if the audio element isn't
      // created yet (src still resolving), so the [src] creation effect
      // can auto-start playback. Without this the one-shot listener is
      // consumed on an early tap and the unlock is lost.
      unlockedRef.current = true
      const audio = audioRef.current
      if (!audio) return
      if (muted) return
      audio.play().catch(() => {
        // Some browsers may still reject (e.g. low-power mode). We treat
        // BGM as best-effort — no retry loop.
      })
    }
    if (unlockedRef.current) {
      tryPlay()
      return
    }
    window.addEventListener('pointerdown', tryPlay, { once: true })
    window.addEventListener('keydown',     tryPlay, { once: true })
    return () => {
      window.removeEventListener('pointerdown', tryPlay)
      window.removeEventListener('keydown',     tryPlay)
    }
  }, [available, muted])

  // Apply mute changes to the audio element.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (muted) {
      audio.pause()
    } else if (unlockedRef.current && available) {
      audio.play().catch(() => { /* see tryPlay comment */ })
    }
  }, [muted, available])

  // Pause when the tab/page is hidden.
  useEffect(() => {
    if (!available) return
    function onVis() {
      const audio = audioRef.current
      if (!audio) return
      if (document.hidden) audio.pause()
      else if (!muted && unlockedRef.current) audio.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [muted, available])

  function toggle() {
    setMuted(prev => {
      const next = !prev
      setMusicMuted(next) // persist + broadcast (keeps settings panel in sync)
      return next
    })
  }

  if (!available) return null

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Attiva musica di sottofondo' : 'Disattiva musica di sottofondo'}
      title={muted ? 'Musica off' : 'Musica on'}
      className="fixed bottom-3 left-3 z-[1500] w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
      style={{
        background: 'rgba(10,20,35,0.78)',
        border: '1px solid rgba(58,157,188,0.4)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        color: muted ? 'rgba(255,255,255,0.45)' : '#3ABCA8',
      }}
    >
      {muted ? <GiSpeakerOff size={18} /> : <GiSpeaker size={18} />}
    </button>
  )
}
