import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Rarity-weighted creature pools
const RARITY_POOLS: Record<string, Array<{ rarity: string; weight: number }>> = {
  comune:       [{ rarity: 'comune',      weight: 1 }],
  non_comune:   [{ rarity: 'comune',      weight: 70 }, { rarity: 'non_comune',  weight: 30 }],
  raro:         [{ rarity: 'comune',      weight: 50 }, { rarity: 'non_comune',  weight: 30 }, { rarity: 'raro',        weight: 20 }],
  epico:        [{ rarity: 'comune',      weight: 40 }, { rarity: 'non_comune',  weight: 30 }, { rarity: 'raro',        weight: 20 }, { rarity: 'epico',       weight: 10 }],
  leggendario:  [{ rarity: 'comune',      weight: 35 }, { rarity: 'non_comune',  weight: 25 }, { rarity: 'raro',        weight: 20 }, { rarity: 'epico',       weight: 15 }, { rarity: 'leggendario', weight: 5 }],
  mitologico:   [{ rarity: 'comune',      weight: 30 }, { rarity: 'non_comune',  weight: 25 }, { rarity: 'raro',        weight: 20 }, { rarity: 'epico',       weight: 15 }, { rarity: 'leggendario', weight: 8 }, { rarity: 'mitologico', weight: 2 }],
}

function pickRarity(eggRarity: string): string {
  const pool = RARITY_POOLS[eggRarity] ?? RARITY_POOLS['comune']
  const total = pool.reduce((s, e) => s + e.weight, 0)
  let roll = Math.random() * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) return entry.rarity
  }
  return pool[pool.length - 1].rarity
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { sessionId } = body
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  // Load egg
  const { data: egg } = await supabase
    .from('player_eggs')
    .select('id, egg_rarity, steps_required, steps_at_pickup, hatched_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!egg) return NextResponse.json({ error: 'Uovo non trovato' }, { status: 404 })
  if ((egg as any).hatched_at) return NextResponse.json({ error: 'Uovo già schiuso' }, { status: 409 })

  // Check steps condition
  const { data: ps } = await supabase
    .from('player_sessions')
    .select('steps_walked')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  const stepsWalked = (ps as any)?.steps_walked ?? 0
  const stepsProgress = stepsWalked - (egg as any).steps_at_pickup

  if ((egg as any).steps_required > 0 && stepsProgress < (egg as any).steps_required) {
    return NextResponse.json({
      error: 'Non abbastanza passi',
      steps_progress: stepsProgress,
      steps_required: (egg as any).steps_required,
    }, { status: 400 })
  }

  // Pick creature rarity, then pick random creature of that rarity in this session
  const targetRarity = pickRarity((egg as any).egg_rarity)

  let pool: any[] = []
  const { data: candidates } = await supabase
    .from('creatures')
    .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description, status_effect, status_effect_chance')
    .eq('rarity', targetRarity)
    .limit(100)
  if (candidates?.length) {
    pool = candidates
  } else {
    // Fallback to comune if targeted rarity has no creatures
    const { data: fallback } = await supabase
      .from('creatures')
      .select('id, name, rarity, element, image_url, sprite_cutout_url, sprite_url, hp, atk, def, description, status_effect, status_effect_chance')
      .eq('rarity', 'comune')
      .limit(50)
    if (!fallback?.length) {
      return NextResponse.json({ error: 'Nessuna creatura disponibile' }, { status: 500 })
    }
    pool = fallback
  }

  const picked = pool[Math.floor(Math.random() * pool.length)]

  // ── Atomic egg-claim FIRST, then grant the creature ──────────────────────
  // The previous order (grant first, mark hatched second) had a race: two
  // concurrent hatch requests both passed the hatched_at IS NULL check at
  // the top of this handler, then both inserted player_creatures rows,
  // and only one of the hatched_at updates "won". Net effect: a single
  // egg could yield 2+ creatures.
  //
  // Fix: try to atomically flip hatched_at NULL → now() guarded by
  // `.is('hatched_at', null)`. If 0 rows match, another request beat us
  // and we abort without granting anything.
  const { data: claimedRows, error: claimError } = await supabase
    .from('player_eggs')
    .update({ hatched_at: new Date().toISOString(), hatched_creature_id: picked.id })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('hatched_at', null)
    .select('id')

  if (claimError || !claimedRows || claimedRows.length === 0) {
    return NextResponse.json({ error: 'Uovo già schiuso' }, { status: 409 })
  }

  // Now safe to grant the creature — egg is exclusively ours.
  const { data: existing } = await supabase
    .from('player_creatures')
    .select('id, duplicates_count')
    .eq('user_id', user.id)
    .eq('creature_id', picked.id)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('player_creatures')
      .update({ duplicates_count: (existing as any).duplicates_count + 1 })
      .eq('id', (existing as any).id)
  } else {
    await supabase.from('player_creatures').upsert({
      user_id: user.id,
      creature_id: picked.id,
      session_id: sessionId,
      duplicates_count: 1,
    }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
  }

  // Game event — egg hatch is treated as a catch
  const { createAdminClient } = await import('@/lib/supabase/admin')
  createAdminClient().from('player_game_events').insert({
    user_id: user.id, session_id: sessionId, type: 'catch',
    payload: {
      creature_name: picked.name,
      rarity:        picked.rarity,
      element:       picked.element,
      evolved:       false,
      via_egg:       true,
      egg_rarity:    (egg as any).egg_rarity,
      image_url:     picked.sprite_cutout_url || picked.sprite_url || picked.image_url || null,
      hp:  picked.hp  ?? null,
      atk: picked.atk ?? null,
      def: picked.def ?? null,
    },
  }).then(undefined, () => {})

  return NextResponse.json({
    hatched: true,
    creature: {
      id: picked.id,
      name: picked.name,
      rarity: picked.rarity,
      element: picked.element,
      image_url: picked.image_url,
      sprite_cutout_url: picked.sprite_cutout_url,
      sprite_url: picked.sprite_url,
      hp: picked.hp,
      atk: picked.atk,
      def: picked.def,
      description: picked.description,
      status_effect: picked.status_effect ?? null,
      status_effect_chance: picked.status_effect_chance ?? null,
    },
  })
}
