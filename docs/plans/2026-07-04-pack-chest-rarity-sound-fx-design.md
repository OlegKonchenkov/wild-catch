# Design: suoni ed effetti per rarità su bustine e forzieri

## Problema

`PackOpenModal.tsx` e `ChestOpenModal.tsx` non hanno alcun suono agganciato: né sul
tap che apre la bustina/forziere, né sul burst/unlock, né sul reveal dei singoli
drop. Il gioco ha già un sistema audio maturo e sintetizzato via Web Audio API
(`src/lib/game/sounds/`), con un precedente diretto per "suono scalato per
rarità": `hatch.ts`'s `playEggHatch(rarity)`, usato da `EggHatchModal.tsx`.

## Obiettivo

Aggiungere audio + un boost visivo per le rarità alte, riusando il pattern
esistente, per:
1. Il tap di apertura (strappo bustina / sblocco forziere) e i tap correlati
   nel flusso (selezione in lista, bottone finale).
2. Il burst/unlock, scalato sulla rarità della bustina/forziere stessi.
3. Il reveal di ogni drop, scalato sulla rarità del singolo oggetto trovato.

## Modulo sonoro — `src/lib/game/sounds/pack-open.ts`

Nuove funzioni, stesso stile di `hatch.ts`/`events.ts` (oscillatori sintetizzati
via `getSharedAC`/`getSoundStartTime`, nessun file audio esterno):

- `playPackTear(rarity?)` — strappo carta + crack sigillo di ceralacca, al tap
  che apre la bustina (fase `sealed → burst`).
- `playPackBurst(rarity?)` — boom + shimmer sincronizzato col flash/shockwave
  esistente, scalato sulla **rarità della bustina**.
- `playChestUnlock(rarity?)` — chiave + cigolio + "clunk" del coperchio,
  scalato sulla **rarità del forziere** (fase `locked → unlocking`).
- `playDropReveal(rarity?)` — suono breve per ogni drop rivelato: click leggero
  per drop senza rarità (oro, exp, gemme, abilità...), sparkle crescenti per
  comune → mitologico. Riserva solo ~0.12s nella coda audio condivisa (come
  `playUiTap`) per restare sincronizzato con lo stagger visivo di 140ms tra le
  card, senza accumulare ritardo nel tempo.

Per i tap generici (selezione bustina/forziere in lista, bottone finale
"Fantastico!"/"Continua") si riusa `playUiTap()` già esistente in `ui.ts` — non
serve una nuova funzione.

## Rarità dei singoli drop — refactor condiviso

`describeDrop()` in `loot-visuals.tsx` calcola già l'accent-color dalla rarità
per `oggetto`/`uovo`/`creatura`/`personaggio`/`opera`. Si aggiunge un campo
`rarity?: Rarity` a `LootView`, popolato ovunque esista già `rarityAccent(...)`,
così colore, suono ed effetto extra leggono la stessa fonte senza duplicare la
logica di estrazione rarità.

## Integrazione nei modal

- `PackOpenModal.tear()`: chiama `playPackTear(pack.rarity)`, poi
  `playPackBurst(pack.rarity)` non appena la fase passa a `burst` (sincrono col
  flash esistente).
- `ChestOpenModal.unlock()`: chiama `playChestUnlock(chest.rarity)` non appena
  la fase passa a `unlocking`.
- Sul `motion.div` del flip di ogni drop-card si aggiunge
  `onAnimationStart={() => playDropReveal(v.rarity)}` — usa il callback nativo
  di Framer Motion, che rispetta il `delay` già impostato nella `transition`,
  così il suono parte esattamente quando la card comincia a girarsi senza
  bisogno di `setTimeout` paralleli da tenere sincronizzati a mano.
- Backpack list (`src/app/game/backpack/page.tsx`): `playUiTap()` aggiunto agli
  `onClick` che invocano `handleOpenPack`/`handleOpenChest`.
- Bottone finale "Fantastico!"/"Continua" dentro i due modal: `onDone` viene
  wrappato per chiamare anche `playUiTap()`.

## Boost visivo per rarità alte (epico / leggendario / mitologico)

- **Bustina/forziere stessi**: se `rarity` è epico+, il burst/unlock aggiunge
  un secondo anello d'onda concentrico e un flash bianco più intenso (stessa
  tecnica già presente, raddoppiata).
- **Drop trovati**: se il drop ha rarità epico+, all'`onAnimationStart` scatta
  anche un breve overlay "sparkle burst" dietro la card (anello radiale che si
  espande e sfuma in ~350ms), oltre al glow-colore già esistente via
  `v.accent`; per mitologico, in aggiunta un lampo dorato molto breve su tutto
  lo schermo.

## File toccati

- `src/lib/game/sounds/pack-open.ts` (nuovo)
- `src/components/game/loot-visuals.tsx`
- `src/components/game/PackOpenModal.tsx`
- `src/components/game/ChestOpenModal.tsx`
- `src/app/game/backpack/page.tsx` (solo i due `onClick` di lista)

## Fuori scope

`DailyRewardModal.tsx` ha lo stesso gap audio ma non è una "bustina" — non
richiesto in questo giro, possibile follow-up separato.
