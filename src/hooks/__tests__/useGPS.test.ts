import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useGPS } from '../useGPS'

// GeolocationPositionError is not always available in jsdom — stub the constants.
vi.stubGlobal('GeolocationPositionError', {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
})

const watchPositionMock = vi.fn()
const clearWatchMock = vi.fn()

function stubGeolocation() {
  vi.stubGlobal('navigator', {
    geolocation: {
      watchPosition: watchPositionMock,
      clearWatch: clearWatchMock,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubGeolocation()
})
afterEach(() => {
  // cleanup() must run before unstubAllGlobals so the hook's cleanup function
  // can still call navigator.geolocation.clearWatch without throwing.
  cleanup()
  vi.unstubAllGlobals()
  // Re-stub GeolocationPositionError after unstubAll so subsequent tests still work.
  vi.stubGlobal('GeolocationPositionError', {
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  })
})

const MOCK_POS = {
  coords: { latitude: 45.6495, longitude: 13.7768, accuracy: 5 },
  timestamp: 1_700_000_000_000,
}

describe('useGPS', () => {
  it('calls watchPosition on mount and clearWatch on unmount', () => {
    watchPositionMock.mockReturnValue(42)
    const { unmount } = renderHook(() => useGPS())
    expect(watchPositionMock).toHaveBeenCalledOnce()
    unmount()
    expect(clearWatchMock).toHaveBeenCalledWith(42)
  })

  it('sets error message on PERMISSION_DENIED', () => {
    watchPositionMock.mockImplementation((_success: unknown, errorCb: (e: { code: number }) => void) => {
      errorCb({ code: 1 }) // PERMISSION_DENIED
      return 99
    })
    const { result } = renderHook(() => useGPS())
    expect(result.current.error).toBe('Abilita il GPS per giocare')
    expect(result.current.position).toBeNull()
  })

  it('sets error message on POSITION_UNAVAILABLE', () => {
    watchPositionMock.mockImplementation((_success: unknown, errorCb: (e: { code: number }) => void) => {
      errorCb({ code: 2 }) // POSITION_UNAVAILABLE
      return 88
    })
    const { result } = renderHook(() => useGPS())
    expect(result.current.error).toBe('GPS non disponibile. Spostati in un luogo aperto')
  })

  it('updates position when GPS callback fires', () => {
    watchPositionMock.mockImplementation((successCb: (p: typeof MOCK_POS) => void) => {
      successCb(MOCK_POS)
      return 7
    })
    const { result } = renderHook(() => useGPS())
    expect(result.current.position?.lat).toBe(45.6495)
    expect(result.current.position?.lng).toBe(13.7768)
    expect(result.current.position?.accuracy).toBe(5)
    expect(result.current.error).toBeNull()
  })

  it('calls the onPosition callback with the mapped position', () => {
    const onPosition = vi.fn()
    watchPositionMock.mockImplementation((successCb: (p: typeof MOCK_POS) => void) => {
      successCb(MOCK_POS)
      return 7
    })
    renderHook(() => useGPS(onPosition))
    expect(onPosition).toHaveBeenCalledOnce()
    expect(onPosition.mock.calls[0][0]).toMatchObject({ lat: 45.6495, lng: 13.7768 })
  })

  it('caches last position across remount', () => {
    // First mount — fires success callback → sets module-level cachedPosition
    watchPositionMock.mockImplementation((successCb: (p: typeof MOCK_POS) => void) => {
      successCb(MOCK_POS)
      return 7
    })
    const { result: r1, unmount } = renderHook(() => useGPS())
    expect(r1.current.position?.lat).toBe(45.6495)
    unmount()

    // Second mount — watchPosition hasn't fired yet but cachedPosition is set
    watchPositionMock.mockReturnValue(8) // returns watchId without firing callback
    const { result: r2 } = renderHook(() => useGPS())
    // Initial state should be the cached position, not null
    expect(r2.current.position?.lat).toBe(45.6495)
  })

  it('sets error when geolocation is not available', () => {
    vi.stubGlobal('navigator', {}) // no .geolocation
    const { result } = renderHook(() => useGPS())
    expect(result.current.error).toBe('GPS non disponibile su questo dispositivo')
  })
})
