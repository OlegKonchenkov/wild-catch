# Manual Creature Switch With Turn Cost Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the player to manually switch to any living creature in the current squad during encounters, boss fights, and duels; switching consumes the player's turn.

**Architecture:** Boss fights and duels already persist per-slot battle state, so they can add a dedicated `switch` action with validation and turn handoff. Encounters do not currently persist per-slot battle state server-side, so the implementation should add an encounter-side lineup snapshot and active slot to `encounters`, then route all combat, heal, and switch actions through that persisted state. Because the project is still in test, this rollout can be a hard cutover for new battles: no compatibility layer is required for older encounters already in the database.

**Tech Stack:** Next.js App Router route handlers, React client pages, Supabase Postgres/JSONB, realtime broadcasts for duels, Vitest route tests, TypeScript.

---

## Preconditions

- Verified on live Supabase project `gkbtdagxgfzliomyfzvh` on 2026-04-21:
  - `encounters` still persists only `player_creature_id`, `player_status`, `player_status_turns`, `wild_status`, `wild_status_turns`
  - `boss_fights` already persists `player_lineup`, `boss_lineup`, `player_active_slot`, `boss_active_slot`
  - `duel_lineups` already persists per-slot `current_hp`, `is_active`, `active_status`, `status_turns_left`
- We do **not** need backward compatibility for encounters, boss fights, or duels created before the rollout; test data can be ignored or expired.
- Switching **must cost the turn** in all three flows.
- A manual switch is only allowed to a living, non-active creature already in the battle lineup.
- Manual switch does **not** clear status effects by itself.
- Status effects and their remaining turns stay attached to the creature that owns them even while benched; if that creature re-enters, the same status state must still be present.

### Task 1: Persist encounter lineup state server-side

**Files:**
- Create: `supabase/migrations/024_encounter_lineup_and_switch.sql`
- Modify: `src/app/api/game/encounter/start/route.ts`
- Modify: `src/app/api/game/encounter/get/route.ts`
- Test: `src/app/api/game/encounter/get/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
it('returns encounter lineup state with active slot and per-slot hp/status', async () => {
  expect(body.playerLineup).toEqual([
    expect.objectContaining({
      player_creature_id: 'pc-1',
      is_active: true,
      active_status: 'confusione',
      status_turns_left: 2,
    }),
    expect.objectContaining({
      player_creature_id: 'pc-2',
      is_active: false,
      active_status: null,
      status_turns_left: 0,
    }),
  ])
  expect(body.playerActiveSlot).toBe(0)
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/encounter/get/__tests__/route.test.ts`
Expected: FAIL because the route does not yet return persisted lineup battle state.

**Step 3: Write minimal implementation**

```sql
alter table encounters
  add column if not exists player_lineup jsonb not null default '[]'::jsonb,
  add column if not exists player_active_slot integer not null default 0;
```

```ts
// encounter/start route
const playerLineup = squadCreatures.map((creature, index) => ({
  slot: index,
  player_creature_id: creature.pcId,
  name: creature.name,
  element: creature.element,
  rarity: creature.rarity,
  max_hp: creature.hp,
  current_hp: creature.hp,
  fainted: false,
  is_active: index === 0,
  active_status: null,
  status_turns_left: 0,
}))
```

```ts
// encounter/get route
if (!Array.isArray(encounter.player_lineup) || encounter.player_lineup.length === 0) {
  return NextResponse.json({ error: 'Encounter legacy non supportato in ambiente test' }, { status: 409 })
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/encounter/get/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/024_encounter_lineup_and_switch.sql src/app/api/game/encounter/start/route.ts src/app/api/game/encounter/get/route.ts src/app/api/game/encounter/get/__tests__/route.test.ts
git commit -m "feat: persist encounter lineup state"
```

### Task 2: Add manual encounter switch action

**Files:**
- Create: `src/app/api/game/encounter/switch/route.ts`
- Test: `src/app/api/game/encounter/switch/__tests__/route.test.ts`
- Modify: `src/app/api/game/encounter/fight/route.ts`
- Modify: `src/app/api/game/encounter/heal/route.ts`

**Step 1: Write the failing test**

```ts
it('switches to a living benched creature, consumes the turn, and preserves the benched status state', async () => {
  expect(body.switched).toBe(true)
  expect(body.switchedTo).toBe('pc-2')
  expect(body.turnConsumed).toBe(true)
  expect(body.playerLineup[0]).toEqual(
    expect.objectContaining({
      player_creature_id: 'pc-1',
      active_status: 'confusione',
      status_turns_left: 2,
      is_active: false,
    }),
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/encounter/switch/__tests__/route.test.ts`
Expected: FAIL because the route does not exist.

**Step 3: Write minimal implementation**

```ts
const nextLineup = encounter.player_lineup.map((slot, index) => ({
  ...slot,
  is_active: index === targetSlot,
}))

await supabase
  .from('encounters')
  .update({
    player_lineup: nextLineup,
    player_active_slot: targetSlot,
    player_creature_id: nextLineup[targetSlot].player_creature_id,
  })
  .eq('id', encounterId)
```

```ts
// encounter/fight + encounter/heal
const activeSlot = encounter.player_lineup[encounter.player_active_slot]
// always read/write hp and status from the owning lineup slot, not from a global encounter field
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/encounter/switch/__tests__/route.test.ts src/app/api/game/encounter/fight/__tests__/route.test.ts`
Expected: PASS, with existing encounter status tests still green.

**Step 5: Commit**

