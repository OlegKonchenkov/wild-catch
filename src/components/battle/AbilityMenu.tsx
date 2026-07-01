'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { Ability } from '@/lib/game/abilities'
import ElementIcon from '@/components/ui/ElementIcon'
import { CATEGORY_META, abilityAccent, buildAbilityChips, AbilityGlyph } from '@/components/game/ability-visuals'

export interface BattleMove { ability: Ability }

/**
 * Battle move selector — a bottom sheet listing the free base attack plus the
 * creature's up-to-4 learned abilities. Picking a move fires it; the server
 * enforces cooldown / PP / charge so the sheet stays simple.
 */
export default function AbilityMenu({
  open, onClose, element, moves, onSelect, busy,
}: {
  open: boolean
  onClose: () => void
  element: string
  moves: BattleMove[]
  onSelect: (abilityId: string | null) => void
  busy?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-md bg-[#0c1c2b] border-t border-white/12 rounded-t-2xl p-4 pb-6 max-h-[74vh] overflow-y-auto"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="flex justify-center pb-2"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white text-sm tracking-wide">Scegli una mossa</h3>
              <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Base attack — always available */}
            <button
              disabled={busy}
              onClick={() => onSelect(null)}
              className="w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 mb-2 disabled:opacity-50 transition-all"
              style={{ background: 'rgba(96,205,221,0.10)', border: '1px solid rgba(96,205,221,0.35)' }}
            >
              <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(96,205,221,0.16)' }}>
                <ElementIcon element={element} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-extrabold text-white">Attacco base</p>
                <p className="text-[10px] text-white/45">Affidabile · nessun costo</p>
              </div>
              <span className="text-[11px] font-extrabold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(96,205,221,0.2)', color: '#60CDDD', border: '1px solid rgba(96,205,221,0.5)' }}>
                Usa
              </span>
            </button>

            {moves.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-4">
                Nessuna abilità appresa. Imparane nella scheda del Daimon (tab Abilità)!
              </p>
            ) : (
              <div className="space-y-2">
                {moves.map(({ ability }) => {
                  const accent = abilityAccent(ability)
                  const cat = CATEGORY_META[ability.category]
                  const chips = buildAbilityChips(ability).slice(0, 4)
                  return (
                    <motion.button
                      key={ability.id}
                      whileTap={{ scale: 0.98 }}
                      disabled={busy}
                      onClick={() => onSelect(ability.id)}
                      className="w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 disabled:opacity-50 relative overflow-hidden transition-all"
                      style={{ background: `${accent}10`, border: `1px solid ${accent}3d` }}
                    >
                      <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ background: accent }} />
                      <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${accent}1c` }}>
                        <AbilityGlyph ability={ability} size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[14px] font-extrabold text-white truncate">{ability.name}</p>
                          {ability.element && <ElementIcon element={ability.element} size={12} />}
                          {cat && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: `${cat.color}1a`, color: cat.color }}>{cat.label}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {chips.map(c => (
                            <span key={c.key} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none"
                              style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30` }}>{c.label}</span>
                          ))}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
