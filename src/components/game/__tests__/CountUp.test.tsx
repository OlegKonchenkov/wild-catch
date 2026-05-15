import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import CountUp from '../CountUp'

afterEach(cleanup)

describe('<CountUp>', () => {
  it('renders the initial value via the formatter on first render', () => {
    render(<CountUp value={1234} formatter={n => `${n}€`} />)
    // First render snaps to the value (no animation from 0)
    expect(screen.getByText('1234€')).toBeTruthy()
  })

  it('uses the formatter prop', () => {
    render(<CountUp value={500} formatter={n => `${n} pt`} />)
    expect(screen.getByText('500 pt')).toBeTruthy()
  })

  it('defaults to plain String formatter', () => {
    render(<CountUp value={42} />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('renders zero', () => {
    render(<CountUp value={0} />)
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('applies className + style props', () => {
    const { container } = render(<CountUp value={1} className="big" style={{ color: 'red' }} />)
    const span = container.querySelector('span.big') as HTMLElement
    expect(span).toBeTruthy()
    expect(span.style.color).toBe('red')
  })
})
