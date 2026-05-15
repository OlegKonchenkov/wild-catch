import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import FloatingDamage from '../FloatingDamage'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('<FloatingDamage>', () => {
  it('renders a damage number with the − prefix', () => {
    render(<FloatingDamage value={42} kind="damage" />)
    expect(screen.getByText('−42')).toBeTruthy()
  })

  it('renders a heal number with the + prefix', () => {
    render(<FloatingDamage value={30} kind="heal" />)
    expect(screen.getByText('+30')).toBeTruthy()
  })

  it('renders a crit with − prefix and absolute value', () => {
    render(<FloatingDamage value={-77} kind="crit" />)
    expect(screen.getByText('−77')).toBeTruthy()
  })

  it('renders "Miss" for kind=miss', () => {
    render(<FloatingDamage value={0} kind="miss" />)
    expect(screen.getByText('Miss')).toBeTruthy()
  })

  it('rounds non-integer values', () => {
    render(<FloatingDamage value={12.7} kind="damage" />)
    expect(screen.getByText('−13')).toBeTruthy()
  })

  it('calls onComplete after the animation finishes', async () => {
    const onComplete = vi.fn()
    render(<FloatingDamage value={10} kind="damage" onComplete={onComplete} />)
    // The component visible-window is ~950ms then exit animates ~220ms
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(onComplete).toHaveBeenCalled()
  })
})
