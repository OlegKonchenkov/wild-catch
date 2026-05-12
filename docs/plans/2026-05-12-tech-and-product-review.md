# Daimon — Technical + Product Review

**Date:** 2026-05-12
**Scope:** End-to-end review of the user-facing experience (root → home → game/*), GPS step counter, map performance, and broader product positioning.

---

## 1. Technical state of the app

### What works well

- **Architecture (Next 16 App Router + Supabase)** is a solid, modern choice. SSR-gated layouts for `/game`, `/home`, `/admin` with server-side `redirect()` — no flash of protected pages.
- **Anti-cheat is server-authoritative**: bounds, accuracy, now implied velocity. Catch, fight, hatch, missions are validated server-side, not trusted from the client.
- **Realtime via Supabase channels** integrated well for backpack, bestiary, duel, admin broadcasts (`session_ended` / `session_restarted`).
- **Race-condition safety** is in place for atomic state transitions (egg hatch, mission complete, pin claim) via `WHERE … IS NULL` guards.
- **PWA shell**: manifest, sw.js, splash, `apple-mobile-web-app-capable`. Audio system with shared `AudioContext` + ducking. Framer-motion animations are polished.
- **Per-session model** (invite codes, scoped scoring, isolated sessions) — well thought out and the cornerstone of selling the product B2B.

### Technical debt / concrete weaknesses

#### A. Code quality

- **`src/app/game/map/page.tsx` is 1900+ lines** mixing modal components, stateful hooks, effects, business logic. Should be split: `EggHatchModal.tsx`, `StarterSelect.tsx`, `useMapEncounters.ts`, `useMapPins.ts`, `usePositionThrottle.ts`.
- **`src/app/game/boss/[id]/page.tsx` is 2700+ lines**. Same.
- **`src/components/GameShell.tsx` is 1238 lines** mixing popups, level, exp, gold, session timer, leaderboard pre-fetch, audio ducking.
- **17 ESLint `@typescript-eslint/no-explicit-any`** errors (audio loops, page.tsx, etc.). Typing is leaky.
- **Test suite is thin**: 18 test files, 4 currently failing because game-balance numbers (`getCatchHealthMultiplier`, element multipliers) have drifted from the assertions. Probable coverage <10%.
- **`vitest run` is ~35 s** with ~480 s in environment setup — slow import side-effects somewhere.

#### B. Performance

- **Bestiary** fetches `creatures.* + enigma_frammenti(*, enigmi(...))` on every visit. Creatures are practically static — should be cached client-side (IndexedDB) with a TTL or version key. Same for `items` on shop, static `missions`.
- **Service worker** is registered but I don't see precache / runtime-cache strategies. App shell + critical assets should be precached for cold-start <500 ms.
- **No clear CDN/image strategy** for creature artwork. Some `<img>` should be `next/image` with aggressive cache-control.
- **Bundle size unknown** — run `next build --analyze` to spot dead imports (e.g. all of `framer-motion` imported where only `motion.div` is used).
- **Database write amplification**: `last_position` is updated every 5 s per active player → 20 UPDATE/s on `player_sessions` with 100 concurrent players. OK on free tier; for scale, move position writes to a dedicated table or use a buffer (Redis / `player_positions_log` with TTL).

#### C. UX / mobile

- No **offline fallback** if the player loses network in outdoor play.
- No **Wake Lock** on the map → screen sleeps mid-game. Need `navigator.wakeLock.request('screen')` while map is open.
- No **background geolocation** (PWA limitation — needs SW + Web Push, or a native wrapper).
- **iOS Safari quirks**: `100svh` is correct; verify audio loops only start after a user gesture.
- No **haptic feedback** (`navigator.vibrate`) on catch / encounter / level-up. Huge UX gain on mobile.

#### D. Security

- Verify the **service role key** is only used in server routes (`createAdminClient`), never imported into a client bundle.
- **No rate limiting** on critical endpoints: `catch`, `fight`, `scan`, `position`. A misbehaving client can saturate Supabase RPCs.
- **RLS policies** not yet audited — if any are missing on `player_*` tables, an authenticated user could read/write other players' rows with a forged request.

#### E. Operability

- **No Sentry / error tracking** in the client (only `logSessionErrorClient` → DB insert). For production we want stack traces, breadcrumbs, ideally session replay.
- **No gameplay analytics**: catches/day, missions completed, drop-off per level, average session length. Without these, you can't balance.
- **No documented CI/CD**: deploy mechanism, lint-gated PRs, preview environments are not described.

### Priority list (in order of recommendation)

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Sentry + game analytics (PostHog / Mixpanel) | S | Very high |
| 2 | Rate limit + RLS audit on Supabase | M | Critical (security) |
| 3 | Break up `map/page.tsx` and `boss/[id]/page.tsx` | M | High (maintainability) |
| 4 | Wake Lock + haptic feedback on map | XS | High (UX) |
| 5 | IndexedDB client cache for `creatures`, `items`, `missions` | S | Medium (perf) |
| 6 | Service worker cache strategies (network-first for API, cache-first for assets) | M | High (offline + perf) |
| 7 | Type tightening (eliminate `any`, generate Supabase types) | M | Medium (quality) |
| 8 | Test coverage on game-logic (RNG, catch rates, level rewards, missions) | M | High (regression safety) |

---

## 2. Product / game review

### Concept

"Capture mythological Adriatic creatures by physically exploring the coast" + duels, bosses, riddles, missions, in-territory QR codes. **Pokémon Go meets local tourism**, with a narrative vertical (local mythological creatures). Strong niche.

### Game-design strengths

- **Per-session/event model** instead of a global persistent world. This is brilliant — it makes the app sellable as a **white-label B2B platform** for tourist events, festivals, parks, brand experiential marketing.
- **In-territory QR codes**: the physical/digital bridge is the real moat against pure mobile competitors. Hard to copy because it needs local partnerships.
- **Squad of 3 + status effects + element triangle**: combat depth already exceeds many similar games.
- **Bosses + riddles + missions**: three distinct mechanics that interlock → solid retention loop.
- **Multiplayer (duels, leaderboard)** already shipped — competitive, not just single-player.

### Game-design weaknesses

- **Onboarding/tutorial** is light. The typical event participant (not a gamer) needs a guided first encounter.
- **Weak short-term loop**: what do you do in the first 5 minutes? Walk → random encounter → catch. No urgency, no micro-objectives. Walk missions are long-term but quick wins (30 s) are missing.
- **Async vs sync gap**: duels only live if other players are active in the same session. Fine for events of 20+ people, dead for solo daily use. Need bot / NPC duels to fill.
- **No end-of-event drama**: `score_final` is stored when a session ends but there's no "last 10 minutes" hype.
- **No real-world rewards**: in a tourism context, winning should unlock a real coupon at a partner bar, a physical gadget. The digital→physical bridge is the real hook for the sellable model.

### Future gameplay directions

1. **Co-op pin / boss raids**: pins on the map that require 2–3 nearby players to defeat → forces socialisation, perfect for events.
2. **Daily / streak rewards** scoped to the active session.
3. **Photo mode**: photograph a captured creature in AR on-site → share → viral. Even just a CSS overlay without real AR works.
4. **Storyline**: replace random missions with a **local narrative** ("the Daimon of the Carso has awoken — collect the 7 fragments…").
5. **Creature trading** between players in the same session → social loop.
6. **Spectator mode**: friends/family who don't walk can watch duels live. Expands the audience.

### Selling the product

Recommended model: **B2B SaaS / white-label for events & territories**. Don't sell to players (B2C is slow, expensive, crowded). Sell to **organisations** that want territorial engagement:

- Pro Loco / Comuni promoting tourism
- Festivals / sagre (3–5 day events)
- Natural parks, reserves
- Retail chains (mall treasure hunts)
- Brands (a local beer becomes a "boss" in bar zones)
- Schools / GREST summer camps

### Pricing potential

- **"Sagra" tier**: €500–1500 per event (3–7 days), basic branding, 50–200 players. Client supplies QRs, you configure creatures/missions.
- **"Festival" tier**: €3000–8000 per larger event, custom branding, analytics dashboard, partner coupon integration.
- **"Seasonal" tier**: €10–30k for a comune or park using it all summer.
- **Annual white-label licence**: €25–50k for territorial-marketing agencies reselling it to clients.

### Must-haves before selling

1. ✅ Already in place: lobby, isolated sessions, QR system, per-session leaderboard.
2. ❌ **Clean admin dashboard** — clients must be able to create sessions, upload creatures, generate QRs, view live stats (active players, heatmap, top engagers).
3. ❌ **Branding / skin customisation** per client: logo, colours, app name ("Daimon Trieste", "Caccia al Drago Festival X").
4. ❌ **Bulletproof onboarding**: an older user must succeed at first try. GDPR clear (already partially there).
5. ❌ **CSV export at session end**: participant lists, leaderboard, stats for the client report.
6. ❌ **Demo demo demo**: a 60 s gameplay video. Without it, you don't sell to a mayor.
7. ❌ **Documented pilot case**: run one event free or symbolic-price, gather data, photos, video testimonials. Becomes the case study.

### Differentiators (nice-to-have)

- **POS partner integration** (QR at bar → real discount → counter mission)
- **Print-on-demand** of captured creatures (stickers, cards) as event gadgets
- **Multilingual** (IT/EN at minimum) — international tourists

### Positioning

Don't compete with Pokémon Go. The angle is:

> **"Turn your festival / park / town into a game. Your visitors walk more, stay longer, spend more, and come back next year."**

KPIs to sell to the client: average distance walked per visitor, time on-site, % of QRs scanned at partner points of interest, virality (% new players invited).

### 6-month roadmap

1. **Month 1–2**: solid admin dashboard + branding + onboarding. Sentry + analytics. One free pilot event (local Pro Loco / sagra).
2. **Month 3**: professional demo video, written case study, single landing page.
3. **Month 4–6**: outbound to 50–100 Pro Loco, event agencies, north-east comuni. Target 2–3 paid events for summer 2026.

---

## Work shipped this session

- SSR-redirect at root, self-hosted fonts, eliminated the auth-check splash.
- Migration `028_last_position_at` for velocity-based GPS filtering.
- Step counter with SNR + velocity filter — only real walking is counted.
- Faster map boot: skip starter check for returning players.
- `getCurrentUser` helper replacing 13 `auth.getUser()` round-trips on SSR-gated pages.
- `next` bumped to 16.2.6 (security advisories closed).
