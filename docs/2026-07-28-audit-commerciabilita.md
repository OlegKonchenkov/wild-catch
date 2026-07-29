# Daimon — Audit di commerciabilità (2026-07-28)

Analisi su 4 assi: logica/funzionale, UI/grafica/animazioni, information
architecture (Agenda/eventi), readiness commerciale.

Baseline tecnica verificata: **821/821 test verdi (117 file), `typecheck` exit 0**.
Nessuna regressione. `docs/2026-04-30-final-assessment.md` è in parte superato
(Armonia non è più ×1.5) e in parte ancora aperto (`isValidGPSSpeed` tuttora
scollegata, `src/lib/game/anti-cheat.ts:40`).

---

## STATO — Pacchetto 1 applicato

Il "Pacchetto 1" di §7 (Fase 0 + i sistemi morti) **è stato implementato**.
Suite dopo l'intervento: **856/856 verdi (119 file)**, typecheck pulito.

| Voce | Stato |
|---|---|
| A1 `level_rewards` mai erogate | ✅ erogate, con ledger idempotente e UI nel modale |
| A2 Esca placebo | ✅ alza il rate di incontro (0.30 → 0.55) |
| A3 `priority` mai letto | ✅ rimosso da tipo, chip UI, form admin, API |
| A4 `hall_of_fame` mai letta | ✅ endpoint + Albo d'oro nella Classifica |
| B1 exp/oro piatti | ✅ scalati per rarità |
| B2 creature non scoped | ✅ spawn pool, starter e DaimonDex per sessione |
| B4 Armonia senza debolezza | ⛔ **non è un bug** — scelta di design confermata dall'owner: Armonia è l'elemento speciale, forte su tutti (+15%) e counterabile da nessuno. Il chart è ora documentato e coperto da test che ne fissano l'intento (netto ~+12% vs 0.97 dei quattro del ciclo). La leva di bilanciamento è la disponibilità delle creature armonia, non il moltiplicatore |
| B5 costanti crit duplicate | ✅ `rollCrit()` condiviso |
| E1/E3/E4/E7/E8, F1, J4 | ✅ tutti applicati |

---

## STATO — Pacchetto 2 applicato

Suite dopo l'intervento: **894/894 verdi (120 file)**, typecheck pulito.

| Voce | Stato |
|---|---|
| B3 due formule di danno | ✅ attacco base, contrattacco selvatico, cattura e switch passano tutti da `calculateCombatDamage`. Break-even ora esattamente `power = 1`, indipendente dalla DEF |
| B3b power abilità | ✅ unificare le formule ha risolto 28/29 casi da solo; solo Colpo Rapido è stato ricalibrato (0.7 → 1.15 @ 95% precisione) |
| H1a scaling di livello | ✅ `scaleCombatStats` in start/fight/switch, livello congelato sull'incontro |
| H1c fuga gratuita | ✅ cooldown di 20s sul roll dell'incontro, applicato anche su `/encounter/start` |
| H2 abilità irraggiungibili | ✅ tail compresso su 11–14 (soffitto ≈ 2.880 EXP) |
| A5 bonus `evento` | ✅ tre effetti reali (exp_boost, gold_rain, spawn_boost) con moltiplicatore + durata, form admin strutturato e badge HUD |
| **H1b HP persistenti** | ⏸️ **escluso su richiesta** — da valutare più avanti |

---

## STATO — Compliance (sezione C) applicata

Suite dopo l'intervento: **913/913 verdi (122 file)**, typecheck pulito.
Migrazioni 073–082 applicate al progetto Supabase linkato.

| Voce | Stato |
|---|---|
| C1 cancellazione account rotta | ✅ migrazione 082 riscrive dinamicamente ogni FK verso `auth.users` (NOT NULL → CASCADE, nullable → SET NULL). 20 vincoli corretti in produzione; un guard in coda alla migrazione fallisce se ne resta anche uno bloccante |
| C2 nessun age gate | ✅ anno di nascita richiesto all'adesione, soglia 14 anni (art. 8 GDPR + art. 2-quinquies), consenso genitoriale sotto soglia, `gdpr_consent_minor` finalmente scritta. L'anno **non** viene conservato |
| C3 nessuna pagina legale pubblica | ✅ `/privacy` e `/termini` pubbliche, linkate dal login. Testo unico condiviso con il modale in-app |
| C4 analytics senza consenso | ✅ PostHog non si inizializza finché il consenso non è dato; toggle revocabile nelle Preferenze; **email rimossa** da `identify()` |

**Restano aperti**: export dati (art. 20) e retention policy documentata;
revisione legale dei Termini (bozza, mai passata da un avvocato); login
alternativo a Google (OTP/magic link) — senza il quale i minori di 13 anni
restano tecnicamente esclusi da Google stesso; B6 `isValidGPSSpeed`, B7 tipi
missione, D (sblocco giocatore), F2/F3, e le sezioni G–J.

---

## 0. Verdetto

Il codice è **sopra la media professionale**: server-authoritative, RLS, realtime
sui duelli, logica di gioco in funzioni pure testate, PWA scritta a mano, Sentry
+ PostHog, suite verde. Non è questo il problema.

Il problema è che **tre cose non esistono ancora**, e sono esattamente le tre che
separano un progetto da un prodotto:

1. **Il gioco non esiste fuori da una sessione attiva.** Tutta la progressione è
   scoped a `session_id`: a evento chiuso il giocatore perde collezione, livello,
   oro, gemme, squadra. La retention D1 è strutturalmente ~0.
2. **Non c'è un design system.** 2.656 esadecimali hard-coded contro 16 usi dei
   token, 33 dimensioni tipografiche, 189 ricette d'ombra, ~10 "neri d'app"
   diversi. L'app sembra cinque app cucite insieme.
3. **Non c'è lo strato commerciale.** Zero pagamenti, zero multi-tenancy, nessun
   documento legale pubblico, e la cancellazione account è rotta.

Sotto, ogni punto con evidenza dal codice.

---

## 1. Il nodo strutturale: il modello a sessioni

Ogni endpoint di gameplay ha lo stesso gate `session.status !== 'active'` ⇒ 403:

- `src/app/api/game/encounter/start/route.ts:50`
- `src/lib/game/step-counter.ts:84` — i passi si contano solo se attiva
- `src/app/api/game/position/route.ts:157` — uova, missioni walk, pergamene
- shop `buy/route.ts:34`, duelli `duel/connect/route.ts:33`,
  daily `daily/claim/route.ts:26`, forge `forge-gold/route.ts:24`

E il possesso è per-sessione: `player_creatures`
(`supabase/migrations/001_initial_schema.sql:100`), `player_inventory`,
`player_sessions.level/exp/gold/gemme` (`src/lib/types.ts:123-136`),
`player_collection`, `player_packs`, `player_trophies`.

**Fuori da una sessione il giocatore non ha nulla da fare.** `/home` mostra la
lista sessioni storiche in sola lettura, il tutorial e il form codice invito.
Nessun free-roam, nessun DaimonDex globale, nessun profilo persistente.

`kind='avventura'` (`supabase/migrations/060_session_modes.sql`) è il tentativo di
risposta ed è implementato per metà: persistente e con daily/palestre/missioni
ricorrenti, ma richiede comunque **codice invito monouso per giocatore**
(`src/app/api/auth/join/route.ts:33-34`) e `area_bounds` disegnate a mano, e la
progressione resta per-sessione.

