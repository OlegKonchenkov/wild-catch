import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCombatDamage, scaleCombatStats } from '@/lib/game/combat'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

// ── GET: load boss fight state ─────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: fight } = await supabase
    .from('boss_fights')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!fight) return NextResponse.json({ error: 'Boss fight non trovato' }, { status: 404 })
  return NextResponse.json({ fight })
}

// ── POST: player action ────────────────────────────────────────────────────
// action: 'start' (submit lineup) | 'attack' | 'surrender'
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { action, lineup, itemId } = body

  const { data: fight } = await supabase
    .from('boss_fights')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!fight) return NextResponse.json({ error: 'Boss fight non trovato' }, { status: 404 })

  // ── Start: submit player lineup ──────────────────────────────────────────
  if (action === 'start') {
    if (fight.status !== 'selecting') {
      return NextResponse.json({ error: 'Battaglia già iniziata' }, { status: 409 })
    }
    if (!Array.isArray(lineup) || lineup.length !== 3) {
      return NextResponse.json({ error: 'Seleziona esattamente 3 creature' }, { status: 400 })
    }

    const { data: playerSession } = await supabase
      .from('player_sessions')
      .select('level')
      .eq('user_id', user.id)
      .eq('session_id', fight.session_id)
      .maybeSingle()
    const playerLevel = playerSession?.level ?? 1

    // Validate ownership & fetch creature data
    const pcIds = lineup.map((e: any) => e.playerCreatureId)
    const { data: pcs } = await supabase
      .from('player_creatures')
      .select('id, creatures(name, element, rarity, hp, atk, def, image_url)')
      .in('id', pcIds)
      .eq('user_id', user.id)

    if (!pcs || pcs.length !== 3) {
      return NextResponse.json({ error: 'Creature non valide' }, { status: 400 })
    }

    const pcMap: Record<string, any> = Object.fromEntries(
      pcs.map((pc: any) => [pc.id, pc])
    )

    const playerLineup = lineup.map((e: any, i: number) => {
      const pc = pcMap[e.playerCreatureId]
      const cr = pc?.creatures
      const scaledStats = scaleCombatStats(
        { hp: cr?.hp ?? 100, atk: cr?.atk ?? 10, def: cr?.def ?? 0 },
        playerLevel,
      )
      return {
        slot: i,
        player_creature_id: e.playerCreatureId,
        name: cr?.name ?? 'Creatura',
        element: cr?.element ?? 'armonia',
        rarity: cr?.rarity ?? 'comune',
        level: playerLevel,
        atk: scaledStats.atk,
        def: scaledStats.def,
        max_hp: scaledStats.hp,
        current_hp: scaledStats.hp,
        fainted: false,
        is_active: i === 0,
        image_url: cr?.image_url ?? '',
      }
    })

    await supabase
      .from('boss_fights')
      .update({ status: 'active', player_lineup: playerLineup, player_active_slot: 0 })
      .eq('id', id)

    return NextResponse.json({ started: true, playerLineup, bossLineup: fight.boss_lineup })
  }

  // ── Surrender ────────────────────────────────────────────────────────────
  if (action === 'surrender') {
    if (!['selecting', 'active'].includes(fight.status)) {
      return NextResponse.json({ error: 'Battaglia già terminata' }, { status: 409 })
    }
    await supabase
      .from('boss_fights')
      .update({ status: 'lost', ended_at: new Date().toISOString() })
      .eq('id', id)
    const adminSurr = createAdminClient()
    adminSurr.from('player_game_events').insert({
      user_id: user.id, session_id: fight.session_id, type: 'boss_lost',
      payload: { fight_id: id },
    }).then(undefined, () => {})
    return NextResponse.json({ surrendered: true })
  }

  // ── Attack ───────────────────────────────────────────────────────────────
  if (action === 'attack') {
    if (fight.status !== 'active') {
      return NextResponse.json({ error: 'Battaglia non attiva' }, { status: 409 })
    }

    const playerLineup: any[] = fight.player_lineup
    const bossLineup:   any[] = fight.boss_lineup

    const playerActive = playerLineup.find((c: any) => c.is_active && !c.fainted)
    const bossActive   = bossLineup[fight.boss_active_slot]

    if (!playerActive) return NextResponse.json({ error: 'Nessuna creatura attiva' }, { status: 400 })
    if (!bossActive || bossActive.fainted) return NextResponse.json({ error: 'Boss già sconfitto' }, { status: 400 })

    // ── Optional battaglia item ──────────────────────────────────────────
    let atkMultiplier = 1
    if (itemId) {
      const { data: invItem } = await supabase
        .from('player_inventory')
        .select('quantity, items(effect_value, type)')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single()
      const inv = invItem as { quantity: number; items: { effect_value: number; type: string } } | null
      if (inv && inv.quantity > 0 && inv.items?.type === 'battaglia') {
        atkMultiplier = 1 + (inv.items.effect_value ?? 0) / 100
        await supabase.from('player_inventory').update({ quantity: inv.quantity - 1 }).eq('id', itemId)
      }
    }

    // ── Player → Boss ────────────────────────────────────────────────────
    const playerMult   = getElementMultiplier(playerActive.element as Element, bossActive.element as Element)
    const playerDamage = calculateCombatDamage({
      attackerAtk: playerActive.atk,
      defenderDef: bossActive.def ?? 0,
      attackMultiplier: atkMultiplier,
      elementMultiplier: playerMult,
    })
    const newBossHp    = Math.max(0, bossActive.current_hp - playerDamage)
    bossActive.current_hp = newBossHp
    if (newBossHp === 0) bossActive.fainted = true

    // ── Auto-advance boss slot if fainted ────────────────────────────────
    let newBossActiveSlot = fight.boss_active_slot
    let bossSwitchedTo: string | null = null
    if (newBossHp === 0) {
      const nextBossIdx = bossLineup.findIndex((c: any, i: number) => i > fight.boss_active_slot && !c.fainted)
      if (nextBossIdx !== -1) {
        newBossActiveSlot = nextBossIdx
        bossSwitchedTo = bossLineup[nextBossIdx].name
      }
    }

    const allBossFainted = bossLineup.every((c: any) => c.fainted)

    // ── Boss → Player (only if boss still alive at start of counter-attack) ─
    // The boss that was alive before player's attack counter-attacks
    let bossDamage = 0
    let newPlayerHp = playerActive.current_hp

    if (!allBossFainted && newBossHp > 0) {
      const counterBoss = bossActive
      if (counterBoss && !counterBoss.fainted) {
        const bossMult = getElementMultiplier(counterBoss.element as Element, playerActive.element as Element)
        bossDamage = calculateCombatDamage({
          attackerAtk: counterBoss.atk,
          defenderDef: playerActive.def ?? 0,
          elementMultiplier: bossMult,
        })
        newPlayerHp = Math.max(0, playerActive.current_hp - bossDamage)
        playerActive.current_hp = newPlayerHp
        if (newPlayerHp === 0) playerActive.fainted = true
      }
    }

    // ── Auto-advance player slot if fainted ─────────────────────────────
    let newPlayerActiveSlot = fight.player_active_slot
    let playerSwitchedTo: string | null = null
    if (newPlayerHp === 0) {
      playerActive.is_active = false
      const nextPlayerIdx = playerLineup.findIndex((c: any) => !c.fainted)
      if (nextPlayerIdx !== -1) {
        playerLineup[nextPlayerIdx].is_active = true
        newPlayerActiveSlot = nextPlayerIdx
        playerSwitchedTo = playerLineup[nextPlayerIdx].name
      }
    }

    const allPlayerFainted = playerLineup.every((c: any) => c.fainted)

    // ── Determine outcome ────────────────────────────────────────────────
    let newStatus = fight.status
    let won = false

    if (allBossFainted) {
      newStatus = 'won'
      won = true
    } else if (allPlayerFainted) {
      newStatus = 'lost'
    }

    await supabase.from('boss_fights').update({
      boss_lineup:         bossLineup,
      player_lineup:       playerLineup,
      boss_active_slot:    newBossActiveSlot,
      player_active_slot:  newPlayerActiveSlot,
      status:              newStatus,
      ...(newStatus !== 'active' ? { ended_at: new Date().toISOString() } : {}),
    }).eq('id', id)

    // ── Game event on loss ───────────────────────────────────────────────
    if (allPlayerFainted) {
      createAdminClient().from('player_game_events').insert({
        user_id: user.id, session_id: fight.session_id, type: 'boss_lost',
        payload: { fight_id: id },
      }).then(undefined, () => {})
    }

    // ── Grant reward on win ──────────────────────────────────────────────
    let levelUp: { newLevel: number; goldReward: number } | null = null
    let rewardGranted = false
    if (won) {
      const { data: claimedRows } = await supabase
        .from('boss_fights')
        .update({ reward_claimed: true })
        .eq('id', id)
        .or('reward_claimed.is.null,reward_claimed.eq.false')
        .select('id')
      rewardGranted = (claimedRows?.length ?? 0) > 0
    }

    if (rewardGranted) {
      const reward = fight.reward as { gold?: number; exp?: number; item_id?: string; item_qty?: number } | null
      const admin = createAdminClient()

      // EXP + level-up check
      const { data: rpcData } = await admin.rpc('increment_player_stats', {
        p_user_id: user.id,
        p_session_id: fight.session_id,
        p_exp: reward?.exp ?? 50,
        p_score: 20,
      })
      const rpcRow = Array.isArray(rpcData) ? rpcData[0] : null
      if (rpcRow?.leveled_up) {
        levelUp = { newLevel: rpcRow.new_level, goldReward: rpcRow.gold_reward ?? 0 }
      }

      // Gold reward
      const goldReward = (reward?.gold ?? 0) + (levelUp?.goldReward ?? 0)
      if (goldReward > 0) {
        const { data: ps } = await admin.from('player_sessions')
          .select('gold').eq('user_id', user.id).eq('session_id', fight.session_id).single()
        if (ps) {
          await admin.from('player_sessions')
            .update({ gold: (ps.gold ?? 0) + goldReward })
            .eq('user_id', user.id).eq('session_id', fight.session_id)
        }
      }

      // Game event
      admin.from('player_game_events').insert({
        user_id: user.id, session_id: fight.session_id, type: 'boss_won',
        payload: { fight_id: id, gold: goldReward, exp: reward?.exp ?? 50 },
      }).then(undefined, () => {})

      // Item reward
      if (reward?.item_id) {
        const qty = reward.item_qty ?? 1
        const { data: existingInv } = await admin.from('player_inventory').select('id, quantity')
          .eq('user_id', user.id).eq('session_id', fight.session_id).eq('item_id', reward.item_id).maybeSingle()
        if (existingInv) {
          await admin.from('player_inventory').update({ quantity: existingInv.quantity + qty }).eq('id', existingInv.id)
        } else {
          await admin.from('player_inventory').insert({
            user_id: user.id, session_id: fight.session_id, item_id: reward.item_id, quantity: qty,
          })
        }
      }
    }

    return NextResponse.json({
      playerDamage,
      bossDamage,
      playerElementMult: playerMult,
      newBossHp,
      newPlayerHp,
      bossLineup,
      playerLineup,
      bossSwitchedTo,
      playerSwitchedTo,
      status: newStatus,
      won,
      lost: newStatus === 'lost',
      levelUp,
      reward: rewardGranted ? fight.reward : null,
    })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
