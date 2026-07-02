import type { SupabaseClient } from '@supabase/supabase-js'
import { grantAbility } from '@/lib/game/grant-ability'

/**
 * Every kind of reward the game can grant. The first block existed before the
 * loot system (packs/chests); the second block is added by that system. Keeping
 * them in one dispatcher means a new reward type works across every channel
 * (map pins, enigmi, missions, QR, admin grant) as soon as it is handled here.
 */
export type RewardType =
  | 'gold' | 'exp' | 'gemme'
  | 'oggetto' | 'uovo' | 'creatura' | 'abilita' | 'indizio' | 'evento'
  | 'bustina' | 'forziere' | 'premio'
  | 'personaggio' | 'opera' | 'aneddoto' | 'missione'

export interface DispenseInput {
  userId: string
  sessionId: string
  type: RewardType
  payload: Record<string, any>
}

export interface DispenseResult {
  type: RewardType
  ok: boolean
  /** Human/UI-facing details of what was granted (item name, amount, creature, …). */
  detail: Record<string, any>
}

/**
 * Grant a single reward to a player within a session. Pure dispatch: callers
 * remain responsible for their own pre-checks (proximity, solution, key gating,
 * idempotency). `client` may be an RLS-scoped or admin client depending on the
 * caller's needs.
 */
