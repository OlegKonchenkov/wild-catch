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

const META: Record<ToastVariant, {
  bg: string; border: string; color: string; icon: string; label: string
}> = {
  success:           { bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.35)',  color: '#34D399', icon: '✓',  label: '' },
  error:             { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.40)',   color: '#EF4444', icon: '✕',  label: '' },
  warning:           { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.40)',  color: '#FBBF24', icon: '⚠',  label: '' },
  'session-ended':   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.55)',   color: '#EF4444', icon: '🔒', label: 'Sessione terminata' },
  'session-waiting': { bg: 'rgba(58,157,188,0.10)',  border: 'rgba(58,157,188,0.50)',  color: '#3A9DBC', icon: '⏳', label: 'In attesa di inizio' },
}

/** Variants that stay on screen until explicitly dismissed */
const PERSISTENT: ToastVariant[] = ['session-ended', 'session-waiting']

interface Props {
  toast: ToastState | null
  onDismiss?: () => void
}

export function GameToast({ toast, onDismiss }: Props) {
  const persistent = toast ? PERSISTENT.includes(toast.variant) : false

  return (
    <AnimatePresence>
      {toast && (() => {
        const m = META[toast.variant]
        return (
          <motion.div
            key={toast.variant + toast.message}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            onClick={persistent ? onDismiss : undefined}
            className={`mx-4 mt-3 rounded-xl overflow-hidden ${persistent && onDismiss ? 'cursor-pointer' : ''}`}
            style={{ background: m.bg, border: `1px solid ${m.border}` }}
          >
            <div className="flex items-start gap-2.5 px-3.5 py-2.5">
              {/* Icon badge */}
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                style={{ background: `${m.color}25`, color: m.color }}
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
                <p className="text-sm font-medium text-white/90 leading-snug">{toast.message}</p>
                {persistent && (
                  <p className="text-[11px] text-white/30 mt-1">Tocca per chiudere</p>
                )}
              </div>

              {/* Dismiss × for persistent */}
              {persistent && onDismiss && (
                <button
                  onClick={e => { e.stopPropagation(); onDismiss() }}
                  className="shrink-0 text-white/25 hover:text-white/60 transition-colors text-sm mt-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Accent line at bottom */}
            <div className="h-[2px]" style={{ background: `${m.color}45` }} />
          </motion.div>
        )
      })()}
    </AnimatePresence>
  )
}
