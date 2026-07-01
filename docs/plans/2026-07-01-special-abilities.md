# Special Abilities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let Daimons learn up to 4 special abilities (Pokémon-style moveset on top of the free base attack), earned as tokens from missions/QR/boss/pins/enigmi, learned in the DaimonDex detail sheet, and cast in all combat modes with special animations — plus full admin CRUD.

**Architecture:** Additive-only DB mirroring the Equipment pattern: `abilities` catalogue → `player_abilities` tokens → `creature_abilities` moveset, with JSONB `ability_state` for per-battle cooldown/charge/PP. A pure `src/lib/game/abilities.ts` resolver wired into `encounter/fight`, `boss/[id]`, `duel/action`. New status effects added to `combat.ts`.

**Tech Stack:** Next.js 16 App Router, Supabase (CLI migrations, RLS), React 19 + framer-motion, Vitest.

**No-regression rule:** A Daimon with zero abilities behaves exactly as today. Only new tables + nullable/defaulted columns + widened CHECKs. Full `vitest run` + `tsc --noEmit` at the end.

---

## Phase 0 — Types & shared constants (no DB yet)

### Task 0.1: Ability domain types + rarity ordering
**Files:** Create `src/lib/game/abilities-types.ts`; Modify `src/lib/types.ts`.
- Add `StatusEffect` new members handled in Phase 1. Here add: `AbilityCategory`, `AbilityTarget`, `Ability` interface (all catalogue columns), `PlayerAbility`, `CreatureAbility`, `AbilityBattleState` (`{cooldowns, usesLeft, pending, recharge}`).
- Add `RARITY_RANK: Record<Rarity, number>` (comune=0 … mitologico=5) to `src/lib/types.ts` and export.
- Commit: `feat(abilities): domain types + rarity ranking`

---

## Phase 1 — Migration 049 + new status effects + engine (TDD core)

