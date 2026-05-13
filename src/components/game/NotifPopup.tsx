'use client'
import { motion, AnimatePresence } from 'framer-motion'

export interface NotifPopupData {
  type: 'admin_notify' | 'item_redeemed'
  title: string
  message: string
  icon?: string
}

/**
 * Slide-down toast for admin notifications and item-redeemed alerts.
 * Auto-dismiss is the caller's responsibility (typically a setTimeout
 * that nulls `popup`); clicking the toast also dismisses via onDismiss.
 */
export default function NotifPopup({
  popup,
  onDismiss,
}: {
  popup: NotifPopupData | null
  onDismiss: () => void
}) {
  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 left-4 right-4 z-[9990] pointer-events-auto"
          onClick={onDismiss}
        >
          <div
            className="bg-[#0F1F2E]/95 border border-[#3A9DBC]/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm flex items-start gap-3"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(58,157,188,0.2)' }}
          >
            <span className="text-2xl shrink-0 mt-0.5">{popup.icon ?? '📢'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm leading-tight">{popup.title}</p>
              {popup.message && (
                <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{popup.message}</p>
              )}
            </div>
            <button className="text-white/30 hover:text-white text-lg leading-none shrink-0 mt-0.5">
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
