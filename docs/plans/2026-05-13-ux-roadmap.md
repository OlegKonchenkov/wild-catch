# UX Roadmap — Daimon

Tracking di tutti gli interventi UX prioritari prima del primo pilot B2B.
Aggiornato vivente: ogni voce è una checkbox spunta-quando-fatto.

Legenda priorità: ⭐ = nice-to-have · ⭐⭐⭐⭐⭐ = critical-for-pilot.

---

## ✅ Step 1 — Onboarding non-orfano + carosello 5 slide
**Status:** done · **Effort:** ~2h · **Impatto:** ⭐⭐⭐⭐⭐

- [x] Migration 029: `player_sessions.onboarding_seen boolean default false`
- [x] Rewrite `/game/onboarding` come 5-slide carousel (welcome / loop / QR / permessi / ready)
- [x] Swipe orizzontale + dot indicator + skip persistente
- [x] API `POST /api/game/onboarding` (seen=true|false, idempotente)
- [x] Map page: redirect a `/game/onboarding` se `onboarding_seen=false`
- [x] Guide page: bottone "🎓 Rivedi il tutorial iniziale"
- [x] 6 contract tests sul nuovo endpoint
- [x] Commit `7935db0`

---

## ✅ Step 2 — Coachmarks first-run sulla mappa
**Status:** done · **Effort:** ~1.5h · **Impatto:** ⭐⭐⭐⭐⭐

- [x] Componente `Coachmark` (SVG mask + tooltip + pulsing outline)
- [x] 5 step coachmark sulla mappa (map-area, step-counter, nav-missioni, nav-zaino, nav-guida)
- [x] `data-coachmark` attributes su tutti i target
- [x] Persistenza in `localStorage` per device
- [x] Guide page: bottone "💡 Suggerimenti UI" (re-arma il flag)
- [x] 7 contract tests (render, next/prev, skip, target lookup, fallback)

---

## ✅ Step 3 — Widget "Prossimo obiettivo" persistente sulla mappa
**Status:** done · **Effort:** ~1.5h · **Impatto:** ⭐⭐⭐⭐⭐

- [x] `GET /api/game/missions/next?sessionId=<uuid>` — restituisce la
  prima missione sbloccata + non completata per `chapter_order`
- [x] Componente `NextObjectiveWidget` (top-left della mappa) con icona
  per tipo, titolo, progress bar + counter
- [x] Aggiornamento realtime via Supabase channel su `player_missions`
- [x] Tap → `router.push('/game/missions?focus=<id>')`
- [x] Self-hide quando `objective: null` (tutte completate / nessuna config)
- [x] 8 contract tests sull'endpoint (auth, validation, sort, lock, completion)

---

## ✅ Step 4 — Tutorial sempre attivo (mini-storia "Apprendista Daimologo")
**Status:** done · **Effort:** ~5h totali (v1: 3h + v2: 2h) · **Impatto:** ⭐⭐⭐⭐⭐

Sessione globale `kind='tutorial'` accessibile a chiunque senza codice invito.
Mini-storia in **6 missioni** che fa interagire con cammino, cattura, QR
(item simulato), shop, boss fight, finale. Rifacibile con wipe completo.

v1 (migration 030):
- [x] `sessions.kind` + tutorial session UUID fisso + QR seed + item
- [x] `src/lib/game/tutorial.ts` constants module
- [x] `POST /api/game/tutorial` (start | reset) — idempotente; reset wipe
  atomico di 10 tabelle per-(user, session) + ricreazione fresh
- [x] `/api/game/sessions` filtra fuori `kind='tutorial'`
- [x] `/home`: card "🎓 Prova il gioco — Tutorial gratuito"
- [x] Bottone "🪄 Simula scansione QR" tutorial-only sulla mappa
- [x] Fix bounds vuoti in `/api/game/encounter/start`

v2 (migration 031 — espansione completa):
- [x] 4 missioni → 6: aggiunte "L'arte del commercio" (shop) e
  "Sfida il Capo del Tirocinio" (boss QR), rinominata finale "Maestro Daimologo"
