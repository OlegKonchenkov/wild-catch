# Wave 1 — Avventura + Daily + Ricorrenti + Quiz + Lucchetti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the persistent Avventura session mode plus its daily loop (login rewards + streak, recurring missions), cultural quizzes in the Collezione, and slot-machine lock input for enigmi — with zero behaviour change for existing event/tutorial sessions.

**Architecture:** Everything per-session (avventura = long-lived session, like the tutorial already is). No cron resets: recurring missions use computed `period_key`; daily claims use a `claim_date` UNIQUE row. All rewards flow through the existing `dispenseReward`.

**Tech:** Next.js 16 route handlers, Supabase (CLI `db push` — MCP restricted; hand-edit `src/types/database.ts` after each migration), Vitest, framer-motion.

Spec: `docs/superpowers/specs/2026-07-02-avventura-daily-quiz-design.md`
Conventions: `getAuthUser()` game routes, `requireAdmin` admin routes, additive idempotent migrations, Italian UI, commit per slice, run `npx tsc --noEmit` + targeted vitest before each commit. Baseline: 9 known pre-existing test failures — must not grow.

---

## Phase A — Session modes

### A1. Migration 060_session_modes.sql
- [ ] Widen kind CHECK: drop `sessions_kind_check`, re-add with `('event','tutorial','avventura')`.
- [ ] `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS daily_rewards_enabled BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS daily_pack_id UUID REFERENCES packs(id)`.
- [ ] `db push`; hand-patch `database.ts` (sessions Row/Insert/Update + kind stays string). Commit.

### A2. Admin APIs
- [ ] `session/create/route.ts`: accept `kind` (validate ∈ event|avventura; tutorial not creatable), `dailyRewardsEnabled`, `dailyPackId`, optional `endAt`. For avventura: `auto_end: !!endAt`, `end_at: endAt ?? null`. Default daily ON for avventura when field omitted.
- [ ] `session/update/route.ts`: same fields; guard against changing kind after creation (reject).
- [ ] `session/start/route.ts` + `restart/route.ts`: read `kind`; skip `end_at = now + duration` when `kind === 'avventura'` (preserve explicit end_at). Check existing tests still pass; extend create test with kind case.
- [ ] Commit.

### A3. Admin sessions UI (`src/app/admin/sessions/page.tsx`)
- [ ] Wizard step 1: mode picker — two cards ⏱️ Evento / 🗺️ Avventura (state `wizardKind`). When avventura: hide duration input, show optional "Scadenza (opzionale)" datetime-local + daily config (toggle default ON + pack `<select>` loaded from `/api/admin/catalog/packs`).
- [ ] Edit form: same conditional fields (kind read-only chip).
- [ ] Session list card: for avventura replace `⏱ X min` with `🗺️ Avventura` chip (+ scadenza if set).
- [ ] Commit.

### A4. Player HUD
- [ ] `GameShell`: `loadSessionData` also selects `sessions.kind` and `player_sessions.joined_at`; state `sessionKind`, `adventureDay = floor((now - joined_at)/86400000) + 1`.
- [ ] `GameTopBar`: new optional prop `adventure?: { day: number; streak: number | null }`. When set, the timer cluster renders 🔥`streak` · `Giorno N` (streak null → only Giorno N). Timer/bell untouched otherwise.
- [ ] Verify join/home surfaces that display duration handle avventura copy.
- [ ] Typecheck + commit.

## Phase B — Daily rewards + streak

### B1. Migration 061_daily_claims.sql
- [ ] `player_daily_claims` per spec §5 + RLS own-or-admin + index (user, session). Push, patch types, commit.

### B2. `src/lib/game/daily.ts` (pure) + tests
- [ ] `romeDateKey(d: Date): string` via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })`.
- [ ] `prevDateKey(key: string): string` (UTC-noon arithmetic, DST-safe).
- [ ] `computeStreak(prev: { claim_date: string; streak: number } | null, todayKey: string): number`.
- [ ] `buildDailyRewards(streak, dailyPackId): Array<{type, payload}>` per spec §5 (pack/fallback-gold + gemme `2×min(streak,7)` + 7th-day extra pack).
- [ ] Tests: date key across DST, streak consecutive/gap/first, reward table at streak 1/3/7/14. Commit.

### B3. Routes + tests
- [ ] `GET /api/game/daily/status`: `{ enabled, claimedToday, streak, day }` (enabled = session.daily_rewards_enabled && status active).
- [ ] `POST /api/game/daily/claim`: guards → insert claim row (23505 ⇒ 409 already claimed) → dispense each reward → log `daily_claimed` event → return `{ streak, drops }`.
- [ ] Route tests: first claim, consecutive day streak+1, gap resets to 1, double-claim 409, disabled 403, unauth 401. Commit.

### B4. UI
- [ ] `DailyRewardModal.tsx` (frontend-design: dawn-over-laurels identity, 7-day flame row with today pulsing, claim → staggered `describeDrop` reveal, streak count-up).
- [ ] GameShell: when session kind avventura (or daily enabled), fetch status once per mount; auto-open modal if unclaimed (localStorage guard `daily_prompted:<sessionId>:<dateKey>` to avoid re-popping same day); wire streak into GameTopBar `adventure` prop; on claim → `wc:refresh-stats`.
- [ ] Bell theme + `formatGameEvent` case `daily_claimed`. Typecheck + commit.

## Phase C — Missioni ricorrenti

### C1. Migration 062_mission_recurrence.sql
- [ ] `missions.recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily','weekly','monthly'))`.
- [ ] `player_missions.period_key TEXT NOT NULL DEFAULT ''`; drop unique from 027, re-add `(user_id, mission_id, session_id, period_key)` (name it explicitly; keep NULL-session semantics). Push, patch types, commit.

