'use client'
import { motion } from 'framer-motion'

interface Props {
  current: number
  max: number
  label?: string
}

export default function HPBar({ current, max, label }: Props) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 50 ? '#34d399' : pct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-white/70 mb-1">
          <span>{label}</span>
          <span>{current} / {max}</span>
        </div>
      )}
      <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: '100%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
