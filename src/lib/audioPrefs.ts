// Client-side player preferences for audio + haptics.
//
// Stored in localStorage under the `wc:` namespace and broadcast via a window
// event so every listener (BgmController, settings UI) stays in sync without
// a React context. All reads are SSR-safe (return the default off-server).

const KEY_MUSIC   = 'wc:audio:music-muted'
const KEY_SFX     = 'wc:audio:sfx-muted'
const KEY_HAPTICS = 'wc:haptics-off'

export const PREFS_EVENT = 'wc:prefs-change'

function readBool(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(key, '1')
    else window.localStorage.removeItem(key)
  } catch {
    /* storage unavailable — ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(PREFS_EVENT))
  } catch {
    /* ignore */
  }
}

export function isMusicMuted(): boolean { return readBool(KEY_MUSIC) }
export function isSfxMuted(): boolean { return readBool(KEY_SFX) }
export function isHapticsOff(): boolean { return readBool(KEY_HAPTICS) }

export function setMusicMuted(v: boolean): void { writeBool(KEY_MUSIC, v) }
export function setSfxMuted(v: boolean): void { writeBool(KEY_SFX, v) }
export function setHapticsOff(v: boolean): void { writeBool(KEY_HAPTICS, v) }

/** Subscribe to any preference change. Returns an unsubscribe function. */
export function onPrefsChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PREFS_EVENT, cb)
  return () => window.removeEventListener(PREFS_EVENT, cb)
}
