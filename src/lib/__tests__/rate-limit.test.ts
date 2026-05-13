import { describe, it, expect } from 'vitest'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// Without UPSTASH_REDIS_REST_URL / _TOKEN set the module initialises with
// redis = null, so every limiter is null and rateLimit() falls open.

describe('rateLimit', () => {
  it('returns success:true for all keys when no env vars are set', async () => {
    const keys = ['encounter_start', 'encounter_act', 'position', 'qr_scan', 'shop_buy', 'auth_join'] as const
    for (const key of keys) {
      const result = await rateLimit(key, 'user-1')
      expect(result).toEqual({ success: true })
    }
  })
})

describe('rateLimitResponse', () => {
  it('returns status 429', () => {
    const res = rateLimitResponse()
    expect(res.status).toBe(429)
  })

  it('includes a positive integer Retry-After header', () => {
    const res = rateLimitResponse()
    const header = res.headers.get('Retry-After')
    expect(header).not.toBeNull()
    expect(Number(header)).toBeGreaterThan(0)
  })

  it('uses ~60 s default when reset is undefined', () => {
    const res = rateLimitResponse(undefined)
    expect(Number(res.headers.get('Retry-After'))).toBe(60)
  })

  it('computes Retry-After from a future reset timestamp', () => {
    const reset = Date.now() + 30_000
    const res = rateLimitResponse(reset)
    const secs = Number(res.headers.get('Retry-After'))
    expect(secs).toBeGreaterThan(0)
    expect(secs).toBeLessThanOrEqual(30)
  })

  it('returns at least 1 s when reset is in the past', () => {
    const res = rateLimitResponse(Date.now() - 1000)
    expect(Number(res.headers.get('Retry-After'))).toBe(1)
  })

  it('includes the error key in the JSON body', async () => {
    const res = rateLimitResponse()
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})