export async function dispenseReward(
  client: SupabaseClient,
  input: DispenseInput,
): Promise<DispenseResult> {
  const { userId, sessionId, type, payload } = input
  const detailBase = {}

  switch (type) {
    // ── Currencies / XP (atomic via RPC) ────────────────────────────────────
    case 'gold':
    case 'exp':
    case 'gemme': {
      const amount = Number(payload.amount) || 0
      const { data, error } = await client.rpc('increment_player_stats', {
        p_user_id: userId,
        p_session_id: sessionId,
        p_exp: type === 'exp' ? amount : 0,
        p_score: type === 'exp' ? Math.floor(amount / 10) : 0,
        p_gold: type === 'gold' ? amount : 0,
        p_gemme: type === 'gemme' ? amount : 0,
      })
      if (error) return { type, ok: false, detail: { error: error.message } }
      const row = Array.isArray(data) ? data[0] : null
      return {
        type,
        ok: true,
        detail: {
          amount,
          levelUp: row?.leveled_up ? { newLevel: row.new_level } : null,
        },
      }
    }

    // ── Inventory item (equipment is just an item with a slot + rarity) ──────
    case 'oggetto': {
      const itemId = payload.item_id ?? payload.itemId
      const quantity = Number(payload.quantity) || 1
      if (!itemId) return { type, ok: false, detail: { error: 'item_id mancante' } }
      await stackInventory(client, userId, sessionId, itemId, quantity)
      const { data: item } = await client.from('items').select('name').eq('id', itemId).single()
      return { type, ok: true, detail: { ...detailBase, itemId, quantity, itemName: (item as any)?.name ?? null } }
    }

    // ── Special ability token ────────────────────────────────────────────────
    case 'abilita': {
      const abilityId = payload.abilityId ?? payload.ability_id
      const quantity = Number(payload.quantity) || 1
      if (!abilityId) return { type, ok: false, detail: { error: 'abilityId mancante' } }
      await grantAbility(client, userId, sessionId, abilityId, quantity)
      const { data: ab } = await client.from('abilities').select('name').eq('id', abilityId).single()
      return { type, ok: true, detail: { abilityId, quantity, abilityName: (ab as any)?.name ?? null } }
    }

    // ── Creature (adds to collection, increments duplicate count) ─────────────
    case 'creatura': {
      const creatureId = payload.creature_id ?? payload.creatureId
      if (!creatureId) return { type, ok: false, detail: { error: 'creature_id mancante' } }
      const { data: existing } = await client
        .from('player_creatures')
        .select('id, duplicates_count')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .eq('creature_id', creatureId)
        .maybeSingle()
      if (existing) {
        await client.from('player_creatures')
          .update({ duplicates_count: (existing as any).duplicates_count + 1 })
          .eq('id', (existing as any).id)
      } else {
        await client.from('player_creatures').upsert(
          { user_id: userId, session_id: sessionId, creature_id: creatureId, duplicates_count: 1 },
          { onConflict: 'user_id,session_id,creature_id', ignoreDuplicates: true },
        )
      }
      const { data: creature } = await client
        .from('creatures')
        .select('id, name, rarity, element, image_url, sprite_url')
        .eq('id', creatureId).single()
      return { type, ok: true, detail: { creature: creature ?? { id: creatureId } } }
    }

    // ── Egg (hatches into a creature after walking N steps) ───────────────────
    case 'uovo': {
      const eggRarity = payload.egg_rarity ?? payload.eggRarity ?? 'comune'
      const stepsRequired = Number(payload.steps_required ?? payload.stepsRequired) || 0
      const { data: ps } = await client
        .from('player_sessions').select('steps_walked')
        .eq('user_id', userId).eq('session_id', sessionId).single()
      const stepsAtPickup = (ps as any)?.steps_walked ?? 0
      await client.from('player_eggs').insert({
        user_id: userId, session_id: sessionId,
        egg_rarity: eggRarity, steps_required: stepsRequired, steps_at_pickup: stepsAtPickup,
      })
      return { type, ok: true, detail: { eggRarity, stepsRequired } }
    }

    // ── Story/enigma hint (linked to enigmi system or inline) ─────────────────
    case 'indizio': {
      const suggerimentoId = payload.suggerimento_id ?? payload.suggerimentoId
      if (suggerimentoId) {
        await client.from('player_enigma_suggerimenti').upsert(
          { user_id: userId, session_id: sessionId, suggerimento_id: suggerimentoId },
          { onConflict: 'user_id,session_id,suggerimento_id', ignoreDuplicates: true },
        )
        return { type, ok: true, detail: { suggerimentoId } }
      }
      return { type, ok: true, detail: { text: payload.text, imageUrl: payload.image_url, chapterOrder: payload.chapter_order } }
    }

    // ── Passthrough event (client-side effect described by payload) ───────────
    case 'evento': {
      return { type, ok: true, detail: { eventType: payload.event_type, effect: payload.effect } }
    }

    // ── Bustina (card pack) — adds an unopened pack to the player's stash ─────
    case 'bustina': {
      const packId = payload.pack_id ?? payload.packId
      const quantity = Number(payload.quantity) || 1
      if (!packId) return { type, ok: false, detail: { error: 'pack_id mancante' } }
      const { data: existing } = await client
        .from('player_packs')
        .select('id, quantity')
        .eq('user_id', userId).eq('session_id', sessionId).eq('pack_id', packId)
        .maybeSingle()
      if (existing) {
        await client.from('player_packs')
          .update({ quantity: (existing as any).quantity + quantity })
          .eq('id', (existing as any).id)
      } else {
        await client.from('player_packs').insert({
          user_id: userId, session_id: sessionId, pack_id: packId, quantity,
        })
      }
      const { data: pack } = await client.from('packs').select('name').eq('id', packId).single()
      return { type, ok: true, detail: { packId, quantity, packName: (pack as any)?.name ?? null } }
    }

    // ── Loot / collection types — implemented in their respective phases ──────
    case 'forziere':
    case 'premio':
    case 'personaggio':
    case 'opera':
    case 'aneddoto':
    case 'missione':
      return { type, ok: false, detail: { error: `tipo '${type}' non ancora implementato` } }

    default:
      return { type: type as RewardType, ok: false, detail: { error: 'tipo sconosciuto' } }
  }
}

/** Upsert-style stack of an item into player_inventory (insert or add quantity). */
async function stackInventory(
  client: SupabaseClient, userId: string, sessionId: string, itemId: string, quantity: number,
): Promise<void> {
  const { data: existing } = await client
    .from('player_inventory')
    .select('id, quantity')
    .eq('user_id', userId).eq('session_id', sessionId).eq('item_id', itemId)
    .maybeSingle()
  if (existing) {
    await client.from('player_inventory')
      .update({ quantity: (existing as any).quantity + quantity })
      .eq('id', (existing as any).id)
  } else {
    await client.from('player_inventory').insert({
      user_id: userId, session_id: sessionId, item_id: itemId, quantity,
    })
  }
}
