import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect /game/* and /onboarding routes — must be authenticated
  if (
    (request.nextUrl.pathname.startsWith('/game') ||
      request.nextUrl.pathname.startsWith('/onboarding')) &&
    !user
  ) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protect /admin/* routes — must be authenticated + admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Admin check deferred to admin layout (proxy can't query Supabase tables)
    // The admin layout/page itself will verify is_admin via server component
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/game/:path*', '/admin/:path*', '/auth/:path*', '/onboarding/:path*', '/onboarding'],
}
