import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // If a specific next URL was requested (e.g. /admin-login?resume=1), use it
      if (next) return NextResponse.redirect(`${origin}${next}`)
      // Default: back to join page to consume pending_code from sessionStorage
      return NextResponse.redirect(`${origin}/?resume=1`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