```bash
git add src/app/api/game/encounter/switch/route.ts src/app/api/game/encounter/switch/__tests__/route.test.ts src/app/api/game/encounter/fight/route.ts src/app/api/game/encounter/heal/route.ts
git commit -m "feat: add encounter manual switch action"
```

### Task 3: Add encounter switch UI

**Files:**
- Modify: `src/app/game/encounter/[id]/page.tsx`
- Test: `src/app/game/encounter/[id]/__tests__/page.test.tsx`

**Step 1: Write the failing test**

```tsx
it('enables switch on living benched creatures and shows benched statuses without clearing them', () => {
  expect(screen.getByRole('button', { name: /switch to creature 2/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /switch to creature 1/i })).toBeDisabled()
  expect(screen.getByText(/confusione 2 turni/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/game/encounter/[id]/__tests__/page.test.tsx`
Expected: FAIL because squad entries are not interactive.

**Step 3: Write minimal implementation**

```tsx
const canSwitch = !loading && !result && !entry.fainted && !entry.is_active

<button disabled={!canSwitch} onClick={() => handleSwitch(entry.slot)}>
  {entry.name}
</button>
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/game/encounter/[id]/__tests__/page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/game/encounter/[id]/page.tsx src/app/game/encounter/[id]/__tests__/page.test.tsx
git commit -m "feat: add encounter switch controls"
```

### Task 4: Add boss fight switch action and turn handoff

**Files:**
- Modify: `src/app/api/game/boss/[id]/route.ts`
- Modify: `src/app/game/boss/[id]/page.tsx`
- Test: `src/app/api/game/boss/[id]/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
it('switches to a living benched player creature, then lets the boss act, and preserves the old active status', async () => {
  expect(body.switched).toBe(true)
  expect(body.playerSwitchedTo).toBe('Backup')
  expect(body.turnConsumed).toBe(true)
  expect(body.playerLineup[0]).toEqual(
    expect.objectContaining({
      active_status: 'paralisi',
      status_turns_left: 1,
      is_active: false,
    }),
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/boss/[id]/__tests__/route.test.ts`
Expected: FAIL because `action: "switch"` is unsupported.

**Step 3: Write minimal implementation**

```ts
if (action === 'switch') {
  const target = playerLineup[targetSlot]
  if (!target || target.fainted || target.is_active) {
    return NextResponse.json({ error: 'Cambio non valido' }, { status: 409 })
  }
}
```

```ts
// do not mutate status fields during switch
const nextPlayerLineup = playerLineup.map((slot, index) => ({
  ...slot,
  is_active: index === targetSlot,
}))
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/boss/[id]/__tests__/route.test.ts`
Expected: PASS, with existing boss status tests still green.

**Step 5: Commit**

```bash
git add src/app/api/game/boss/[id]/route.ts src/app/game/boss/[id]/page.tsx src/app/api/game/boss/[id]/__tests__/route.test.ts
git commit -m "feat: add boss fight manual switch"
```

### Task 5: Add duel switch action, broadcast, and UI

**Files:**
- Modify: `src/app/api/game/duel/action/route.ts`
- Modify: `src/app/game/duel/[id]/page.tsx`
- Test: `src/app/api/game/duel/action/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
it('switches to a living benched creature, consumes the turn, broadcasts the switch, and keeps benched status data', async () => {
  expect(body.switched).toBe(true)
  expect(sentPayloads[0].payload.action).toBe('switch')
  expect(sentPayloads[0].payload.switchedTo.name).toBe('Backup')
  expect(sentPayloads[0].payload.previousActive).toEqual(
    expect.objectContaining({
      active_status: 'sonno',
      status_turns_left: 2,
    }),
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: FAIL because `switch` is unsupported and no broadcast exists.

**Step 3: Write minimal implementation**

```ts
await supabase.from('duel_lineups').update({ is_active: false }).eq('id', myActive.id)
await supabase.from('duel_lineups').update({ is_active: true }).eq('id', nextMine.id)
await supabase.from('duels').update({ current_turn: nextTurnRole }).eq('id', duelId)
```

```ts
// switch action must not reset active_status or status_turns_left on either lineup row
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: PASS, with existing heal/status test still green.

**Step 5: Commit**

```bash
git add src/app/api/game/duel/action/route.ts src/app/game/duel/[id]/page.tsx src/app/api/game/duel/action/__tests__/route.test.ts
git commit -m "feat: add duel manual switch"
```

### Task 6: Regression pass and cleanup

**Files:**
- Modify: `src/app/game/guide/page.tsx`
- Modify: `src/app/game/encounter/[id]/page.tsx`
- Modify: `src/app/game/boss/[id]/page.tsx`
- Modify: `src/app/game/duel/[id]/page.tsx`

**Step 1: Write or extend final regression tests**

```ts
it('does not allow switching to fainted or active creatures and restores the same status state after switch-back', async () => {
  expect(res.status).toBe(409)
})
```

**Step 2: Run focused suite**

Run: `npm run test:run -- src/app/api/game/encounter/get/__tests__/route.test.ts src/app/api/game/encounter/fight/__tests__/route.test.ts src/app/api/game/encounter/switch/__tests__/route.test.ts src/app/api/game/boss/[id]/__tests__/route.test.ts src/app/api/game/duel/action/__tests__/route.test.ts`
Expected: PASS.

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 4: Update player-facing guide copy**

```md
Manual switch: tap a living benched creature. The switch consumes your turn.
```

**Step 5: Commit**

```bash
git add src/app/game/guide/page.tsx
git commit -m "docs: explain manual creature switching"
```
