# Wave 1 — Modalità Avventura, Daily Rewards, Missioni Ricorrenti, Quiz, Enigmi a Lucchetto

**Date:** 2026-07-02
**Status:** Approved (scope + 4 design decisions confirmed by Oleg)
**Context:** DAIMON.docx gap analysis. Wave 2 (territorio vivo) and Wave 3 (social/meta) are separate follow-up specs.

## 1. Goal

Keep the timed "escape-room" event mode untouched and add a persistent **Avventura** session mode
(no fixed end, or an optional monthly/annual deadline) where players return daily: login rewards +
streak, recurring missions, cultural quizzes, and a tactile lock-style enigma input.

## 2. Locked decisions

| Topic | Decision |
|---|---|
| Scope | Wave 1 only, checkpoint before Wave 2 |
| Session modes | `sessions.kind` gains `'avventura'` (existing: `event`, `tutorial`). Admin picks mode at creation. |
| Adventure HUD | Replace countdown cluster with **🔥 streak + "Giorno N"** (N = days since the player joined) |
| Daily rewards | `daily_rewards_enabled` toggle on the session — default ON for avventura, OFF for eventi (activatable for multi-day sagre) |
| Quiz UI | Inside **/game/collezione**, grouped per luogo; unlocked by collecting the linked aneddoto |
| Lock enigmi | Per-enigma `lock_config` (alphabet + length); fallback = existing text input. Server solve logic unchanged. |
| Tutorial | Untouched (no recurrence, no daily, isolated as today) |

## 3. Architecture principle

**Everything stays per-session.** The always-on tutorial session already proves persistent sessions
work; avventura reuses that path. Daily claims, streaks, recurring-mission progress and quiz answers
are all keyed `(user_id, session_id)`. No global meta-progression refactor.

Verified foundations: `useSessionTimer` handles `endAt: null`; the close cron only ends sessions with
`auto_end = TRUE AND end_at IS NOT NULL`; `sessions.kind` CHECK exists (widen only).

## 4. Session modes (Phase A)

- Migration: widen `sessions_kind_check` to `('event','tutorial','avventura')`; add
  `daily_rewards_enabled BOOLEAN NOT NULL DEFAULT FALSE`, `daily_pack_id UUID NULL REFERENCES packs(id)`.
- Admin create/update APIs accept `kind`, `dailyRewardsEnabled`, `dailyPackId`. For avventura:
  `auto_end = false`; `end_at` only if an explicit optional deadline is set; `duration_minutes` ignored (kept for schema compat).
- `session/start` (and `restart`) must NOT compute `end_at = now + duration` for avventura (keep null unless explicit deadline).
- Admin sessions UI: mode picker (⏱️ Evento / 🗺️ Avventura) in the creation wizard + edit form.
  Avventura hides the duration field, shows optional deadline + daily-reward config (toggle + pack select, default ON).
  Session list shows a mode chip instead of "⏱ X min" for avventure.
- Player HUD: `GameShell` loads `sessions.kind` + `player_sessions.joined_at`; for avventura the
  GameTopBar timer cluster renders 🔥`streak` · `Giorno N` (streak from daily status; if daily disabled, just Giorno N).
- Join/home/profile surfaces that show duration/countdown degrade gracefully (verify, adjust copy).

## 5. Daily rewards + streak (Phase B)

- Table `player_daily_claims (id, user_id, session_id, claim_date DATE, streak INT, reward JSONB, created_at, UNIQUE(user_id, session_id, claim_date))`, RLS own-or-admin.
- Date/streak logic in `src/lib/game/daily.ts` (pure, injected clock, timezone **Europe/Rome**):
  `romeDateKey(now)`, `computeStreak(prevClaimDate, prevStreak, todayKey)` → prev day consecutive ⇒ +1 else 1.
- `GET /api/game/daily/status` → `{ enabled, claimedToday, streak, day }`.
- `POST /api/game/daily/claim` → guards (session active, daily enabled, not claimed today — UNIQUE is the backstop);
  computes streak; dispenses via `dispenseReward`:
  - 1× bustina `daily_pack_id` (fallback: 25 gold if unset)
  - gemme bonus = `2 × min(streak, 7)` (2…14)
  - every 7th day (streak % 7 == 0): +1 extra bustina
  Logs `player_game_events` type `daily_claimed`; returns drops for the reveal.
- UI: `DailyRewardModal` — auto-opens on the map when status says unclaimed (once per day, per session);
  shows a 7-day streak flame row, claim → staggered drop reveal (reuses `describeDrop`). Distinct visual
  identity from PackOpenModal: dawn/laurel "nuovo giorno" theme.
