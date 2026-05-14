'use client'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * One-time tooltip the first time the player enters a boss combat in
 * the tutorial session. Explains element relationships and what the
 * action buttons do, so the boss screen isn't a wall of unfamiliar UI.
 *
 * Persistence is local-storage based (key passed in via props so the
 * caller can control reset on tutorial replay).
 */
interface Props {
  open: boolean
  onClose: () => void
}

const ELEMENTS = [
  { emoji: '🔥', name: 'Fiamma',    strong: 'Bosco',    weak: 'Adriatico' },
  { emoji: '🌊', name: 'Adriatico', strong: 'Fiamma',   weak: 'Bosco' },
  { emoji: '🌿', name: 'Bosco',     strong: 'Adriatico',weak: 'Fiamma' },
  { emoji: '⛰️', name: 'Terra',     strong: '—',        weak: '—' },
  { emoji: '✨', name: 'Armonia',   strong: 'Tutti',    weak: 'Nessuno' },
]

export default function TutorialElementsModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1300] flex flex-col items-center justify-center px-5"
          style={{ background: 'rgba(2,4,12,0.92)', backdropFilter: 'blur(16px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl bg-[#0F1F2E] border border-white/10 p-5 shadow-2xl"
            initial={{ y: 20, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <p className="text-[10px] tracking-widest uppercase font-bold text-[#FBBF24]/80">
                  Lezione del maestro
                </p>
                <h2 className="text-lg font-extrabold text-white leading-tight">
                  Elementi e duello
                </h2>
              </div>
            </div>

            <p className="text-sm text-white/70 leading-relaxed mb-4">
              Ogni Daimon ha un elemento. Alcuni elementi sono <span className="text-[#34D399] font-bold">forti</span> contro
              altri (+20% danno), altri <span className="text-[#F87171] font-bold">deboli</span> (−20%).
              Sceglilo strategicamente.
            </p>

            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden mb-4">
              <div className="grid grid-cols-3 text-[10px] font-bold tracking-wider uppercase text-white/40 px-3 py-2 border-b border-white/10">
                <span>Elemento</span>
                <span className="text-[#34D399]">Forte contro</span>
                <span className="text-[#F87171]">Debole contro</span>
              </div>
              {ELEMENTS.map(e => (
                <div key={e.name} className="grid grid-cols-3 items-center px-3 py-1.5 border-b border-white/5 last:border-0 text-xs">
                  <span className="flex items-center gap-1.5 text-white font-semibold">
                    <span>{e.emoji}</span>{e.name}
                  </span>
                  <span className="text-[#34D399]">{e.strong}</span>
                  <span className="text-[#F87171]">{e.weak}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 mb-5 text-[12px] text-white/65 leading-relaxed">
              <p><span className="text-white font-bold">⚔️ Attacca</span> — danno basato su ATK − DEF avversario, +modificatore elemento.</p>
              <p><span className="text-white font-bold">💊 Cura</span> — usa una pozione per ripristinare HP della creatura attiva.</p>
              <p><span className="text-white font-bold">🔄 Cambia</span> — sostituisci la creatura attiva con un&apos;altra della tua squadra.</p>
              <p className="text-white/40 italic pt-1">Il boss del tutorial è di tipo <span className="font-bold text-[#C084FC]">Armonia</span> — nessun elemento è in svantaggio. Battaglia equa.</p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl font-extrabold text-white text-sm"
              style={{
                background: 'linear-gradient(135deg,#3A9DBC,#2d7a99)',
                boxShadow: '0 4px 18px rgba(58,157,188,0.4)',
              }}
            >
              Sono pronto, iniziamo
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