### Attriti d'ingresso, in ordine di brutalità

1. **Codice invito monouso** ⇒ zero acquisizione organica. Nessun link
   condivisibile riutilizzabile, nessuna sessione pubblica, nessun referral. Chi
   passa davanti a un poster non può entrare.
2. **Gemme = valuta premium senza rubinetto premium.** Zero occorrenze di
   Stripe/IAP/checkout in `src/`.
3. **Nessun i18n** (§6.4). Mercato = Italia.
4. **Nessun branding per cliente** (§6.3). Un evento brandizzato richiede un fork.

> **Decisione di prodotto, non intervento tecnico.** O si introduce un livello
> account-persistent sopra le sessioni (DaimonDex + livello Domatore + valuta
> globali, con le sessioni come stagioni che vi confluiscono) — **L** — oppure
> si accetta che il prodotto sia un servizio B2B per eventi, e allora servono
> tenancy, branding e i requisiti di §6.
>
> **Versione minima sbloccante (S, mezza giornata):** sessione `avventura`
> **pubblica** (`is_public` + join senza codice) con `area_bounds` opzionali —
> il codice già gestisce `{}` (`src/app/api/game/position/route.ts:77`,
> `src/lib/game/tutorial.ts:5`). Trasforma il prodotto da "solo su invito" a
> "scaricabile e giocabile".

---

## 2. Logica e gameplay — cosa è rotto

### 2.1 Cinque sistemi che l'admin configura e il giocatore non riceve mai

Tutti verificati con grep sul codice attuale.

| Sistema | Evidenza | Effetto |
|---|---|---|
| **`level_rewards`** — tabella + CRUD admin completo (`src/app/admin/level-rewards/page.tsx`, `src/app/api/admin/level-rewards/route.ts`) | **nessun file fuori da `admin/` e `types/database.ts` la nomina**. Il level-up dà solo `15 + random(26)` oro (`supabase/migrations/052_gemme_currency.sql:63`) | L'admin configura ricompense di livello che non arrivano mai |
| **Esca** — `src/app/api/game/item/use/route.ts:61` scrive `esca_active_until`; `src/app/game/map/page.tsx:846` ne mostra il countdown | **nessun endpoint di spawn/encounter legge mai quel campo**. Il roll resta fisso `0.30` | Oggetto **placebo**, venduto nello shop e regalato dal tutorial |
| **`priority`** delle abilità — dichiarato `src/lib/game/abilities.ts:35`, valorizzato nel seed | **mai letto da nessun risolutore** (encounter/duel/boss). Compare solo come campo fixture nei test | "Colpisce sempre per primo" è **falso**, ed è l'abilità-premio del tutorial |
| **`hall_of_fame`** — popolata a fine sessione (`src/app/api/admin/session/close/route.ts:54`) | **mai letta da nessuna pagina** | Manca la cerimonia di chiusura evento — il momento più vendibile in B2B |
| **Ricompensa `evento`** (EXP ×2 / spawn boost / gold rain) — autorabile su QR e pin (`src/components/admin/PinPayloadForms.tsx:390-403`) | server fa solo passthrough (`src/lib/game/rewards/dispense.ts:147-149`); nessun moltiplicatore applicato | Intera categoria di "eventi speciali" inesistente |

> **Fix: M complessivo** (somma di 5 interventi S). Ognuno è una promessa rotta;
> insieme sono la differenza tra "sembra ricco" e "è ricco".

### 2.2 Gli incentivi del loop sono invertiti

`src/app/api/game/encounter/catch/route.ts:303-307`:

```ts
const expGain   = existing ? 5  : 15
const goldGain  = expGain              // gold mirrors EXP
const scoreGain = existing ? 5  : 15 * rarityMult
```

**EXP e oro sono piatti.** Un mitologico (catch rate base 1,25%,
`src/lib/types.ts:269`) dà gli stessi 15 exp e 15 oro di un comune (70%). Solo lo
`score` da classifica scala con la rarità.

⇒ Economicamente **conviene farmare comuni**: 70% × 15 batte 1,25% × 15 di un
fattore 56. L'intero incentivo alla caccia rara è annullato.

> **Fix (S, 30 min):** `expGain = 15 * rarityMult`, `goldGain` idem.

### 2.3 Il loop non ha stakes

- **Fuga gratuita** — `src/app/api/game/encounter/flee/route.ts:18-23`: nessuna
  penalità, nessun costo, nessun cooldown.
- **Cura totale ad ogni incontro** — `encounter/start/route.ts:213` scrive
  `player_hp: primaryCreatureMaxHp`. Gli HP non persistono ⇒ pozioni quasi
  inutili, squadra da 3 quasi inutile (basta lo slot 0), perdere non costa nulla.
- **Il livello non entra nel loop principale** — `encounter/fight/route.ts:95-97`
  usa `base + equip` **senza `scaleCombatStats`**, mentre duelli e boss sì
  (`duel/connect/route.ts:68`, `boss/[id]/route.ts:454`). Ma salendo di livello
  aumentano i pesi delle rarità alte (`src/lib/game/rng.ts:72-79`) ⇒ **nemici più
  forti, giocatore identico**. La curva di difficoltà è *invertita*.

> **Fix (M, ~1 giornata):** far passare `encounter/fight|switch|heal` da
> `scaleCombatStats`; far persistere `player_hp` tra incontri con reset su
> daily/pozione/pin "fonte".

### 2.4 Il 45% delle abilità d'attacco è peggio del tasto ATTACCA

Due formule di danno incompatibili convivono:

- Attacco base: `calculateFightDamage(atk) = round(atk × U(0.8,1.2))` —
  `src/lib/game/rng.ts:133-135`. **Nessuna mitigazione DEF.**
- Abilità: `calculateCombatDamage` con `mitigation = 120/(120+def)` —
  `src/lib/game/combat.ts:131`.

Con DEF 40 la mitigazione è 0.75 ⇒ un'abilità deve avere potenza efficace ≥ 1.33
solo per pareggiare l'attacco gratuito. Sulle 29 abilità `attacco` del seed
(`supabase/migrations/050_abilities_seed.sql`): **13/29 fanno meno danno del
semplice tasto ATTACCA** (16/29 a DEF 60).

Le peggiori: `Colpo Rapido` **0.70**, `Colpo Paralizzante` 0.85, `Morsa Gelida`
0.95 (lv24), `Assorbimento` 0.95, `Vampata` 1.04 (lv14).

**Il colpo di grazia:** `Colpo Rapido` (eff. 0.70) è l'abilità che il tutorial
regala come premio della missione M4 (`src/lib/game/tutorial.ts:95-101`). La sua
unica giustificazione sarebbe `priority: 1`, che non viene letto da nessuno
(§2.1). Il primo "potere speciale" che il gioco insegna è un **downgrade del 30%
con una descrizione falsa**.

> **Fix (M, mezza-una giornata):** (a) far passare anche l'attacco base da
> `calculateCombatDamage` — rende DEF ed equipaggiamento sensati ovunque;
> (b) ricalibrare le power sopra il break-even; (c) implementare `priority`
> nell'ordine dei turni o rimuoverlo da UI e seed.

### 2.5 Armonia è ancora dominante

