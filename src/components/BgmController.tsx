'use client'
import { useEffect, useRef, useState } from 'react'

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

const STORAGE_KEY = 'wc:bgm-muted'
const BGM_SRC = '/audio/bgm.mp3'
const BASE_VOLUME = 0.35

export default function BgmController() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)
  // `available` flips false on `error` event (404 or decode failure). We
  // start optimistic and let the asset's load failure hide the UI — that
  // way deploys without the file simply look like the feature isn't on.
  const [available, setAvailable] = useState(true)
  // Tracks whether the first user gesture has happened. Browsers reject
  // .play() before that with a NotAllowedError; we silently swallow it
  // and try again from the gesture handler.
  const unlockedRef = useRef(false)

  // Restore muted preference on mount.
  useEffect(() => {
    try {
      setMuted(localStorage.getItem(STORAGE_KEY) === '1')
    } catch { /* private mode etc. — default to unmuted */ }
  }, [])

  // Audio element setup. We create the element imperatively (instead of
  // rendering <audio>) so its lifetime is decoupled from any conditional
  // JSX and the same element survives muted/unmuted toggles without
  // restarting the loop.
  useEffect(() => {
    const audio = new Audio(BGM_SRC)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = BASE_VOLUME
    audioRef.current = audio

    const onError = () => setAvailable(false)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  // First-gesture unlock. Modern browsers require a user gesture before
  // any .play() will succeed. We listen once for pointerdown/keydown and
  // call play() from inside that handler.
  useEffect(() => {
    if (!available) return
    const tryPlay = () => {
      const audio = audioRef.current
      if (!audio) return
      unlockedRef.current = true
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
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }

  if (!available) return null

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Attiva musica di sottofondo' : 'Disattiva musica di sottofondo'}
      title={muted ? 'Musica off' : 'Musica on'}
      className="fixed bottom-3 left-3 z-[1500] w-9 h-9 rounded-full flex items-center justify-center text-base active:scale-90 transition-transform"
      style={{
        background: 'rgba(10,20,35,0.78)',
        border: '1px solid rgba(58,157,188,0.4)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        color: muted ? 'rgba(255,255,255,0.45)' : '#3ABCA8',
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
