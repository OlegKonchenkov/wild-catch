import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useTweenedInteger from '../useTweenedInteger'

describe('useTweenedInteger', () => {
  let rafCb: FrameRequestCallback | null = null
  let nowMs = 0

  beforeEach(() => {
    nowMs = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => { rafCb = null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    rafCb = null
  })

  function tickRaf(advanceMs: number) {
    nowMs += advanceMs
    if (rafCb) {
      const cb = rafCb
      rafCb = null
      act(() => cb(nowMs))
    }
  }

  it('snaps to initial value on first render without animating', () => {
    const { result } = renderHook(() => useTweenedInteger(42))
    expect(result.current).toBe(42)
  })

  it('animates from previous value to new target over the configured duration', () => {
    const { result, rerender } = renderHook(({ target }) => useTweenedInteger(target, 1000), {
      initialProps: { target: 100 },
    })
    expect(result.current).toBe(100)

    rerender({ target: 200 })
    // First tick: ~0 ms in, eased ~ 0
    tickRaf(0)
    expect(result.current).toBeGreaterThanOrEqual(100)

    // Halfway through (500/1000), ease-out cubic is roughly 0.875
    tickRaf(500)
    expect(result.current).toBeGreaterThan(150)
    expect(result.current).toBeLessThan(200)

    // Past the end, should snap to target
    tickRaf(600)
    expect(result.current).toBe(200)
  })

  it('redirects to a new target if it changes mid-tween (no backwards glitch)', () => {
    const { result, rerender } = renderHook(({ target }) => useTweenedInteger(target, 1000), {
      initialProps: { target: 0 },
    })

    rerender({ target: 100 })
    tickRaf(0)
    tickRaf(300) // ~30% in
    const partway = result.current
    expect(partway).toBeGreaterThan(0)
    expect(partway).toBeLessThan(100)

    // New, larger target during the in-flight tween
    rerender({ target: 200 })
    tickRaf(0)
    // The animation should now be heading toward 200 from `partway`,
    // not jump back to 0.
    expect(result.current).toBeGreaterThanOrEqual(partway)

    // Drive to completion
    tickRaf(1100)
    expect(result.current).toBe(200)
  })

  it('handles decreasing targets (reconciliation pulling counter down)', () => {
    const { result, rerender } = renderHook(({ target }) => useTweenedInteger(target, 500), {
      initialProps: { target: 150 },
    })
    expect(result.current).toBe(150)

    rerender({ target: 120 })
    tickRaf(0)
    tickRaf(600)
    expect(result.current).toBe(120)
  })
})