`src/lib/types.ts:255-261`: 4 elementi in ciclo ×1.5, Armonia ×1.15 su tutti e
**nessuna debolezza** (`src/lib/game/elements.ts:35-42` esclude gli "universal
attacker" dall'inverso).

Contro un pool uniforme dei 5 elementi:

| | Mult. medio in attacco | Mult. medio subìto | Netto |
|---|---|---|---|
| Fiamma / Adriatico / Bosco / Terra | 1.10 | 1.13 | 0.97 |
| **Armonia** | **1.12** | **1.00** | **1.12** |

~15% netto meglio e **immune al counterpick**.

> **Risolto come "non è un bug".** Decisione dell'owner (29/07): Armonia *deve*
> restare forte contro tutti a +15% e senza debolezze. Non è il quinto angolo
> del ciclo, è l'elemento speciale — la sua superiorità è voluta, e la leva per
> bilanciarla è la **disponibilità** delle creature armonia (`spawn_weight`,
> rarità), non il moltiplicatore.
>
> Il chart resta quindi invariato, ma ora è documentato in
> `src/lib/types.ts:246` e fissato da test espliciti
> (`src/lib/game/__tests__/elements.test.ts`, describe *"armonia is deliberately
> the strongest type"*) che pinnano il netto ~+12% contro lo 0.97 dei quattro
> del ciclo — così nessuno lo "corregge" per sbaglio in futuro.

### 2.6 Le creature "esclusive" non sono esclusive

`creatures` ha una colonna `session_id` (`src/types/database.ts:366`) e il form
admin la espone (`src/app/admin/creatures/page.tsx:73`), **ma il pool di spawn la
ignora**:

```ts
// src/lib/game/config-cache.ts:23-31
export async function getSpawnableCreatures() {
  return memo('creatures-spawnable', async () => {   // ← cache key globale
    ...
    .from('creatures').select(...).eq('spawnable', true)   // ← nessun filtro
```

Idem `getStarterCreatures()` (`:35-45`) e il DaimonDex client
(`src/app/game/bestiary/page.tsx:157-163`).

⇒ Le creature del Festival X **spawnano anche alla Sagra Y**, e ogni giocatore
vede nel DaimonDex l'intero catalogo di tutti gli eventi mai creati come "non
catturate". Rompe il senso di completamento *e* la promessa commerciale
"creature dedicate al tuo territorio".

> **Fix (S, mezza giornata):** `getSpawnableCreatures(sessionId)` con
> `.or('session_id.eq.X,session_id.is.null')` — il pattern esiste già
> (`scopedSessionOrFilter`, `src/lib/game/tutorial.ts:20`) — **e cache key
> per-sessione**, oggi il memo è globale. Stesso filtro sul DaimonDex.

### 2.7 Curva EXP: il 38% delle abilità è irraggiungibile

`src/lib/game/leveling.ts:1-9`: cumulata a L20 = **7.055 exp**. Un evento da 2 h
(~70 catture + missioni) porta a **L9-11**.

Distribuzione `min_level` sulle 50 abilità del seed:

| Fascia | # abilità | Raggiungibile in evento 2 h? |
|---|---|---|
| lv 1–12 | 23 | sì |
| lv 13–19 | 8 | al limite |
| **lv ≥ 20** | **19 (38%)** | **no** — servono ~470 catture |

> **Fix (S, 2 ore):** ricomprimere la curva sotto L20, o rendere `min_level` una
> percentuale del cap di sessione. Sblocca il 38% del contenuto già scritto.

### 2.8 Sistemi sociali: presenti ma non attivabili

| Sistema | Limite |
|---|---|
| **Duelli** | Solo room code a 4 caratteri (`duel/connect/route.ts:80-137`). Nessun matchmaking, nessuna sfida ad amico, nessun asincrono. Due persone devono scambiarsi un codice a voce |
| **Amici** | Ricerca **solo per nickname esatto** (`friends/request/route.ts:22-26`). Nessun QR — benché `jsqr` sia già una dipendenza |
| **Scambi** | Richiedono amicizia + stessa sessione + **≥2 copie per entrambi** (`trades/route.ts:67-78`). In un evento da 2 h la probabilità è ~zero |
| **Palestre** | L'unico sistema con vera pressione sociale asincrona (rendita 10 oro/h, cap 240, push allo spodestato). **Ma si attiva scrivendo `{"gym": true}` a mano nel `reward_payload` di un pin boss** (`src/lib/game/gym-victory.ts:38`). Nessuna UI |
| **Co-op** | Assente. `boss_fights` è single-player |
| **Viralità** | Nessuno share, nessun referral, nessun deep-link riutilizzabile |

### 2.9 Retention: manca il gancio D1

Le push esistono (`src/lib/push.ts`) ma sono solo **reattive** (missione
completata, level up, spodestato) più il cron di fine sessione
(`src/app/api/cron/session-reminders/route.ts:7` — soglie 30/10/1 min prima della
**fine**, cioè il contrario di un richiamo di ritorno).

> **Fix (S, mezza giornata — miglior ROI su D1):** cron giornaliero "daily non
> riscosso / streak a rischio / uovo schiuso / palestra sotto attacco". Riusa
> `sendPushToUser`. Più una UI dedicata alle palestre.

### 2.10 Onboarding: si chiede tutto prima di dare qualcosa

Percorso reale: login Google → nickname (bloccante) → consenso GDPR → codice
invito 8 caratteri → 5 slide (`src/app/game/onboarding/page.tsx:414`) con
**permessi GPS+camera bloccanti** (`:524`) → StarterSelect → prima missione:
**camminare 30 metri**.

~4 form/consensi e ~12-15 tap prima della mappa, poi una camminata fisica prima
del primo incontro garantito. **L'utente concede geolocalizzazione e fotocamera
prima di aver visto un singolo Daimon.** Se piove, se sei sul divano, il gioco
non parte.

> **Fix (S):** primo incontro *scriptato* nei primi 20 secondi senza requisito di
> cammino; permessi richiesti **dopo** la prima cattura; primo premio
> un'abilità che si vede essere più forte.

### 2.11 Altri

- **Anti-cheat passi disattivato per scelta** (`position/route.ts:30-31`: *"Anti-cheat
  is explicitly out of scope"*). Il totale passi è adottato dal client (`:119-130`)
  con +60 m di slack. Uova, missioni walk, pergamene e classifica passi sono
  falsificabili da DevTools — **e ci sono premi fisici riscattabili**
  (`player_prizes`). Fix S: clamp stretto sui soli reward gated.
- **`isValidGPSSpeed` ancora scollegata** (`src/lib/game/anti-cheat.ts:40`),
  segnalata il 30/04.
- **Tipi missione mancanti in admin**: `MISSION_TYPES` ha 5 voci
  (`src/app/admin/missions/page.tsx:33-78`); mancano `enigma` (esiste
  server-side, `enigmi/solve/route.ts:181`), `boss`, `quiz`, `collezionabile`.
  Un admin non può creare missioni su due dei tre pilastri del gioco.
- **Costanti crit duplicate**: `encounter/fight/route.ts:284-285` hardcoda
  `0.10`/`1.75` invece di `CRIT_CHANCE`/`CRIT_MULTIPLIER` (`combat.ts:21-22`).

### 2.12 Authoring: il collo di bottiglia di scala

Per un evento credibile servono 30–50 creature, 15–30 pin georeferenziati
**piazzati uno per uno cliccando sulla mappa** (`admin/session-pins/route.ts:35`),
10–20 QR, 10–20 missioni, 3–5 enigmi, più la collezione culturale (5 CRUD
separati). Nessun import GeoJSON/CSV, nessun clone da evento precedente, nessun
preset di stat per rarità (default fisso 50/10/5). L'unico assist AI è la
generazione immagine (`src/lib/ai/generateImage.ts`).

> **Fix (M):** "duplica sessione" (clona creature+missioni+pin+enigmi con offset
> geografico) + import CSV/GeoJSON dei pin + preset di stat per rarità. È la
> differenza tra un evento al mese e dieci in parallelo.

---

## 3. UI, grafica, animazioni

Ci sono **isole di eccellenza reale** — `src/components/battle/animations/*`
(~1.940 righe di VFX elementali con traiettorie e timing per rarità),
`PackOpenModal`, `GameMapSkeleton`, `GameTopBar` (scudo araldico SVG),
`DaimonSplash`, `CreatureSprite` con idle desincronizzato. Chi ha scritto queste
cose sa fare game UI.

Il problema è che quella qualità **non è distribuita**: convive con schermate di
sconfitta fatte di emoji e testo a 8px al 30% di opacità. *Un compratore giudica
dal minimo, non dalla media.*

### 3.1 Il design system esiste ma è morto

`src/app/globals.css:14-46` definisce 24 token `--wc-*`. Usati: **16 occorrenze
totali su 3 soli token**. `.wc-plate`, `.wc-glow-gold`, `.wc-glow-cyan`: **0 usi**.

Contro: **2.656 esadecimali** e **1.849 `rgba()`** in `src/`, per **422 hex
unici**, e **1.669 oggetti `style={{}}` inline su 107 file**.

Il commento in `globals.css:11-12` ("Legacy hardcoded hex stays untouched
(additive only)") spiega perché: il design system è stato aggiunto *accanto* al
codice, mai *dentro*.

**Bug concreto:** `src/app/game/backpack/page.tsx:723` usa
`border: '1px solid var(--wc-line)'` — **`--wc-line` non è definito da nessuna
parte** (verificato: il grep trova solo l'uso). La dichiarazione viene scartata:
quel bordo non esiste.

### 3.2 I numeri

| Metrica | Valore |
|---|---|
| Font-size uniche | **33** (da 7px a 88px), su 1.227 dichiarazioni |
| Dichiarazioni sotto i 12px | **336** su 475 px espliciti, + `text-xs` 623 volte |
| Pesi tipografici | 8 — di cui `font-bold`+ sul **93% del testo** |
| `boxShadow` inline unici | **189** (nessuna scala di elevazione) |
| Raggi | 6 classi Tailwind + 4 arbitrari + **19 valori inline distinti** |
| "Neri d'app" diversi | **~10** (6 sfondi pagina + shell + body + battle + skeleton) |
| Varianti d'oro | **6** (`#f7c841`, `#fbbf24`, `#f3c233`, `#e8a820`, `#d4a96a`, `#e6c989`) |
| Emoji nell'UI di gioco | **266** (789 in tutto il `.tsx`), mescolate a ~500 icone `react-icons/gi` |
| `text-white/<50` | **305** occorrenze + 40 `rgba(255,255,255,<0.5)` |
| `aria-label` | **23** in tutto il gioco |
| `focus:outline-none` senza sostituto | **59** (contro 2 `focus-visible`) |
| File con `prefers-reduced-motion` | **4** su 68 che usano framer-motion |
| `repeat: Infinity` | **72** |
| `whileTap` | **37** in tutto il repo (centinaia di `<button>` senza feedback) |
| `React.memo` | **0** |

### 3.3 Due identità visive incompatibili

- **"outdoor/teal"** `#3ABCA8` + `#3A9DBC` — login, splash, mappa, onboarding
- **"Gilded Relic"** `#F7C841` oro + `#46BAD8` ciano — top bar, nav, panel, shop

`src/app/_components/Login.tsx:129-144` è tutto teal;
`src/components/ui/GameTopBar.tsx:135-138` è tutto oro. **La prima e la seconda
schermata del gioco non appartengono alla stessa app.**

Inoltre: payoff bilingue — splash *"Avventura outdoor"*
(`DaimonSplash.tsx:99`) vs login *"Adriatic Creature Hunt"* (`Login.tsx:295`).
E il logo non esiste: `Login.tsx:285-292` è un emblema SVG astratto (due linee
incrociate con pallini), non un marchio.

### 3.4 I buchi di animazione

| Momento | Stato |
|---|---|
| **Popup incontro selvatico** | `src/app/game/map/page.tsx:2087-2237` — **nessuna animazione**. Il momento centrale del gioco è un `<div>` statico che compare istantaneamente |
| **Transizione tra pagine** | `GameShell.tsx:826-836` fa `key={pathname}` + fade-in **senza `AnimatePresence`** ⇒ **lampo nero a ogni navigazione** |
| **Loading → contenuto** | Solo **2 `loading.tsx`** (root + map). **12 segmenti di gioco senza** ⇒ schermo congelato durante il round-trip |
| **Cambio tab** | Nessun `whileTap`, nessun haptic, nessun ripple |
| **Numeri che cambiano** | `CountUp` esiste ed è buono, usato in **2 posti**. HP, EXP, progressi missione, punteggi classifica: **saltano** |
| **Haptics** | `src/lib/haptics.ts` completo (9 pattern, testato) ma usato in **8 file**. Nav: 0. Modali reward: 0 |
| **Cattura** | Nessun **wobble pre-esito** (la tensione è *il* meccanismo di Pokémon) e **nessuna differenziazione per rarità**: catturare un mitologico ha lo stesso show di un comune |
| **Sconfitta encounter** | `encounter/[id]/page.tsx:2290` — **un emoji `💀` a `text-7xl`**, mentre boss e duel hanno regia curata |

### 3.5 Mobile-first: problemi reali

- **Safe area**: 9 usi totali. **Scoperti** ⇒ bottom sheet sotto la home-indicator
  iOS: `encounter/[id]:2095`, `encounter/[id]:2341` (**card risultato cattura**),
  `duel/[id]:1651`, `battle/AbilityMenu:34`, `collezione:294,381`, `missions:200`
- **Tap target < 44px**: `bestiary:709-715` = **16px** (rimuovi da squadra),
  `GameToast:83-88` = 20px, `GameTopBar:216` = 28px, `profile:295-300` ~18px
- **Contrasto**: `text-white/30` su `#0a1a26` ≈ **2.2:1** (WCAG AA richiede 4.5:1).
  **È un gioco da giocare camminando al sole**, con testo a 9px al 30% di opacità.
  Non è accessibilità: è **giocabilità**
- **Nav a 11 voci** che scrolla orizzontalmente su ogni telefono (§4)

### 3.6 Performance

- **`public/` pesa 7,0 MB.** `login-bg.webp` = **2,00 MB** ed è **precachato dal
  SW** (`public/sw.js:25`) ⇒ 2 MB scaricati prima ancora del login.
  `bgm.mp3` = 2,02 MB. Più `creatures-test/` (0,59 MB) e `icons/_backup/` in
  produzione
- **39 `<img>` grezzi** contro 6 file che usano `next/image` — tutti gli artwork
  Supabase senza ottimizzazione, `sizes` o lazy. `next.config.ts:6-10` ha già i
  `remotePatterns`: il lavoro è mezzo fatto
- **`priority` su ogni sprite** (`CreatureSprite.tsx:149`) ⇒ nella griglia
  DaimonDex fino a 60 immagini in preload simultaneo
- **I VFX di attacco animano `left`/`top` in percentuale** (14-15 occorrenze per
  file in `battle/animations/`). Sono proprietà di **layout**: ogni frame forza
  reflow + repaint, con 10-30 particelle, nel momento più sensibile del gioco.
  Fix contenuto: convertire `paths.ts` per restituire offset px e animare
  `transform`
- **Nessun `React.memo`.** `encounter/[id]` = 2.830 righe / 49 `useState`;
  `map` = 2.163 righe / 46 `useState` / 33 `useEffect`. Ogni fix GPS
  re-renderizza l'intero albero della mappa; ogni tick del timer re-renderizza
  la battaglia. **Causa più probabile dello stutter percepito**
- **~1.050 righe di UI legacy** ancora spedite su encounter+duel+boss dietro
  `NEXT_PUBLIC_BATTLE_LEGACY_UI` (`encounter:1526`)

### 3.7 Stati vuoti ed errori

20 empty state, quasi tutti "testo grigio centrato" (`shop:314`, `profile:332`,
`home:629`). Le due eccezioni curate — `bestiary:740-752` e `duel:535-543`
(icona in medaglione + CTA) — sono il pattern giusto da estendere.

`src/app/error.tsx` e `src/app/not-found.tsx` sono senza branding: sono le uniche
schermate fuori dal `GameShell`, e sembrano di un'altra applicazione.

**Bug:** `GameLoading.tsx:229` e `:253` mettono `animationDelay` sul
**contenitore** mentre `animate-pulse` è sui **figli** ⇒ lo stagger degli
skeleton non funziona.

---

## 4. L'Agenda: non è nascosta, non esiste

L'osservazione era corretta, ma la causa è più profonda del previsto.

### 4.1 Il futuro non è rappresentabile nel modello dati

`supabase/migrations/001_initial_schema.sql:38-49` — la tabella `sessions` ha
`start_at TIMESTAMPTZ` e `end_at`, **ma nessuna colonna `scheduled_start_at`**.
`start_at` viene scritto **solo nell'istante in cui l'admin preme START**
(`src/app/api/admin/session/start/route.ts:31-40`).

⇒ **Un evento "sabato alle 18" non è esprimibile.** Il campo dove scriverlo non
c'è. A cascata: `/api/game/sessions` restituisce `start_at: null`
(`route.ts:77`), la card in home mostra `'—'` (`home/page.tsx:638-640`), e
l'ordinamento per `start_at` mette tutte le sessioni future in fondo (`:88-92`).

Come fa oggi un giocatore a sapere che c'è un evento domani? **Fuori dall'app.**
WhatsApp, volantino, passaparola. L'app lo scopre quando l'admin preme START e
parte la push "🎮 La sessione è iniziata!" — cioè a evento **già cominciato**.

- **Countdown**: esiste solo verso la *fine* (`useSessionTimer` ← `endAt`)
- **Calendario / `.ics`**: zero
- **Push pre-evento**: `THRESHOLDS = [30, 10, 1]` sono **minuti prima della
  FINE** (`src/app/api/cron/session-reminders/route.ts:7`). Nessuna soglia
  pre-inizio esiste

### 4.2 E la porta d'accesso è l'11ª voce di 11

`src/components/GameShell.tsx:866` → `minWidth: 56, width: '${100/11}%'`.
A 11 voci, `9.09%` di 390px = 35px ⇒ vince `minWidth: 56` ⇒ **larghezza reale
616px su viewport 390px**.

```
viewport 390px │←────────────────────────────────→│
nav 616px      │Mappa│Daimon│Duelli│Miss.│Enigmi│Shop│Za…▓▓ 226px FUORI SCHERMO
                                                        │ 8 Collezione
                                                        │ 9 Classifica
                                                        │10 Guida
                                                        │11 PROFILO ← unica porta
                                                        │            alle sessioni
```

- Visibili in 1 tap: **6**. Sepolte dietro swipe: **4**, fra cui Profilo
- Affordance dello scroll: **solo** un `maskImage` che sfuma 14px ai bordi
  (`:852-853`)
- Su 11 voci solo 2 non hanno coachmark: `map` e **`home`/Profilo** — l'unica
  voce che il tutorial non insegna mai è proprio quella nascosta
- Tappare "Profilo" **esce dallo shell** (`/home` non è sotto `/game`): si perde
  top bar, timer, nav, con full page load
- Label ≠ rotta: "Classifica" → `/game/profile`; "Profilo" → `/home`

**Costo per il giocatore:** sapere quando è il prossimo evento = **impossibile**.
Rientrare in un'altra sessione = **1 swipe + 4 tap**. Partecipare con un codice =
**1 swipe + 6 tap**.

### 4.3 Tre bug osservabili in produzione oggi

1. **`src/app/page.tsx:17`** — l'auto-resume include `'ended'`:
   ```ts
   .in('sessions.status', ['active', 'ready', 'ended'])
   ```
   Il giorno dopo l'evento il giocatore apre la PWA e viene sbattuto sulla
   **mappa morta della sessione conclusa**, invece che sulla sua agenda. Il
   momento in cui avrebbe più senso mostrare "prossimo evento: sabato 18:00" è
   esattamente quello in cui l'app mostra un fantasma. *Fix: togliere `'ended'`.*

2. **`src/app/home/page.tsx:58-63`** — `statusMeta()` copre `active|ready|ended`
   ma **non `draft`** ⇒ il fallback `return { label: status }` mostra la stringa
   inglese grezza **"draft"** a un utente italiano. Il join accetta già sessioni
   in `draft` (`api/auth/join/route.ts:52`), quindi il caso si verifica.
   *Fix: aggiungere `draft: 'In programma'`.*

3. **`src/app/home/page.tsx:303`** — `isPlayable` esclude `draft` ⇒ la card si
   espande, mostra sei statistiche a zero, e **la CTA semplicemente non c'è**,
   senza spiegazione. *Fix: CTA disabilitata con motivo.*

### 4.4 Proposta: Agenda come sezione di primo livello

**Nav da 11 a 5** (vincolo hard: a `minWidth: 56` su 390px stanno 6 voci):

```
┌─────────────────────────────────────────────────────┐
│  🗺        🎯        📅③       ⚔️        ⋯          │
│ Mappa   Missioni   Agenda   Duelli    Altro         │
└─────────────────────────────────────────────────────┘
                       ▲ badge: • evento OGGI / ③ N in programma
```

- **Agenda al centro** — massima raggiungibilità col pollice, e semanticamente il
  perno fra "gioco ora" e "gioco con altri"
- **Zaino → top bar**, accanto alla pill dell'oro. L'inventario appartiene alle
  valute, non alla navigazione
- **"Altro" = bottom sheet a griglia** (DaimonDex, Collezione, Enigmi, Shop,
  Classifica, Guida, Impostazioni) — 2 tap ma *scopribili*, con badge per voce
- **"Profilo" smette di essere una voce che esce dallo shell**: `/home` viene
  smontato in `/game/agenda` + sheet Altro

**Nuova rotta `/game/agenda`** dentro `GameShell`:

```
┌───────────────────────────────────────────────┐
│  📅 Agenda                              [+]   │ [+] = inserisci codice
├───────────────────────────────────────────────┤
│  ── IN CORSO ─────────────────────────────    │
│  ┌─────────────────────────────────────────┐  │
│  │ ● Caccia al Parco Ducale                │  │
│  │   Termina fra  01:47:22                 │  │ ← countdown live
│  │   Lv 7 · 340 XP · 12 creature           │  │
│  │   ┏━━━━━━━ ▶ RIENTRA IN GIOCO ━━━━━━━┓  │  │
│  └─────────────────────────────────────────┘  │
│  ── PROSSIMI ─────────────────────────────    │
│  ┌─────────────────────────────────────────┐  │
│  │ ┌────┐  Notte dei Daimon                │  │
│  │ │ SAB│  sab 2 ago · 18:00–20:00         │  │
│  │ │ 02 │  📍 Piazza Garibaldi             │  │
│  │ │ AGO│  ⏳ fra 1 giorno e 4 ore         │  │
│  │ └────┘  🔔 Promemoria attivo            │  │
│  └─────────────────────────────────────────┘  │
│  ── ARCHIVIO ──────────────────────  (3) ⌄    │
└───────────────────────────────────────────────┘
```

**Matrice CTA per stato** (elimina il vuoto di §4.3):

| Stato | Countdown | CTA |
|---|---|---|
| `draft` + data | "Inizia fra 1g 4h" | `⏳ Disponibile sab alle 18:00` (disabled, **spiegato**) |
| `draft` senza data | "Data da definire" | `🔔 Avvisami quando c'è la data` |
| `ready` + futura | "Inizia fra 12m" | `🚪 Entra in sala d'attesa` |
| `ready` T-15m | "Si parte a momenti" | `▶ ENTRA ORA` (primario) |
| `active` | "Termina fra 01:47" | `▶ RIENTRA IN GIOCO` |
| `ended` | "Terminato il 2 ago" | `🏁 Rivedi risultati e classifica` |

**Fuori sessione l'app non deve espellere** (oggi `game/layout.tsx:11-19` rimanda
a `/home`): entra in *modalità Agenda*, con le tab di gioco visibili ma
disabilitate ("Disponibile durante un evento") e DaimonDex / Collezione /
Classifica / Guida **sempre navigabili** — sono cross-sessione e danno un motivo
per riaprire l'app fra un evento e l'altro.

**Push pre-evento**: l'infrastruttura c'è già (`push_subscriptions` per-utente,
fan-out via `sendPushToSession`, `src/lib/push.ts:114-137`). Serve solo estendere
`THRESHOLDS` con marker negativi: `-1440` (T-24h), `-60`, `-15`.

**`.ics` "Aggiungi al calendario"**: zero dipendenze, `Blob` +
`URL.createObjectURL`. Su iOS/Android apre il calendario di sistema — copre anche
chi disinstalla la PWA.

### 4.5 Lato admin: da pagina-monstre a "Regia evento"

Il wizard esiste (`admin/sessions/page.tsx:923-1148`) ma **finisce troppo presto**
e lascia l'evento inutilizzabile, mentre il lavoro vero è sparso su 4 pagine con
4 `<select>` di sessione diversi. Non esiste `/admin/sessions/[id]`.

Difetti strutturali:
- **Lo step 4 del wizard è una schermata vuota** (`:1097-1108`) — solo testo,
  nessun input
- **Due modelli di salvataggio nella stessa schermata**: i pin fanno POST/PATCH
  immediato (`:264-286`), il resto è batch su "Salva modifiche" (`:357-386`).
  L'utente non sa cosa è già salvato
- `MapPicker` montato **due volte** (wizard `:999` + edit `:676`)
- "Termina sessione" duplicato su `/admin` (`:608-612`) e `/admin/sessions` (`:553-558`)
- Il default del `<select>` sul dashboard è `data[0]` = la sessione **più
  recente creata**, non quella attiva (`admin/page.tsx:423`)
- Il payload dei pin si edita come **JSON grezzo** (`:299, 324`) benché
  `src/components/admin/PinPayloadForms.tsx` esista già e sia importato

**Proposta**: wizard a 4 step che produce un evento *pubblicabile* (data e ora
nello step 1, pin nello step 2, inviti nello step 3, checklist + "Pubblica" nello
step 4), più `/admin/sessions/[id]` "Regia evento" con header persistente, tab
(Riepilogo · Mappa e pin · Inviti · Contenuti · Live) e checklist di
pubblicazione.

---

## 5. Supporto operativo durante l'evento

Buono sul monitoraggio: feed realtime di `session_errors` in dashboard
(`admin/page.tsx:261,280`), drill-down su catture/incontri/duelli, guida in-app
per l'organizzatore da 1.047 righe.

**Cieco sul recupero.** `src/app/api/admin/players/route.ts` espone **solo GET**.
Non esiste alcun modo di sbloccare un singolo giocatore: se qualcuno perde la
rete a metà di un boss fight e l'incontro resta appeso, l'organizzatore ha **una
sola leva — riavviare l'intera sessione**, azzerando i progressi di tutti.

> **Fix (S, alto valore):** endpoint admin "sblocca giocatore" (force-resolve di
> encounter/duel/boss aperti) + pulsante "Sono bloccato" lato giocatore che
> logga in `session_errors`.

---

## 6. Readiness commerciale

### 6.1 Modello di business: assente al 100%

Grep `stripe|payment|subscription|billing|checkout|paywall|pricing` in `src/`:
**zero risultati reali** (gli unici match sono `push_subscriptions` e un commento
CSS). Nessun concetto di piano, quota, limite, licenza.

Chi crea le sessioni: **un admin globale**. `is_admin()` legge un booleano dal JWT
(`supabase/migrations/002_rls_policies.sql:18-21`) impostato **a mano** via
Supabase Admin API — non esiste UI né script.

### 6.2 Multi-tenancy: il gap strutturale più grave

**`sessions` non ha alcuna colonna di proprietà** — né `owner_id`, né
`created_by`, né `org_id` (`001_initial_schema.sql:38-49`). L'unica tabella con
`created_by` in tutto lo schema è `groups`.

`is_admin()` è **globale**: chi è admin è superadmin su tutte le sessioni, tutti
i giocatori, tutto il catalogo. E le policy hanno lettura globale
(`002_rls_policies.sql`):

- `sessions_read USING (TRUE)` (riga 41) ⇒ ogni giocatore enumera **tutte le
  sessioni di tutti i clienti**
- `qr_read USING (TRUE)` (riga 82) ⇒ ogni giocatore legge **tutti i QR premio di
  tutti gli eventi** — già segnalato come Medium in
  `docs/plans/2026-05-12-rls-and-ratelimit-audit.md`, **non corretto**
- idem `missions_read`, `notif_read`, `creatures_read`, `items_read`

⇒ **Un secondo cliente vedrebbe i dati del primo.** L'unico modo sicuro di
servire due clienti oggi è **un progetto Supabase + un deploy Vercel per
cliente**.

### 6.3 Branding: hard-coded

`"Daimon"` compare **99 volte in 38 file**. `src/app/layout.tsx:32,38` e
`public/manifest.json` hanno nome, `theme_color` e `lang` fissi. Nessun file di
configurazione tema. White-label oggi = fork + find/replace + redeploy.

Unico punto brandizzabile: `sessions.narrative_config` (titolo storia, intro,
villain) — buono per la narrazione, inutile per logo/colori.

### 6.4 i18n: nessuna infrastruttura

Zero librerie (`next-intl`/`i18next`/`lingui`: nessuna). `lang="it"` fisso.
Stima conservativa: **~960 letterali italiani multi-parola** su 308 file — il
reale è plausibilmente 1.500–2.500.

Il costo vero sono i **tre livelli**: UI in JSX, messaggi API
(`'Codice invito mancante'`, `src/app/api/auth/join/route.ts:22`), e **contenuti
in database** (nomi/descrizioni creature, missioni, enigmi, `narrative_config`) —
quest'ultimo richiede colonne tradotte o tabelle `*_translations`, ed è il pezzo
che costa di più. **L: 4–6 settimane fatte bene, non una.**

### 6.5 Legale/GDPR: contiene bloccanti assoluti

Un solo componente legale in tutto il repo:
`src/components/legal/PrivacyPolicyModal.tsx`, usato **solo** in
`home/page.tsx:855`. **Nessuna pagina `/privacy` pubblica. Nessun `/terms`.
Nessun ToS. Nessun banner cookie.**

**A — Nessun age gate, su un gioco geolocalizzato per minori.**
La colonna `gdpr_consent_minor` esiste (`006_profiles.sql:7`) ma **non è mai
letta né scritta**: compare solo in un commento, nei tipi generati e nella
migrazione (verificato). `src/app/api/profile/route.ts` scrive solo
`gdpr_consent_at`. In Italia l'età per il consenso digitale è **14 anni**
(GDPR art. 8 + Codice Privacy art. 2-quinquies).

**B — Il login rende i minori legalmente impossibili.**
Autenticazione **solo Google OAuth** (`src/app/_components/Login.tsx:12-19`), che
richiede 13+. Un dodicenne a un evento o mente sull'età o usa l'account del
genitore. È anche l'attrito n.1 al check-in.

**C — La cancellazione account è rotta.** *(verificato direttamente)*
`DELETE /api/profile` (`src/app/api/profile/route.ts:73-84`) chiama
`admin.auth.admin.deleteUser(user.id)` **senza alcuna pulizia preventiva**. Ma
**32 FK verso `auth.users` non hanno `ON DELETE CASCADE`** (contro 7 che ce
l'hanno), e non esiste alcun trigger.

⇒ Per **qualunque giocatore che abbia effettivamente giocato**, il bottone
"Elimina account definitivamente" (`home/page.tsx:604`) restituisce **500 per
violazione di foreign key**. Il diritto alla cancellazione (art. 17) è di fatto
non funzionante. Verificabile in staging con un solo test.

**D — Analytics con PII prima del consenso.**
PostHog si inizializza senza gate (`src/lib/analytics.ts:16-27`) e `identify()`
invia **l'email** (`home/page.tsx:149`). Attenuanti reali: host EU,
`autocapture: false`, `disable_session_recording: true`. Ma resta tracciamento
con identificativo personale senza base giuridica raccolta.

Mancano anche export dati (art. 20) e retention policy.
**Dei 7 punti "Da completare" in `docs/plans/2026-04-12-gdpr-followups.md`, ne
risultano chiusi 0.**

### 6.6 Analytics: fondamenta ottime, strumentazione a metà

`src/lib/analytics.ts` è ben fatto — catalogo tipizzato di 16 eventi, no-op senza
chiave, host EU. Ma **solo 8 dei 16 sono effettivamente emessi**. Mai chiamati:
`starter_picked`, `duel_started`, `duel_resolved`, `boss_started`,
`boss_resolved`, `qr_scanned`, `item_used`, `enigma_solved`.

E **`capturePageview()` è definita ma non invocata da nessuna parte**, con
`capture_pageview: false` nella init ⇒ **zero dati di pageview, nessun funnel di
navigazione esiste**.

Mancano gli eventi che misurano il business: login/signup, `invite_issued` vs
`invite_redeemed` (**il tasso di conversione degli inviti è la metrica più
importante per un evento**), onboarding start/complete, permessi GPS/notifiche,
install PWA, ritorno D1/D7.

### 6.7 Distribuzione

PWA fatta bene: `public/sw.js` (198 righe) con strategie serie (cache-first per
static, SWR con eviction LRU per immagini e tile, **network-only per `/api/`**),
manifest completo, `InstallPrompt.tsx` curato (one-shot, ritardo 12s,
`beforeinstallprompt` su Android, istruzioni iOS, rileva che Chrome/Firefox iOS
non possono installare).

Per gli store: **Play** via TWA è alla portata (**S–M**). **App Store** è duro —
Apple rifiuta i wrapper web sottili (linea guida 4.2), serve valore nativo reale
(**L**). **Entrambi richiedono URL pubblici di privacy policy e ToS, che oggi non
esistono** (§6.5).

### 6.8 Affidabilità e costi

- **Rate limiting**: 9 budget definiti (`src/lib/rate-limit.ts:50-60`), applicati
  in **14 route su 102**. **Fallisce aperto** se Upstash non è configurato
  (`:75-77`): senza env var, in produzione, nessun limite e nessun allarme.
  Non protette: tutte le route admin, incluse quelle **OpenAI** con
  `gpt-image-2` 1024×1024 — un loop accidentale brucia denaro vero
- **Offline**: **nessun listener `navigator.onLine`** in tutto il codice. Il SW
  serve `offline.html` per le navigazioni, ma l'app già in esecuzione non ha
  alcuno stato "sei offline". In un parco con campo scarso è la prima chiamata
  di supporto
- **500 utenti concorrenti: non testato.** `scripts/loadtest-multiuser.k6.js` è
  tarato su 100 VU. Collo di bottiglia noto: `last_position` ogni 5s per
  giocatore ⇒ **~100 UPDATE/s a 500 giocatori** su `player_sessions`
- **Costi: buona notizia.** Vercel Pro ~$20 + Supabase Pro ~$25/mese.
  **OpenAI è usato esclusivamente per l'authoring in admin, mai a runtime** ⇒
  **costo marginale per utente ≈ zero**. Ottima storia di unit economics.
  *Da verificare a parte: i tile Carto hanno vincoli di ToS per uso commerciale*

### 6.9 Rischio tecnico

- **Test 821/821 verdi, typecheck pulito** — sopra la media per un solo-dev, ed è
  un punto di forza in due diligence
- **498 `any` non-test**, concentrati in `admin/creatures/page.tsx` (45),
  `api/game/boss/[id]` (44), `duel/action` (35), `map-pins/claim` (34),
  `rewards/dispense.ts` (24). Nota: `src/types/database.ts` ha **0 any** — gli
  `any` sono tutti nella **logica scritta a mano che distribuisce ricompense e
  risolve combattimenti**, cioè nel codice più critico
- **Nessuna CI** (`.github/workflows` non esiste): test e typecheck verdi ma mai
  eseguiti automaticamente
- **Nessun LICENSE**; `package.json` si chiama ancora `"build"`
- **Provenienza IP degli asset**: le creature — l'IP centrale — sono generate con
  `gpt-image-2`. OpenAI cede i diritti d'uso, ma l'assenza di copyright
  registrabile su output puramente AI è una domanda che un acquirente porrà

---

## 7. Piano prioritizzato

### Fase 0 — Quick win (2-3 giorni)

Tutto verificato, nessuna migrazione, alto rapporto impatto/costo.

| # | Intervento | Dove |
|---|---|---|
| 1 | Togliere `'ended'` dall'auto-resume | `src/app/page.tsx:17` — **un carattere** |
| 2 | `statusMeta`: aggiungere `draft: 'In programma'`; CTA spiegata invece che assente | `src/app/home/page.tsx:58-63`, `:303` |
| 3 | Definire `--wc-line` (oggi il bordo non esiste) | `src/app/globals.css` |
| 4 | `expGain`/`goldGain` × rarità | `encounter/catch/route.ts:305-306` |
| 5 | Chiudere il triangolo elementale (Armonia deve avere una debolezza) | `src/lib/types.ts:255-261` |
| 6 | Filtrare lo spawn pool per `session_id` + cache key per-sessione | `src/lib/game/config-cache.ts:23-45` |
| 7 | `<MotionConfig reducedMotion="user">` nel GameShell — **una riga per l'80% del gap** | `src/components/GameShell.tsx` |
| 8 | Dieta asset: `login-bg` 2 MB→180 KB, `bgm` a Opus, rimuovere `creatures-test/` e `icons/_backup/`, `priority` selettivo | `public/`, `sw.js:25`, `CreatureSprite.tsx:149` |
| 9 | Fix stagger skeleton (delay sui figli, non sul contenitore) | `GameLoading.tsx:229,253` |
| 10 | Rimuovere i rami legacy battle (~1.050 righe morte) | `NEXT_PUBLIC_BATTLE_LEGACY_UI` |

### Fase 1 — Rendere l'app presentabile (2-3 settimane)

| # | Intervento | Effort |
|---|---|---|
| 1 | **Nav da 11 a 5 + bottom sheet "Altro"** — elimina lo scroll orizzontale ed è il tell #1 di "dashboard web" | L |
| 2 | **Agenda**: migrazione `scheduled_start_at` + `/game/agenda` + countdown + `.ics` + cron pre-evento (T-24h/-1h/-15m) | L |
| 3 | **Modalità fuori-sessione**: non espellere più su `/home`; DaimonDex/Collezione/Classifica sempre navigabili | M |
| 4 | **Eliminare le emoji dall'UI** (266 punti, priorità: schermate esito, empty state, bottoni azione) — è sostituzione 1:1 con `react-icons/gi` già in uso | M |
| 5 | **Floor tipografico e di contrasto**: min 12px, opacità min 0.62. *È un gioco da giocare al sole* | M |
| 6 | **Regia del popup incontro** (molla + sprite che emerge + haptic + sting) — è *il* momento del gioco ed è statico | S |
| 7 | **Transizione di pagina con `AnimatePresence` + `loading.tsx`** per i 12 segmenti scoperti | M |
| 8 | **Riparare il combattimento**: attacco base mitigato da DEF, ricalibrare le power, implementare o rimuovere `priority` | M |
| 9 | **Scaling di livello negli encounter + HP persistenti** | M |
| 10 | **Collegare i 5 sistemi morti** (`level_rewards`, esca, `hall_of_fame`, bonus `evento`, tipi missione) | M |
| 11 | **Push di ritorno giornaliero** + UI palestre — miglior ROI su D1 | S |
| 12 | **Endpoint "sblocca giocatore"** + pulsante "Sono bloccato" | S |

### Fase 2 — Rendere l'app vendibile (30-90 giorni)

**Bloccanti legali — nulla si può vendere prima:**

1. **Fix cascata cancellazione account** — migrazione con `ON DELETE CASCADE` sulle
   32 FK, o RPC di pulizia prima di `deleteUser`. Con test. **M**
2. **Age gate + consenso genitoriale**; scrivere `gdpr_consent_minor`. **Login
   OTP/magic link** accanto a Google (sblocca anche l'attrito al check-in). **M**
3. **Pagine pubbliche `/privacy` e `/termini`**; compilare
   `NEXT_PUBLIC_PRIVACY_CONTROLLER`/`_EMAIL`; consenso davanti a PostHog. **S**
4. *Revisione con un legale.* Non negoziabile per un prodotto geolocalizzato con
   minori.

**Misurabilità e affidabilità:**

5. Chiudere il funnel analytics: collegare gli 8 eventi orfani, chiamare
   `capturePageview`, aggiungere login/onboarding/permessi/install/`invite_redeemed`. **S–M**
6. Stato offline in-app (`navigator.onLine` + banner + retry). **S**
7. Estendere il rate limiting; **far fallire il boot in produzione se Upstash
   manca** invece di fallire aperto. **S**
8. Load test k6 a 500 VU. **M**
9. CI GitHub Actions (test + typecheck già verdi, vanno solo bloccati in PR) +
   LICENSE. **S**

**Scala dell'authoring:**

10. "Duplica sessione" + import CSV/GeoJSON dei pin + preset di stat per rarità.
    **M** — è la differenza tra un evento al mese e dieci in parallelo.

---

## 8. La decisione che va presa prima di tutto il resto

Le fasi 0 e 1 valgono in ogni scenario. Ma **il modello di business cambia cosa
viene dopo**, e il codice oggi ne supporta bene solo uno.

**Cosa dice il codice.** L'intera architettura è già un tool per organizzatori:
sessioni con codici invito, contenuti autorati per evento, `narrative_config`,
19 sezioni admin, guida in-app da 1.047 righe, dashboard live, QR fisici da
stampare, e persino `cultural_places`/`artworks`/`anecdotes`
(`056_cultural_collection.sql`) — che suggerisce che la direzione
turistico-culturale era già intuita.

Il B2C richiederebbe invece mondo persistente, acquisti in-app e store nativi:
mesi di riscrittura del dominio, in un mercato dove si compete con Niantic.

**Raccomandazione: vendere un servizio B2B chiavi-in-mano per eventi** (comuni,
proloco, musei, festival, team building), **non un SaaS self-serve e non un gioco
B2C.**

E vendere come **servizio erogato**, non come piattaforma: la tenancy non esiste
e costruirla è il pezzo più caro del piano (**L**). Nella fase iniziale non
serve — con 3-8 clienti si gestisce **un progetto Supabase per cliente**,
isolamento perfetto per costruzione, ~$45/mese di infra per cliente. Si fa pagare
l'evento (setup + accompagnamento), non il software. Con costo marginale OpenAI
≈ zero, i margini sono ottimi.

**La tenancy si costruisce solo quando la domanda la giustifica** — realisticamente
oltre gli 8-10 clienti, quando gestire N progetti separati costa più delle 4-6
settimane di lavoro.

**Cosa NON fare nei prossimi 90 giorni:** internazionalizzazione (**L**, e nessun
cliente italiano la chiede), App Store, e la piattaforma SaaS self-serve. Sono i
tre modi più rapidi per bruciare un trimestre senza un euro di ricavo.

*Se invece la scelta è il B2C, allora l'intervento #1 di §1 (livello persistente
sopra le sessioni) diventa un prerequisito assoluto e va fatto prima di tutto il
resto: senza, la D1 resta ~0 per costruzione.*
