// Style test — generate 2 transparent creature cutouts + 2 element backgrounds
// with gpt-image-2, saved LOCALLY only. Non-destructive: no DB, no storage writes.
// Run: node scripts/gen-style-test.mjs
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const OPENAI_KEY = env.OPENAI_API_KEY
if (!OPENAI_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1) }

const OUT = join(root, 'docs', 'mockups', 'preview-2026-05-21')
mkdirSync(OUT, { recursive: true })

// gpt-image-2 = best opaque scenes; it CANNOT do transparency.
// gpt-image-1.5 = supports native transparent cutouts (verified alpha).
const SCENE_MODEL = 'gpt-image-2'
const CUTOUT_MODEL = 'gpt-image-1.5'
const ONLY = process.argv[2] // optional: 'cutout' | 'scene'

const CREATURE_STYLE =
  'STYLE: Single creature for a mobile creature-catching game set in a mythological ' +
  'Italian world (Adriatic coast and Apennine forests). Cute-but-characterful chibi ' +
  'monster, big expressive eyes, chunky friendly proportions, hand-painted semi-stylized ' +
  'shading, soft rim light, vivid but slightly earthy palette. Centered, full body, ' +
  'facing camera three-quarter view. TRANSPARENT BACKGROUND — no ground, no platform, ' +
  'no shadow baked in, no scenery, no text, no UI, no border. Square. Subject: '

const BG_STYLE =
  'Wide vertical environment background for a mobile creature-battle game set on the ' +
  'Italian Adriatic coast and Apennine forests. Painterly, semi-stylized, rich but ' +
  'slightly desaturated, cinematic depth, soft volumetric light, NO creatures, NO ' +
  'characters, NO text, NO UI, empty stage with foreground floor and atmospheric ' +
  'background, a slightly darker horizontal band across the vertical middle. Subject: '

const JOBS = [
  {
    file: 'muschio.png', kind: 'cutout',
    prompt: CREATURE_STYLE +
      'Muschio, a Common forest sprite: a small round plump creature made of soft green moss, ' +
      'its mossy dome dotted with tiny white daisies and little red-capped toadstools, a single ' +
      'fresh sprout leaf growing from the top of its head, big round shiny dark eyes, rosy ' +
      'blushing cheeks, a tiny happy mouth, short stubby mossy feet. Humble, soft, adorable.',
  },
  {
    file: 'miniera.png', kind: 'cutout',
    prompt: CREATURE_STYLE +
      'Miniera, a Legendary primordial earth spirit that slept for millennia deep in the Apennine ' +
      'mountains: an imposing chunky golem built of dark fractured rock and packed earth, large ' +
      'glowing amber and orange crystal shards erupting from its back and shoulders, wearing a ' +
      'battered bronze miner helmet with a glowing lamp, molten amber light glowing from the cracks ' +
      'across its rocky body, one fierce glowing amber eye, massive heavy stone fists. Monumental, ' +
      'majestic, ornate yet still characterful.',
  },
  {
    file: 'bg-bosco.png', kind: 'scene',
    prompt: BG_STYLE +
      'an enchanted Apennine forest clearing, mossy stones, ferns, mushrooms, shafts of ' +
      'green-gold light through the canopy, drifting spores.',
  },
  {
    file: 'bg-terra.png', kind: 'scene',
    prompt: BG_STYLE +
      'a crystalline rock canyon at dusk, layered sandstone, amber crystal veins, drifting ' +
      'dust motes, warm earthy tones.',
  },
]

async function generate(job) {
  const body = {
    model: job.kind === 'cutout' ? CUTOUT_MODEL : SCENE_MODEL,
    prompt: job.prompt,
    n: 1,
    quality: 'high',
    output_format: 'png',
    ...(job.kind === 'cutout'
      ? { size: '1024x1024', background: 'transparent' }
      : { size: '1024x1536', background: 'opaque' }),
  }
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(data?.error ?? data).slice(0, 400)}`)
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No b64_json in response: ' + JSON.stringify(data).slice(0, 300))
  const out = join(OUT, job.file)
  writeFileSync(out, Buffer.from(b64, 'base64'))
  return out
}

const jobs = ONLY ? JOBS.filter((j) => j.kind === ONLY) : JOBS
console.log(`Generating ${jobs.length} assets → ${OUT}\n`)
for (const job of jobs) {
  process.stdout.write(`  ${job.file} (${job.kind})... `)
  try {
    const out = await generate(job)
    const kb = (statSync(out).size / 1024).toFixed(0)
    console.log(`OK (${kb} KB)`)
  } catch (e) {
    console.log(`FAIL — ${e.message}`)
  }
  await new Promise((res) => setTimeout(res, 1200))
}
console.log('\nDone.')
