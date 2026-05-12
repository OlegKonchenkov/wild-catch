import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'

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
    getCurrentUser(supabase).then(user => {
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