- New bell theme `daily_claimed`.

## 6. Missioni ricorrenti (Phase C)

- Migration: `missions.recurrence TEXT NULL CHECK IN ('daily','weekly','monthly')`;
  `player_missions.period_key TEXT NOT NULL DEFAULT ''`; unique becomes
  `(user_id, mission_id, session_id, period_key)` (existing rows keep `''` — zero data change).
- **No cron reset.** `periodKeyFor(recurrence, now)` (Europe/Rome) → `''` / `2026-07-02` / `2026-W27` / `2026-07`.
  `incrementMissionProgress` + completion insert + mission list queries filter on the *current* period key,
  so a new period naturally starts from an empty row. Rewards (incl. `reward_extra`) re-dispense each period by design.
- Missions UI: recurrence badge (Giornaliera/Settimanale/Mensile) + progress of the current period.
  Admin missions page: recurrence select.
- Tutorial missions have `recurrence = NULL` — behaviour identical to today.

## 7. Quiz culturali (Phase D)

- Tables: `quizzes (id, session_id NULL, place_id NULL FK cultural_places, unlock_anecdote_id NULL FK anecdotes, question TEXT, options JSONB, correct_index INT, reward JSONB NULL, created_at)`;
  `player_quizzes (id, user_id, session_id, quiz_id, attempts INT NOT NULL DEFAULT 0, solved_at NULL, UNIQUE(user_id, session_id, quiz_id))`, RLS own-or-admin.
- `correct_index` **never** reaches the client (same discipline as enigmi solutions): the game API reads
  via admin client and strips it.
- `GET /api/game/quiz?sessionId` → quizzes scoped session-or-global (tutorial isolated), each with
  `{ locked, solved, attempts }` (`locked` = unlock_anecdote not yet in player_collection).
- `POST /api/game/quiz/answer { quizId, sessionId, answerIndex }` → 403 locked / 409 already solved;
  increments attempts; if correct: set `solved_at`, dispense `reward` (default when null: 5 gemme),
  log `quiz_solved` event. **Retry allowed until correct; reward only on first solve** (educational goal wins).
- UI: Collezione — each PlaceCard gains a "Quiz" group; `QuizModal` with options, wrong-answer shake,
  correct laurel-burst + reward chip. Locked quizzes show "Trova l'aneddoto «X» per sbloccare".
- Admin: `quizzes` added to the catalog CRUD allowlist + a Quiz tab in /admin/collezione
  (question, options JSON, correct_index, place picker, anecdote picker, reward JSON).

## 8. Enigmi a lucchetto (Phase E)

- Migration: `enigmi.lock_config JSONB NULL` — `{ "alphabet": "ABC…09", "length": 4 }`.
- Admin enigmi page: "Lucchetto" toggle → alphabet input (default A–Z + 0–9), length auto-derived from
  the solution; validation: every solution char ∈ alphabet.
- `GET /api/game/enigmi` and pin payloads include `lock_config`.
- UI: `EnigmaLock` component — brass slot-machine wheels (one per char), ▲/▼ arrows with spring
  animation and haptic tick; composes the string and submits to the **existing** solve endpoints
  (`/enigmi/solve`, pin claim). Used in the enigmi page SolvePanel and the pin EnigmaModal whenever
  `lock_config` is present; otherwise the current text input renders.

## 9. Guides & polish (Phase F)

- Player guide: "Modalità Avventura" (streak, giorno, daily), Quiz sub-section in Collezione section,
  lucchetto mention in Enigmi section, daily bustina mention in Bustine.
- Admin guide: creating an avventura, daily config, recurrence, quiz authoring, lock config.
- New event themes: `daily_claimed`, `quiz_solved`.

## 10. Testing & no-regression bar

- Unit: `daily.ts` (streak/Rome dates), `periodKeyFor`, quiz answer route, daily claim route
  (first/consecutive/gap/double/disabled), session create with kind.
- Regression pins: full suite must stay at the 9 known pre-existing failures; tutorial flow untouched;
  event sessions behave byte-identically (kind default `event`, all new columns default off/null).
- Browser smoke: create avventura from admin, HUD shows Giorno/streak, claim daily, answer a quiz,
  solve a lock enigma.

## 11. Out of scope (Wave 2/3)

Guardiano del luogo, bonus-luogo, pergamene, capipalestra presidiabili, amici, classifiche
private/mensili, scambi, evoluzione GOLD, monetizzazione/sponsor.
