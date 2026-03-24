# WildCatch — Design Specification
**Version:** 1.0
**Date:** 2026-03-24
**Status:** Approved

---

## 1. Concept & Positioning

WildCatch è una PWA mobile-first per eventi outdoor dal vivo. I giocatori esplorano fisicamente un'area delimitata, incontrano e catturano creature digitali originali, risolvono misteri narrativi tramite missioni e QR code fisici, e si sfidano in duelli PvP in tempo reale.

**Tagline:** *"La prima avventura outdoor dove catturi creature e risolvi misteri nel mondo reale"*
**Formula:** Pokémon GO × Escape Room × Evento dal vivo — senza app store, senza download

---

## 2. Decisioni di Design

| Decisione | Scelta |
|---|---|
| Lingua app | Italiano |
| Pubblico | Bambini 8–14 + famiglie + ragazzi fino a 22 anni |
| Location | Area limitata definita dall'admin (bounding box), evento iniziale Pesaro |
| Creature MVP | 30 creature, 5 elementi |
| Accesso | Invite-only (QR o codice) — pagamento gestito esternamente |
| Auth | Google OAuth (primario) + magic link email (fallback) via Supabase |
| Persistenza | Reset per sessione + Hall of Fame permanente |
| Narrativa | Admin-configurable per sessione — zero hardcoded |
| Meccanica | Escape room lineare + esplorazione QR open-world |
| Business model | Interno, evento a pagamento esterno, single-tenant |
| Build | Full Phase 1+2 completo |
| Costi | ~€0/mese su free tier |

---

## 3. Stack Tecnologico

| Tecnologia | Ruolo |
|---|---|
| Next.js 15 (App Router) | Frontend + API routes + SSR |
| Tailwind CSS v4 | Styling mobile-first |
| Framer Motion | Animazioni creature, transizioni, effetti cattura/evoluzione |
| Lottie (lottie-react) | Animazioni vettoriali complesse (battaglie, evoluzioni) |
| Supabase | PostgreSQL + Auth (Google OAuth) + Realtime WebSocket + Storage |
| Vercel | Hosting + CI/CD da GitHub (piano Hobby, gratuito) |
| Resend | Magic link email fallback |
| next-pwa | Service Worker, installabilità, offline partial |
| OpenAI gpt-image-1 | Generazione artwork creature (high quality, ~€13 totale — vedi Sezione 4) |
| Leaflet + OpenStreetMap | Mappa area evento (gratuito, no Google Maps) |
| Supabase pg_cron | Chiusura automatica sessione (gratis, nessun Vercel cron) |

**Costo mensile MVP: €0** (immagini AI ~€13 una tantum — vedi breakdown Sezione 4)

---

## 4. Art Direction

### Stile visivo: "Mediterranean Adventure Illustration"
Incrocio tra: calore Ghibli × graphic novel italiana × UI Pokémon GO outdoor-readable × filosofia creature Gormiti (italiana, elementi naturali).

### Creature — Standard qualità Pokémon
- **Artwork:** Illustrazione digitale HD, bold outline 2–3px, cel-shading caldo, luce ambiente estiva italiana
- **Modello generazione:** OpenAI `gpt-image-1` (modello ufficiale, API ID esatto: `gpt-image-1`) — usato ovunque nel progetto
- **Budget immagini — breakdown completo:**

| Tipo immagine | Dimensione | Qualità API | Prezzo | Quantità | Subtotale |
|---|---|---|---|---|---|
| Artwork principale | 1024×1024px | high | $0.167 | 30 | ~$5.01 |
| Thumbnail / Bestiario | 1024×1024px | medium | $0.042 | 30 | ~$1.26 |
| Schermata incontro | 1536×1024px | high | $0.250 | 30 | ~$7.50 |
| Immagini UI / sfondi | 1024×1024px | medium | $0.042 | 10 | ~$0.42 |
| **Totale stimato** | | | | **100 img** | **~$14.20 (~€13)** |

