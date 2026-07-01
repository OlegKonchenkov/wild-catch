# Special Abilities (Abilità Speciali) — Design

**Date:** 2026-07-01
**Status:** Approved
**Author:** Oleg + Claude

## Summary

Add learnable **special abilities** to Daimons. Beyond the innate default attack
every Daimon has, a Daimon can **learn up to 4 special abilities** (Pokémon-style
moveset). Abilities are earned as **tokens** from missions, QR codes, gym/boss
fights, map pins, and enigmi. Learning consumes a token. Abilities are usable in
**all** combat modes (wild encounters, boss fights, PvP duels).

Approved decisions:
- **Battle scope:** all modes (encounter + boss + duel) from the start.
- **Moveset:** Pokémon-style, **max 4 known abilities** + the free base attack;
  learning consumes the token; learning a 5th forces forgetting one.
- **Learn gates:** player level **and** Daimon element **and** Daimon rarity
  **and** token possession — all four apply.
- **Status effects:** add new ones (scottatura, congelamento, rigenerazione,
  marchio) alongside the existing 4 (paralisi, confusione, sonno, veleno).

## Core rule

Every Daimon keeps its innate **Attacco base** (today's single default attack)
as a free, always-available move. On top of that it learns up to 4 abilities. In
battle it offers **1 base attack + up to 4 abilities = up to 5 selectable moves**.

When a Daimon has **zero** learned abilities, combat behaves **exactly** as today
(base attack only) — this is the no-regression guarantee.

## Data model (all additive)

Mirrors the existing Equipment pattern (migration 040): a species-level catalogue
+ owned tokens + a per-creature binding table + JSONB battle state.

### `abilities` (catalogue — permanent, like `creatures`/`items`)
Explicit columns (matching the equipment style of explicit bonus columns):

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| description | text | |
| element | text null | null = neutral; CHECK element enum |
| category | text | 'attacco','stato','cura','potenziamento','difesa' |
| rarity | text null | ability's own rarity (drop tables / display) |
| power | numeric default 0 | damage multiplier; 0 = non-damaging |
| accuracy | numeric default 1 | 0..1 |
| target | text default 'enemy' | 'enemy' \| 'self' |
| priority | int default 0 | higher acts first |
| charge_turns | int default 0 | >0 = charge N turns before firing |
| recharge_turns | int default 0 | >0 = forced skip after firing |
| cooldown | int default 0 | turns before reuse |
| max_uses | int null | PP per battle; null = unlimited |
| hits_min | int default 1 | multi-hit lower bound |
| hits_max | int default 1 | multi-hit upper bound |
| status_effect | text null | inflicts on target |
| status_chance | numeric default 0 | 0..1 |
| self_status | text null | applies to self (e.g. rigenerazione, buff) |
| heal_percent | numeric default 0 | heal % of caster max HP |
| lifesteal_percent | numeric default 0 | heal % of damage dealt |
| buff_atk | numeric default 0 | self ATK modifier (e.g. +0.25 = +25%) |
| buff_def | numeric default 0 | self DEF modifier |
| debuff_atk | numeric default 0 | enemy ATK modifier |
| debuff_def | numeric default 0 | enemy DEF modifier |
| min_level | int default 1 | learn gate |
| min_rarity | text null | learn gate (min Daimon rarity) |
| allowed_elements | text[] null | learn gate (null = any element) |
| icon_url | text | |
| animation_key | text | selects a VFX preset |
| sound_url | text null | |
| color | text null | accent color |
| created_at | timestamptz | |

### `player_abilities` (owned tokens — like `player_inventory`)
`id, user_id, session_id, ability_id, quantity, obtained_at`,
`UNIQUE(user_id, session_id, ability_id)`. This is what the backpack lists.

### `creature_abilities` (learned moveset)
`id, user_id, session_id, player_creature_id, ability_id, slot_index, learned_at`,
`CHECK slot_index BETWEEN 0 AND 3`, `UNIQUE(player_creature_id, slot_index)`,
`UNIQUE(player_creature_id, ability_id)`.

### Battle state (JSONB, additive columns)
- `encounters.ability_state jsonb` — player active creature:
  `{ cooldowns: {abilityId:turns}, usesLeft: {abilityId:n}, pending: {abilityId, chargeTurnsLeft}|null, recharge: n }`
- `duel_lineups.ability_state jsonb` — same shape per lineup slot.

JSONB avoids touching hot combat columns and keeps migrations tiny.

### RLS
Mirror `creature_equipment`: own rows (`user_id = auth.uid() OR is_admin()`);
`creature_abilities` gets a duel-participant read policy (same `duel_lineups` join
as migration 040) so each duel client can render the opponent's moveset.
`abilities` catalogue is world-readable (like `creatures`/`items`).

### New reward columns
- `missions.reward_ability_id uuid null REFERENCES abilities(id)`
- QR `type` CHECK adds `'abilita'`; payload `{ abilityId, quantity }`
- enigmi `reward_type` allows `'abilita'`; payload `{ abilityId, quantity }`
- map-pin reward payload supports an ability grant (PinPayloadForms)

## Learning rules

`canLearn(ability, daimon, playerLevel, ownsToken)`:
`playerLevel ≥ ability.min_level` **&&** (`ability.allowed_elements` null OR
`daimon.element ∈ allowed_elements`) **&&** `rarityRank(daimon.rarity) ≥
rarityRank(ability.min_rarity)` **&&** `ownsToken`.

Learn: decrement token qty by 1, insert `creature_abilities` row at the chosen
slot (0–3). Forget: delete the row (no refund — Pokémon-authentic; tunable).

## Combat engine — `src/lib/game/abilities.ts` (pure, unit-tested)

New pure resolver mirroring `combat.ts`. Given the caster/target stats, the chosen
ability, and the current `ability_state`, it returns damage, status changes,
heals, buffs/debuffs, next `ability_state`, and animation events. Reuses existing
`calculateCombatDamage` / element / crit / `resolveTurnStartStatus`.

Handles: `power` multiplier, multi-hit (`hits_min..max`), status infliction,
heal / lifesteal / regen, self-buff & enemy-debuff (timed modifiers), priority,
charge (turn 1 charge → turn 2 fire), recharge (fire → forced skip), cooldown,
PP/max_uses. Wired into `encounter/fight`, `game/boss/[id]`, and `duel/action`.

Player casts abilities in all modes. Wild/boss AI keeps today's base-attack +
passive status (a boss-ability hook is stubbed for later; no behavior change now).

## New status effects

Added to the enum, `STATUS_EFFECT_META`, and tick logic in `combat.ts`:
- **scottatura** (burn): DoT each turn + attacker's ATK reduced while active.
- **congelamento** (freeze): skips turn like sonno; thaw chance each turn / breaks
  when the frozen creature takes a damaging hit.
- **rigenerazione** (regen): positive **self** status; heals a % of max HP/turn.
- **marchio** (mark): target takes +% incoming damage while marked.

Each gets emoji/color/glow so the existing `StatusAura` renders them for free.
DB CHECK constraints on the status columns are widened to include the new values.

## UI

- **Detail sheet** (bestiary DaimonDex): add a 5th tab — **Info / Abilità / Equip
  / Enigma** — rendering a new `AbilityManager` (mirrors `EquipmentManager`): 4
  moveset slots, learn/forget, and the owned-token list split **Apprendibili** vs
  **Bloccate** (with reason chips: "Richiede Lv.20", "Solo Fiamma/Armonia",
  "Rarità Eroico+"). Calls `/api/game/creature/abilities`.
- **Battle**: ActionBar gets a **MOSSE** action opening an `AbilityMenu` (base
  attack + up to 4 abilities, each with power/element/status/cooldown badges).
  Disabled moves show why (cooldown/charging/no PP). Each ability plays a
  **special animation** via `animation_key` → reusable VFX presets (fire slash,
  water wave, charge beam, heal glow, shield, multi-strike) built on the existing
  `AttackAnimation` / `DamageBurst` / `StatusAura` layer.
- **Backpack**: new **"Abilità"** section listing owned tokens (rarity-colored),
  visible alongside items.

## Admin

- New **`/admin/abilities`** page + `/api/admin/abilities` (+`/[id]`, `/[id]/artwork`)
  CRUD, mirroring items/equipaggiamento with artwork upload.
- **Reward assignment** on every surface via a shared `grantAbility(supabase,
  user, session, abilityId, qty)` helper: missions (`reward_ability_id`), QR
  (`abilita` payload), map pins, enigmi (`abilita` reward), boss drops, and admin
  grant/redeem. All funnel tokens into `player_abilities`.

## The ~50 abilities (seed)

A seed migration inserts ~50 abilities across the 5 elements + neutral and these
categories, gated by level/element/rarity so progression feels earned:
pure damage (tiers), damage+status, pure status, heal/lifesteal/regen, self-buff,
enemy-debuff, multi-turn charge, recharge nukes, multi-hit, priority, guard/shield.

Examples: *Ondata Adriatica* (water, multi-hit + slow), *Furia di Magma* (Fiamma
recharge nuke, Lv.30, Eroico+), *Radici Curative* (Bosco self-regen), *Scatto
Fulmineo* (neutral priority, low power), *Marchio dell'Ombra* (applies `marchio`),
*Scudo di Pietra* (Terra guard, DEF↑), *Canto d'Armonia* (Armonia heal + ATK↑).

## Delivery phases (master stays green each step)

1. **Migrations + engine + unit tests** — tables, additive columns, new statuses,
   `abilities.ts` resolver, `db:types` regen.
2. **Admin CRUD** — `/admin/abilities` + API + tests.
3. **Detail-sheet Abilità tab + backpack section** — `AbilityManager`, learn/forget
   API + tests.
4. **Battle integration** — MOSSE menu + `AbilityMenu`, VFX presets, wired into all
   3 combat routes + tests.
5. **Reward hooks + seed** — grant helper across all surfaces, `abilita` payloads,
   ~50-ability seed + tests.

## No-regression strategy

- Only **additive** DB changes (new tables, nullable/defaulted columns, widened
  CHECKs). No existing column or behavior modified.
- A Daimon with no abilities → combat identical to today.
- Every new route gets `__tests__` (matching the repo convention).
- Full `vitest run` + `tsc --noEmit` at the end; existing suites must stay green.

## Testing

- Unit: `abilities.ts` resolver (damage/power, multi-hit, charge/recharge,
  cooldown/PP, heal/lifesteal/regen, buff/debuff, priority, gate checks), new
  status tick logic.
- Route: admin abilities CRUD, learn/forget, ability action in encounter/boss/duel,
  each reward-grant surface.
- Regression: run the whole existing suite + typecheck.
