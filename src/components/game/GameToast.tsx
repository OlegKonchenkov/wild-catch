'use client'
import { AnimatePresence, motion } from 'framer-motion'

export type ToastVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'session-ended'
  | 'session-waiting'

export interface ToastState {
  variant: ToastVariant
  message: string
}

// Dark solid base so the toast always contrasts against any background.
// The variant color is expressed via the left border + icon — not the bg.
const BASE_BG = 'rgba(8, 17, 28, 0.97)'

const META: Record<ToastVariant, {
  border: string; color: string; icon: string; label: string
}> = {
  success:           { border: '#34D399', color: '#34D399', icon: '✓',  label: '' },
  error:             { border: '#EF4444', color: '#EF4444', icon: '✕',  label: '' },
  warning:           { border: '#FBBF24', color: '#FBBF24', icon: '⚠',  label: '' },
  'session-ended':   { border: '#EF4444', color: '#EF4444', icon: '🔒', label: 'Sessione terminata' },
  'session-waiting': { border: '#3A9DBC', color: '#3A9DBC', icon: '⏳', label: 'In attesa di inizio' },
}

interface Props {
  toast: ToastState | null
  onDismiss?: () => void
}

export function GameToast({ toast, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {toast && (() => {
        const m = META[toast.variant]
        const isSession = toast.variant === 'session-ended' || toast.variant === 'session-waiting'

        return (
          <motion.div
            key={toast.variant + toast.message}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={isSession ? onDismiss : undefined}
            className={`mx-4 mt-3 rounded-xl overflow-hidden shadow-2xl ${isSession && onDismiss ? 'cursor-pointer' : ''}`}
            style={{
              background: BASE_BG,
              borderLeft: `4px solid ${m.border}`,
              border: `1px solid rgba(255,255,255,0.08)`,
              borderLeftWidth: '4px',
              borderLeftColor: m.border,
            }}
          >
            <div className="flex items-start gap-3 px-3.5 py-3">
              {/* Icon badge */}
              <span
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: `${m.color}22`, color: m.color }}
              >
                {m.icon}
              </span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                {m.label && (
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-widest mb-0.5"
                    style={{ color: m.color }}
                  >
                    {m.label}
                  </p>
                )}
                <p className="text-sm font-semibold text-white leading-snug">{toast.message}</p>
              </div>

              {/* Dismiss × always visible */}
              {onDismiss && (
                <button
                  onClick={e => { e.stopPropagation(); onDismiss() }}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all text-xs mt-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Bottom accent */}
            <div className="h-[2px]" style={{ background: `${m.border}60` }} />
          </motion.div>
        )
      })()}
    </AnimatePresence>
  )
}
