'use client'
import { useEffect, useState } from 'react'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { playEggHatch } from '@/lib/game/sounds/hatch'

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

export interface HatchedCreature {
  name: string
  rarity: string
  element: string
  image_url: string | null
  hp?: number
  atk?: number
  def?: number
  description?: string | null
  isStarter?: boolean
}

export default function EggHatchModal({
  creature,
  queueRemaining = 0,
  onDone,
}: {
  creature: HatchedCreature
  queueRemaining?: number
  onDone: () => void
}) {
  const [phase, setPhase] = useState<'shake' | 'crack' | 'reveal'>('shake')
  const [cardVisible, setCardVisible] = useState(false)

  useEffect(() => {
    if (creature.isStarter) {
      setPhase('reveal')
      const t = setTimeout(() => setCardVisible(true), 80)
      return () => clearTimeout(t)
    }
    const t1 = setTimeout(() => { setPhase('crack'); playEggHatch(creature.rarity) }, 900)
    const t2 = setTimeout(() => { setPhase('reveal'); setTimeout(() => setCardVisible(true), 80) }, 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rarityColor = RARITY_COLOR[creature.rarity] ?? '#9CA3AF'
  const glow = ELEMENT_GLOW[creature.element] ?? rarityColor
  const elemEmoji = ELEMENT_EMOJI[creature.element] ?? '✦'

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center bg-black/88 backdrop-blur-sm">
      {phase !== 'reveal' && (
        <div
          className="text-8xl select-none"
          style={{ animation: phase === 'shake' ? 'eggShake 0.85s ease-in-out' : 'eggCrack 0.85s ease-out' }}
        >
          {phase === 'shake' ? '🥚' : '🐣'}
        </div>
      )}

      {phase === 'reveal' && (
        <>
          <div className="absolute inset-0" onClick={onDone} />

          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-y-auto"
            style={{
              background: '#080E1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
              maxHeight: '88vh',
              transform: cardVisible ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div className="flex justify-center pt-3 mb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="relative pt-2 pb-2" style={{
              background: `linear-gradient(180deg, ${glow}18 0%, transparent 100%)`,
            }}>
              <div className="flex justify-center mb-3">
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full font-extrabold text-sm"
                  style={{
                    background: glow,
                    color: '#080E1A',
                    boxShadow: `0 4px 20px ${glow}60`,
                    opacity: cardVisible ? 1 : 0,
                    transform: cardVisible ? 'scale(1)' : 'scale(0.6)',
                    transition: 'opacity 0.3s 0.15s, transform 0.4s 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {creature.isStarter ? '🌟 Il tuo Starter!' : '🥚 Schiuso!'}
                </div>
              </div>

              <div className="flex justify-center" style={{
                opacity: cardVisible ? 1 : 0,
                transform: cardVisible ? 'scale(1)' : 'scale(0.5)',
                transition: 'opacity 0.35s 0.1s, transform 0.45s 0.1s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <CreatureSprite
                  imageUrl={creature.image_url ?? ''}
                  name={creature.name}
                  animState="idle"
                  size={160}
                  element={creature.element as any}
                  rarity={creature.rarity as any}
                  showAura
                />
              </div>
            </div>

            <div className="px-5 pb-8">
              <div className="text-center mb-4" style={{
                opacity: cardVisible ? 1 : 0,
                transition: 'opacity 0.3s 0.25s',
              }}>
                <h3 className="text-2xl font-bold text-white mb-1">{creature.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-base">{elemEmoji}</span>
                  <span className="text-xs capitalize text-white/40">{creature.element}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${rarityColor}22`, color: rarityColor, border: `1px solid ${rarityColor}55` }}>
                    {RARITY_LABEL[creature.rarity] ?? creature.rarity}
                  </span>
                </div>
                {creature.description && (
                  <p className="text-sm text-white/45 mt-3 leading-relaxed">{creature.description}</p>
                )}
              </div>

              {(creature.hp || creature.atk || creature.def) && (
                <div className="grid grid-cols-3 gap-2 mb-5" style={{
                  opacity: cardVisible ? 1 : 0,
                  transition: 'opacity 0.3s 0.32s',
                }}>
                  {[
                    { label: 'HP',  value: creature.hp,  color: '#F87171' },
                    { label: 'ATK', value: creature.atk, color: '#FB923C' },
                    { label: 'DEF', value: creature.def, color: '#60A5FA' },
                  ].map(s => (
                    <div key={s.label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${s.color}20` }}
                    >
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-white/35 mt-0.5 font-semibold uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onDone}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{
                  background: `linear-gradient(135deg, ${glow} 0%, ${glow}99 100%)`,
                  boxShadow: `0 4px 24px ${glow}45`,
                  opacity: cardVisible ? 1 : 0,
                  transition: 'opacity 0.3s 0.4s',
                }}
              >
                {creature.isStarter
                  ? 'Inizia l\'avventura!'
                  : queueRemaining > 0
                    ? `Continua · ancora ${queueRemaining} ${queueRemaining === 1 ? 'uovo' : 'uova'}`
                    : 'Continua'
                }
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes eggShake {
          0%,100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-10deg) scale(1.05); }
          30% { transform: rotate(10deg) scale(1.05); }
          45% { transform: rotate(-8deg) scale(1.08); }
          60% { transform: rotate(8deg) scale(1.08); }
          75% { transform: rotate(-5deg) scale(1.1); }
          90% { transform: rotate(5deg) scale(1.1); }
        }
        @keyframes eggCrack {
          0% { transform: scale(1); }
          30% { transform: scale(1.3); }
          60% { transform: scale(0.9); }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
