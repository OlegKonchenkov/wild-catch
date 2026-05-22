// Regenerate every creature as a clean NATIVE TRANSPARENT cutout (gpt-image-1.5,
// which supports transparency; gpt-image-2 does not). Non-destructive:
//   • uploads to Storage  creature-artwork/creatures/cutouts/{id}.webp
//   • sets creatures.sprite_cutout_url ONLY  (image_url is NEVER touched)
//   • idempotent: skips creatures that already have a cutout unless --force
// Flags: --force  --limit N  --only <id|name-substring>
// Also saves a local QA copy to docs/mockups/cutout-qa/.
// Run: node scripts/regenerate-creatures.mjs [--limit 3] [--only Muschio] [--force]
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = env.OPENAI_API_KEY
if (!URL || !KEY || !OPENAI_KEY) { console.error('Missing env (URL / SERVICE_ROLE / OPENAI)'); process.exit(1) }
const BUCKET = 'creature-artwork'
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const QA = join(root, 'docs', 'mockups', 'cutout-qa')
mkdirSync(QA, { recursive: true })

const STYLE =
  'STYLE: Single creature for a mobile creature-catching game set in a mythological Italian ' +
  'world (Adriatic coast and Apennine forests). Cute-but-characterful chibi monster, big ' +
  'expressive eyes, chunky friendly proportions, hand-painted semi-stylized shading, soft rim ' +
  'light, vivid but slightly earthy palette. One single creature, centered, full body, facing ' +
  'camera three-quarter view. TRANSPARENT BACKGROUND — no ground, no platform, no shadow baked ' +
  'in, no scenery, no text, no UI, no border, no frame. Square. Subject: '

const MOTIF = {
  bosco: 'forest nature — moss, leaves, petals, mushrooms; lush green palette',
  fiamma: 'fire — embers, molten cracks, small flames; warm red-orange palette',
  adriatico: 'sea — water, shells, corals, fins; cool blue-teal palette',
  terra: 'earth — rock, soil, glowing crystals; amber and brown palette',
  armonia: 'harmony — soft light, runes, gentle aura; violet-and-gold palette',
}
const RARITY = {
  comune: 'common: simple, humble, small and adorable',
  non_comune: 'uncommon: a little more developed, charming',
  raro: 'rare: distinctive and eye-catching',
  epico: 'epic: powerful, elaborate, imposing',
  leggendario: 'legendary: majestic, ornate, awe-inspiring, large and powerful',
  mitologico: 'mythological: divine, otherworldly, breathtaking, radiant with energy',
}

function buildPrompt(c) {
  const desc = (c.description || '').replace(/\s+/g, ' ').trim()
  return STYLE +
    `"${c.name}" — ${desc} Element: ${c.element} (${MOTIF[c.element] || ''}). ` +
    `Rarity ${c.rarity} (${RARITY[c.rarity] || ''}). Keep it clearly recognizable as ${c.name}.`
}

async function genCutout(prompt) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1.5', prompt, n: 1, size: '1024x1024', quality: 'high', background: 'transparent', output_format: 'png' }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(data?.error ?? data).slice(0, 240)}`)
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('no image')
  return Buffer.from(b64, 'base64')
}

async function upload(id, webp) {
  const path = `creatures/cutouts/${id}.webp`
  const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', headers: { ...h, 'Content-Type': 'image/webp', 'x-upsert': 'true' }, body: webp,
  })
  if (!r.ok) throw new Error(`storage ${r.status}: ${JSON.stringify(await r.json()).slice(0, 200)}`)
  return `${URL}/storage/v1/object/public/${BUCKET}/${path}`
}

async function setUrl(id, url) {
  const r = await fetch(`${URL}/rest/v1/creatures?id=eq.${id}`, {
    method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ sprite_cutout_url: url }),
  })
  if (!r.ok) throw new Error(`db ${r.status}`)
}

async function main() {
  const res = await fetch(`${URL}/rest/v1/creatures?select=id,name,description,element,rarity,sprite_cutout_url&order=rarity,name`, { headers: h })
  let creatures = await res.json()
  if (!Array.isArray(creatures)) { console.error('fetch failed:', creatures); process.exit(1) }
  if (ONLY) creatures = creatures.filter((c) => c.id === ONLY || c.name.toLowerCase().includes(ONLY.toLowerCase()))
  if (!FORCE) creatures = creatures.filter((c) => !c.sprite_cutout_url)
  if (LIMIT) creatures = creatures.slice(0, LIMIT)

  console.log(`🎨 ${creatures.length} creature(s) to generate (gpt-image-1.5, transparent)\n`)
  let ok = 0, fail = 0
  for (const c of creatures) {
    process.stdout.write(`  [${ok + fail + 1}/${creatures.length}] ${c.element}/${c.rarity} ${c.name} … `)
    try {
      const png = await genCutout(buildPrompt(c))
      const webp = await sharp(png).webp({ quality: 92, alphaQuality: 100 }).toBuffer()
      writeFileSync(join(QA, `${c.name.replace(/[^\w]/g, '_')}.webp`), webp)
      const url = await upload(c.id, webp)
      await setUrl(c.id, url)
      console.log(`OK (${(webp.length / 1024).toFixed(0)}KB)`)
      ok++
    } catch (e) {
      console.log(`FAIL — ${e.message}`)
      fail++
    }
    await new Promise((r) => setTimeout(r, 1200))
  }
  console.log(`\n✅ ${ok} ok${fail ? `  ❌ ${fail} failed (re-run to retry)` : ''}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
