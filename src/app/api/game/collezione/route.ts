import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/collezione?sessionId=...
// Cultural collection grouped by luogo, with the player's owned ref_ids and
// trophy progress. Catalogue is global; ownership is per-session.
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const [placesRes, artRes, charRes, anecRes, ownedRes, trophyRes, ownedTrophyRes] = await Promise.all([
    supabase.from('cultural_places').select('id, name, description, image_url'),
    supabase.from('artworks').select('id, name, description, image_url, place_id, rarity'),
    supabase.from('characters').select('id, name, description, image_url, place_id, rarity'),
    supabase.from('anecdotes').select('id, title, body, image_url, place_id, rarity'),
    supabase.from('player_collection').select('kind, ref_id, copies').eq('user_id', user.id).eq('session_id', sessionId),
    supabase.from('trophies').select('id, name, description, image_url'),
    supabase.from('player_trophies').select('trophy_id').eq('user_id', user.id).eq('session_id', sessionId),
  ])

  const ownedIds = new Set((ownedRes.data ?? []).map((r: any) => `${r.kind}:${r.ref_id}`))
  const owns = (kind: string, id: string) => ownedIds.has(`${kind}:${id}`)

  const places = (placesRes.data ?? []).map((p: any) => ({
    ...p,
    artworks: (artRes.data ?? []).filter((a: any) => a.place_id === p.id).map((a: any) => ({ ...a, owned: owns('opera', a.id) })),
    characters: (charRes.data ?? []).filter((c: any) => c.place_id === p.id).map((c: any) => ({ ...c, owned: owns('personaggio', c.id) })),
    anecdotes: (anecRes.data ?? []).filter((a: any) => a.place_id === p.id).map((a: any) => ({ ...a, owned: owns('aneddoto', a.id) })),
  }))

  // Orphans (no place) so nothing is hidden from the collection.
  const orphanArt = (artRes.data ?? []).filter((a: any) => !a.place_id).map((a: any) => ({ ...a, owned: owns('opera', a.id) }))
  const orphanChar = (charRes.data ?? []).filter((c: any) => !c.place_id).map((c: any) => ({ ...c, owned: owns('personaggio', c.id) }))
  const orphanAnec = (anecRes.data ?? []).filter((a: any) => !a.place_id).map((a: any) => ({ ...a, owned: owns('aneddoto', a.id) }))

  const ownedTrophyIds = new Set((ownedTrophyRes.data ?? []).map((r: any) => r.trophy_id))
  const trophies = (trophyRes.data ?? []).map((t: any) => ({ ...t, owned: ownedTrophyIds.has(t.id) }))

  return NextResponse.json({
    places,
    orphans: { artworks: orphanArt, characters: orphanChar, anecdotes: orphanAnec },
    trophies,
  })
}
