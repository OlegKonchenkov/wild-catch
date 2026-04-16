import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm',
]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 }) }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Campo "file" mancante' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo file non supportato (immagini: PNG/JPG/WEBP/GIF/SVG; audio: MP3/OGG/WAV/WEBM)' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File troppo grande (max 5 MB)' }, { status: 400 })
  }

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const slug = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const path = `admin/${slug}.${ext}`

  const admin = createAdminClient()
  // Ensure bucket exists (no-op if already present)
  await admin.storage.createBucket('uploads', { public: true }).catch(() => {})

  const { error: uploadErr } = await admin.storage
    .from('uploads')
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('uploads').getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl })
}
