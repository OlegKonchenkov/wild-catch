import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PackOpenModal from '../PackOpenModal'

vi.mock('@/lib/game/sounds/pack-open', () => ({
  playPackTear: vi.fn(),
  playPackBurst: vi.fn(),
  playDropReveal: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playUiTap: vi.fn(),
}))

import { playPackTear, playPackBurst, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('<PackOpenModal>', () => {
  it('plays tear + burst sounds scaled to the pack rarity when tapped open', () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina Epica', rarity: 'epico' }}
      drops={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(playPackTear).toHaveBeenCalledWith('epico')
    expect(playPackBurst).toHaveBeenCalledWith('epico')
  })

  it('plays a drop-reveal sound per drop once the reveal phase begins', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[
        { type: 'gold', ok: true, detail: { amount: 10 } },
        { type: 'oggetto', ok: true, detail: { itemName: 'Erba', rarity: 'raro' } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('10 Oro', {}, { timeout: 3000 })
    expect(playDropReveal).toHaveBeenCalledWith(undefined)
    expect(playDropReveal).toHaveBeenCalledWith('raro')
  })

  it('plays a UI tap when the final CTA button is pressed', async () => {
    const onDone = vi.fn()
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[{ type: 'gold', ok: true, detail: { amount: 10 } }]}
      onDone={onDone}
    />)
    fireEvent.click(screen.getByRole('button'))
    const cta = await screen.findByText('Fantastico!', {}, { timeout: 3000 })
    fireEvent.click(cta)
    expect(playUiTap).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
