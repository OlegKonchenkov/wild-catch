# Bustine, Forzieri & Collezioni Culturali — Design

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Author:** brainstormed with Oleg

## 1. Goal

Add a loot/collection layer on top of the existing reward system:

- **Bustine** (card packs) — open to receive 3–5 random, rarity-weighted rewards.
- **Forzieri** (chests) — deterministic fixed contents, gated behind **chiavi** (keys); a chest may require multiple keys and/or multiple key types.
- **Gemme** — a new first-class premium currency.
- **Premi speciali** — rare real-world vouchers (redeemed by admin).
- **Collezioni culturali** — full system: luoghi, opere, personaggi, aneddoti, trofei (GOLD collections). Obtaining a personaggio unlocks a bound special ability.
- Bustine and forzieri (and every reward type) must be **assignable via every reward channel**: missions, enigmi solved, boss wins, map pins, QR codes, admin grant.

New AI art is generated in bulk for all new catalogue rows via OpenAI imagegen v2 (`gpt-image-2`).

## 2. Guiding principles

- **Per-session state.** Like `gold`/inventory/creatures, all new player-owned state carries `session_id`.
- **One reward dispenser.** Reward-granting logic is currently duplicated across 5 channels. Extract a single `dispenseReward()`; route every channel through it. Adding a new reward type then works everywhere.
- **Additive & guarded.** New tables/columns default empty; a player who ignores packs plays identically to today.
- **Equipment is already an item** (with `rarity` + stat bonuses). "Equipaggiamento diviso per rarità" needs no new reward type — the `oggetto` type covers it.

## 3. Decisions (locked)

| Topic | Decision |
|---|---|
| Gemme | First-class currency: `player_sessions.gemme`; top-bar display; spendable (shop packs, enigma hints). |
| Personaggi | Full cultural collection system now (luoghi/opere/personaggi/aneddoti/trofei). |
| Premi speciali | `special_prizes` catalogue → `player_prizes` voucher, admin-redeemed. Special missions also grantable from packs. |
| AI art | Bulk-generate all new asset art now. |
| Delivery | All 7 phases in one build. |
| Dispenser | Full extraction + refactor of the 5 existing channels; existing route tests are the safety net. |

## 4. Reward dispenser (foundation)

`src/lib/game/rewards/dispense.ts`

```ts
type RewardType =
  | 'gold' | 'exp' | 'gemme'
  | 'oggetto' | 'uovo' | 'creatura' | 'abilita' | 'indizio' | 'boss' | 'evento' | 'enigma'
  | 'bustina' | 'forziere' | 'premio'
  | 'personaggio' | 'opera' | 'aneddoto' | 'missione'

interface DispenseInput { userId: string; sessionId: string; type: RewardType; payload: Record<string, unknown> }
interface DispenseResult { type: RewardType; ok: boolean; detail: Record<string, unknown> }

async function dispenseReward(client: SupabaseClient, input: DispenseInput): Promise<DispenseResult>
```

- Absorbs the existing 10 types verbatim (behavior pinned by existing route tests).
- The 5 channels (`map-pins/claim`, `enigmi/solve`, mission completion, `qr/scan`, admin `grant`) call `dispenseReward` instead of inline switch/case.
- `boss`/`enigma` remain special (they need pre-checks) but delegate the terminal grant to the dispenser where possible.

## 5. Data model (migrations, additive)

Everything below is one or more `NNN_*.sql` migrations. Names catalogued permanently (like `creatures`/`items`); player-owned rows are per-session.

### Currency
- `ALTER TABLE player_sessions ADD COLUMN gemme INT NOT NULL DEFAULT 0`.
- Extend `increment_player_stats(...)` RPC with `p_gemme INT DEFAULT 0`.

### Bustine
- `packs`: `id, name, description, rarity, image_url, min_drops INT DEFAULT 3, max_drops INT DEFAULT 5, price_gold INT, price_gemme INT, created_at`.
- `pack_pool`: `id, pack_id FK, reward_type TEXT, reward_payload JSONB, weight INT, rarity_tier TEXT, min_qty INT DEFAULT 1, max_qty INT DEFAULT 1`.
- `player_packs`: `id, user_id, session_id, pack_id FK, quantity, UNIQUE(user_id,session_id,pack_id)`.

### Forzieri + chiavi
- Extend `items.type` CHECK to add `'chiave'`.
- `chests`: `id, name, description, rarity, image_url, place_id FK NULL, key_requirements JSONB (`[{item_id, qty}]`), contents JSONB (`[{type, payload}]`), created_at`.
- `player_chests`: `id, user_id, session_id, chest_id FK, quantity, UNIQUE(...)`.

### Premi speciali
- `special_prizes`: `id, name, description, rarity, image_url, redemption_note, created_at`.
- `player_prizes`: `id, user_id, session_id, prize_id FK, code TEXT UNIQUE, won_at, redeemed_at NULL, redeemed_by_admin_id NULL`.

### Collezioni culturali
- `cultural_places`: `id, name, description, image_url, lat, lng, session_id NULL, created_at`.
- `artworks`: `id, name, description, image_url, place_id FK, rarity, created_at`.
- `characters`: `id, name, description, image_url, place_id FK NULL, rarity, unlocks_ability_id FK abilities NULL, created_at`.
- `anecdotes`: `id, title, body TEXT, image_url, place_id FK NULL, character_id FK NULL, rarity, created_at`.
- `player_collection`: `id, user_id, session_id, kind TEXT ('opera'|'personaggio'|'aneddoto'), ref_id UUID, copies INT DEFAULT 1, UNIQUE(user_id,session_id,kind,ref_id)`.
- `trophies`: `id, name, description, image_url, criteria JSONB, created_at`.
- `player_trophies`: `id, user_id, session_id, trophy_id FK, awarded_at, UNIQUE(...)`.

