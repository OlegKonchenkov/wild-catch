import { type CSSProperties } from 'react'
import { GiFlame, GiWaterDrop, GiThreeLeaves, GiStonePile, GiMusicalNotes } from 'react-icons/gi'
import { type IconType } from 'react-icons'

/**
 * Global element icon — a coloured Game Icon per element, replacing the old
 * emoji (🔥🌊🌿🪨🎵). Single source of truth so battles, dex, pickers etc. all
 * render elements identically. Lightweight (tree-shaken gi glyphs).
 */
const ELEMENT_VIS: Record<string, { Icon: IconType; color: string }> = {
  fiamma:    { Icon: GiFlame,        color: '#FF6B36' },
  adriatico: { Icon: GiWaterDrop,    color: '#38BDF8' },
  bosco:     { Icon: GiThreeLeaves,  color: '#44D08A' },
  terra:     { Icon: GiStonePile,    color: '#E0A24E' },
  armonia:   { Icon: GiMusicalNotes, color: '#C084FC' },
}

/** Canonical accent colour per element (for tints, glows, borders). */
export const ELEMENT_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENT_VIS).map(([k, v]) => [k, v.color]),
)

export default function ElementIcon({
  element, size = 16, color, className, style,
}: {
  element: string
  size?: number
  /** Override the element colour (e.g. white on an active chip). */
  color?: string
  className?: string
  style?: CSSProperties
}) {
  const v = ELEMENT_VIS[element]
  if (!v) return null
  const Icon = v.Icon
  return <Icon size={size} color={color ?? v.color} className={className} style={style} />
}
