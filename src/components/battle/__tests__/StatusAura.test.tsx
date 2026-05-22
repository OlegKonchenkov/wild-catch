import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import StatusAura from '../StatusAura'

afterEach(cleanup)

describe('<StatusAura>', () => {
  it('renders nothing when status is null', () => {
    const { container } = render(<StatusAura status={null} />)
    expect(container.textContent).toBe('')
  })

  it('renders nothing when status is undefined', () => {
    const { container } = render(<StatusAura status={undefined} />)
    expect(container.textContent).toBe('')
  })

  it('renders premium paralysis particles', () => {
    const { container } = render(<StatusAura status="paralisi" />)
    expect(container.querySelector('[data-status-aura="paralisi"]')).toBeTruthy()
    expect(container.querySelectorAll('.absolute').length).toBeGreaterThanOrEqual(4)
  })

  it('renders premium confusion particles', () => {
    const { container } = render(<StatusAura status="confusione" />)
    expect(container.querySelector('[data-status-aura="confusione"]')).toBeTruthy()
    expect(container.querySelectorAll('.absolute').length).toBeGreaterThanOrEqual(5)
  })

  it('renders Z letters for sleep', () => {
    const { container } = render(<StatusAura status="sonno" />)
    expect(container.querySelector('[data-status-aura="sonno"]')).toBeTruthy()
    expect(container.textContent).toContain('Z')
  })

  it('renders poison mist and bubbles', () => {
    const { container } = render(<StatusAura status="veleno" />)
    expect(container.querySelector('[data-status-aura="veleno"]')).toBeTruthy()
    expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(4)
  })

  it('respects the size prop without crashing', () => {
    const { container: small } = render(<StatusAura status="paralisi" size={60} />)
    expect(small.querySelector('[data-status-aura="paralisi"]')).toBeTruthy()
    cleanup()
    const { container: big } = render(<StatusAura status="paralisi" size={240} />)
    expect(big.querySelector('[data-status-aura="paralisi"]')).toBeTruthy()
  })
})
