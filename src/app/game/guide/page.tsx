'use client'
import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
      <div className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'linear-gradient(#3A9DBC 1px, transparent 1px), linear-gradient(90deg, #3A9DBC 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <motion.div
        className="absolute rounded-full border-2 border-[#3A9DBC]/40"
        style={{ width: 52, height: 52, top: '50%', left: '50%', x: '-50%', y: '-50%' }}
        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="absolute w-4 h-4 rounded-full bg-[#3A9DBC] border-2 border-white shadow-lg shadow-[#3A9DBC]/50"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
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
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/60">Creatura selvatica</span>
          <span className="text-[#E85D2F] font-mono">{wildHp}/100</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[#E85D2F]" animate={{ width: `${wildHp}%` }} transition={{ type: 'spring', stiffness: 120 }} />
        </div>
      </div>
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
    { label: 'Terrestre',      color: '#7AB87A' },
    { label: 'Arcaico',  color: '#4A9FD4' },
    { label: 'Eroico',        color: '#E8A820' },
    { label: 'Mostruoso',       color: '#7B4DB8' },
    { label: 'Leggendario', color: '#C8352A' },
    { label: 'Mitologico',  color: '#F0A0FF' },
  ]
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {rarities.map((r, i) => (
        <motion.span key={r.label}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
          className="px-3 py-1 rounded-full text-xs font-bold text-white border"
          style={{ borderColor: r.color, backgroundColor: r.color + '22', boxShadow: `0 0 8px ${r.color}44` }}>
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
          <span className="text-[9px] text-white/40 mt-0.5">×1</span>
        </motion.div>
      ))}
      <motion.div className="text-2xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}>✨</motion.div>
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

// ─── Element Chart ────────────────────────────────────────────────────────────

const ELEMENTS = [
  { name: 'Fiamma',    color: '#E85D2F', icon: '🔥', strong: ['Bosco'],                         weak: ['Adriatico'] },
  { name: 'Adriatico', color: '#3A9DBC', icon: '💧', strong: ['Fiamma'],                         weak: ['Terra'] },
  { name: 'Bosco',     color: '#34D399', icon: '🌿', strong: ['Terra'],                          weak: ['Fiamma'] },
  { name: 'Terra',     color: '#F7C841', icon: '🪨', strong: ['Adriatico'],                      weak: ['Bosco'] },
  { name: 'Armonia',   color: '#C084FC', icon: '✨', strong: ['Fiamma', 'Adriatico', 'Bosco', 'Terra'], weak: [] },
]

