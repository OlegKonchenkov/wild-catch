# Daimon — Valutazione finale (2026-04-30)

Snapshot dello stato del progetto dopo la sessione di hardening
(animazioni, vulnerabilità, performance map/encounter).

## Il prodotto in numeri

- 86 pagine (29 utente + admin)
- 58 endpoint API
- 26 migrazioni DB
- 13 sezioni di gioco (mappa, bestiario, missioni, duelli, boss, enigmi,
  backpack, shop, profilo, guida, ...)
- 5 elementi × 6 rarità — sistema di creature ricco
- ~37k righe di codice TS/TSX

Per essere il progetto di un singolo dev è un'ambizione enorme già consegnata.
Daimon è un Pokémon GO outdoor con quest, duelli PvP real-time, boss fight,
enigmi, sistema di crescita, evoluzioni, leaderboard, shop in-game, QR fisici.

## Cosa va davvero bene

### Architettura tecnica

- Stack moderno e ragionato: Next.js 16 App Router + Supabase + Vercel.
  Nessun over-engineering.
- Separazione logiche chiara: `src/lib/game/{rng,combat,leveling,anti-cheat,
  missions}` — pure functions testabili. Logica di gioco già unit-testata.
- Realtime usato bene sui duelli (channel + presence) — non polling.
- Server-authoritative: combattimenti, RNG creature, claim pin avvengono
  lato server. Niente cheat banali via DevTools.
- RLS Supabase configurate in migrazione 002 — sicurezza by-default.
- Anti-replay sui pin con tolleranza GPS, controllo distanze server-side.
- Sistema di sessioni a tempo con `pg_cron` per chiusura automatica —
  pensato per eventi reali.
- PWA scritta a mano, pulita e funzionante. Ottima scelta vs `next-pwa`.

### UX / gameplay

- Onboarding GPS+camera con istruzioni iOS/Android specifiche.
- Loading skeletons curati (`GameMapSkeleton`) — nessuna pagina bianca.
- Hatch animation, victory overlay, attack animations curate.
- Messaggi rotanti ("Lancio la rete!", "Si è liberata con un balzo!").
- Map markers con bearing che ruotano in direzione di movimento.
- Auto-attack su timer scaduto in duelli/boss — evita stalli.
- Reconnection grace di 60s sui duelli — gestisce GPS che cade.
- Side quest variate (cattura/duello/QR/walk/collect).
- Sistema enigmi con frammenti collezionabili — meccanica originale.

### Bilanciamento

- Curva EXP: 30→860 esp tra livello 2 e 20, plateau dopo. Pensata per
  evento di 2h.
- Catch rate: 70% comune → 1.25% mitologico. Ragionevole.

## Cosa migliorare

### Tecnico

1. **`isValidGPSSpeed` non è usato.** Definito in `anti-cheat.ts:40` ma
   chiamato solo dai test, NON da `/api/game/position`. Un giocatore può
   spoofare il GPS e camminare a 1000 km/h senza venire fermato.
   Check attuale: solo `distanceMoved < 500m` per step — facile da bypassare.

2. **Mancano indici DB su tabelle calde**:
   `player_eggs(user_id, session_id, hatched_at)` e poco altro. Non urgente
   per 100 player, da fare a 300+.

3. **N+1 in `/api/game/map-pins`** per pin enigma — già diagnosticato.
   ~30 min di refactor quando ci sarà tempo.

4. **`/api/game/encounter/start` carica `creatures` due volte** — la seconda
   solo per `attack_sound_url`. Era safety net per migrazione 018, ora
   superflua.

5. **Map page = 2156 righe in un file solo.** Estrarre `EggHatchModal`,
   `BossApproachModal`, `EnigmaModal`, `PinRewardModal` in file separati.

6. **`player_eggs` non è in nessuna migrazione** ma è usata ovunque.
   Tech debt: sembra creata via Supabase Studio. Aggiungere migrazione
   retroattiva con `CREATE TABLE IF NOT EXISTS`.

7. **494 `any` nel codice** + pattern `(x as any)` ricorrente. Soluzione:
   `supabase gen types typescript` per generare tipi DB automaticamente.

### Gameplay / bilanciamento

8. **`armonia` è strettamente superiore agli altri elementi**: +50% vs
   tutti, gli altri solo vs uno. Da bilanciare: rendere triangolo ciclico
   (es. armonia debole vs terra).

9. **Loop principale ripetitivo**: cammina → incontra → cattura. Manca un
   filo narrativo: perché sto cacciando? Cosa cambia man mano che vado avanti?

10. **Niente feedback audio sui passi/movimento.**

11. **Sistema di squad opaco**: nessuna UX per consigliare squad
    bilanciate, mostrare counter/synergie.

12. **Niente notifiche push** — il giocatore deve tenere l'app aperta.

13. **Manca un sistema di trade tra giocatori** — molto richiesto in games
    tipo Pokémon.

## Cosa svilupperei dopo, in ordine di valore

### Sprint 1 — Fix tecnici (1-2 giorni)

- Connettere `isValidGPSSpeed` in `/api/game/position` (anti-cheat reale)
- Generare tipi Supabase con `supabase gen types` → eliminare metà dei `any`
- Migrazione retroattiva per `player_eggs`
- Spezzare `map/page.tsx` in file più piccoli

### Sprint 2 — Bilanciamento (mezza giornata)

- Rivedere `armonia`: triangolo ciclico
- Indicatore "⚡ Vantaggio elemento" in encounter quando matchup favorevole
- Indicatore "consigliata" nella selezione squad

### Sprint 3 — Engagement (1 settimana)

- Push notifications via Web Push API (PWA-friendly)
- Filo narrativo: 5-7 step di onboarding con personaggio guida
- Social feed in home
- Daily streak + ricompensa giornaliera

### Sprint 4 — Nuove meccaniche (1-2 settimane)

- **Trading**: scambio creatura via QR tra giocatori vicini
- **Co-op boss**: 2-3 giocatori contro lo stesso boss
- **Eventi globali**: "Migrazione di Mitologici" tra le 18-19 (pg_cron)
- **Customizzazione avatar**: cosmetics sbloccabili con gold

### Sprint 5 — Crescita / monetizzazione

- Upgrade Supabase Pro (~$25/mese) → 500+ utenti contemporanei
- Vercel Pro (~$20/mese) → analytics + build minutes
- Sentry per error tracking
- A/B testing su onboarding (PostHog)
- Storefront cosmetics

## Verdetto

- **Tecnicamente**: livello professionale, sopra molti progetti commerciali.
- **Gameplay**: buono, con margini chiari su engagement long-term e
  bilanciamento.
- **Per evento 100 utenti**: pronto. Nulla di bloccante.
- **Per crescita oltre l'evento**: 2-3 mesi di sviluppo (Sprint 1-4) prima
  della fase growth/monetizzazione.
