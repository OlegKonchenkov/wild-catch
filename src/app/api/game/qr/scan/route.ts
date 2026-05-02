import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { incrementMissionProgress } from '@/lib/game/missions'
import type { CompletedMission } from '@/lib/game/missions'
import { scaleCombatStats } from '@/lib/game/combat'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { qrId, sessionId } = body

  if (!qrId || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    const notStarted = sessionCheck?.status === 'draft' || sessionCheck?.status === 'ready'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  // Get QR code - match by UUID or short manual_code (case-insensitive)
  // Also matches global QRs (null session_id)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrId)
  let qrQuery = supabase.from('qr_codes').select('*').or(`session_id.eq.${sessionId},session_id.is.null`)
  if (isUuid) {
    qrQuery = qrQuery.eq('id', qrId)
  } else {
    qrQuery = qrQuery.ilike('manual_code', qrId.trim().toUpperCase())
  }
  const { data: qr } = await qrQuery.single()

  if (!qr) return NextResponse.json({ error: 'QR code non valido' }, { status: 404 })

  // Check uses remaining
  if (qr.uses_remaining !== null && qr.uses_remaining <= 0) {
    return NextResponse.json({ error: 'QR code esaurito' }, { status: 410 })
  }

  // Track whether this is the first unique scan for this user.
  // Generic QR missions advance only on the first unique QR scan.
  // For global QRs (session_id IS NULL) dedup is per-session so they can be
  // scanned again in a fresh session (migration 027).
  let scanCheckQuery = supabase
    .from('qr_scan_log')
    .select('id')
    .eq('qr_id', qr.id)
    .eq('user_id', user.id)
  if (!qr.session_id) {
    scanCheckQuery = scanCheckQuery.eq('session_id', sessionId)
  }
  const { data: existingScan } = await scanCheckQuery.maybeSingle()

  if (qr.unique_per_user && existingScan) {
    return NextResponse.json({ error: 'Hai già riscattato questo QR', alreadyScanned: true }, { status: 409 })
  }

  const isFirstUniqueScan = !existingScan
  if (isFirstUniqueScan) {
    await supabase.from('qr_scan_log').insert({ qr_id: qr.id, user_id: user.id, session_id: sessionId })
  }

  // Decrement uses
  if (qr.uses_remaining !== null) {
    await supabase
      .from('qr_codes')
      .update({ uses_remaining: qr.uses_remaining - 1 })
      .eq('id', qr.id)
  }

  const payload = qr.payload as any
  let result: Record<string, unknown> = { type: qr.type }

  switch (qr.type) {
    case 'oggetto': {
      // Add item to player inventory
      const { data: existing } = await supabase
        .from('player_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .eq('item_id', payload.item_id)
        .single()

      if (existing) {
        await supabase.from('player_inventory')
          .update({ quantity: existing.quantity + payload.quantity })
          .eq('id', existing.id)
      } else {
        await supabase.from('player_inventory').insert({
          user_id: user.id,
          session_id: sessionId,
          item_id: payload.item_id,
          quantity: payload.quantity,
        })
      }

      const { data: item } = await supabase.from('items').select('name').eq('id', payload.item_id).single()
      result = { ...result, itemName: (item as any)?.name, quantity: payload.quantity }
      break
    }

    case 'indizio': {
      if (qr.enigma_suggerimento_id) {
        // Nuovo formato: suggerimento collegato al sistema enigmi via FK
        const { data: sugg } = await supabase
          .from('enigma_suggerimenti')
          .select('id, text, image_url, enigma_id, enigma:enigmi(id, title)')
          .eq('id', qr.enigma_suggerimento_id)
          .single()

        if (sugg) {
          // Salva nella libreria personale del giocatore (idempotente)
          await supabase.from('player_enigma_suggerimenti').upsert(
            { user_id: user.id, session_id: sessionId, suggerimento_id: sugg.id },
            { onConflict: 'user_id,session_id,suggerimento_id', ignoreDuplicates: true },
          )
          result = {
            ...result,
            suggerimentoId: sugg.id,
            text: sugg.text,
            imageUrl: sugg.image_url,
            enigmaId: sugg.enigma_id,
            enigmaTitle: (sugg.enigma as any)?.title ?? null,
          }
        }
      } else {
        // Vecchio formato inline (retrocompatibilità)
        result = {
          ...result,
          chapterOrder: payload.chapter_order,
          text: payload.text,
          imageUrl: payload.image_url,
        }
      }
      break
    }

    case 'uovo': {
      // Create a player_egg record that hatches after steps_required steps
      const eggRarity = payload.egg_rarity ?? 'comune'
      const stepsRequired = payload.steps_required ?? 0

      // Read current steps_walked for this player in this session
      const { data: ps } = await supabase
        .from('player_sessions')
        .select('steps_walked')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
      const stepsAtPickup = (ps as any)?.steps_walked ?? 0

      await supabase.from('player_eggs').insert({
        user_id: user.id,
        session_id: sessionId,
        egg_rarity: eggRarity,
        steps_required: stepsRequired,
        steps_at_pickup: stepsAtPickup,
      })

      result = { ...result, eggRarity, stepsRequired }
      break
    }

    case 'boss': {
      // Build boss lineup from payload
      // Supports: { creatures: [{creature_id, level_override}] } (3-creature boss)
      // or legacy: { creature_id, level_override } (single-creature boss)
      const admin = createAdminClient()
      const bossCreatureEntries: Array<{ creature_id: string; level_override?: number }> =
        Array.isArray(payload.creatures) && payload.creatures.length > 0
          ? payload.creatures.slice(0, 3)
          : payload.creature_id
            ? [{ creature_id: payload.creature_id, level_override: payload.level_override }]
            : []

      if (bossCreatureEntries.length === 0) {
        result = { ...result, error: 'Boss non configurato' }
        break
      }

      // Fetch creature data for each boss slot
      const creatureIds = bossCreatureEntries.map(e => e.creature_id)
      const { data: creaturesData } = await admin
        .from('creatures')
        .select('id, name, element, hp, atk, def, image_url, sprite_url, status_effect, status_effect_chance')
        .in('id', creatureIds)

      const crMap: Record<string, any> = Object.fromEntries(
        (creaturesData ?? []).map((c: any) => [c.id, c]),
      )

      const bossLineup = bossCreatureEntries.map((entry, i) => {
        const cr = crMap[entry.creature_id]
        if (!cr) return null
        const scaledStats = scaleCombatStats(
          { hp: cr.hp, atk: cr.atk, def: cr.def ?? 0 },
          entry.level_override ?? 1,
        )
        return {
          slot: i,
          creature_id: cr.id,
          name: cr.name,
          element: cr.element,
          level: scaledStats.level,
          atk: scaledStats.atk,
          def: scaledStats.def,
          max_hp: scaledStats.hp,
          current_hp: scaledStats.hp,
          fainted: false,
          image_url: cr.image_url ?? '',
          sprite_url: cr.sprite_url ?? '',
          status_effect: cr.status_effect ?? null,
          status_effect_chance: cr.status_effect_chance ?? 0.15,
          active_status: null,
          status_turns_left: 0,
        }
      }).filter(Boolean)

      if (bossLineup.length === 0) {
        result = { ...result, error: 'Creature boss non trovate' }
        break
      }

      // Check if this player already has boss fights for this QR.
      // Prefer an in-progress fight, otherwise reuse a won fight to avoid duplicate rewards.
      const { data: existingFights } = await admin
        .from('boss_fights')
        .select('id, status, created_at')
        .eq('user_id', user.id)
        .eq('qr_code_id', qr.id)
        .in('status', ['selecting', 'active', 'won'])
        .order('created_at', { ascending: false })

      let bossFightId: string
      const reusableFight = (existingFights ?? []).find((fight: { id: string; status: string }) =>
        fight.status === 'selecting' || fight.status === 'active',
      ) ?? (existingFights ?? []).find((fight: { id: string; status: string }) => fight.status === 'won')

      if (reusableFight) {
        bossFightId = reusableFight.id
      } else {
        const { data: newFight, error: fightErr } = await admin
          .from('boss_fights')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            qr_code_id: qr.id,
            boss_lineup: bossLineup,
            player_lineup: [],
            boss_active_slot: 0,
            player_active_slot: 0,
            status: 'selecting',
            reward: payload.reward ?? { gold: 100, exp: 50 },
          })
          .select('id')
          .single()

        if (fightErr || !newFight) {
          result = { ...result, error: 'Errore creazione boss fight' }
          break
        }
        bossFightId = newFight.id
      }

      result = {
        ...result,
        bossFightId,
        bossName: bossLineup[0]?.name ?? 'Capo Palestra',
      }
      break
    }

    case 'creatura': {
      const { data: creature } = await supabase
        .from('creatures')
        .select('id, name, rarity, element, image_url, sprite_url, hp, atk, def, description')
        .eq('id', payload.creature_id)
        .single()

      if (!creature) {
        result = { ...result, error: 'Creatura non trovata' }
        break
      }

      const admin = createAdminClient()
      const { data: existing } = await admin
        .from('player_creatures')
        .select('id, duplicates_count')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .eq('creature_id', creature.id)
        .maybeSingle()

      if (existing) {
        await admin.from('player_creatures')
          .update({ duplicates_count: existing.duplicates_count + 1 })
          .eq('id', existing.id)
      } else {
        await admin.from('player_creatures').upsert({
          user_id: user.id,
          creature_id: creature.id,
          session_id: sessionId,
          duplicates_count: 1,
        }, { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true })
      }

      admin.from('player_game_events').insert({
        user_id: user.id,
        session_id: sessionId,
        type: 'catch',
        payload: {
          creature_name: (creature as any).name, rarity: (creature as any).rarity,
          element: (creature as any).element, evolved: false, via_qr: true,
          image_url: (creature as any).image_url ?? (creature as any).sprite_url ?? null,
          hp: (creature as any).hp ?? null, atk: (creature as any).atk ?? null, def: (creature as any).def ?? null,
        },
      }).then(undefined, () => {})

      result = { ...result, creature }
      break
    }

    case 'evento': {
      result = { ...result, eventType: payload.event_type, effect: payload.effect }
      break
    }
  }

  // Game event for QR scan — creatura already emits 'catch'; boss is tracked by the fight itself
  if (isFirstUniqueScan && ['oggetto', 'uovo', 'indizio'].includes(qr.type)) {
    const evtAdmin = createAdminClient()
    const evtPayload: Record<string, unknown> = {
      qr_label:  qr.label ?? null,
      qr_type:   qr.type,
    }
    if ((result as any).itemName)     evtPayload.item_name   = (result as any).itemName
    if ((result as any).eggRarity)    evtPayload.egg_rarity  = (result as any).eggRarity
    if ((result as any).stepsRequired != null) evtPayload.steps_required = (result as any).stepsRequired
    // Normalise to a display name for the panel
    evtPayload.item_name ??= qr.type === 'uovo'    ? `Uovo ${(result as any).eggRarity ?? ''}`
                           : qr.type === 'indizio' ? 'Indizio sbloccato'
                           : (result as any).itemName ?? 'QR riscattato'
    evtAdmin.from('player_game_events').insert({
      user_id: user.id, session_id: sessionId, type: 'qr_redeemed', payload: evtPayload,
    }).then(undefined, () => {})
  }

  // Track qr + collect missions (awaited so we can return completedMissions)
  const missionPromises: Promise<CompletedMission[]>[] = []

  if (isFirstUniqueScan) {
    missionPromises.push(incrementMissionProgress({
      type: 'qr',
      target: [qr.id, qr.manual_code ?? '', qr.label ?? ''],
      userId: user.id,
      sessionId,
    }))
  }

  if (qr.type === 'oggetto' && (result as any).itemName) {
    missionPromises.push(incrementMissionProgress({
      type: 'collect',
      target: (result as any).itemName,
      userId: user.id,
      sessionId,
    }))
  }

  const missionResults = await Promise.all(missionPromises).catch(() => [] as CompletedMission[][])
  const completedMissions = missionResults.flat()

  return NextResponse.json({ success: true, ...result, completedMissions })
}
