import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import TutorialMomentModal, { hasSeenTutorialMoment, clearTutorialMomentsSeen } from '../TutorialMomentModal'
import type { TutorialMoment } from '@/lib/game/tutorial'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

beforeEach(() => {
  clearTutorialMomentsSeen()
})
afterEach(cleanup)

const MOMENT: TutorialMoment = {
  key: 'first-catch',
  emoji: '🎉',
  title: 'Test title',
  body: 'Body line 1\nBody line 2',
}

const MOMENT_WITH_CTA: TutorialMoment = {
  ...MOMENT,
  key: 'with-cta',
  cta: { label: 'Vai alla home', route: '/home' },
}

const MOMENT_CELEBRATE: TutorialMoment = {
  ...MOMENT,
  key: 'celebrate',
  celebrate: true,
}

describe('<TutorialMomentModal>', () => {
  it('renders nothing when moment is null', () => {
    const { container } = render(<TutorialMomentModal moment={null} onClose={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('renders emoji + title + body (multi-line)', () => {
    render(<TutorialMomentModal moment={MOMENT} onClose={() => {}} />)
    expect(screen.getByText('🎉')).toBeTruthy()
    expect(screen.getByText('Test title')).toBeTruthy()
    // whitespace-pre-line preserves \n
    expect(screen.getByText(/Body line 1/)).toBeTruthy()
  })

  it('shows celebrate-only "Tutorial completato" label', () => {
    render(<TutorialMomentModal moment={MOMENT_CELEBRATE} onClose={() => {}} />)
    expect(screen.getByText(/Tutorial completato/i)).toBeTruthy()
  })

  it('default CTA label is "Continua" + clicking it closes', () => {
    const onClose = vi.fn()
    render(<TutorialMomentModal moment={MOMENT} onClose={onClose} />)
    fireEvent.click(screen.getByText('Continua'))
    expect(onClose).toHaveBeenCalledTimes(1)
    // Marked as seen after close
    expect(hasSeenTutorialMoment(MOMENT.key)).toBe(true)
  })

  it('renders CTA label from moment.cta when provided', () => {
    render(<TutorialMomentModal moment={MOMENT_WITH_CTA} onClose={() => {}} />)
    expect(screen.getByText('Vai alla home')).toBeTruthy()
  })

  it('CTA with route navigates and closes', () => {
    const onClose = vi.fn()
    render(<TutorialMomentModal moment={MOMENT_WITH_CTA} onClose={onClose} />)
    fireEvent.click(screen.getByText('Vai alla home'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(hasSeenTutorialMoment(MOMENT_WITH_CTA.key)).toBe(true)
  })

  it('"Resta sulla mappa" link closes without navigating (visible only with cta)', () => {
    const onClose = vi.fn()
    render(<TutorialMomentModal moment={MOMENT_WITH_CTA} onClose={onClose} />)
    fireEvent.click(screen.getByText('Resta sulla mappa'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('hasSeenTutorialMoment / clearTutorialMomentsSeen', () => {
  it('tracks seen state across calls', () => {
    expect(hasSeenTutorialMoment('foo')).toBe(false)
    // Render closes the moment which marks it seen
    const { unmount } = render(<TutorialMomentModal moment={{ ...MOMENT, key: 'foo' }} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Continua'))
    expect(hasSeenTutorialMoment('foo')).toBe(true)
    unmount()
    clearTutorialMomentsSeen()
    expect(hasSeenTutorialMoment('foo')).toBe(false)
  })
})
