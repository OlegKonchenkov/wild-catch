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
    // Every element name appears in BOTH the element column AND as a matchup
    // in some other row's strong/weak column, so accept multiple matches.
    // Terra in particular MUST appear more than once — it was previously
    // blank ("—" in both columns), the bug Marco caught. Its own row plus
    // Adriatico's weakness and Bosco's strength now reference it.
    expect(screen.getAllByText('Fiamma').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Adriatico').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bosco').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Terra').length).toBeGreaterThan(1)
    expect(screen.getAllByText(/Armonia/i).length).toBeGreaterThan(0)
    // The blank-cell placeholder from the old hard-coded table is gone.
    expect(screen.queryByText('—')).toBeNull()
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
