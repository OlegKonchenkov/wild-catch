import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import TutorialEncounterLesson from '../TutorialEncounterLesson'

afterEach(cleanup)

describe('<TutorialEncounterLesson>', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(<TutorialEncounterLesson open={false} onClose={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('opens on slide 1 — HP bar + difficulty stars copy', () => {
    render(<TutorialEncounterLesson open={true} onClose={() => {}} />)
    expect(screen.getByText(/Hai trovato un Daimon/i)).toBeTruthy()
    expect(screen.getByText(/Stelline di difficolt/i)).toBeTruthy()
  })

  it('advances slide on "Avanti" click', () => {
    render(<TutorialEncounterLesson open={true} onClose={() => {}} />)
    // Slide 1 is showing
    expect(screen.getByText(/Hai trovato un Daimon/i)).toBeTruthy()
    fireEvent.click(screen.getByText('Avanti'))
    // Slide 2 — action buttons
    expect(screen.getByText(/Le tue azioni/i)).toBeTruthy()
  })

  it('shows "Iniziamo!" CTA on last slide and calls onClose', () => {
    const onClose = vi.fn()
    render(<TutorialEncounterLesson open={true} onClose={onClose} />)
    // 4 slides — click Avanti 3 times to reach last
    fireEvent.click(screen.getByText('Avanti'))
    fireEvent.click(screen.getByText('Avanti'))
    fireEvent.click(screen.getByText('Avanti'))
    expect(screen.getByText('Iniziamo!')).toBeTruthy()
    fireEvent.click(screen.getByText('Iniziamo!'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Salta button closes from any slide', () => {
    const onClose = vi.fn()
    render(<TutorialEncounterLesson open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Salta'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
