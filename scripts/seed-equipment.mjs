// Seed starter equipment items (idempotent) + generate icons with gpt-image-2.
// Run with: node scripts/seed-equipment.mjs
// Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
//
// Re-running is safe: items already present (matched by name) are not
// duplicated; only missing items are inserted and only items without an
// image_url get artwork generated. If OPENAI_API_KEY is absent the items are
// still seeded (without images) and can be regenerated from the admin panel.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const env = {}
try {
  const envRaw = readFileSync(join(root, '.env.local'), 'utf8').replace(/^﻿/, '')
  for (const line of envRaw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* no .env.local — rely on process.env */ }

// process.env wins when .env.local has the var empty or missing.
const pick = k => (process.env[k] && process.env[k].length ? process.env[k] : env[k])
const SUPABASE_URL = pick('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY  = pick('SUPABASE_SERVICE_ROLE_KEY')
const OPENAI_KEY   = pick('OPENAI_API_KEY')
const BUCKET       = 'item-artwork'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }

// slot, rarity, bonuses + an AI prompt describing the piece
const STARTER = [
  { name: 'Lama del Litorale',    type: 'arma',       rarity: 'comune', bonus_hp: 0,  bonus_atk: 4, bonus_def: 0, description: 'Una lama leggera forgiata sulla costa adriatica.', prompt: 'short bronze coastal sword with a wave-etched blade' },
  { name: 'Zanna del Bosco',      type: 'arma',       rarity: 'raro',   bonus_hp: 0,  bonus_atk: 9, bonus_def: 1, description: 'Artiglio rituale intriso di linfa antica.', prompt: 'curved fang-shaped blade wrapped in living vines, glowing green sap' },
  { name: 'Corazza di Scoglio',   type: 'corazza',    rarity: 'comune', bonus_hp: 10, bonus_atk: 0, bonus_def: 3, description: 'Piastra grezza ricavata dalla roccia marina.', prompt: 'rugged stone-and-shell chest armor, barnacle texture' },
  { name: 'Egida dei Fondali',    type: 'corazza',    rarity: 'raro',   bonus_hp: 22, bonus_atk: 0, bonus_def: 7, description: 'Armatura iridescente che trattiene il respiro del mare.', prompt: 'iridescent deep-sea plate armor with pearlescent sheen' },
  { name: 'Elmo del Sentiero',    type: 'elmo',       rarity: 'comune', bonus_hp: 6,  bonus_atk: 0, bonus_def: 2, description: 'Copricapo robusto per i lunghi cammini appenninici.', prompt: 'sturdy leather-and-iron travel helmet, mountain trail style' },
  { name: 'Cimiero di Fiamma',    type: 'elmo',       rarity: 'raro',   bonus_hp: 14, bonus_atk: 1, bonus_def: 5, description: 'Elmo cesellato che arde di brace perenne.', prompt: 'ornate helmet with an ember crest, faint flame glow' },
  { name: 'Talismano d\'Armonia', type: 'accessorio', rarity: 'comune', bonus_hp: 4,  bonus_atk: 2, bonus_def: 1, description: 'Piccolo amuleto che bilancia le energie elementali.', prompt: 'small balanced amulet with a soft prismatic gemstone' },
  { name: 'Sigillo Mitico',       type: 'accessorio', rarity: 'raro',   bonus_hp: 9,  bonus_atk: 5, bonus_def: 3, description: 'Anello inciso con rune dimenticate.', prompt: 'ancient rune-engraved ring radiating subtle arcane light' },

  { name: 'Falce delle Maree',    type: 'arma',       rarity: 'epico',       bonus_hp: 2,  bonus_atk: 15, bonus_def: 2,  description: 'Falce ricurva che taglia come l\'onda di tempesta.', prompt: 'epic curved scythe-blade made of crashing seawater and dark steel, storm energy' },
  { name: 'Spada dell\'Apocalisse', type: 'arma',     rarity: 'leggendario', bonus_hp: 4,  bonus_atk: 23, bonus_def: 3,  description: 'Lama leggendaria che incendia l\'aria al suo passaggio.', prompt: 'legendary greatsword wreathed in living flame and golden runes, radiant aura' },
  { name: 'Baluardo Tellurico',   type: 'corazza',    rarity: 'epico',       bonus_hp: 38, bonus_atk: 0,  bonus_def: 12, description: 'Corazza forgiata nel cuore della montagna.', prompt: 'epic heavy plate armor of fused mountain crystal and obsidian, faint earthen glow' },
  { name: 'Egida Primordiale',    type: 'corazza',    rarity: 'leggendario', bonus_hp: 58, bonus_atk: 2,  bonus_def: 18, description: 'Armatura leggendaria intessuta di luce antica.', prompt: 'legendary radiant full armor woven from ancient light, divine engravings, glowing core' },
  { name: 'Corona del Bosco',     type: 'elmo',       rarity: 'epico',       bonus_hp: 24, bonus_atk: 2,  bonus_def: 9,  description: 'Elmo coronato di rami viventi e ambra.', prompt: 'epic crowned helmet entwined with living branches and amber, soft nature glow' },
  { name: 'Diadema Astrale',      type: 'elmo',       rarity: 'leggendario', bonus_hp: 36, bonus_atk: 3,  bonus_def: 14, description: 'Diadema leggendario che racchiude una stella.', prompt: 'legendary star-crowned diadem-helmet holding a glowing celestial gem, cosmic light' },
  { name: 'Amuleto delle Sfere',  type: 'accessorio', rarity: 'epico',       bonus_hp: 16, bonus_atk: 9,  bonus_def: 6,  description: 'Amuleto che orbita di piccole sfere elementali.', prompt: 'epic amulet with orbiting miniature elemental orbs, swirling energy' },
  { name: 'Cuore di Daimon',      type: 'accessorio', rarity: 'leggendario', bonus_hp: 26, bonus_atk: 14, bonus_def: 10, description: 'Reliquia leggendaria che pulsa di potere antico.', prompt: 'legendary glowing crystalline heart relic pulsing with ancient power, radiant veins' },
]

async function ensureBucket() {
  if (!OPENAI_KEY) return
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  if (r.ok) console.log(`✓ Bucket '${BUCKET}' created`)
  else {
    const d = await r.json().catch(() => ({}))
    if (`${d.error ?? d.message ?? ''}`.includes('already exists')) console.log(`✓ Bucket '${BUCKET}' exists`)
    else console.error('Bucket error:', d)
  }
}

async function getExisting() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/items?select=id,name,image_url&type=in.(arma,corazza,elmo,accessorio)`,
    { headers }
  )
  return r.ok ? r.json() : []
}

async function insertItem(it) {
  const row = {
    name: it.name, type: it.type, description: it.description,
    rarity: it.rarity, bonus_hp: it.bonus_hp, bonus_atk: it.bonus_atk, bonus_def: it.bonus_def,
    effect_value: 0, shop_price: 0, in_shop: false, is_redeemable: false, reward: {},
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/items`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!r.ok) throw new Error(`Insert failed: ${JSON.stringify(await r.json().catch(() => ({})))}`)
  return (await r.json())[0]
}

