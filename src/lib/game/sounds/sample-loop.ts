/**
 * Sample-based looping audio. Plays an arbitrary URL (mp3/ogg/wav) in loop
 * with a short fade-in to avoid clicks. Returns a stop function with fade-out.
 *
 * Used as the override path when an admin uploads a custom audio file for a
 * slot (see audio-overrides.ts). The default Web Audio synths in
 * map-loop.ts / battle-loop.ts are bypassed in that case.
 *
 * Loop semantics: HTMLAudioElement.loop = true. There is NO crossfade at the
 * loop boundary; an audible click is possible for files that aren't seamlessly
 * looped. Acceptable trade-off for this feature's scope.
 */

export interface SampleLoopOptions {
  /** Target volume after fade-in (0..1). Defaults to 0.45. */
  volume?: number
  /** Fade-in duration in ms. Defaults to 250. */
  fadeInMs?: number
  /** Fade-out duration on stop, in ms. Defaults to 250. */
  fadeOutMs?: number
}

/**
 * Start an HTMLAudio-based loop. Returns a stop function that fades out and
 * then pauses + releases the element. Safe to call from any client component;
 * no-op on the server.
 */
export function startSampleLoop(src: string, opts: SampleLoopOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {}

  const targetVolume = opts.volume ?? 0.45
  const fadeInMs     = opts.fadeInMs  ?? 250
  const fadeOutMs    = opts.fadeOutMs ?? 250

  const audio = new Audio(src)
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0
  let stopped = false
  let rafId: number | null = null

  const fadeTo = (target: number, durationMs: number, onDone?: () => void): void => {
    const start = audio.volume
    const startedAt = performance.now()
    const tick = (now: number) => {
      if (stopped && target > 0) return  // cancel any pending fade-in if we've already stopped
      const t = Math.min(1, (now - startedAt) / Math.max(1, durationMs))
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * t))
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = null
        onDone?.()
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  // Pause when tab hidden (parity with BgmController + synth loops)
  const onVis = () => {
    if (stopped) return
    if (document.hidden) audio.pause()
    else audio.play().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVis)

  // Some browsers reject .play() before any user gesture. We swallow the
  // first NotAllowedError; the next interaction in the app will trigger a
  // gesture that the browser may use to unblock other audio later.
  audio.play()
    .then(() => fadeTo(targetVolume, fadeInMs))
    .catch(() => {
      // best-effort, leave the element ready in case a future interaction
      // resumes audio context
    })

  return () => {
    if (stopped) return
    stopped = true
    document.removeEventListener('visibilitychange', onVis)
    if (rafId !== null) cancelAnimationFrame(rafId)
    fadeTo(0, fadeOutMs, () => {
      audio.pause()
      audio.src = ''
    })
  }
}
