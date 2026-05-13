import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useWakeLock } from '../useWakeLock'

// Helpers to build a fresh mock sentinel / wakeLock per test
function makeSentinel() {
  return {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
  }
}

function makeWakeLock(sentinel: ReturnType<typeof makeSentinel>) {
  return { request: vi.fn().mockResolvedValue(sentinel) }
}

let sentinel: ReturnType<typeof makeSentinel>
let mockWakeLock: ReturnType<typeof makeWakeLock>

beforeEach(() => {
  sentinel = makeSentinel()
  mockWakeLock = makeWakeLock(sentinel)
  vi.stubGlobal('navigator', { wakeLock: mockWakeLock })
})

afterEach(() => {
  // Cleanup components before removing the global stub so the hook's
  // async release() can still resolve without hitting undefined navigator.
  cleanup()
  vi.unstubAllGlobals()
})

describe('useWakeLock', () => {
  it('requests a screen wake lock on mount when enabled', async () => {
    renderHook(() => useWakeLock(true))
    // Flush the async acquire() promise
    await act(async () => {})
    expect(mockWakeLock.request).toHaveBeenCalledWith('screen')
  })

  it('releases the sentinel on unmount', async () => {
    const { unmount } = renderHook(() => useWakeLock(true))
    await act(async () => {}) // wait for acquire
    unmount()
    await act(async () => {}) // wait for async release
    expect(sentinel.release).toHaveBeenCalled()
  })

  it('does not request a lock when enabled=false', async () => {
    renderHook(() => useWakeLock(false))
    await act(async () => {})
    expect(mockWakeLock.request).not.toHaveBeenCalled()
  })

  it('is a silent no-op when the Wake Lock API is missing', async () => {
    vi.stubGlobal('navigator', {}) // no .wakeLock
    // Should not throw
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
    await act(async () => {})
  })

  it('re-acquires the lock on visibilitychange to visible after OS releases it', async () => {
    // Capture the 'release' event listener that the hook registers on the sentinel
    let releaseCb: (() => void) | null = null
    sentinel.addEventListener.mockImplementation((event: string, cb: () => void) => {
      if (event === 'release') releaseCb = cb
    })

    renderHook(() => useWakeLock(true))
    await act(async () => {}) // first acquire

    expect(mockWakeLock.request).toHaveBeenCalledTimes(1)

    // Simulate the OS revoking the sentinel (fires the 'release' listener)
    act(() => { releaseCb?.() })

    // jsdom defaults visibilityState to 'visible', so dispatching the event
    // should trigger the onVisible handler which calls acquire() again.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {}) // flush second acquire

    expect(mockWakeLock.request).toHaveBeenCalledTimes(2)
  })
})
