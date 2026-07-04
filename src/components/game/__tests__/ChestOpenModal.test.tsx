import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ChestOpenModal from '../ChestOpenModal'

vi.mock('@/lib/game/sounds/pack-open', () => ({
  playChestUnlock: vi.fn(),
  playDropReveal: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playUiTap: vi.fn(),
}))

import { playChestUnlock, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('<ChestOpenModal>', () => {
  it('plays the unlock sound scaled to the chest rarity when tapped open', () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere Leggendario', rarity: 'leggendario' }}
      contents={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(playChestUnlock).toHaveBeenCalledWith('leggendario')
  })

  it('plays a drop-reveal sound per content item once the reveal phase begins', async () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'comune' }}
      contents={[
        { type: 'gold', ok: true, detail: { amount: 20 } },
        { type: 'creatura', ok: true, detail: { creature: { name: 'Lupo', rarity: 'mitologico' } } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('20 Oro', {}, { timeout: 3000 })
    expect(playDropReveal).toHaveBeenCalledWith(undefined)
    expect(playDropReveal).toHaveBeenCalledWith('mitologico')
  })

  it('plays a UI tap when the final CTA button is pressed', async () => {
    const onDone = vi.fn()
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'comune' }}
      contents={[{ type: 'gold', ok: true, detail: { amount: 20 } }]}
      onDone={onDone}
    />)
    fireEvent.click(screen.getByRole('button'))
    const cta = await screen.findByText('Continua', {}, { timeout: 3000 })
    fireEvent.click(cta)
    expect(playUiTap).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
