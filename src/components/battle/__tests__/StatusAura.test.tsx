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

  it('renders ⚡ sparks for paralisi', () => {
    const { container } = render(<StatusAura status="paralisi" />)
    expect(container.textContent).toContain('⚡')
  })

  it('renders 💫 stars for confusione', () => {
    const { container } = render(<StatusAura status="confusione" />)
    expect(container.textContent).toContain('💫')
  })

  it('renders Z letters for sonno', () => {
    const { container } = render(<StatusAura status="sonno" />)
    expect(container.textContent).toContain('Z')
  })

  it('renders bubbles for veleno (no emoji — DOM-only)', () => {
    const { container } = render(<StatusAura status="veleno" />)
    // veleno uses bubble divs, no text → just check render did emit
    // something (the absolute-positioned wrapper).
    expect(container.querySelector('.absolute')).toBeTruthy()
  })

  it('respects the size prop (scales positions)', () => {
    // Just smoke-test: no crash with different sizes.
    const { container: small } = render(<StatusAura status="paralisi" size={60} />)
    expect(small.textContent).toContain('⚡')
    cleanup()
    const { container: big } = render(<StatusAura status="paralisi" size={240} />)
    expect(big.textContent).toContain('⚡')
  })
})
