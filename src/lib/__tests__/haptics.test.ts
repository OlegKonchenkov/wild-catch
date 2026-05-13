import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { haptics } from '@/lib/haptics'

type Pattern = number | number[]

describe('haptics', () => {
  let vibrateMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vibrateMock = vi.fn()
    vi.stubGlobal('navigator', { vibrate: vibrateMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tap calls vibrate with 15', () => {
    haptics.tap()
    expect(vibrateMock).toHaveBeenCalledWith(15)
  })

  it('selection calls vibrate with double-tick pattern', () => {
    haptics.selection()
    expect(vibrateMock).toHaveBeenCalledWith([8, 25, 8])
  })

  it('encounter calls vibrate with crescendo pattern', () => {
    haptics.encounter()
    expect(vibrateMock).toHaveBeenCalledWith([40, 30, 60])
  })

  it('catchSuccess calls vibrate with celebratory triple pulse', () => {
    haptics.catchSuccess()
    expect(vibrateMock).toHaveBeenCalledWith([30, 40, 30, 40, 80])
  })

  it('catchFail calls vibrate with warning pair', () => {
    haptics.catchFail()
    expect(vibrateMock).toHaveBeenCalledWith([60, 60, 60])
  })

  it('levelUp calls vibrate with strong long pulse', () => {
    haptics.levelUp()
    expect(vibrateMock).toHaveBeenCalledWith([20, 40, 80, 40, 120])
  })

  it('missionDone calls vibrate with happy double-tap', () => {
    haptics.missionDone()
    expect(vibrateMock).toHaveBeenCalledWith([25, 40, 25])
  })

  it('victory calls vibrate with boss victory pattern', () => {
    haptics.victory()
    expect(vibrateMock).toHaveBeenCalledWith([60, 60, 60, 60, 200])
  })

  it('defeat calls vibrate with single long pulse', () => {
    haptics.defeat()
    expect(vibrateMock).toHaveBeenCalledWith([200])
  })

  it('hatch calls vibrate with egg-hatch pattern', () => {
    haptics.hatch()
    expect(vibrateMock).toHaveBeenCalledWith([20, 30, 20, 30, 90])
  })

  describe('silent no-op cases', () => {
    it('does not throw when navigator.vibrate is missing', () => {
      vi.stubGlobal('navigator', {})
      expect(() => haptics.tap()).not.toThrow()
      expect(vibrateMock).not.toHaveBeenCalled()
    })

    it('does not throw when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined)
      const patterns: Array<() => void> = [haptics.tap, haptics.selection, haptics.encounter]
      for (const fn of patterns) {
        expect(() => fn()).not.toThrow()
      }
    })
  })
})
