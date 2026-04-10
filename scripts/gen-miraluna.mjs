import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Parse .env.local manually
const __dir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dir, '..', '.env.local')
const envVars = {}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) envVars[m[1].trim()] = m[2].trim()
}

const OPENAI_KEY      = envVars.OPENAI_API_KEY
const SUPABASE_URL    = 'https://gkbtdagxgfzliomyfzvh.supabase.co'
const SUPABASE_HOST   = 'gkbtdagxgfzliomyfzvh.supabase.co'
// Use anon key — a temporary upload policy is active on the bucket
const SUPABASE_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYnRkYWd4Z2Z6bGlvbXlmenZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODk4MDYsImV4cCI6MjA4OTk2NTgwNn0.xz3CiLms8S8MEFXiqXYzHoQUiN6s9Mhq-K5hQK-Ixf8'
const CREATURE_ID     = '00000000-0000-0000-0001-000000000031'
const STORAGE_PATH    = `/storage/v1/object/creature-artwork/creatures/${CREATURE_ID}.png`

const prompt = `
A stunning fantasy creature card illustration for a mobile RPG set on the Italian Adriatic coast.
The creature is MIRALUNA — a mythological deity of sea and moon.
Design: A majestic ethereal manta-ray-like being gliding through a moonlit deep ocean,
enormous luminous wings spanning the frame, translucent body revealing inner galaxies and constellations,
trailing long crystalline tendrils that glow silver and deep violet,
bioluminescent markings in rose-gold and moonlight white across its body,
ancient runes etched in glowing light along the wing edges,
surrounded by floating pearl-like orbs and soft auroras of teal and violet,
dark midnight-blue ocean background with distant moonlight piercing the water.
Art style: premium fantasy digital art, creature card portrait, painterly, cinematic lighting,
square format, no text, no UI elements, dramatic and majestic presence.
`.trim()

function request(method, hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body)
    const data = isBuffer ? body : (body ? JSON.stringify(body) : null)
    const reqHeaders = { ...headers }
    if (data) reqHeaders['Content-Length'] = isBuffer ? data.length : Buffer.byteLength(data)
    const req = https.request({ hostname, path: urlPath, method, headers: reqHeaders }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString()
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode, body: raw }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  // ── 1. Generate image ──────────────────────────────────────────────────────
  console.log('🎨 Generating Miraluna with gpt-image-1.5...')
  const genResp = await request('POST', 'api.openai.com', '/v1/images/generations', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_KEY}`,
  }, {
    model: 'gpt-image-1.5',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
    output_format: 'png',
  })

  if (genResp.body?.error) { console.error('OpenAI error:', genResp.body.error); process.exit(1) }

  const b64 = genResp.body?.data?.[0]?.b64_json
  if (!b64) { console.error('No image data:', JSON.stringify(genResp.body).slice(0, 300)); process.exit(1) }

  const imgBuffer = Buffer.from(b64, 'base64')
  console.log(`✅ Image generated (${(imgBuffer.length/1024).toFixed(0)} KB)`)

  // ── 2. Upload to Supabase Storage ──────────────────────────────────────────
  console.log('📤 Uploading to Supabase Storage...')
  const upResp = await request('POST', SUPABASE_HOST, STORAGE_PATH, {
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'image/png',
    'x-upsert': 'true',
  }, imgBuffer)

  if (upResp.status >= 300) {
    console.error('Upload failed:', upResp.status, JSON.stringify(upResp.body))
    process.exit(1)
  }
  console.log('✅ Uploaded to Supabase Storage')

  // ── 3. Update DB (bust cache with timestamp param) ─────────────────────────
  const newUrl = `${SUPABASE_URL}/storage/v1/object/public/creature-artwork/creatures/${CREATURE_ID}.png`
  const dbResp = await request('PATCH',
    SUPABASE_HOST,
    `/rest/v1/creatures?id=eq.${CREATURE_ID}`,
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Prefer': 'return=minimal',
    },
    { image_url: newUrl }
  )

  if (dbResp.status >= 300) {
    console.error('DB update failed:', dbResp.status, JSON.stringify(dbResp.body))
    process.exit(1)
  }

  console.log('🌙 Miraluna image updated! URL:', newUrl)
}

main().catch(console.error)
