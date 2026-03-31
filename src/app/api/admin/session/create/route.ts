import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json()
  const { name, narrativeConfig, areaBounds, durationMinutes, starterKit } = body

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name,
      narrative_config: narrativeConfig,
      area_bounds: areaBounds,
      duration_minutes: durationMinutes,
      status: 'draft',
      starter_kit: Array.isArray(starterKit) && starterKit.length > 0 ? starterKit : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessionId: data.id })
}