### C2. Period logic + increment
- [ ] `periodKeyFor(recurrence, now)` in `src/lib/game/recurrence.ts` (Rome TZ; ISO week for weekly) + unit tests (year boundary, week 1, month key).
- [ ] `missions.ts`: when loading existing player_missions rows, match on `period_key = periodKeyFor(mission.recurrence, now)`; include `period_key` in inserts. Existing missions (recurrence null → `''`) hit the exact same rows as today.
- [ ] Mission list APIs/pages: filter progress rows by current period; expose `recurrence`.
- [ ] Tests: increment creates fresh row in new period; non-recurring untouched (existing tests green). Commit.

### C3. UI
- [ ] Missions page: badge Giornaliera/Settimanale/Mensile (color-coded) + "si rinnova" hint.
- [ ] Admin missions page: recurrence `<select>`. Commit.

## Phase D — Quiz culturali

### D1. Migration 063_quizzes.sql
- [ ] `quizzes` + `player_quizzes` per spec §7, RLS (quizzes: select authenticated — but game API strips `correct_index`; player_quizzes own-or-admin). Push, patch types, commit.

### D2. Routes + tests
- [ ] `GET /api/game/quiz?sessionId`: scoped session-or-global (tutorial isolated via `isTutorialSession`), joins player state + `player_collection` for locks; strips `correct_index`.
- [ ] `POST /api/game/quiz/answer`: guards (locked 403, solved 409); attempts++; correct → solved_at + dispense (`reward` JSON or default 5 gemme) + `quiz_solved` event; return `{ correct, drops? }`.
- [ ] Tests: locked, wrong (no reward, attempts++), correct dispenses once, re-answer 409. Commit.

### D3. Admin + player UI
- [ ] Catalog allowlist + Quiz tab in `/admin/collezione` (CatalogManager fields: question, options JSON, correct_index, place select, anecdote select, reward JSON).
- [ ] Collezione page: fetch quizzes; PlaceCard gains Quiz group (🎓 icon, solved ✓ / locked 🔒 states); `QuizModal` (scholar-parchment identity: question plaque, option slabs, wrong = shake + crack, correct = laurel burst + reward chips via `describeDrop`).
- [ ] Bell theme `quiz_solved`. Typecheck + commit.

## Phase E — Enigmi a lucchetto

### E1. Migration 064_enigma_lock.sql
- [ ] `enigmi.lock_config JSONB` (null = text input). Push, patch types, commit.

### E2. Admin + API
- [ ] Admin enigmi editor: "Lucchetto" toggle → alphabet input (default `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`), length shown from solution; validate solution chars ∈ alphabet on save (create + update routes too).
- [ ] `GET /api/game/enigmi` + pin enigma payload include `lock_config`. Commit.

### E3. `EnigmaLock` component
- [ ] `src/components/game/EnigmaLock.tsx`: one brass wheel per char — ▲/▼ buttons, spring-animated character drum, haptic tick, current string composed; "Prova" submits via the same callback the text input uses. Used in enigmi page SolvePanel + pin EnigmaModal when `lock_config` present.
- [ ] Component test: composing + submit passes the joined string. Typecheck + commit.

## Phase F — Guides, events, final verification

- [ ] Player guide: new "Modalità Avventura" section (streak/giorno/daily); Quiz block inside Collezione section; lucchetto note in Enigmi; daily bustina note in Bustine.
- [ ] Admin guide: avventura creation, daily config, recurrence, quiz authoring, lock config (extend section 13).
- [ ] Full `npx vitest run` (only the 9 known failures) + `npx tsc --noEmit` (0).
- [ ] Browser smoke: create avventura → HUD Giorno/streak → claim daily → answer quiz → solve lock enigma. Screenshot proof.
- [ ] Commit; checkpoint with Oleg before Wave 2.

## Self-review
- Spec §4→Phase A, §5→B, §6→C, §7→D, §8→E, §9→F. Covered.
- Types used consistently: `periodKeyFor`, `romeDateKey`, `buildDailyRewards`, `adventure` prop shape.
- Highest risk: C2 unique-constraint swap on `player_missions` (live table) — additive default `''` keeps every existing row valid; constraint recreate is instantaneous on this data size.
- Session `kind` widen: all existing reads treat kind as opaque string except tutorial-ID checks (unaffected).
