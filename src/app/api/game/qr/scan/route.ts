import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { incrementMissionProgress } from '@/lib/game/missions'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { qrId, sessionId } = body

  if (!qrId || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get QR code
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('id', qrId)
    .eq('session_id', sessionId)
    .single()

  if (!qr) return NextResponse.json({ error: 'QR code non valido' }, { status: 404 })

  // Check uses remaining
  if (qr.uses_remaining !== null && qr.uses_remaining <= 0) {
    return NextResponse.json({ error: 'QR code esaurito' }, { status: 410 })
  }

  // Decrement uses
  if (qr.uses_remaining !== null) {
    await supabase
      .from('qr_codes')
      .update({ uses_remaining: qr.uses_remaining - 1 })
      .eq('id', qrId)
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
          user_id: user.id, session_id: sessionId,
          item_id: payload.item_id, quantity: payload.quantity,
        })
      }

      const { data: item } = await supabase.from('items').select('name').eq('id', payload.item_id).single()
      result = { ...result, itemName: (item as any)?.name, quantity: payload.quantity }
      break
    }

    case 'indizio': {
      // Unlock mission chapter
      result = {
        ...result,
        chapterOrder: payload.chapter_order,
        text: payload.text,
        imageUrl: payload.image_url,
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
        .select('id, name, element, hp, atk, image_url, sprite_url')
        .in('id', creatureIds)

      const crMap: Record<string, any> = Object.fromEntries(
        (creaturesData ?? []).map((c: any) => [c.id, c])
      )

      const bossLineup = bossCreatureEntries.map((entry, i) => {
        const cr = crMap[entry.creature_id]
        if (!cr) return null
        const lvl = entry.level_override ?? 1
        const scaledHp  = Math.round(cr.hp  * lvl)
        const scaledAtk = Math.round(cr.atk * lvl)
        return {
          slot: i,
          creature_id: cr.id,
          name: cr.name,
          element: cr.element,
          atk: scaledAtk,
          max_hp: scaledHp,
          current_hp: scaledHp,
          fainted: false,
          image_url: cr.image_url ?? '',
          sprite_url: cr.sprite_url ?? '',
        }
      }).filter(Boolean)

      if (bossLineup.length === 0) {
        result = { ...result, error: 'Creature boss non trovate' }
        break
      }

      // Check if this player already has an active boss fight for this QR
      const { data: existingFight } = await admin
        .from('boss_fights')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('qr_code_id', qrId)
        .in('status', ['selecting', 'active'])
        .maybeSingle()

      let bossFightId: string
      if (existingFight) {
        bossFightId = existingFight.id
      } else {
        const { data: newFight, error: fightErr } = await admin
          .from('boss_fights')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            qr_code_id: qrId,
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

    case 'evento': {
      result = { ...result, eventType: payload.event_type, effect: payload.effect }
      break
    }
  }

  // Track qr missions (match on qr label or any qr scan)
  incrementMissionProgress({
    type: 'qr',
    target: qr.label ?? '',
    userId: user.id,
    sessionId,
  }).catch(() => {})

  // Track collect missions when an item QR is scanned
  if (qr.type === 'oggetto' && (result as any).itemName) {
    incrementMissionProgress({
      type: 'collect',
      target: (result as any).itemName,
      userId: user.id,
      sessionId,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, ...result })
}