*Prima generazione: usa Google AI Studio (gratuito, 500 img/giorno) per iterare prompt e stile. Poi run finale a pagamento con OpenAI per qualità massima.*
- **Animazioni creature** (Framer Motion + Lottie):
  - **Idle loop:** leggero respiro/fluttuazione continua (2–3s loop)
  - **Attacco:** animazione forward + particle effect elemento (fuoco, acqua, foglie, ecc.)
  - **Danno ricevuto:** flash bianco + shake + HP bar diminuisce animata
  - **Cattura:** la creatura si rimpicciolisce verso la Rete + particelle + flash dorato
  - **Evoluzione:** dissolve + scala + burst di luce + reveal nuova forma (sequenza 3–4s)
  - **Schermata Vittoria:** bounce + stelle + confetti colore elemento
  - **Fuga:** creatura scappa fuori schermo con trail di particelle

### Palette Adriatica
| Ruolo | Nome | Hex |
|---|---|---|
| Primario / mare | Adriatic Azure | `#3A9DBC` |
| Caldo / spiaggia | Sandy Ochre | `#D4A96A` |
| UI panels | Limestone Cream | `#F0EBD8` |
| CTA primario | Coral-Orange | `#E85D2F` |
| Natura | Marche Olive | `#5A8A3C` |
| Mystery mode | Deep Teal | `#1A6B6B` |
| Successo / EXP | Sun Yellow | `#F7C841` |
| Testo | Dark Slate | `#1C2B3A` |
| Background dark | Adriatic Midnight | `#0F1F2E` |

### Rarità creature
| Tier | Colore | Probabilità base cattura |
|---|---|---|
| Comune | Grey-Green `#7AB87A` | 70% |
| Non comune | Azure Blue `#4A9FD4` | 45% |
| Raro | Coral Gold `#E8A820` | 25% |
| Epico | Adriatic Purple `#7B4DB8` | 12% |
| Leggendario | Rossini Red `#C8352A` | 5% |

### 5 Elementi creature
| Elemento | Ispirazione | Forte contro | Debole contro |
|---|---|---|---|
| 🔥 Fiamma | Miti vulcanici italiani | Bosco | Adriatico, Terra |
| 🌊 Adriatico | Spiriti del mare Adriatico | Fiamma, Terra | Bosco |
| 🌿 Bosco | Fauna appenninica | Adriatico | Fiamma |
| ⛰️ Terra | Colline marchigiane | Fiamma | Adriatico |
| 🎵 Armonia | Rossini / UNESCO City of Music | +15% danno base (tutti) | Terra, Fiamma |

*Nota Armonia: elemento leggendario, assegnato solo a creature Epico/Leggendario. Il +15% base compensa la debolezza doppia. Il sistema elementi è opzionale — disattivabile dall'admin per eventi più semplici.*

---

## 5. Schema Database

### Tabelle Core (permanenti)
```sql
users              -- Supabase Auth: id, email, nickname, avatar_url,
                   --   is_admin(boolean, default false), gdpr_consent_at(timestamptz), gdpr_consent_minor(boolean)
creatures          -- id, name, description, element, rarity, hp, atk, def,
                   --   min_level, image_url, sprite_url, lottie_url, spawn_weight, evolution_of
items              -- id, name, type(rete/esca/uovo/battaglia), effect_value, description, shop_price
```

### Tabelle Sessione
```sql
sessions           -- id, name, status(draft/ready/active/ended), area_bounds(JSON),
                   --   duration_minutes, start_at, end_at, auto_end,
                   --   narrative_config(JSON): {story_title, intro_text, villain_name, chapters[]}
session_invites    -- id, session_id, code(8char univoco), used_by_user_id, used_at, is_active
player_sessions    -- id, user_id, session_id, level, exp, gold, role(player/boss/villain),
                   --   last_position(POINT), score_final, selected_creature_id, joined_at
hall_of_fame       -- id, user_id, session_id, rank, score, creatures_caught, season_label, awarded_at
```

### Tabelle Gameplay
```sql
player_creatures   -- id, user_id, creature_id, session_id, duplicates_count, evolved, caught_at
player_inventory   -- id, user_id, session_id, item_id, quantity
encounters         -- id, user_id, creature_id, session_id, status(active/caught/fled/fought),
                   --   trigger(gps/timer), wild_creature_hp, player_creature_id(uuid FK creatures, locked at start),
                   --   started_at, resolved_at
                   -- NOTA: player_creature_id viene letto da player_sessions.selected_creature_id al momento
                   --   di POST /api/game/encounter/start e salvato immutabile — non cambia tra i turni.
                   --   Questo previene il cambio di creatura mid-fight come exploit.
duels              -- id, challenger_id, opponent_id, session_id, status, winner_id,
                   --   challenger_creature_id, opponent_creature_id,
                   --   room_code(4char, no ambiguous chars: no 0/O/I/1), started_at, ended_at
```

