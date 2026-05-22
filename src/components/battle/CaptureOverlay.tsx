'use client'

import { AnimatePresence, motion } from 'framer-motion'

const CAPTURE_ORIGIN = { x: '14%', y: '82%' }
const CAPTURE_TARGET = { x: '72%', y: '25%' }

interface Props {
  phase: 'idle' | 'throwing' | 'hit'
  success?: boolean
  creatureName?: string
}

function NetSvg() {
  return (
    <motion.svg
      viewBox="0 0 80 80"
      width="88"
      height="88"
      className="absolute"
      style={{ filter: 'drop-shadow(0 0 14px rgba(58,188,168,0.96)) drop-shadow(0 0 22px rgba(240,206,122,0.38))' }}
      initial={{ top: CAPTURE_ORIGIN.y, left: CAPTURE_ORIGIN.x, scale: 0.32, opacity: 0, rotate: -32 }}
      animate={{
        top: CAPTURE_TARGET.y,
        left: CAPTURE_TARGET.x,
        scale: [0.32, 1.14, 0.94],
        opacity: [0, 1, 1],
        rotate: [-32, 246, 326],
      }}
      exit={{ x: [0, -10, 10, -6, 6, 0], scale: [1, 1.16, 0.88, 1.04, 0.92, 0], opacity: [1, 1, 1, 0.9, 0.35, 0] }}
      transition={{ duration: 0.62, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <circle cx="40" cy="40" r="36" fill="rgba(58,188,168,0.07)" stroke="rgba(58,188,168,0.95)" strokeWidth="2.8" />
      <circle cx="40" cy="40" r="26" fill="none" stroke="rgba(58,188,168,0.62)" strokeWidth="1.4" />
      <circle cx="40" cy="40" r="16" fill="none" stroke="rgba(58,188,168,0.48)" strokeWidth="1.2" />
      <circle cx="40" cy="40" r="7" fill="none" stroke="rgba(58,188,168,0.36)" strokeWidth="1" />
      <line x1="4" y1="40" x2="76" y2="40" stroke="rgba(58,188,168,0.55)" strokeWidth="1.1" />
      <line x1="40" y1="4" x2="40" y2="76" stroke="rgba(58,188,168,0.55)" strokeWidth="1.1" />
      <line x1="14.5" y1="14.5" x2="65.5" y2="65.5" stroke="rgba(58,188,168,0.44)" strokeWidth="1" />
      <line x1="65.5" y1="14.5" x2="14.5" y2="65.5" stroke="rgba(58,188,168,0.44)" strokeWidth="1" />
      <line x1="4" y1="22" x2="58" y2="76" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8" />
      <line x1="4" y1="58" x2="58" y2="4" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8" />
      <line x1="22" y1="4" x2="76" y2="58" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8" />
      <line x1="76" y1="22" x2="22" y2="76" stroke="rgba(58,188,168,0.22)" strokeWidth="0.8" />
      <circle cx="40" cy="40" r="3" fill="rgba(58,188,168,0.85)" />
    </motion.svg>
  )
}

function NetTrail() {
  return (
    <>
      {[0, 1].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: CAPTURE_ORIGIN.x,
            top: CAPTURE_ORIGIN.y,
            width: 220,
            height: i === 0 ? 4 : 1,
            borderRadius: 999,
            background: i === 0
              ? 'linear-gradient(90deg, transparent, rgba(58,188,168,.18), rgba(240,206,122,.72), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255,255,255,.82), transparent)',
            transform: 'rotate(-38deg)',
            transformOrigin: '0 50%',
            filter: i === 0 ? 'blur(1.5px)' : 'drop-shadow(0 0 7px rgba(240,206,122,.85))',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 0.2], opacity: [0, i === 0 ? 0.8 : 1, 0] }}
          transition={{ duration: 0.46, delay: 0.04 + i * 0.03, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

function CaptureParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 16
        const distance = 54 + (i % 4) * 12
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        const color = i % 2 === 0 ? '#34D399' : '#F0CE7A'
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              top: CAPTURE_TARGET.y,
              left: CAPTURE_TARGET.x,
              width: i % 3 === 0 ? 5 : 3,
              height: i % 3 === 0 ? 5 : 3,
              color,
              background: color,
              boxShadow: '0 0 12px currentColor',
            }}
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
            animate={{ x, y, scale: [0.2, 1, 0.35], opacity: [0, 1, 0] }}
            transition={{ duration: 0.68, delay: i * 0.012, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

function CaptureImpact() {
  return (
    <>
      {[0, 0.08, 0.16].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: CAPTURE_TARGET.y,
            left: CAPTURE_TARGET.x,
            width: 86 + i * 22,
            height: 86 + i * 22,
            marginLeft: -(86 + i * 22) / 2,
            marginTop: -(86 + i * 22) / 2,
            border: `${i === 0 ? 2 : 1}px solid ${i === 0 ? 'rgba(255,246,194,.78)' : 'rgba(58,188,168,.48)'}`,
            boxShadow: '0 0 18px rgba(58,188,168,.5), inset 0 0 18px rgba(240,206,122,.18)',
          }}
          initial={{ scale: 0.25, opacity: 0 }}
          animate={{ scale: [0.25, 1.25, 1.9], opacity: [0, 0.95, 0] }}
          transition={{ duration: 0.62, delay, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: CAPTURE_TARGET.y,
          left: CAPTURE_TARGET.x,
          width: 118,
          height: 118,
          marginLeft: -59,
          marginTop: -59,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(58,188,168,.82), rgba(240,206,122,.28) 34%, transparent 72%)',
          filter: 'blur(2px)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1.7, 2.55] }}
        transition={{ duration: 0.48 }}
      />
    </>
  )
}

export default function CaptureOverlay({ phase, success, creatureName }: Props) {
  return (
    <>
      <AnimatePresence>
        {phase !== 'idle' && (
          <motion.div
            key="capture-net"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ zIndex: 20 }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {phase === 'throwing' && <NetTrail />}
            <NetSvg />
            {phase === 'hit' && (
              <>
                <CaptureImpact />
                <CaptureParticles />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {success && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 30 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: [0.5, 1.12, 1], opacity: [0, 1, 1], y: [20, -6, 0] }}
              exit={{ scale: 0.85, opacity: 0, y: -20 }}
              transition={{ duration: 0.45, times: [0, 0.55, 1] }}
              className="flex flex-col items-center gap-1 rounded-3xl px-7 py-4"
              style={{
                background: 'rgba(4,18,10,.84)',
                border: '1.5px solid rgba(52,211,153,.55)',
                boxShadow: '0 0 40px rgba(52,211,153,.35), 0 8px 32px rgba(0,0,0,.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: '#34D399', textShadow: '0 0 20px rgba(52,211,153,.8)' }}>
                Catturata!
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(52,211,153,.72)' }}>
                {creatureName ?? 'Creatura'} aggiunta alla squadra
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
