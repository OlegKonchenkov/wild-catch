# Bustine, Forzieri & Collezioni Culturali — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a loot/collection layer — rarity-weighted card packs (bustine), key-gated chests (forzieri), a gemme currency, voucher prizes, and a cultural collection system — all assignable through every existing reward channel via one shared reward dispenser.

**Architecture:** Extract the duplicated reward-granting logic from 5 channels into a single `dispenseReward()`; add new reward types there so they propagate everywhere. New player state is per-session (mirrors `player_inventory`). Chests are deterministic + key-gated; packs are weighted-random. Full cultural collection with trophies. Bulk AI art via `gpt-image-2`.

**Tech Stack:** Next.js 16 App Router (route handlers), Supabase (Postgres + RLS + storage), TypeScript, Vitest, framer-motion, react-icons/gi.

Spec: `docs/superpowers/specs/2026-07-01-bustine-forzieri-collezioni-design.md`

Conventions to follow (observed in repo):
- Route handlers: `requireAdmin` helper for admin routes; `getAuthUser()` for game routes; `createAdminClient()` to bypass RLS for cross-user reads.
- Migrations: numbered `NNN_name.sql`, additive, idempotent (`IF NOT EXISTS`, `DO $$` for CHECK swaps).
- Tests: colocated `__tests__/route.test.ts`, vitest, mock supabase client.
- Italian UI copy. Rarity palette/labels in `src/lib/types.ts`.

Run tests with `npm run test:run -- <path>`. Typecheck with `npm run typecheck`.

---

## Phase 1 — Reward dispenser + Gemme

### Task 1.1: Gemme migration + RPC

**Files:**
- Create: `supabase/migrations/052_gemme_currency.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration 052 — Gemme (premium currency), per-session like gold.
ALTER TABLE player_sessions ADD COLUMN IF NOT EXISTS gemme INT NOT NULL DEFAULT 0;

-- Extend increment_player_stats with p_gemme (keep prior signature working by adding a defaulted param).
-- Inspect current definition in 015_increment_stats_gold.sql and re-CREATE OR REPLACE with p_gemme INT DEFAULT 0
-- adding `gemme = gemme + p_gemme` to the UPDATE and returning it.
```

- [ ] **Step 2:** Open `supabase/migrations/015_increment_stats_gold.sql`, copy the full `CREATE OR REPLACE FUNCTION increment_player_stats` body into 052, add `p_gemme INT DEFAULT 0` as the last arg, add `gemme = player_sessions.gemme + p_gemme` to the UPDATE `SET`, and add `gemme` to the `RETURNS TABLE`/`RETURNING`.

- [ ] **Step 3: Apply** via `mcp__supabase__apply_migration` (name `gemme_currency`) OR `supabase db push`. Verify column exists: `mcp__supabase__execute_sql` `select column_name from information_schema.columns where table_name='player_sessions' and column_name='gemme'`.

- [ ] **Step 4: Regen types** `npm run db:types` (updates `src/types/database.ts`).

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(gemme): per-session gemme currency + RPC"`

### Task 1.2: Dispenser module (types + gold/exp/gemme/oggetto)

**Files:**
- Create: `src/lib/game/rewards/dispense.ts`
- Test: `src/lib/game/rewards/__tests__/dispense.test.ts`

- [ ] **Step 1: Write failing test** for the simplest types:

```ts
import { describe, it, expect, vi } from 'vitest'
import { dispenseReward } from '../dispense'

function fakeClient() {
  const calls: any[] = []
  const client: any = {
    rpc: vi.fn(async (fn, args) => { calls.push({ fn, args }); return { data: [{ new_level: 2, leveled_up: false }], error: null } }),
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    })),
    __calls: calls,
  }
  return client
}

describe('dispenseReward', () => {
  it('grants gemme via increment_player_stats', async () => {
    const c = fakeClient()
    const r = await dispenseReward(c, { userId: 'u', sessionId: 's', type: 'gemme', payload: { amount: 5 } })
    expect(r.ok).toBe(true)
    expect(c.rpc).toHaveBeenCalledWith('increment_player_stats', expect.objectContaining({ p_gemme: 5 }))
  })
})
```

