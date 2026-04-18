import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scaleCombatStats } from '@/lib/game/combat'
import { incrementMissionProgress } from '@/lib/game/missions'
import type { CompletedMission } from '@/lib/game/missions'

// Haversine distance in metres
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// POST /api/game/map-pins/claim
// body: { pinId, sessionId, lat, lng, solution? }  ← solution required for enigma pins
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { pinId, sessionId, lat, lng, solution } = body

  if (!pinId || !sessionId || lat == null || lng == null) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Guard: session must be active
  const { data: sessionCheck } = await supabase
    .from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'Sessione non attiva' }, { status: 403 })
  }

  // Load pin (admin client — bypasses RLS to read reward_payload)
  const admin = createAdminClient()
  const { data: pin } = await admin
    .from('session_map_pins')
    .select('id, session_id, lat, lng, name, reward_type, reward_payload, reward_radius_m')
    .eq('id', pinId)
    .eq('session_id', sessionId)
    .single()

  if (!pin) return NextResponse.json({ error: 'Pin non trovato' }, { status: 404 })
  if (!pin.reward_type) return NextResponse.json({ error: 'Nessuna ricompensa su questo pin' }, { status: 422 })

  // Server-side proximity check (add 20 m GPS tolerance on top of configured radius)
  const GPS_TOLERANCE_M = 20
  const threshold = (pin.reward_radius_m ?? 50) + GPS_TOLERANCE_M
  const dist = haversine(lat, lng, pin.lat, pin.lng)
  if (dist > threshold) {
    return NextResponse.json({ error: 'Troppo lontano dal pin', distanceM: Math.round(dist) }, { status: 422 })
  }

  // ── Enigma pins: verify solution before proceeding ───────────────────────
  if (pin.reward_type === 'enigma') {
    const correctSolution = ((pin.reward_payload as any)?.solution ?? '') as string
    if (!solution || solution.trim().toLowerCase() !== correctSolution.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Soluzione errata, riprova!', wrongSolution: true }, { status: 422 })
    }
  }

  // ── Boss pins bypass pin_claims — rechallengeable until won ──────────────
  // Skip the idempotency insert; boss state is tracked in boss_fights.
  if (pin.reward_type !== 'boss') {
    const { data: existing } = await supabase
      .from('pin_claims')
      .select('id')
      .eq('pin_id', pinId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Hai già riscattato questo pin', alreadyClaimed: true }, { status: 409 })
    }

    const { error: claimErr } = await supabase
      .from('pin_claims')
      .insert({ pin_id: pinId, user_id: user.id, session_id: sessionId })

    if (claimErr) {
      if (claimErr.code === '23505') {
        return NextResponse.json({ error: 'Hai già riscattato questo pin', alreadyClaimed: true }, { status: 409 })
      }
      return NextResponse.json({ error: claimErr.message }, { status: 500 })
    }
  }

  // ── Dispense reward ────────────────────────────────────────────────────────
  const payload = pin.reward_payload as any
  let result: Record<string, unknown> = { type: pin.reward_type, pinName: pin.name }

  switch (pin.reward_type) {
    case 'oggetto': {
      const { data: existing } = await supabase
        .from('player_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .eq('item_id', payload.item_id)
        .maybeSingle()

      if (existing) {
        await supabase.from('player_inventory')
          .update({ quantity: existing.quantity + (payload.quantity ?? 1) })
          .eq('id', existing.id)
      } else {
        await supabase.from('player_inventory').insert({
          user_id: user.id, session_id: sessionId,
          item_id: payload.item_id, quantity: payload.quantity ?? 1,
        })
      }
      const { data: item } = await supabase.from('items').select('name').eq('id', payload.item_id).single()
      result = { ...result, itemName: (item as any)?.name, quantity: payload.quantity ?? 1 }
      break
    }

    case 'indizio': {
      result = {
        ...result,
        chapterOrder: payload.chapter_order,
        text: payload.text,
        imageUrl: payload.image_url,
      }
      break
    }

    case 'uovo': {
      const eggRarity = payload.egg_rarity ?? 'comune'
      const stepsRequired = payload.steps_required ?? 0
      const { data: ps } = await supabase
        .from('player_sessions')
        .select('steps_walked')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
      const stepsAtPickup = (ps as any)?.steps_walked ?? 0
      await supabase.from('player_eggs').insert({
        user_id: user.id, session_id: sessionId,
        egg_rarity: eggRarity, steps_required: stepsRequired, steps_at_pickup: stepsAtPickup,
      })
      result = { ...result, eggRarity, stepsRequired }
      break
    }

    case 'boss': {
      const bossCreatureEntries: Array<{ creature_id: string; level_override?: number }> =
        Array.isArray(payload.creatures) && payload.creatures.length > 0
          ? payload.creatures.slice(0, 3)
          : payload.creature_id
            ? [{ creature_id: payload.creature_id, level_override: payload.level_override }]
            : []

      if (bossCreatureEntries.length === 0) {
        result = { ...result, error: 'Boss non configurato' }; break
      }

      const creatureIds = bossCreatureEntries.map(e => e.creature_id)
      const { data: creaturesData } = await admin
        .from('creatures')
        .select('id, name, element, hp, atk, def, image_url, sprite_url')
        .in('id', creatureIds)

      const crMap: Record<string, any> = Object.fromEntries(
        (creaturesData ?? []).map((c: any) => [c.id, c]),
      )

      const bossLineup = bossCreatureEntries.map((entry, i) => {
        const cr = crMap[entry.creature_id]
        if (!cr) return null
        const scaled = scaleCombatStats(
          { hp: cr.hp, atk: cr.atk, def: cr.def ?? 0 },
          entry.level_override ?? 1,
        )
        return {
          slot: i, creature_id: cr.id, name: cr.name, element: cr.element,
          level: scaled.level, atk: scaled.atk, def: scaled.def,
          max_hp: scaled.hp, current_hp: scaled.hp, fainted: false,
          image_url: cr.image_url ?? '', sprite_url: cr.sprite_url ?? '',
        }
      }).filter(Boolean)

      if (bossLineup.length === 0) {
        result = { ...result, error: 'Creature boss non trovate' }; break
      }

      // Reuse existing in-progress fight; allow rechallenge after loss; return won fight as-is
      const { data: existingFights } = await admin
        .from('boss_fights')
        .select('id, status, reward_claimed')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .eq('pin_id', pinId)
        .in('status', ['selecting', 'active', 'won', 'lost'])
        .order('created_at', { ascending: false })

      const fights = existingFights ?? []
      const inProgress = fights.find(
        (f: any) => f.status === 'selecting' || f.status === 'active',
      ) as any | undefined
      const wonFight   = fights.find((f: any) => f.status === 'won')  as any | undefined

      let bossFightId: string

      if (inProgress) {
        // Continue the ongoing fight (player is still selecting or mid-battle)
        bossFightId = inProgress.id
      } else if (wonFight) {
        // Boss already beaten — just return the existing fight id
        bossFightId = wonFight.id
      } else {
        // Either first attempt or a rechallenge after loss — create a new fight
        const { data: newFight, error: fightErr } = await admin
          .from('boss_fights')
          .insert({
            user_id: user.id, session_id: sessionId,
            pin_id: pinId,
            boss_lineup: bossLineup, player_lineup: [],
            boss_active_slot: 0, player_active_slot: 0,
            status: 'selecting',
            reward: payload.reward ?? { gold: 100, exp: 50 },
          })
          .select('id').single()

        if (fightErr || !newFight) {
          result = { ...result, error: 'Errore creazione boss' }; break
        }
        bossFightId = newFight.id
      }

      result = { ...result, bossFightId, bossName: (bossLineup[0] as any)?.name ?? 'Capo' }
      break
    }

    case 'creatura': {
      const { data: creature } = await supabase
        .from('creatures')
        .select('id, name, rarity, element, image_url, sprite_url, hp, atk, def, description')
        .eq('id', payload.creature_id)
        .single()

      if (!creature) { result = { ...result, error: 'Creatura non trovata' }; break }

      const { data: existingPc } = await admin
        .from('player_creatures')
        .select('id, duplicates_count')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .eq('creature_id', (creature as any).id)
        .maybeSingle()

      if (existingPc) {
        await admin.from('player_creatures')
          .update({ duplicates_count: existingPc.duplicates_count + 1 })
          .eq('id', existingPc.id)
      } else {
        await admin.from('player_creatures').upsert({
          user_id: user.id, creature_id: (creature as any).id,
          session_id: sessionId, duplicates_count: 1,
        }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
      }

      admin.from('player_game_events').insert({
        user_id: user.id, session_id: sessionId,
        type: 'catch',
        payload: {
          creature_name: (creature as any).name, rarity: (creature as any).rarity,
          element: (creature as any).element, evolved: false, via_pin: true,
        },
      }).then(undefined, () => {})

      result = { ...result, creature }
      break
    }

    case 'evento': {
      result = { ...result, eventType: payload.event_type, effect: payload.effect }
      break
    }

    case 'enigma': {
      // Solution already verified above; now grant the nested reward
      const rewardType    = payload.reward_type as string | undefined
      const rewardPayload = (payload.reward_payload ?? {}) as any

      if (rewardType === 'exp' || rewardType === 'gold') {
        const amount = (rewardPayload.amount ?? 0) as number
        await admin.rpc('increment_player_stats', {
          p_user_id: user.id,
          p_session_id: sessionId,
          p_exp:   rewardType === 'exp'  ? amount : 0,
          p_score: rewardType === 'exp'  ? Math.floor(amount / 10) : 0,
          p_gold:  rewardType === 'gold' ? amount : 0,
        })
        result = { ...result, rewardType, amount }
      } else if (rewardType === 'oggetto' && rewardPayload.item_id) {
        const { data: existingOggettoEnigma } = await supabase
          .from('player_inventory')
          .select('id, quantity')
          .eq('user_id', user.id).eq('session_id', sessionId).eq('item_id', rewardPayload.item_id)
          .maybeSingle()
        if (existingOggettoEnigma) {
          await supabase.from('player_inventory')
            .update({ quantity: existingOggettoEnigma.quantity + (rewardPayload.quantity ?? 1) })
            .eq('id', existingOggettoEnigma.id)
        } else {
          await supabase.from('player_inventory').insert({
            user_id: user.id, session_id: sessionId,
            item_id: rewardPayload.item_id, quantity: rewardPayload.quantity ?? 1,
          })
        }
        const { data: enigmaItem } = await supabase.from('items').select('name').eq('id', rewardPayload.item_id).single()
        result = { ...result, rewardType, itemName: (enigmaItem as any)?.name, quantity: rewardPayload.quantity ?? 1 }
      } else if (rewardType === 'creatura' && rewardPayload.creature_id) {
        const { data: enigmaCreature } = await supabase
          .from('creatures').select('id, name, rarity, element, image_url, sprite_url, hp, atk, def, description')
          .eq('id', rewardPayload.creature_id).single()
        if (enigmaCreature) {
          const { data: existingEnigmaPc } = await admin
            .from('player_creatures').select('id, duplicates_count')
            .eq('user_id', user.id).eq('session_id', sessionId).eq('creature_id', (enigmaCreature as any).id).maybeSingle()
          if (existingEnigmaPc) {
            await admin.from('player_creatures')
              .update({ duplicates_count: existingEnigmaPc.duplicates_count + 1 })
              .eq('id', existingEnigmaPc.id)
          } else {
            await admin.from('player_creatures').upsert({
              user_id: user.id, creature_id: (enigmaCreature as any).id, session_id: sessionId, duplicates_count: 1,
            }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
          }
          result = { ...result, rewardType, creature: enigmaCreature }
        }
      }
      break
    }
  }

  // Mission progress for pin claim
  const completedMissions: CompletedMission[] = await incrementMissionProgress({
    type: 'pin',
    userId: user.id,
    sessionId,
  }).catch(() => [] as CompletedMission[])

  return NextResponse.json({ success: true, ...result, completedMissions })
}
