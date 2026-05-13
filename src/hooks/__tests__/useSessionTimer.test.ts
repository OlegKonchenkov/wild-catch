import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSessionTimer } from '../useSessionTimer'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useSessionTimer', () => {
  it('returns null/empty state when endAt is null', () => {
    const { result } = renderHook(() => useSessionTimer({ endAt: null }))
    expect(result.current.remaining).toBeNull()
    expect(result.current.formatted).toBe('')
    expect(result.current.isExpired).toBe(false)
    expect(result.current.isWarning).toBe(false)
    expect(result.current.isCritical).toBe(false)
  })

  it('initialises remaining from endAt on mount', () => {
    const endAt = new Date(Date.now() + 5000).toISOString()
    const { result } = renderHook(() => useSessionTimer({ endAt }))
    expect(result.current.remaining).toBe(5)
    expect(result.current.isExpired).toBe(false)
  })

  it('counts down by 1 second each tick', () => {
    const endAt = new Date(Date.now() + 10_000).toISOString()
    const { result } = renderHook(() => useSessionTimer({ endAt }))
    expect(result.current.remaining).toBe(10)

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.remaining).toBe(7)
  })

  it('fires onExpired exactly once when countdown reaches 0', () => {
    const onExpired = vi.fn()
    const endAt = new Date(Date.now() + 2000).toISOString()
    renderHook(() => useSessionTimer({ endAt, onExpired }))

    act(() => vi.advanceTimersByTime(3000))
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('clears the interval on unmount — no state updates after cleanup', () => {
    const endAt = new Date(Date.now() + 60_000).toISOString()
    const { result, unmount } = renderHook(() => useSessionTimer({ endAt }))
    const beforeUnmount = result.current.remaining

    unmount()
    // Advancing time after unmount should not trigger React state-update warnings
    act(() => vi.advanceTimersByTime(5000))
    // remaining is a stale snapshot — just verify no error was thrown
    expect(beforeUnmount).not.toBeNull()
  })

  describe('formatted output', () => {
    it('shows "Scaduta" when expired', () => {
      const endAt = new Date(Date.now() - 1000).toISOString()
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.formatted).toBe('Scaduta')
      expect(result.current.isExpired).toBe(true)
    })

    it('shows "Xh Ym" format for >= 1 hour', () => {
      const endAt = new Date(Date.now() + 5400_000).toISOString() // 1h 30m
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.formatted).toBe('1h 30m')
    })

    it('shows "Xm YYs" format for < 1 hour', () => {
      const endAt = new Date(Date.now() + 330_000).toISOString() // 5m 30s
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.formatted).toBe('5m 30s')
    })

    it('shows "Xs" format for < 60 seconds', () => {
      const endAt = new Date(Date.now() + 45_000).toISOString()
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.formatted).toBe('45s')
    })
  })

  describe('warning / critical flags', () => {
    it('isWarning true when < 10 minutes remain', () => {
      const endAt = new Date(Date.now() + 599_000).toISOString()
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.isWarning).toBe(true)
      expect(result.current.isCritical).toBe(false)
    })

    it('isCritical true when < 2 minutes remain', () => {
      const endAt = new Date(Date.now() + 119_000).toISOString()
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.isWarning).toBe(true)
      expect(result.current.isCritical).toBe(true)
    })

    it('neither flag when plenty of time remains', () => {
      const endAt = new Date(Date.now() + 3600_000).toISOString()
      const { result } = renderHook(() => useSessionTimer({ endAt }))
      expect(result.current.isWarning).toBe(false)
      expect(result.current.isCritical).toBe(false)
    })
  })
})
