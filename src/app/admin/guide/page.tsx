'use client'
import { useState, useMemo } from 'react'

const tocItems = [
  { id: 'overview',      label: 'Panoramica' },
  { id: 'sessions',      label: 'Sessioni' },
  { id: 'invites',       label: 'Inviti' },
  { id: 'qrcodes',       label: 'QR Code' },
  { id: 'creatures',     label: 'Creature & Elementi' },
  { id: 'items',         label: 'Oggetti & Negozio' },
  { id: 'missions',      label: 'Missioni' },
  { id: 'levelrewards',  label: 'Ricompense Livello' },
  { id: 'players',       label: 'Giocatori' },
  { id: 'notifications', label: 'Notifiche' },
  { id: 'leaderboard',   label: 'Classifica' },
  { id: 'workflow',      label: 'Flusso operativo' },
]

/* ──────────────────── small primitives ──────────────────── */

function SectionHeader({ color = '#3A9DBC', children }: { color?: string; children: React.ReactNode }) {
  return (
    <h2 style={{ color, fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.75rem',
      paddingBottom: '0.4rem', borderBottom: `2px solid ${color}33`, letterSpacing: '-0.01em' }}>
      {children}
    </h2>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600, marginTop: '1.2rem',
      marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85 }}>
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

function Callout({ type = 'tip', children }: { type?: 'tip' | 'warning' | 'critical' | 'info'; children: React.ReactNode }) {
  const map = {
    tip:      { border: '#34D399', bg: '#34D39912', icon: '💡' },
    warning:  { border: '#F7C841', bg: '#F7C84112', icon: '⚠️' },
    critical: { border: '#E85D2F', bg: '#E85D2F12', icon: '🚨' },
    info:     { border: '#3A9DBC', bg: '#3A9DBC12', icon: 'ℹ️' },
  }
  const { border, bg, icon } = map[type]
  return (
    <div style={{ borderLeft: `4px solid ${border}`, background: bg, borderRadius: '0 8px 8px 0',
      padding: '0.75rem 1rem', margin: '1rem 0', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.65 }}>
      <span style={{ marginRight: '0.4rem' }}>{icon}</span>
      {children}
    </div>
  )
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: '1.25rem', margin: '0.5rem 0', color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.8 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', background: `${color}22`, color, border: `1px solid ${color}55`,
      borderRadius: '4px', padding: '1px 7px', fontSize: '0.78rem', fontFamily: 'monospace',
      fontWeight: 600, marginRight: '0.3rem', marginBottom: '0.25rem' }}>
      {label}
    </span>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: 'monospace', background: '#ffffff0f', border: '1px solid #ffffff18',
      borderRadius: '4px', padding: '1px 6px', fontSize: '0.87em', color: '#7dd3fc' }}>
      {children}
    </code>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #ffffff0f', margin: '2rem 0' }} />
}

/* ──────────────────── element table ──────────────────── */

const ELEMENT_ROWS = [
  { el: 'Fiamma 🔥',    color: '#E85D2F', strong: 'Bosco, Armonia',          weak: 'Adriatico, Terra' },
  { el: 'Adriatico 💧', color: '#3A9DBC', strong: 'Fiamma, Terra',           weak: 'Bosco' },
  { el: 'Bosco 🌿',     color: '#34D399', strong: 'Adriatico',               weak: 'Fiamma' },
  { el: 'Terra 🪨',     color: '#F7C841', strong: 'Fiamma, Armonia',         weak: 'Adriatico' },
  { el: 'Armonia ✨',   color: '#C084FC', strong: '+15% vs tutti (flat)',     weak: 'Fiamma, Terra' },
]

