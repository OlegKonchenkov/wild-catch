import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidGPSSpeed, isWithinBounds, haversineDistance } from '@/lib/game/anti-cheat'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { lat, lng, accuracy, sessionId } = body

  if (typeof lat !== 'number' || typeof lng !== 'number' || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get player session and session details in parallel
  const [{ data: playerSession }, { data: session }] = await Promise.all([
    supabase
      .from('player_sessions')
      .select('id, last_position, joined_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .single(),
    supabase
      .from('sessions')
      .select('status, area_bounds, end_at')
      .eq('id', sessionId)
      .single(),
  ])

  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (!session)       return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Check session expiry on every GPS poll
  if (session.status === 'ended') {
    return NextResponse.json({ sessionEnded: true })
  }
  if (session.status === 'active' && session.end_at && new Date() >= new Date(session.end_at)) {
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', sessionId)
    return NextResponse.json({ sessionEnded: true })
  }

  const currentPos = { lat, lng }

  // PostGIS POINT serializes as { x: lng, y: lat }
  const rawPos = playerSession.last_position as { x: number; y: number } | null
  const prevPos = rawPos ? { lat: rawPos.y, lng: rawPos.x } : null
  const now = Date.now()
  const elapsed = prevPos ? now - new Date(playerSession.joined_at).getTime() : 0

  // Anti-cheat: reject teleport-level jumps (> 60 km/h over elapsed time)
  if (!isValidGPSSpeed(prevPos, currentPos, elapsed)) {
    return NextResponse.json({ error: 'Spostamento non valido', valid: false }, { status: 400 })
  }

  // Check within bounds — expand by GPS accuracy so jitter near the border
  // doesn't falsely flag the player as out-of-bounds.
  const accuracyDeg = Math.max((accuracy ?? 50) / 111000, 0.0002) // min ~22 m
  const bounds = session.area_bounds as { north: number; south: number; east: number; west: number } | null
  const inBounds = bounds && typeof bounds.north === 'number'
    ? isWithinBounds(currentPos, {
        north: bounds.north + accuracyDeg,
        south: bounds.south - accuracyDeg,
        east:  bounds.east  + accuracyDeg,
        west:  bounds.west  - accuracyDeg,
      })
    : true

  // Persist GPS position (PostGIS point format)
  await supabase
    .from('player_sessions')
    .update({ last_position: `(${lng},${lat})` })
    .eq('id', playerSession.id)

  // Encounter trigger: only when in bounds, session active, moved enough, good accuracy
  let triggerEncounter = false
  if (inBounds && session.status === 'active') {
    const distanceMoved = prevPos ? haversineDistance(prevPos, currentPos) : 0
    const goodAccuracy = (accuracy ?? 200) < 150

    if (goodAccuracy && distanceMoved >= 10) {
      triggerEncounter = Math.random() < 0.25  // 25% per ≥10 m step
    }
  }

  return NextResponse.json({ valid: true, inBounds, triggerEncounter, sessionStatus: session.status })
}
