import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// POST /api/admin/abilities/[id]/artwork
// Body: { prompt: string, quality?: 'low'|'medium'|'high' }  → generate with AI (gpt-image-2)
//       { imageUrl: string }                                  → set manual URL
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await request.json()
  const { prompt, imageUrl, quality = 'medium' } = body

  const admin = createAdminClient()

  // --- Manual URL mode ---
  if (imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'URL immagine non valido' }, { status: 400 })
    }
    const { data, error } = await admin.from('abilities')
      .update({ icon_url: imageUrl })
      .eq('id', id)
      .select('id, icon_url')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imageUrl: data.icon_url })
  }

  // --- AI generation mode ---
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return NextResponse.json({ error: 'Prompt o URL immagine richiesto' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })

  const enhancedPrompt = `Ability / spell icon for a mobile creature-catching RPG set on the Italian Adriatic coast and Apennine forests. A single dynamic magical move or elemental effect, painterly fantasy style, vibrant energy, centered emblem, no text, no characters, square format, clean dark background suitable for a skill icon. The ability: ${prompt.trim()}`

  const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality,
      output_format: 'png',
    }),
  })

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: err?.error?.message ?? `OpenAI error ${openaiRes.status}` },
      { status: 502 }
    )
  }

  const openaiData = await openaiRes.json()
  const b64: string | undefined = openaiData?.data?.[0]?.b64_json

  if (!b64) {
    return NextResponse.json({ error: 'Nessuna immagine generata' }, { status: 502 })
  }

  // Upload base64 image to Supabase Storage
  let finalUrl = ''
  try {
    const buffer = Buffer.from(b64, 'base64')
    const storagePath = `abilities/${id}.png`
    const storageBucket = 'item-artwork'

    await admin.storage.createBucket(storageBucket, { public: true }).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from(storageBucket)
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true })

    if (!uploadError) {
      const { data: urlData } = admin.storage.from(storageBucket).getPublicUrl(storagePath)
      finalUrl = urlData.publicUrl
    } else {
      return NextResponse.json({ error: 'Errore upload storage: ' + uploadError.message }, { status: 500 })
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Errore upload: ' + (e as Error).message }, { status: 500 })
  }

  const { data, error: dbError } = await admin.from('abilities')
    .update({ icon_url: finalUrl })
    .eq('id', id)
    .select('id, icon_url')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ imageUrl: data.icon_url, generated: true })
}