- [ ] **Step 2: Run** `npm run test:run -- src/lib/game/rewards/__tests__/dispense.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `dispense.ts`. Port the branch bodies from `src/app/api/game/map-pins/claim/route.ts` (`oggetto`, `uovo`, `creatura`, `abilita`, `indizio`, `evento`) and `enigmi/solve` (`exp`/`gold`). Add `gold`/`exp`/`gemme` → `increment_player_stats({p_user_id,p_session_id,p_exp,p_score,p_gold,p_gemme})`. Signature:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { grantAbility } from '@/lib/game/grant-ability'

export type RewardType =
  | 'gold' | 'exp' | 'gemme'
  | 'oggetto' | 'uovo' | 'creatura' | 'abilita' | 'indizio' | 'evento'
  | 'bustina' | 'forziere' | 'premio'
  | 'personaggio' | 'opera' | 'aneddoto' | 'missione'

export interface DispenseInput { userId: string; sessionId: string; type: RewardType; payload: Record<string, any> }
export interface DispenseResult { type: RewardType; ok: boolean; detail: Record<string, any> }

export async function dispenseReward(client: SupabaseClient, input: DispenseInput): Promise<DispenseResult> {
  const { userId: user_id, sessionId: session_id, type, payload } = input
  switch (type) {
    case 'gold': case 'exp': case 'gemme': {
      const amount = Number(payload.amount) || 0
      await client.rpc('increment_player_stats', {
        p_user_id: user_id, p_session_id: session_id,
        p_exp: type === 'exp' ? amount : 0,
        p_score: type === 'exp' ? Math.floor(amount / 10) : 0,
        p_gold: type === 'gold' ? amount : 0,
        p_gemme: type === 'gemme' ? amount : 0,
      })
      return { type, ok: true, detail: { amount } }
    }
    // ... oggetto / uovo / creatura / abilita / indizio / evento ported verbatim ...
    default:
      return { type, ok: false, detail: { error: 'tipo non gestito' } }
  }
}
```

- [ ] **Step 4: Run** the test → PASS. Also `npm run typecheck`.

- [ ] **Step 5: Commit** `git commit -am "feat(rewards): dispenseReward core (gold/exp/gemme + item/creature/ability/etc)"`

### Task 1.3: Port `oggetto`/`creatura`/`abilita`/`uovo` bodies + tests

- [ ] Add one test per type (item stacks, creature dup-count increments, ability calls grantAbility, egg inserts player_eggs). Use the same fakeClient chain-mock pattern. Run → fail → port body → pass → commit `git commit -am "test(rewards): cover item/creature/ability/egg dispense"`.

### Task 1.4: Route the 5 channels through the dispenser

For each channel, replace the inline `switch(reward_type)` grant with `await dispenseReward(client, {...})`, keeping channel-specific pre-checks (proximity, solution, key/idempotency) in place. **Do one channel per commit and run that channel's existing test after each.**

- [ ] **1.4a** `src/app/api/game/map-pins/claim/route.ts` — replace the big `switch` (lines ~144-434) with a dispenser call for the leaf types; keep `boss`/`enigma` pre-check logic, delegating their terminal grant to the dispenser. Run `npm run test:run -- src/app/api/game/map-pins/claim`. Commit.
- [ ] **1.4b** `src/app/api/game/enigmi/solve/route.ts`. Run its test. Commit.
- [ ] **1.4c** `src/app/api/admin/players/grant/route.ts` — map `type:'item'`→`oggetto`, keep response shape. Run test. Commit.
- [ ] **1.4d** `src/app/api/game/qr/scan/route.ts`. Run `qr/__tests__`. Commit.
- [ ] **1.4e** mission completion path (`src/lib/game/missions.ts` + `reward_extra`, added in Task 5.1). Defer the `reward_extra` loop to Task 5.1; here just confirm existing mission reward tests pass.

### Task 1.5: Gemme in top bar + admin grant

