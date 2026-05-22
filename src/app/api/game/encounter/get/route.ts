import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipmentBonuses } from '@/lib/game/equipment'

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
  let squadCreatures: Array<{ pcId: string; id: string; name: string; hp: number; atk: number; element: string; rarity: string; image_url: string | null; sprite_cutout_url: string | null; sprite_url: string | null; attack_sound_url: string | null; attack_sound_duration_ms: number | null }> = []
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('squad_ids')
    .eq('user_id', user.id)
    .eq('session_id', encounter.session_id)
    .single()

  const squadIds: string[] = (playerSession as any)?.squad_ids ?? []
  if (squadIds.length > 0) {
    // Critical combat data — no sound fields so query never fails pre-migration
    const { data: pcs } = await supabase
      .from('player_creatures')
      .select('id, creatures(id, name, hp, atk, element, rarity, image_url, sprite_cutout_url, sprite_url)')
      .in('id', squadIds)
      .eq('user_id', user.id)
      .eq('session_id', encounter.session_id)

    if (pcs) {
      const equipBonuses = await getEquipmentBonuses(supabase, squadIds)
      squadCreatures = squadIds
        .map(sid => (pcs as any[]).find(pc => pc.id === sid))
        .filter(Boolean)
        .map((pc: any) => {
          const b = equipBonuses.get(pc.id) ?? { hp: 0, atk: 0, def: 0 }
          return {
          pcId: pc.id,
          id: pc.creatures.id,
          name: pc.creatures.name,
          hp: pc.creatures.hp + b.hp,
          atk: pc.creatures.atk + b.atk,
          element: pc.creatures.element,
          rarity: pc.creatures.rarity,
          image_url: pc.creatures.image_url ?? null,
          sprite_cutout_url: pc.creatures.sprite_cutout_url ?? null,
          sprite_url: pc.creatures.sprite_url ?? null,
          attack_sound_url: null,
          attack_sound_duration_ms: null,
          }
        })

      // Try to enrich with sound data (requires 018_attack_sound migration)
      const creatureIds = squadCreatures.map(c => c.id)
      const { data: soundRows } = await supabase
        .from('creatures')
        .select('id, attack_sound_url, attack_sound_duration_ms')
        .in('id', creatureIds)
      if (soundRows) {
        const soundMap: Record<string, { url: string | null; ms: number | null }> = {}
        for (const r of soundRows as any[]) {
          soundMap[r.id] = { url: r.attack_sound_url ?? null, ms: r.attack_sound_duration_ms ?? null }
        }
        squadCreatures = squadCreatures.map(c => ({
          ...c,
          attack_sound_url: soundMap[c.id]?.url ?? null,
          attack_sound_duration_ms: soundMap[c.id]?.ms ?? null,
        }))
      }
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
      sprite_cutout_url: creature.sprite_cutout_url,
      sprite_url: creature.sprite_url,
      lottie_url: creature.lottie_url,
    },
    wildHp: encounter.wild_creature_hp,
    wildHpMax: creature.hp,
    squadCreatures,
  })
}
