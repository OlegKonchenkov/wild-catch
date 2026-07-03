# Wave 2 — Territorio Vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, task-by-task, checkbox tracking.

**Goal:** Guardiani del luogo (boss → sblocco luogo + bonus), pergamene camminando (passi → aneddoti/gemme), capipalestra presidiabili (gym holds con decadimento) — additivi, zero regressioni.
**Spec:** `docs/superpowers/specs/2026-07-03-territorio-vivo-design.md`
**Convenzioni:** come Wave 1 (migrazioni CLI `db push`, database.ts a mano, test per slice, commit per slice, baseline 9 falliti noti).

## Phase A — Guardiano del luogo
- [ ] **A1** Migration 065: `session_map_pins.place_id` FK, `cultural_places.unlock_bonus JSONB`, `player_place_unlocks` + RLS. Push, patch types, commit.
- [ ] **A2** Boss route: fight select include `pin_id`; helper `unlockPlaceIfGuardian(admin, userId, sessionId, pinId)` → legge pin.place_id, upsert unlock (skip se esiste), dispensa `unlock_bonus`, evento `place_unlocked`, ritorna `{placeName, drops}` per `enrichedReward.placeUnlocked`. Test unit helper. Commit.
- [ ] **A3** Admin: pin editors (MapPicker + sessions page) — select luogo per pin boss (`place_id`); session-pins API pass-through; scheda Luoghi admin gains campo `unlock_bonus` (json). Commit.
- [ ] **A4** Player: `/api/game/collezione` calcola `guardian: {present, unlocked}` per luogo (pin boss con place_id nella sessione corrente + player_place_unlocks); PlaceCard badge 🛡️/✅; ResultScreen boss mostra "Luogo liberato!" con drops. Tema campanella `place_unlocked`. Commit.

## Phase B — Pergamene
- [ ] **B1** Migration 066: `player_pergamene` + RLS + index. Push, types, commit.
- [ ] **B2** `src/lib/game/pergamene.ts`: `PERGAMENA_STEP_INTERVAL=250`, `MAX_PER_UPDATE=3`, `pergameneEarned(prevSteps, newSteps)` (crossings, cap) + unit test. Position route: dopo update steps, insert N righe + evento `pergamena_found` (one per batch) + `pergamene` nel JSON di risposta. Commit.
- [ ] **B3** `POST /api/game/pergamene/open` (aneddoto random non posseduto scoped, +3 gemme; fallback 10 gold; marca opened_at, 409 se niente da aprire) + `GET /api/game/pergamene` (count unopened). Route test (open grants + marks, empty 404/409, fallback). Commit.
- [ ] **B4** UI: Zaino sezione "Pergamene" (contatore, bottone Apri → modal reveal srotolo con describeDrop); toast mappa su `pergamene>0` nella risposta position (evento custom `wc:pergamena`); campanella `pergamena_found`. Commit.

## Phase C — Capipalestra
- [ ] **C1** Migration 067: `gym_holds` + RLS (select authenticated, no client writes). Push, types, commit.
- [ ] **C2** `src/lib/game/gym.ts`: `gymDefenseMultiplier(heldSinceIso, now)` (fresh +0.25 → −5%/h → floor −0.20), `gymAccruedGold(heldSinceIso, now)` (10/h, cap 240) + unit tests. Commit.
- [ ] **C3** Claim route (pin boss, `payload.gym === true`): salta il ramo "wonFight → return"; holder stesso → 409; applica `gymDefenseMultiplier` alle stats della lineup al fight create; risposta include `gym: {holderName, heldHours}`. Test route (holder blocked, defense modifier applied). Commit.
- [ ] **C4** Boss route vittoria: se pin gym → upsert gym_holds (nuovo holder, held_since=now); rendita al vecchio holder via dispenser gold + push + evento `gym_taken`. Commit.
- [ ] **C5** UI: map-pins GET include holder nickname per pin gym; BossApproachModal riga "🏰 Presidiata da X da N h" (o "Libera!"); campanella `gym_taken`; admin: checkbox "Palestra presidiabile" nel PinPayloadBoss. Commit.

## Phase D — Guide + verifica
- [ ] Guida giocatore: sezione "Territorio Vivo" (guardiani, pergamene, palestre). Guida admin: authoring (pin guardiano, unlock_bonus, gym flag).
- [ ] Suite completa (solo 9 noti) + typecheck 0 + smoke browser pagine toccate. Commit + merge checkpoint.

## Self-review
- Spec A→A1-4, B→B1-4, C→C1-5, D. Coperto.
- Rischi: C3 tocca il claim route (pre-checks boss) — test esistenti come rete; B2 tocca position route (hot path) — insert best-effort non bloccante.
