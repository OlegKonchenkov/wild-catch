import { LEGAL, MIN_AGE_WITHOUT_PARENT, RETENTION_MONTHS, resolveController } from '@/lib/legal/controller'

/**
 * The privacy policy as data, so the in-app modal and the public /privacy page
 * render the same text. They used to be one hardcoded modal; a second copy for
 * the public page would inevitably drift, and a privacy policy that says two
 * different things depending on where you read it is worse than one page.
 */

export type PolicyBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'contact' }

export interface PolicySectionData {
  title: string
  blocks: PolicyBlock[]
}

export function buildPrivacySections(
  controllerName?: string | null,
  contactEmail?: string | null,
): PolicySectionData[] {
  const c = resolveController(controllerName, contactEmail)

  return [
    {
      title: 'Titolare del trattamento',
      blocks: [{ kind: 'contact' }],
    },
    {
      title: 'Quali dati trattiamo',
      blocks: [{
        kind: 'list',
        items: [
          "dati di accesso e profilo provenienti dall'autenticazione (es. email, nome profilo, avatar Google se disponibile)",
          'nickname scelto nel gioco',
          "anno di nascita dichiarato al momento dell'iscrizione, usato solo per verificare il requisito di età",
          'partecipazione alla sessione, progressi, inventario, creature, missioni, duelli, QR riscattati e ricompense',
          'posizione GPS e accuratezza durante il gioco, necessarie alle funzioni basate sulla mappa e sugli incontri',
          "dati tecnici essenziali per tenere aperta la sessione sul dispositivo, come l'identificativo sessione salvato in locale",
          "se attivi le notifiche push: l'identificativo della sottoscrizione push del browser/dispositivo (endpoint e chiavi) necessario a recapitare gli avvisi",
          "se acconsenti alle statistiche: eventi di utilizzo anonimi o pseudonimi (schermate visitate, azioni di gioco) e un identificativo tecnico",
        ],
      }],
    },
    {
      title: 'Perché usiamo questi dati',
      blocks: [{
        kind: 'list',
        items: [
          "consentirti l'accesso e la partecipazione all'evento di gioco",
          'abilitare mappa, incontri, missioni, QR code, duelli, classifiche e progressi',
          'gestire sicurezza operativa minima, assistenza e prevenzione di abusi o errori di sessione',
          "tenere traccia dell'accettazione dell'informativa privacy mostrata nel flusso di adesione",
          'se acconsenti: capire quali parti del gioco funzionano e migliorarle',
        ],
      }],
    },
    {
      title: 'Base giuridica e geolocalizzazione',
      blocks: [{
        kind: 'text',
        text: "L'app richiede una tua azione positiva per accettare questa informativa e usa i permessi del browser/dispositivo per la geolocalizzazione. Senza GPS alcune funzioni basate sulla mappa potrebbero non essere disponibili o risultare limitate durante la sessione.",
      }],
    },
    {
      title: 'Età minima e minori',
      blocks: [
        {
          kind: 'text',
          text: `Per usare ${LEGAL.appName} in autonomia occorre avere almeno ${MIN_AGE_WITHOUT_PARENT} anni: è l'età fissata in Italia per il consenso digitale (art. 8 GDPR e art. 2-quinquies del Codice Privacy). Al di sotto di tale età la partecipazione è consentita solo con il consenso di chi esercita la responsabilità genitoriale, che deve essere presente all'evento.`,
        },
        {
          kind: 'text',
          text: `Al momento dell'iscrizione ti chiediamo di dichiarare il tuo anno di nascita. Conserviamo solo l'esito della verifica e, per i minori, l'indicazione che il consenso genitoriale è stato raccolto dall'organizzatore. Se ritieni che un minore si sia iscritto senza il consenso richiesto, scrivici a ${c.email} e rimuoveremo l'account.`,
        },
      ],
    },
    {
      title: 'Notifiche push',
      blocks: [{
        kind: 'text',
        text: "Le notifiche push sono facoltative e vengono attivate solo con una tua azione esplicita e con il permesso del browser/dispositivo. Le usiamo unicamente per avvisarti di eventi di gioco rilevanti (es. esito duelli, missioni completate, salita di livello, boss sconfitti) e di comunicazioni degli organizzatori. Puoi revocarle in qualsiasi momento dal pannello Notifiche o dalle impostazioni del browser: la sottoscrizione viene eliminata e quelle non più valide sono rimosse automaticamente.",
      }],
    },
    {
      title: 'Statistiche di utilizzo',
      blocks: [{
        kind: 'text',
        text: "Le statistiche sono facoltative e disattivate finché non le accetti. Se acconsenti, usiamo PostHog (server nell'Unione Europea) per capire come viene usato il gioco. Non registriamo la navigazione schermo per schermo, non usiamo tracciamento pubblicitario e non cediamo questi dati a terzi per finalità di marketing. Puoi cambiare idea in qualsiasi momento dalle impostazioni del tuo profilo: da quel momento smettiamo di raccogliere nuovi eventi.",
      }],
    },
    {
      title: 'Conservazione',
      blocks: [
        {
          kind: 'list',
          items: [
            "i dati di profilo restano associati all'account finché l'account non viene eliminato",
            `i dati di gioco e di sessione vengono cancellati automaticamente ${RETENTION_MONTHS} mesi dopo la chiusura dell'evento a cui si riferiscono, o prima se l'organizzatore rimuove la sessione o se cancelli l'account`,
            "l'albo d'oro di un evento (nome e punteggio finale dei primi classificati) viene conservato anche dopo la cancellazione dei dati di gioco, perché è il risultato pubblico della manifestazione; puoi chiederne la rimozione scrivendoci",
            'i log tecnici e operativi sono mantenuti per il tempo strettamente necessario a diagnosi, sicurezza e gestione del servizio',
          ],
        },
        {
          kind: 'text',
          text: `La cancellazione a ${RETENTION_MONTHS} mesi è automatica: non serve chiederla. Se vuoi eliminare i tuoi dati prima, puoi cancellare l'account in qualsiasi momento dal tuo profilo.`,
        },
      ],
    },
    {
      title: 'Chi può ricevere i dati',
      blocks: [{
        kind: 'list',
        items: [
          'fornitori tecnici indispensabili per autenticazione, database, hosting e mappe',
          "organizzatori o amministratori dell'evento per funzioni operative strettamente collegate alla sessione",
        ],
      }],
    },
    {
      title: 'I tuoi diritti',
      blocks: [
        {
          kind: 'list',
          items: [
            'accesso, rettifica, cancellazione, limitazione, opposizione e portabilità dei dati nei limiti previsti dalla legge',
            'revoca del consenso già prestato, senza pregiudicare i trattamenti già effettuati',
            "reclamo all'autorità di controllo competente",
          ],
        },
        {
          kind: 'text',
          text: `Puoi eliminare l'account e i dati di gioco collegati in autonomia dal tuo profilo, sezione "Gestione account". Per ogni altra richiesta scrivi a ${c.email}.`,
        },
      ],
    },
    {
      title: 'Autorità di controllo',
      blocks: [{
        kind: 'text',
        text: 'Hai il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali (www.garanteprivacy.it) se ritieni che il trattamento dei tuoi dati violi il Regolamento UE 2016/679 (GDPR).',
      }],
    },
  ]
}
