import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/game/sounds/pack-open', () => ({
  playChestUnlock: vi.fn(),
  playDropReveal: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playUiTap: vi.fn(),
}))

// framer-motion's real exit/enter animations rely on the Web Animations API,
// which JSDOM doesn't implement — so `AnimatePresence mode="wait"` never
// resolves the locked→unlocking exit transition in tests, and the transient
// "unlocking" phase content is never observably committed to the DOM before
// the 900ms reveal timeout fires. Mocking motion.* / AnimatePresence as inert
// passthroughs removes the animation-timing gate so phase-driven content
// (including the rarity visual boosts) renders synchronously and
// deterministically, while still preserving the `onAnimationStart` callback
// ChestOpenModal relies on to trigger the per-drop reveal sound.
//
// This mock is intentionally scoped to this file only — it is not a
// general-purpose replacement for testing framer-motion components (see
// Coachmark.test.tsx for the alternative: real timing + findByText polling,
// which the original 3 ChestOpenModal tests in ChestOpenModal.test.tsx also
// use). Note it also strips `transition.delay`, so `onAnimationStart` fires
// immediately/synchronously here rather than staggered by the real per-drop
// animation delay (`0.15 + i * 0.14`) — a real behavioral difference from
// production that only matters if a future test here needs to assert on
// reveal *ordering* across multiple drops.
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

import ChestOpenModal from '../ChestOpenModal'

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('<ChestOpenModal> rarity visual boosts', () => {
  it('renders the chest unlock visual boost for epico+ chest rarity', async () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere Epico', rarity: 'epico' }}
      contents={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByTestId('chest-unlock-boost', {}, { timeout: 3000 })).toBeTruthy()
  })

  it('does not render the chest unlock visual boost for sub-epico chest rarity', async () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'raro' }}
      contents={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByTestId('chest-unlock-boost')).toBeNull()
  })

  it('renders the drop rarity burst for an epico+ content item once the reveal phase begins', async () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'comune' }}
      contents={[
        { type: 'creatura', ok: true, detail: { creature: { name: 'Drago', rarity: 'epico' } } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('Drago', {}, { timeout: 3000 })
    expect(screen.getByTestId('drop-rarity-burst')).toBeTruthy()
  })

  it('does not render the drop rarity burst for a sub-epico content item', async () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'comune' }}
      contents={[
        { type: 'creatura', ok: true, detail: { creature: { name: 'Volpe', rarity: 'raro' } } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('Volpe', {}, { timeout: 3000 })
    expect(screen.queryByTestId('drop-rarity-burst')).toBeNull()
  })
})
