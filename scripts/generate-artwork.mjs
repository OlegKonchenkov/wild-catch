// Run with: node scripts/generate-artwork.mjs
// Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Parse .env.local
const envLines = readFileSync(join(root, '.env.local'), 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']
const OPENAI_KEY   = env['OPENAI_API_KEY']
const BUCKET       = 'creature-artwork'

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error('Missing env vars. Set OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }

// 1. Ensure bucket exists
async function ensureBucket() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  if (r.ok) console.log(`✓ Bucket '${BUCKET}' created`)
  else {
    const d = await r.json()
    if (d.error?.includes('already exists') || d.message?.includes('already exists')) {
      console.log(`✓ Bucket '${BUCKET}' already exists`)
    } else {
      console.error('Bucket error:', d)
    }
  }
}

// 2. Fetch all creatures
async function getCreatures() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/creatures?select=id,name,description,element,rarity,image_url&order=name&limit=100`,
    { headers }
  )
  return r.json()
}

// 3. Generate image with gpt-image-1.5
async function generateImage(creature) {
  const prompt = `Creature card artwork for a mobile creature-catching game set in the Italian Adriatic coast and Apennine forests. Chibi/cute fantasy style, vibrant colors, no text, square format. The creature: ${creature.name} — ${creature.description} (element: ${creature.element}, rarity: ${creature.rarity})`

  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1.5',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
    }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message ?? `OpenAI ${r.status}`)
  // gpt-image-1.5 returns base64, not a URL
  return data.data[0].b64_json
}

// 4. Upload image buffer to Supabase Storage
async function uploadToStorage(creatureId, b64) {
  const binary = Buffer.from(b64, 'base64')
  const path = `creatures/${creatureId}.png`

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: binary,
  })
  if (!r.ok) {
    const d = await r.json()
    throw new Error(`Storage upload failed: ${JSON.stringify(d)}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

// 5. Update creature image_url in DB
async function updateCreature(id, imageUrl) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/creatures?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ image_url: imageUrl }),
  })
  if (!r.ok) throw new Error(`DB update failed: ${r.status}`)
}

// Main
async function main() {
  console.log('🎨 WildCatch Artwork Generator')
  console.log('================================')

  await ensureBucket()

  const creatures = await getCreatures()
  console.log(`\nFound ${creatures.length} creatures`)

  const toGenerate = creatures.filter(c => !c.image_url)
  const withArt    = creatures.filter(c => c.image_url)
  console.log(`  ${withArt.length} already have artwork`)
  console.log(`  ${toGenerate.length} need artwork\n`)

  if (toGenerate.length === 0) {
    console.log('✅ All creatures already have artwork!')
    return
  }

  const estimatedCost = (toGenerate.length * 0.04).toFixed(2)
  console.log(`Estimated cost: ~$${estimatedCost} (${toGenerate.length} × $0.04 medium quality)\n`)

  let success = 0, failed = 0

  for (const c of toGenerate) {
    process.stdout.write(`  [${success + failed + 1}/${toGenerate.length}] ${c.name}... `)
    try {
      const b64 = await generateImage(c)
      const storageUrl = await uploadToStorage(c.id, b64)
      await updateCreature(c.id, storageUrl)
      console.log(`✓`)
      success++
      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 1200))
    } catch (err) {
      console.log(`✗ ${err.message}`)
      failed++
    }
  }

  console.log(`\n================================`)
  console.log(`✅ ${success} generated successfully`)
  if (failed > 0) console.log(`❌ ${failed} failed — re-run to retry`)
}

main().catch(console.error)
