'use client'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Full-screen first-run coachmark / spotlight overlay.
 *
 * Pattern: dim the entire viewport, cut a rounded "hole" around the current
 * step's target element (resolved by [data-coachmark="<key>"]), animate a
 * pulsing outline around the hole, and float a tooltip card next to it with
 * the explanation + Next / Skip controls.
 *
 * Usage:
 *
 *   const STEPS = [
 *     { key: 'map-area',     title: '...', body: '...' },
 *     { key: 'nav-missioni', title: '...', body: '...' },
 *   ]
 *
 *   <Coachmark steps={STEPS} onClose={() => setSeen(true)} />
 *
 * - Targets must have `data-coachmark="<key>"` somewhere in the DOM at the
 *   moment the step becomes active. A step whose target is missing falls
 *   back to a centred no-spotlight tooltip (still readable).
 * - Click anywhere outside the tooltip is captured (no accidental UI
 *   interactions during the walkthrough).
 * - Auto-repositions on resize / orientation change.
 */

export interface CoachmarkStep {
  /** Selector key — must match a `data-coachmark="..."` attribute somewhere in the DOM. */
  key: string
  title: string
  body: string
  /** Hint to the tooltip placement. Auto-fallbacks to the opposite side if no space. */
  preferredSide?: 'top' | 'bottom'
}

interface Rect { x: number; y: number; width: number; height: number }

const HOLE_PADDING = 8
const TOOLTIP_GAP  = 14
const TOOLTIP_MAX_W = 320

