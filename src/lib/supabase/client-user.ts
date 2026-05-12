import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Returns the current user from the cached client session (reads localStorage,
 * no network round-trip). Use only in client components that have ALREADY been
 * gated server-side — typically anything under /game, /home, or /admin, whose
 * layouts call supabase.auth.getUser() in a Server Component before rendering.
 *
 * Prefer this over supabase.auth.getUser() in client code: getUser() validates
 * the JWT against the Supabase Auth server, which is redundant when the SSR
 * layer has already done so a few hundred ms earlier.
 */
export async function getCurrentUser(supabase: SupabaseClient): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
