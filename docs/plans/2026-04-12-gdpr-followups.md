# GDPR Follow-ups

> Creato: 2026-04-12
> Stato: aperto

Appunto operativo sui punti ancora da chiudere lato GDPR/privacy per `wild-catch`.

## Gia' migliorato

- informativa privacy sintetica mostrata nel flusso di join evento
- consenso privacy registrato lato profilo
- spiegazione in-app dei principali dati trattati

## Da completare

### 1. Titolare e contatti reali

Configurare e mostrare dati veri del titolare/referente privacy:

- `NEXT_PUBLIC_PRIVACY_CONTROLLER`
- `NEXT_PUBLIC_PRIVACY_EMAIL`

Senza questi valori, l'informativa resta utile ma non completa.

### 2. Informativa completa pubblica

Oltre al modale in-app, pubblicare una versione completa e sempre raggiungibile:

- pagina `/privacy`
- link stabile da home / profilo / footer

### 3. Tempi di conservazione piu' precisi

Definire e documentare in modo puntuale:

- quanto teniamo profilo e progressi
- quanto teniamo log tecnici e cronologia sessioni
- come gestiamo eliminazione account e dati residui

### 4. Minori

Nel database esiste gia' `gdpr_consent_minor`, ma il flusso attuale non raccoglie piu' esplicitamente:

- conferma eta' / ruolo genitore-tutore
- eventuale consenso aggiuntivo richiesto dal contesto evento

### 5. Fornitori e ruoli privacy

Documentare chiaramente i fornitori usati dal servizio:

- autenticazione
- hosting / database
- mappe / tile provider
- eventuali servizi email o notifiche

Da verificare anche i ruoli privacy e gli accordi necessari con i fornitori.

### 6. Base giuridica da validare con legale

Chiarire formalmente la base giuridica per:

- accesso e partecipazione all'evento
- geolocalizzazione durante il gioco
- classifiche, log operativi e anti-abuso

### 7. Diritti utente e processo operativo

Definire una procedura pratica per gestire richieste di:

- accesso
- rettifica
- cancellazione
- revoca del consenso

## Nota

Questo file e' un promemoria tecnico-operativo, non sostituisce una revisione legale formale.
