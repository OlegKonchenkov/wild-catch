'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── First-time hint ─────────────────────────────────────────────────────────
// A one-shot, on-theme "here's how this works" card shown the FIRST time a
// player reaches a screen/feature they own (outside the guided tutorial).
// Lighter than the full-screen <Coachmark> spotlight: a single gilded card
// with a medallion icon, a short explanation and one "Ho capito" button.
//
// Seen-state is per-device in localStorage (`wc:hint:<id>`), matching the rest
// of the app's UI-hint flags. Bump the id (…:v2) to re-show after a redesign.

const seenKey = (id: string) => `wc:hint:${id}`

export function hasSeenHint(id: string): boolean {
  try { return localStorage.getItem(seenKey(id)) === '1' } catch { return true }
}
export function markHintSeen(id: string): void {
  try { localStorage.setItem(seenKey(id), '1') } catch { /* quota / private mode */ }
}

export default function FirstTimeHint({
  id,
  active = true,
  icon,
  eyebrow = 'Prima volta qui',
  title,
  body,
  cta = 'Ho capito',
  accent = '#3ABCA8',
  placement = 'bottom',
  delayMs = 480,
  onDismiss,
}: {
  /** Stable localStorage key suffix — shows once per device. */
  id: string
  /** Only arm the hint when this is true (e.g. the sheet is open). */
  active?: boolean
  icon?: ReactNode
  eyebrow?: string
  title: string
  body: ReactNode
  cta?: string
  /** Accent hex — teal by default; pass gold (#F7C841) etc. per feature. */
  accent?: string
  placement?: 'bottom' | 'center'
  delayMs?: number
  onDismiss?: () => void
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Context closed (e.g. the sheet was dismissed) → retract the hint
    // without marking it seen, so it re-arms next time.
    if (!active) { setShow(false); return }
    if (hasSeenHint(id)) return
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [active, id, delayMs])

  function dismiss() {
    setShow(false)
    markHintSeen(id)
    onDismiss?.()
  }

  const anchor =
    placement === 'center'
      ? 'items-center'
      : 'items-end'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="ft-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={dismiss}
          className={`fixed inset-0 z-[9600] flex justify-center ${anchor} px-4`}
          style={{
            background: 'radial-gradient(120% 90% at 50% 60%, rgba(4,10,20,0.62), rgba(4,10,20,0.42))',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            paddingBottom: placement === 'bottom'
              ? 'calc(env(safe-area-inset-bottom) + 24px)'
              : undefined,
          }}
        >
          <motion.div
            key="ft-card"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[350px] overflow-hidden rounded-[26px]"
            style={{
              background: 'linear-gradient(168deg, #14293b 0%, #0d1e2e 52%, #0a1826 100%)',
              border: '1px solid rgba(247,200,65,0.34)',
              boxShadow: `0 24px 60px -12px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,236,150,0.14), inset 0 0 34px ${accent}12`,
            }}
          >
            {/* gilded sheen hairline along the top edge */}
            <span
              aria-hidden
              className="wc-sheen pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(247,200,65,0.9), transparent)' }}
            />
            {/* soft accent glow bleeding from the top-left medallion */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-6 -top-6 h-28 w-28 rounded-full"
              style={{ background: `radial-gradient(circle, ${accent}2e 0%, transparent 68%)` }}
            />

            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-start gap-3.5">
                {/* Medallion */}
                <span
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `radial-gradient(circle at 38% 30%, ${accent}3a 0%, rgba(9,21,37,0.9) 72%)`,
                    border: `1.5px solid ${accent}`,
                    boxShadow: `0 0 16px ${accent}55, inset 0 0 12px ${accent}22`,
                  }}
                >
                  <motion.span
                    className="flex leading-none"
                    style={{ color: accent, filter: `drop-shadow(0 0 6px ${accent}88)`, fontSize: 22 }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {icon ?? '✨'}
                  </motion.span>
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: accent }}
                  >
                    {eyebrow}
                  </p>
                  <h3 className="wc-display text-[17px] font-bold leading-tight text-white" style={{ letterSpacing: '0.01em' }}>
                    {title}
                  </h3>
                </div>
              </div>

              <div className="mt-3 text-[13px] leading-relaxed text-white/70">
                {body}
              </div>

              <button
                onClick={dismiss}
                className="mt-4 w-full rounded-2xl py-2.5 text-sm font-extrabold text-[#06121a] transition-transform active:scale-[0.98]"
                style={{
                  background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
                  boxShadow: `0 6px 18px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.35)`,
                }}
              >
                {cta}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
