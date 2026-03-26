'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Section {
  id: string
  icon: string
  title: string
  accent: string
  content: React.ReactNode
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MiniMap() {
  return (
    <div className="relative mt-3 mx-auto w-full max-w-[240px] h-32 rounded-xl overflow-hidden border border-[#3A9DBC]/30 bg-[#071420]">
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'linear-gradient(#3A9DBC 1px, transparent 1px), linear-gradient(90deg, #3A9DBC 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      {/* Pulse ring around player */}
      <motion.div
        className="absolute rounded-full border-2 border-[#3A9DBC]/40"
        style={{ width: 52, height: 52, top: '50%', left: '50%', x: '-50%', y: '-50%' }}
        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* Player dot */}
      <div className="absolute w-4 h-4 rounded-full bg-[#3A9DBC] border-2 border-white shadow-lg shadow-[#3A9DBC]/50"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      {/* Creature blips */}
      {[
        { top: '20%', left: '20%', emoji: '🐟', delay: 0 },
        { top: '15%', left: '72%', emoji: '🦅', delay: 0.4 },
        { top: '70%', left: '80%', emoji: '🐺', delay: 0.8 },
        { top: '75%', left: '30%', emoji: '🦎', delay: 1.2 },
      ].map((c, i) => (
        <motion.div key={i} className="absolute text-base"
          style={{ top: c.top, left: c.left }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, delay: c.delay, repeat: Infinity }}>
          {c.emoji}
        </motion.div>
      ))}
      {/* Range circle */}
      <div className="absolute rounded-full border border-dashed border-[#3A9DBC]/30"
        style={{ width: 70, height: 70, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-[#3A9DBC]/60 font-mono tracking-widest uppercase">GPS attivo</div>
    </div>
  )
}

function BattleDiagram() {
  const [playerHp, setPlayerHp] = useState(80)
  const [wildHp, setWildHp] = useState(65)

  function simulate() {
    setWildHp(h => Math.max(0, h - Math.floor(Math.random() * 18 + 8)))
    setPlayerHp(h => Math.max(0, h - Math.floor(Math.random() * 10 + 3)))
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-[#071420]/60 p-3 space-y-3">
      {/* Wild creature */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/60">Creatura selvatica</span>
          <span className="text-[#E85D2F] font-mono">{wildHp}/100</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[#E85D2F]" animate={{ width: `${wildHp}%` }} transition={{ type: 'spring', stiffness: 120 }} />
        </div>
      </div>
      {/* Player creature */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/60">La tua creatura</span>
          <span className="text-[#34D399] font-mono">{playerHp}/100</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[#34D399]" animate={{ width: `${playerHp}%` }} transition={{ type: 'spring', stiffness: 120 }} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={simulate}
          className="flex-1 bg-[#E85D2F]/80 hover:bg-[#E85D2F] text-white text-xs font-bold py-2 rounded-lg transition-colors active:scale-95">
          ⚔️ Attacca
        </button>
        <button className="flex-1 bg-[#3A9DBC]/80 hover:bg-[#3A9DBC] text-white text-xs font-bold py-2 rounded-lg transition-colors">
          🥅 Lancia Rete
        </button>
      </div>
    </div>
  )
}

function RarityBadges() {
  const rarities = [
    { label: 'Comune',     color: '#7AB87A', glow: '#7AB87A' },
    { label: 'Non Comune', color: '#4A9FD4', glow: '#4A9FD4' },
    { label: 'Raro',       color: '#E8A820', glow: '#E8A820' },
    { label: 'Epico',      color: '#7B4DB8', glow: '#7B4DB8' },
    { label: 'Leggendario', color: '#C8352A', glow: '#C8352A' },
  ]
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {rarities.map((r, i) => (
        <motion.span key={r.label}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
          className="px-3 py-1 rounded-full text-xs font-bold text-white border"
          style={{ borderColor: r.color, backgroundColor: r.color + '22', boxShadow: `0 0 8px ${r.glow}44` }}>
          {r.label}
        </motion.span>
      ))}
    </div>
  )
}

function EvolutionDiagram() {
  return (
    <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
      {[1, 2, 3].map(n => (
        <motion.div key={n}
          className="w-14 h-14 rounded-xl border border-white/20 bg-white/5 flex flex-col items-center justify-center"
          whileHover={{ scale: 1.05, borderColor: '#3A9DBC' }}>
          <span className="text-2xl">🐟</span>
          <span className="text-[9px] text-white/40 mt-0.5">x1</span>
        </motion.div>
      ))}
      <motion.div
        className="text-2xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}>
        ✨
      </motion.div>
      <motion.div
        className="w-16 h-16 rounded-xl border-2 border-[#F7C841] bg-[#F7C841]/10 flex flex-col items-center justify-center"
        animate={{ boxShadow: ['0 0 0px #F7C84100', '0 0 16px #F7C84166', '0 0 0px #F7C84100'] }}
        transition={{ duration: 2, repeat: Infinity }}>
        <span className="text-3xl">🐬</span>
        <span className="text-[9px] text-[#F7C841] mt-0.5 font-bold">Evoluta!</span>
      </motion.div>
    </div>
  )
}

function TipChips() {
  const tips = [
    { text: 'Usa una rete migliore dallo zaino prima di lanciare — aumenta le chance', color: '#3A9DBC' },
    { text: 'Accumula 3 duplicati della stessa creatura per sbloccare l\'evoluzione', color: '#F7C841' },
    { text: 'Completa le missioni QR e di cattura per guadagnare monete extra', color: '#34D399' },
    { text: 'Abbassa gli HP della creatura prima di lanciarla per una cattura più facile', color: '#E85D2F' },
  ]
  return (
    <div className="flex flex-col gap-2 mt-3">
      {tips.map((tip, i) => (
        <motion.div key={i}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.12 }}
          className="flex items-start gap-2 px-3 py-2 rounded-xl text-sm text-white/90 border"
          style={{ borderColor: tip.color + '55', backgroundColor: tip.color + '15' }}>
          <span className="mt-0.5 text-base" style={{ color: tip.color }}>→</span>
          {tip.text}
        </motion.div>
      ))}
    </div>
  )
}

// ─── Section definitions ──────────────────────────────────────────────────────

function buildSections(): Section[] {
  return [
    {
      id: 'benvenuto',
      icon: '🌍',
      title: 'Benvenuto in WildCatch',
      accent: '#3A9DBC',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Esplora la natura reale, cattura creature fantastiche! WildCatch usa il tuo GPS per
            nascondere creature nel mondo reale. Cammina, avvicinati, cattura.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[['🚶', 'Cammina'], ['📍', 'Avvicinati'], ['🎯', 'Cattura']].map(([emoji, label]) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 py-2 px-1">
                <div className="text-xl">{emoji}</div>
                <div className="text-xs text-white/60 mt-1">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#3A9DBC]/20 bg-[#3A9DBC]/5 px-3 py-2">
            <p className="text-xs text-[#3A9DBC]">
              📋 Per iniziare hai bisogno di un <strong>codice invito</strong> dall'organizzatore —
              inseriscilo nella schermata di accesso oppure <strong>scansiona il QR code</strong> con la fotocamera.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'mappa',
      icon: '🗺️',
      title: 'La Mappa',
      accent: '#34D399',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            La mappa mostra la tua posizione in tempo reale. Cammina nell'area di gioco e gli incontri
            si attivano <span className="text-[#34D399] font-bold">automaticamente</span> — sia via GPS
            quando ti muovi, sia con un timer casuale ogni pochi minuti. Non serve toccare nulla!
          </p>
          <MiniMap />
        </div>
      ),
    },
    {
      id: 'incontri',
      icon: '⚔️',
      title: 'Gli Incontri',
      accent: '#E85D2F',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Quando trovi una creatura puoi scegliere: <span className="text-[#E85D2F] font-bold">combatti</span> (attacca
            con la tua creatura attiva per indebolirla) oppure lancia direttamente la pokeball.
            Più è debole, più facile catturarla!
          </p>
          <BattleDiagram />
        </div>
      ),
    },
    {
      id: 'bestiario',
      icon: '📖',
      title: 'Il Bestiario',
      accent: '#7B4DB8',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Ogni creatura catturata viene registrata nel bestiario. Le creature non ancora catturate
            appaiono come sagome misteriose — solo l'elemento è visibile. Collezionale tutte!
          </p>
          <p className="text-white/60 text-xs mt-2">5 rarità in ordine crescente:</p>
          <RarityBadges />
        </div>
      ),
    },
    {
      id: 'evoluzione',
      icon: '✨',
      title: 'Evoluzione',
      accent: '#F7C841',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Cattura <span className="text-[#F7C841] font-bold">3 duplicati</span> della stessa creatura per
            sbloccare l'evoluzione! La creatura evoluta è più forte e ha statistiche migliorate.
          </p>
          <EvolutionDiagram />
        </div>
      ),
    },
    {
      id: 'missioni',
      icon: '🎯',
      title: 'Missioni',
      accent: '#34D399',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            L'admin crea missioni speciali per la sessione. Toccane una per vedere tutti i dettagli,
            i progressi e, se è di tipo <span className="text-[#34D399] font-bold">Scansione QR</span>,
            il pulsante per aprire il lettore direttamente dall'app.
          </p>
          <div className="mt-3 space-y-2">
            {[
              { icon: '🐾', label: 'Cattura — prendi la creatura indicata',   color: '#3A9DBC' },
              { icon: '⚔️', label: 'Duello — vinci uno scontro PvP',         color: '#FBBF24' },
              { icon: '📷', label: 'QR — scansiona il codice nascosto',       color: '#34D399' },
              { icon: '🚶', label: 'Cammino — percorri la distanza (m)',      color: '#C084FC' },
              { icon: '🎒', label: 'Raccolta — colleziona oggetti nel negozio', color: '#F97316' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className="text-base flex-shrink-0">{m.icon}</span>
                <span className="text-xs text-white/80">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-3">
            Ogni missione completata dona <span className="text-[#F7C841]">EXP</span> e <span className="text-[#F7C841]">monete 🪙</span> bonus.
          </p>
        </div>
      ),
    },
    {
      id: 'qrscanner',
      icon: '📷',
      title: 'Scanner QR',
      accent: '#34D399',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Per le missioni di tipo <span className="text-[#34D399] font-bold">Scansione QR</span> — e
            anche per unirsi a una sessione — puoi usare la fotocamera integrata per leggere i QR code.
          </p>
          <div className="mt-3 space-y-2">
            {[
              { step: '1', text: 'Apri la missione QR e tocca "Scansiona QR"' },
              { step: '2', text: 'Punta la fotocamera sul codice — viene letto automaticamente' },
              { step: '3', text: 'Se la fotocamera non funziona usa il campo testo come alternativa' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className="w-5 h-5 rounded-full bg-[#34D399]/20 text-[#34D399] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.step}</span>
                <span className="text-xs text-white/80">{s.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#34D399]/20 bg-[#34D399]/5 px-3 py-2">
            <p className="text-xs text-[#34D399]">
              ℹ️ Al primo utilizzo il browser chiederà il permesso di accedere alla fotocamera. Concedilo per abilitare la scansione.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'duelli',
      icon: '⚔️',
      title: 'Duelli PvP',
      accent: '#E85D2F',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Sfida altri giocatori in duelli <span className="text-[#E85D2F] font-bold">1v1 in tempo reale!</span>{' '}
            Vai su <span className="text-[#E85D2F] font-bold">⚔️ Duelli</span> nel menu, crea una stanza
            e condividi il codice con l'avversario. Entrambi usano la propria creatura attiva, a turni alternati.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-[#3A9DBC]/20 border border-[#3A9DBC]/50 flex items-center justify-center text-xl">👤</div>
              <span className="text-[10px] text-white/50">Tu</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <motion.div className="text-xl font-black text-[#E85D2F]"
                animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>VS</motion.div>
              <div className="text-[9px] text-white/30">a turni</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-[#E85D2F]/20 border border-[#E85D2F]/50 flex items-center justify-center text-xl">👤</div>
              <span className="text-[10px] text-white/50">Avversario</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'zaino',
      icon: '🎒',
      title: 'Zaino & Negozio',
      accent: '#3A9DBC',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Nel negozio trovi reti di cattura, pozioni e boost. Ogni oggetto costa monete 🪙.
            Lo zaino mostra i tuoi oggetti; le reti migliori aumentano la probabilità di cattura.
            All'inizio ricevi <span className="text-[#3A9DBC] font-bold">5× Rete Base</span> gratuite.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { emoji: '🥅', name: 'Rete Base',       bonus: '+0%',   type: 'rete' },
              { emoji: '🕸️', name: 'Rete Avanzata',   bonus: '+10%',  type: 'rete' },
              { emoji: '✨', name: 'Rete Speciale',    bonus: '+20%',  type: 'rete' },
              { emoji: '🌟', name: 'Rete Leggendaria', bonus: '+35%',  type: 'rete' },
            ].map(item => (
              <div key={item.name} className="rounded-xl bg-white/5 border border-white/10 p-2 flex items-center gap-2">
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                <div>
                  <div className="text-xs text-white/80 font-medium">{item.name}</div>
                  <div className="text-[10px] text-[#34D399] font-bold">{item.bonus} cattura</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'profilo',
      icon: '🏆',
      title: 'Profilo & Classifica',
      accent: '#F7C841',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Il tuo profilo mostra EXP, livello e creature catturate. La classifica globale mostra
            tutti i giocatori ordinati per EXP. Scala la vetta!
          </p>
          <div className="mt-3 space-y-1.5">
            {[
              { rank: '🥇', name: 'MarcoA.', exp: '4320 EXP' },
              { rank: '🥈', name: 'Giulia_B', exp: '3870 EXP' },
              { rank: '🥉', name: 'FerdiP',  exp: '3200 EXP' },
              { rank: '#4', name: 'Tu',       exp: '2740 EXP', isYou: true },
            ].map(p => (
              <div key={p.name}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${p.isYou ? 'bg-[#F7C841]/15 border border-[#F7C841]/40' : 'bg-white/5 border border-white/10'}`}>
                <span className="w-8 text-center text-sm font-bold">{p.rank}</span>
                <span className={`flex-1 text-sm ${p.isYou ? 'text-[#F7C841] font-bold' : 'text-white/80'}`}>{p.name}</span>
                <span className="text-xs text-[#F7C841]">{p.exp}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'consigli',
      icon: '💡',
      title: 'Consigli Rapidi',
      accent: '#34D399',
      content: <TipChips />,
    },
  ]
}

// ─── Section card ─────────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}

function SectionCard({ section, index }: { section: Section; index: number }) {
  const [open, setOpen] = useState(true)

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${section.accent}0D 0%, #0F1F2E 60%)`,
        borderLeft: `3px solid ${section.accent}`,
        border: `1px solid ${section.accent}28`,
        boxShadow: `0 4px 24px ${section.accent}12, inset 0 1px 0 ${section.accent}18`,
      }}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}>
        <span className="text-2xl flex-shrink-0">{section.icon}</span>
        <span className="flex-1 font-bold text-white text-base">{section.title}</span>
        <motion.span
          className="text-white/40 text-sm flex-shrink-0"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}>
          ▾
        </motion.span>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden">
            <div className="px-4 pb-4 pt-0">{section.content}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const sections = buildSections()

  return (
    <div className="h-full overflow-y-auto bg-[#0F1F2E]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#0F1F2E]/95 backdrop-blur-md border-b border-white/8">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#3A9DBC]/20 border border-[#3A9DBC]/40 flex items-center justify-center text-lg flex-shrink-0">
            📖
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Guida Giocatore</h1>
            <p className="text-xs text-[#3A9DBC]/80">Come funziona WildCatch</p>
          </div>
        </div>

        {/* Progress bar decoration */}
        <div className="h-0.5 bg-gradient-to-r from-[#3A9DBC] via-[#F7C841] to-[#34D399] opacity-60" />
      </div>

      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mx-4 mt-4 mb-5 rounded-2xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #0d2a3e 0%, #071420 50%, #0a1f14 100%)',
          border: '1px solid rgba(58,157,188,0.25)',
          boxShadow: '0 8px 40px rgba(58,157,188,0.12)',
        }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3A9DBC 0%, transparent 70%)' }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #34D399 0%, transparent 70%)' }} />

        <div className="relative px-5 py-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">🐾</span>
            <span className="text-xl font-black text-white tracking-tight">WildCatch</span>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Avventura nella natura adriatica e nei boschi appenninici.<br />
            Cattura, evolvi, combatti — diventa il miglior cacciatore!
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {['📍 GPS Reale', '🐾 Creature', '⚔️ PvP', '🏆 Classifica'].map(tag => (
              <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full bg-white/8 border border-white/12 text-white/70">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      <div className="px-4 space-y-3 pb-24">
        {sections.map((section, i) => (
          <SectionCard key={section.id} section={section} index={i} />
        ))}
      </div>
    </div>
  )
}
