'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptics } from '@/lib/haptics'

export interface LockConfig { alphabet: string; length: number }

/**
 * Lucchetto a rulli (stile slot-machine da sala giochi, come da design DAIMON):
 * un rullo d'ottone per carattere, frecce ▲/▼ per far scorrere l'alfabeto,
 * "Prova" invia la combinazione al solve endpoint esistente. Il server resta
 * l'unico giudice della soluzione.
 */
export default function EnigmaLock({
  config, onSubmit, submitting = false, wrong = false,
}: {
  config: LockConfig
  onSubmit: (solution: string) => void
  submitting?: boolean
  /** Ultimo tentativo errato → shake dei rulli. */
  wrong?: boolean
}) {
  const alphabet = (config.alphabet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789').toUpperCase()
  const length = Math.max(1, Math.min(config.length || 4, 8))
  const [indices, setIndices] = useState<number[]>(() => Array(length).fill(0))

  function spin(slot: number, dir: 1 | -1) {
    if (submitting) return
    haptics.tap()
    setIndices(prev => prev.map((v, i) =>
      i === slot ? (v + dir + alphabet.length) % alphabet.length : v))
  }

  const solution = indices.map(i => alphabet[i]).join('')

  return (
    <div className="space-y-3">
      <motion.div
        className="flex justify-center gap-1.5"
        animate={wrong ? { x: [0, -9, 9, -6, 6, 0] } : {}}
        transition={{ duration: 0.45 }}>
        {indices.map((idx, slot) => {
          const prev = alphabet[(idx - 1 + alphabet.length) % alphabet.length]
          const next = alphabet[(idx + 1) % alphabet.length]
          return (
            <div key={slot} className="flex flex-col items-center gap-1">
              <button type="button" aria-label={`Rullo ${slot + 1} su`}
                onClick={() => spin(slot, -1)} disabled={submitting}
                className="w-9 h-7 rounded-t-lg flex items-center justify-center text-[11px] font-black disabled:opacity-40"
                style={{ background: 'rgba(230,201,137,0.14)', color: '#E6C989', border: '1px solid rgba(230,201,137,0.3)', borderBottom: 'none' }}>
                ▲
              </button>

              {/* Drum */}
              <div className="relative w-9 h-[74px] overflow-hidden rounded-md"
                style={{
                  background: 'linear-gradient(180deg, #17130a 0%, #2a2412 50%, #17130a 100%)',
                  border: '1px solid rgba(230,201,137,0.45)',
                  boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.7), inset 0 -4px 8px rgba(0,0,0,0.7), 0 1px 0 rgba(255,236,150,0.12)',
                }}>
                {/* neighbours, faint */}
                <span aria-hidden className="absolute inset-x-0 top-0.5 text-center text-[11px] font-bold" style={{ color: 'rgba(230,201,137,0.22)' }}>{prev}</span>
                <span aria-hidden className="absolute inset-x-0 bottom-0.5 text-center text-[11px] font-bold" style={{ color: 'rgba(230,201,137,0.22)' }}>{next}</span>
                {/* centre band */}
                <span aria-hidden className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-7 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, rgba(230,201,137,0.10), rgba(230,201,137,0.2), rgba(230,201,137,0.10))', borderTop: '1px solid rgba(230,201,137,0.35)', borderBottom: '1px solid rgba(230,201,137,0.35)' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={`${slot}-${idx}`}
                      className="text-xl font-black"
                      style={{ color: '#FFE9A6', textShadow: '0 1px 4px rgba(0,0,0,0.8)', fontFamily: 'ui-monospace, monospace' }}
                      initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 30 }}>
                      {alphabet[idx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              <button type="button" aria-label={`Rullo ${slot + 1} giù`}
                onClick={() => spin(slot, 1)} disabled={submitting}
                className="w-9 h-7 rounded-b-lg flex items-center justify-center text-[11px] font-black disabled:opacity-40"
                style={{ background: 'rgba(230,201,137,0.14)', color: '#E6C989', border: '1px solid rgba(230,201,137,0.3)', borderTop: 'none' }}>
                ▼
              </button>
            </div>
          )
        })}
      </motion.div>

      <button type="button" onClick={() => onSubmit(solution)} disabled={submitting}
        className="w-full py-3 rounded-xl font-extrabold text-sm disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #E6C989, #C8A24A)', color: '#17130a', boxShadow: '0 4px 18px rgba(230,201,137,0.3)' }}>
        {submitting ? 'Verifica…' : `🔓 Prova ${solution}`}
      </button>
    </div>
  )
}