function ElementTable() {
  return (
    <div style={{ margin: '0.75rem 0', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            {['Elemento', 'Forte contro (×1.5)', 'Debole contro (×0.5)'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600,
                borderBottom: '1px solid #ffffff12', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ELEMENT_ROWS.map(({ el, color, strong, weak }) => (
            <tr key={el} style={{ borderBottom: '1px solid #ffffff08' }}>
              <td style={{ padding: '8px 12px' }}><Badge label={el} color={color} /></td>
              <td style={{ padding: '8px 12px', color: '#34D399', fontSize: '0.83rem' }}>{strong}</td>
              <td style={{ padding: '8px 12px', color: '#E85D2F', fontSize: '0.83rem' }}>{weak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ──────────────────── QR types table ──────────────────── */

const QR_TYPES = [
  { type: 'oggetto',  color: '#3A9DBC', desc: 'Aggiunge direttamente un oggetto all\'inventario del giocatore', fields: 'item_id, quantity' },
  { type: 'uovo',     color: '#C084FC', desc: 'Crea un\'uovo nello zaino. Il giocatore deve camminare X passi prima di schiuderlo.', fields: 'egg_rarity, steps_required' },
  { type: 'boss',     color: '#E85D2F', desc: 'Avvia un boss fight con lineup fino a 3 creature. Ricompensa erogata solo alla prima vittoria per QR.', fields: 'creatures[ ], reward' },
  { type: 'indizio',  color: '#F7C841', desc: 'Sblocca un capitolo narrativo con testo e immagine opzionale', fields: 'chapter_order, text, image_url' },
  { type: 'evento',   color: '#34D399', desc: 'Attiva un bonus temporaneo sull\'intera sessione (EXP, spawn, oro doppio)', fields: 'event_type, multiplier, duration_minutes' },
]

function QrTypeTable() {
  return (
    <div style={{ margin: '0.75rem 0', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            {['Tipo', 'Descrizione', 'Campi payload'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600,
                borderBottom: '1px solid #ffffff12', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {QR_TYPES.map(({ type, color, desc, fields }) => (
            <tr key={type} style={{ borderBottom: '1px solid #ffffff08' }}>
              <td style={{ padding: '8px 12px' }}><Badge label={type} color={color} /></td>
              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{desc}</td>
              <td style={{ padding: '8px 12px' }}><Code>{fields}</Code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ──────────────────── item types table ──────────────────── */

const ITEM_TYPES = [
  { type: 'rete',      color: '#3A9DBC', icon: '🎯', when: 'Automatica durante incontro',     desc: 'Bonus % cattura (effect_value = %). Più alta è la rarità, più aumenta le chance.' },
  { type: 'esca',      color: '#34D399', icon: '🍖', when: 'Giocatore: Zaino → Usa',          desc: 'Attira creature rare per 10 min. L\'app mostra un indicatore quando è attiva.' },
  { type: 'uovo',      color: '#C084FC', icon: '🥚', when: 'Giocatore: Zaino → Usa',          desc: 'Schiusura immediata di una creatura casuale (pool comune/non_comune). Distinto dalle uova QR.' },
  { type: 'battaglia', color: '#FBBF24', icon: '⚔️', when: 'Automatica in duello / boss',    desc: 'Boost ATK flat durante lo scontro (effect_value = bonus ATK).' },
  { type: 'pozione',   color: '#F472B6', icon: '🧪', when: 'Automatica in duello',            desc: 'Azzera il malus ×0.5 di debolezza elementale per tutta la battaglia.' },
  { type: 'cura',      color: '#34D399', icon: '💊', when: 'Automatica in duello',            desc: 'Ripristina HP ogni turno (effect_value = HP ripristinati per turno).' },
]

function ItemTypeTable() {
  return (
    <div style={{ margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {ITEM_TYPES.map(({ type, color, icon, when, desc }) => (
        <div key={type} style={{ background: `${color}0a`, border: `1px solid ${color}25`,
          borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            <Badge label={type} color={color} />
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>{when}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.83rem', margin: 0 }}>{desc}</p>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────── egg rarity pools ──────────────────── */

const EGG_POOLS = [
  { rarity: 'comune',      color: '#9CA3AF', icon: '🥚', pool: '100% comune' },
  { rarity: 'non_comune',  color: '#34D399', icon: '🪺', pool: '70% comune · 30% non comune' },
  { rarity: 'raro',        color: '#3A9DBC', icon: '💎', pool: '50% comune · 30% non comune · 20% raro' },
  { rarity: 'epico',       color: '#C084FC', icon: '🔮', pool: '40% · 30% · 20% · 10% epico' },
  { rarity: 'leggendario', color: '#FBBF24', icon: '⭐', pool: '35% · 25% · 20% · 15% · 5% leggendario' },
]

function EggPoolTable() {
  return (
    <div style={{ margin: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {EGG_POOLS.map(({ rarity, color, icon, pool }) => (
        <div key={rarity} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem',
          background: `${color}0a`, border: `1px solid ${color}25`, borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
          <span style={{ fontSize: '1rem' }}>{icon}</span>
          <Badge label={rarity} color={color} />
          <span style={{ color: '#94a3b8', fontSize: '0.83rem' }}>{pool}</span>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────── mission type table ──────────────────── */

const missionTypes = [
  { type: 'cattura',  desc: 'Cattura una creatura specifica (per nome) o qualunque creatura (target vuoto)',          color: '#3A9DBC' },
  { type: 'duel',     desc: 'Vinci N duelli PvP contro altri giocatori (squadra da 1 a 3 creature)',                  color: '#FBBF24' },
  { type: 'qr',       desc: 'Scansiona un QR code fisico (target = etichetta QR, vuoto = qualunque QR)',              color: '#34D399' },
  { type: 'walk',     desc: 'Percorri una distanza totale in passi GPS durante la sessione',                          color: '#C084FC' },
  { type: 'collect',  desc: 'Acquista un oggetto nel negozio o scansiona un QR oggetto (target = nome oggetto)',      color: '#F97316' },
]

function MissionTable() {
  return (
    <div style={{ margin: '0.75rem 0', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            {['Tipo', 'Descrizione'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600,
                borderBottom: '1px solid #ffffff12', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {missionTypes.map(({ type, desc, color }) => (
            <tr key={type} style={{ borderBottom: '1px solid #ffffff08' }}>
              <td style={{ padding: '8px 12px' }}><Badge label={type} color={color} /></td>
              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ──────────────────── flow diagram ──────────────────── */

function FlowDiagram() {
  const steps = ['Sessione', 'Area Mappa', 'Inviti', 'Creature + QR', 'Oggetti', 'Missioni', 'Active', 'Classifica']
  const colors = ['#3A9DBC', '#34D399', '#7B4DB8', '#F7C841', '#3A9DBC', '#FBBF24', '#E85D2F', '#F7C841']
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0', margin: '1.25rem 0', rowGap: '0.5rem' }}>
      {steps.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ background: `${colors[i]}18`, border: `1.5px solid ${colors[i]}55`, borderRadius: '8px',
            padding: '6px 14px', color: colors[i], fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {step}
          </div>
          {i < steps.length - 1 && <span style={{ color: '#475569', fontSize: '1rem', padding: '0 6px' }}>→</span>}
        </div>
      ))}
    </div>
  )
}

/* ──────────────────── workflow timeline ──────────────────── */

const workflowSteps = [
  { icon: '✅', text: 'Crea la sessione con area GPS, durata, testo narrativo e kit iniziale oggetti' },
  { icon: '✅', text: 'Verifica l\'area mappa (trascina i marker per adattarla al venue)' },
  { icon: '✅', text: 'Genera N codici invito (uno per partecipante) ed esporta i QR da stampare' },
  { icon: '✅', text: 'Verifica che le creature abbiano artwork (genera con AI se mancante)' },
  { icon: '✅', text: 'Opzionale: aggiungi Frammenti Enigma alle creature per contenuti segreti post-cattura' },
  { icon: '✅', text: 'Configura oggetti nel negozio — imposta prezzi e effect_value per ogni tipo' },
  { icon: '✅', text: 'Crea 3–5 missioni bilanciate — includi almeno una di tipo QR e una di tipo walk' },
  { icon: '✅', text: 'Crea i QR code di gioco: oggetti, uova (con steps_required), boss fight, indizi' },
  { icon: '✅', text: 'Configura ricompense per ogni livello (Admin → Ricompense Livello)' },
  { icon: '✅', text: 'Stampa e nascondi i QR code fisici nell\'area evento' },
  { icon: '✅', text: 'Porta la sessione a "Ready" → poi "Active" quando inizia l\'evento' },
  { icon: '👀', text: 'Monitora giocatori e invia notifiche broadcast durante il gioco' },
  { icon: '🏆', text: 'A fine sessione: consulta classifica, premia i vincitori' },
]

function WorkflowTimeline() {
  return (
    <div style={{ margin: '1rem 0', position: 'relative' }}>
      <div style={{ position: 'absolute', left: '18px', top: '8px', bottom: '8px', width: '2px',
        background: 'linear-gradient(to bottom, #3A9DBC44, #F7C84144)', borderRadius: '2px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {workflowSteps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: '#1a2f42',
              border: '2px solid #3A9DBC44', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', zIndex: 1 }}>
              {step.icon}
            </div>
            <div style={{ flex: 1, background: '#ffffff06', border: '1px solid #ffffff0e', borderRadius: '8px',
              padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
                background: '#3A9DBC22', color: '#3A9DBC', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
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

/* ──────────────────── ToC ──────────────────── */

function TableOfContents({ items }: { items: typeof tocItems }) {
  return (
    <nav aria-label="Indice" style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '24px',
      alignSelf: 'flex-start', background: '#0a1825', border: '1px solid #ffffff10', borderRadius: '12px',
      padding: '1rem', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: '#475569', marginBottom: '0.75rem' }}>
        In questa pagina
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map(({ id, label }) => (
          <li key={id}>
            <a href={`#${id}`} style={{ display: 'block', padding: '5px 8px', borderRadius: '6px',
              color: '#94a3b8', fontSize: '0.84rem', textDecoration: 'none', transition: 'background 0.15s, color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3A9DBC18'; (e.currentTarget as HTMLElement).style.color = '#3A9DBC' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MobileToc({ items }: { items: typeof tocItems }) {
  return (
    <nav aria-label="Navigazione sezioni" style={{ display: 'flex', overflowX: 'auto', gap: '0.4rem',
      paddingBottom: '4px', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
      {items.map(({ id, label }) => (
        <a key={id} href={`#${id}`} style={{ flexShrink: 0, display: 'inline-block', padding: '5px 12px',
          borderRadius: '20px', background: '#ffffff0a', border: '1px solid #ffffff15',
          color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {label}
        </a>
      ))}
    </nav>
  )
}

/* ──────────────────── main page ──────────────────── */

export default function AdminGuidePage() {
  const [query, setQuery] = useState('')
  const filteredToc = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tocItems
    return tocItems.filter(t => t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
  }, [query])

  return (
    <>
      <style>{`
        .guide-layout { display: flex; gap: 2rem; align-items: flex-start; }
        .guide-toc-desktop { display: block; }
        .guide-toc-mobile  { display: none; }
        @media (max-width: 860px) {
          .guide-layout { display: block; }
          .guide-toc-desktop { display: none; }
          .guide-toc-mobile  { display: flex; }
        }
        .guide-section { scroll-margin-top: 24px; }
        html { scroll-behavior: smooth; }
      `}</style>

      <div style={{ maxWidth: '960px' }}>
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem' }}>📖</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0 }}>
              Guida per l&rsquo;Amministratore
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '0.25rem' }}>
            Manuale operativo &mdash; WildCatch Game Master Handbook
          </p>
          {/* Search bar */}
          <div style={{ position: 'relative', marginTop: '1rem', maxWidth: '420px' }}>
            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '16px', height: '16px', color: '#475569', pointerEvents: 'none' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="search"
              placeholder="Cerca sezione…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '38px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px',
                borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
                color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </header>

        <div className="guide-toc-mobile"><MobileToc items={filteredToc} /></div>

        <div className="guide-layout">
          <div className="guide-toc-desktop"><TableOfContents items={filteredToc} /></div>

          <article style={{ flex: 1, minWidth: 0 }}>

            {/* ── 1. Panoramica ── */}
            <section id="overview" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>1. Panoramica</SectionHeader>
              <Prose>
                Il pannello admin ti permette di orchestrare l&rsquo;intera esperienza di gioco.
                Crea sessioni, invita giocatori, gestisci creature, oggetti e missioni, monitora in tempo
                reale l&rsquo;andamento della partita e decreta il vincitore finale.
              </Prose>
              <SubHeader>Ciclo di vita di una partita</SubHeader>
              <FlowDiagram />
              <Callout type="info">
                Ogni elemento del flusso ha una sezione dedicata in questa guida. Usa la navigazione
                a sinistra (o le pillole sopra su mobile) per saltare direttamente alla sezione.
              </Callout>
            </section>

            <Divider />

            {/* ── 2. Sessioni ── */}
            <section id="sessions" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>2. Sessioni</SectionHeader>
              <Prose>
                Una <strong style={{ color: '#e2e8f0' }}>sessione</strong> è il contenitore di una partita.
                Definisce l&rsquo;area geografica (lat/lng + raggio), la durata, il testo narrativo e raggruppa
                tutti i giocatori invitati.
              </Prose>

              <SubHeader>Come creare una sessione</SubHeader>
              <StepList items={[
                'Vai in Admin → Sessioni → "Nuova Sessione"',
                'Inserisci nome, descrizione, date di inizio e fine',
                'Imposta il centro GPS e il raggio d\'azione (es. 500 m per un campus)',
                'Sezione "🎒 Kit iniziale": configura gli oggetti che ogni giocatore riceve al momento del join',
                'Salva — la sessione è subito disponibile per i giocatori invitati',
              ]} />

              <SubHeader>Kit Iniziale</SubHeader>
              <Prose>
                Il kit iniziale è un elenco di oggetti con quantità consegnati automaticamente al giocatore
                quando usa il codice invito. Configura: tipo di rete base, razioni di esca iniziali,
                eventuale oggetto di benvenuto.
              </Prose>

              <SubHeader>Stati della sessione</SubHeader>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <Badge label="draft"  color="#94a3b8" />
                <Badge label="ready"  color="#F7C841" />
                <Badge label="active" color="#34D399" />
                <Badge label="ended"  color="#E85D2F" />
              </div>
              <p style={{ color: '#64748b', fontSize: '0.83rem', marginTop: '0.4rem' }}>
                Le sessioni <Code>ready</Code> e <Code>active</Code> accettano giocatori con codice invito.
                Solo le sessioni <Code>active</Code> mostrano la mappa e attivano spawn e missioni.
              </p>

              <Callout type="warning">
                <strong>Attenzione al raggio:</strong> modificare il raggio dopo che i giocatori sono
                entrati può escludere chi si trova fuori dall&rsquo;area aggiornata. Pianifica l&rsquo;area prima.
              </Callout>
            </section>

            <Divider />

            {/* ── 3. Inviti ── */}
            <section id="invites" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>3. Inviti &amp; Codici</SectionHeader>
              <Prose>
                Ogni codice invito è <strong style={{ color: '#e2e8f0' }}>monouso</strong>: un codice →
                un giocatore. Al join, il giocatore riceve automaticamente il kit iniziale della sessione.
              </Prose>
              <StepList items={[
                'Admin → Inviti → seleziona la sessione → "Genera Invito"',
                'Scegli quanti codici generare in un click (1–500)',
                'Esporta QR code per la stampa o condividi il codice testuale digitalmente',
                'Revoca / Resetta i codici dalla lista se necessario',
              ]} />
              <Callout type="tip">
                Genera sempre qualche codice in più rispetto ai partecipanti attesi — i codici inutilizzati
                non creano problemi, ma restare a corto durante l&rsquo;evento sì.
              </Callout>
            </section>

            <Divider />

            {/* ── 4. QR Code ── */}
            <section id="qrcodes" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>4. QR Code di Gioco</SectionHeader>
              <Prose>
                I QR code di gioco vengono stampati e nascosti fisicamente nell&rsquo;area evento.
                I giocatori li trovano e li scansionano con l&rsquo;app per ricevere il premio associato.
                Ogni QR ha un tipo che determina cosa succede alla scansione.
              </Prose>

              <SubHeader>Tipi di QR</SubHeader>
              <QrTypeTable />

              <SubHeader>Configurazione QR Uovo</SubHeader>
              <Prose>
                Per i QR di tipo <Code>uovo</Code> puoi configurare:
              </Prose>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.5rem 0' }}>
                <div style={{ background: '#C084FC0d', border: '1px solid #C084FC2a', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.88rem', color: '#94a3b8' }}>
                  <strong style={{ color: '#C084FC' }}>egg_rarity:</strong>{' '}
                  comune · non_comune · raro · epico · leggendario — determina il pool di creature ottenibili.
                </div>
                <div style={{ background: '#3A9DBC0d', border: '1px solid #3A9DBC2a', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.88rem', color: '#94a3b8' }}>
                  <strong style={{ color: '#3A9DBC' }}>steps_required:</strong>{' '}
                  passi GPS da percorrere prima di poter schiudere l&rsquo;uovo (0 = schiusura immediata).
                  I passi vengono contati dal momento della scansione.
                </div>
              </div>
              <Callout type="tip">
                Uova con passi alti (500–1000) incentivano i giocatori a esplorare tutta l&rsquo;area.
                Usa rarità epica/leggendaria solo per le uova nelle zone più difficili da raggiungere.
              </Callout>

              <SubHeader>Configurazione QR Boss</SubHeader>
              <Prose>
                Per i QR di tipo <Code>boss</Code> puoi configurare fino a 3 creature nella lineup.
                Ogni creatura ha un <Code>level_override</Code> che rappresenta il livello della
                creatura boss e ne influenza HP, ATK e DEF in battaglia (scaling: +14% HP, +10% ATK, +9% DEF per livello sopra 1).
              </Prose>
              <Callout type="info">
                Se il giocatore abbandona il boss fight, può riscansionare lo stesso QR per riprendere
                la battaglia dallo stato in cui era rimasta — non ricomincia dall&rsquo;inizio.
              </Callout>
              <Callout type="tip">
                <strong>Ricompensa una tantum:</strong> la ricompensa (EXP, oro, oggetto) viene erogata
                solo alla <em>prima vittoria</em> contro quel boss QR. Le rivincite riportano lo scontro
                allo stato iniziale ma non concedono premi aggiuntivi. Questo previene farming infinito.
              </Callout>

              <SubHeader>Usi rimanenti</SubHeader>
              <Prose>
                Imposta <Code>uses_remaining</Code> a un numero per limitare quante volte può essere
                scansionato (utile per oggetti rari). Lascia <Code>null</Code> per uso illimitato.
              </Prose>
            </section>

            <Divider />

            {/* ── 5. Creature & Elementi ── */}
            <section id="creatures" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>5. Creature &amp; Elementi</SectionHeader>
              <Prose>
                Ogni creatura ha un elemento che determina le sue forze e debolezze in combattimento.
                Assicurati di assegnare elementi bilanciati alla lineup del boss per rendere lo scontro
                interessante strategicamente.
              </Prose>

              <SubHeader>Tabella degli elementi</SubHeader>
              <ElementTable />
              <Callout type="info">
                <strong>Armonia</strong> è l&rsquo;elemento leggendario: infligge sempre +15% di danni a tutti
                ma è vulnerabile a Fiamma e Terra (×1.5 in entrata). Ottimo per creature rare/boss con alta difesa.
              </Callout>

              <SubHeader>Rarità e probabilità catch base</SubHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.5rem 0' }}>
                {[['comune','#7AB87A','70%'], ['non_comune','#4A9FD4','45%'], ['raro','#E8A820','25%'], ['epico','#7B4DB8','12%'], ['leggendario','#C8352A','5%']].map(([r, c, p]) => (
                  <div key={r} style={{ background: `${c}12`, border: `1px solid ${c}30`, borderRadius: '8px',
                    padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ color: c as string, fontWeight: 700, fontSize: '0.82rem' }}>{r}</div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>catch base {p}</div>
                  </div>
                ))}
              </div>

              <SubHeader>Gestire le creature</SubHeader>
              <StepList items={[
                'Admin → Creature → mostra tutte le creature disponibili nel database',
                'Modifica nome, stats e artwork via pannello inline',
                'Tab ✨ AI — genera artwork con prompt descrittivo (Low $0.01 · Medium $0.04 · High $0.17)',
                'min_level determina il livello minimo richiesto per far apparire la creatura negli spawn',
              ]} />

              <SubHeader>Filtri e ricerca</SubHeader>
              <Prose>
                Usa il pannello filtri (pulsante <Code>Filtri</Code> in alto) per trovare rapidamente
                le creature per elemento, rarità o sessione assegnata. Il badge numerico indica quanti
                filtri sono attivi.
              </Prose>

              <SubHeader>Frammenti Enigma</SubHeader>
              <Prose>
                Ogni creatura può avere un <strong style={{ color: '#C084FC' }}>Frammento Enigma</strong> opzionale:
                un contenuto segreto (testo, immagine o video) che il giocatore sblocca dopo averla catturata.
                Nel modulo di modifica espandi la sezione <Code>🧩 Enigma</Code>.
              </Prose>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0.5rem 0' }}>
                {[
                  { field: 'enigma_title',       color: '#C084FC', desc: 'Titolo del frammento — appare come intestazione del reveal' },
                  { field: 'enigma_description',  color: '#C084FC', desc: 'Testo del frammento — lore, indizio o segreto narrativo' },
                  { field: 'enigma_image_url',    color: '#3A9DBC', desc: 'URL immagine o carica direttamente con il pulsante 📁' },
                  { field: 'enigma_video_url',    color: '#E85D2F', desc: 'URL YouTube, Vimeo o video diretto (mp4/webm) — viene embeddato nel reveal' },
                ].map(({ field, color, desc }) => (
                  <div key={field} style={{ background: `${color}0a`, border: `1px solid ${color}25`, borderRadius: '8px', padding: '0.55rem 0.85rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <Badge label={field} color={color} />
                    <span style={{ color: '#94a3b8', fontSize: '0.83rem', lineHeight: 1.5 }}>{desc}</span>
                  </div>
                ))}
              </div>
              <Callout type="tip">
                Lascia tutti i campi enigma vuoti se non vuoi associare un frammento a quella creatura.
                Il pulsante 🧩 nell&rsquo;app sarà automaticamente disattivato per i giocatori.
              </Callout>
            </section>

            <Divider />

            {/* ── 6. Oggetti & Negozio ── */}
            <section id="items" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>6. Oggetti &amp; Negozio</SectionHeader>
              <Prose>
                Gli oggetti sono acquistabili nel negozio in-game o distribuiti tramite QR code, kit
                iniziale e ricompense missione. Ogni oggetto ha un tipo che ne determina il comportamento.
              </Prose>

              <SubHeader>Tipi di oggetto</SubHeader>
              <ItemTypeTable />

              <SubHeader>Configurare il negozio</SubHeader>
              <StepList items={[
                'Admin → Oggetti → seleziona un oggetto e imposta shop_price > 0 per renderlo acquistabile',
                'effect_value = percentuale bonus (es. 10 = +10%). Per cura = HP ripristinati per turno.',
                'Oggetti con shop_price = 0 non appaiono nel negozio ma possono essere dati via QR o kit',
              ]} />

              <Callout type="tip">
                Bilancia i prezzi in modo che i giocatori debbano scegliere fra reti potenziate ed
                esche — questo mantiene il negozio interessante per tutta la durata dell&rsquo;evento.
              </Callout>
            </section>

            <Divider />

            {/* ── 7. Missioni ── */}
            <section id="missions" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>7. Missioni</SectionHeader>
              <Prose>
                Le missioni sono obiettivi speciali che danno EXP e monete bonus al completamento.
                Vengono tracciate automaticamente dal sistema — nessuna azione manuale richiesta.
              </Prose>

              <SubHeader>Tipi di missione</SubHeader>
              <MissionTable />

              <SubHeader>Come creare una missione</SubHeader>
              <StepList items={[
                'Admin → Missioni → seleziona la sessione → "Nuova Missione"',
                'Imposta titolo, tipo e target_count (numero di completamenti richiesti)',
                'Per tipo cattura/qr/collect: inserisci il "target" (nome creatura/QR/oggetto) o lascia vuoto per "qualunque"',
                'Imposta reward_exp, reward_gold e opzionalmente reward_item_id',
                'Attiva — appare immediatamente nell\'app dei giocatori',
              ]} />

              <Callout type="info">
                Il campo <Code>target</Code> usa il confronto case-insensitive: &ldquo;fiammare&rdquo; corrisponde a
                &ldquo;Fiammare&rdquo;. Lascialo vuoto per accettare qualunque creatura/QR/oggetto del tipo indicato.
              </Callout>

              <Callout type="warning">
                <strong>Bilanciamento:</strong> missioni walk richiedono passi cumulativi nell&rsquo;intera sessione.
                Calibra target_count in base alla durata e all&rsquo;area (es. 1000 passi per 1 ora di gioco).
              </Callout>
            </section>

            <Divider />

            {/* ── 8. Ricompense Livello ── */}
            <section id="levelrewards" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>8. Ricompense Livello</SectionHeader>
              <Prose>
                Ogni volta che un giocatore raggiunge un nuovo livello, riceve automaticamente le
                ricompense configurate per quel livello: monete, oggetti o entrambi.
              </Prose>
              <StepList items={[
                'Admin → Ricompense Livello → "Nuova ricompensa"',
                'Imposta il livello (es. 5), gold_reward e opzionalmente item_id + quantity',
                'La ricompensa viene erogata automaticamente al raggiungimento del livello',
                'Puoi avere più ricompense per lo stesso livello (vengono tutte erogate)',
              ]} />
              <Callout type="tip">
                Metti ricompense significative ai livelli 5, 10, 15 — creano picchi di soddisfazione
                e spingono i giocatori a restare impegnati per tutta la durata dell&rsquo;evento.
              </Callout>
            </section>

            <Divider />

            {/* ── 9. Giocatori ── */}
            <section id="players" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>9. Giocatori</SectionHeader>
              <Prose>
                La sezione giocatori mostra tutti gli iscritti alle sessioni attive con stato in tempo reale.
              </Prose>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem', margin: '0.5rem 0 1rem' }}>
                {[
                  { label: 'Nome & Email',        icon: '👤', color: '#3A9DBC' },
                  { label: 'Sessione',             icon: '🎮', color: '#7B4DB8' },
                  { label: 'Creature catturate',   icon: '🐾', color: '#34D399' },
                  { label: 'EXP & Livello',        icon: '⚡', color: '#F7C841' },
                  { label: 'Passi percorsi',       icon: '🚶', color: '#C084FC' },
                  { label: 'Ultima attività',      icon: '🕒', color: '#94a3b8' },
                ].map(({ label, icon, color }) => (
                  <div key={label} style={{ background: '#ffffff06', border: '1px solid #ffffff0e', borderRadius: '8px',
                    padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    <span style={{ color, fontSize: '0.83rem', fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* ── 10. Notifiche ── */}
            <section id="notifications" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>10. Notifiche</SectionHeader>
              <Prose>
                Invia messaggi in tempo reale a tutti i giocatori di una sessione.
                I giocatori ricevono un popup immediato nell&rsquo;app.
              </Prose>
              <StepList items={[
                'Admin → Giocatori → "Notifica tutti" oppure Dashboard → campo broadcast',
                'Scrivi il messaggio e premi Invia',
                'Tutti i giocatori della sessione ricevono il popup in &lt;2 secondi',
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.5rem 0' }}>
                {[
                  { msg: '"La sessione finisce tra 10 minuti!"', type: 'warning' as const },
                  { msg: '"Evento speciale: un\'uovo leggendario è apparso nella piazza!"', type: 'tip' as const },
                  { msg: '"Complimenti al vincitore — sessione terminata!"', type: 'info' as const },
                ].map(({ msg, type }) => <Callout key={msg} type={type}>{msg}</Callout>)}
              </div>
            </section>

            <Divider />

            {/* ── 11. Classifica ── */}
            <section id="leaderboard" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>11. Classifica</SectionHeader>
              <Prose>
                La classifica mostra i giocatori ordinati per EXP totale accumulata nella sessione.
                Si aggiorna in tempo reale e può essere filtrata per sessione.
              </Prose>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}>
                {[
                  { title: 'Tempo reale',     desc: 'Si aggiorna automaticamente senza ricaricare',  icon: '⚡', color: '#34D399' },
                  { title: 'Filtra sessione', desc: 'Visualizza la classifica di una sessione',       icon: '🔍', color: '#3A9DBC' },
                  { title: 'Premiazioni',     desc: 'Usa la classifica finale per i vincitori',       icon: '🏆', color: '#F7C841' },
                ].map(({ title, desc, icon, color }) => (
                  <div key={title} style={{ background: `${color}0d`, border: `1px solid ${color}2a`, borderRadius: '10px', padding: '0.85rem 1rem' }}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>{icon}</div>
                    <p style={{ color, fontWeight: 600, fontSize: '0.88rem', margin: '0 0 0.2rem' }}>{title}</p>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* ── 12. Flusso operativo ── */}
            <section id="workflow" className="guide-section" style={{ marginBottom: '2.5rem' }}>
              <SectionHeader color="#F7C841">12. Flusso operativo consigliato</SectionHeader>
              <Prose>
                Segui questa checklist nell&rsquo;ordine indicato per ogni evento. Saltare un
                passaggio è la causa più comune di problemi durante le sessioni live.
              </Prose>
              <WorkflowTimeline />
              <Callout type="critical">
                <strong>Non dimenticare:</strong> attiva la sessione solo quando sei pronto.
                Una sessione attiva non può essere modificata nella geografia senza rischiare
                di escludere partecipanti.
              </Callout>
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#ffffff05',
                border: '1px solid #ffffff0e', borderRadius: '10px', fontSize: '0.83rem',
                color: '#475569', textAlign: 'center' }}>
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
