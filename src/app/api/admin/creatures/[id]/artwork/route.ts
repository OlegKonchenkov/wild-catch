import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ArtworkKind = 'legacy' | 'cutout'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', status: 401 }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Non autorizzato', status: 403 }
  return { user }
}

// POST /api/admin/creatures/[id]/artwork
// Body: { prompt: string, quality?: 'low'|'medium'|'high' }  → generate with AI
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
  let kind: ArtworkKind = 'legacy'
  if (body.kind === 'cutout') kind = 'cutout'
  else if (body.kind !== undefined && body.kind !== 'legacy') {
    return NextResponse.json({ error: 'Tipo artwork non valido' }, { status: 400 })
  }
  const dbColumn = kind === 'cutout' ? 'sprite_url' : 'image_url'

  const admin = createAdminClient()

  // --- Manual URL mode ---
  if (imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'URL immagine non valido' }, { status: 400 })
    }
    const { data, error } = await admin.from('creatures')
      .update({ [dbColumn]: imageUrl })
      .eq('id', id)
      .select(`id, ${dbColumn}`)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const savedUrl = (data as Record<string, string | null>)[dbColumn]
    return NextResponse.json({
      imageUrl: savedUrl,
      spriteUrl: kind === 'cutout' ? savedUrl : undefined,
      kind,
    })
  }

  // --- AI generation mode ---
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return NextResponse.json({ error: 'Prompt o URL immagine richiesto' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })

  const model = kind === 'cutout'
    ? process.env.OPENAI_CUTOUT_IMAGE_MODEL ?? 'gpt-image-1.5'
    : process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2'
  const enhancedPrompt = kind === 'cutout'
    ? `Single creature sprite for a mobile creature-catching game set in the Italian Adriatic coast and Apennine forests. Cute-but-characterful chibi fantasy style, hand-painted semi-stylized shading, soft rim light, centered full body, facing camera 3/4. TRANSPARENT BACKGROUND, no ground, no platform, no baked shadow, no scenery, no text, no UI, no border. Square. Subject: ${prompt.trim()}`
    : `Creature card artwork for a mobile creature-catching game set in the Italian Adriatic coast and Apennine forests. Chibi/cute fantasy style, vibrant colors, no text, square format, atmospheric background suitable for game cards. The creature: ${prompt.trim()}`

  const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality,
      background: kind === 'cutout' ? 'transparent' : 'auto',
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
    const storagePath = kind === 'cutout' ? `creatures/cutouts/${id}.png` : `creatures/${id}.png`
    const storageBucket = 'creature-artwork'

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
  } catch (e: any) {
    return NextResponse.json({ error: 'Errore upload: ' + e.message }, { status: 500 })
  }

  // Save URL to DB
  const { data, error: dbError } = await admin.from('creatures')
    .update({ [dbColumn]: finalUrl })
    .eq('id', id)
    .select(`id, ${dbColumn}`)
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  const savedUrl = (data as Record<string, string | null>)[dbColumn]
  return NextResponse.json({
    imageUrl: savedUrl,
    spriteUrl: kind === 'cutout' ? savedUrl : undefined,
    generated: true,
    kind,
  })
}
