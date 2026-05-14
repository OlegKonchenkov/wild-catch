/**
 * UI / feedback sounds — synthesized via Web Audio API.
 *
 * Audit gap (see 2026-05-14 game-design review): the gameplay loop has
 * solid audio on combat / catch / level events but no aural feedback on:
 *   – shop purchases (silent transaction)
 *   – QR scan success (silent confirm)
 *   – pin claims (silent reward)
 *   – item use in combat (silent heal)
 *   – frammento granted (silent puzzle unlock)
 *   – UI taps in coachmark / modal flows (no tap "tick")
 *
 * Each function shares the singleton AudioContext via shared-ac so it
 * cooperates with the ambience-ducking system and the rapid-fire queue.
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

// ── Coin / shop purchase ─────────────────────────────────────────────────────
// Bright "ka-ching" — two metallic blips ascending, plus a high sparkle tail.
// Recognisable as "you spent money" without being too victorious.
export function playCoin(vol = 0.50): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.55)

  // Two metallic tings: E5 (660 Hz) then high A5 (880 Hz)
  ;[660, 880].forEach((freq, i) => {
    const t = now + i * 0.08
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.55, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.32)
  })

  // Sparkle overtones — very short
  ;[1760, 2349, 2637].forEach((freq, i) => {
    const t = now + 0.10 + i * 0.025
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.18, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.20)
  })
}

// ── QR scan success ──────────────────────────────────────────────────────────
// Sci-fi confirmation: ascending square-wave blip followed by a soft confirm
// chord. Evokes "scanned, accepted, processed."
export function playQrScan(vol = 0.48): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.5)

  // Quick ascending blip — square wave from 600 to 1400 Hz
  const blip = ac.createOscillator()
  const bG   = ac.createGain()
  blip.type  = 'square'
  blip.frequency.setValueAtTime(600, now)
  blip.frequency.exponentialRampToValueAtTime(1400, now + 0.08)
  bG.gain.setValueAtTime(vol * 0.30, now)
  bG.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
  blip.connect(bG); bG.connect(ac.destination)
  blip.start(now); blip.stop(now + 0.10)

  // Confirm chord: A5 + C#6 (major third), short and clean
  ;[880, 1108.73].forEach(freq => {
    const t = now + 0.10
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.42, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.40)
  })
}

// ── Pin claim / map reward ───────────────────────────────────────────────────
// Sparkle cascade — evokes "discovered something" / "treasure found".
// Lighter than mission-complete, more discovery-flavoured.
export function playPinClaim(vol = 0.45): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.7)

  // Rising sparkle: F5 → A5 → C6 → E6
  const notes = [698.46, 880, 1046.5, 1318.5]
  notes.forEach((freq, i) => {
    const t = now + i * 0.045
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.40, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.32)
  })

  // Warm sub-bass tap at start — gives it weight
  const sub = ac.createOscillator()
  const sG  = ac.createGain()
  sub.type  = 'sine'
  sub.frequency.value = 110
  sG.gain.setValueAtTime(vol * 0.45, now)
  sG.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
  sub.connect(sG); sG.connect(ac.destination)
  sub.start(now); sub.stop(now + 0.16)
}

// ── Heal / potion used in combat ─────────────────────────────────────────────
// Gentle warm shimmer — sine wave that swells, like restoring vitality.
export function playHeal(vol = 0.45): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.7)

  // Layered chord: C5 + E5 + G5 (C major) with slow attack
  ;[523.25, 659.25, 783.99].forEach((freq, i) => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(vol * 0.32, now + 0.08 + i * 0.02)
    g.gain.setValueAtTime(vol * 0.32, now + 0.40)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.62)
    o.connect(g); g.connect(ac.destination)
    o.start(now); o.stop(now + 0.65)
  })

  // High shimmer pad — gives it the "restoring" sparkle feel
  ;[1568, 2093].forEach((freq, i) => {
    const t = now + 0.05 + i * 0.04
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.16, t + 0.10)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.58)
  })
}

// ── Frammento granted ────────────────────────────────────────────────────────
// "Puzzle piece" sound — soft wood-click + light chime. Different from coin
// or pin claim so the player learns "this is enigma progress."
export function playFrammento(vol = 0.45): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.45)

  // Quick wood-block click: short triangle burst around 280 Hz
  const click = ac.createOscillator()
  const cG    = ac.createGain()
  click.type  = 'triangle'
  click.frequency.value = 280
  cG.gain.setValueAtTime(vol * 0.50, now)
  cG.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  click.connect(cG); cG.connect(ac.destination)
  click.start(now); click.stop(now + 0.06)

  // Mystical chime — perfect fifth (D#5 + A#5) with reverb-y decay
  ;[622.25, 932.33].forEach(freq => {
    const t = now + 0.06
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.40)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.42)
  })
}

// ── UI tap (button press, coachmark next, modal advance) ─────────────────────
// Subtle but present — feels good under thumb. Used sparingly so it doesn't
// become noisy.
export function playUiTap(vol = 0.20): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.08)

  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(880, now)
  o.frequency.exponentialRampToValueAtTime(660, now + 0.04)
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
  o.connect(g); g.connect(ac.destination)
  o.start(now); o.stop(now + 0.08)
}