- [ ] Add `gemme` to `PlayerSession` type in `src/lib/types.ts`.
- [ ] `src/components/ui/GameTopBar.tsx` — render `💎 {gemme}` next to gold (find gold render, mirror it). Load gemme wherever gold is loaded (`/api/game/profile`).
- [ ] `src/app/api/admin/players/grant/route.ts` — add `type === 'gemme'` branch (or route via dispenser). Add gemme option to `src/app/admin/players/page.tsx` grant form.
- [ ] Commit `git commit -am "feat(gemme): top-bar display + admin grant"`.

---

## Phase 2 — Bustine (packs)

### Task 2.1: Packs migrations

**Files:** Create `supabase/migrations/053_packs.sql`

- [ ] Tables `packs`, `pack_pool`, `player_packs` per spec §5. RLS: `packs`/`pack_pool` select for authenticated, all for admin; `player_packs` own-or-admin (mirror `player_inventory` policy in 002/040). Indexes on `pack_pool(pack_id)`, `player_packs(user_id,session_id)`.
- [ ] Apply, `npm run db:types`, commit.

### Task 2.2: Draw logic (pure, unit-tested)

**Files:** Create `src/lib/game/rewards/draw.ts`, test `src/lib/game/rewards/__tests__/draw.test.ts`

- [ ] **Test:** `drawFromPool(pool, count, rng)` returns `count` entries; weighting respected with a stubbed rng; qty within `[min_qty,max_qty]`.
- [ ] **Implement** using `mulberry32`/seeded rng from `src/lib/game/rng.ts` (check its exports first). Weighted pick by cumulative `weight`.

```ts
export interface PoolEntry { reward_type: string; reward_payload: any; weight: number; min_qty: number; max_qty: number }
export function drawFromPool(pool: PoolEntry[], count: number, rand: () => number): Array<{ reward_type: string; payload: any }> { /* weighted */ }
```

- [ ] Fail → implement → pass → commit.

### Task 2.3: `POST /api/game/packs/open`

**Files:** Create `src/app/api/game/packs/open/route.ts` + `__tests__/route.test.ts`

- [ ] **Test:** owned pack + active session → returns `drops[]` of length in `[min,max]`, decrements `player_packs`, dispenses each; not-owned → 422; session ended → 403.
- [ ] **Implement:** auth via `getAuthUser`; load pack + pool (admin client); verify `player_packs.quantity > 0`; `count = min + floor(rand()*(max-min+1))`; `drawFromPool`; for each `dispenseReward`; decrement quantity (delete row if 0); log `player_game_events` type `pack_opened`; return drops.
- [ ] Fail → implement → pass. `GET /api/game/packs` returns owned packs joined to catalogue. Commit.

### Task 2.4: Admin packs CRUD + pool editor + AI art

**Files:** `src/app/api/admin/packs/route.ts`, `[id]/route.ts`, `[id]/pool/route.ts`, `[id]/artwork/route.ts`; page `src/app/admin/packs/page.tsx`; add nav link in `src/components/admin/AdminShell.tsx`.

- [ ] CRUD mirrors `src/app/api/admin/items/route.ts`. Pool editor: list/add/delete `pack_pool` rows with a reward-type + payload picker (reuse the payload form from `src/components/admin/PinPayloadForms.tsx`). Artwork route uses shared image helper (Task 7.1). Commit per route+page.

### Task 2.5: Backpack UI + PackOpenModal

**Files:** Modify `src/app/game/backpack/page.tsx`; create `src/components/game/PackOpenModal.tsx`.

- [ ] Add "Bustine" section listing owned packs (query `player_packs` join `packs`), "Apri" button → `PackOpenModal`.
- [ ] `PackOpenModal`: calls `/api/game/packs/open`, plays a staggered reveal (framer-motion; mirror `EggHatchModal.tsx`), shows each drop with rarity color. Commit.

---

## Phase 3 — Forzieri (chests) + Chiavi

### Task 3.1: Chests migration

- [ ] `supabase/migrations/054_chests.sql`: extend `items.type` CHECK to add `'chiave'` (copy the `DO $$` pattern from 040). Tables `chests`, `player_chests` per spec §5. RLS + indexes. Apply, types, commit.

