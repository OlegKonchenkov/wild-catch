# Test-Coverage Plan — 2026-05-13

Goal: bring meaningful coverage on game-critical logic and API surfaces.
Optimised so a non-Opus model can execute most of it autonomously.

## Acceptance criteria

- `npx vitest run` ends with **zero new failing tests** (the 4 pre-existing
  failures on `getCatchHealthMultiplier` + `armonia` multiplier are
  game-balance debt — **do not "fix" by changing assertions**; flag them
  in a separate doc instead).
- Each new test file must:
  - Use `describe` blocks per function / route.
  - Cover at least: happy path, one edge case, one error/null case.
  - Be **deterministic** — no `Math.random()` without seeding, no timing
    dependencies without `vi.useFakeTimers()`.
  - Type cleanly: `npx tsc --noEmit` exits 0.
- New tests use the existing patterns in:
  - `src/lib/game/__tests__/anti-cheat.test.ts` (pure-function style)
  - `src/lib/game/__tests__/step-counter.test.ts` (contract test with
    `baseInput` + override-per-case pattern)
  - `src/app/api/game/encounter/__tests__/start.test.ts` (route-with-mocked-supabase pattern)

## Phase 1 — Pure game-logic library (highest ROI, lowest risk)

Each function is pure or near-pure → no mocking needed. **Estimated ~120 tests**.

### `src/lib/game/rng.ts`
Existing tests cover some; expand:
- [ ] `selectCreatureForEncounter`: with empty pool, with single-rarity pool,
  with weighted multi-rarity pool, with `min_level` exclusions.
- [ ] `calculateFightDamage`: damage curve at HP 100/50/25, with crit
  multiplier, with element multiplier, with `defenderDef` reducing damage.

### `src/lib/game/combat.ts`
- [ ] `scaleCombatStats(base, level)`: at level 1, 10, 50, 99. Verify formula
  via existing constants in `level_rewards`.
- [ ] `resolveTurnStartStatus`: each `StatusEffect` (`poison`, `sonno`,
  `paralisi`, `confusione`, `bruciatura`) at HP 100, with and without
  `status_turns_left` decrement.
- [ ] `rollStatusEffect`: deterministic with `vi.spyOn(Math, 'random').mockReturnValue(0.01)`
  for guaranteed proc, `0.99` for guaranteed miss.
- [ ] `STATUS_EFFECT_META` shape (every effect has `label`, `emoji`, `color`,
  `glow`).

### `src/lib/game/elements.ts`
Existing: 1 test. Add:
- [ ] `getElementMultiplier(attacker, defender)`: all 25 (5×5) element pairs
  in a table-driven test. Verify advantage / disadvantage / neutral matches
  the type chart documented in code comments.
- [ ] Edge cases: unknown element strings return 1.0.

### `src/lib/game/leveling.ts`
- [ ] `getExpProgress(exp, level)`: at level 1 with 0 exp, mid-level,
  level-cap reached, exp > next-level threshold.
- [ ] `xpRequiredForLevel(level)`: monotonically increasing, matches
  `level_exp_config` table.
- [ ] Edge: level 0, level > cap.

### `src/lib/game/missions.ts`
- [ ] `incrementMissionProgress(...)` (pure helper subset, not the DB one):
  - Below target: returns updated progress, not completed.
  - At target: completed = true.
  - Beyond target: capped at target.
- [ ] `loadMissionUnlockContext` — mock supabase, verify it builds
  the expected level/completion state from 2-3 fixture rows.

### `src/lib/game/mission-unlocks.ts`
- [ ] `getMissionUnlockState(mission, context)`: locked by level,
  locked by previous-mission, both unlocked, no requirements.

### `src/lib/game/anti-cheat.ts`
Already covered: `isValidGPSSpeed`. Add:
- [ ] `haversineDistance`: known coordinates → expected metres ±10%
  (use Trieste centre + 100 m north / east as fixtures).
