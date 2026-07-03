'use client'
import { motion } from 'framer-motion'
import { GiTrophyCup, GiDeathSkull, GiTwoCoins, GiRoundStar } from 'react-icons/gi'
import { RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
import ElementIcon from '@/components/ui/ElementIcon'

// Boss victory confetti — emitted from the trophy in a starburst pattern.
const CONFETTI_PIECES = Array.from({ length: 16 }).map((_, i) => {
  const angle = (i / 16) * Math.PI * 2
  return {
    id: i,
    x: Math.cos(angle) * (110 + Math.random() * 50),
    y: Math.sin(angle) * (110 + Math.random() * 50),
    rotate: Math.random() * 720 - 360,
    color: ['#FBBF24', '#3A9DBC', '#C084FC', '#34D399', '#E85D2F'][i % 5],
    delay: Math.random() * 0.2,
  }
})

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
    sprite_cutout_url?: string | null
    sprite_url?: string | null
  }
  /** Guardiano del luogo sconfitto → luogo liberato (Wave 2). */
  placeUnlocked?: {
    placeName: string
    drops: Array<{ type: string; ok: boolean; detail: Record<string, unknown> }>
  }
  /** Palestra presidiabile conquistata (Wave 2). */
  gymTaken?: boolean
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
      <div className="relative flex items-center justify-center">
        {/* Victory aura — expanding glow rings */}
        {won && (
          <>
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)' }}
              initial={{ width: 60, height: 60, opacity: 0 }}
              animate={{ width: 280, height: 280, opacity: [0, 1, 0] }}
              transition={{ duration: 1.4, delay: 0.1, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border-2 pointer-events-none"
              style={{ borderColor: 'rgba(251,191,36,0.5)' }}
              initial={{ width: 80, height: 80, opacity: 1 }}
              animate={{ width: 240, height: 240, opacity: 0 }}
              transition={{ duration: 1.2, delay: 0.25, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full border pointer-events-none"
              style={{ borderColor: 'rgba(251,191,36,0.3)' }}
              initial={{ width: 80, height: 80, opacity: 1 }}
              animate={{ width: 320, height: 320, opacity: 0 }}
              transition={{ duration: 1.6, delay: 0.4, ease: 'easeOut' }}
            />

            {/* Confetti starburst */}
            {CONFETTI_PIECES.map(p => (
              <motion.div
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  width: 8, height: 12,
                  background: p.color,
                  boxShadow: `0 0 6px ${p.color}`,
                }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.4 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  rotate: p.rotate,
                  opacity: [0, 1, 1, 0],
                  scale: [0.4, 1, 1, 0.6],
                }}
                transition={{
                  duration: 1.6,
                  delay: 0.2 + p.delay,
                  ease: 'easeOut',
                  times: [0, 0.15, 0.7, 1],
                }}
              />
            ))}
          </>
        )}

        <motion.div
          initial={{ scale: 0, rotate: won ? -45 : 0 }}
          animate={{
            scale: won ? [0, 1.3, 1] : 1,
            rotate: won ? [0, 0, 0] : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: won ? 220 : 200,
            damping: won ? 14 : 15,
            duration: won ? 0.8 : undefined,
            times: won ? [0, 0.6, 1] : undefined,
          }}
          className="relative z-10 flex items-center justify-center"
          style={{
            filter: won ? 'drop-shadow(0 0 24px rgba(251,191,36,0.6))' : undefined,
          }}
        >
          {won
            ? <GiTrophyCup size={86} color="#FBBF24" />
            : <GiDeathSkull size={82} color="#9CA3AF" />}
        </motion.div>
      </div>

      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: won ? 0.5 : 0.2, duration: 0.4 }}
      >
        <h2 className="wc-display text-2xl font-extrabold text-white mb-1" style={won ? { color: '#FBBF24' } : undefined}>
          {won ? 'Vittoria!' : 'Sconfitta'}
        </h2>
        <p className="text-white/50 text-sm">
          {won ? 'Hai sconfitto il Capo Palestra!' : 'Il Capo Palestra è troppo forte...'}
        </p>
      </motion.div>

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
                <GiTwoCoins size={20} color="#F7C841" />
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
                <GiRoundStar size={18} color="#3A9DBC" />
                <div>
                  <p className="font-extrabold text-sm" style={{ color: '#3A9DBC' }}>{reward.exp}</p>
                  <p className="text-white/30 text-xs">EXP</p>
                </div>
              </div>
            )}
          </div>

          {reward.gymTaken && (
            <div className="rounded-xl px-3 py-2.5"
              style={{ background: 'linear-gradient(120deg, rgba(247,200,65,0.14), rgba(255,255,255,0.03))', border: '1px solid rgba(247,200,65,0.45)' }}>
              <p className="font-extrabold text-sm" style={{ color: '#F7C841' }}>🏰 Palestra conquistata — ora la presidi tu!</p>
              <p className="text-white/45 text-xs mt-0.5">Difendila: più resisti, più rendita maturi.</p>
            </div>
          )}

          {reward.placeUnlocked && (
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: 'linear-gradient(120deg, rgba(230,201,137,0.14), rgba(255,255,255,0.03))', border: '1px solid rgba(230,201,137,0.45)' }}
            >
              <p className="font-extrabold text-sm" style={{ color: '#E6C989' }}>
                🏛️ Luogo liberato: {reward.placeUnlocked.placeName}!
              </p>
              {reward.placeUnlocked.drops.length > 0 && (
                <p className="text-white/45 text-xs mt-0.5">
                  Bonus del luogo: {reward.placeUnlocked.drops.length} ricompense — controlla la Collezione!
                </p>
              )}
            </div>
          )}

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
                {(reward.creature.sprite_cutout_url || reward.creature.sprite_url || reward.creature.image_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reward.creature.sprite_cutout_url || reward.creature.sprite_url || reward.creature.image_url || ''}
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
                    {reward.creature.element && (
                      <span className="inline-flex items-center gap-1 align-middle">
                        {' · '}<ElementIcon element={reward.creature.element} size={12} /> {reward.creature.element}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {levelUp && (
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: '#F7C841' }}>
                <GiRoundStar size={14} color="#F7C841" /> Level Up! Livello {levelUp.newLevel}
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
