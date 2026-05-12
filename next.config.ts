import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

// Sentry build-time integration. Source-map upload only runs when both
// SENTRY_ORG and SENTRY_AUTH_TOKEN are present — otherwise it's a no-op,
// so local builds and CI without secrets stay fast and quiet.
export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Don't upload source maps in dev/CI without explicit credentials.
  sourcemaps: { disable: !(process.env.SENTRY_ORG && process.env.SENTRY_AUTH_TOKEN) },
  // Disable Sentry's automatic telemetry to keep things lean.
  telemetry: false,
  // Stream client errors through a tunnel route to bypass adblockers.
  tunnelRoute: '/monitoring',
  disableLogger: true,
})
