import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/game/map-pins?sessionId=...
// Returns map pins for the given session (visible to all authenticated players)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const { data, error } = await supabase
    .from('session_map_pins')
    .select('id, lat, lng, name, description, image_url, reward_type, reward_radius_m, reward_payload')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark which pins this user has already claimed
  const pinIds    = (data ?? []).map((p: any) => p.id)
  const bossPinIds = (data ?? []).filter((p: any) => p.reward_type === 'boss').map((p: any) => p.id)

  let claimedSet = new Set<string>()
  if (pinIds.length > 0) {
    // Regular pins — use pin_claims
    const regularPinIds = pinIds.filter((id: string) => !bossPinIds.includes(id))
    if (regularPinIds.length > 0) {
      const { data: claims } = await supabase
        .from('pin_claims')
        .select('pin_id')
        .eq('user_id', user.id)
        .in('pin_id', regularPinIds)
      for (const c of claims ?? []) claimedSet.add((c as any).pin_id)
    }

    // Boss pins — claimed only when the boss fight is won
    if (bossPinIds.length > 0) {
      const { data: wonFights } = await supabase
        .from('boss_fights')
        .select('pin_id')
        .eq('user_id', user.id)
        .eq('status', 'won')
        .in('pin_id', bossPinIds)
      for (const f of wonFights ?? []) claimedSet.add((f as any).pin_id)
    }
  }

  const pins = (data ?? []).map((p: any) => {
    // For enigma pins: expose question + image_url from payload, but NEVER expose the solution
    let enigmaPublic: Record<string, unknown> | null = null
    if (p.reward_type === 'enigma' && p.reward_payload) {
      enigmaPublic = {
        question:  p.reward_payload.question  ?? null,
        image_url: p.reward_payload.image_url ?? null,
      }
    }
    // Strip reward_payload from the response (contains secrets); replace with safe enigma data
    const { reward_payload: _rp, ...rest } = p
    return {
      ...rest,
      claimed: claimedSet.has(p.id),
      ...(enigmaPublic ? { reward_payload: enigmaPublic } : {}),
    }
  })

  return NextResponse.json({ pins })
}
