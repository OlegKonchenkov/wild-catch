'use client'
import type { SVGProps } from 'react'

// Crisp stroke icon family for the battle action bar — replaces emoji so the
// HUD reads as a polished game UI. currentColor + round caps; size via prop.
function Base({ size = 22, children, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden {...rest}
    >
      {children}
    </svg>
  )
}

/** Capture — magnifier (matches the mockup's CATTURA). */
export function IconCapture(p: { size?: number }) {
  return <Base {...p}><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /><path d="M8 11a3 3 0 0 1 3-3" /></Base>
}

/** Fight — crossed swords. */
export function IconSwords(p: { size?: number }) {
  return (
    <Base {...p}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
      <line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" />
    </Base>
  )
}

/** Attack — single sword (boss / duel primary). */
export function IconSword(p: { size?: number }) {
  return (
    <Base {...p}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" />
    </Base>
  )
}

/** Items — conical flask / potion. */
export function IconFlask(p: { size?: number }) {
  return (
    <Base {...p}>
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <path d="M6.5 15h11" /><path d="M8.5 2h7" />
    </Base>
  )
}

/** Flee — exit door + arrow. */
export function IconFlee(p: { size?: number }) {
  return (
    <Base {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </Base>
  )
}

/** Heal / cure potion (for item use). */
export function IconHeal(p: { size?: number }) {
  return <Base {...p}><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z" /></Base>
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
