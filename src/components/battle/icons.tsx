'use client'
import { GiFishingNet, GiCrossedSwords, GiBroadsword, GiStandingPotion, GiRun, GiHealthPotion } from 'react-icons/gi'

// Battle action-bar icons — themed Game Icons (game-icons.net) so the combat
// HUD matches the rich glyph language used across the rest of the app. Each
// keeps the simple `{ size }` API; the glyphs inherit `currentColor` from the
// button, so the ActionBar tones tint them automatically.

/** Capture — a thrown net (you catch creatures with reti). */
export function IconCapture({ size = 22 }: { size?: number }) {
  return <GiFishingNet size={size} />
}

/** Fight — crossed swords. */
export function IconSwords({ size = 22 }: { size?: number }) {
  return <GiCrossedSwords size={size} />
}

/** Attack — single blade (boss / duel primary). */
export function IconSword({ size = 22 }: { size?: number }) {
  return <GiBroadsword size={size} />
}

/** Items — battle potion. */
export function IconFlask({ size = 22 }: { size?: number }) {
  return <GiStandingPotion size={size} />
}

/** Flee — sprint away. */
export function IconFlee({ size = 22 }: { size?: number }) {
  return <GiRun size={size} />
}

/** Heal / cure potion (for item use). */
export function IconHeal({ size = 22 }: { size?: number }) {
  return <GiHealthPotion size={size} />
}

// ── Top-bar icons (premium gold) — filled, not stroke. ──────────────────────

/** Gold level crest / shield. */
export function IconCrest({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="crestGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FCE9A6" /><stop offset=".5" stopColor="#E7B64A" /><stop offset="1" stopColor="#A9781F" />
        </linearGradient>
      </defs>
      <path d="M12 1.5 20.5 4.6 V11 C20.5 16.4 16.8 20.6 12 22.5 7.2 20.6 3.5 16.4 3.5 11 V4.6 Z" fill="url(#crestGold)" stroke="#6E4F18" strokeWidth="1" strokeLinejoin="round" />
      <path d="M12 2.6 19.4 5.3 V11 C19.4 15.7 16.2 19.6 12 21.3 7.8 19.6 4.6 15.7 4.6 11 V5.3 Z" fill="none" stroke="#FFF4CE" strokeOpacity=".5" strokeWidth=".7" />
      <path d="M12 6.4 13.3 9.4 16.6 9.7 14.1 11.9 14.9 15.1 12 13.4 9.1 15.1 9.9 11.9 7.4 9.7 10.7 9.4 Z" fill="#5A4216" fillOpacity=".55" />
    </svg>
  )
}

/** Gold coin. */
export function IconCoin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="coinGold" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FDEBA8" /><stop offset=".55" stopColor="#E8B84B" /><stop offset="1" stopColor="#A9781F" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill="url(#coinGold)" stroke="#6E4F18" strokeWidth="1" />
      <circle cx="12" cy="12" r="6.4" fill="none" stroke="#6E4F18" strokeOpacity=".35" strokeWidth="1" />
      <path d="M12 8.3 13 11 15.8 11.1 13.6 12.8 14.4 15.5 12 13.9 9.6 15.5 10.4 12.8 8.2 11.1 11 11 Z" fill="#7A5A1E" fillOpacity=".6" />
    </svg>
  )
}

/** Clock (urgent red-orange). */
export function IconClock({ size = 22, color = '#FF6A4D' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M9 2h6" /><path d="M12 2v2.5" />
    </svg>
  )
}

/** Notification bell. */
export function IconBell({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
