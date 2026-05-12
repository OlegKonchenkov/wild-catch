import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// Rate limiting is opt-in: if UPSTASH_REDIS_REST_URL / _TOKEN are unset, every
// rateLimit() call returns { success: true } and no requests are blocked.
// Once those env vars are set (free tier covers a small event app comfortably),
// the configured budgets below take effect with no further code changes.

const url   = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
const enabled = Boolean(url && token)

const redis = enabled ? new Redis({ url: url!, token: token! }) : null

function makeLimiter(tokens: number, window: `${number}s` | `${number}m`) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: 'rl:wildcatch',
  })
}

// ── Per-endpoint budgets (see docs/plans/2026-05-12-rls-and-ratelimit-audit.md)
// Numbers chosen with 2-3× headroom over real-player traffic.
export const LIMITS = {
  encounter_start: makeLimiter(6,  '60s'),
  encounter_act:   makeLimiter(5,  '10s'),  // catch / fight / heal / flee / switch
  position:        makeLimiter(20, '60s'),
  qr_scan:         makeLimiter(12, '60s'),
  shop_buy:        makeLimiter(4,  '10s'),
  auth_join:       makeLimiter(8,  '300s'),
} as const

export type LimitKey = keyof typeof LIMITS

export interface RateLimitResult {
  success: boolean
  reset?: number
  remaining?: number
}

/**
 * Check whether the user is within the budget for the given limit. Falls open
 * (success: true) when rate limiting is not configured, so missing env vars
 * never block traffic — only silently disable enforcement.
 */
export async function rateLimit(key: LimitKey, userId: string): Promise<RateLimitResult> {
  const limiter = LIMITS[key]
  if (!limiter) return { success: true }
  const r = await limiter.limit(`${key}:${userId}`)
  return { success: r.success, reset: r.reset, remaining: r.remaining }
}

/** Build a 429 response with a Retry-After header derived from the reset time. */
export function rateLimitResponse(reset?: number) {
  const secs = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 60
  return NextResponse.json(
    { error: 'Troppe richieste, riprova tra un attimo.' },
    { status: 429, headers: { 'Retry-After': String(secs) } }
  )
}
