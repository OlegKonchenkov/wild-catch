// Regenerate the 6 battle backgrounds with gpt-image-2 (opaque, high), convert
// to webp into public/backgrounds/battle/. NO baked dark mid-band (the UI draws
// its own seam), even cinematic lighting, clear foreground floor for grounding.
// Run: node scripts/generate-backgrounds.mjs [name ...]
import sharp from 'sharp'
import { readFileSync, mkdirSync, statSync } from 'fs'
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

const OUT = join(root, 'public', 'backgrounds', 'battle')
mkdirSync(OUT, { recursive: true })

const PREFIX =
  'Wide vertical environment background for a mobile creature-battle game set in a ' +
  'mythological Italian world (Adriatic coast + Apennine forests). Painterly, semi-stylized, ' +
  'rich but slightly desaturated, cinematic depth. EVEN, BALANCED lighting across the whole ' +
  'frame — NO dark horizontal band, NO heavy central vignette, no banding. A clear, readable ' +
  'foreground floor/ground where a creature can stand, with atmospheric depth behind. ' +
  'NO creatures, NO characters, NO people, NO text, NO UI, NO logos. Subject: '

const JOBS = {
  bosco: 'an enchanted Apennine forest clearing, mossy boulders and a flat mossy rock ledge in the foreground, ferns, small mushrooms and wildflowers, soft shafts of green-gold light through the canopy, drifting glowing spores, lush and inviting.',
  fiamma: 'a volcanic ember cavern, a solid cracked-obsidian rock floor in the foreground, rivers and pools of glowing orange lava in the mid and far distance, floating embers and gentle heat haze, warm red-orange glow.',
  adriatico: 'a luminous underwater Adriatic grotto, a sandy and rocky sea floor in the foreground, swaying kelp and colourful corals, rippling turquoise caustics, distant blue light shafts, drifting bubbles and fine silt, serene.',
  terra: 'a crystalline rock canyon at golden dusk, a flat layered-sandstone rock floor in the foreground, warm amber crystal veins in the canyon walls, drifting dust motes, soft warm earthy light, majestic.',
  armonia: 'a twilight marble sanctuary, a smooth pale stone floor in the foreground, slender columns, a soft violet-and-gold aurora, floating glowing rune-glyphs and gentle sparkles, ethereal harmonious calm.',
  arena: 'a neutral open-air stone duel arena, worn flagstone floor in the foreground, low ancient walls and faint hanging banners, an overcast sky with soft cool-neutral balanced light, calm and fair.',
}

const want = process.argv.slice(2)
const names = want.length ? want.filter((n) => JOBS[n]) : Object.keys(JOBS)
console.log(`Generating ${names.length} backgrounds (gpt-image-2) → /public/backgrounds/battle/\n`)

for (const name of names) {
  process.stdout.write(`  ${name}.webp ... `)
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: PREFIX + JOBS[name], n: 1, size: '1024x1536', quality: 'high', background: 'opaque', output_format: 'png' }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(data?.error ?? data).slice(0, 300)}`)
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) throw new Error('no image')
    const out = join(OUT, `${name}.webp`)
    await sharp(Buffer.from(b64, 'base64')).webp({ quality: 82 }).toFile(out)
    console.log(`OK (${(statSync(out).size / 1024).toFixed(0)} KB)`)
  } catch (e) {
    console.log(`FAIL — ${e.message}`)
  }
  await new Promise((res) => setTimeout(res, 1200))
}
console.log('\nDone.')
