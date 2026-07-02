import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Generate an image with OpenAI's image API (gpt-image-2 / imagegen v2), upload
 * it to a public Supabase Storage bucket, and return the public URL.
 *
 * Reads the API key from OPENAI_API_KEY, falling back to OPENAI_API (the name
 * used in this repo's .env.local). Model overridable via OPENAI_IMAGE_MODEL.
 */
export async function generateImage(opts: {
  prompt: string
  bucket?: string
  path: string
  quality?: 'low' | 'medium' | 'high'
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_API
  if (!apiKey) throw new Error('OPENAI_API_KEY / OPENAI_API non configurata')

  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2'
  const bucket = opts.bucket ?? 'game-assets'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      n: 1,
      size: '1024x1024',
      quality: opts.quality ?? 'medium',
      output_format: 'png',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`)
  }

  const data = await res.json()
  const b64: string | undefined = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('Nessuna immagine generata')

  const admin = createAdminClient()
  const buffer = Buffer.from(b64, 'base64')
  await admin.storage.createBucket(bucket, { public: true }).catch(() => {})
  const { error } = await admin.storage.from(bucket).upload(opts.path, buffer, {
    contentType: 'image/png', upsert: true,
  })
  if (error) throw new Error(`Upload storage fallito: ${error.message}`)

  return admin.storage.from(bucket).getPublicUrl(opts.path).data.publicUrl
}

/** Shared art style prefix so all loot/collection art feels cohesive. */
export const WILDCATCH_ART_STYLE =
  'Digital game asset illustration for a mobile creature-catching game set on the Italian Adriatic coast with ancient Roman heritage. Warm painterly style, dramatic rim light, rich but tasteful colors, centered composition, no text, no watermark, no UI. '
