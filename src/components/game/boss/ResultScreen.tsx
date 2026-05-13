'use client'
import { motion } from 'framer-motion'
import { ELEMENT_EMOJI, RARITY_COLORS, RARITY_LABELS } from '@/lib/types'

interface BossReward {
  gold?: number
  exp?: number
  item_name?: string
  item_qty?: number
  creature?: {
    name: string
    rarity: string
    element: string
    image_url?: string | null
    sprite_url?: string | null
  }
}

export default function ResultScreen({
  won,
  reward,
  levelUp,
  onExit,
  ctaLabel,
}: {
  won: boolean
  reward: BossReward | null
  levelUp: { newLevel: number; goldReward: number } | null
  onExit: () => void
  ctaLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-7xl"
      >
        {won ? '🏆' : '💀'}
      </motion.div>

      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-1">
          {won ? 'Vittoria!' : 'Sconfitta'}
        </h2>
        <p className="text-white/50 text-sm">
          {won ? 'Hai sconfitto il Capo Palestra!' : 'Il Capo Palestra è troppo forte...'}
        </p>
      </div>

      {won && reward && (
        <div
          className="w-full rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(247,200,65,0.06)', border: '1px solid rgba(247,200,65,0.2)' }}
        >
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold text-center">
            Ricompense
          </p>

          <div className="grid grid-cols-2 gap-2">
            {(reward.gold ?? 0) > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(247,200,65,0.08)', border: '1px solid rgba(247,200,65,0.2)' }}
              >
                <span className="text-lg">🪙</span>
                <div>
                  <p className="font-extrabold text-sm" style={{ color: '#F7C841' }}>{reward.gold}</p>
                  <p className="text-white/30 text-xs">Oro</p>
                </div>
              </div>
            )}
            {(reward.exp ?? 0) > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(58,157,188,0.08)', border: '1px solid rgba(58,157,188,0.2)' }}
              >
                <span className="text-lg">✨</span>
                <div>
                  <p className="font-extrabold text-sm" style={{ color: '#3A9DBC' }}>{reward.exp}</p>
                  <p className="text-white/30 text-xs">EXP</p>
                </div>
              </div>
            )}
          </div>

          {reward.item_name && (
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <span className="text-xl">🎁</span>
              <div>
                <p className="font-extrabold text-sm text-white">{reward.item_name}</p>
                <p className="text-white/30 text-xs">× {reward.item_qty ?? 1} oggetto</p>
              </div>
            </div>
          )}

          {reward.creature && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <p className="text-xs text-white/40 px-3 pt-2.5 pb-1 font-semibold uppercase tracking-wider">
                Creatura catturata!
              </p>
              <div className="flex items-center gap-3 px-3 pb-3">
                {(reward.creature.image_url || reward.creature.sprite_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reward.creature.image_url ?? reward.creature.sprite_url ?? ''}
                    alt={reward.creature.name}
                    className="w-14 h-14 rounded-xl object-cover"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                )}
                <div>
                  <p className="font-extrabold text-sm text-white">{reward.creature.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {RARITY_COLORS[reward.creature.rarity as keyof typeof RARITY_COLORS] ? (
                      <span
                        style={{ color: RARITY_COLORS[reward.creature.rarity as keyof typeof RARITY_COLORS] }}
                      >
                        {RARITY_LABELS[reward.creature.rarity as keyof typeof RARITY_LABELS] ?? reward.creature.rarity}
                      </span>
                    ) : (
                      reward.creature.rarity
                    )}
                    {reward.creature.element &&
                      ` · ${ELEMENT_EMOJI[reward.creature.element as keyof typeof ELEMENT_EMOJI] ?? ''} ${reward.creature.element}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {levelUp && (
            <div className="text-center">
              <span className="text-sm font-bold" style={{ color: '#F7C841' }}>
                ⭐ Level Up! Livello {levelUp.newLevel}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onExit}
        className="w-full text-white font-extrabold py-4 rounded-2xl text-base"
        style={{
          background: won
            ? 'linear-gradient(135deg, #F7C841 0%, #d4a030 100%)'
            : 'rgba(255,255,255,0.08)',
          boxShadow: won ? '0 4px 20px rgba(247,200,65,0.35)' : 'none',
          color: won ? '#0D0205' : 'white',
        }}
      >
        {ctaLabel ?? (won ? 'Continua →' : 'Torna al gioco')}
      </button>
    </div>
  )
}
