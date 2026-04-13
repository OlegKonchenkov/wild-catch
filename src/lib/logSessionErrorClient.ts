import { createClient } from '@/lib/supabase/client'

interface LogOpts {
  sessionId: string
  source: string
  errorCode: string
  message: string
  context?: Record<string, unknown>
}

/**
 * Client-side fire-and-forget: log a notable error to session_errors.
 * Safe to call from any browser component — never throws, never awaited.
 */
export function logSessionErrorClient(opts: LogOpts): void {
  try {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      supabase.from('session_errors').insert({
        session_id: opts.sessionId,
        user_id:    user?.id ?? null,
        source:     opts.source,
        error_code: opts.errorCode,
        message:    opts.message,
        context:    opts.context ?? {},
      }).then(() => {}, () => {})
    }).catch(() => {})
  } catch {
    // Intentionally silent
  }
}
