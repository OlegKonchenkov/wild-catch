import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/game/map-pins?sessionId=...
// Returns map pins for the given session (visible to all authenticated players)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId mancante' }, { status: 400 })

  const { data, error } = await supabase
    .from('session_map_pins')
    .select('id, lat, lng, name, description, image_url, reward_type, reward_radius_m, reward_payload, enigma_id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark which pins this user has already claimed
  const pinIds    = (data ?? []).map((p: any) => p.id)
  const bossPinIds = (data ?? []).filter((p: any) => p.reward_type === 'boss').map((p: any) => p.id)

  let claimedSet = new Set<string>()
  if (pinIds.length > 0) {
    // Regular pins — use pin_claims
    const regularPinIds = pinIds.filter((id: string) => !bossPinIds.includes(id))
    if (regularPinIds.length > 0) {
      const { data: claims } = await supabase
        .from('pin_claims')
        .select('pin_id')
        .eq('user_id', user.id)
        .in('pin_id', regularPinIds)
      for (const c of claims ?? []) claimedSet.add((c as any).pin_id)
    }

    // Boss pins — claimed only when the boss fight is won
    if (bossPinIds.length > 0) {
      const { data: wonFights } = await supabase
        .from('boss_fights')
        .select('pin_id')
        .eq('user_id', user.id)
        .eq('status', 'won')
        .in('pin_id', bossPinIds)
      for (const f of wonFights ?? []) claimedSet.add((f as any).pin_id)
    }
  }

  const pins = await Promise.all((data ?? []).map(async (p: any) => {
    // For enigma pins: load from enigmi table if enigma_id is set (new format)
    // Fall back to inline payload (old format) for backward compat
    let enigmaPublic: Record<string, unknown> | null = null

    if (p.reward_type === 'enigma') {
      if (p.enigma_id) {
        // New format: load from enigmi table
        const { data: enigmaData } = await supabase
          .from('enigmi')
          .select('title, description, frammenti:enigma_frammenti(id, title, description, image_url, video_url, order_index), suggerimenti:enigma_suggerimenti(id, text, image_url, order_index)')
          .eq('id', p.enigma_id)
          .single()

        if (enigmaData) {
          const frammenti = ((enigmaData.frammenti as any[]) ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
          const suggerimenti = ((enigmaData.suggerimenti as any[]) ?? []).sort((a: any, b: any) => a.order_index - b.order_index)

          // Check which frammento IDs the player has via their creatures
          const frammentoIds = frammenti.map((f: any) => f.id).filter(Boolean)
          let playerFrammentoIds = new Set<string>()
          if (frammentoIds.length > 0) {
            const { data: pc } = await supabase
              .from('player_creatures')
              .select('creature_id')
              .eq('user_id', user.id)
              .eq('session_id', sessionId)
            const playerCreatureIds = (pc ?? []).map((r: any) => r.creature_id)
            if (playerCreatureIds.length > 0) {
              const { data: creaturesWithFrammenti } = await supabase
                .from('creatures')
                .select('enigma_frammento_id')
                .in('id', playerCreatureIds)
                .in('enigma_frammento_id', frammentoIds)
              for (const c of creaturesWithFrammenti ?? []) {
                if ((c as any).enigma_frammento_id) playerFrammentoIds.add((c as any).enigma_frammento_id)
              }
            }
          }

          // Check which suggerimenti the player has via player_enigma_suggerimenti (migration 026)
          const suggerimentoIds = suggerimenti.map((s: any) => s.id).filter(Boolean)
          let playerSuggerimentoIds = new Set<string>()
          if (suggerimentoIds.length > 0) {
            const { data: collected } = await supabase
              .from('player_enigma_suggerimenti')
              .select('suggerimento_id')
              .eq('user_id', user.id)
              .eq('session_id', sessionId)
              .in('suggerimento_id', suggerimentoIds)
            for (const row of collected ?? []) {
              playerSuggerimentoIds.add((row as any).suggerimento_id)
            }
          }

          enigmaPublic = {
            enigma_id: p.enigma_id,
            title: enigmaData.title,
            description: enigmaData.description,
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
        // Old format: use inline payload
        enigmaPublic = {
          question:  p.reward_payload?.question  ?? null,
          image_url: p.reward_payload?.image_url ?? null,
        }
      }
    }

    // Strip reward_payload from the response (contains secrets); replace with safe enigma data
    const { reward_payload: _rp, enigma_id: _eid, ...rest } = p
    return {
      ...rest,
      claimed: claimedSet.has(p.id),
      ...(enigmaPublic ? { reward_payload: enigmaPublic } : {}),
    }
  }))

  return NextResponse.json({ pins })
}
