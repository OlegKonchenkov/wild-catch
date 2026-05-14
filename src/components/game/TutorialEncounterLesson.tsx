'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

/**
 * One-time encounter lesson — fired the FIRST time the player enters
 * an encounter in the tutorial session. Explains in 4 short slides:
 *   1. The HP bar + difficulty stars
 *   2. The action buttons (attack / catch / item / flee)
 *   3. Item types (rete / esca / cura / battaglia / pozione)
 *   4. Status effects + a hint about elemental matchups
 *
 * Designed to be skimmable, not read-heavy. The boss-fight elements
 * lesson (TutorialElementsModal) goes deeper later — this one is the
 * "first taste" so the player doesn't tap blindly on their first wild.
 *
 * Persistence: localStorage key `wc:tutorial-encounter-lesson-seen`.
 * Tutorial reset clears the flag so a replay re-arms the lesson.
 */

interface Props {
  open: boolean
  onClose: () => void
}

const SLIDES = [
  {
    title: 'Hai trovato un Daimon!',
    emoji: '🎯',
    body: (
      <div className="space-y-3 text-sm text-white/70 leading-relaxed">
        <p>Due informazioni chiave in alto:</p>
        <ul className="space-y-2 text-[13px]">
          <li className="flex items-start gap-2">
            <span className="text-base shrink-0">❤️</span>
            <span><b className="text-white">Barra HP</b> — più la indebolisci, più aumenta la probabilità di cattura.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-base shrink-0">⭐</span>
            <span><b className="text-white">Stelline di difficoltà</b> (1–5): più ne ha, più sarà difficile da catturare. Una creatura da 5⭐ richiede strategia.</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Le tue azioni',
    emoji: '🎮',
    body: (
      <div className="space-y-2.5 text-[13px] text-white/75 leading-relaxed">
        <div className="flex items-start gap-2.5">
          <span className="text-lg shrink-0">⚔️</span>
          <span><b className="text-white">Attacca</b> — riduci gli HP del Daimon selvatico.</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-lg shrink-0">🎯</span>
          <span><b className="text-white">Cattura</b> — tenta di catturarlo (selezionando una Rete dalla lista oggetti per aumentare le chance).</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-lg shrink-0">🎒</span>
          <span><b className="text-white">Oggetti</b> — apri lo zaino in combattimento per usare cura, battaglia, pozioni.</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-lg shrink-0">🏃</span>
          <span><b className="text-white">Fuga</b> — abbandona l&apos;incontro. Nessuna ricompensa ma nessun rischio.</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Gli oggetti utili',
    emoji: '🎁',
    body: (
      <div className="space-y-2 text-[12.5px] text-white/75 leading-relaxed">
        <div className="rounded-lg bg-[#3A9DBC]/10 border border-[#3A9DBC]/30 px-2.5 py-1.5">
          <p><span className="text-base">🎯</span> <b className="text-[#3A9DBC]">Rete</b> — moltiplica le chance di cattura (es. ×2). Si usa selezionandola prima di toccare &quot;Cattura&quot;.</p>
        </div>
        <div className="rounded-lg bg-[#34D399]/10 border border-[#34D399]/30 px-2.5 py-1.5">
          <p><span className="text-base">🍖</span> <b className="text-[#34D399]">Esca</b> — attiva un effetto passivo di 10 minuti che attrae più creature rare sulla mappa. Si attiva dallo <b>Zaino</b>, non in combattimento.</p>
        </div>
        <div className="rounded-lg bg-[#34D399]/10 border border-[#34D399]/30 px-2.5 py-1.5">
          <p><span className="text-base">💊</span> <b className="text-[#34D399]">Cura</b> — ripristina HP della tua creatura ferita.</p>
        </div>
        <div className="rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/30 px-2.5 py-1.5">
          <p><span className="text-base">⚔️</span> <b className="text-[#FBBF24]">Battaglia</b> — potenzia il tuo attacco per un turno.</p>
        </div>
        <div className="rounded-lg bg-[#F472B6]/10 border border-[#F472B6]/30 px-2.5 py-1.5">
          <p><span className="text-base">🧪</span> <b className="text-[#F472B6]">Pozione</b> — neutralizza una debolezza elementale.</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Effetti di stato + elementi',
    emoji: '✨',
    body: (
      <div className="space-y-3 text-[12.5px] text-white/75 leading-relaxed">
        <div>
          <p className="mb-1.5">Alcune creature applicano <b className="text-white">effetti di stato</b> durante il combattimento:</p>
          <ul className="space-y-1">
            <li>⚡ <b className="text-[#FBBF24]">Paralisi</b> — può saltare il turno.</li>
            <li>💤 <b className="text-[#60A5FA]">Sonno</b> — non attacca, +catch.</li>
            <li>💫 <b className="text-[#C084FC]">Confusione</b> — può colpire sé stessa.</li>
            <li>☠️ <b className="text-[#4ADE80]">Veleno</b> — perde HP a ogni turno.</li>
          </ul>
        </div>
        <p className="text-white/60 border-t border-white/10 pt-2">
          🔥💧🌿⛰️✨ Ogni Daimon ha un <b className="text-white">elemento</b>. Fiamma è forte contro Bosco, Bosco contro Adriatico, Adriatico contro Fiamma. Armonia è neutra.
        </p>
      </div>
    ),
  },
]

export default function TutorialEncounterLesson({ open, onClose }: Props) {
  const [slide, setSlide] = useState(0)
  const total = SLIDES.length
  const cur = SLIDES[slide]
  const isLast = slide === total - 1

  function advance() {
    if (isLast) {
      onClose()
      // Reset to slide 0 next time, in case the component is reopened.
      setTimeout(() => setSlide(0), 300)
    } else {
      setSlide(s => s + 1)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1250] flex flex-col items-center justify-center px-5"
          style={{ background: 'rgba(2,4,12,0.94)', backdropFilter: 'blur(16px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl bg-[#0F1F2E] border border-white/10 p-5 shadow-2xl"
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{cur.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] tracking-widest uppercase font-bold text-[#3ABCA8]/80">
                  Tutorial — primo incontro
                </p>
                <h2 className="text-base font-extrabold text-white leading-tight truncate">{cur.title}</h2>
              </div>
            </div>

            {/* Slide content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="mb-4 min-h-[200px]"
              >
                {cur.body}
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === slide ? 22 : 6,
                    height: 6,
                    background: i <= slide ? '#3ABCA8' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { onClose(); setTimeout(() => setSlide(0), 300) }}
                className="text-white/40 text-xs font-semibold px-3 py-2"
              >
                Salta
              </button>
              <button
                onClick={advance}
                className="flex-1 py-3 rounded-2xl font-extrabold text-white text-sm"
                style={{
                  background: 'linear-gradient(135deg,#3A9DBC,#2d7a99)',
                  boxShadow: '0 4px 18px rgba(58,157,188,0.4)',
                }}
              >
                {isLast ? 'Iniziamo!' : 'Avanti'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
