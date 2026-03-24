import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      // Give egg item to player — resolved later via distance/encounters
      result = { ...result, eggRarity: payload.egg_rarity }
      break
    }

    case 'boss': {
      // Trigger boss encounter
      result = {
        ...result,
        creatureId: payload.creature_id,
        levelOverride: payload.level_override,
      }
      break
    }

    case 'evento': {
      result = { ...result, eventType: payload.event_type, effect: payload.effect }
      break
    }
  }

  return NextResponse.json({ success: true, ...result })
}