### Task 1.1: Migration 049 — schema
**Files:** Create `supabase/migrations/049_special_abilities.sql`.
- `CREATE TABLE abilities (...)` — all columns from the design doc; CHECKs for `element`, `category`, `target`, `rarity`, `min_rarity`.
- `CREATE TABLE player_abilities (...)` `UNIQUE(user_id, session_id, ability_id)`, index on `(user_id, session_id)`.
- `CREATE TABLE creature_abilities (...)` `slot_index CHECK 0..3`, `UNIQUE(player_creature_id, slot_index)`, `UNIQUE(player_creature_id, ability_id)`, index on `player_creature_id`.
- `ALTER TABLE encounters ADD COLUMN ability_state jsonb`; `ALTER TABLE duel_lineups ADD COLUMN ability_state jsonb`.
- Widen status CHECKs (encounters.wild_status/player_status, duel_lineups.active_status, creatures.status_effect) to add `scottatura, congelamento, rigenerazione, marchio` — drop+recreate constraint via `DO $$` guard (mirror migration 040 style).
- Add `missions.reward_ability_id uuid REFERENCES abilities(id)`.
- Widen `qr_codes.type` CHECK to include `'abilita'`.
- RLS: enable on all 3 tables; `abilities` world-readable to `authenticated`; `player_abilities`/`creature_abilities` own-or-admin; `creature_abilities` duel-participant SELECT (copy migration 040's `ce_duel_read` join).
- Apply: `npx supabase db push` (or `migration up`). Verify with `npx supabase migration list --linked`.
- Commit: `feat(abilities): migration 049 — tables, ability_state, new status enums`

### Task 1.2: Regenerate DB types
**Files:** Modify `src/types/database.ts`.
- Run `npm run db:types`. Confirm `abilities`, `player_abilities`, `creature_abilities` appear. Commit: `chore(abilities): regen database types`

### Task 1.3 (TDD): New status effects in combat.ts
**Files:** Modify `src/lib/game/combat.ts`; `src/lib/game/__tests__/combat.test.ts`.
- Extend `StatusEffect` union + `STATUS_EFFECT_META` with the 4 new effects (emoji/color/glow/turns/preventsAttack). `congelamento.preventsAttack=true`; `rigenerazione` is a self/positive effect.
- Extend `resolveTurnStartStatus`: `scottatura` → DoT (like veleno but with turns + attacker ATK debuff flag in event); `congelamento` → skip like sonno + thaw roll; `rigenerazione` → heals `+8%` max HP/turn; `marchio` → no tick, damage multiplier applied by caller.
- Add helper `getStatusDamageTakenMultiplier(effect)` → 1.25 for `marchio`, else 1; `getAttackerStatusMultiplier(effect)` → 0.8 for `scottatura`, else 1.
- **Tests first** for each new effect's tick, then implement. Run `npx vitest run src/lib/game/__tests__/combat.test.ts`.
- Commit: `feat(abilities): scottatura/congelamento/rigenerazione/marchio status effects`

### Task 1.4 (TDD): Pure ability resolver
**Files:** Create `src/lib/game/abilities.ts`; `src/lib/game/__tests__/abilities.test.ts`.
- `rarityRank(r)`, `canLearnAbility({ability, element, rarity, playerLevel, ownsToken})` → `{ok, reason}`.
- `resolveAbilityCast({ability, casterAtk, casterDef, casterMaxHp, casterHp, targetDef, targetElement, casterElement, state, randomFns})` returns `{ hits, totalDamage, healed, lifestealHeal, statusToTarget, selfStatus, buffs, debuffs, nextState (cooldown/charge/recharge/usesLeft), pending, blocked, animationKey }`.
- Handle: `power` multiplier over `calculateCombatDamage`, `hits_min..max` multi-hit, `charge_turns` (first cast sets `pending`, second fires), `recharge_turns` (sets `recharge` after firing), `cooldown`, `max_uses`, `accuracy` miss, `heal_percent`, `lifesteal_percent`, `buff_*`/`debuff_*`, `priority`, `target: self`.
- `isAbilityUsable(ability, state)` → `{usable, reason}` (cooldown/charging/no PP).
- **Tests first** (one behavior per test, ~20 tests), then implement minimally. Run the file.
- Commit: `feat(abilities): pure cast resolver + learn gate + tests`

---

## Phase 2 — Admin CRUD

### Task 2.1 (TDD): Admin abilities API
**Files:** Create `src/app/api/admin/abilities/route.ts` (GET/POST/PUT/DELETE), `.../abilities/[id]/artwork/route.ts`; test `.../abilities/__tests__/route.test.ts`.
- Mirror `admin/items/route.ts` (`requireAdmin`, `createAdminClient`, validation of enums/numeric clamps). Artwork upload mirrors `items/[id]/artwork`.
- Tests mirror items test (401/403/400/200 for each verb). Run.
- Commit: `feat(abilities): admin CRUD API + tests`

### Task 2.2: Admin abilities page
**Files:** Create `src/app/admin/abilities/page.tsx`; Modify `src/components/admin/AdminShell.tsx` (nav link).
- Form with every catalogue field grouped (Identità, Effetto, Multi-turno/PP, Requisiti, Presentazione), list with edit/delete, `ImageInput` for icon. Use `/frontend-design` skill for polish.
- Commit: `feat(abilities): admin management page`

---

## Phase 3 — Learn/forget API + detail-sheet tab + backpack

### Task 3.1 (TDD): Creature abilities API
**Files:** Create `src/app/api/game/creature/abilities/route.ts` (GET list moveset+learnable, POST learn, DELETE forget); test dir.
- GET: return `{ moveset: creature_abilities+ability, tokens: player_abilities+ability, learnable: gate-checked }`.
- POST `{sessionId, playerCreatureId, abilityId, slotIndex}`: verify ownership + `canLearnAbility` + slot free + not already known + token qty>0 → insert row, decrement token. Reject 400 with reason otherwise.
- DELETE `{playerCreatureId, slotIndex}`: delete row (no refund).
- Tests: learn success, gate fail (level/element/rarity), no token, slot occupied, dup ability, forget. Run.
- Commit: `feat(abilities): learn/forget API + tests`

### Task 3.2: AbilityManager component + Abilità tab
**Files:** Create `src/components/game/AbilityManager.tsx`; Modify `src/app/game/bestiary/page.tsx` (add `'abilita'` to `detailTab` union + tab button + render).
- Mirror `EquipmentManager`: 4 moveset slots (learn/forget), owned tokens split Apprendibili/Bloccate with reason chips. Move-stat rows (power/element/status/cooldown). `/frontend-design`.
- Commit: `feat(abilities): DaimonDex Abilità tab`

### Task 3.3: Backpack abilities section
**Files:** Modify `src/app/game/backpack/page.tsx`.
- Fetch `player_abilities(+abilities)`; render an "Abilità" section (rarity-colored cards) above/below items; realtime subscribe to `player_abilities`.
- Commit: `feat(abilities): show ability tokens in backpack`

---

## Phase 4 — Battle integration (all 3 modes)

### Task 4.1: AbilityMenu component + MOSSE action
**Files:** Create `src/components/battle/AbilityMenu.tsx`; Modify `src/components/battle/ActionBar.tsx` consumers (encounter/boss/duel pages) to add a MOSSE action opening the menu (base attack + up to 4 abilities, disabled reasons shown).
- Commit: `feat(abilities): battle move menu`

### Task 4.2 (TDD): Wire resolver into encounter/fight
**Files:** Modify `src/app/api/game/encounter/fight/route.ts`; test.
- Accept optional `abilityId`. Load creature's `creature_abilities`; if `abilityId` present, validate known+usable, call `resolveAbilityCast`, apply damage/status/heal/buff, persist `ability_state`, decrement cooldowns each turn. `abilityId` absent → unchanged base-attack path.
- Tests: base attack path unchanged (regression), ability damage, cooldown set/blocked, charge two-turn, heal. Run.
- Commit: `feat(abilities): cast abilities in wild encounters + tests`

### Task 4.3 (TDD): Wire into boss route
**Files:** Modify `src/app/api/game/boss/[id]/route.ts`; test.
- Same pattern; boss AI unchanged. Commit: `feat(abilities): cast abilities in boss fights + tests`

### Task 4.4 (TDD): Wire into duel/action
**Files:** Modify `src/app/api/game/duel/action/route.ts`; test.
- Add `action==='ability'` with `abilityId`; store `ability_state` per lineup slot; apply priority ordering; opponent client reads moveset via RLS duel-read policy. Commit: `feat(abilities): cast abilities in PvP duels + tests`

### Task 4.5: Ability VFX presets
**Files:** Create `src/components/battle/AbilityFx.tsx`; Modify `BattleScene.tsx`/`ImmersiveBattleLayout.tsx` to trigger preset by `animation_key`.
- Presets: `fire_slash, water_wave, leaf_storm, rock_guard, harmony_heal, charge_beam, multi_strike, shadow_mark`. `/frontend-design`.
- Commit: `feat(abilities): special-ability battle animations`

---

## Phase 5 — Reward hooks + seed

### Task 5.1 (TDD): grantAbility helper + surfaces
**Files:** Create `src/lib/game/grant-ability.ts`; Modify QR scan (`api/game/qr/scan`), missions completion, enigmi solve, map-pin claim, admin grant/redeem, `PinPayloadForms.tsx`, admin missions/qrcodes forms.
- `grantAbility(supabase, userId, sessionId, abilityId, qty)` upserts `player_abilities`. Hook into each surface's reward branch (`abilita` type / `reward_ability_id`). Tests per surface. 
- Commit: `feat(abilities): grant tokens via missions/QR/pins/enigmi/boss/admin`

### Task 5.2: Seed ~50 abilities
**Files:** Create `supabase/migrations/050_abilities_seed.sql`.
- ~50 `INSERT INTO abilities` across elements/categories/gates (see design doc roster). Apply + verify count. Commit: `feat(abilities): seed ~50 abilities`

---

## Phase 6 — Verify no regressions

### Task 6.1: Full suite + typecheck
- Run `npm run test:run` (all vitest) and `npm run typecheck`. Fix any breakage. Confirm green.
- Commit any fixes: `test(abilities): full-suite green + typecheck`