### Task 3.2: Key-check helper (pure)

**Files:** `src/lib/game/rewards/keys.ts` + test.

- [ ] `checkKeyRequirements(reqs, inventoryByItemId) → { ok, missing[] }`. Test satisfied/unsatisfied/multi-type. Fail→impl→pass→commit.

### Task 3.3: `POST /api/game/chests/open`

**Files:** `src/app/api/game/chests/open/route.ts` + test.

- [ ] **Test:** missing keys → 422 with `missing`; enough keys → consumes keys (decrement `player_inventory`), dispenses fixed `contents`, decrements `player_chests`. Owned check, session guard.
- [ ] Implement (load chest + player inventory keys; `checkKeyRequirements`; consume; `dispenseReward` per content). `GET /api/game/chests`. Commit.

### Task 3.4: Admin chests CRUD + ChestOpenModal + backpack sections

- [ ] Admin routes/page mirror packs; key-requirement editor (item picker filtered to `type='chiave'` + qty) and contents editor (reward payload rows). Artwork route.
- [ ] Backpack: "Forzieri" + "Chiavi" sections. `src/components/game/ChestOpenModal.tsx`: shows key requirements, disabled if missing, unlock animation on success. Commit per unit.

---

## Phase 4 — Premi speciali (vouchers)

### Task 4.1: Prizes migration + dispenser type

- [ ] `supabase/migrations/055_special_prizes.sql`: `special_prizes`, `player_prizes` (`code` unique, `redeemed_at`, `redeemed_by_admin_id`). RLS. Apply/types.
- [ ] Add `premio` case to `dispenseReward`: insert `player_prizes` with a generated `code` (e.g. `crypto.randomUUID().slice(0,8).toUpperCase()`). Unit test. Commit.

### Task 4.2: Admin prizes CRUD + redeem + player UI

- [ ] Admin `special_prizes` CRUD + artwork. `POST /api/admin/players/redeem-prize` mirrors `redeem-item/route.ts` (set `redeemed_at`, `redeemed_by_admin_id`). Add redeem UI to `src/app/admin/players/page.tsx`.
- [ ] Backpack "Premi" section lists `player_prizes` with code + redeemed state. Commit.

---

## Phase 5 — Channel integration (packs/chests/etc assignable everywhere)

### Task 5.1: Missions `reward_extra`

- [ ] `supabase/migrations/056_mission_reward_extra.sql`: `ALTER TABLE missions ADD COLUMN reward_extra JSONB`. In mission completion (`src/lib/game/missions.ts` / the route that awards mission rewards), after existing gold/exp/item, loop `reward_extra` and `dispenseReward` each. Test: a mission with `reward_extra:[{type:'bustina',payload:{pack_id}}]` grants a pack on completion. Apply/types/commit.

### Task 5.2: Add new reward types to channel admin editors + payload forms

- [ ] Extend `src/components/admin/PinPayloadForms.tsx` (and the enigma/QR/mission admin editors) reward-type dropdowns with `gemme`, `bustina`, `forziere`, `premio`, `personaggio`, `opera`, `aneddoto`, `missione`, each with its payload picker (id selector for the referenced catalogue row; `amount` for gemme).
- [ ] Widen CHECK constraints where they gate reward_type: `enigmi.reward_type` (migration, mirror 051), `qr_codes.type`. `session_map_pins.reward_type` is free-text (no change). Migration `057_reward_type_widen.sql`. Apply/types.
- [ ] Verify each channel dispenses the new types (they go through `dispenseReward` already). Add a route test asserting a pin with `reward_type='bustina'` grants a pack. Commit per editor.

---

## Phase 6 — Collezioni culturali + Trofei

### Task 6.1: Collection migrations

- [ ] `supabase/migrations/058_cultural_collection.sql`: `cultural_places`, `artworks`, `characters`, `anecdotes`, `player_collection`, `trophies`, `player_trophies` per spec §5. RLS. Apply/types/commit.

### Task 6.2: Dispenser collection types + ability unlock + trophy check

