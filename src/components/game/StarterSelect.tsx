'use client'
import { useState } from 'react'
import CreatureDiorama from '@/components/creature/CreatureDiorama'

const RARITY_COLOR: Record<string, string> = {
  comune:      '#9CA3AF',
  non_comune:  '#34D399',
  raro:        '#3A9DBC',
  epico:       '#C084FC',
  leggendario: '#FBBF24',
  mitologico:  '#FF4D6D',
}

const RARITY_LABEL: Record<string, string> = {
  comune:      'Terrestre',
  non_comune:  'Arcaico',
  raro:        'Eroico',
  epico:       'Mostruoso',
  leggendario: 'Leggendario',
  mitologico:  'Mitologico',
}

const ELEMENT_GLOW: Record<string, string> = {
  fiamma:    '#FF6B35',
  adriatico: '#3A9DBC',
  bosco:     '#34D399',
  terra:     '#A78BFA',
  armonia:   '#F9A8D4',
}

const ELEMENT_EMOJI: Record<string, string> = {
  fiamma: '🔥', adriatico: '🌊', bosco: '🌿', terra: '⚡', armonia: '✨',
}

export interface StarterCreature {
  id: string
  name: string
  rarity: string
  element: string
  image_url: string | null
  sprite_cutout_url?: string | null
  sprite_url: string | null
  hp: number
  atk: number
  def: number
  description: string | null
}

export default function StarterSelect({
  starters,
  onPicked,
}: {
  starters: StarterCreature[]
  onPicked: (creature: StarterCreature) => void
}) {
  const [selected, setSelected] = useState<StarterCreature | null>(null)
  const [confirming, setConfirming] = useState(false)

  const glow = selected ? (ELEMENT_GLOW[selected.element] ?? '#3A9DBC') : '#3A9DBC'
  const rarityColor = selected ? (RARITY_COLOR[selected.rarity] ?? '#9CA3AF') : '#9CA3AF'

  return (
    <div
      className="fixed inset-0 z-[1300] flex flex-col"
      style={{ background: 'linear-gradient(180deg, #020810 0%, #080E1A 100%)' }}
    >
      <div className="shrink-0 px-5 pt-10 pb-4 text-center">
        <div
          className="inline-block text-4xl mb-3"
          style={{ animation: 'starterFloat 3s ease-in-out infinite' }}
        >
          🌟
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Scegli il tuo Starter!</h1>
        <p className="text-sm text-white/45 mt-1">La tua prima creatura compagna di avventura</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {starters.map(c => {
            const isSelected = selected?.id === c.id
            const cGlow = ELEMENT_GLOW[c.element] ?? '#3A9DBC'
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="relative rounded-2xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95"
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${cGlow}22 0%, ${cGlow}10 100%)`
                    : 'rgba(255,255,255,0.04)',
                  border: isSelected
                    ? `2px solid ${cGlow}`
                    : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: isSelected ? `0 0 18px ${cGlow}40` : 'none',
                }}
              >
                <CreatureDiorama
                  creature={c}
                  size={86}
                  rounded={16}
                  showAura={isSelected}
                  className="w-24 h-24"
                />
                <p className="text-sm font-bold text-white text-center leading-tight">{c.name}</p>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${cGlow}22`, color: cGlow }}
                >
                  {ELEMENT_EMOJI[c.element] ?? '✦'} {c.element}
                </div>
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: cGlow }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#080E1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="shrink-0 rounded-t-3xl overflow-hidden"
        style={{
          background: '#080E1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          transform: selected ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '55vh',
        }}
      >
        {selected && (
          <div className="overflow-y-auto max-h-full">
            <div className="flex justify-center pt-3 mb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div
              className="relative px-5 pt-2 pb-3"
              style={{ background: `linear-gradient(180deg, ${glow}18 0%, transparent 100%)` }}
            >
              <div className="flex items-center gap-4">
                <CreatureDiorama
                  creature={selected}
                  size={92}
                  rounded={16}
                  anchor="center"
                  className="shrink-0"
                  style={{ width: 104, height: 104 }}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-white leading-tight">{selected.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${rarityColor}22`, color: rarityColor, border: `1px solid ${rarityColor}44` }}
                    >
                      {RARITY_LABEL[selected.rarity] ?? selected.rarity}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${glow}22`, color: glow }}
                    >
                      {ELEMENT_EMOJI[selected.element] ?? '✦'} {selected.element}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[
                      { label: 'HP',  value: selected.hp,  color: '#F87171' },
                      { label: 'ATK', value: selected.atk, color: '#FB923C' },
                      { label: 'DEF', value: selected.def, color: '#60A5FA' },
                    ].map(s => (
                      <div key={s.label} className="flex flex-col items-center">
                        <span className="text-base font-bold" style={{ color: s.color }}>{s.value}</span>
                        <span className="text-[9px] text-white/35 font-semibold uppercase tracking-wide">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selected.description && (
                <p className="text-xs text-white/45 mt-3 leading-relaxed">{selected.description}</p>
              )}
            </div>

            <div className="px-5 pb-6 pt-2">
              <button
                disabled={confirming}
                onClick={async () => {
                  if (!selected || confirming) return
                  setConfirming(true)
                  onPicked(selected)
                }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base disabled:opacity-70 transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${glow} 0%, ${glow}99 100%)`,
                  boxShadow: `0 4px 24px ${glow}45`,
                  color: '#080E1A',
                }}
              >
                {confirming ? 'Scelgo...' : `Scegli ${selected.name}!`}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes starterFloat {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
      `}</style>
    </div>
  )
}