function readTargetRect(key: string): Rect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector<HTMLElement>(`[data-coachmark="${key}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

export default function Coachmark({
  steps,
  onClose,
}: {
  steps: CoachmarkStep[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect]   = useState<Rect | null>(null)
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)
  const step = steps[index]

  // Track viewport size so tooltip can stay clamped on resize/orientation flip.
  useLayoutEffect(() => {
    function refresh() {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    refresh()
    window.addEventListener('resize', refresh)
    window.addEventListener('orientationchange', refresh)
    return () => {
      window.removeEventListener('resize', refresh)
      window.removeEventListener('orientationchange', refresh)
    }
  }, [])

  // Re-measure on step change. If the target is off-screen (e.g. a nav item
  // hidden in the horizontally-scrolling bottom bar) we first smooth-scroll
  // it into view, wait for the scroll to settle, then attach the spotlight
  // and ResizeObserver. Polling fallback covers cases where the target lives
  // inside a not-yet-mounted route segment.
  useLayoutEffect(() => {
    if (!step) return
    let pollId: number | null = null
    let observer: ResizeObserver | null = null
    let settleTimer: number | null = null

    function isOffscreen(r: DOMRect): boolean {
      // Only treat as offscreen when the element is GENUINELY outside the
      // viewport (i.e. it needs scrolling to be revealed — e.g. a nav item
      // pushed past the horizontal edge of a scrolling bar). Elements merely
      // pinned near an edge — the top-right HUD, the bottom navbar — are
      // fully visible: scrolling them does nothing and the scroll-settle wait
      // would otherwise flash the tooltip at screen-centre before snapping it
      // to the target. Those now resolve synchronously and open in place.
      return (
        r.right  <= 0 ||
        r.left   >= window.innerWidth ||
        r.bottom <= 0 ||
        r.top    >= window.innerHeight
      )
    }

    function attach(el: HTMLElement) {
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, width: r.width, height: r.height })
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          const nr = el.getBoundingClientRect()
          setRect({ x: nr.left, y: nr.top, width: nr.width, height: nr.height })
        })
        observer.observe(el)
      }
    }

    function tryRead() {
      const el = document.querySelector(`[data-coachmark="${step.key}"]`) as HTMLElement | null
      if (!el) { setRect(null); return }
      if (pollId) { window.clearInterval(pollId); pollId = null }

      const r = el.getBoundingClientRect()
      if (isOffscreen(r)) {
        // Hide the spotlight while the scroll plays so the user sees the
        // nav slide instead of a half-occluded hole.
        setRect(null)
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        } catch {
          // Older browsers lacking smooth scroll — fall back to no-arg form.
          el.scrollIntoView()
        }
        settleTimer = window.setTimeout(() => attach(el), 480)
      } else {
        attach(el)
      }
    }

    tryRead()
    if (!rect) pollId = window.setInterval(tryRead, 250)

    return () => {
      if (pollId)      window.clearInterval(pollId)
      if (settleTimer) window.clearTimeout(settleTimer)
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.key])

  // Tooltip placement: prefer step.preferredSide, fall back if no room.
  const tooltipPos = useMemo(() => {
    if (!rect || !vw || !vh) {
      // No target → centre the tooltip
      return { left: Math.max(16, vw / 2 - TOOLTIP_MAX_W / 2), top: vh / 2 - 80, width: Math.min(TOOLTIP_MAX_W, vw - 32) }
    }
    const w = Math.min(TOOLTIP_MAX_W, vw - 32)
    const placeBelow = (step?.preferredSide ?? 'bottom') === 'bottom'
    const roomBelow  = vh - (rect.y + rect.height + HOLE_PADDING + TOOLTIP_GAP) - 16
    const roomAbove  = rect.y - HOLE_PADDING - TOOLTIP_GAP - 16

    // Side decision: honour preference unless the other side has clearly more room.
    let belowFinal = placeBelow ? roomBelow > 140 : roomAbove < 140 && roomBelow > 140
    if (placeBelow && roomBelow < 140 && roomAbove > 140) belowFinal = false
    if (!placeBelow && roomAbove < 140 && roomBelow > 140) belowFinal = true

    const left = Math.max(16, Math.min(vw - w - 16, rect.x + rect.width / 2 - w / 2))
    const top  = belowFinal
      ? rect.y + rect.height + HOLE_PADDING + TOOLTIP_GAP
      : rect.y - HOLE_PADDING - TOOLTIP_GAP - 200 // upper bound; the card auto-sizes upwards
    return { left, top: Math.max(16, top), width: w }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, vw, vh, step?.key])

  if (!step) return null

  // Clamp the spotlight to the viewport so a hole near the edge doesn't
  // create a malformed SVG mask.
  const hole = rect ? {
    x: Math.max(-HOLE_PADDING, rect.x - HOLE_PADDING),
    y: Math.max(-HOLE_PADDING, rect.y - HOLE_PADDING),
    width:  rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
  } : null

  function next() {
    if (index >= steps.length - 1) onClose()
    else setIndex(i => i + 1)
  }

  function prev() {
    if (index > 0) setIndex(i => i - 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[9700]"
      style={{ pointerEvents: 'auto' }}
      data-testid="coachmark-overlay"
    >
      {/* Dimming + spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <mask id="coachmark-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={14}
                ry={14}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(4,10,20,0.78)" mask="url(#coachmark-mask)" />
      </svg>

      {/* Pulsing outline around the hole */}
      {hole && (
        <motion.div
          key={step.key + '-ring'}
          className="absolute pointer-events-none rounded-[14px]"
          style={{
            left: hole.x,
            top:  hole.y,
            width:  hole.width,
            height: hole.height,
            boxShadow: '0 0 0 3px rgba(58,188,168,0.85), 0 0 40px rgba(58,188,168,0.45)',
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.key}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="absolute rounded-2xl shadow-2xl"
          style={{
            left: tooltipPos.left,
            top:  tooltipPos.top,
            width: tooltipPos.width,
            background: '#0F1F2E',
            border: '1px solid rgba(58,188,168,0.4)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(58,188,168,0.2)',
            pointerEvents: 'auto',
          }}
        >
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 text-[#3ABCA8] text-[10px] font-bold uppercase tracking-[0.15em] mb-1">
              <span>Suggerimento</span>
              <span className="text-white/30">·</span>
              <span className="text-white/40 font-mono normal-case tracking-normal">{index + 1}/{steps.length}</span>
            </div>
            <h3 className="text-white font-bold text-sm leading-tight">{step.title}</h3>
          </div>
          <p className="px-4 text-white/65 text-xs leading-relaxed">{step.body}</p>
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-3">
            <button
              onClick={onClose}
              className="text-[11px] font-semibold text-white/40 hover:text-white/70 px-2 py-1"
            >
              Salta tutto
            </button>
            <div className="flex gap-2">
              {index > 0 && (
                <button
                  onClick={prev}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/60 hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  ←
                </button>
              )}
              <button
                onClick={next}
                className="px-4 py-1.5 rounded-lg text-xs font-extrabold text-white"
                style={{
                  background: 'linear-gradient(135deg, #3ABCA8 0%, #2d8c7d 100%)',
                  boxShadow: '0 4px 14px rgba(58,188,168,0.35)',
                }}
              >
                {index === steps.length - 1 ? 'Fatto!' : 'Continua →'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
