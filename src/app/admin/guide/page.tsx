const tocItems = [
  { id: 'overview',       label: 'Panoramica' },
  { id: 'sessions',       label: 'Sessioni' },
  { id: 'invites',        label: 'Inviti & QR Code' },
  { id: 'creatures',      label: 'Creature' },
  { id: 'missions',       label: 'Missioni' },
  { id: 'players',        label: 'Giocatori' },
  { id: 'notifications',  label: 'Notifiche' },
  { id: 'leaderboard',    label: 'Classifica' },
  { id: 'workflow',       label: 'Flusso operativo' },
]

/* ──────────────────── small primitives ──────────────────── */

function SectionHeader({ color = '#3A9DBC', children }: { color?: string; children: React.ReactNode }) {
  return (
    <h2
      style={{
        color,
        fontSize: '1.35rem',
        fontWeight: 700,
        marginBottom: '0.75rem',
        paddingBottom: '0.4rem',
        borderBottom: `2px solid ${color}33`,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </h2>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        color: '#e2e8f0',
        fontSize: '0.95rem',
        fontWeight: 600,
        marginTop: '1.2rem',
        marginBottom: '0.4rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        opacity: 0.85,
      }}
    >
      {children}
    </h3>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#94a3b8', lineHeight: 1.75, marginBottom: '0.75rem', fontSize: '0.95rem' }}>
      {children}
    </p>
  )
}

function Callout({
  type = 'tip',
  children,
}: {
  type?: 'tip' | 'warning' | 'critical' | 'info'
  children: React.ReactNode
}) {
  const map = {
    tip:      { border: '#34D399', bg: '#34D39912', icon: '💡' },
    warning:  { border: '#F7C841', bg: '#F7C84112', icon: '⚠️' },
    critical: { border: '#E85D2F', bg: '#E85D2F12', icon: '🚨' },
    info:     { border: '#3A9DBC', bg: '#3A9DBC12', icon: 'ℹ️' },
  }
  const { border, bg, icon } = map[type]
  return (
    <div
      style={{
        borderLeft: `4px solid ${border}`,
        background: bg,
        borderRadius: '0 8px 8px 0',
        padding: '0.75rem 1rem',
        margin: '1rem 0',
        fontSize: '0.9rem',
        color: '#cbd5e1',
        lineHeight: 1.65,
      }}
    >
      <span style={{ marginRight: '0.4rem' }}>{icon}</span>
      {children}
    </div>
  )
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: '1.25rem', margin: '0.5rem 0', color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.8 }}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: '4px',
        padding: '1px 7px',
        fontSize: '0.78rem',
        fontFamily: 'monospace',
        fontWeight: 600,
        marginRight: '0.3rem',
        marginBottom: '0.25rem',
      }}
    >
      {label}
    </span>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'monospace',
        background: '#ffffff0f',
        border: '1px solid #ffffff18',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '0.87em',
        color: '#7dd3fc',
      }}
    >
      {children}
    </code>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #ffffff0f', margin: '2rem 0' }} />
}

/* ──────────────────── flow diagram ──────────────────── */