function ElementChart() {
  return (
    <div className="mt-3 space-y-2">
      {ELEMENTS.map(el => (
        <div key={el.name} className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">{el.icon}</span>
            <span className="font-bold text-sm" style={{ color: el.color }}>{el.name}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-white/40 self-center">Forte vs:</span>
            {el.strong.map(s => (
              <span key={s} className="px-2 py-0.5 rounded-full font-bold"
                style={{ background: '#34D39922', color: '#34D399', border: '1px solid #34D39944' }}>
                ✓ {s}
              </span>
            ))}
            {el.weak.length > 0 && (
              <>
                <span className="text-white/40 self-center ml-1">Debole vs:</span>
                {el.weak.map(w => (
                  <span key={w} className="px-2 py-0.5 rounded-full font-bold"
                    style={{ background: '#E85D2F22', color: '#E85D2F', border: '1px solid #E85D2F44' }}>
                    ✗ {w}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-[#C084FC]/25 bg-[#C084FC]/5 px-3 py-2 text-xs text-[#C084FC]/80">
        ⚡ Il danno con vantaggio elementale vale <strong className="text-[#C084FC]">×1.5</strong>.
        Lo svantaggio infligge solo <strong className="text-[#C084FC]">×0.5</strong> (neutro = ×1.0).
        Armonia è forte su <em>tutti</em> gli elementi (×1.5) e non ha debolezze.
      </div>
    </div>
  )
}

// ─── Items grid ───────────────────────────────────────────────────────────────

const ITEMS = [
  { icon: '🎯', name: 'Rete',       color: '#3A9DBC', where: 'Negozio / Kit iniziale', how: 'Automatica durante incontro', desc: 'Aumenta la probabilità di cattura. Usata in automatico durante ogni incontro. Più è rara, più sarà efficace.' },
  { icon: '🍖', name: 'Esca',       color: '#34D399', where: 'Negozio / QR',           how: 'Zaino → "Usa"',            desc: 'Attira creature più rare nelle vicinanze per 10 minuti. Comparirà una notifica nell\'app quando è attiva.' },
  { icon: '🥚', name: 'Uovo',       color: '#C084FC', where: 'QR code fisici',         how: 'Zaino → sezione Uova',     desc: 'Si schiude dopo aver percorso un certo numero di passi (o subito se non richiede passi). Contiene una creatura a sorpresa.' },
  { icon: '⚔️', name: 'Battaglia',  color: '#FBBF24', where: 'Negozio',               how: 'Automatica in duello/boss', desc: 'Potenzia l\'ATK della tua creatura durante duelli PvP e boss fight. Usata automaticamente al momento dello scontro.' },
  { icon: '🧪', name: 'Pozione',    color: '#F472B6', where: 'Negozio',               how: 'Automatica in duello',      desc: 'Neutralizza la debolezza elementale — la tua creatura non subisce il malus ×0.5 contro gli elementi avversi.' },
  { icon: '💊', name: 'Cura',       color: '#34D399', where: 'Negozio',               how: 'Automatica in duello',      desc: 'Ripristina una quota di HP alla tua creatura all\'inizio di ogni turno di battaglia.' },
]

function ItemsGrid() {
  return (
    <div className="mt-3 space-y-2">
      {ITEMS.map(item => (
        <div key={item.name} className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: item.color + '30', background: item.color + '0a' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{item.icon}</span>
            <span className="font-bold text-sm text-white">{item.name}</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md font-bold"
              style={{ background: item.color + '22', color: item.color }}>
              {item.how}
            </span>
          </div>
          <p className="text-xs text-white/55 leading-relaxed">{item.desc}</p>
          <p className="text-[10px] text-white/30 mt-1">Fonte: {item.where}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Egg section ─────────────────────────────────────────────────────────────

const EGG_RARITIES = [
  { icon: '🥚', label: 'Terrestre',     color: '#9CA3AF', pool: 'Creature comuni' },
  { icon: '🪺', label: 'Arcaico', color: '#34D399', pool: 'Terrestre 70% · Arcaico 30%' },
  { icon: '💎', label: 'Eroico',       color: '#3A9DBC', pool: 'Terrestre 50% · Arcaico 30% · Eroico 20%' },
  { icon: '🔮', label: 'Mostruoso',      color: '#C084FC', pool: 'Terrestre 40% · Arcaico 30% · Eroico 20% · Mostruoso 10%' },
  { icon: '⭐', label: 'Leggendario',color: '#FBBF24', pool: '35% · 25% · 20% · 15% · Legg. 5%' },
]

function EggGuide() {
  return (
    <div className="mt-3 space-y-3">
      {/* Steps flow */}
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-3">
        {[['📷', 'Scansiona QR uovo'], ['🚶', 'Cammina i passi richiesti'], ['🐣', 'Schiudi dallo Zaino'], ['✨', 'Creatura rivelata!']].map(([icon, label], i, arr) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <span className="text-base">{icon}</span>
              <span className="text-[9px] text-white/40 text-center leading-tight" style={{ maxWidth: 52 }}>{label}</span>
            </div>
            {i < arr.length - 1 && <span className="text-white/20 text-xs flex-shrink-0">→</span>}
          </div>
        ))}
      </div>

      {/* Info callout */}
      <div className="rounded-xl border border-[#C084FC]/25 bg-[#C084FC]/6 px-3 py-2.5 text-xs text-[#C084FC]/80">
        <strong className="text-[#C084FC]">Passi GPS</strong> — i passi vengono contati dal momento in cui raccogli l&apos;uovo.
        Se l&apos;uovo non richiede passi, appare subito disponibile. La barra nel tuo Zaino mostra il progresso in tempo reale.
      </div>

      {/* Rarity table */}
      <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Pool per rarità uovo</p>
      <div className="space-y-1.5">
        {EGG_RARITIES.map(egg => (
          <div key={egg.label} className="flex items-start gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: egg.color + '28', background: egg.color + '0a' }}>
            <span className="text-base flex-shrink-0">{egg.icon}</span>
            <div>
              <span className="text-xs font-bold" style={{ color: egg.color }}>{egg.label}</span>
              <p className="text-[11px] text-white/45 mt-0.5">{egg.pool}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Squad guide ──────────────────────────────────────────────────────────────

function SquadGuide() {
  return (
    <div className="mt-3 space-y-3">
      {/* Visual squad bar example */}
      <div className="flex gap-2 rounded-xl border border-white/10 bg-white/4 p-3">
        {[
          { label: 'Capitano ⚔', color: '#3ABCA8', border: 'rgba(58,188,168,0.5)', note: 'Entra per primo' },
          { label: 'Riserva 2',  color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.3)', note: 'Entra se Cap. sviene' },
          { label: 'Riserva 3',  color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.3)', note: 'Ultima speranza' },
        ].map((slot, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-14 rounded-xl flex items-center justify-center text-xl"
              style={{ background: i === 0 ? 'rgba(58,188,168,0.12)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${slot.border}` }}>
              🐾
            </div>
            <span className="text-[9px] font-bold text-center leading-tight" style={{ color: slot.color }}>{slot.label}</span>
            <span className="text-[8px] text-white/30 text-center leading-tight">{slot.note}</span>
          </div>
        ))}
      </div>

      {/* How to set up */}
      <div className="space-y-1.5 text-xs">
        {[
          { icon: '📖', text: 'Apri il DaimonDex → tocca una creatura → sezione "Squadra da battaglia"' },
          { icon: '1️⃣', text: 'Slot 1 = Capitano — combatte per primo in ogni battaglia' },
          { icon: '🔄', text: 'Slots 2 e 3 = Riserve — entrano in automatico quando la precedente sviene' },
          { icon: '✕',  text: 'Per rimuovere una creatura dalla squadra: tocca la X rossa nello slot in alto nel DaimonDex' },
          { icon: '⚔️', text: 'Con meno di 3 creature un avviso ti chiede conferma prima di ogni battaglia' },
        ].map(row => (
          <div key={row.text} className="flex items-start gap-2 rounded-lg bg-white/4 border border-white/8 px-3 py-2">
            <span className="flex-shrink-0 text-sm">{row.icon}</span>
            <span className="text-white/70 leading-relaxed">{row.text}</span>
          </div>
        ))}
      </div>

      {/* Squad bar explanation */}
      <div className="rounded-xl border border-[#3ABCA8]/25 bg-[#3ABCA8]/6 px-3 py-2.5 text-xs text-[#3ABCA8]/90 space-y-1">
        <p className="font-bold text-[#3ABCA8]">📊 Barra squadra in battaglia</p>
        <p>Durante incontri, duelli e boss fight appare in basso una barra con le 3 creature: immagine, nome e barra HP in tempo reale. La creatura attiva è evidenziata — le altre diventano grigie e mostrano ✕ se svenute.</p>
      </div>

      <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 px-3 py-2 text-xs text-[#EF4444]/80">
        💀 Se tutte e 3 le creature della squadra svenono sei sconfitto — riorganizza la squadra prima della prossima battaglia!
      </div>
    </div>
  )
}

// ─── Boss guide ───────────────────────────────────────────────────────────────

function BossGuide() {
  return (
    <div className="mt-3 space-y-3">
      {/* Flow */}
      <div className="flex items-center justify-center gap-2 flex-wrap rounded-xl border border-[#E85D2F]/20 bg-[#E85D2F]/5 px-3 py-3">
        {[['📷', 'Scansiona QR Boss'], ['🐾', 'Scegli 3 creature'], ['⚔️', 'Combatti 3v3'], ['🏆', 'Ricompensa!']].map(([icon, label], i, arr) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-lg">{icon}</span>
              <span className="text-[9px] text-white/50 text-center" style={{ maxWidth: 50 }}>{label}</span>
            </div>
            {i < arr.length - 1 && <span className="text-[#E85D2F]/40 text-xs flex-shrink-0">→</span>}
          </div>
        ))}
      </div>

      {/* Rules */}
      <div className="space-y-2 text-xs">
        {[
          { icon: '🐾', text: 'Seleziona la tua squadra dal DaimonDex prima di iniziare (fino a 3 creature). Con meno di 3 comparirà un avviso di conferma.' },
          { icon: '⚔️', text: 'Il boss schiera fino a 3 creature. Il combattimento è a turni: tu attacchi, poi il boss risponde immediatamente.' },
          { icon: '⏱️', text: 'Hai 30 secondi per attaccare ogni turno — allo scadere parte un attacco automatico.' },
          { icon: '🔄', text: 'Quando una creatura è KO entra automaticamente la prossima della squadra.' },
          { icon: '🧪', text: 'Gli oggetti Battaglia e Pozione si attivano automaticamente durante la battaglia.' },
          { icon: '🏆', text: 'Vinci abbattendo tutte le creature boss → ricevi EXP, monete e oggetti rari.' },
          { icon: '🎁', text: 'La ricompensa si ottiene solo alla prima vittoria per quel QR boss. Rivincite non danno premi aggiuntivi.' },
          { icon: '💀', text: 'Se tutte le creature della squadra svenono la battaglia è persa — riprova scansionando di nuovo il QR.' },
        ].map(row => (
          <div key={row.text} className="flex items-start gap-2 rounded-lg bg-white/4 border border-white/8 px-3 py-2">
            <span className="text-sm flex-shrink-0">{row.icon}</span>
            <span className="text-white/70 leading-relaxed">{row.text}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#FBBF24]/25 bg-[#FBBF24]/6 px-3 py-2 text-xs text-[#FBBF24]/80">
        💡 Scegli creature con vantaggio elementale contro il boss per infliggere <strong className="text-[#FBBF24]">×1.5</strong> danni — leggi prima la sezione Elementi!
      </div>
    </div>
  )
}

// ─── Duel 3v3 diagram ────────────────────────────────────────────────────────

function DuelDiagram() {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-center gap-4 rounded-xl border border-white/10 bg-white/4 px-4 py-3">
        <div className="flex flex-col items-center gap-1">
          {[1, 2, 3].map(n => (
            <div key={n} className="w-8 h-8 rounded-lg bg-[#3A9DBC]/20 border border-[#3A9DBC]/40 flex items-center justify-center text-sm">🐾</div>
          ))}
          <span className="text-[10px] text-[#3A9DBC] font-bold mt-1">Tu</span>
        </div>
        <motion.div className="text-xl font-black text-[#E85D2F]"
          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>VS</motion.div>
        <div className="flex flex-col items-center gap-1">
          {[1, 2, 3].map(n => (
            <div key={n} className="w-8 h-8 rounded-lg bg-[#E85D2F]/20 border border-[#E85D2F]/40 flex items-center justify-center text-sm">🐾</div>
          ))}
          <span className="text-[10px] text-[#E85D2F] font-bold mt-1">Avversario</span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        {[
          { t: '🐾 Seleziona la squadra dal DaimonDex (slot 1 = Capitano, 2 e 3 = Riserve) — fino a 3 creature' },
          { t: '🔄 Quando una creatura è KO entra la successiva in automatico' },
          { t: '⏱️ Hai 30 secondi per attaccare ogni tuo turno — allo scadere parte un attacco automatico' },
          { t: '💤 Quando non è il tuo turno il timer è fermo — attendi la risposta dell\'avversario' },
          { t: '🏆 Chi abbatte tutte le creature avversarie vince il duello' },
          { t: '⚡ Vittoria → EXP + monete + progresso missione duello' },
          { t: '⚠️ Se entrambi i giocatori restano in attesa di abbinamento, premi "Aggiorna" — la stanza è ancora attiva' },
        ].map(row => (
          <div key={row.t} className="flex items-start gap-2 rounded-lg bg-white/4 border border-white/8 px-3 py-2">
            <span className="text-white/70 leading-relaxed">{row.t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tips ─────────────────────────────────────────────────────────────────────

function TipChips() {
  const tips = [
    { text: 'Configura la squadra nel DaimonDex prima di partire — Slot 1 = Capitano, Slot 2-3 = Riserve. Senza squadra non puoi combattere!', color: '#3ABCA8' },
    { text: 'Usa un\'Esca prima di esplorare — aumenta la frequenza di creature rare per 10 minuti', color: '#34D399' },
    { text: 'Controlla l\'elemento del boss QR prima di scegliere la squadra — il vantaggio vale ×1.5!', color: '#E85D2F' },
    { text: 'Accumula 3 duplicati della stessa creatura per sbloccare l\'evoluzione automatica', color: '#F7C841' },
    { text: 'Abbassa gli HP prima di lanciare la rete: ogni 10% di vita tolta aggiunge +20% al moltiplicatore di cattura (fino a ×3.0 a 0 HP)!', color: '#3A9DBC' },
    { text: 'Cammina per far schiudere le uova — ogni passo conta anche se non incontri creature!', color: '#C084FC' },
    { text: 'Completa le missioni QR e di cattura per guadagnare monete extra da spendere nel negozio', color: '#FBBF24' },
    { text: 'Dopo una cattura apri il DaimonDex e cerca il pulsante 🧩 — alcune creature nascondono frammenti enigma segreti!', color: '#C084FC' },
  ]
  return (
    <div className="flex flex-col gap-2 mt-3">
      {tips.map((tip, i) => (
        <motion.div key={i}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.09 }}
          className="flex items-start gap-2 px-3 py-2 rounded-xl text-sm text-white/90 border"
          style={{ borderColor: tip.color + '55', backgroundColor: tip.color + '15' }}>
          <span className="mt-0.5 text-base flex-shrink-0" style={{ color: tip.color }}>→</span>
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
      title: 'Benvenuto in Daimon',
      accent: '#3A9DBC',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Esplora la natura reale, cattura creature fantastiche! Daimon usa il tuo GPS per
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
              📋 Per iniziare hai bisogno di un <strong>codice invito</strong> dall&apos;organizzatore —
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
            La mappa mostra la tua posizione in tempo reale. Cammina nell&apos;area di gioco e gli incontri
            si attivano <span className="text-[#34D399] font-bold">automaticamente</span> — sia via GPS
            quando ti muovi, sia con un timer casuale ogni pochi minuti. Non serve toccare nulla!
          </p>
          <MiniMap />
          <div className="mt-3 rounded-xl border border-[#34D399]/25 bg-[#34D399]/6 px-3 py-2.5 text-xs text-[#34D399]/90">
            <span className="font-bold text-[#34D399]">🪱 Esca attiva</span> — quando usi un&apos;esca dalla mappa comparirà
            un badge verde con un <strong>conto alla rovescia M:SS</strong> che indica il tempo rimanente.
            Con l&apos;esca attiva le creature rare compaiono più spesso nell&apos;area.
          </div>
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
            con il Capitano della tua squadra per indebolirla) oppure lancia direttamente la rete.
            Più è debole, più facile catturarla! Il bonus cresce <span className="text-[#34D399] font-bold">continuamente</span>:
            ogni 10% di vita tolta aggiunge <span className="text-[#FBBF24] font-bold">+20%</span> al moltiplicatore —
            da <span className="text-white/60">×1.0</span> a vita piena fino a <span className="text-[#F87171] font-bold">×3.0</span> a 0 HP.
            Attenzione — la creatura selvatica può contrattaccare e ridurre gli HP della tua.
            Hai <span className="text-[#FBBF24] font-bold">45 secondi</span> per ogni azione: allo scadere parte un attacco automatico.
            Se tutte le creature della squadra svenono: <span className="text-[#EF4444] font-bold">Sconfitta!</span>
          </p>
          <BattleDiagram />
          <div className="mt-3 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/55">
            <strong className="text-white/80">Probabilità base di cattura per rarità:</strong>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[['Terrestre','#7AB87A','70%'], ['Arcaico','#4A9FD4','45%'], ['Eroico','#E8A820','25%'], ['Mostruoso','#7B4DB8','12%'], ['Leggendario','#C8352A','5%'], ['Mitologico','#F0A0FF','2%']].map(([r, c, p]) => (
                <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: (c as string) + '22', color: c as string, border: `1px solid ${c}44` }}>
                  {r}: {p}
                </span>
              ))}
            </div>
            <p className="mt-1.5">Le <strong className="text-[#3A9DBC]">reti ed esche</strong> moltiplicano la chance base (es. Rete Superiore = ×2, Rete Master = ×3). Indebolire la creatura aggiunge un ulteriore moltiplicatore <strong className="text-[#34D399]">proporzionale agli HP mancanti</strong>: ogni −10% HP = <strong className="text-[#FBBF24]">×+0.2</strong> (da ×1.0 a piena vita fino a <strong className="text-[#F87171]">×3.0 a 0 HP</strong>). I due moltiplicatori si combinano.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'elementi',
      icon: '🔥',
      title: 'Elementi & Debolezze',
      accent: '#E85D2F',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Ogni creatura appartiene a un <span className="text-[#E85D2F] font-bold">elemento</span>.
            Scegliere una creatura con vantaggio elementale in battaglia infligge il <span className="text-[#E85D2F] font-bold">50% di danni in più</span>.
            Uno svantaggio dimezza i danni. Vale sia negli incontri che nei duelli PvP e nei boss fight.
          </p>
          <ElementChart />
        </div>
      ),
    },
    {
      id: 'danni',
      icon: '⚡',
      title: 'Calcolo Danni',
      accent: '#FBBF24',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed mb-3">
            Ogni attacco in incontri, duelli e boss fight segue la stessa formula.
          </p>
          <div className="space-y-2 text-xs">
            <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/8 px-3 py-2.5">
              <p className="font-bold text-[#FBBF24] mb-1">Formula danno</p>
              <p className="font-mono text-white/70 leading-relaxed">
                danno = ATK × moltiplicatore_elemento × varianza × (120 / (120 + DEF_difensore))
              </p>
            </div>
            {[
              { label: 'ATK', color: '#E85D2F', desc: 'Statistica d\'attacco della creatura, scalata in base al livello (+10% per livello sopra 1).' },
              { label: 'Moltiplicatore elemento', color: '#3A9DBC', desc: '×1.5 vantaggio · ×0.5 svantaggio · ×1.0 neutro. Armonia è forte su tutti (×1.5), nessuna debolezza.' },
              { label: 'Varianza fortuna', color: '#C084FC', desc: '±6% casuale ogni attacco. I combattenti più deboli ricevono un leggero bonus underdog fino a +6%.' },
              { label: 'DEF difensore', color: '#34D399', desc: 'La difesa riduce i danni: formula 120/(120+DEF). Con DEF=120 la riduzione è del 50%, con DEF=0 nessuna riduzione.' },
            ].map(row => (
              <div key={row.label} className="rounded-lg bg-white/4 border border-white/8 px-3 py-2">
                <span className="font-bold text-sm" style={{ color: row.color }}>{row.label}</span>
                <p className="text-white/55 mt-0.5 leading-relaxed">{row.desc}</p>
              </div>
            ))}
            <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5">
              <p className="font-bold text-white/70 mb-1 text-[11px] uppercase tracking-wider">Scaling livello creature</p>
              <div className="flex gap-3 text-[11px] text-white/55">
                <span>HP: <strong className="text-white/80">+14%/liv</strong></span>
                <span>ATK: <strong className="text-white/80">+10%/liv</strong></span>
                <span>DEF: <strong className="text-white/80">+9%/liv</strong></span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[#FBBF24]/20 bg-[#FBBF24]/5 px-3 py-2 text-xs text-[#FBBF24]/80">
            💡 Il danno minimo è sempre 1 — nessun attacco va a vuoto.
          </div>
        </div>
      ),
    },
    {
      id: 'daimondex',
      icon: '📖',
      title: 'DaimonDex',
      accent: '#7B4DB8',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Ogni creatura catturata viene registrata nel DaimonDex. Le creature non ancora catturate
            appaiono come sagome misteriose — solo l&apos;elemento è visibile. Collezionale tutte!
          </p>
          <p className="text-white/60 text-xs mt-2">5 rarità in ordine crescente:</p>
          <RarityBadges />
        </div>
      ),
    },
    {
      id: 'squadra',
      icon: '🐾',
      title: 'La Squadra',
      accent: '#3ABCA8',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Prima di ogni battaglia devi avere una <span className="text-[#3ABCA8] font-bold">squadra</span> pronta.
            Puoi schierare fino a 3 creature dal DaimonDex: lo <span className="text-[#3ABCA8] font-bold">Slot 1</span> è il
            Capitano che combatte per primo, gli Slot 2 e 3 sono le Riserve che entrano in automatico se il Capitano sviene.
            Vale per incontri selvatici, duelli PvP e boss fight.
          </p>
          <SquadGuide />
        </div>
      ),
    },
    {
      id: 'enigmi',
      icon: '🧩',
      title: 'Frammenti Enigma',
      accent: '#C084FC',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Alcune creature nascondono un <span className="text-[#C084FC] font-bold">Frammento Enigma</span> —
            un indizio, un segreto o un dettaglio speciale sbloccato dopo la cattura.
            Trovalo nel DaimonDex toccando la creatura e premendo il pulsante viola 🧩.
          </p>
          <div className="mt-3 space-y-2 text-xs">
            {[
              { icon: '🐾', text: 'Cattura la creatura — solo le creature nel tuo bestiario svelano l\'enigma' },
              { icon: '📖', text: 'Vai nel DaimonDex → tocca la creatura → premi "🧩 Frammento Enigma"' },
              { icon: '✨', text: 'L\'enigma si rivela con un\'animazione: titolo, testo, immagine o video' },
              { icon: '🔒', text: 'Il pulsante è disattivato se la creatura non ha un enigma assegnato dall\'admin' },
            ].map(row => (
              <div key={row.text} className="flex items-start gap-2 rounded-lg bg-white/4 border border-white/8 px-3 py-2">
                <span className="flex-shrink-0">{row.icon}</span>
                <span className="text-white/70 leading-relaxed">{row.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#C084FC]/20 bg-[#C084FC]/5 px-3 py-2 text-xs text-[#C084FC]/80">
            🧩 Non tutte le creature hanno un enigma — l&apos;organizzatore decide quali creature
            portano frammenti e cosa contengono.
          </div>
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
            sbloccare l&apos;evoluzione! La creatura evoluta è più forte e ha statistiche migliorate.
          </p>
          <EvolutionDiagram />
        </div>
      ),
    },
    {
      id: 'oggetti',
      icon: '🎒',
      title: 'Oggetti & Negozio',
      accent: '#3A9DBC',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Nel <span className="text-[#3A9DBC] font-bold">Negozio 🛒</span> puoi acquistare oggetti con le monete guadagnate.
            Nello <span className="text-[#3A9DBC] font-bold">Zaino 🎒</span> trovi tutti i tuoi oggetti e le uova.
            Alcuni oggetti si usano automaticamente, altri richiedono di premere &ldquo;Usa&rdquo;.
          </p>
          <ItemsGrid />
        </div>
      ),
    },
    {
      id: 'uova',
      icon: '🥚',
      title: 'Uova & Schiusura',
      accent: '#C084FC',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Le uova si ottengono scansionando <span className="text-[#C084FC] font-bold">QR code fisici</span> nascosti nell&apos;area.
            Ogni uovo deve essere &ldquo;incubato&rdquo; camminando un certo numero di passi GPS
            prima di poter essere schiuso. La rarità dell&apos;uovo determina le creature ottenibili.
          </p>
          <EggGuide />
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
            L&apos;admin crea missioni speciali per la sessione. Toccane una per vedere i dettagli
            e i tuoi progressi. Ogni missione completata dona <span className="text-[#F7C841] font-bold">EXP e monete 🪙</span> bonus.
          </p>
          <div className="mt-3 space-y-2">
            {[
              { icon: '🐾', label: 'Cattura — prendi la creatura indicata',         color: '#3A9DBC' },
              { icon: '⚔️', label: 'Duello — vinci uno scontro PvP',               color: '#FBBF24' },
              { icon: '📷', label: 'QR — scansiona il codice nascosto nell\'area',  color: '#34D399' },
              { icon: '🚶', label: 'Cammino — percorri la distanza indicata in m',  color: '#C084FC' },
              { icon: '🎒', label: 'Raccolta — acquista/usa oggetti nel negozio',   color: '#F97316' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3 rounded-lg border px-3 py-2"
                style={{ background: m.color + '0a', borderColor: m.color + '28' }}>
                <span className="text-base flex-shrink-0">{m.icon}</span>
                <span className="text-xs text-white/80">{m.label}</span>
              </div>
            ))}
          </div>
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
            I QR code fisici nascosti nell&apos;area possono contenere vari premi.
            Aprili dalla sezione Missioni o scansiona direttamente dalla mappa.
          </p>
          <div className="mt-3 space-y-1.5 text-xs">
            {[
              { icon: '🎒', label: 'Oggetto',  desc: 'Aggiunge direttamente l\'oggetto al tuo zaino' },
              { icon: '🥚', label: 'Uovo',     desc: 'Crea un uovo nel tuo zaino da schiudere dopo X passi' },
              { icon: '💀', label: 'Boss',     desc: 'Avvia il boss fight — scegli la squadra e combatti!' },
              { icon: '🐾', label: 'Creatura', desc: 'Aggiunge direttamente una creatura speciale al tuo DaimonDex' },
              { icon: '📖', label: 'Indizio',  desc: 'Sblocca un capitolo narrativo della storia' },
              { icon: '✨', label: 'Evento',   desc: 'Attiva un bonus temporaneo (EXP, spawn, oro)' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className="text-base">{row.icon}</span>
                <div>
                  <span className="font-bold text-white/80">{row.label}</span>
                  <span className="text-white/45"> — {row.desc}</span>
                </div>
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
      title: 'Duelli PvP 3v3',
      accent: '#E85D2F',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Sfida altri giocatori in duelli <span className="text-[#E85D2F] font-bold">3v3 in tempo reale!</span>{' '}
            Vai su <span className="text-[#E85D2F] font-bold">⚔️ Duelli</span>, crea una stanza e condividi il codice.
            Scegli la squadra migliore tenendo conto degli elementi!
          </p>
          <DuelDiagram />
        </div>
      ),
    },
    {
      id: 'boss',
      icon: '💀',
      title: 'Boss Fight',
      accent: '#E85D2F',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            I QR code <span className="text-[#E85D2F] font-bold">Boss</span> attivano uno scontro 3v3 contro
            creature controllate dall&apos;organizzatore. Sono le sfide più difficili del gioco —
            ma anche quelle con le ricompense maggiori!
          </p>
          <BossGuide />
        </div>
      ),
    },
    {
      id: 'profilo',
      icon: '🏆',
      title: 'Profilo & Sessioni',
      accent: '#F7C841',
      content: (
        <div>
          <p className="text-white/80 text-sm leading-relaxed">
            Il tuo profilo mostra tutte le sessioni a cui hai partecipato. Selezionane una per
            vedere le tue statistiche dettagliate: EXP, livello, creature catturate, oro e duelli vinti.
          </p>
          <div className="mt-3 space-y-2 text-xs">
            {[
              { icon: '🎮', label: 'Scegli sessione',     desc: 'Tocca una sessione per vederne le stats — quella attiva è marcata con un bordo verde',    color: '#34D399' },
              { icon: '📊', label: 'Stats per sessione',   desc: 'EXP · Livello · Posizione classifica · Creature · Oro · Duelli vinti/giocati',            color: '#F7C841' },
              { icon: '⚡', label: 'Entra in sessione',    desc: 'Dopo aver selezionato una sessione attiva, premi il pulsante per iniziare a giocare',      color: '#3A9DBC' },
              { icon: '🏅', label: 'Classifica live',      desc: 'La classifica sotto le stats mostra la posizione di tutti i giocatori della sessione',     color: '#C084FC' },
            ].map(row => (
              <div key={row.label} className="flex items-start gap-3 rounded-lg border px-3 py-2"
                style={{ background: row.color + '0a', borderColor: row.color + '28' }}>
                <span className="text-base flex-shrink-0">{row.icon}</span>
                <div>
                  <span className="font-bold text-white/90">{row.label}</span>
                  <span className="text-white/45"> — {row.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#F7C841]/20 bg-[#F7C841]/5 px-3 py-2 text-xs text-[#F7C841]/80">
            💡 Puoi partecipare a più sessioni nel tempo — ogni sessione ha le sue statistiche indipendenti.
            I totali in alto (EXP tot, creature, vittorie) sommano tutti gli eventi.
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

function SectionCard({ section, forceOpen }: { section: Section; forceOpen?: boolean }) {
  const [open, setOpen] = useState(true)

  // When forceOpen fires, ensure section is open
  useState(() => { if (forceOpen) setOpen(true) })

  return (
    <motion.div
      id={section.id}
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

const QUICK_LINKS = [
  { tag: '🗺️ Mappa',       id: 'mappa'      },
  { tag: '⚔️ Incontri',    id: 'incontri'   },
  { tag: '🔥 Elementi',    id: 'elementi'   },
  { tag: '📖 DaimonDex',   id: 'daimondex'  },
  { tag: '🐾 Squadra',     id: 'squadra'    },
  { tag: '⚔️ Duelli',      id: 'duelli'     },
  { tag: '💀 Boss',        id: 'boss'       },
  { tag: '🥚 Uova',        id: 'uova'       },
  { tag: '🎯 Missioni',    id: 'missioni'   },
  { tag: '🎒 Oggetti',     id: 'oggetti'    },
  { tag: '✨ Evoluzione',  id: 'evoluzione' },
  { tag: '📷 QR Scanner',  id: 'qrscanner'  },
  { tag: '🏆 Classifica',  id: 'profilo'    },
]

export default function GuidePage() {
  const allSections = buildSections()
  const router = useRouter()
  const [query, setQuery]           = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [replaying, setReplaying]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  async function replayOnboarding() {
    if (replaying) return
    setReplaying(true)
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('current_session_id') : null
    if (sessionId) {
      try {
        await fetch('/api/game/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, seen: false }),
        })
      } catch { /* best-effort; we still navigate */ }
    }
    router.push('/game/onboarding?next=/game/guide')
  }

  function replayCoachmarks() {
    // Key version must match COACHMARK_STORAGE_KEY in src/app/game/map/page.tsx
    // (currently :v2). Bumping the suffix there requires updating it here.
    try { localStorage.removeItem('wc:coachmarks:map-seen:v2') } catch {}
    router.push('/game/map')
  }

  function scrollToSection(id: string) {
    const container = containerRef.current
    const el = document.getElementById(id)
    if (!container || !el) return
    const containerTop = container.getBoundingClientRect().top
    const elTop = el.getBoundingClientRect().top
    const offset = elTop - containerTop + container.scrollTop - 72
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
  }

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allSections
    return allSections.filter(s =>
      s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    )
  }, [query, allSections])

  function toggleSearch() {
    if (showSearch) {
      setQuery('')
      setShowSearch(false)
    } else {
      setShowSearch(true)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-[#0F1F2E]">
      <div className="sticky top-0 z-20 bg-[#0F1F2E]/95 backdrop-blur-md border-b border-white/8">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#3A9DBC]/20 border border-[#3A9DBC]/40 flex items-center justify-center text-lg flex-shrink-0">
            📖
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white leading-tight">Guida Giocatore</h1>
            <p className="text-xs text-[#3A9DBC]/80">Come funziona Daimon</p>
          </div>
          {/* Search toggle icon */}
          <button
            onClick={toggleSearch}
            aria-label="Cerca argomento"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: showSearch ? 'rgba(58,157,188,0.22)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showSearch ? 'rgba(58,157,188,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: showSearch ? '#3A9DBC' : 'rgba(255,255,255,0.4)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>
        </div>
        {/* Collapsible search bar */}
        <AnimatePresence initial={false}>
          {showSearch && (
            <motion.div
              key="searchbar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="search"
                    placeholder="Cerca argomento…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[#3A9DBC]/50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-0.5 bg-gradient-to-r from-[#3A9DBC] via-[#F7C841] to-[#34D399] opacity-60" />
      </div>

      {!query && (
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
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #3A9DBC 0%, transparent 70%)' }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #34D399 0%, transparent 70%)' }} />
          <div className="relative px-5 py-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">🐾</span>
              <span className="text-xl font-black text-white tracking-tight">Daimon</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Avventura nella natura adriatica e nei boschi appenninici.<br />
              Cattura, evolvi, combatti — diventa il miglior cacciatore!
            </p>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              {QUICK_LINKS.map(({ tag, id }) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-white/8 border border-white/12 text-white/70 whitespace-nowrap shrink-0 transition-all active:scale-95"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)' }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={replayOnboarding}
                disabled={replaying}
                className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: 'rgba(58,188,168,0.12)',
                  border: '1px solid rgba(58,188,168,0.35)',
                  color: '#3ABCA8',
                }}
              >
                {replaying ? '...' : <>🎓 Tutorial</>}
              </button>
              <button
                onClick={replayCoachmarks}
                className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(247,200,65,0.12)',
                  border: '1px solid rgba(247,200,65,0.35)',
                  color: '#F7C841',
                }}
              >
                💡 Suggerimenti UI
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="px-4 space-y-3 pb-24">
        {sections.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">Nessun argomento trovato per &ldquo;{query}&rdquo;</div>
        ) : (
          sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))
        )}
      </div>
    </div>
  )
}
