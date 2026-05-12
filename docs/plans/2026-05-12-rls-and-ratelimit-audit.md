# RLS + Rate-limiting Audit — 2026-05-12

## Method
Inspected `docs/db/schema-baseline-2026-04-27.sql` (state at 2026-04-27) plus
later migrations 025–028. All 31 user-data tables in the `public` schema were
checked for `ENABLE ROW LEVEL SECURITY` and at least one access policy.

## Row-Level Security — overall status: ✅ healthy

Every player-owned table has RLS enabled with the canonical
`user_id = auth.uid() OR is_admin()` pattern. Cross-user reads only happen
through narrowly-scoped policies (duels, lineups). No table is exposed via
`GRANT … TO anon` without RLS gating.

### Worth a second look

| Finding | Severity | Action |
|---|---|---|
| `creatures` has two SELECT policies: `creatures_read USING (true)` and `players read creatures USING (session_id IS NULL OR EXISTS …)`. The first wins (policies are ORed). The session-scoped policy is **dead code**. | Low (intentional global read of creature catalogue) | Drop the dead policy in a cleanup migration, or document the intent. |
| `items` — same situation: `items_read USING (true)` masks the session-scoped one. | Low | Same. |
| `qr_codes` — `qr_read FOR SELECT USING (true)`. Any authenticated user can enumerate **all** QR rewards across all sessions. | Medium | Either scope to session ownership, or accept that QR contents are guessable but the rate-limited scan API is the real gate. |
| `notifications` `notif_read USING (true)`. Likely intentional (global notifications), but verify. | Low | Document. |
| `sessions_read USING (true)` — every session row visible. Used to render lobby; fine if no sensitive data lives on the row. | Low | OK as-is. |
| `pc_duel_read` and `ps_duel_read` allow reading opponent's creatures / player_session during a duel. Necessary for the duel UI but means a player who has ever duelled you can re-read your data via the policy as long as the duel row exists. | Low | Acceptable; alternative is to denormalise into duel-scoped rows but adds complexity. |

### No critical gaps found

Sensitive write surfaces (`player_creatures`, `player_inventory`,
`player_sessions`, `player_eggs`, `player_missions`, `pin_claims`,
`qr_scan_log`, `boss_fights`, `encounters`, `duels`, `duel_lineups`,
`profiles`, `player_enigma_suggerimenti`) all enforce `user_id = auth.uid()`
on INSERT/UPDATE/DELETE. RLS is **load-bearing** here and it's correctly set.

## Rate limiting — overall status: ❌ missing

The critical endpoints below currently accept unlimited requests per user
per second (modulo client-side throttling, which a hostile client can ignore):

| Endpoint | Risk if abused | Notes |
|---|---|---|
| `POST /api/game/encounter/start` | Spawn-flood: gain encounters faster than the cooldown allows | Server already enforces a 30 s mutex via `triggeringEncounterRef` on the client, but the API itself does not throttle. |
| `POST /api/game/encounter/catch` | Burn through RNG attempts; force encounter cleared | One catch per turn server-side, but no per-user rate limit. |
| `POST /api/game/encounter/fight` | Same — depends on turn-state checks on the server. | |
| `POST /api/game/position` | Inflate steps, force missions to complete; DB write storm | Client throttles to 1/5 s, but no server-side cap. |
| `POST /api/game/qr/scan` | Brute-force QR codes (8-char alphanumeric → ~3·10^12 keyspace, but a player could try thousands per minute). | The scan log table exists (`qr_scan_log`) but is not used to enforce a window. |
| `POST /api/game/shop/buy` | Race-condition exploitation on gold balance. | The atomic balance check is server-side, but bursty requests can still cause noise. |
| `POST /api/auth/join` | Brute-force invite codes. | Same as QR. |

### Recommended fix

The cheapest robust option is **Upstash Redis + `@upstash/ratelimit`**:

```ts
// src/lib/ratelimit.ts (sketch)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
export const encounterLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, '60s'),
  analytics: true,
})
```

Inside a route:

```ts
const { success } = await encounterLimit.limit(`encounter:${user.id}`)
if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
```

Free tier: 10k commands/day — plenty for the use case.

Alternative: **Vercel KV** (same SDK on the Vercel Marketplace), or a
**Postgres-side rate limit** using a small `rate_limit` table with
`(user_id, bucket, count, window_start)` keys (no extra infra, but more
SQL noise).

### Suggested per-endpoint budgets

| Endpoint | Window | Limit per user | Notes |
|---|---|---|---|
| `encounter/start` | 1 min | 6 | Encounter cooldown is 30 s; 6/min is 2× headroom. |
| `encounter/catch`, `encounter/fight` | 10 s | 5 | One action per turn; burst absorbs network retries. |
| `position` | 1 min | 20 | Client posts every 5 s = 12/min. 20 leaves margin for transients. |
| `qr/scan` | 1 min | 12 | Real players scan rarely; 12/min stops scripted brute force. |
| `shop/buy` | 10 s | 4 | Stops accidental double-clicks; doesn't slow real users. |
| `auth/join` | 5 min | 8 | Slows invite-code brute-force; legit retries still work. |

## Other security observations

- `SUPABASE_SERVICE_ROLE_KEY` is referenced only from `src/lib/supabase/admin.ts`. Confirm `createAdminClient` is never imported from a client-side module — bundle analyser would catch this.
- `getCurrentUser()` (the new client helper) reads `auth.getSession()` which is local-only. The SSR layout still calls `auth.getUser()` so token validation still happens before render. No regression.
- No CSRF protection beyond Supabase's cookie-based auth (SameSite). Acceptable for a SPA where the same origin serves API + UI. Document the assumption.

## Next steps

1. **Sign up for Upstash Redis** (free) → set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
2. Add `@upstash/ratelimit` + `@upstash/redis` packages.
3. Wrap the 6 critical endpoints listed above using a shared helper.
4. **Defer** dropping the dead policies until after the next event — low risk, no urgency.
