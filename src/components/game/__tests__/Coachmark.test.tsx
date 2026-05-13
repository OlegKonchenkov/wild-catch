import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Coachmark, { type CoachmarkStep } from '../Coachmark'

// ResizeObserver isn't part of JSDOM; provide a no-op stub.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

function makeStep(key: string, title = `Title ${key}`, body = `Body ${key}`): CoachmarkStep {
  return { key, title, body }
}

describe('<Coachmark>', () => {
  it('renders the first step with title + body + step counter', () => {
    const onClose = vi.fn()
    render(<Coachmark steps={[makeStep('a'), makeStep('b'), makeStep('c')]} onClose={onClose} />)
    expect(screen.getByText('Title a')).toBeTruthy()
    expect(screen.getByText('Body a')).toBeTruthy()
    expect(screen.getByText('1/3')).toBeTruthy()
  })

  it('advances to next step when "Continua" is clicked', async () => {
    const onClose = vi.fn()
    render(<Coachmark steps={[makeStep('a'), makeStep('b')]} onClose={onClose} />)
    fireEvent.click(screen.getByText(/Continua/))
    // findByText polls past framer-motion's exit transition.
    expect(await screen.findByText('Title b')).toBeTruthy()
    expect(screen.getByText('2/2')).toBeTruthy()
  })

  it('goes back with the "←" button when not on first step', async () => {
    const onClose = vi.fn()
    render(<Coachmark steps={[makeStep('a'), makeStep('b')]} onClose={onClose} />)
    fireEvent.click(screen.getByText(/Continua/))
    await screen.findByText('Title b')
    fireEvent.click(screen.getByText('←'))
    expect(await screen.findByText('Title a')).toBeTruthy()
  })

  it('calls onClose when "Fatto!" is clicked on the last step', () => {
    const onClose = vi.fn()
    render(<Coachmark steps={[makeStep('only')]} onClose={onClose} />)
    fireEvent.click(screen.getByText(/Fatto/))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose immediately when "Salta tutto" is clicked', () => {
    const onClose = vi.fn()
    render(<Coachmark steps={[makeStep('a'), makeStep('b'), makeStep('c')]} onClose={onClose} />)
    fireEvent.click(screen.getByText(/Salta tutto/))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('positions over a target element when [data-coachmark] is found in the DOM', () => {
    const target = document.createElement('div')
    target.setAttribute('data-coachmark', 'target-key')
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ x: 100, y: 200, width: 80, height: 40, top: 200, left: 100, bottom: 240, right: 180 }),
    })
    document.body.appendChild(target)
    try {
      const onClose = vi.fn()
      render(<Coachmark steps={[makeStep('target-key')]} onClose={onClose} />)
      const overlay = screen.getByTestId('coachmark-overlay')
      expect(overlay).toBeTruthy()
    } finally {
      document.body.removeChild(target)
    }
  })

  it('falls back to a centred tooltip when the target is not in the DOM', () => {
    const onClose = vi.fn()
    render(<Coachmark steps={[makeStep('does-not-exist')]} onClose={onClose} />)
    // The tooltip still renders, just without a spotlight cutout
    expect(screen.getByText('Title does-not-exist')).toBeTruthy()
  })

  it('calls scrollIntoView on a target that lies outside the viewport (offscreen nav item)', () => {
    const target = document.createElement('div')
    target.setAttribute('data-coachmark', 'offscreen-target')
    const scrollIntoView = vi.fn()
    Object.defineProperty(target, 'scrollIntoView', { value: scrollIntoView, configurable: true })
    // Place the target far to the right — JSDOM defaults innerWidth to 1024.
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ x: 2000, y: 500, width: 60, height: 30, top: 500, left: 2000, bottom: 530, right: 2060 }),
    })
    document.body.appendChild(target)
    try {
      const onClose = vi.fn()
      render(<Coachmark steps={[makeStep('offscreen-target')]} onClose={onClose} />)
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      // It should request smooth, nearest-block, center-inline scrolling.
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({
        behavior: 'smooth',
        inline: 'center',
      }))
    } finally {
      document.body.removeChild(target)
    }
  })

  it('does NOT call scrollIntoView when the target is already on-screen', () => {
    const target = document.createElement('div')
    target.setAttribute('data-coachmark', 'onscreen-target')
    const scrollIntoView = vi.fn()
    Object.defineProperty(target, 'scrollIntoView', { value: scrollIntoView, configurable: true })
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ x: 100, y: 200, width: 60, height: 30, top: 200, left: 100, bottom: 230, right: 160 }),
    })
    document.body.appendChild(target)
    try {
      const onClose = vi.fn()
      render(<Coachmark steps={[makeStep('onscreen-target')]} onClose={onClose} />)
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      document.body.removeChild(target)
    }
  })
})
