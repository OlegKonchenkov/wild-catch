import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LevelUpModal from '../LevelUpModal'

afterEach(cleanup)

describe('<LevelUpModal>', () => {
  it('renders nothing when info is null', () => {
    const { container } = render(<LevelUpModal info={null} onDismiss={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('renders the new level + LIVELLO label', () => {
    render(<LevelUpModal info={{ newLevel: 5, goldReward: 100 }} onDismiss={() => {}} />)
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('Livello')).toBeTruthy()
  })

  it('shows gold reward when > 0', () => {
    render(<LevelUpModal info={{ newLevel: 3, goldReward: 50 }} onDismiss={() => {}} />)
    expect(screen.getByText('+50')).toBeTruthy()
  })

  it('omits gold row when goldReward is 0', () => {
    render(<LevelUpModal info={{ newLevel: 2, goldReward: 0 }} onDismiss={() => {}} />)
    expect(screen.queryByText(/\+0/)).toBeFalsy()
  })

  it('calls onDismiss on click', () => {
    const onDismiss = vi.fn()
    const { container } = render(<LevelUpModal info={{ newLevel: 2, goldReward: 0 }} onDismiss={onDismiss} />)
    // Click on the outer modal backdrop (the motion.div with onClick)
    const backdrop = container.querySelector('.fixed') as HTMLElement
    fireEvent.click(backdrop)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