### Tabelle Missioni & QR
```sql
missions           -- id, session_id, chapter_order, title, description, type,
                   --   target, target_count, reward_gold, reward_exp, reward_item_id, is_required
player_missions    -- id, user_id, mission_id, progress, completed_at
qr_codes           -- id, session_id, type(uovo/indizio/oggetto/boss/evento),
                   --   payload(JSON, schema per tipo — vedi sotto), uses_remaining, label, created_at
-- Payload schema per tipo QR:
-- uovo:    { egg_rarity: "comune"|"non_comune"|"raro"|"epico"|"leggendario", creature_pool: [uuid,...] }
-- indizio: { chapter_order: number, text: string, image_url?: string }
-- oggetto: { item_id: uuid, quantity: number }
-- boss:    { creature_id: uuid, level_override: number, reward_item_id?: uuid }
-- evento:  { event_type: "team_rocket"|"capo_palestra"|"bonus_exp", effect: object }
notifications      -- id, session_id, title, body, sent_at, sent_by_admin_id
```

---

## 6. Architettura Applicazione

### Route Player (Next.js App Router)
| Route | Schermata |
|---|---|
| `/` | Landing — join evento (QR scan o inserisci codice) |
| `/auth` | Google OAuth flow |
| `/game` | Shell principale PWA — bottom nav |
| `/game/map` | Mappa area evento + GPS + encounter radar |
| `/game/encounter/[id]` | Schermata incontro creature |
| `/game/bestiary` | Bestiario 30 creature |
| `/game/missions` | Missioni attive + capitoli storia |
| `/game/backpack` | Zaino — Reti, esche, uova, oggetti battaglia |
| `/game/profile` | Profilo + classifica live + Hall of Fame |
| `/game/duel/[id]` | Schermata duello PvP realtime |
| `/game/shop` | Shop oggetti |

### Route Admin
| Route | Schermata |
|---|---|
| `/admin` | Dashboard live — contatori + quick actions |
| `/admin/sessions` | Gestione sessioni + wizard creazione 4 step |
| `/admin/creatures` | CRUD creature + genera artwork AI |
| `/admin/missions` | Capitoli + missioni drag-and-drop |
| `/admin/qrcodes` | Generazione QR + export PDF |
| `/admin/players` | Lista giocatori live + gestione ruoli |
| `/admin/leaderboard` | Classifica + chiusura sessione + Hall of Fame |
| `/admin/invites` | Genera codici invito + export CSV/PDF |

### API Routes chiave
| Endpoint | Funzione |
|---|---|
| `POST /api/game/position` | Aggiorna GPS, valuta trigger incontro, controlla scadenza sessione |
| `POST /api/game/encounter/start` | Genera incontro — RNG creatura server-side |
| `POST /api/game/encounter/catch` | RNG cattura server-side, aggiorna inventario, valuta evoluzione |
| `POST /api/game/encounter/fight` | Esegue 1 turno combattimento selvaggio, aggiorna wild_creature_hp |
| `POST /api/game/creature/evolve` | Trigger manuale evoluzione dal Bestiario (duplicates_count ≥ 3) |
| `PUT /api/game/creature/select` | Imposta selected_creature_id in player_sessions |
| `POST /api/game/duel/connect` | Crea/join lobby duello via room code |
| `POST /api/game/duel/action` | Invia azione duello (attacco, oggetto, resa) |
| `POST /api/game/qr/scan` | Valida QR code, applica effetti |
| `POST /api/game/shop/buy` | Acquisto oggetto — deduce oro e aggiunge item a player_inventory (atomico server-side) |
| `POST /api/auth/join` | Valida codice invito, associa utente a sessione |
| `GET /api/admin/dashboard` | Statistiche live sessione |
| `POST /api/admin/notify` | Broadcast notifica a tutti i giocatori |
| `POST /api/admin/session/close` | Chiude sessione, calcola punteggi, genera classifica |

