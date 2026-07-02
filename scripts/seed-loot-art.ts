/**
 * Bulk-generate AI art for the loot/collection catalogue rows that still lack an
 * image, then upload each to the `game-assets` Supabase bucket and save the URL.
 *
 * Run:
 *   export $(grep -vE '^#' .env.local | xargs)   # or set the vars below
 *   npx tsx scripts/seed-loot-art.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API(_KEY),
 *      optional OPENAI_IMAGE_MODEL (default gpt-image-2).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? process.env.OPENAI_API!
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2'
const BUCKET = 'game-assets'

const STYLE =
  'Digital game asset illustration for a mobile creature-catching game set on the Italian Adriatic coast with ancient Roman heritage. Warm painterly style, dramatic rim light, rich tasteful colors, centered composition, no text, no watermark, no UI. '

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error('Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API(_KEY)')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function genAndUpload(prompt: string, path: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: STYLE + prompt, n: 1, size: '1024x1024', quality: 'medium', output_format: 'png' }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('no image')
  const buffer = Buffer.from(b64, 'base64')
  await db.storage.createBucket(BUCKET, { public: true }).catch(() => {})
  const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

interface Job { table: string; id: string; label: string; prompt: string }

async function collectJobs(): Promise<Job[]> {
  const jobs: Job[] = []
  const push = (table: string, rows: any[] | null, prompt: (r: any) => string) => {
    for (const r of rows ?? []) if (!r.image_url) jobs.push({ table, id: r.id, label: r.name ?? r.title, prompt: prompt(r) })
  }

  const [packs, chests, keys, prizes, places, artworks, characters] = await Promise.all([
    db.from('packs').select('id, name, description, image_url, rarity'),
    db.from('chests').select('id, name, description, image_url, rarity'),
    db.from('items').select('id, name, description, image_url').eq('type', 'chiave'),
    db.from('special_prizes').select('id, name, description, image_url'),
    db.from('cultural_places').select('id, name, description, image_url'),
    db.from('artworks').select('id, name, description, image_url'),
    db.from('characters').select('id, name, description, image_url'),
  ])

  push('packs', packs.data, r => `A sealed collectible card pack / booster envelope, ${r.rarity ?? 'common'} tier, foil accents, Roman motifs. ${r.name}: ${r.description}`)
  push('chests', chests.data, r => `An ornate ancient treasure chest, ${r.rarity ?? 'rare'} tier, bronze and marble Roman styling, closed with a heavy lock. ${r.name}: ${r.description}`)
  push('items', keys.data, r => `A single ornate antique key as a game item icon on a subtle vignette. ${r.name}: ${r.description}`)
  push('special_prizes', prizes.data, r => `A premium reward voucher / trophy object representing a real-world prize, elegant and celebratory. ${r.name}: ${r.description}`)
  push('cultural_places', places.data, r => `An evocative wide illustration of an Italian archaeological/cultural site. ${r.name}: ${r.description}`)
  push('artworks', artworks.data, r => `A museum artwork / ancient Roman artefact photographed as a collectible card. ${r.name}: ${r.description}`)
  push('characters', characters.data, r => `A dignified portrait of a historical Roman/classical figure as a collectible character card. ${r.name}: ${r.description}`)

  return jobs
}

async function main() {
  const jobs = await collectJobs()
  console.log(`${jobs.length} images to generate...`)
  let ok = 0
  for (const job of jobs) {
    try {
      const url = await genAndUpload(job.prompt, `${job.table}/${job.id}.png`)
      const { error } = await db.from(job.table).update({ image_url: url }).eq('id', job.id)
      if (error) throw error
      ok++
      console.log(`  ✓ ${job.table} · ${job.label}`)
    } catch (e: any) {
      console.error(`  ✗ ${job.table} · ${job.label}: ${e.message}`)
    }
  }
  console.log(`Done: ${ok}/${jobs.length} generated.`)
}

main().then(() => process.exit(0))
