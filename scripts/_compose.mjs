// TEMP — flatten cutout over its element background (glow + contact shadow) to
// preview the composited "creature living in scene" look as a single PNG.
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'mockups', 'preview-2026-05-21')

async function hero({ bg, cutout, out, glow, scale, feetPct }) {
  const W = 760, H = 920
  const base = await sharp(join(dir, bg)).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer()

  const cre = await sharp(join(dir, cutout)).resize({ width: Math.round(W * scale) }).toBuffer()
  const cm = await sharp(cre).metadata()
  const left = Math.round((W - cm.width) / 2)
  const feetY = Math.round(H * feetPct / 100)
  const top = feetY - cm.height

  const glowSvg = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="r" cx="50%" cy="${(top + cm.height * 0.45) / H * 100}%" r="32%">` +
    `<stop offset="0%" stop-color="${glow}" stop-opacity="0.6"/><stop offset="100%" stop-color="${glow}" stop-opacity="0"/>` +
    `</radialGradient></defs><rect width="${W}" height="${H}" fill="url(#r)"/></svg>`)
  const shadowSvg = Buffer.from(
    `<svg width="${W}" height="${H}"><ellipse cx="${W / 2}" cy="${feetY - 10}" rx="${cm.width * 0.34}" ry="20" fill="black" fill-opacity="0.55"/></svg>`)
  const shadow = await sharp(shadowSvg).blur(12).toBuffer()

  await sharp(base)
    .composite([
      { input: glowSvg, blend: 'screen' },
      { input: shadow },
      { input: cre, left, top },
    ])
    .png().toFile(join(dir, out))
  console.log(`✓ ${out}  (creature ${cm.width}x${cm.height} @ ${left},${top})`)
}

await hero({ bg: 'bg-bosco.png', cutout: 'muschio.png', out: 'composite-muschio.png', glow: '#2ECC6A', scale: 0.46, feetPct: 84 })
await hero({ bg: 'bg-terra.png', cutout: 'miniera.png', out: 'composite-miniera.png', glow: '#F0A848', scale: 0.6, feetPct: 86 })
console.log('Done.')
