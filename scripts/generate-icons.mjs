// Generates PWA icons and favicon for WildCatch
// Usage: node scripts/generate-icons.mjs

import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// WildCatch icon: dark ocean background, glowing paw/pokeball-style capture circle
// with a stylized creature silhouette inside — fits the outdoor-catching theme
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1A3A5C"/>
      <stop offset="100%" stop-color="#0A1520"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3AB8D8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#3AB8D8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#5DD4F0"/>
      <stop offset="60%" stop-color="#3A9DBC"/>
      <stop offset="100%" stop-color="#1E6A8A"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#3AB8D8" flood-opacity="0.5"/>
    </filter>
    <filter id="glow2">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="circle-clip">
      <circle cx="256" cy="256" r="200"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="115" fill="url(#bg)"/>

  <!-- Ambient glow -->
  <circle cx="256" cy="256" r="220" fill="url(#glow)"/>

  <!-- Outer ring -->
  <circle cx="256" cy="256" r="200" fill="none" stroke="#3A9DBC" stroke-width="3.5" opacity="0.6"/>
  <circle cx="256" cy="256" r="196" fill="none" stroke="#5DD4F0" stroke-width="1" opacity="0.3"/>

  <!-- Capture circle fill top half -->
  <path d="M56,256 A200,200 0 0,1 456,256 Z" fill="#1E4A6A" opacity="0.8"/>

  <!-- Capture line -->
  <line x1="56" y1="256" x2="456" y2="256" stroke="#3A9DBC" stroke-width="3" opacity="0.9"/>

  <!-- Center capture button -->
  <circle cx="256" cy="256" r="36" fill="#0A1520" stroke="#3A9DBC" stroke-width="3"/>
  <circle cx="256" cy="256" r="26" fill="url(#orb)" filter="url(#shadow)"/>
  <circle cx="248" cy="250" r="6" fill="white" opacity="0.35"/>

  <!-- Creature silhouette: stylized dragon/creature above center line -->
  <g clip-path="url(#circle-clip)">
    <!-- Body -->
    <ellipse cx="256" cy="185" rx="38" ry="30" fill="#D4F5FF" opacity="0.92"/>
    <!-- Head -->
    <circle cx="256" cy="152" r="26" fill="#D4F5FF" opacity="0.92"/>
    <!-- Eyes glow -->
    <circle cx="248" cy="149" r="5" fill="#3AB8D8"/>
    <circle cx="264" cy="149" r="5" fill="#3AB8D8"/>
    <circle cx="248" cy="149" r="2.5" fill="white"/>
    <circle cx="264" cy="149" r="2.5" fill="white"/>
    <!-- Wings -->
    <path d="M218,175 Q188,145 200,120 Q215,145 240,165 Z" fill="#A8E8F8" opacity="0.85"/>
    <path d="M294,175 Q324,145 312,120 Q297,145 272,165 Z" fill="#A8E8F8" opacity="0.85"/>
    <!-- Tail -->
    <path d="M270,210 Q290,225 285,240 Q272,228 256,215 Z" fill="#B8EEF8" opacity="0.8"/>
    <!-- Ears/horns -->
    <path d="M244,132 L238,112 L250,128 Z" fill="#7DD4F0" opacity="0.9"/>
    <path d="M268,132 L274,112 L262,128 Z" fill="#7DD4F0" opacity="0.9"/>
  </g>

  <!-- Sparkles -->
  <g fill="#F7C841" filter="url(#glow2)" opacity="0.9">
    <circle cx="120" cy="140" r="3.5"/>
    <circle cx="392" cy="160" r="2.5"/>
    <circle cx="108" cy="320" r="2"/>
    <circle cx="400" cy="340" r="3"/>
    <circle cx="180" cy="80" r="2"/>
    <circle cx="340" cy="90" r="2.5"/>
  </g>

  <!-- Star sparkle shapes -->
  <g fill="#F7C841" opacity="0.7">
    <path d="M130,310 L133,317 L140,317 L135,322 L137,329 L130,325 L123,329 L125,322 L120,317 L127,317 Z" transform="scale(0.6) translate(87,200)"/>
    <path d="M380,290 L383,297 L390,297 L385,302 L387,309 L380,305 L373,309 L375,302 L370,297 L377,297 Z" transform="scale(0.5) translate(390,200)"/>
  </g>
</svg>`

const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1A3A5C"/>
      <stop offset="100%" stop-color="#0A1520"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#5DD4F0"/>
      <stop offset="100%" stop-color="#1E6A8A"/>
    </radialGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#bg)"/>
  <circle cx="16" cy="16" r="12.5" fill="none" stroke="#3A9DBC" stroke-width="1.5" opacity="0.7"/>
  <path d="M3.5,16 A12.5,12.5 0 0,1 28.5,16 Z" fill="#1E4A6A" opacity="0.8"/>
  <line x1="3.5" y1="16" x2="28.5" y2="16" stroke="#3A9DBC" stroke-width="1.5" opacity="0.9"/>
  <circle cx="16" cy="16" r="3.5" fill="url(#orb)"/>
  <circle cx="16" cy="10" r="4.5" fill="#C8EEFA" opacity="0.9"/>
  <circle cx="13.5" cy="9" r="1.2" fill="#3AB8D8"/>
  <circle cx="18.5" cy="9" r="1.2" fill="#3AB8D8"/>
  <path d="M12,12 Q8,9 9.5,6.5 Q12,10 15,12 Z" fill="#A0DDEF" opacity="0.85"/>
  <path d="M20,12 Q24,9 22.5,6.5 Q20,10 17,12 Z" fill="#A0DDEF" opacity="0.85"/>
</svg>`

async function generate() {
  const svgBuf = Buffer.from(svgIcon)

  // 192x192 icon
  await sharp(svgBuf)
    .resize(192, 192)
    .png()
    .toFile(join(root, 'public/icons/icon-192.png'))
  console.log('✓ icon-192.png')

  // 512x512 icon
  await sharp(svgBuf)
    .resize(512, 512)
    .png()
    .toFile(join(root, 'public/icons/icon-512.png'))
  console.log('✓ icon-512.png')

  // Maskable icon — same but with safe zone padding (20% = 102px each side on 512)
  // Enlarge background to fill, shrink content to 60% of canvas
  const maskableSvg = svgIcon.replace('viewBox="0 0 512 512"', 'viewBox="-102 -102 716 716"')
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(join(root, 'public/icons/icon-512-maskable.png'))
  console.log('✓ icon-512-maskable.png')

  // 180x180 Apple touch icon
  await sharp(svgBuf)
    .resize(180, 180)
    .png()
    .toFile(join(root, 'public/icons/apple-touch-icon.png'))
  console.log('✓ apple-touch-icon.png')

  // favicon.svg (browser tab) — save raw SVG
  writeFileSync(join(root, 'public/favicon.svg'), svgFavicon)
  console.log('✓ favicon.svg')

  // favicon.ico (16x16 + 32x32 embedded) — use 32x32 PNG as fallback
  await sharp(Buffer.from(svgFavicon))
    .resize(32, 32)
    .png()
    .toFile(join(root, 'public/favicon-32.png'))

  // Copy 32px as favicon.ico (browsers also accept PNG served as .ico)
  const ico32 = await sharp(Buffer.from(svgFavicon)).resize(32, 32).png().toBuffer()
  writeFileSync(join(root, 'public/favicon.ico'), ico32)
  console.log('✓ favicon.ico (32px PNG)')

  console.log('\n✅ All icons generated!')
}

generate().catch(err => { console.error(err); process.exit(1) })
