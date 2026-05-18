import DaimonSplash from '@/components/DaimonSplash'

/**
 * App-Router root Suspense fallback. Shown during the cold-start auth +
 * redirect on `/` (the PWA start_url) and any route segment that lacks
 * its own loading.tsx. Replaces the previous blank #0A1520 gap with the
 * branded boot screen so the PWA launch feels intentional end-to-end.
 * Segments with a more specific loading.tsx (e.g. /game/map) still win.
 */
export default function Loading() {
  return <DaimonSplash />
}