- [x] Tutorial Esca (premio QR1) + Tutorial Rete (in shop a 100 oro)
- [x] Tutorial boss QR `TUTBSS` con creatura comune lookup dinamico
- [x] Shop page: filtra item per `session_id=eq.<currentSessionId>` o
  `is.null` — tutorial item non leakano in eventi reali
- [x] Shop buy route: 403 se l'item appartiene a una sessione diversa
- [x] Bottone simulato sulla mappa è ora **context-aware**: legge il
  next-objective e morpha da "🪄 Simula scansione QR" (teal) a
  "💀 Evoca il Capo del Tirocinio" (rosso) quando il giocatore è alla
  missione 5. Boss QR scan → navigate diretto a `/game/boss/[id]`.
- [x] 9 contract test sul nuovo helpers module (`isTutorialQrTarget`,
  `tutorialQrButtonLabel`, costanti)
- [x] Totale: 313 test pass, 4 pre-esistenti balance failure invariati

---

## ✅ Step 5 — Primo incontro guidato (assorbito da Step 4)
**Status:** dropped — coperto dal Tutorial v2 ("Il tuo primo Daimon" missione 2)

~~Dropped as a standalone step:~~ il tutorial guida già il giocatore al
primo combat naturalmente. Aggiungere un coachmark in-encounter è un
nice-to-have ma non più critico.

---

## ✅ Step 4b — Enigma del tutorial (v3)
**Status:** done · **Effort:** ~2h · **Impatto:** ⭐⭐⭐⭐⭐

Espande il tutorial v2 con una 7ª missione di tipo `enigma` che insegna
la meccanica enigmi/frammenti/suggerimenti — l'unica feature non ancora
toccata dal tirocinio.

Design:
- Enigma "L'Essenza del Daimon", soluzione `anima` (5 lettere, facile)
- 2 frammenti narrativi concessi al completamento di M2 (prima cattura)
  e M5 (boss QR) — il giocatore impara che catturare creature può
  sbloccare indizi
- 1 suggerimento gratuito pre-concesso allo start del tutorial — sostituisce
  il pin/QR che troverebbe in un evento reale
- Ricompensa: +200 oro + 50 EXP

Implementazione:
- [x] Migration 032: tabelle `player_enigmi` + `player_enigma_frammenti`
  + seed enigma + 7ª missione
- [x] Tutorial constants: `TUTORIAL_ENIGMA_ID`, `TUTORIAL_FRAMMENTI`,
  `TUTORIAL_SUGGERIMENTO_ID`, `TUTORIAL_MISSION_FRAMMENTO_GRANTS`
- [x] `/api/game/tutorial` start: upsert idempotente del suggerimento gratuito
- [x] `incrementMissionProgress`: grant di frammento al completamento
  delle missioni mappate
- [x] `GET /api/game/enigmi`: UNION fra frammenti da creature catturate
  e `player_enigma_frammenti` (grant diretti) + flag `solved`
- [x] `POST /api/game/enigmi/solve` (nuovo): rate-limited, idempotente,
  normalizzazione NFKC+lowercase+trim, ricompensa atomica, fires
  `incrementMissionProgress({ type: 'enigma', target: enigmaId })`
- [x] UI `/game/enigmi`: input + bottone Invia + feedback ok/ko, badge
  "✅ Risolto" sulla card
- [x] Wipe-on-reset: nuove tabelle aggiunte a `TUTORIAL_USER_SESSION_TABLES`
- [x] 7 nuovi test (constants + mapping mission→frammento)

---

## 🐛 Bug fix di rilascio
**Status:** done · **Effort:** ~1h

- [x] Mappa non caricava sulla sessione tutorial: `area_bounds = {}` faceva
  early-return in `GameMap`. Ora rileviamo sessioni "unbounded" e usiamo
  GPS / centro Italia come fallback, senza `maxBounds` né rettangolo
