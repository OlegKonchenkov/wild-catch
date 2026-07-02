'use client'
import { type CSSProperties } from 'react'
import {
  GiTreasureMap, GiSpellBook, GiCrossedSwords, GiBullseye, GiPuzzle,
  GiSwapBag, GiKnapsack, GiTrophyCup, GiCompass, GiHouse, GiGreekTemple,
} from 'react-icons/gi'
import { type IconType } from 'react-icons'

/**
 * Navbar icons built on the professional "Game Icons" set (game-icons.net via
 * react-icons, tree-shaken → lightweight). Each is a crisp, game-themed glyph
 * rendered in a vivid theme colour with a soft colour glow behind — defined +
 * colourful + premium, no heavy boxes/borders. Active = brighter glow.
 */
type Props = { size?: number; active?: boolean }

function make(Icon: IconType, color: string, glow: string) {
  function NavGlyph({ size = 26, active }: Props) {
    const iconStyle: CSSProperties = {
      position: 'relative',
      zIndex: 1,
      filter: active ? `drop-shadow(0 0 5px ${glow}) drop-shadow(0 1px 1px rgba(0,0,0,0.5))` : 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))',
    }
    return (
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: '-32%', borderRadius: '50%', pointerEvents: 'none',
            background: `radial-gradient(circle, ${glow}${active ? '6e' : '2c'} 0%, transparent 68%)`,
          }}
        />
        <Icon size={size} color={color} style={iconStyle} />
      </span>
    )
  }
  return NavGlyph
}

/** Lookup keyed by the nav slug used in GameShell. */
export const NAV_ICON: Record<string, (p: Props) => React.ReactElement> = {
  map:      make(GiTreasureMap,  '#5FD08A', '#2ECC6A'),
  bestiary: make(GiSpellBook,    '#B98BF0', '#8E5BE0'),
  duel:     make(GiCrossedSwords,'#FF8A96', '#EB4D5C'),
  missions: make(GiBullseye,     '#FFC766', '#F0A93C'),
  enigmi:   make(GiPuzzle,       '#C58BFA', '#A05CE8'),
  shop:     make(GiSwapBag,      '#FFD874', '#F3C233'),
  backpack: make(GiKnapsack,     '#FFB070', '#F0843C'),
  collezione: make(GiGreekTemple, '#E6C989', '#C8A24A'),
  trophy:   make(GiTrophyCup,    '#FFDD7A', '#F3C233'),
  guide:    make(GiCompass,      '#7FE0F0', '#46BAD8'),
  home:     make(GiHouse,        '#6FD8C8', '#2FA0A8'),
}