- [ ] Add `personaggio`/`opera`/`aneddoto` cases to `dispenseReward`: upsert `player_collection` (increment `copies`). For `personaggio`, if `characters.unlocks_ability_id` set, call `grantAbility`.
- [ ] `src/lib/game/collection.ts` `checkTrophies(client, userId, sessionId)`: after any collection grant, evaluate `trophies.criteria` (e.g. `{kind:'personaggio', complete_all:true}` or `{place_id, complete:true}`); insert `player_trophies` if newly satisfied. Unit test criteria evaluation. Commit.

### Task 6.3: Admin CRUD for places/artworks/characters/anecdotes/trophies + AI art

- [ ] One admin page each (mirror items page); characters page has `unlocks_ability_id` picker; artworks/characters/anecdotes have `place_id` picker. Artwork routes. Commit per entity.

### Task 6.4: `/game/collezione` page

- [ ] `GET /api/game/collezione` returns catalogue grouped by luogo + player-owned counts + trophies. Page `src/app/game/collezione/page.tsx` grouped by luogo with owned/total + GOLD progress bars + trophy shelf. Add nav entry (`src/components/ui/NavIcons.tsx` / game layout). Commit.

---

## Phase 7 — AI art (bulk) + seed + polish

### Task 7.1: Shared image helper

**Files:** `src/lib/ai/generateImage.ts` + test.

- [ ] `generateImage({ prompt, style?, bucket, path }) → Promise<string>`: reads `process.env.OPENAI_API_KEY ?? process.env.OPENAI_API`; model `process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2'`; `1024x1024`; base64 → `admin.storage.from(bucket).upload(path, buf, {upsert:true})` → public URL. Extract from `creatures/[id]/artwork/route.ts` and refactor that route to use it (keep bucket `creature-artwork`). Test with fetch mocked. Commit.

### Task 7.2: Seed catalogue rows

**Files:** `supabase/migrations/059_loot_seed.sql` (or `scripts/seed-loot.ts`).

- [ ] Insert the "3 of each" content from spec §9: 3 keys (items type `chiave`), 3 chests (+key_requirements + contents), 3 packs (+pool entries), 3 prizes, 3 places, 3 artworks, 3 characters (link `unlocks_ability_id` to existing abilities via subquery), 3 anecdotes, 3 trophies, gem icon item if needed. Use `gen_random_uuid()`; reference existing items/abilities/creatures by name subqueries. Apply. Commit.

### Task 7.3: Bulk art generation script

**Files:** `scripts/seed-loot-art.ts` (tsx/node).

- [ ] For each new catalogue row missing `image_url`, build a themed prompt (Adriatic-coast / Roman museum style, matching creature-art style) and call `generateImage` → update row. Run once locally with `.env.local` loaded (`OPENAI_API`). Bucket `game-assets`. Verify URLs saved. Commit generated URLs (rows updated in DB; commit the script).

### Task 7.4: Final polish + full test run

- [ ] `npm run typecheck` clean. `npm run test:run` — new tests green; confirm the 9 known pre-existing failures are unchanged (memory `pre-existing-test-failures`), no new ones.
- [ ] Manual smoke via preview: grant a pack (admin) → open (reveal) → chest with keys → collection page shows a granted personaggio + unlocked ability. Screenshot.
- [ ] Commit. Open PR.

---

## Self-review notes

- **Spec coverage:** gemme (1.1,1.5) · dispenser+refactor (1.2-1.4) · bustine (P2) · forzieri+chiavi (P3) · premi (P4) · channel integration incl. missions (P5) · collezioni+trofei+ability-unlock (P6) · AI art bulk+seed (P7). All spec §sections mapped.
- **Type consistency:** `dispenseReward(client, {userId,sessionId,type,payload})` and `DispenseResult{type,ok,detail}` used uniformly; `drawFromPool`/`checkKeyRequirements`/`checkTrophies` signatures fixed here.
- **Risk:** Phase 1.4 refactor is the highest-risk step — one channel per commit, run that channel's existing test each time before moving on.
- **Migrations** are sequential 052→059; confirm no number clash before applying (last existing is 051).
