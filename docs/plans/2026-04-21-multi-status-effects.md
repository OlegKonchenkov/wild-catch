# Multi-Status Effects Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support more than one active status effect at the same time in encounters, boss fights, and duels, while preserving stable behavior during rollout.

**Architecture:** Replace the current single-status runtime model with an ordered array-based model, then migrate each battle flow to read and write arrays of statuses. Use a dual-read migration phase so old single-status data can be backfilled into the new structure before the old fields are retired.

**Tech Stack:** Next.js App Router route handlers, TypeScript combat helpers, Supabase Postgres JSONB, boss JSON lineups, duel realtime channels, Vitest.

---

## Preconditions

- Do **not** start this implementation before the battle rules are explicitly frozen.
- The following decisions must be provided before Task 2 begins:
  - execution order for simultaneous statuses
  - whether duplicate statuses refresh, stack, or are ignored
  - whether creatures can inflict multiple statuses from one attack
  - whether encounter switch-out clears any statuses
- Verified on live Supabase project `gkbtdagxgfzliomyfzvh` on 2026-04-21:
  - `creatures` still exposes a single `status_effect` plus `status_effect_chance`
  - `encounters` still exposes single-status columns for player and wild creature
  - `duel_lineups` still exposes single-slot `active_status` and `status_turns_left`
  - `boss_fights` stores lineup state in JSON, so multi-status there will require a JSON shape migration rather than only flat columns

### Task 1: Freeze the battle rules and codify them as tests

**Files:**
- Create: `docs/specs/multi-status-rules.md`
- Create: `src/lib/game/__tests__/multi-status-engine.test.ts`

**Step 1: Write the failing tests for the approved rules**

```ts
it('applies poison before confusion self-hit when that order is approved', () => {
  expect(events.map(event => event.type)).toEqual(['veleno', 'confusione'])
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/game/__tests__/multi-status-engine.test.ts`
Expected: FAIL because multi-status helpers do not exist.

**Step 3: Write the rules doc**

```md
1. Turn start order: poison -> sleep -> paralysis -> confusion
2. Duplicate status application: refresh duration only
3. Poison persists until switch or cure
```

**Step 4: Re-run the test**

Run: `npm run test:run -- src/lib/game/__tests__/multi-status-engine.test.ts`
Expected: still FAIL, but now the expected behavior is frozen in a single place.

**Step 5: Commit**

```bash
git add docs/specs/multi-status-rules.md src/lib/game/__tests__/multi-status-engine.test.ts
git commit -m "test: freeze multi-status battle rules"
```

### Task 2: Add array-based combat types and resolver helpers

**Files:**
- Modify: `src/lib/game/combat.ts`
- Test: `src/lib/game/__tests__/combat.test.ts`
- Test: `src/lib/game/__tests__/multi-status-engine.test.ts`

**Step 1: Write the failing engine tests**

```ts
it('resolves multiple statuses in order and returns the combined event list', () => {
  expect(result.events).toEqual([
    expect.objectContaining({ type: 'veleno' }),
    expect.objectContaining({ type: 'paralisi' }),
  ])
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/game/__tests__/combat.test.ts src/lib/game/__tests__/multi-status-engine.test.ts`
Expected: FAIL because only `resolveTurnStartStatus()` exists for a single status.

**Step 3: Write minimal implementation**

```ts
export interface ActiveStatusState {
  type: StatusEffect
  turnsLeft: number
}

export function resolveTurnStartStatuses(statuses: ActiveStatusState[], context: ResolveTurnContext) {
  // ordered array processing returning nextStatuses + events
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/game/__tests__/combat.test.ts src/lib/game/__tests__/multi-status-engine.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/game/combat.ts src/lib/game/__tests__/combat.test.ts src/lib/game/__tests__/multi-status-engine.test.ts
git commit -m "feat: add array-based multi-status combat helpers"
```

### Task 3: Add dual-read/write schema support

