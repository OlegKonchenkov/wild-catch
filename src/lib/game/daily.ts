/**
 * Daily login rewards + streak — pure logic, injected clock.
 *
 * Calendar days are computed in Europe/Rome (the game's home timezone) so the
 * "day" flips at Italian midnight regardless of server region or DST.
 */

export const DAILY_FALLBACK_GOLD = 25

/** YYYY-MM-DD of `d` in Europe/Rome. `en-CA` locale formats exactly as ISO. */
export function romeDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** The YYYY-MM-DD immediately before `key`. UTC-noon arithmetic is DST-safe. */
export function prevDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const noon = Date.UTC(y, m - 1, d, 12)
  const prev = new Date(noon - 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`
}

/**
 * New streak value for a claim on `todayKey`, given the player's most recent
 * prior claim (or null). Consecutive day → streak+1; gap (or first) → 1.
 */
export function computeStreak(
  prev: { claim_date: string; streak: number } | null,
  todayKey: string,
): number {
  if (!prev) return 1
  return prev.claim_date === prevDateKey(todayKey) ? prev.streak + 1 : 1
}

export interface DailyRewardEntry { type: string; payload: Record<string, unknown> }

/**
 * Deterministic daily loot table:
 *  - 1× bustina del giorno (session's daily_pack_id) — fallback 25 gold when unset
 *  - gemme bonus = 2 × min(streak, 7)  → 2…14, capped so streaks stay motivating
 *    without inflating the economy
 *  - every 7th consecutive day: +1 extra bustina (or +50 gold fallback)
 */
export function buildDailyRewards(streak: number, dailyPackId: string | null): DailyRewardEntry[] {
  const rewards: DailyRewardEntry[] = []
  if (dailyPackId) {
    rewards.push({ type: 'bustina', payload: { pack_id: dailyPackId, quantity: 1 } })
  } else {
    rewards.push({ type: 'gold', payload: { amount: DAILY_FALLBACK_GOLD } })
  }
  rewards.push({ type: 'gemme', payload: { amount: 2 * Math.min(Math.max(streak, 1), 7) } })
  if (streak > 0 && streak % 7 === 0) {
    rewards.push(dailyPackId
      ? { type: 'bustina', payload: { pack_id: dailyPackId, quantity: 1 } }
      : { type: 'gold', payload: { amount: DAILY_FALLBACK_GOLD * 2 } })
  }
  return rewards
}
