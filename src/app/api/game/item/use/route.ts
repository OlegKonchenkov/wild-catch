import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSessionError } from '@/lib/logSessionError'

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
    const notStarted = sessionCheck?.status === 'ready' || sessionCheck?.status === 'draft'
    const errMsg = notStarted ? 'La sessione non è ancora iniziata' : 'La sessione è terminata'
    logSessionError({
      sessionId, userId: user.id, source: 'item',
      errorCode: notStarted ? 'session_not_started' : 'session_ended',
      message: `Tentativo uso oggetto: ${errMsg}`,
      context: { inventoryId, sessionStatus: sessionCheck?.status ?? 'missing' },
    })
    return NextResponse.json({ error: errMsg }, { status: 403 })
  }

  // Get inventory item
  const { data: invItem } = await supabase
    .from('player_inventory')
    .select('id, quantity, items(id, name, type, effect_value, description)')
    .eq('id', inventoryId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  const inv = invItem as { id: string; quantity: number; items: { id: string; name: string; type: string; effect_value: number; description: string } } | null

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
    // Derive egg rarity from item name keywords
    const nameLower = (inv.items.name ?? '').toLowerCase()
    const eggRarity =
      nameLower.includes('mitologico') ? 'mitologico' :
      nameLower.includes('leggendario') ? 'leggendario' :
      nameLower.includes('epico') ? 'epico' :
      nameLower.includes('raro') ? 'raro' :
      nameLower.includes('non_comune') || nameLower.includes('non comune') ? 'non_comune' :
      'comune'

    // steps_required: effect_value → parse from description → 500 fallback
    let stepsRequired = Number(inv.items.effect_value) > 0 ? Number(inv.items.effect_value) : 0
    if (stepsRequired === 0) {
      const match = (inv.items.description ?? '').match(/(\d+)\s*pass/i)
      if (match) stepsRequired = parseInt(match[1], 10)
    }
    if (stepsRequired === 0) stepsRequired = 500

    // Current steps for this player in this session
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

    return NextResponse.json({
      used: true,
      type: 'uovo',
      incubating: true,
      eggRarity,
      stepsRequired,
      message: `Uovo in incubazione! Cammina per ${stepsRequired} passi per schiuderlo.`,
    })
  }

  return NextResponse.json({ used: true })
}
