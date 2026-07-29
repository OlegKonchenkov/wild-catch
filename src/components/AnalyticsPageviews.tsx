'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { capturePageview } from '@/lib/analytics'

/**
 * Emits a PostHog `$pageview` on every client-side route change.
 *
 * PostHog is initialised with `capture_pageview: false` (see lib/analytics.ts)
 * because the App Router does client-side navigation that the SDK's automatic
 * capture doesn't see. The manual `capturePageview()` it points at existed but
 * was never called from anywhere — so the project had no pageview data at all,
 * and therefore no navigation funnels: no way to see where onboarding drops
 * off, which sections are dead, or how far a player gets before quitting.
 *
 * Deliberately pathname-only, with id segments collapsed:
 *   - the query string carries session ids (`?restored=<uuid>`) that have no
 *     business in an analytics URL;
 *   - dynamic segments (`/game/encounter/<uuid>`) would otherwise produce one
 *     distinct "page" per encounter, which is both high-cardinality noise and
 *     useless for funnels. `/game/encounter/[id]` is the thing you want to
 *     count.
 *
 * Using `usePathname` alone (not `useSearchParams`) also keeps this out of the
 * Suspense/bail-out-to-CSR rules that `useSearchParams` imposes on the layout.
 */

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Session/duel room codes and other short opaque ids that appear as segments.
const OPAQUE_SEGMENT = /^[0-9a-z]{16,}$/i

function normalizePath(path: string): string {
  return path
    .split('/')
    .map(seg => (UUID_SEGMENT.test(seg) || OPAQUE_SEGMENT.test(seg) ? '[id]' : seg))
    .join('/')
}

export default function AnalyticsPageviews() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    capturePageview(normalizePath(pathname))
  }, [pathname])

  return null
}