### Realtime (Supabase WebSocket)
- **Canale duello** — azioni PvP live tra 2 giocatori
- **Canale admin dashboard** — contatori live (incontri, catture, giocatori)
- **Canale notifiche** — push admin → giocatori istantanea
- **Leaderboard giocatori** — polling HTTP 30s (conserva connessioni WebSocket per duelli)

---

## 7. Meccaniche di Gioco

### Onboarding
1. Scansiona QR o inserisce codice invito → validazione server
2. Google Sign-In (1 tap) o magic link email
3. Sceglie nickname + checkbox GDPR-K (under 14)
4. Intro narrativa (testo admin, schermata parchment animata)
5. Riceve starter kit: 5 Reti Base + 100 Oro
6. Tutorial 3 slide → Mappa

### Ciclo di Gioco Principale
**ESPLORA → INCONTRO → SCEGLI → GUADAGNA → SALE DI LIVELLO → CREATURE PIÙ RARE → RIPETI**

### Trigger Incontri
- **GPS:** polling ogni 10s. Spostamento ≥ 20m → valuta incontro con P_zona
- **Fallback timer:** se GPS accuracy > 50m → intervallo random 60–180s
- **Controllo scadenza sessione:** ogni chiamata GPS controlla `now() ≥ end_at`
- **Supabase pg_cron:** fallback chiusura sessione ogni 1 minuto (gratis)
- Max 1 incontro attivo per giocatore

### Cattura (RNG server-side)
- 1 solo tentativo con Rete per incontro — se fallisce la creatura fugge
- Probabilità base per rarità (vedi tabella sopra)
- Ogni tipo di Rete aggiunge bonus additivo alla probabilità
- RNG eseguito esclusivamente server-side — client non vede mai la soglia
- Anti-cheat: rate limit 1 req/5s per utente, validità GPS (max 60km/h)

