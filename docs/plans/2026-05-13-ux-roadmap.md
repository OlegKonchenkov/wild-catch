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
**Status:** done · **Effort:** ~3h · **Impatto:** ⭐⭐⭐⭐⭐

Sessione globale `kind='tutorial'` accessibile a chiunque senza codice invito.
Mini-storia in 4 missioni che fa interagire con cammino, cattura, QR
(simulato), zaino. Rifacibile con wipe completo della propria run.

- [x] Migration 030: `sessions.kind` + tutorial session UUID fisso +
  4 missioni narrative + QR seed + item "Rete del Tirocinante"
- [x] `src/lib/game/tutorial.ts` constants module
- [x] `POST /api/game/tutorial` (start | reset) — idempotente; reset wipe
  atomico di 10 tabelle per-(user, session) + ricreazione fresh
- [x] `/api/game/sessions` filtra fuori `kind='tutorial'` dalla lista
  sessioni reali del giocatore
- [x] `/home`: card "🎓 Prova il gioco — Tutorial gratuito" con CTA
  primaria + link "Rifai da capo" dopo prima visita
- [x] Bottone "🪄 Simula scansione QR" sulla mappa visibile **solo** in
  `session.id === TUTORIAL_SESSION_ID`
- [x] Fix bounds vuoti in `/api/game/encounter/start` (tutorial ha
  `area_bounds = {}`)
- [x] 6 contract test sul nuovo endpoint (auth, validation, start
  idempotente, reset wipe completo, errore propagato)

---

## ⏳ Step 5 — Primo incontro guidato
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
