import { createClient } from '@/lib/supabase/server'

export type SessionErrorCode =
  | 'session_ended'
  | 'session_not_started'
  | 'insufficient_gold'
  | 'transaction_conflict'
  | 'server_error'
  | 'not_found'
  | 'unauthorized'

interface LogOpts {
  sessionId: string
  userId?: string | null
  source: string
  errorCode: SessionErrorCode | string
  message: string
  context?: Record<string, unknown>
}

/**
 * Fire-and-forget: log a notable error to session_errors.
 * Never throws — guaranteed not to block the caller.
 */
export async function logSessionError(opts: LogOpts): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('session_errors').insert({
      session_id: opts.sessionId,
      user_id:    opts.userId ?? null,
      source:     opts.source,
      error_code: opts.errorCode,
      message:    opts.message,
      context:    opts.context ?? {},
    })
  } catch {
    // Intentionally silent — error logging must never break the main flow
  }
}
