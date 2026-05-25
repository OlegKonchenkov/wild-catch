'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiTrophyCup, GiRoundStar, GiTwoCoins, GiPuzzle } from 'react-icons/gi'
import { playMissionComplete } from '@/lib/game/sounds/events'
import { playFrammento } from '@/lib/game/sounds/ui'

export interface CompletedMissionInfo {
  /** Server mission UUID — used by the tutorial moment modal to key off
   *  specific mission completions ("you finished M8 → big finale"). */
  missionId?: string
  title: string
  rewardGold: number
  rewardExp: number
  levelUp?: { newLevel: number; goldReward: number } | null
  /** Server-provided when a tutorial mission grants an enigma frammento;
   *  surfaced as a side toast in addition to the standard gold/exp panel. */
  tutorialFrammentoGranted?: { frammentoId: string; title: string } | null
}

interface MissionRewardModalProps {
  missions: CompletedMissionInfo[]
  onDone: () => void
}

export default function MissionRewardModal({ missions, onDone }: MissionRewardModalProps) {
  const [idx, setIdx] = useState(0)

  // Play sound once when the modal first appears
  useEffect(() => { playMissionComplete() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When the current mission also granted a tutorial frammento, layer a
  // soft puzzle-piece chime on top so the player learns "this is enigma
  // progress" — distinct from the mission-complete fanfare.
  useEffect(() => {
    if (missions[idx]?.tutorialFrammentoGranted) {
      // Slight delay so it sits AFTER the mission jingle starts.
      const t = setTimeout(() => playFrammento(), 350)
      return () => clearTimeout(t)
    }
  }, [idx, missions])

  if (!missions.length) return null

  const mission = missions[idx]
  const isLast = idx === missions.length - 1

  const advance = () => {
    if (mission.levelUp) {
      window.dispatchEvent(new CustomEvent('wc:level-up', { detail: mission.levelUp }))
    }
    if (isLast) {
      onDone()
    } else {
      setIdx(i => i + 1)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`mission-reward-${idx}`}
        className="fixed inset-0 z-[9993] flex flex-col items-center justify-center px-6"
        style={{ background: 'rgba(2,4,12,0.94)', backdropFilter: 'blur(18px)' }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Glow ring */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 220, height: 220, background: 'radial-gradient(circle, rgba(251,191,36,0.18) 0%, transparent 70%)' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        />

        {/* Badge */}
        <motion.div
          className="relative mb-4"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
        >
          <GiTrophyCup size={60} color="#FBBF24" style={{ filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.55))' }} />
        </motion.div>

        {/* Label */}
        <motion.p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: 'rgba(251,191,36,0.7)' }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        >
          Missione completata
        </motion.p>

        {/* Title */}
        <motion.h2
          className="text-center font-extrabold text-white text-xl mb-6 leading-snug"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          {mission.title}
        </motion.h2>

        {/* Rewards */}
        <motion.div
          className="w-full flex flex-col gap-3 mb-6"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        >
          {mission.rewardExp > 0 && (
            <div className="flex items-center justify-between rounded-2xl px-5 py-3"
              style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.22)' }}>
              <span className="text-sm text-white/50">EXP ricompensa</span>
              <span className="inline-flex items-center gap-1.5 font-extrabold text-[#34D399] text-base">+{mission.rewardExp} <GiRoundStar size={14} color="#34D399" /></span>
            </div>
          )}
          {mission.rewardGold > 0 && (
            <div className="flex items-center justify-between rounded-2xl px-5 py-3"
              style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.22)' }}>
              <span className="text-sm text-white/50">Oro ricompensa</span>
              <span className="inline-flex items-center gap-1.5 font-extrabold text-[#FBBF24] text-base">+{mission.rewardGold} <GiTwoCoins size={15} color="#FBBF24" /></span>
            </div>
          )}
          {mission.levelUp && (
            <div className="flex items-center justify-between rounded-2xl px-5 py-3"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.30)' }}>
              <span className="text-sm text-white/50">Livello raggiunto</span>
              <span className="font-extrabold text-[#A855F7] text-base">Lv. {mission.levelUp.newLevel} ✦</span>
            </div>
          )}
          {mission.tutorialFrammentoGranted && (
            <div className="flex items-center gap-3 rounded-2xl px-5 py-3"
              style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.30)' }}>
              <GiPuzzle size={24} color="#C084FC" style={{ filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.5))' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/50 uppercase tracking-wider">Frammento d&apos;enigma sbloccato</p>
                <p className="font-bold text-[#C084FC] text-sm truncate">{mission.tutorialFrammentoGranted.title}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Step dots */}
        {missions.length > 1 && (
          <motion.div className="flex gap-1.5 mb-5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
            {missions.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 20 : 6, height: 6,
                  background: i <= idx ? '#FBBF24' : 'rgba(255,255,255,0.2)',
                }} />
            ))}
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          onClick={advance}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
          style={{ background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', boxShadow: '0 4px 24px rgba(251,191,36,0.35)' }}
        >
          {isLast ? 'Continua' : 'Prossima ricompensa'}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  )
}
