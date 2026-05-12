import { createBrowserClient } from '@supabase/ssr'

// Generated `Database` types live in src/types/database.ts. Passing
// <Database> here would surface ~30 pre-existing latent type errors
// (Json column types, nullable joins, missing column refs); fixing those
// is a focused follow-up. For now, the types file is opt-in: import it
// in specific helpers where the strictness pays off.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
