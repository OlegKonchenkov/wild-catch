import { romeDateKey } from '@/lib/game/daily'

export type MissionRecurrence = 'daily' | 'weekly' | 'monthly' | null | undefined

/**
 * Period key for a mission's progress row (Europe/Rome calendar):
 *   one-shot → ''            (matches every pre-existing row)
 *   daily    → '2026-07-02'
 *   weekly   → '2026-W27'    (ISO week, Monday-based)
 *   monthly  → '2026-07'
 *
 * No cron needed: a new period simply reads/writes a fresh row.
 */
export function periodKeyFor(recurrence: MissionRecurrence, now: Date = new Date()): string {
  if (!recurrence) return ''
  const dateKey = romeDateKey(now) // YYYY-MM-DD in Rome
  if (recurrence === 'daily') return dateKey
  if (recurrence === 'monthly') return dateKey.slice(0, 7)
  return isoWeekKey(dateKey)
}

/** '2026-W27' for the ISO week containing the given YYYY-MM-DD. */
export function isoWeekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  // UTC-noon avoids DST edge cases in the day arithmetic below.
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  // ISO week: move to the Thursday of this week, whose year is the ISO year.
  const dayOfWeek = date.getUTCDay() || 7 // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1, 12))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
}
