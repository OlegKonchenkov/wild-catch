import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const encounterId = searchParams.get('id')
  if (!encounterId) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })

  const creature = (encounter as any).creatures

  // Load squad creatures from player_sessions
  let squadCreatures: Array<{ pcId: string; id: string; name: string; hp: number; atk: number; element: string; rarity: string; image_url: string | null; attack_sound_url: string | null; attack_sound_duration_ms: number | null }> = []
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('squad_ids')
    .eq('user_id', user.id)
    .eq('session_id', encounter.session_id)
    .single()

  const squadIds: string[] = (playerSession as any)?.squad_ids ?? []
  if (squadIds.length > 0) {
    const { data: pcs } = await supabase
      .from('player_creatures')
      .select('id, creatures(id, name, hp, atk, element, rarity, image_url, attack_sound_url, attack_sound_duration_ms)')
      .in('id', squadIds)
      .eq('user_id', user.id)
      .eq('session_id', encounter.session_id)

    if (pcs) {
      squadCreatures = squadIds
        .map(sid => (pcs as any[]).find(pc => pc.id === sid))
        .filter(Boolean)
        .map((pc: any) => ({
          pcId: pc.id,
          id: pc.creatures.id,
          name: pc.creatures.name,
          hp: pc.creatures.hp,
          atk: pc.creatures.atk,
          element: pc.creatures.element,
          rarity: pc.creatures.rarity,
          image_url: pc.creatures.image_url ?? null,
          attack_sound_url: pc.creatures.attack_sound_url ?? null,
          attack_sound_duration_ms: pc.creatures.attack_sound_duration_ms ?? null,
        }))
    }
  }

  return NextResponse.json({
    encounterId: encounter.id,
    status: encounter.status,
    creature: {
      id: creature.id,
      name: creature.name,
      element: creature.element,
      rarity: creature.rarity,
      hp: creature.hp,
      image_url: creature.image_url,
      sprite_url: creature.sprite_url,
      lottie_url: creature.lottie_url,
    },
    wildHp: encounter.wild_creature_hp,
    wildHpMax: creature.hp,
    squadCreatures,
  })
}
