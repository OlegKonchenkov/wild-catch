import { LEGAL, MIN_AGE_WITHOUT_PARENT, resolveController } from '@/lib/legal/controller'
import type { PolicySectionData } from '@/lib/legal/privacy'

/**
 * Terms of Service.
 *
 * ⚠️ DRAFT — needs review by a lawyer before it is relied on commercially.
 * It is written against what the app actually does (outdoor geolocated play,
 * time-boxed event sessions, invite codes, session-scoped virtual currency,
 * physical prizes handed out by the organiser) rather than from a generic
 * template, so a review should be a pass over specifics rather than a rewrite.
 * The areas most worth a professional eye: the liability wording in
 * "Gioca in sicurezza", the consumer-law carve-outs, and whether the organiser
 * or the publisher is the counterparty for physical prizes.
 *
 * Until now there were no terms at all, which blocks both app stores and leaves
 * the outdoor-safety question — the one real physical risk this product carries
 * — completely unaddressed.
 */
export function buildTermsSections(contactEmail?: string | null): PolicySectionData[] {
  const c = resolveController(null, contactEmail)

  return [
    {
      title: 'Chi siamo',
      blocks: [{ kind: 'contact' }],
    },
    {
      title: "Cos'è Daimon",
      blocks: [{
        kind: 'text',
        text: `${LEGAL.appName} è un gioco all'aperto: cammini in un'area reale definita dall'organizzatore e usi il telefono per incontrare, catturare e far crescere creature virtuali. Si gioca per "sessioni", cioè eventi con un inizio e una fine decisi da chi organizza. Fuori da una sessione attiva molte funzioni non sono disponibili.`,
      }],
    },
    {
      title: 'Accesso e account',
      blocks: [
        {
          kind: 'text',
          text: "Per partecipare servono un account e, per gli eventi su invito, un codice fornito dall'organizzatore. Sei responsabile di ciò che avviene tramite il tuo account e delle credenziali che usi per accedere.",
        },
        {
          kind: 'text',
          text: `Devi avere almeno ${MIN_AGE_WITHOUT_PARENT} anni per iscriverti da solo. Al di sotto di tale età puoi partecipare solo con il consenso di chi esercita la responsabilità genitoriale, che deve essere presente all'evento.`,
        },
      ],
    },
    {
      title: 'Gioca in sicurezza',
      blocks: [
        {
          kind: 'text',
          text: 'Questa è la parte più importante di questo documento. Daimon si gioca camminando nel mondo reale: il gioco non conosce il traffico, i dislivelli, i cantieri, le condizioni meteo o gli spazi privati intorno a te.',
        },
        {
          kind: 'list',
          items: [
            'guarda dove metti i piedi e alza gli occhi dallo schermo quando ti muovi',
            'non giocare mentre guidi o vai in bicicletta',
            'rispetta il codice della strada, la segnaletica e le aree private o vietate',
            'non entrare in luoghi pericolosi, chiusi o non accessibili al pubblico per raggiungere un obiettivo di gioco',
            'presta attenzione alle altre persone, in particolare in luoghi affollati',
            "interrompi il gioco se le condizioni non sono sicure: nessun contenuto vale un rischio",
          ],
        },
        {
          kind: 'text',
          text: "Nessun elemento del gioco richiede di infrangere regole o di mettersi in pericolo. Resti responsabile del tuo comportamento durante il gioco; questo non esclude né limita la nostra responsabilità nei casi in cui la legge non lo consente, in particolare per dolo o colpa grave e per danni alla persona.",
        },
      ],
    },
    {
      title: 'Regole di comportamento',
      blocks: [{
        kind: 'list',
        items: [
          'non falsificare la posizione GPS e non usare strumenti per automatizzare o alterare il gioco',
          'non tentare di accedere ad account, dati o funzioni di amministrazione altrui',
          'non molestare, minacciare o discriminare altri partecipanti; scegli un nickname rispettoso',
          "non danneggiare o rimuovere i materiali fisici dell'evento (QR code, cartelli, allestimenti)",
          'non usare il servizio per scopi illeciti o per interferire con il suo funzionamento',
        ],
      }],
    },
    {
      title: 'Oggetti e valute di gioco',
      blocks: [
        {
          kind: 'text',
          text: "Oro, gemme, oggetti, creature e progressi sono contenuti virtuali concessi in uso all'interno del gioco. Non sono di tua proprietà, non hanno valore monetario, non sono convertibili in denaro e non sono trasferibili fuori dal gioco.",
        },
        {
          kind: 'text',
          text: "I progressi sono legati alla singola sessione: quando l'evento si chiude, la relativa progressione non prosegue. Possiamo inoltre modificare il bilanciamento del gioco (valori, ricompense, disponibilità dei contenuti) per ragioni di equilibrio o di sicurezza.",
        },
      ],
    },
    {
      title: 'Premi fisici',
      blocks: [{
        kind: 'text',
        text: "Alcuni eventi prevedono premi fisici. Modalità, requisiti, quantità e consegna sono stabiliti e gestiti dall'organizzatore dell'evento, che ne è il responsabile. Per qualsiasi questione relativa a un premio fisico rivolgiti in primo luogo a chi organizza l'evento a cui hai partecipato.",
      }],
    },
    {
      title: 'Disponibilità del servizio',
      blocks: [{
        kind: 'text',
        text: "Il servizio dipende da fattori che non controlliamo completamente, come la copertura di rete e la precisione del GPS del tuo dispositivo. Possiamo sospenderlo o modificarlo per manutenzione, sicurezza o aggiornamenti. Non garantiamo che il gioco sia sempre disponibile o privo di errori.",
      }],
    },
    {
      title: 'Sospensione e chiusura',
      blocks: [
        {
          kind: 'text',
          text: 'Possiamo sospendere o chiudere un account in caso di violazioni gravi o ripetute di questi termini, in particolare per alterazione del gioco o comportamenti lesivi verso altri partecipanti. Dove ragionevole ti avviseremo indicandone il motivo.',
        },
        {
          kind: 'text',
          text: 'Puoi chiudere il tuo account in qualsiasi momento dal tuo profilo, sezione "Gestione account". La cancellazione rimuove il tuo account e i dati di gioco collegati.',
        },
      ],
    },
    {
      title: 'Modifiche ai termini',
      blocks: [{
        kind: 'text',
        text: "Possiamo aggiornare questi termini, ad esempio per nuove funzioni o per adeguamenti normativi. La data di ultimo aggiornamento è indicata in cima a questa pagina. Se le modifiche sono sostanziali cercheremo di segnalartele nell'app; continuando a usare il servizio dopo l'aggiornamento accetti la nuova versione.",
      }],
    },
    {
      title: 'Legge applicabile e contatti',
      blocks: [
        {
          kind: 'text',
          text: "Questi termini sono regolati dalla legge italiana. Se agisci come consumatore restano fermi i diritti inderogabili riconosciuti dalla normativa a tua tutela, compreso il foro del tuo luogo di residenza o domicilio.",
        },
        {
          kind: 'text',
          text: `Per qualsiasi domanda o segnalazione scrivici a ${c.email}.`,
        },
      ],
    },
  ]
}
