import type { Config } from 'tailwindcss'

// Tailwind v4 uses CSS-based config (src/app/globals.css)
// This file is kept for tooling compatibility and future extensions
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config
