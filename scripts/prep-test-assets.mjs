// Convert the style-test renders into /public assets for the demo route.
// Backgrounds → webp (q82). Cutouts → webp (lossless alpha). Non-destructive.
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'docs', 'mockups', 'preview-2026-05-21')
const bgDir = join(root, 'public', 'backgrounds', 'battle')
const creDir = join(root, 'public', 'creatures-test')
mkdirSync(bgDir, { recursive: true })
mkdirSync(creDir, { recursive: true })

const tasks = [
  { in: 'bg-bosco.png', out: join(bgDir, 'bosco.webp'), opts: { quality: 82 } },
  { in: 'bg-terra.png', out: join(bgDir, 'terra.webp'), opts: { quality: 82 } },
  { in: 'muschio.png', out: join(creDir, 'muschio.webp'), opts: { quality: 92, alphaQuality: 100 } },
  { in: 'miniera.png', out: join(creDir, 'miniera.webp'), opts: { quality: 92, alphaQuality: 100 } },
]

for (const t of tasks) {
  const info = await sharp(join(src, t.in)).webp(t.opts).toFile(t.out)
  console.log(`✓ ${t.out.replace(root, '')}  ${(info.size / 1024).toFixed(0)} KB  ${info.width}x${info.height}`)
}
console.log('Done.')
