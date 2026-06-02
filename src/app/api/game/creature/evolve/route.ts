import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, sessionId } = await request.json()

  // Get player creature
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('id, creature_id, duplicates_count, evolved')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!pc) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })
  // Design choice: every 3 copies = +1 evolution. We deliberately do NOT
  // gate on `evolved` so the player can keep evolving as they grind more
  // copies. Each evolve consumes 2 copies, so a stockpile of 6 yields
  // 2 evolved-form increments via two calls. The `evolved` boolean is
  // kept true after the first evolution for UI display purposes only.
  if (pc.duplicates_count < 3) {
    return NextResponse.json({
      error: `Servono 3 copie (hai ${pc.duplicates_count})`,
    }, { status: 400 })
  }

  // Find evolved form
  const { data: evolvedForm } = await supabase
    .from('creatures')
    .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description')
    .eq('evolution_of', pc.creature_id)
    .maybeSingle()

  if (!evolvedForm) return NextResponse.json({ error: 'Nessuna forma evoluta disponibile' }, { status: 404 })

  const admin = createAdminClient()

  // Consume 2 copies, always keep at least 1
  const copiesRemaining = pc.duplicates_count - 2

  // Check if player already owns the evolved form
  const { data: existingEvolved } = await admin
    .from('player_creatures')
    .select('id, duplicates_count')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('creature_id', evolvedForm.id)
    .maybeSingle()

  await Promise.all([
    // Deduct 2 copies from base creature and mark as evolved
    admin.from('player_creatures')
      .update({ duplicates_count: copiesRemaining, evolved: true })
      .eq('id', playerCreatureId),

    // Add evolved form to collection (or increment if already owned)
    existingEvolved
      ? admin.from('player_creatures')
          .update({ duplicates_count: existingEvolved.duplicates_count + 1 })
          .eq('id', existingEvolved.id)
      : admin.from('player_creatures').upsert({
          user_id: user.id,
          creature_id: evolvedForm.id,
          session_id: sessionId,
          duplicates_count: 1,
        }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true }),
  ])

  return NextResponse.json({
    evolved: true,
    copiesConsumed: 2,
    copiesRemaining,
    newCreature: {
      id: evolvedForm.id,
      name: evolvedForm.name,
      rarity: evolvedForm.rarity,
      element: evolvedForm.element,
      image_url: evolvedForm.image_url,
      sprite_cutout_url: evolvedForm.sprite_cutout_url,
      sprite_url: evolvedForm.sprite_url,
      hp: evolvedForm.hp,
      atk: evolvedForm.atk,
      def: evolvedForm.def,
      description: evolvedForm.description,
    },
  })
}
