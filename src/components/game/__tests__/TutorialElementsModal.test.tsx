import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import TutorialElementsModal from '../TutorialElementsModal'

afterEach(cleanup)

describe('<TutorialElementsModal>', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(<TutorialElementsModal open={false} onClose={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('renders title + element table when open=true', () => {
    render(<TutorialElementsModal open={true} onClose={() => {}} />)
    expect(screen.getByText(/Elementi e duello/)).toBeTruthy()
    // Element names appear in BOTH the element column AND the
    // "strong/weak" columns, so accept multiple matches.
    expect(screen.getAllByText('Fiamma').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Adriatico').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bosco').length).toBeGreaterThan(0)
    expect(screen.getByText('Terra')).toBeTruthy()
    expect(screen.getAllByText(/Armonia/i).length).toBeGreaterThan(0)
  })

  it('shows the boss-armonia hint copy in the body', () => {
    render(<TutorialElementsModal open={true} onClose={() => {}} />)
    expect(screen.getByText(/boss del tutorial è di tipo/i)).toBeTruthy()
  })

  it('calls onClose when CTA "Sono pronto" tapped', () => {
    const onClose = vi.fn()
    render(<TutorialElementsModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText(/Sono pronto/))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
