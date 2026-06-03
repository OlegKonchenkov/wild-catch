import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Typed with the generated Database schema so wrong-column queries fail at
// compile time (regenerate types with `npm run db:types` after migrations).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
