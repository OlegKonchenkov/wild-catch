import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { inventoryId, sessionId } = body

  if (!inventoryId || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Guard: session must still be active
  const { data: sessionCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (!sessionCheck || sessionCheck.status !== 'active') {
    return NextResponse.json({ error: 'La sessione è terminata' }, { status: 403 })
  }

  // Get inventory item
  const { data: invItem } = await supabase
    .from('player_inventory')
    .select('id, quantity, items(id, name, type, effect_value)')
    .eq('id', inventoryId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  const inv = invItem as { id: string; quantity: number; items: { id: string; name: string; type: string; effect_value: number } } | null

  if (!inv || inv.quantity <= 0) {
    return NextResponse.json({ error: 'Oggetto non disponibile' }, { status: 404 })
  }

  const itemType = inv.items?.type
  if (!itemType || !['esca', 'uovo'].includes(itemType)) {
    return NextResponse.json({ error: 'Questo oggetto non può essere usato dallo zaino' }, { status: 400 })
  }

  // Decrement quantity
  await supabase
    .from('player_inventory')
    .update({ quantity: inv.quantity - 1 })
    .eq('id', inventoryId)

  if (itemType === 'esca') {
    const activatedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await supabase
      .from('player_sessions')
      .update({ esca_active_until: activatedUntil })
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
    return NextResponse.json({
      used: true,
      type: 'esca',
      activatedUntil,
      message: `Esca attivata! Creature più frequenti per 10 minuti.`,
    })
  }

  if (itemType === 'uovo') {
    // Pick a random common/non-common creature in this session's available pool
    const { data: creatures } = await supabase
      .from('creatures')
      .select('id, name, rarity, element')
      .in('rarity', ['comune', 'non_comune'])
      .limit(50)

    if (!creatures || creatures.length === 0) {
      return NextResponse.json({ used: true, type: 'uovo', message: 'Nessuna creatura disponibile per la schiusa.' })
    }

    const picked = creatures[Math.floor(Math.random() * creatures.length)]

    // Check for existing
    const { data: existing } = await supabase
      .from('player_creatures')
      .select('id, duplicates_count, evolved')
      .eq('user_id', user.id)
      .eq('creature_id', picked.id)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('player_creatures')
        .update({ duplicates_count: existing.duplicates_count + 1 })
        .eq('id', existing.id)
    } else {
      await supabase.from('player_creatures').insert({
        user_id: user.id,
        creature_id: picked.id,
        session_id: sessionId,
        duplicates_count: 1,
      })
    }

    return NextResponse.json({
      used: true,
      type: 'uovo',
      creature: { id: picked.id, name: picked.name, rarity: picked.rarity, element: picked.element },
      message: `🐣 Schiuso! È uscita: ${picked.name}!`,
    })
  }

  return NextResponse.json({ used: true })
}
