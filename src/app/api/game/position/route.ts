import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidGPSSpeed, isWithinBounds, haversineDistance } from '@/lib/game/anti-cheat'

// Rate limiting: track last request time per user in memory
// For production scale, use Redis; for MVP this works within a single serverless instance
const lastRequestTime = new Map<string, number>()
const RATE_LIMIT_MS = 5000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Rate limit: 1 req per 5s per user
  const now = Date.now()
  const lastTime = lastRequestTime.get(user.id) ?? 0
  if (now - lastTime < RATE_LIMIT_MS) {
    return NextResponse.json({ error: 'Troppo veloce' }, { status: 429 })
  }
  lastRequestTime.set(user.id, now)

  const body = await request.json().catch(() => ({}))
  const { lat, lng, accuracy, sessionId } = body

  if (!lat || !lng || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get player session
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('id, last_position, joined_at')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Get session details
  const { data: session } = await supabase
    .from('sessions')
    .select('status, area_bounds, end_at')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Check session expiry (first-layer: on every GPS poll)
  if (session.status === 'ended') {
    return NextResponse.json({ sessionEnded: true })
  }
  if (session.status === 'active' && session.end_at && new Date() >= new Date(session.end_at)) {
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', sessionId)
    return NextResponse.json({ sessionEnded: true })
  }

  const currentPos = { lat, lng }
  // PostGIS POINT serializes as { x: lng, y: lat } — note axis order
  const rawPos = playerSession.last_position as { x: number; y: number } | null
  const prevPos = rawPos ? { lat: rawPos.y, lng: rawPos.x } : null
  const elapsed = prevPos ? now - new Date(playerSession.joined_at).getTime() : 0

  // Anti-cheat: validate speed
  if (!isValidGPSSpeed(prevPos, currentPos, elapsed)) {
    return NextResponse.json({ error: 'Spostamento non valido', valid: false }, { status: 400 })
  }

  // Check within bounds
  const bounds = session.area_bounds as { north: number; south: number; east: number; west: number } | null
  const inBounds = bounds && bounds.north ? isWithinBounds(currentPos, bounds) : true

  // Update GPS position (PostGIS point format)
  await supabase
    .from('player_sessions')
    .update({ last_position: `(${lng},${lat})` })
    .eq('id', playerSession.id)

  // Determine if encounter should trigger
  let triggerEncounter = false
  if (inBounds && session.status === 'active') {
    const distanceMoved = prevPos ? haversineDistance(prevPos, currentPos) : 0
    const highAccuracy = (accuracy ?? 100) < 50

    if (highAccuracy && distanceMoved >= 20) {
      // 15% chance per 20m of movement
      triggerEncounter = Math.random() < 0.15
    }
    // GPS fallback: timer-based trigger handled client-side (60-180s random)
  }

  return NextResponse.json({
    valid: true,
    inBounds,
    triggerEncounter,
    sessionStatus: session.status,
  })
}