- [x] Contapassi che oscillava: il display ora è strettamente monotono.
  Su reconciliation server senza credit, manteniamo `pendingDistance`;
  su reconciliation con credit, `setStepsWalked(max(prev, server))`
  per assorbire l'optimistic locale che batte temporaneamente il server

---

## ⏳ Step 5b — Primo incontro guidato (legacy, dropped)
**Status:** todo · **Effort:** ~2h · **Impatto:** ⭐⭐⭐⭐

Garantire che la prima creatura selvatica sia **easy** (rarity comune,
HP basso) e che venga mostrato un coachmark dentro l'encounter UI
spiegando i bottoni Attacca/Rete/Fuga.

- [ ] Migration: `player_sessions.first_catch_done boolean default false`
- [ ] `/api/game/encounter/start` — se first_catch_done=false → forza pool comune low-HP
- [ ] Coachmark dentro `/game/encounter/[id]` — overlay sui bottoni azione
- [ ] Marca first_catch_done=true al primo `caught`
- [ ] Tests

---

## ⏳ Step 6 — Capitoli narrativi
**Status:** todo · **Effort:** ~4h · **Impatto:** ⭐⭐⭐⭐

Raggruppare missioni in **capitoli** con incipit narrativo, reward
finale di lore, e progressione visibile.

- [ ] Migration: tabella `mission_chapters` (id, session_id, title, intro_text, order, unlock_reward)
- [ ] `missions.chapter_id` FK
- [ ] Admin UI: CRUD capitoli + ordinamento drag
- [ ] Player: pagina missioni mostra capitoli espandibili
- [ ] Modal "Capitolo X sbloccato!" al completamento
- [ ] Tests

---

## ⏳ Step 7 — Lore unlock per la bestiaria
**Status:** todo · **Effort:** ~2h · **Impatto:** ⭐⭐⭐

Ogni creatura ha una **frase narrativa** che si sblocca alla cattura,
visibile nella scheda creatura. Sblocchi totali → tracker "Diario:
12/40 frammenti".

- [ ] Verificare se `creatures.description` è già usato → migrazione `creatures.lore_text` se serve
- [ ] Bestiary: mostra lore unlocked / locked con icona ?
- [ ] Counter "Diario" in profilo
- [ ] Tests

---

## ⏳ Step 8 — Zone tematiche sulla mappa
**Status:** todo · **Effort:** ~3h · **Impatto:** ⭐⭐⭐

Overlay colorati sulla mappa per elemento dominante della zona —
così il giocatore sa dove andare per certe creature.

- [ ] Migration: `sessions.element_zones jsonb` (lista di poligoni + elemento)
- [ ] Admin UI: disegno poligoni sulla mappa
- [ ] Player: rendering Leaflet polygon con tinte per elemento
- [ ] Spawn logic server-side: usa zona per pesare gli elementi
- [ ] Tests

---

## ⏳ Step 9 — Photo mode / share card a fine sessione
**Status:** todo · **Effort:** ~2h · **Impatto:** ⭐⭐ (ma viral)

A fine sessione, una "card riassuntiva" condivisibile via Web Share API
con statistiche + creature catturate + ranking. PNG generato lato client.

- [ ] Component `SessionShareCard` (canvas-based renderer)
- [ ] Wire al flow di `session_ended`
- [ ] Web Share API + fallback download
- [ ] Tests

---

## Ordine consigliato per pilot

1. ✅ Step 1 (oggi)
2. ⏳ Step 2 — Coachmarks (oggi, 1.5h)
3. ⏳ Step 3 — Next objective widget (oggi, 1.5h)
4. ⏳ Step 4 — Primo incontro guidato (domani, 2h)
5. ⏳ Step 5 — Capitoli (sessione dedicata, +4h)
6. ⏳ Step 6 — Lore (sessione dedicata, +2h)
7. ⏳ Step 7 — Zone (post-pilot)
8. ⏳ Step 8 — Share card (post-pilot)

Dopo Step 4 l'esperienza first-run è "sellable". Da 5 in poi è game-design profondo per fidelizzare oltre il primo evento.