function FlowDiagram() {
  const steps = ['Sessione', 'Inviti', 'Giocatori', 'Missioni / Creature', 'Partita in corso', 'Classifica']
  const colors = ['#3A9DBC', '#7B4DB8', '#34D399', '#F7C841', '#E85D2F', '#F7C841']
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0',
        margin: '1.25rem 0',
        rowGap: '0.5rem',
      }}
    >
      {steps.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              background: `${colors[i]}18`,
              border: `1.5px solid ${colors[i]}55`,
              borderRadius: '8px',
              padding: '6px 14px',
              color: colors[i],
              fontSize: '0.82rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {step}
          </div>
          {i < steps.length - 1 && (
            <span style={{ color: '#475569', fontSize: '1rem', padding: '0 6px' }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ──────────────────── workflow timeline ──────────────────── */

const workflowSteps = [
  { icon: '✅', text: 'Crea la sessione con area GPS e date' },
  { icon: '✅', text: 'Genera N codici invito (uno per partecipante)' },
  { icon: '✅', text: 'Verifica che le creature abbiano artwork (genera con AI se mancante)' },
  { icon: '✅', text: 'Crea 3–5 missioni bilanciate per la sessione' },
  { icon: '✅', text: 'Stampa / condividi i QR code' },
  { icon: '✅', text: 'Attiva la sessione quando inizia l\'evento' },
  { icon: '👀', text: 'Monitora giocatori e invia notifiche durante il gioco' },
  { icon: '🏆', text: 'A fine sessione: consulta classifica, premia i vincitori' },
]

function WorkflowTimeline() {
  return (
    <div style={{ margin: '1rem 0', position: 'relative' }}>
      {/* vertical rail */}
      <div
        style={{
          position: 'absolute',
          left: '18px',
          top: '8px',
          bottom: '8px',
          width: '2px',
          background: 'linear-gradient(to bottom, #3A9DBC44, #F7C84144)',
          borderRadius: '2px',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {workflowSteps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            {/* dot */}
            <div
              style={{
                flexShrink: 0,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#1a2f42',
                border: '2px solid #3A9DBC44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                zIndex: 1,
              }}
            >
              {step.icon}
            </div>
            {/* content */}
            <div
              style={{
                flex: 1,
                background: '#ffffff06',
                border: '1px solid #ffffff0e',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#3A9DBC22',
                  color: '#3A9DBC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.5 }}>{step.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────── mission type table ──────────────────── */

const missionTypes = [
  { type: 'catch_creature', desc: 'Cattura N creature di un elemento specifico', color: '#34D399' },
  { type: 'explore',        desc: 'Raggiungi una posizione GPS specifica',         color: '#3A9DBC' },
  { type: 'duel_win',       desc: 'Vinci N duelli contro altri giocatori',          color: '#E85D2F' },
  { type: 'collect_items',  desc: 'Raccogli oggetti nel negozio di gioco',          color: '#F7C841' },
]

function MissionTable() {
  return (
    <div style={{ margin: '0.75rem 0', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            {['Tipo', 'Descrizione'].map(h => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  color: '#64748b',
                  fontWeight: 600,
                  borderBottom: '1px solid #ffffff12',
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {missionTypes.map(({ type, desc, color }) => (
            <tr key={type} style={{ borderBottom: '1px solid #ffffff08' }}>
              <td style={{ padding: '8px 12px' }}>
                <Badge label={type} color={color} />
              </td>
              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ──────────────────── element badges ──────────────────── */

const elements = [
  { name: 'Fiamma',    color: '#E85D2F' },
  { name: 'Adriatico', color: '#3A9DBC' },
  { name: 'Bosco',     color: '#34D399' },
  { name: 'Terra',     color: '#F7C841' },
  { name: 'Armonia',   color: '#7B4DB8' },
]

/* ──────────────────── ToC ──────────────────── */

function TableOfContents() {
  return (
    <nav
      aria-label="Indice"
      style={{
        width: '220px',
        flexShrink: 0,
        position: 'sticky',
        top: '24px',
        alignSelf: 'flex-start',
        background: '#0a1825',
        border: '1px solid #ffffff10',
        borderRadius: '12px',
        padding: '1rem',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
      }}
    >
      <p
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#475569',
          marginBottom: '0.75rem',
        }}
      >
        In questa pagina
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {tocItems.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              style={{
                display: 'block',
                padding: '5px 8px',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '0.84rem',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = '#3A9DBC18'
                ;(e.currentTarget as HTMLElement).style.color = '#3A9DBC'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
              }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ──────────────────── mobile pill nav (rendered via CSS) ──────────────────── */

function MobileToc() {
  return (
    <nav
      aria-label="Navigazione sezioni"
      style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '0.4rem',
        paddingBottom: '4px',
        marginBottom: '1.5rem',
        scrollbarWidth: 'none',
      }}
    >
      {tocItems.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          style={{
            flexShrink: 0,
            display: 'inline-block',
            padding: '5px 12px',
            borderRadius: '20px',
            background: '#ffffff0a',
            border: '1px solid #ffffff15',
            color: '#94a3b8',
            fontSize: '0.8rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}

/* ──────────────────── main page ──────────────────── */

export default function AdminGuidePage() {
  return (
    <>
      {/* Responsive layout styles injected via a style tag */}
      <style>{`
        .guide-layout {
          display: flex;
          gap: 2rem;
          align-items: flex-start;
        }
        .guide-toc-desktop { display: block; }
        .guide-toc-mobile  { display: none; }

        @media (max-width: 860px) {
          .guide-layout { display: block; }
          .guide-toc-desktop { display: none; }
          .guide-toc-mobile  { display: flex; }
        }

        .guide-section {
          scroll-margin-top: 24px;
        }

        /* smooth scrolling */
        html { scroll-behavior: smooth; }
      `}</style>

      <div style={{ maxWidth: '960px' }}>
        {/* Page title */}
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem' }}>📖</span>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#f1f5f9',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Guida per l&rsquo;Amministratore
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '0.25rem' }}>
            Manuale operativo &mdash; WildCatch Game Master Handbook
          </p>
        </header>

        {/* Mobile ToC */}
        <div className="guide-toc-mobile">
          <MobileToc />
        </div>

        {/* Desktop: side-by-side */}
        <div className="guide-layout">
          {/* Desktop ToC */}
          <div className="guide-toc-desktop">
            <TableOfContents />
          </div>

          {/* Main article */}
          <article style={{ flex: 1, minWidth: 0 }}>

            {/* ── 1. Panoramica ── */}
            <section id="overview" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>1. Panoramica</SectionHeader>
              <Prose>
                Il pannello admin ti permette di orchestrare l&rsquo;intera esperienza di gioco.
                Crea sessioni, invita giocatori, gestisci creature e missioni, monitora in tempo reale
                l&rsquo;andamento della partita e decreta il vincitore finale.
              </Prose>

              <SubHeader>Ciclo di vita di una partita</SubHeader>
              <FlowDiagram />

              <Callout type="info">
                Ogni elemento del flusso ha una sezione dedicata in questa guida. Scorri o usa la
                navigazione a sinistra per saltare direttamente alla sezione che ti serve.
              </Callout>
            </section>

            <Divider />

            {/* ── 2. Sessioni ── */}
            <section id="sessions" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>2. Sessioni</SectionHeader>
              <Prose>
                Una <strong style={{ color: '#e2e8f0' }}>sessione</strong> è il &ldquo;contenitore&rdquo; di
                una partita. Definisce l&rsquo;area geografica (lat/lng + raggio), la durata, e raggruppa
                tutti i giocatori invitati. Senza una sessione attiva, nessun giocatore può partecipare.
              </Prose>

              <SubHeader>Come creare una sessione</SubHeader>
              <StepList
                items={[
                  'Vai in Admin → Sessioni → "Nuova Sessione"',
                  'Inserisci nome, descrizione, date di inizio e fine',
                  'Imposta il centro GPS e il raggio d\'azione (es. 500 m per un campus universitario)',
                  'Attiva la sessione — diventa immediatamente disponibile per i giocatori invitati',
                ]}
              />

              <Callout type="warning">
                <strong>Attenzione al raggio:</strong> modificare il raggio dopo che i giocatori sono
                entrati può escludere chi si trova fuori dall&rsquo;area aggiornata. Pianifica l&rsquo;area
                prima di condividere i codici invito.
              </Callout>

              <SubHeader>Stati della sessione</SubHeader>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <Badge label="draft"    color="#94a3b8" />
                <Badge label="active"   color="#34D399" />
                <Badge label="finished" color="#E85D2F" />
              </div>
              <p style={{ color: '#64748b', fontSize: '0.83rem', marginTop: '0.4rem' }}>
                Solo le sessioni <Code>active</Code> sono visibili ai giocatori nell&rsquo;app.
              </p>
            </section>

            <Divider />

            {/* ── 3. Inviti & QR ── */}
            <section id="invites" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>3. Inviti &amp; QR Code</SectionHeader>
              <Prose>
                Ogni sessione ha uno o più codici invito univoci. I giocatori inseriscono il codice
                nella schermata <Code>/join</Code> per partecipare alla sessione. Ogni codice è
                <strong style={{ color: '#e2e8f0' }}> monouso</strong>: un codice → un giocatore.
              </Prose>

              <SubHeader>Come generare inviti</SubHeader>
              <StepList
                items={[
                  'Admin → Inviti → seleziona la sessione → "Genera Invito"',
                  'Ogni codice è monouso (un giocatore per codice)',
                  'Admin → QR Codes → stampa / esporta i QR da distribuire fisicamente agli iscritti',
                ]}
              />

              <Callout type="tip">
                <strong>Consiglio pratico:</strong> genera tanti codici quanti sono i partecipanti
                attesi. Se ne aggiungi altri all&rsquo;ultimo minuto, puoi sempre generarne di nuovi
                senza invalidare quelli già emessi.
              </Callout>

              <SubHeader>Distribuzione dei codici</SubHeader>
              <div
                style={{
                  background: '#ffffff06',
                  border: '1px solid #ffffff10',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.88rem',
                  color: '#94a3b8',
                  lineHeight: 1.7,
                }}
              >
                <strong style={{ color: '#e2e8f0' }}>Fisico:</strong> stampa i QR code e consegnali
                all&rsquo;ingresso dell&rsquo;evento.<br />
                <strong style={{ color: '#e2e8f0' }}>Digitale:</strong> condividi il codice testuale
                via email, chat o foglio di iscrizione.
              </div>
            </section>

            <Divider />

            {/* ── 4. Creature ── */}
            <section id="creatures" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>4. Creature</SectionHeader>
              <Prose>
                Le creature sono il cuore del gioco. Ogni creatura ha: nome, elemento, rarità,
                statistiche di combattimento (HP / ATK / DEF), descrizione narrativa e immagine.
                Una creatura senza artwork appare come sagoma vuota nell&rsquo;app — assicurati di
                completare tutte le immagini prima di attivare la sessione.
              </Prose>

              <SubHeader>Elementi disponibili</SubHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {elements.map(({ name, color }) => (
                  <Badge key={name} label={name} color={color} />
                ))}
              </div>

              <SubHeader>Rarità</SubHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {[
                  { label: 'comune',     color: '#94a3b8' },
                  { label: 'non comune', color: '#34D399' },
                  { label: 'raro',       color: '#3A9DBC' },
                  { label: 'epico',      color: '#7B4DB8' },
                  { label: 'leggendario',color: '#F7C841' },
                ].map(({ label, color }) => <Badge key={label} label={label} color={color} />)}
              </div>

              <SubHeader>Gestire le creature</SubHeader>
              <StepList
                items={[
                  'Admin → Creature → mostra tutte le creature disponibili nel database',
                  'Clicca su una creatura per vedere / modificare nome, stats e artwork',
                  'Tab 🔗 URL — incolla un URL immagine esterno per l\'artwork manuale',
                  'Tab ✨ AI — scrivi un prompt descrittivo e seleziona la qualità di generazione',
                ]}
              />

              <Callout type="info">
                <strong>Qualità generazione AI:</strong>{' '}
                <Code>Low</Code> $0.01 &nbsp;·&nbsp;
                <Code>Medium</Code> $0.04 &nbsp;·&nbsp;
                <Code>High</Code> $0.17 per immagine.
                Per eventi con molte creature usa <Code>Medium</Code> come compromesso qualità/costo.
              </Callout>

              <Callout type="tip">
                <strong>Prompt AI efficaci:</strong> sii specifico sull&rsquo;elemento visivo,
                lo stile e lo sfondo. Esempio:{' '}
                <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>
                  &ldquo;Drago marino azzurro con pinne luminose, stile chibi fantasy,
                  sfondo trasparente&rdquo;
                </span>{' '}
                &mdash; più dettagli fornisci, più il risultato sarà coerente con il tuo mondo di gioco.
              </Callout>
            </section>

            <Divider />

            {/* ── 5. Missioni ── */}
            <section id="missions" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>5. Missioni</SectionHeader>
              <Prose>
                Le missioni sono obiettivi speciali assegnati ai giocatori durante una sessione.
                Aumentano l&rsquo;engagement, spingono i giocatori a esplorare l&rsquo;area e danno
                ricompense extra in EXP e monete di gioco.
              </Prose>

              <SubHeader>Tipi di missione</SubHeader>
              <MissionTable />

              <SubHeader>Come creare una missione</SubHeader>
              <StepList
                items={[
                  'Admin → Missioni → seleziona la sessione → "Nuova Missione"',
                  'Imposta titolo, tipo, obiettivo numerico (es. "cattura 3 creature")',
                  'Definisci la ricompensa: EXP + monete proporzionali alla difficoltà',
                  'Pubblica la missione — i giocatori la vedono immediatamente nell\'app',
                ]}
              />

              <Callout type="warning">
                <strong>Bilanciamento difficoltà:</strong> missioni difficili devono sempre dare
                ricompense significativamente più alte. Un cattivo bilanciamento scoraggia i
                giocatori e penalizza chi non partecipa attivamente ai duelli o all&rsquo;esplorazione.
              </Callout>
            </section>

            <Divider />

            {/* ── 6. Giocatori ── */}
            <section id="players" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>6. Giocatori</SectionHeader>
              <Prose>
                La sezione giocatori mostra tutti gli iscritti alle sessioni attive, con il loro
                stato in tempo reale. È il tuo pannello di controllo durante l&rsquo;evento.
              </Prose>

              <SubHeader>Cosa vedi per ogni giocatore</SubHeader>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '0.6rem',
                  margin: '0.5rem 0 1rem',
                }}
              >
                {[
                  { label: 'Nome & Email',       icon: '👤', color: '#3A9DBC' },
                  { label: 'Sessione',            icon: '🎮', color: '#7B4DB8' },
                  { label: 'Creature catturate',  icon: '🐾', color: '#34D399' },
                  { label: 'EXP totale',          icon: '⚡', color: '#F7C841' },
                  { label: 'Ultima attività',     icon: '🕒', color: '#94a3b8' },
                  { label: 'Creatura attiva',     icon: '⚔️', color: '#E85D2F' },
                ].map(({ label, icon, color }) => (
                  <div
                    key={label}
                    style={{
                      background: '#ffffff06',
                      border: '1px solid #ffffff0e',
                      borderRadius: '8px',
                      padding: '0.6rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    <span style={{ color, fontSize: '0.83rem', fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>

              <SubHeader>Azioni admin sui giocatori</SubHeader>
              <StepList
                items={[
                  'Invia una notifica diretta a un singolo giocatore',
                  'Broadcast a tutti i giocatori della sessione (vedi sezione Notifiche)',
                  'Monitora attività sospette — tempi di cattura anomali o posizioni impossibili',
                ]}
              />
            </section>

            <Divider />

            {/* ── 7. Notifiche ── */}
            <section id="notifications" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>7. Notifiche</SectionHeader>
              <Prose>
                Puoi inviare messaggi in tempo reale a tutti i giocatori di una sessione.
                I giocatori ricevono un popup immediato nell&rsquo;app — utilissimo per annunci
                di evento o aggiornamenti urgenti durante il gioco.
              </Prose>

              <SubHeader>Come inviare una notifica broadcast</SubHeader>
              <StepList
                items={[
                  'Admin → Giocatori → "Notifica tutti" (oppure dalla Dashboard → campo broadcast)',
                  'Scrivi il messaggio e premi Invia',
                  'Tutti i giocatori della sessione ricevono il popup in meno di 2 secondi',
                ]}
              />

              <SubHeader>Esempi di utilizzo</SubHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.5rem 0' }}>
                {[
                  { msg: '"La sessione finisce tra 10 minuti!"', type: 'warning' as const },
                  { msg: '"Evento speciale: una creatura leggendaria è apparsa!"', type: 'tip' as const },
                  { msg: '"Complimenti al vincitore — sessione terminata!"', type: 'info' as const },
                ].map(({ msg, type }) => (
                  <Callout key={msg} type={type}>{msg}</Callout>
                ))}
              </div>
            </section>

            <Divider />

            {/* ── 8. Classifica ── */}
            <section id="leaderboard" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>8. Classifica</SectionHeader>
              <Prose>
                La classifica mostra i giocatori ordinati per EXP totale accumulata nella sessione.
                Si aggiorna in tempo reale e può essere filtrata per sessione.
              </Prose>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  margin: '1rem 0',
                }}
              >
                {[
                  { title: 'Tempo reale',     desc: 'Si aggiorna automaticamente senza ricaricare la pagina', icon: '⚡', color: '#34D399' },
                  { title: 'Filtra sessione', desc: 'Visualizza la classifica di una sessione specifica',      icon: '🔍', color: '#3A9DBC' },
                  { title: 'Premiazioni',     desc: 'Usa la classifica finale per decidere i vincitori',       icon: '🏆', color: '#F7C841' },
                ].map(({ title, desc, icon, color }) => (
                  <div
                    key={title}
                    style={{
                      background: `${color}0d`,
                      border: `1px solid ${color}2a`,
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>{icon}</div>
                    <p style={{ color, fontWeight: 600, fontSize: '0.88rem', margin: '0 0 0.2rem' }}>{title}</p>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* ── 9. Flusso operativo ── */}
            <section id="workflow" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader color="#F7C841">9. Flusso operativo consigliato</SectionHeader>
              <Prose>
                Segui questa checklist nell&rsquo;ordine indicato per ogni evento. Saltare un
                passaggio (specialmente i codici invito o l&rsquo;artwork) è la causa più comune
                di problemi durante le sessioni live.
              </Prose>

              <WorkflowTimeline />

              <Callout type="critical">
                <strong>Non dimenticare:</strong> attiva la sessione solo quando sei pronto a
                iniziare l&rsquo;evento. Una sessione attiva con giocatori connessi non può essere
                modificata nella geografia senza rischiare di escludere partecipanti.
              </Callout>

              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: '#ffffff05',
                  border: '1px solid #ffffff0e',
                  borderRadius: '10px',
                  fontSize: '0.83rem',
                  color: '#475569',
                  textAlign: 'center',
                }}
              >
                WildCatch Admin Handbook &mdash; versione 2026 &nbsp;·&nbsp;
                <span style={{ color: '#3A9DBC' }}>wildcat.game</span>
              </div>
            </section>

          </article>
        </div>
      </div>
    </>
  )
}
