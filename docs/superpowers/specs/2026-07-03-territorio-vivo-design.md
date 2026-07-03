# Wave 2 — Territorio Vivo: Guardiani, Pergamene, Capipalestra presidiabili

**Date:** 2026-07-03 · **Status:** Approved (scope confermato al checkpoint Wave 1)
**Context:** DAIMON.docx — collega mappa ↔ collezione ↔ boss in un loop "esplora il territorio".

## A. Guardiano del luogo + bonus-luogo

Ogni luogo culturale può essere "custodito" da un guardiano (un boss pin). Sconfiggerlo
**libera il luogo** per quel giocatore: bonus una-tantum + vetrina della collezione.

- `session_map_pins.place_id UUID NULL → cultural_places` (un pin boss può custodire un luogo).
- `cultural_places.unlock_bonus JSONB` — array `{type,payload}` erogato via dispenser alla liberazione.
- `player_place_unlocks (user_id, session_id, place_id, unlocked_at, UNIQUE)` + RLS own-or-admin.
- Hook: nella vittoria boss (route `boss/[id]`), se `fight.pin_id → pin.place_id` e nessun unlock:
  insert + dispensa `unlock_bonus` + evento `place_unlocked`; la risposta include `placeUnlocked`
  (nome luogo + drops) per il ResultScreen.
- Admin: pin editor (mappa + sessione) — select "🏛️ Custodisce luogo" visibile per pin boss;
  scheda Luoghi in admin/collezione gains campo `unlock_bonus` (JSON).
- Player: PlaceCard in Collezione mostra lo stato guardiano (🛡️ custodito / ✅ liberato);
  l'API collezione calcola guardiano-per-sessione + unlock del giocatore.

## B. Pergamene camminando

Camminare produce **pergamene**: si aprono dallo Zaino e rivelano un aneddoto casuale
(+ gemme), alimentando collezione e quiz (gate aneddoto).

- Soglia: **1 pergamena ogni 250 passi** (const `PERGAMENA_STEP_INTERVAL`), max 3 per singolo
  aggiornamento posizione (anti-burst). Nessun cron: crossing calcolato nel position route
  tra prevSteps e effectiveSteps.
- `player_pergamene (id, user_id, session_id, earned_at, opened_at NULL, steps_at)` + RLS.
- `POST /api/game/pergamene/open`: aneddoto casuale non posseduto (scoped sessione+globali,
  tutorial isolato) via dispenser + 3 gemme; se tutti posseduti → 10 gold + 3 gemme.
- UI: sezione "Pergamene" nello Zaino (contatore + apri con reveal a pergamena srotolata);
  toast sulla mappa quando se ne guadagna una; evento campanella `pergamena_found`.

## C. Capipalestra presidiabili (gym holds)

Un boss pin marcato `gym: true` nel payload diventa una **palestra**: chi lo batte la presidia.
Ripetibile per tutti; il presidio decade nel tempo (senza cron).

- `gym_holds (id, pin_id, session_id, holder_id, held_since, times_defended, UNIQUE(pin_id, session_id))`,
  RLS: select per tutti gli autenticati (si vede chi presidia), scritture solo service/admin.
- Sfida (claim route, pin boss con `payload.gym`): sempre consentita (né one-shot né "won → ritorna");
  il **titolare non può sfidare la propria palestra** (409). La lineup del boss riceve un
  **modificatore difesa dal tempo di presidio**: +25% stats a presidio fresco, −5%/ora,
  floor −20% (calcolato alla creazione del fight → palestre stantie cadono).
- Vittoria (boss route): upsert holder = vincitore, `held_since = now`. Allo spodestato va la
  **rendita maturata**: 10 oro/ora di presidio (cap 240) + push "Ti hanno spodestato!".
  Evento `gym_taken`.
- UI: il pin palestra sulla mappa mostra il nickname del titolare; il BossApproachModal mostra
  "Presidiata da X da N ore"; campanella `gym_taken`.

## D. Guide + verifica

Sezioni giocatore (Guardiani/Pergamene/Palestre) + admin (authoring). Suite completa: solo i 9
falliti pre-esistenti; typecheck 0; smoke browser.

## Fuori scope (Wave 3)
Amici, classifiche private/mensili, scambi, evoluzione GOLD.
