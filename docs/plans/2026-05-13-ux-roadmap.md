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

## ⏳ Step 2 — Coachmarks first-run sulla mappa
**Status:** in progress · **Effort:** ~1.5h · **Impatto:** ⭐⭐⭐⭐⭐

Highlight cutout sulla UI principale al primo ingresso sulla mappa. Stile
Duolingo / Pokémon Go: overlay scuro con buco di luce sul target +
tooltip esplicativo + bottoni "Continua" / "Salta".

- [ ] Componente `Coachmark` (overlay SVG mask + tooltip posizionato)
- [ ] 5 step coachmark sulla mappa:
  - Map area: "cammina per far apparire creature"
  - Step counter (top-right): "metri percorsi per le missioni"
  - Nav Missioni: "i tuoi obiettivi"
  - Nav Zaino: "squadra, oggetti, uova"
  - Nav Guida: "ogni meccanica spiegata"
- [ ] `data-coachmark` attribute sui 5 target
- [ ] Persistenza in `localStorage` (per device, non per sessione — sono hint UI, non game intro)
- [ ] Guide page: bottone "Rivedi suggerimenti UI"
- [ ] Tests del componente (target lookup, dismissal, navigation)
- [ ] Commit

---

## ⏳ Step 3 — Widget "Prossimo obiettivo" persistente sulla mappa
**Status:** todo · **Effort:** ~1.5h · **Impatto:** ⭐⭐⭐⭐⭐

Sempre visibile in cima alla mappa. Mostra la missione corrente
(la prima non completata, sbloccata, ordinata per `chapter_order`) con
icona + titolo breve + barra di progresso.

- [ ] Selezione "missione corrente" lato server (`/api/game/missions/next?sessionId`)
- [ ] Component `NextObjectiveWidget` (top-left della mappa)
- [ ] Aggiornamento realtime via realtime channel su `player_missions`
- [ ] Tap → apre `/game/missions` con la missione corrente in evidenza
- [ ] Gestione "nessuna missione attiva" (nasconde widget)
- [ ] Tests

---

## ⏳ Step 4 — Primo incontro guidato
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

## ⏳ Step 5 — Capitoli narrativi
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

## ⏳ Step 6 — Lore unlock per la bestiaria
**Status:** todo · **Effort:** ~2h · **Impatto:** ⭐⭐⭐

Ogni creatura ha una **frase narrativa** che si sblocca alla cattura,
visibile nella scheda creatura. Sblocchi totali → tracker "Diario:
12/40 frammenti".

- [ ] Verificare se `creatures.description` è già usato → migrazione `creatures.lore_text` se serve
- [ ] Bestiary: mostra lore unlocked / locked con icona ?
- [ ] Counter "Diario" in profilo
- [ ] Tests

---

## ⏳ Step 7 — Zone tematiche sulla mappa
**Status:** todo · **Effort:** ~3h · **Impatto:** ⭐⭐⭐

Overlay colorati sulla mappa per elemento dominante della zona —
così il giocatore sa dove andare per certe creature.

- [ ] Migration: `sessions.element_zones jsonb` (lista di poligoni + elemento)
- [ ] Admin UI: disegno poligoni sulla mappa
- [ ] Player: rendering Leaflet polygon con tinte per elemento
- [ ] Spawn logic server-side: usa zona per pesare gli elementi
- [ ] Tests

---

## ⏳ Step 8 — Photo mode / share card a fine sessione
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