### Combattimento in Incontro Selvaggio (azione COMBATTI)
Il giocatore può scegliere di combattere la creatura selvatica **prima** di tentare la cattura. Logica:
- Il giocatore usa la `player_creature_id` dell'`encounters` — copiata da `selected_creature_id` al momento di `encounter/start` e immutabile per tutta la durata dell'incontro (anti-exploit)
- Ogni turno: danno = ATK creatura giocatore × dado(0.8–1.2). La creatura selvatica attacca per prima se Rara+
- Ridurre l'HP della creatura selvatica a ≤ 30% → bonus cattura +20% sul prossimo tentativo con Rete
- Ridurre HP a 0 → la creatura fugge (non catturabile). Il giocatore deve gestire il danno
- Max 5 turni di combattimento per incontro, poi la creatura fugge automaticamente
- Stato `encounters.wild_creature_hp` traccia l'HP rimanente lato server
- Il giocatore non perde la propria creatura (HP si resettano dopo l'incontro)
- API: `POST /api/game/encounter/fight` — esegue 1 turno, restituisce HP aggiornati + animazione

### Evoluzione
- Trigger: automatico al momento della cattura quando `duplicates_count` raggiunge 3
- Flusso: `POST /api/game/encounter/catch` controlla `duplicates_count` → se = 3 → avvia evoluzione
- API dedicata: `POST /api/game/creature/evolve` per trigger manuale dal Bestiario
- L'evoluzione aggiorna `player_creatures.evolved = true`, sostituisce `creature_id` con la forma evoluta
- La forma evoluta è una **riga separata** nella tabella `creatures` con statistiche proprie (HP, ATK, DEF, nuovo artwork). Il campo `creatures.evolution_of` è una **foreign key** che punta all'UUID della forma base, permettendo di risalire alla catena evolutiva
- Il pannello admin `/admin/creatures` supporta la creazione di forme evolute: si crea una nuova creatura, si seleziona la forma base nel campo "Evoluzione di" — il sistema la collegherà automaticamente alla forma base tramite `evolution_of`
- Esempio: "Fiammare" (base, id=AAA) → "Fiammare+" (evoluta, id=BBB, `evolution_of=AAA`). Al momento dell'evoluzione il giocatore ha `player_creatures.creature_id=BBB`

### Duelli
- Connessione via codice stanza 4 caratteri o QR condiviso
- Danno = (ATK creatura × livello) × moltiplicatore elemento × dado (0.8–1.2)
- Creature rare+: attaccano per prime (effetto sorpresa animato)
- Oggetti battaglia usabili durante il duello
- Vincitore: +15 EXP + oggetto casuale | Perdente: +5 EXP consolazione
- Realtime via WebSocket Supabase

### Progressione & Punteggio
| Azione | EXP | Punti classifica |
|---|---|---|
| Cattura nuova creatura | +10 | +10 × rarità |
| Duplicato | +3 | +3 |
| Duello vinto | +15 | +15 |
| Missione completata | +20–50 | +20–50 |
| Livello raggiunto | — | +5 × livello |

### Uova
- Schiusa via: distanza GPS percorsa (es. 500m) OR X incontri completati OR scan QR speciale
- Rarità configurabile dall'admin per tipo di uovo
- Animazione reveal progressiva con effetti Framer Motion

### Sistema Sessione
**Stati:** BOZZA → PRONTA → ATTIVA → TERMINATA → CLASSIFICA
- Admin avvia con START, imposta durata in minuti
- Avvisi giocatori: notifica a 10 min, banner rosso a 5 min
- Chiusura automatica: API GPS + pg_cron + admin dashboard (3 livelli gratuiti)
- Classifica + Hall of Fame generati automaticamente alla chiusura

### Accesso Invite-Only
- Tabella `session_invites`: codici 8 caratteri, monouso
- Admin genera batch → esporta PDF con QR o CSV
- Codici validi solo a sessione PRONTA o ATTIVA
- Codice validato server-side prima del login

---

## 8. Player Experience — Schermate Principali

### Bottom Navigation (5 tab)
`🗺️ Mappa` · `📖 Bestiario` · `🎯 Missioni` · `🎒 Zaino` · `👤 Profilo`

### Header sempre visibile
- Livello + barra EXP + Oro + **Timer evento (countdown)**

### Mappa
- Leaflet + OpenStreetMap, cropped al bounding box sessione
- Dot GPS giocatore (arancione) con radar pulse animato
- Pin missione attiva
- Pulsante QR scan
- Creature dot sulla mappa (solo area nelle vicinanze)
- Popup incontro slide-up dal basso
- Messaggio "Sei fuori dall'area" se GPS fuori bounds

### Schermata Incontro
- Artwork creature HD centrato, idle animation loop
- Nome / livello / elemento / HP
- Selezione tipo Rete dall'inventario
- 3 pulsanti: CATTURA (primario) / COMBATTI / Fuggi
- Creature rare+: animazione attacco sorpresa prima che il giocatore agisca
- Esito cattura: animazione Rete → creature si rimpicciolisce → flash dorato → "Catturato!"

### Schermata Duello
- Due creature face-off con idle animation
- HP bars animate con colore progressivo (verde → giallo → rosso)
- Animazione attacco: forward sprite + particle effect elemento
- Dado animato per RNG (se animazione dadoèabilitata)
- Oggetti battaglia accessibili con tap
- Schermata vittoria/sconfitta con animazione creature

### Evoluzione
- Sequenza 3–4s: dissolve bianco → luce burst → reveal nuova forma
- Triggered da 3 duplicati della stessa creatura nel Bestiario
- Creature evolta ha statistiche potenziate + nuovo artwork + nuova idle animation

---

## 9. Admin Panel

### Principio: 3 tap per qualsiasi azione critica

### Wizard "Crea Sessione" (4 step, ~7 minuti totali)
1. **Nome + narrativa** — titolo evento, testo intro, nome antagonista, capitoli
2. **Area di gioco** — disegna bounding box su mappa Leaflet
3. **Creature + frequenza** — seleziona creature dal catalogo, imposta probabilità
4. **Rivedi + avvia** — START lancia la sessione, timer inizia

### Quick Actions Dashboard (sempre visibili)
- 📢 Invia notifica broadcast
- 🎁 Dai risorsa a giocatore (cerca per nickname)
- ⚔️ Lancia evento speciale (boss, Team Rocket)
- 🔴 Termina sessione ora

### Gestione Inviti
- Genera N codici con 1 click
- Export PDF (QR stampabili) o CSV (codici testuali)
- Monitor utilizzo in tempo reale

---

## 10. Accesso Offline (Service Worker)
Cache locale (read-only): inventario, Bestiario, missioni correnti, ultimo stato mappa e tile OpenStreetMap del bounding box sessione (pre-cached all'avvio sessione).

**Strategia sync: server-wins.** Le operazioni che consumano risorse (cattura, uso Rete, acquisto shop) richiedono obbligatoriamente connessione attiva — il client non può eseguirle offline. Questo elimina ogni possibile conflitto di inventario: offline il giocatore può solo leggere il proprio stato, non modificarlo. Al ripristino connessione il client ricarica lo stato dal server (nessun merge necessario).

---

## 11. Sicurezza

### Autenticazione Admin
- Campo `users.is_admin (boolean)` in Supabase — assegnato manualmente via Supabase Dashboard da chi gestisce il progetto
- Autenticazione: Google OAuth identica ai giocatori, ma RLS Supabase verifica `is_admin = true` su ogni richiesta alle route `/admin/*`
- Middleware Next.js blocca tutte le route `/admin` se `is_admin` non è presente nella sessione JWT
- Per eventi ad alto rischio (futuro): aggiungere TOTP via Supabase MFA (supportato nativamente)

### GDPR-K — Minori sotto i 14 anni
- Onboarding: checkbox "Ho 14 anni o più, oppure ho il consenso di un genitore/tutore"
- Campo `users.gdpr_consent_at (timestamp)` + `users.gdpr_consent_minor (boolean)` salvati al momento del consenso
- Per eventi supervisionati (bambini presenti con genitori): il consenso parentale si considera implicito nella presenza fisica all'evento a pagamento. La checkbox è documentazione digitale di questo consenso
- Dati raccolti per minori: solo nickname, avatar Google (opzionale), progressi di gioco. Nessun dato di localizzazione nominale esposto (GPS aggregato solo per admin, non per nickname)
- Admin può esportare o cancellare i dati di un utente specifico dalla schermata Giocatori

### Altre misure
- RNG cattura e incontri: server-side only
- Anti-cheat GPS: velocità max 60km/h, spike ignorati
- Rate limiting: max 1 req/5s per utente su API gioco
- Row Level Security (RLS) su tutte le tabelle Supabase
- Codici invito monouso validati server-side. Admin può revocare singolo codice da `/admin/invites`

---

## 12. Marketing & Lancio

### Posizionamento
*"La prima avventura outdoor dove catturi creature e risolvi misteri nel mondo reale"*

### Vantaggi competitivi
1. IP originale — zero rischio copyright
2. Escape room + creature catching outdoor = combinazione unica
3. Narrativa configurabile per evento — sempre fresco
4. QR → Google login → gioca (zero frizione)
5. Hall of Fame stagionale = fidelizzazione

### Roadmap lancio
| Fase | Periodo | Obiettivo |
|---|---|---|
| Sviluppo | Mesi 1–3 | Build completo + 30 creature AI generate |
| Beta privata | Mese 4 | 20–30 persone, primo evento reale |
| Lancio Pesaro | Mese 5 | 50–100 partecipanti, social coverage |
| Crescita | Mese 6+ | Cadenza mensile/stagionale, nuovi temi |

---

## 13. Note Tecniche — Compatibilità Free Tier

| Potenziale problema | Soluzione adottata |
|---|---|
| Vercel cron ogni 1 min → non free | Sostituito con Supabase pg_cron (gratis) + controllo in API GPS |
| Realtime 200 conn. simultanee | Leaderboard giocatori via polling HTTP; WebSocket solo per duelli e admin |
| Supabase pausa dopo 7gg inattività | 1 Vercel cron giornaliero keep-alive (gratis, 1/giorno consentito) |
| Function timeout 10s (Vercel free) | Tutte le operazioni di gioco < 500ms, nessun problema |

**Costo mensile stimato: €0**
**Costo immagini creature (una tantum): ~€13** (100 immagini totali — vedi breakdown Sezione 4)