- [ ] `isWithinBounds`: inside, on edge, outside on each cardinal side.
- [ ] `parsePoint`: `"(12.5,45.6)"` → `{ lat: 45.6, lng: 12.5 }`; null
  for malformed input.

### `src/lib/game/step-counter.ts`
Already fully covered (19 tests). **Skip.**

### `src/lib/cache.ts`
- [ ] `swr(key, ttl, loader)`:
  - Cache miss → `cached` null, `fresh` calls loader, writes cache.
  - Fresh hit → `cached` returns, `fresh` resolves with same value
    **without** calling loader (mock with `vi.fn()`, assert call count).
  - Stale hit → `cached` returns stale, `fresh` re-loads.
  - Loader throws on stale revalidation → falls back to stale data.
  - Empty / corrupt localStorage → safe degradation.
- [ ] `invalidate(key)` removes entry.

Use `vi.stubGlobal('localStorage', new MockStorage())` per test.

### `src/lib/rate-limit.ts`
- [ ] `rateLimit(key, userId)`:
  - With no env vars → returns `{ success: true }` (test-mode default).
  - With mock Upstash that returns success → forwards `remaining` + `reset`.
  - With Upstash returning false → forwards 429-ready result.
- [ ] `rateLimitResponse(reset)` returns a `NextResponse` with status 429
  and a `Retry-After` header of plausible value.

### `src/lib/haptics.ts`
- [ ] All 9 haptic methods call `navigator.vibrate` with the right pattern
  when the API exists (mock `navigator.vibrate = vi.fn()`).
- [ ] Silent no-op when `navigator.vibrate` is undefined (don't throw).

---

## Phase 2 — API routes (mock Supabase, cover the contract)

Use the **route test pattern** in `src/app/api/game/encounter/__tests__/start.test.ts`
as a template. Each route should have:
- 1 test for unauthenticated → 401
- 1 test for missing required body fields → 400
- 1 test for the happy path → 200 + expected response shape
- 1 test for the dominant failure mode (already-claimed, rate-limited,
  session ended, etc.)

### Already covered (skip)
- `auth/join` ✓
- `game/encounter/start` ✓ + `fight` ✓
- `game/duel/connect` ✓ + `action` ✓
- `game/qr/scan` ✓ + `qr/boss-scan` ✓
- `game/shop/buy` ✓
- `game/starter/pick` ✓ + `starters` ✓
- `game/boss/[id]` ✓
- `admin/exp-config` ✓
- `admin/players/redeem-item` ✓

### To add — high-priority (gameplay-critical)
- [ ] `game/position/route.ts` — verify SNR/velocity filter contract from
  the route's perspective (uses extracted `evaluateStep` already tested
  separately, but route covers the DB writes).
- [ ] `game/encounter/catch/route.ts` — catch rate clamps, item bonus
  applied, mission progress incremented, evolution branch.
- [ ] `game/encounter/heal/route.ts` — HP capped at max_hp, item consumed.
- [ ] `game/encounter/flee/route.ts` — encounter marked fled, position
  cooldown set.
- [ ] `game/encounter/switch/route.ts` — fainted creature can't be set
  active, status reset on switch.
- [ ] `game/map-pins/claim/route.ts` — proximity check, already-claimed,
  enigma wrong solution, boss spawn.
- [ ] `game/eggs/[id]/route.ts` — hatch atomically; double-call returns
  alreadyHatched.
- [ ] `game/creature/evolve/route.ts` — evolution requires N duplicates;
  duplicates consumed atomically.
- [ ] `game/creature/select/route.ts` — only owned creatures; deselect path.
- [ ] `game/squad/route.ts` — squad caps at 3, all must be owned, no dupes.
- [ ] `game/item/use/route.ts` — esca extends `esca_active_until`,
  uovo decrements + creates `player_eggs` row.

