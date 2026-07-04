import type { IconType } from 'react-icons'
import {
  GiTwoCoins, GiCutDiamond, GiSwapBag, GiSpellBook, GiEggClutch, GiPawPrint,
  GiCardboardBox, GiLockedChest, GiTrophyCup, GiScrollUnfurled, GiGreekTemple,
  GiColumnVase, GiLaurelsTrophy, GiSparkles,
} from 'react-icons/gi'
import { RARITY_COLORS } from '@/lib/types'
import type { Rarity } from '@/lib/types'

export interface LootView {
  Icon: IconType
  accent: string
  title: string
  subtitle?: string
  imageUrl?: string | null
  rarity?: Rarity
}

/**
 * Presentation metadata for a single reward drop returned by the reward
 * dispenser. Shared by the pack- and chest-opening reveals so both surfaces
 * describe rewards identically. `rarity` (when present) is also the single
 * source used to scale the reveal sound/visual boost — see pack-open.ts.
 */
export function describeDrop(type: string, detail: Record<string, any> = {}): LootView {
  const asRarity = (r?: string): Rarity | undefined =>
    r && r in RARITY_COLORS ? (r as Rarity) : undefined
  const rarityAccent = (r?: string) => {
    const rarity = asRarity(r)
    return rarity ? RARITY_COLORS[rarity] : undefined
  }

  switch (type) {
    case 'gold':
      return { Icon: GiTwoCoins, accent: '#E8B54A', title: `${detail.amount ?? 0} Oro` }
    case 'gemme':
      return { Icon: GiCutDiamond, accent: '#4FD1C5', title: `${detail.amount ?? 0} Gemme` }
    case 'exp':
      return { Icon: GiSparkles, accent: '#A78BFA', title: `${detail.amount ?? 0} EXP` }
    case 'oggetto':
      return {
        Icon: GiSwapBag,
        accent: rarityAccent(detail.rarity) ?? '#9CA3AF',
        title: detail.itemName ?? 'Oggetto',
        subtitle: detail.quantity && detail.quantity > 1 ? `×${detail.quantity}` : undefined,
        rarity: asRarity(detail.rarity),
      }
    case 'abilita':
      return { Icon: GiSpellBook, accent: '#C084FC', title: detail.abilityName ?? 'Abilità', subtitle: 'Abilità speciale' }
    case 'uovo':
      return {
        Icon: GiEggClutch,
        accent: rarityAccent(detail.eggRarity) ?? '#C084FC',
        title: 'Uovo',
        subtitle: detail.eggRarity,
        rarity: asRarity(detail.eggRarity),
      }
    case 'creatura':
      return {
        Icon: GiPawPrint,
        accent: rarityAccent(detail.creature?.rarity) ?? '#7AB87A',
        title: detail.creature?.name ?? 'Creatura',
        subtitle: detail.creature?.rarity,
        imageUrl: detail.creature?.image_url ?? detail.creature?.sprite_url ?? null,
        rarity: asRarity(detail.creature?.rarity),
      }
    case 'bustina':
      return { Icon: GiCardboardBox, accent: '#F59E0B', title: detail.packName ?? 'Bustina', subtitle: 'Bustina bonus' }
    case 'forziere':
      return { Icon: GiLockedChest, accent: '#D97706', title: detail.chestName ?? 'Forziere', subtitle: 'Forziere' }
    case 'premio':
      return { Icon: GiTrophyCup, accent: '#FF4D6D', title: detail.prizeName ?? 'Premio speciale', subtitle: detail.code ? `Codice ${detail.code}` : 'Premio' }
    case 'personaggio':
      return {
        Icon: GiLaurelsTrophy,
        accent: rarityAccent(detail.rarity) ?? '#F59E0B',
        title: detail.name ?? 'Personaggio',
        subtitle: 'Personaggio culturale',
        imageUrl: detail.image_url,
        rarity: asRarity(detail.rarity),
      }
    case 'opera':
      return {
        Icon: GiColumnVase,
        accent: rarityAccent(detail.rarity) ?? '#38BDF8',
        title: detail.name ?? 'Opera',
        subtitle: 'Opera d’arte',
        imageUrl: detail.image_url,
        rarity: asRarity(detail.rarity),
      }
    case 'aneddoto':
      return { Icon: GiScrollUnfurled, accent: '#A3E635', title: detail.title ?? 'Aneddoto', subtitle: 'Storia' }
    case 'indizio':
      return { Icon: GiScrollUnfurled, accent: '#38BDF8', title: 'Indizio', subtitle: 'Enigma' }
    case 'missione':
      return { Icon: GiGreekTemple, accent: '#F472B6', title: detail.title ?? 'Missione speciale', subtitle: 'Missione' }
    default:
      return { Icon: GiSparkles, accent: '#9CA3AF', title: type }
  }
}
