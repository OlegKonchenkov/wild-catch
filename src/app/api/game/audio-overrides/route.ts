import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

/**
 * Returns the audio overrides the player should use for the given session.
 *
 * Resolution rules (per slot):
 *   - per-session row wins over global row
 *   - only `enabled=true` rows are returned
 *   - if no override row is present, the slot is omitted (caller falls back
 *     to the default synth / silence)
 *
 * `sessionId` query param is optional: callers that don't yet have a session
 * (e.g. onboarding) still receive globally-scoped overrides.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  // RLS already gates on enabled=true, but we add it here as an explicit
  // belt-and-braces filter so misconfigured policies wouldn't leak disabled
  // rows to the client.
  let query = supabase
    .from('audio_overrides')
    .select('slot, file_url, session_id')
    .eq('enabled', true)

  query = sessionId
    ? query.or(`session_id.eq.${sessionId},session_id.is.null`)
    : query.is('session_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve precedence: per-session row beats global row for the same slot.
  const bySlot = new Map<string, { slot: string; file_url: string }>()
  for (const row of data ?? []) {
    const existing = bySlot.get(row.slot)
    // Prefer the row whose session_id matches sessionId; if existing already
    // matches, keep it. Otherwise overwrite.
    if (!existing || (row.session_id && row.session_id === sessionId)) {
      bySlot.set(row.slot, { slot: row.slot, file_url: row.file_url })
    }
  }

  return NextResponse.json({ overrides: Array.from(bySlot.values()) })
}
