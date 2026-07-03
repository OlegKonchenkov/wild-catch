import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/game/trades/options?friendId=...&sessionId=...
// I doppioni (count >= 2) miei e dell'amico nella sessione, per il picker.
export async function GET(request: Request) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const url = new URL(request.url)
  const friendId = url.searchParams.get('friendId')
  const sessionId = url.searchParams.get('sessionId')
  if (!friendId || !sessionId) return NextResponse.json({ error: 'friendId e sessionId richiesti' }, { status: 400 })

  const admin = createAdminClient()

  // Solo tra amici: stessa guardia della proposta
  const { data: friendship } = await admin
    .from('friendships').select('id').eq('status', 'accepted')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
    .maybeSingle()
  if (!friendship) return NextResponse.json({ error: 'Non siete amici' }, { status: 403 })

  const dupes = async (uid: string) => {
    const { data } = await admin
      .from('player_creatures')
      .select('creature_id, duplicates_count, creatures(name, rarity, sprite_url, image_url)')
      .eq('user_id', uid).eq('session_id', sessionId)
      .gte('duplicates_count', 2)
    return (data ?? []).map((r: any) => ({
      creatureId: r.creature_id,
      copies: r.duplicates_count,
      name: (Array.isArray(r.creatures) ? r.creatures[0] : r.creatures)?.name ?? '',
      rarity: (Array.isArray(r.creatures) ? r.creatures[0] : r.creatures)?.rarity ?? null,
      image: (Array.isArray(r.creatures) ? r.creatures[0] : r.creatures)?.sprite_url
        || (Array.isArray(r.creatures) ? r.creatures[0] : r.creatures)?.image_url || null,
    }))
  }

  const [mine, theirs] = await Promise.all([dupes(user.id), dupes(friendId)])
  return NextResponse.json({ mine, theirs })
}
