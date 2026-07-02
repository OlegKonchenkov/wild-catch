import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateImage, WILDCATCH_ART_STYLE } from '@/lib/ai/generateImage'

const ART_TABLES = new Set([
  'packs', 'chests', 'special_prizes', 'cultural_places', 'artworks', 'characters', 'trophies', 'items',
])

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// POST /api/admin/catalog/[table]/art
// body: { id, prompt }  → generate art with the shared style, save to image_url.
//       { id, imageUrl } → set a manual URL.
export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: (auth as any).status })
  if (!ART_TABLES.has(table)) return NextResponse.json({ error: 'Tabella non gestita' }, { status: 404 })

  const { id, prompt, imageUrl } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  // Dynamic table name — cast past literal-table typing (safe: ART_TABLES allowlist).
  const admin = createAdminClient() as any

  if (imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'URL non valido' }, { status: 400 })
    }
    const { error } = await admin.from(table).update({ image_url: imageUrl }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imageUrl })
  }

  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt o URL richiesto' }, { status: 400 })

  try {
    const url = await generateImage({ prompt: WILDCATCH_ART_STYLE + prompt.trim(), path: `${table}/${id}.png` })
    const { error } = await admin.from(table).update({ image_url: url }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imageUrl: url, generated: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