async function generateImage(it) {
  const prompt = `Game equipment item icon for a mobile creature-catching RPG set in the Italian Adriatic coast and Apennine forests. Single piece of gear, painterly fantasy style, vibrant colors, centered, no text, square format, clean transparent-ish background. The item: ${it.name} — ${it.prompt} (slot: ${it.type}, rarity: ${it.rarity})`
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1024', quality: 'medium', output_format: 'png' }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message ?? `OpenAI ${r.status}`)
  return data.data[0].b64_json
}

async function uploadAndSave(id, b64) {
  const binary = Buffer.from(b64, 'base64')
  const path = `items/${id}.png`
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: binary,
  })
  if (!up.ok) throw new Error(`Storage upload failed: ${JSON.stringify(await up.json().catch(() => ({})))}`)
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
  const patch = await fetch(`${SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ image_url: url }),
  })
  if (!patch.ok) throw new Error(`DB update failed: ${patch.status}`)
  return url
}

async function main() {
  console.log('🛡️  WildCatch Equipment Seeder')
  console.log('================================')
  await ensureBucket()

  const existing = await getExisting()
  const byName = new Map(existing.map(e => [e.name, e]))

  let inserted = 0, generated = 0, failed = 0
  for (const it of STARTER) {
    let row = byName.get(it.name)
    if (!row) {
      try {
        row = await insertItem(it)
        inserted++
        console.log(`+ inserted ${it.name}`)
      } catch (e) {
        failed++
        console.log(`✗ insert ${it.name}: ${e.message}`)
        continue
      }
    } else {
      console.log(`= exists ${it.name}`)
    }

    if (OPENAI_KEY && !row.image_url) {
      process.stdout.write(`  🎨 ${it.name}... `)
      try {
        const b64 = await generateImage(it)
        await uploadAndSave(row.id, b64)
        generated++
        console.log('✓')
        await new Promise(r => setTimeout(r, 1200))
      } catch (e) {
        failed++
        console.log(`✗ ${e.message}`)
      }
    }
  }

  console.log('================================')
  console.log(`✅ ${inserted} inserted, ${generated} images generated`)
  if (!OPENAI_KEY) console.log('ℹ️  OPENAI_API_KEY not set — images skipped (generate from admin panel)')
  if (failed > 0) console.log(`❌ ${failed} failed — re-run to retry`)
}

main().catch(console.error)
