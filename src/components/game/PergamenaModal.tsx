'use client'
import { motion } from 'framer-motion'
import { GiScrollUnfurled, GiTiedScroll } from 'react-icons/gi'
import { describeDrop } from './loot-visuals'

export interface PergamenaDrop { type: string; ok: boolean; detail: Record<string, any> }

/**
 * Reveal di una pergamena aperta: lo srotolo (clip-path animato) svela
 * l'aneddoto trovato camminando + le gemme. Palette pergamena/inchiostro,
 * coerente con la Collezione.
 */
export default function PergamenaModal({ drops, onDone }: { drops: PergamenaDrop[]; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-5 bg-black/85 backdrop-blur-sm" onClick={onDone}>
      <motion.div onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(175deg, #241d10 0%, #171208 70%)', border: '1px solid rgba(230,201,137,0.4)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}
        initial={{ scale: 0.85, opacity: 0, rotate: -2 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}>

        <div className="relative px-5 pt-6 pb-4 text-center" style={{ background: 'linear-gradient(180deg, rgba(230,201,137,0.14), transparent)' }}>
          <motion.div initial={{ rotate: -8, y: -6 }} animate={{ rotate: 0, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}>
            <GiScrollUnfurled size={40} color="#E6C989" className="mx-auto mb-2" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }} />
          </motion.div>
          <h2 className="text-white font-extrabold text-lg leading-tight">La pergamena si srotola…</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(230,201,137,0.65)' }}>Un frammento di storia trovato camminando</p>
        </div>

        {/* srotolo: i contenuti appaiono dall'alto come rivelati dallo scroll */}
        <div className="px-5 pb-6 pt-1 space-y-2 overflow-hidden">
          {drops.map((d, i) => {
            const v = describeDrop(d.type, d.detail)
            const { Icon } = v
            return (
              <motion.div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: `linear-gradient(120deg, ${v.accent}18, rgba(255,255,255,0.02))`, border: `1px solid ${v.accent}45` }}
                initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
                animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
                transition={{ delay: 0.25 + i * 0.3, duration: 0.45, ease: 'easeOut' }}>
                <div className="rounded-lg flex items-center justify-center shrink-0"
                  style={{ width: 40, height: 40, background: `radial-gradient(circle at 40% 30%, ${v.accent}3a, transparent 75%)` }}>
                  <Icon size={24} color={v.accent} />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm leading-tight">{v.title}</p>
                  {v.subtitle && <p className="text-[11px] capitalize" style={{ color: v.accent }}>{v.subtitle}</p>}
                </div>
              </motion.div>
            )
          })}

          <motion.button onClick={onDone}
            className="w-full mt-2 py-3.5 rounded-2xl font-extrabold text-sm"
            style={{ background: 'linear-gradient(135deg, #E6C989, #C8A24A)', color: '#171208', boxShadow: '0 5px 20px rgba(230,201,137,0.3)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + drops.length * 0.3 }}
            whileTap={{ scale: 0.97 }}>
            <span className="inline-flex items-center gap-2"><GiTiedScroll size={16} /> Nella Collezione!</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