### Missions generic reward
- `ALTER TABLE missions ADD COLUMN reward_extra JSONB` — array of `{type, payload}` dispensed on completion (lets any mission drop a bustina/forziere/etc. without more columns).

RLS on every new player-owned table mirrors `player_inventory` (`user_id = auth.uid() OR is_admin()`); catalogues are readable by all authenticated, writable by admin.

## 6. API contracts

- `POST /api/game/packs/open` `{ packId, sessionId }` → verify owned & session active; draw `rand(min_drops..max_drops)` slots; each slot = weighted pick over `pack_pool.weight`; dispense each via `dispenseReward`; decrement `player_packs`; return `{ drops: DispenseResult[] }`. Seeded via `lib/game/rng.ts` for testability.
- `POST /api/game/chests/open` `{ chestId, sessionId }` → verify owned; check `key_requirements` against `player_inventory`; on success consume keys, dispense fixed `contents`, decrement; return `{ contents: DispenseResult[] }`. 422 with missing-keys detail otherwise.
- `GET /api/game/packs`, `GET /api/game/chests`, `GET /api/game/collezione`, `GET /api/game/prizes` — read owned/collection state.
- `POST /api/admin/players/redeem-prize` — admin marks a voucher redeemed (mirrors `redeem-item`).
- Admin CRUD routes for `packs` (+pool), `chests`, `special_prizes`, `cultural_places`, `artworks`, `characters`, `anecdotes`, `trophies`, each with an `/artwork` sub-route reusing the shared image helper.

## 7. AI art pipeline

`src/lib/ai/generateImage.ts` → `generateImage({ prompt, style, bucket, path }): Promise<string>`:
- Reads `process.env.OPENAI_API_KEY ?? process.env.OPENAI_API` (local `.env.local` uses `OPENAI_API`).
- Model `process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2'`, `1024x1024`, base64 → upload to public bucket `game-assets`, return public URL.
- The existing `creatures/[id]/artwork` route is refactored to use this helper (keeps `creature-artwork` bucket).
- A seed script `scripts/seed-loot-art.ts` generates art for all new catalogue rows (~22 images: 3 packs, 3 chests, 3 keys, 1 gem, 3 prizes, 3 characters, 3 places, 3 artworks).

## 8. UI (`/frontend-design`)

- **Top bar** (`GameTopBar`): gemme counter (💎) beside gold.
- **Backpack** (`/game/backpack`): new sections Bustine, Forzieri, Chiavi, Premi with open actions.
- **PackOpenModal**: card-tear reveal, staggered rarity flips (framer-motion, matching `EggHatchModal`/`MissionRewardModal`).
- **ChestOpenModal**: key-requirement check → unlock animation → fixed loot reveal; disabled state when keys missing.
- **/game/collezione**: page grouped by luogo; opere/personaggi/aneddoti owned vs total; GOLD progress bars; trophy shelf. Nav entry added.
- **Admin**: pages for packs (+pool editor), chests (+key/contents editor), prizes, places/artworks/characters/anecdotes/trophies — each with AI-art button and reward-payload pickers reused from the pin/enigma editors.
- **Channel editors**: add `bustina`/`forziere`/`gemme`/`premio`/collection types to the reward-type dropdowns in QR, map-pin, enigma, mission admin editors.

## 9. Seed content ("3 of each")

- **Chiavi:** Chiave di Bronzo · d'Argento · d'Oro.
- **Forzieri:** Forziere del Foro (1 Bronzo → equip + gold + opera) · Forziere del Tempio (1 Argento + 1 Bronzo → abilità + gemme + opera) · Forziere Imperiale (2 Oro → premio + equip leggendario + opera).
- **Bustine:** Bustina di Bronzo (comune) · d'Argento (raro) · d'Oro (epico; premi rari + personaggi).
- **Premi:** Cena per due (ristorante partner) · Buono negozio museo · Tour guidato VIP.
- **Personaggi:** Ovidio · Traiano · figura locale — each `unlocks_ability_id`.
- **Luoghi / Opere / Aneddoti / Trofei:** 3 each, themed to the existing Adriatic-coast / Roman setting.

## 10. Testing

- `dispense.test.ts` — unit test each new reward type.
- `packs/open` route test — seeded weighted draw, decrement, empty-pack 409, session guard.
- `chests/open` route test — key gating (missing → 422), key consumption, deterministic contents.
- Regression: existing route tests for the 5 refactored channels must stay green.
- Collection: awarding a personaggio grants its ability; completing a category awards the trophy.

## 11. Phased build order

1. Dispenser refactor + Gemme.
2. Bustine engine + open API + backpack UI + PackOpenModal.
3. Forzieri + Chiavi engine + ChestOpenModal.
4. Premi speciali vouchers + admin redeem.
5. Channel integration (packs/chests assignable everywhere) + admin editors.
6. Collezioni culturali + trofei + /game/collezione.
7. AI art bulk seed + polish.

## 12. Out of scope (this build)

- Real-time multiplayer collection trading.
- Sponsor/ads monetisation hooks, beneficenza voting, live duel meeting points (doc mentions, deferred).
- Dungeon narrative mode.
- Daily-login / streak pack economy (packs are grantable; the scheduling economy is a later pass).

## 13. Pre-existing test failures

Master already has 9 vitest failures (Next `after()` scope + stale numeric expectations) unrelated to this work — see memory `pre-existing-test-failures`. Not regressions; do not chase them.
