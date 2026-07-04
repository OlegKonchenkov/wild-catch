import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/game/sounds/pack-open', () => ({
  playPackTear: vi.fn(),
  playPackBurst: vi.fn(),
  playDropReveal: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playUiTap: vi.fn(),
}))

// framer-motion's real exit/enter animations rely on the Web Animations API,
// which JSDOM doesn't implement — so `AnimatePresence mode="wait"` never
// resolves the sealed→burst exit transition in tests, and the transient
// "burst" phase content is never observably committed to the DOM before the
// 620ms reveal timeout fires. Mocking motion.* / AnimatePresence as inert
// passthroughs removes the animation-timing gate so phase-driven content
// (including the rarity visual boosts) renders synchronously and
// deterministically, while still preserving the `onAnimationStart` callback
// PackOpenModal relies on to trigger the per-drop reveal sound.
vi.mock('framer-motion', () => {
  const passthrough = (tag: string) => React.forwardRef((props: any, ref: any) => {
    const { children, initial, animate, exit, transition, whileTap, onAnimationStart, ...rest } = props
    if (onAnimationStart) onAnimationStart()
    return React.createElement(tag, { ...rest, ref }, children)
  })
  return {
    motion: new Proxy({}, { get: (_target, tag: string) => passthrough(tag) }),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  }
})

import PackOpenModal from '../PackOpenModal'
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

  it('renders the pack burst visual boost for epico+ pack rarity', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina Epica', rarity: 'epico' }}
      drops={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByTestId('pack-burst-boost', {}, { timeout: 3000 })).toBeTruthy()
  })

  it('does not render the pack burst visual boost for sub-epico pack rarity', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'raro' }}
      drops={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByTestId('pack-burst-boost')).toBeNull()
  })

  it('renders the drop rarity burst for an epico+ drop once the reveal phase begins', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[
        { type: 'oggetto', ok: true, detail: { itemName: 'Reliquia', rarity: 'epico' } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('Reliquia', {}, { timeout: 3000 })
    expect(screen.getByTestId('drop-rarity-burst')).toBeTruthy()
  })

  it('does not render the drop rarity burst for a sub-epico drop', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[
        { type: 'oggetto', ok: true, detail: { itemName: 'Erba', rarity: 'raro' } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('Erba', {}, { timeout: 3000 })
    expect(screen.queryByTestId('drop-rarity-burst')).toBeNull()
  })
})
