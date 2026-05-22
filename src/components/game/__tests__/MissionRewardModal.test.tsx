import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MissionRewardModal from '../MissionRewardModal'

// Stub playMissionComplete + playFrammento so tests don't try to play audio
vi.mock('@/lib/game/sounds/events', () => ({
  playMissionComplete: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playFrammento: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('<MissionRewardModal>', () => {
  it('renders nothing when missions array is empty', () => {
    const { container } = render(<MissionRewardModal missions={[]} onDone={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('renders mission title + EXP + gold rewards', () => {
    const onDone = vi.fn()
    render(<MissionRewardModal
      missions={[{ title: 'Cattura prima', rewardGold: 100, rewardExp: 50 }]}
      onDone={onDone}
    />)
    expect(screen.getByText('Cattura prima')).toBeTruthy()
    expect(screen.getByText('EXP ricompensa')).toBeTruthy()
    expect(screen.getByText(/\+50/)).toBeTruthy()
    expect(screen.getByText(/100/)).toBeTruthy()
  })

  it('shows level-up row when levelUp present', () => {
    render(<MissionRewardModal
      missions={[{
        title: 'M1', rewardGold: 50, rewardExp: 25,
        levelUp: { newLevel: 3, goldReward: 100 },
      }]}
      onDone={() => {}}
    />)
    expect(screen.getByText('Lv. 3 ✦')).toBeTruthy()
  })

  it('shows frammento panel when tutorialFrammentoGranted is set', () => {
    render(<MissionRewardModal
      missions={[{
        title: 'Tutorial M2', rewardGold: 50, rewardExp: 25,
        tutorialFrammentoGranted: { frammentoId: 'fr-1', title: 'Frammento del Respiro' },
      }]}
      onDone={() => {}}
    />)
    expect(screen.getByText('Frammento del Respiro')).toBeTruthy()
    expect(screen.getByText(/Frammento d.+enigma sbloccato/i)).toBeTruthy()
  })

  it('advances to next mission when CTA clicked + calls onDone on last', () => {
    const onDone = vi.fn()
    render(<MissionRewardModal
      missions={[
        { title: 'M1', rewardGold: 10, rewardExp: 5 },
        { title: 'M2', rewardGold: 20, rewardExp: 10 },
      ]}
      onDone={onDone}
    />)
    // First mission visible
    expect(screen.getByText('M1')).toBeTruthy()
    // CTA = "Prossima ricompensa"
    fireEvent.click(screen.getByText('Prossima ricompensa'))
    expect(screen.getByText('M2')).toBeTruthy()
    // Now CTA = "Continua" and clicking it fires onDone
    fireEvent.click(screen.getByText('Continua'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('shows "Prossima ricompensa" CTA when more than one mission is queued', () => {
    render(<MissionRewardModal
      missions={[
        { title: 'M1', rewardGold: 0, rewardExp: 0 },
        { title: 'M2', rewardGold: 0, rewardExp: 0 },
      ]}
      onDone={() => {}}
    />)
    expect(screen.getByText('Prossima ricompensa')).toBeTruthy()
  })
})