**Files:**
- Create: `supabase/migrations/025_multi_status_arrays.sql`
- Modify: `src/app/api/game/encounter/fight/route.ts`
- Modify: `src/app/api/game/boss/[id]/route.ts`
- Modify: `src/app/api/game/duel/action/route.ts`

**Step 1: Write the failing route tests**

```ts
it('reads legacy single-status rows and writes the new array shape', async () => {
  expect(updatePayload.player_statuses).toEqual([
    expect.objectContaining({ type: 'paralisi', turnsLeft: 2 }),
  ])
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/encounter/fight/__tests__/route.test.ts src/app/api/game/boss/[id]/__tests__/route.test.ts src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: FAIL because array fields do not exist.

**Step 3: Write minimal implementation**

```sql
alter table encounters
  add column if not exists player_statuses jsonb not null default '[]'::jsonb,
  add column if not exists wild_statuses jsonb not null default '[]'::jsonb;

alter table duel_lineups
  add column if not exists active_statuses jsonb not null default '[]'::jsonb;
```

```ts
const activeStatuses = readStatusesFromLegacyOrArray(row.active_statuses, row.active_status, row.status_turns_left)
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/encounter/fight/__tests__/route.test.ts src/app/api/game/boss/[id]/__tests__/route.test.ts src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/025_multi_status_arrays.sql src/app/api/game/encounter/fight/route.ts src/app/api/game/boss/[id]/route.ts src/app/api/game/duel/action/route.ts
git commit -m "feat: add dual-read multi-status schema support"
```

### Task 4: Migrate encounters to multi-status arrays

**Files:**
- Modify: `src/app/api/game/encounter/fight/route.ts`
- Modify: `src/app/game/encounter/[id]/page.tsx`
- Test: `src/app/api/game/encounter/fight/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
it('applies poison and paralysis in the approved order for the player', async () => {
  expect(body.statusEvents).toEqual([
    expect.objectContaining({ type: 'veleno', target: 'player' }),
    expect.objectContaining({ type: 'paralisi', target: 'player' }),
  ])
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/encounter/fight/__tests__/route.test.ts`
Expected: FAIL because the encounter route still consumes one status only.

**Step 3: Write minimal implementation**

```ts
const playerStatuses = readEncounterStatuses(encounter.player_statuses, encounter.player_status, encounter.player_status_turns)
const resolvedPlayer = resolveTurnStartStatuses(playerStatuses, context)
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/encounter/fight/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/game/encounter/fight/route.ts src/app/game/encounter/[id]/page.tsx src/app/api/game/encounter/fight/__tests__/route.test.ts
git commit -m "feat: migrate encounters to multi-status"
```

### Task 5: Migrate boss fights to multi-status arrays

**Files:**
- Modify: `src/app/api/game/boss/[id]/route.ts`
- Modify: `src/app/game/boss/[id]/page.tsx`
- Test: `src/app/api/game/boss/[id]/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
it('handles multiple active statuses on player and boss lineup slots', async () => {
  expect(body.statusTickEvents).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'veleno', target: 'boss' }),
    expect.objectContaining({ type: 'confusione', target: 'boss' }),
  ]))
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/boss/[id]/__tests__/route.test.ts`
Expected: FAIL because boss slots still use `active_status`.

**Step 3: Write minimal implementation**

```ts
bossActive.active_statuses = resolveTurnStartStatuses(
  readBossSlotStatuses(bossActive.active_statuses, bossActive.active_status, bossActive.status_turns_left),
  context,
).nextStatuses
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/boss/[id]/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/game/boss/[id]/route.ts src/app/game/boss/[id]/page.tsx src/app/api/game/boss/[id]/__tests__/route.test.ts
git commit -m "feat: migrate boss fights to multi-status"
```

### Task 6: Migrate duels and realtime payloads

**Files:**
- Modify: `src/app/api/game/duel/action/route.ts`
- Modify: `src/app/game/duel/[id]/page.tsx`
- Test: `src/app/api/game/duel/action/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
it('broadcasts multiple pre-turn status events in one duel action payload', async () => {
  expect(payload.preTurnStatusEvents).toEqual([
    expect.objectContaining({ type: 'veleno' }),
    expect.objectContaining({ type: 'paralisi' }),
  ])
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: FAIL because duel payloads currently expose single-status fields.

**Step 3: Write minimal implementation**

```ts
payload: {
  preTurnStatusEvents,
  statusAppliedToOpp,
  oppStatusStates,
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/game/duel/action/route.ts src/app/game/duel/[id]/page.tsx src/app/api/game/duel/action/__tests__/route.test.ts
git commit -m "feat: migrate duels to multi-status"
```

### Task 7: Update UI badges and admin creature effect model

**Files:**
- Modify: `src/app/game/encounter/[id]/page.tsx`
- Modify: `src/app/game/boss/[id]/page.tsx`
- Modify: `src/app/game/duel/[id]/page.tsx`
- Modify: `src/app/api/admin/creatures/route.ts`
- Modify: `src/app/api/admin/creatures/[id]/route.ts`
- Modify: `src/app/admin/creatures/page.tsx`

**Step 1: Write the failing UI/API tests**

```tsx
it('renders multiple status badges for the active creature', () => {
  expect(screen.getByText('Veleno')).toBeInTheDocument()
  expect(screen.getByText('Paralisi')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/app/game/encounter/[id]/__tests__/page.test.tsx src/app/game/boss/[id]/__tests__/page.test.tsx src/app/game/duel/[id]/__tests__/page.test.tsx`
Expected: FAIL because card components only render one status badge.

**Step 3: Write minimal implementation**

```tsx
statuses.map(status => (
  <StatusBadge key={status.type} effect={status.type} turnsLeft={status.turnsLeft} />
))
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/app/game/encounter/[id]/__tests__/page.test.tsx src/app/game/boss/[id]/__tests__/page.test.tsx src/app/game/duel/[id]/__tests__/page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/game/encounter/[id]/page.tsx src/app/game/boss/[id]/page.tsx src/app/game/duel/[id]/page.tsx src/app/api/admin/creatures/route.ts src/app/api/admin/creatures/[id]/route.ts src/app/admin/creatures/page.tsx
git commit -m "feat: render and manage multi-status state"
```

### Task 8: Remove legacy single-status fields after rollout

**Files:**
- Create: `supabase/migrations/026_drop_legacy_single_status_fields.sql`
- Modify: `src/lib/game/combat.ts`
- Modify: `src/app/api/game/encounter/fight/route.ts`
- Modify: `src/app/api/game/boss/[id]/route.ts`
- Modify: `src/app/api/game/duel/action/route.ts`

**Step 1: Write the failing cleanup tests**

```ts
it('does not read legacy single-status columns once rollout is complete', () => {
  expect(readStatusesFromLegacyOrArray).not.toBeDefined()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/game/__tests__/multi-status-engine.test.ts`
Expected: FAIL because the code still depends on dual-read helpers.

**Step 3: Write minimal implementation**

```sql
alter table encounters drop column if exists player_status;
alter table encounters drop column if exists player_status_turns;
alter table encounters drop column if exists wild_status;
alter table encounters drop column if exists wild_status_turns;
```

**Step 4: Run final verification**

Run: `npm run test:run -- src/lib/game/__tests__/combat.test.ts src/lib/game/__tests__/multi-status-engine.test.ts src/app/api/game/encounter/fight/__tests__/route.test.ts src/app/api/game/boss/[id]/__tests__/route.test.ts src/app/api/game/duel/action/__tests__/route.test.ts && npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/026_drop_legacy_single_status_fields.sql src/lib/game/combat.ts src/app/api/game/encounter/fight/route.ts src/app/api/game/boss/[id]/route.ts src/app/api/game/duel/action/route.ts
git commit -m "refactor: remove legacy single-status fields"
```
