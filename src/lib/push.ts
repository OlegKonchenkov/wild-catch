import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PushPayload {
  title: string
  body: string
  /** Path to open on click (default '/'). */
  url?: string
  /** Collapse key — a newer push with the same tag replaces the old one. */
  tag?: string
  icon?: string
}

let configured: boolean | null = null

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!pub || !priv) {
    configured = false
    return false
  }
  try {
    webpush.setVapidDetails(subject, pub, priv)
    configured = true
  } catch {
    configured = false
  }
  return configured
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function deliver(subs: SubscriptionRow[], payload: PushPayload): Promise<void> {
  if (subs.length === 0) return
  const admin = createAdminClient()
  const body = JSON.stringify(payload)
  const dead: string[] = []

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        // 404 Not Found / 410 Gone → subscription expired, prune it.
        if (status === 404 || status === 410) dead.push(sub.id)
      }
    }),
  )

  if (dead.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', dead)
  }
}

/**
 * Best-effort player display name (nickname) for personalised copy.
 * Returns null on any failure so callers can fall back to neutral text.
 */
export async function getDisplayName(userId: string): Promise<string | null> {
  try {
    if (!userId) return null
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('nickname')
      .eq('user_id', userId)
      .maybeSingle()
    const nick = (data as { nickname?: string | null } | null)?.nickname?.trim()
    return nick && nick.length > 0 ? nick : null
  } catch {
    return null
  }
}

/** Pick a random entry — for light copy variety so pushes don't feel canned. */
export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Fire-and-forget push to every device of a user. Never throws — push is a
 * best-effort enhancement on top of the in-app realtime notifications.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!userId || !ensureConfigured()) return
    const admin = createAdminClient()
    const { data } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    await deliver((data ?? []) as SubscriptionRow[], payload)
  } catch {
    /* swallow — never break the calling request */
  }
}

/**
 * Push to every subscribed player currently in a session. Optionally exclude
 * one user (e.g. the actor who triggered the event).
 */
export async function sendPushToSession(
  sessionId: string,
  payload: PushPayload,
  excludeUserId?: string,
): Promise<void> {
  try {
    if (!sessionId || !ensureConfigured()) return
    const admin = createAdminClient()
    const { data: players } = await admin
      .from('player_sessions')
      .select('user_id')
      .eq('session_id', sessionId)
    let userIds = (players ?? []).map((p: { user_id: string }) => p.user_id)
    if (excludeUserId) userIds = userIds.filter(id => id !== excludeUserId)
    if (userIds.length === 0) return
    const { data } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)
    await deliver((data ?? []) as SubscriptionRow[], payload)
  } catch {
    /* swallow */
  }
}
