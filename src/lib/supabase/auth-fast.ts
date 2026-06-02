import { createClient } from './server'

export interface AuthUser {
  id: string
  email: string | undefined
  role: string
  app_metadata: Record<string, any>
  user_metadata: Record<string, any>
}

/**
 * Fast authentication via local JWT verification (`getClaims`) instead of a
 * network round-trip to the Supabase Auth API (`getUser`). Saves ~50-100ms per
 * request and — much more importantly — avoids the Auth-API contention point
 * we hit under load (many parallel `getUser()` calls for the same user serialise
 * on the auth server, producing the 60s timeout tail).
 *
 * Returns the same `{ supabase, user }` pair so most routes can swap the prior
 * 4-liner for a 2-liner. The `user` object shape mirrors what routes actually
 * read (`id`, `email`, `app_metadata`, `user_metadata`).
 *
 * Trade-off: a server-side revoked session stays valid until the JWT expires
 * (~1h). Acceptable for a game; for any strict-validity action (e.g. delete
 * account), keep calling `supabase.auth.getUser()` directly.
 */
export async function getAuthUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  user: AuthUser | null
}> {
  const supabase = await createClient()

  // Fast path: local JWT verification via getClaims(). Production always
  // takes this branch.
  // Test fallback: many existing test mocks only stub `auth.getUser()`. If a
  // mock client doesn't expose `getClaims`, fall back to `getUser()` so the
  // test suite keeps working without having to touch ~50 mock files. The
  // capability check is `typeof !== 'function'`, so a real client that returns
  // an auth-error from getClaims still goes through the fast-path error branch
  // — only "method missing" triggers the fallback.
  const authAny = (supabase.auth as any)
  if (typeof authAny?.getClaims !== 'function') {
    const { data: { user: legacyUser } } = await supabase.auth.getUser()
    if (!legacyUser) return { supabase, user: null }
    return {
      supabase,
      user: {
        id: legacyUser.id,
        email: legacyUser.email,
        role: (legacyUser as any).role ?? 'authenticated',
        app_metadata: (legacyUser.app_metadata as Record<string, any>) ?? {},
        user_metadata: (legacyUser.user_metadata as Record<string, any>) ?? {},
      },
    }
  }

  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return { supabase, user: null }
  const c = data.claims as Record<string, any>
  if (!c.sub) return { supabase, user: null }
  return {
    supabase,
    user: {
      id: String(c.sub),
      email: typeof c.email === 'string' ? c.email : undefined,
      role: typeof c.role === 'string' ? c.role : 'authenticated',
      app_metadata: (c.app_metadata && typeof c.app_metadata === 'object') ? c.app_metadata : {},
      user_metadata: (c.user_metadata && typeof c.user_metadata === 'object') ? c.user_metadata : {},
    },
  }
}
