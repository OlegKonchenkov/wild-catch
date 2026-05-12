import * as Sentry from '@sentry/nextjs'

// Sentry is opt-in via NEXT_PUBLIC_SENTRY_DSN. With no DSN set, init() is a
// no-op — bundle still includes the SDK but no events are sent.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,

  // Keep the bundle slim: no session replay, no profiling.
  // 10 % traces in production is fine for a low-traffic event app.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  // Don't capture errors that bubble up from third-party scripts we can't act on
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
})
