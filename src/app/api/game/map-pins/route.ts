import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'

// GET /api/game/map-pins?sessionId=...
// Returns map pins for the given session (visible to all authenticated players).
//
// All enigma lookups are batched into a fixed handful of bulk queries (instead of
// the previous per-pin Promise.all that fired 4 sequential queries per enigma
// pin). The response shape is unchanged — purely a perf refactor so the route
// stays flat regardless of how many enigma pins a session has.
export async function GET(request: Request) {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  // 1) All pins for this session.
  const { data: pinsRaw, error } = await supabase
    .from('session_map_pins')
    .select('id, lat, lng, name, description, image_url, reward_type, reward_radius_m, reward_payload, enigma_id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const pins = pinsRaw ?? []
  if (pins.length === 0) return NextResponse.json({ pins: [] })

  // Partition pin ids by reward kind so we can fan the lookups out in parallel.
  const allPinIds: string[] = pins.map((p: any) => p.id)
  const bossPinIds: string[] = pins.filter((p: any) => p.reward_type === 'boss').map((p: any) => p.id)
  const bossPinSet = new Set<string>(bossPinIds)
  const regularPinIds: string[] = allPinIds.filter(id => !bossPinSet.has(id))
  const enigmaIds: string[] = [...new Set(
    pins
      .filter((p: any) => p.reward_type === 'enigma' && p.enigma_id)
      .map((p: any) => p.enigma_id as string)
  )]

  // 2) Batch 1: claims, won boss fights, enigma definitions, player's creatures.
  //    All independent — one round-trip fans them out in parallel.
  const [claimsRes, wonFightsRes, enigmiRes, playerCreaturesRes] = await Promise.all([
    regularPinIds.length > 0
      ? supabase.from('pin_claims').select('pin_id').eq('user_id', user.id).in('pin_id', regularPinIds)
      : Promise.resolve({ data: [] as Array<{ pin_id: string }>, error: null }),
    bossPinIds.length > 0
      ? supabase.from('boss_fights').select('pin_id').eq('user_id', user.id).eq('status', 'won').in('pin_id', bossPinIds)
      : Promise.resolve({ data: [] as Array<{ pin_id: string }>, error: null }),
    enigmaIds.length > 0
      ? supabase.from('enigmi')
          .select('id, title, description, frammenti:enigma_frammenti(id, title, description, image_url, video_url, order_index), suggerimenti:enigma_suggerimenti(id, text, image_url, order_index)')
          .in('id', enigmaIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    enigmaIds.length > 0
      ? supabase.from('player_creatures').select('creature_id').eq('user_id', user.id).eq('session_id', sessionId)
      : Promise.resolve({ data: [] as Array<{ creature_id: string }>, error: null }),
  ])

  const claimedSet = new Set<string>()
  for (const c of (claimsRes.data ?? []) as Array<{ pin_id: string }>) claimedSet.add(c.pin_id)
  for (const f of (wonFightsRes.data ?? []) as Array<{ pin_id: string }>) claimedSet.add(f.pin_id)

  // Index enigmi by id, and collect every frammento / suggerimento id we need
  // to resolve "player_has" for, across ALL enigma pins in one go.
  const enigmasById = new Map<string, any>()
  const allFrammentoIds = new Set<string>()
  const allSuggerimentoIds = new Set<string>()
  for (const e of (enigmiRes.data ?? []) as any[]) {
    enigmasById.set(e.id, e)
    for (const f of (e.frammenti ?? [])) if (f?.id) allFrammentoIds.add(f.id)
    for (const s of (e.suggerimenti ?? [])) if (s?.id) allSuggerimentoIds.add(s.id)
  }
  const playerCreatureIds = ((playerCreaturesRes.data ?? []) as Array<{ creature_id: string }>).map(r => r.creature_id)

  // 3) Batch 2: which frammenti does the player own (via their creatures), and
  //    which suggerimenti has the player already unlocked. Independent → parallel.
  const [creaturesRes, suggCollectedRes] = await Promise.all([
    playerCreatureIds.length > 0 && allFrammentoIds.size > 0
      ? supabase.from('creatures')
          .select('enigma_frammento_id')
          .in('id', playerCreatureIds)
          .in('enigma_frammento_id', [...allFrammentoIds])
      : Promise.resolve({ data: [] as Array<{ enigma_frammento_id: string | null }>, error: null }),
    allSuggerimentoIds.size > 0
      ? supabase.from('player_enigma_suggerimenti')
          .select('suggerimento_id')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .in('suggerimento_id', [...allSuggerimentoIds])
      : Promise.resolve({ data: [] as Array<{ suggerimento_id: string }>, error: null }),
  ])

  const playerFrammentoIds = new Set<string>()
  for (const c of (creaturesRes.data ?? []) as Array<{ enigma_frammento_id: string | null }>) {
    if (c.enigma_frammento_id) playerFrammentoIds.add(c.enigma_frammento_id)
  }
  const playerSuggerimentoIds = new Set<string>()
  for (const r of (suggCollectedRes.data ?? []) as Array<{ suggerimento_id: string }>) {
    playerSuggerimentoIds.add(r.suggerimento_id)
  }

  // 4) Assemble the response in memory — no more DB I/O per pin.
  const result = pins.map((p: any) => {
    let enigmaPublic: Record<string, unknown> | null = null

    if (p.reward_type === 'enigma') {
      if (p.enigma_id) {
        const e = enigmasById.get(p.enigma_id)
        if (e) {
          const frammenti = ((e.frammenti as any[]) ?? []).slice().sort((a: any, b: any) => a.order_index - b.order_index)
          const suggerimenti = ((e.suggerimenti as any[]) ?? []).slice().sort((a: any, b: any) => a.order_index - b.order_index)
          enigmaPublic = {
            enigma_id: p.enigma_id,
            title: e.title,
            description: e.description,
            frammenti: frammenti.map((f: any) => {
              const has = playerFrammentoIds.has(f.id)
              return {
                id: f.id,
                order_index: f.order_index,
                player_has: has,
                title:       has ? f.title       : null,
                description: has ? f.description : null,
                image_url:   has ? f.image_url   : null,
                video_url:   has ? f.video_url   : null,
              }
            }),
            suggerimenti: suggerimenti.map((s: any) => ({
              id: s.id,
              text: playerSuggerimentoIds.has(s.id) ? s.text : null,
              image_url: playerSuggerimentoIds.has(s.id) ? s.image_url : null,
              order_index: s.order_index,
              player_has: playerSuggerimentoIds.has(s.id),
            })),
          }
        }
      } else {
        // Old format: inline reward_payload (kept for backward compat).
        enigmaPublic = {
          question:  p.reward_payload?.question  ?? null,
          image_url: p.reward_payload?.image_url ?? null,
        }
      }
    }

    // Strip reward_payload from the response (contains admin secrets); replace
    // with safe enigma data above where applicable.
    const { reward_payload: _rp, enigma_id: _eid, ...rest } = p
    return {
      ...rest,
      claimed: claimedSet.has(p.id),
      ...(enigmaPublic ? { reward_payload: enigmaPublic } : {}),
    }
  })

  return NextResponse.json({ pins: result })
}
