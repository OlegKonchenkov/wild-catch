# Wave 3 — Social & Meta: Amici, Gruppi, Evoluzione GOLD, Scambi

**Date:** 2026-07-03 · **Status:** Approved (scope dal checkpoint Wave 1/2; decisioni v1 documentate qui)
**Context:** DAIMON.docx — livello social (amici, classifica privata classe/istituto, scambi) + evoluzione GOLD alla 3ª copia.

## Decisioni v1

| Tema | Decisione |
|---|---|
| Amici | **Globali** (cross-sessione), su `profiles.nickname`: richiesta per nickname esatto → accetta/rifiuta. Rifiuto = riga eliminata. |
| Gruppi (classe/istituto) | Globali; **creati dall'admin** (nome → codice join); i giocatori entrano col codice dal Profilo. La classifica di sessione guadagna i filtri **Amici** e **Gruppo**. |
| Classifica mensile | **Rimandata** (richiede snapshot punteggi periodizzati — futura wave). |
| Evoluzione GOLD | Alla **3ª copia**: forgia consumando **2 copie + 25 gemme** → `is_gold`. Bonus: **+10% delle stats base** applicato dentro `getEquipmentBonuses` (un solo hook → vale in tutti i combat mode). Badge dorato nel DaimonDex. |
| Scambi | **Solo tra amici, stessa sessione, solo doppioni** (chi offre resta sempre con ≥1 copia). Accettazione **atomica via RPC Postgres** (`execute_trade`). |

## A. Amici
- `friendships (id, requester_id, addressee_id, status 'pending'|'accepted', created_at, responded_at, UNIQUE(requester_id, addressee_id))`; RLS: visibile alle due parti; insert requester; update addressee.
- API: `GET /api/game/friends` (friends + pendingIn/pendingOut, con nickname/avatar); `POST /friends/request {nickname}` (no self, no dup nei due versi, push all'invitato); `POST /friends/respond {requestId, accept}` (solo addressee; rifiuto elimina).
- UI: sezione **Amici** nel Profilo (lista, richieste in arrivo con accetta/rifiuta, aggiungi per nickname).

## B. Gruppi + filtri classifica
- `groups (id, name, code UNIQUE, created_by, created_at)` + `group_members (group_id, user_id, UNIQUE)`; RLS: select per membri (e admin), join via API.
- API: `POST /api/game/groups/join {code}`, `POST /leave`; admin CRUD via catalog o route dedicata + pagina admin (nome → codice generato).
- Leaderboard: parametro `filter=friends|group` — interseca i player della sessione con amici accettati / membri del mio gruppo.
- UI: pill filtro nella classifica ("Tutti · Amici · Gruppo"); sezione Gruppo nel Profilo (entra col codice / esci / nome gruppo).

## C. Evoluzione GOLD
- Migration: `player_creatures.is_gold BOOLEAN NOT NULL DEFAULT FALSE`.
- `POST /api/game/creature/forge-gold {playerCreatureId, sessionId}`: guardie (possesso, `duplicates_count ≥ 3`, `!is_gold`, `gemme ≥ 25`), deduzione gemme con lock ottimistico, `duplicates_count −2`, `is_gold = true`, evento `gold_forged`.
- Combat: `getEquipmentBonuses` legge `is_gold` + stats base → aggiunge `+round(10%)` a hp/atk/def (vale per incontri, boss, duelli senza toccare i singoli flussi).
- UI DaimonDex: bordo/badge GOLD; bottone "Forgia GOLD (2 copie + 25 💎)" quando idoneo; campanella `gold_forged`.

## D. Scambi
- `trades (id, session_id, proposer_id, recipient_id, proposer_creature_id, recipient_creature_id, status 'pending'|'accepted'|'declined'|'cancelled', created_at, responded_at)`; RLS select alle due parti.
- RPC `execute_trade(p_trade_id, p_user_id)` (SECURITY DEFINER, transazionale): verifica pending + recipient, entrambe le parti possiedono ≥2 copie della creatura offerta, swap (`−1` dup a chi cede, `+1`/insert a chi riceve), status accepted. Ogni violazione → eccezione → nessun cambiamento.
- API: `GET /api/game/trades`, `POST /trades/propose {friendId, offerCreatureId, requestCreatureId, sessionId}` (valida amicizia + doppioni di entrambi), `POST /trades/respond {tradeId, accept}` (accept → RPC), `POST /trades/cancel`.
- UI: nel Profilo/Amici, "Proponi scambio" su un amico → scegli un tuo doppione e uno dei suoi (API dedicata elenca i doppioni dell'amico nella sessione corrente); pannello proposte con accetta/rifiuta. Push su proposta e accettazione. Eventi `trade_completed`.

## E. Guide + verifica
Sezioni giocatore (Amici & Scambi, GOLD) e admin (Gruppi). Suite: solo i 9 falliti noti; typecheck 0; smoke.

## Fuori scope
Classifica mensile (snapshot), scambio oggetti/collezionabili non-creature, chat.