### To add — secondary (admin)
- [ ] `admin/qrcodes/route.ts` — admin gate, list, create.
- [ ] `admin/session/start/route.ts` — pre-start checks, status transition.
- [ ] `admin/session/close/route.ts` — closes + writes `score_final`.
- [ ] `admin/players/grant/route.ts` — increments gold/exp atomically.
- [ ] `admin/upload/route.ts` — uses service role, validates mime type.

### Mock pattern (reuse, don't reinvent)

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/.../route'

const mockGetUser = vi.fn()
const mockSingle  = vi.fn()
const mockFrom    = vi.fn(() => ({
  select: () => ({ eq: () => ({ single: mockSingle }) }),
  update: () => ({ eq: () => ({}) }),
  insert: () => ({}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

beforeEach(() => { vi.clearAllMocks() })

it('401 when not authenticated', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
  const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }))
  expect(res.status).toBe(401)
})
```

---

## Phase 3 — React hooks

### `src/hooks/useGPS.ts`
- [ ] Watch position fires on mount, clears on unmount.
- [ ] Handles `PERMISSION_DENIED` error.
- [ ] Caches last position across re-mount.

Use `vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } })`.

### `src/hooks/useWakeLock.ts`
- [ ] Requests lock when enabled, releases on unmount.
- [ ] Re-acquires on `visibilitychange` to visible.
- [ ] Silent no-op when API missing.

### `src/hooks/useSessionTimer.ts`
- [ ] Counts down from `end_at`.
- [ ] Fires expiry callback at 0.
- [ ] Cleans interval on unmount.

Use `vi.useFakeTimers()` everywhere.

---

## Phase 4 — Smoke E2E (Playwright)

**This phase needs human bootstrap** (Playwright install + config + 1
seed-data script). Once set up, an LLM can add scenarios.

Setup files (human writes once):
- `playwright.config.ts`
- `e2e/fixtures/seed-session.ts` (creates a test session via service role)
- `e2e/utils/login.ts` (helper to bypass OAuth via cookie injection)

Scenarios (LLM writes after setup):
- [ ] Login → join session with code → land on map (golden path).
- [ ] Map → catch a creature (mock encounter API to return guaranteed catch).
- [ ] Map → walk distance → mission completed toast.
- [ ] Backpack → use esca → marker on map.
- [ ] Profile → switch sessions → see different leaderboard.

---

## Operational notes for the executor model

1. **Read existing test files first** when adding to a domain — copy the
   import / `describe` / mock pattern verbatim. Don't reinvent.
2. **One test file per source file**. Place it in `__tests__/` next to
   the source.
3. **Never** change game-balance constants to make a failing test pass.
   If a test number looks wrong, add a `// TODO(balance):` comment and
   keep the test failing, then add it to `docs/plans/2026-05-13-test-coverage-plan.md`
   in a "Known balance gaps" section at the bottom.
4. **Run after every file**: `npx vitest run <path-to-new-test>` to verify
   in isolation, then `npx tsc --noEmit`.
5. **Commit per area** (not per file). Example commit message:
   `test(combat): add 24 tests for status-effect resolution`.
6. **Don't touch source code** unless a function is genuinely untestable
   (e.g. depends on a top-level side effect). In that case, extract the
   pure subset to its own function and test that.

## Phasing recommendation

| Phase | Effort (LLM) | Stop point |
|---|---|---|
| 1 (game-logic) | 1 session ~2h | when `npm run test:run -- src/lib` shows ≥80% function coverage |
| 2 (API routes) | 2 sessions ~3h each | when every endpoint listed has its 4-test contract |
| 3 (hooks) | 0.5 session | when 3 hooks have basic mount/unmount/cleanup tests |
| 4 (E2E) | human setup + 1 LLM session | when 5 scenarios green |

After Phase 1 + 2, coverage is "vendibile" for a B2B pilot. Phase 3 + 4 are
polish.
