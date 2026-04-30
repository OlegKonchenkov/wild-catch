import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectCreatureForEncounter } from '@/lib/game/rng'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, trigger = 'gps' } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  // Get player session (last_position included so we don't re-query for the bounds check)
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('id, level, selected_creature_id, squad_ids, last_position')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Block encounters if session is not active
  const { data: session } = await supabase
    .from('sessions')
    .select('status, area_bounds')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  // Block if player is out of bounds (use last stored position from the row above)
  if (session.area_bounds) {
    const { isWithinBounds, parsePoint } = await import('@/lib/game/anti-cheat')
    const parsedPos = parsePoint((playerSession as any).last_position)
    if (parsedPos) {
      const bounds = session.area_bounds as { north: number; south: number; east: number; west: number }
      const inBounds = isWithinBounds(parsedPos, bounds)
      if (!inBounds) return NextResponse.json({ error: 'Fuori dall\'area di gioco' }, { status: 403 })
    }
  }

  // Auto-expire encounters older than 3 minutes (player dismissed popup without entering)
  await supabase
    .from('encounters')
    .update({ status: 'fled' })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .lt('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())

  // Check no active encounter already
  const { data: existing } = await supabase
    .from('encounters')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Incontro già in corso', encounterId: existing.id })

  const squadIds: string[] = (playerSession as any).squad_ids ?? []
  const primaryCreatureId = squadIds.length > 0
    ? squadIds[0]
    : playerSession.selected_creature_id

  if (!primaryCreatureId) {
    return NextResponse.json({
      error: 'Seleziona prima il tuo starter o imposta una squadra',
      requiresStarter: true,
    }, { status: 409 })
  }

  // Get creatures for selection
  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, spawn_weight, rarity, min_level, hp, element')
    .eq('spawnable', true)

  if (!creatures?.length) return NextResponse.json({ error: 'Nessuna creatura disponibile' }, { status: 500 })

  // Load optional per-session spawn config
  const admin = createAdminClient()
  const { data: spawnCfg } = await admin
    .from('session_spawn_config')
    .select('non_comune_bonus, raro_bonus, epico_bonus, leggendario_bonus')
    .eq('session_id', sessionId)
    .maybeSingle()

  // RNG creature selection — server-side only
  const selected = selectCreatureForEncounter(creatures, playerSession.level, spawnCfg ?? undefined)
  if (!selected) return NextResponse.json({ error: 'Nessuna creatura idonea' }, { status: 500 })

  // Get full creature data
  const { data: creature } = await supabase
    .from('creatures')
    .select('*')
    .eq('id', selected.id)
    .single()

  if (!creature) return NextResponse.json({ error: 'Errore dati creatura' }, { status: 500 })

  // Load squad creatures (up to 3), falling back to single selected_creature_id
  let squadCreatures: Array<{ pcId: string; id: string; name: string; hp: number; atk: number; element: string; rarity: string; image_url: string | null; attack_sound_url: string | null; attack_sound_duration_ms: number | null }> = []
  if (squadIds.length > 0) {
    // Critical combat data — no sound fields so query never fails pre-migration
    const { data: pcs } = await supabase
      .from('player_creatures')
      .select('id, creatures(id, name, hp, atk, element, rarity, image_url)')
      .in('id', squadIds)
      .eq('user_id', user.id)
      .eq('session_id', sessionId)

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
          attack_sound_url: null,
          attack_sound_duration_ms: null,
        }))

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

  // Create encounter — lock player_creature_id at start (anti-cheat)
  const { data: encounter, error: encError } = await supabase
    .from('encounters')
    .insert({
      user_id: user.id,
      creature_id: creature.id,
      session_id: sessionId,
      status: 'active',
      trigger,
      wild_creature_hp: creature.hp,
      player_creature_id: primaryCreatureId,
    })
    .select()
    .single()

  if (encError) return NextResponse.json({ error: 'Errore creazione incontro' }, { status: 500 })

  return NextResponse.json({
    encounterId: encounter.id,
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
    wildHp: creature.hp,
    squadCreatures,
  })
}

