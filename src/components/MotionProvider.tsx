'use client'
import { MotionConfig } from 'framer-motion'

/**
 * Applies the OS-level "reduce motion" preference to every framer-motion
 * animation in the app, from one place.
 *
 * `reducedMotion="user"` makes framer skip transform-based animation (x/y,
 * scale, rotate) for users who asked for it, while still animating opacity —
 * so UI still fades in and nothing disappears, it just stops moving.
 *
 * Before this, only 4 of the ~68 files using framer-motion checked the
 * preference by hand, while 72 animations run on `repeat: Infinity`. For
 * someone with vestibular sensitivity that made the app genuinely hard to use.
 *
 * Note this covers framer-motion only. CSS keyframe animations (Tailwind's
 * `animate-pulse`, `animate-spin`, and the custom keyframes in globals.css)
 * are unaffected and still need a `prefers-reduced-motion` media query.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
