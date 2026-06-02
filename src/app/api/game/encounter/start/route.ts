import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectCreatureForEncounter } from '@/lib/game/rng'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getEquipmentBonuses } from '@/lib/game/equipment'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { getSpawnableCreatures } from '@/lib/game/config-cache'

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = await rateLimit('encounter_start', user.id)
  if (!rl.success) return rateLimitResponse(rl.reset)

  const body = await request.json().catch(() => ({}))
  const { sessionId, trigger = 'gps' } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const admin = createAdminClient()

  // Batch 1 — four independent reads in parallel:
  //   - player's session row (level, squad, last position)
  //   - session metadata (status + bounds)
  //   - spawnable creature pool (cached — read-only config)
  //   - per-session spawn config (admin client to bypass RLS)
  const [psRes, sessRes, creatures, spawnCfgRes] = await Promise.all([
    supabase
      .from('player_sessions')
      .select('id, level, selected_creature_id, squad_ids, last_position')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single(),
    supabase
      .from('sessions')
      .select('status, area_bounds')
      .eq('id', sessionId)
      .single(),
    getSpawnableCreatures(),
    admin
      .from('session_spawn_config')
      .select('non_comune_bonus, raro_bonus, epico_bonus, leggendario_bonus')
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])

  const playerSession = psRes.data
  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  const session = sessRes.data
  if (!session || session.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  // Out-of-bounds check (CPU only) using the last position we already loaded.
  // area_bounds may be {} for sessions with no geographic restriction (e.g. the
  // always-on Tutorial session). Only enforce the check when the cardinals exist.
  const sessionBounds = session.area_bounds as { north?: number; south?: number; east?: number; west?: number } | null
  if (sessionBounds && typeof sessionBounds.north === 'number') {
    const { isWithinBounds, parsePoint } = await import('@/lib/game/anti-cheat')
    const parsedPos = parsePoint((playerSession as any).last_position)
    if (parsedPos) {
      const inBounds = isWithinBounds(parsedPos, sessionBounds as { north: number; south: number; east: number; west: number })
      if (!inBounds) return NextResponse.json({ error: 'Fuori dall\'area di gioco' }, { status: 403 })
    }
  }

  if (!creatures?.length) return NextResponse.json({ error: 'Nessuna creatura disponibile' }, { status: 500 })

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

  // Batch 2 — auto-expire stale encounters (write) runs in parallel with the
  // squad-creatures join (incl. sound fields, migration 018 is already live) and
  // the equipment-bonus map for the whole squad. All three are independent.
  const [, squadJoinRes, equipBonusesMap] = await Promise.all([
    supabase
      .from('encounters')
      .update({ status: 'fled' })
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .lt('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString()),
    squadIds.length > 0
      ? supabase
          .from('player_creatures')
          .select('id, creatures(id, name, hp, atk, element, rarity, image_url, sprite_cutout_url, sprite_url, attack_sound_url, attack_sound_duration_ms)')
          .in('id', squadIds)
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
      : Promise.resolve({ data: null as any[] | null }),
    squadIds.length > 0
      ? getEquipmentBonuses(supabase, squadIds)
      : Promise.resolve(new Map<string, { hp: number; atk: number; def: number }>()),
  ])

  // After expire, check whether the player already has an active encounter
  // (would conflict with creating a new one). Sequential by design.
  const { data: existing } = await supabase
    .from('encounters')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Incontro già in corso', encounterId: existing.id })

  // RNG creature selection — server-side only.
  const selected = selectCreatureForEncounter(creatures, playerSession.level, spawnCfgRes.data ?? undefined)
  if (!selected) return NextResponse.json({ error: 'Nessuna creatura idonea' }, { status: 500 })

  // Batch 3 — full row for the selected wild creature in parallel with the
  // legacy fallback lookup for the primary creature's HP (only needed when the
  // player still has no squad, just a selected_creature_id from the old system).
  const needsPrimaryLookup = squadIds.length === 0 && !!primaryCreatureId
  const [creatureRes, primaryPcRes, primaryEquipMap] = await Promise.all([
    supabase
      .from('creatures')
      .select('*')
      .eq('id', selected.id)
      .single(),
    needsPrimaryLookup
      ? supabase
          .from('player_creatures')
          .select('creatures(hp)')
          .eq('id', primaryCreatureId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    needsPrimaryLookup
      ? getEquipmentBonuses(supabase, [primaryCreatureId])
      : Promise.resolve(null as Map<string, { hp: number; atk: number; def: number }> | null),
  ])

  const creature = creatureRes.data
  if (!creature) return NextResponse.json({ error: 'Errore dati creatura' }, { status: 500 })

  // Assemble the squad payload from data already in memory — no extra DB I/O.
  // Sound fields were folded into the main join above (used to be a 2nd query).
  let squadCreatures: Array<{
    pcId: string; id: string; name: string; hp: number; atk: number;
    element: string; rarity: string; image_url: string | null;
    sprite_cutout_url: string | null; sprite_url: string | null;
    attack_sound_url: string | null; attack_sound_duration_ms: number | null
  }> = []
  if (squadIds.length > 0 && squadJoinRes.data) {
    const pcs = squadJoinRes.data as any[]
    squadCreatures = squadIds
      .map(sid => pcs.find(pc => pc.id === sid))
      .filter(Boolean)
      .map((pc: any) => {
        const b = equipBonusesMap.get(pc.id) ?? { hp: 0, atk: 0, def: 0 }
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
          attack_sound_url: pc.creatures.attack_sound_url ?? null,
          attack_sound_duration_ms: pc.creatures.attack_sound_duration_ms ?? null,
        }
      })
  }

  // Authoritative initial HP for the active creature (anti-cheat). When the
  // player has a squad, slot 0 IS the primary and we already computed its
  // bonus-adjusted HP. Only the legacy "selected_creature_id only" path needs
  // the separate lookup we ran in batch 3.
  let primaryCreatureMaxHp: number | null = null
  if (squadIds.length > 0 && squadCreatures.length > 0) {
    primaryCreatureMaxHp = squadCreatures[0].hp
  } else if (needsPrimaryLookup && primaryPcRes.data) {
    const baseHp = (primaryPcRes.data as any)?.creatures?.hp ?? null
    if (baseHp !== null) {
      const b = (primaryEquipMap?.get(primaryCreatureId)) ?? { hp: 0, atk: 0, def: 0 }
      primaryCreatureMaxHp = baseHp + b.hp
    }
  }

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
      player_hp: primaryCreatureMaxHp,
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
      sprite_cutout_url: creature.sprite_cutout_url,
      sprite_url: creature.sprite_url,
      lottie_url: creature.lottie_url,
    },
    wildHp: creature.hp,
    squadCreatures,
  })
}
