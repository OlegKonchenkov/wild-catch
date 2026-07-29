'use client'
import posthog from 'posthog-js'

// PostHog is opt-in via NEXT_PUBLIC_POSTHOG_KEY. With no key set, all calls
// short-circuit to no-ops — instrumented code stays in place but emits nothing.
// EU host by default (`https://eu.i.posthog.com`) for GDPR alignment; override
// with NEXT_PUBLIC_POSTHOG_HOST if your project lives in another region.

let initialized = false

// ── Consent ─────────────────────────────────────────────────────────────────
// Analytics are opt-in and OFF until the user says yes. Previously PostHog was
// initialised on the first tracked event with no gate at all, and `identify()`
// was called with the user's email address — i.e. tracking tied to a personal
// identifier with no consent collected for it. Nothing is sent now until
// setAnalyticsConsent(true) has been called at least once.

const CONSENT_KEY = 'wc:analytics-consent'
export type AnalyticsConsent = 'granted' | 'denied' | 'unset'

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'unset'
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY)
    return stored === 'granted' || stored === 'denied' ? stored : 'unset'
  } catch {
    // Private mode / storage blocked: treat as not consented.
    return 'unset'
  }
}

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === 'granted'
}

/**
 * Record the user's choice. Revoking takes effect immediately: PostHog is told
 * to stop capturing and the local identity is cleared, so "I changed my mind"
 * actually stops collection rather than only hiding the toggle.
 */
export function setAnalyticsConsent(granted: boolean): void {
  try { window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied') } catch {}
  if (granted) return
  try {
    if (initialized) {
      posthog.opt_out_capturing()
      posthog.reset()
    }
  } catch {}
}

function ensureInit() {
  if (initialized) return
  if (typeof window === 'undefined') return
  if (!hasAnalyticsConsent()) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview: false,           // we call capturePageview ourselves on route change
    capture_pageleave: true,
    persistence: 'localStorage',
    disable_session_recording: true,   // bandwidth/privacy — opt in later if needed
    autocapture: false,                // explicit events only — keeps noise out
  })
  initialized = true
}

/** Every public entry point funnels through this. */
function ready(): boolean {
  if (!hasAnalyticsConsent()) return false
  ensureInit()
  return initialized
}

/** Track a typed game event. No-op without a key or without consent. */
export function track<K extends keyof GameEvents>(event: K, props?: GameEvents[K]): void {
  try {
    if (!ready()) return
    posthog.capture(event, props as Record<string, unknown> | undefined)
  } catch {
    // analytics must never break the app
  }
}

/**
 * Associate the current browser with a user id (call once after auth).
 *
 * `traits` deliberately does NOT accept free-form personal data any more. The
 * call site used to pass `{ email: user.email }`, which shipped a direct
 * personal identifier to PostHog. The Supabase user id is a pseudonymous key
 * and is all the funnels need.
 */
export function identify(userId: string): void {
  try {
    if (!ready()) return
    posthog.identify(userId)
  } catch {}
}

export function resetIdentity(): void {
  try { if (initialized) posthog.reset() } catch {}
}

export function capturePageview(path: string): void {
  try {
    if (!ready()) return
    posthog.capture('$pageview', { $current_url: path })
  } catch {}
}

// ── Event catalogue ─────────────────────────────────────────────────────────
// Centralising the event shape here keeps property names stable across the
// codebase — rename here and TS will flag every call site.
export interface GameEvents {
  'session_joined':       { sessionId: string }
  'starter_picked':       { sessionId: string; creatureId: string; element: string }
  'encounter_started':    { sessionId: string; trigger: 'gps' | 'timer'; creatureRarity: string; creatureElement: string }
  'encounter_resolved':   { sessionId: string; outcome: 'caught' | 'fled' | 'defeated' | 'knockout'; turns: number; creatureRarity: string }
  'creature_caught':      { sessionId: string; creatureId: string; rarity: string; element: string; isNew: boolean }
  'mission_completed':    { sessionId: string; missionId: string; missionType: string; rewardGold: number; rewardExp: number }
  'level_up':             { sessionId: string; newLevel: number }
  'duel_started':         { sessionId: string; duelId: string }
  'duel_resolved':        { sessionId: string; duelId: string; outcome: 'won' | 'lost' | 'cancelled' }
  'boss_started':         { sessionId: string; bossFightId: string }
  'boss_resolved':        { sessionId: string; bossFightId: string; outcome: 'won' | 'lost' }
  'qr_scanned':           { sessionId: string; qrType: string; success: boolean }
  'shop_purchase':        { sessionId: string; itemId: string; itemType: string; price: number }
  'item_used':            { sessionId: string; itemType: string; context: 'backpack' | 'encounter' | 'duel' | 'boss' }
  'egg_hatched':          { sessionId: string; eggRarity: string; resultRarity: string }
  'enigma_solved':        { sessionId: string; enigmaId: string }
}
