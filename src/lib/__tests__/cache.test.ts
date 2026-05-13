import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { swr, invalidate } from '@/lib/cache'

class MockStorage {
  private store: Record<string, string> = {}
  getItem(key: string) { return this.store[key] ?? null }
  setItem(key: string, value: string) { this.store[key] = value }
  removeItem(key: string) { delete this.store[key] }
  clear() { this.store = {} }
}

let storage: MockStorage

beforeEach(() => {
  storage = new MockStorage()
  vi.stubGlobal('localStorage', storage)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('swr', () => {
  it('cache miss — cached is null and loader is called once', async () => {
    const loader = vi.fn().mockResolvedValue('fresh-data')
    const result = swr('k', 5000, loader)
    expect(result.cached).toBeNull()
    await expect(result.fresh).resolves.toBe('fresh-data')
    expect(loader).toHaveBeenCalledOnce()
  })

  it('fresh hit — cached returns stored value and loader is NOT called', async () => {
    const seed = vi.fn().mockResolvedValue('v1')
    await swr('k', 5000, seed).fresh

    const loader = vi.fn().mockResolvedValue('v2')
    const result = swr('k', 5000, loader)
    expect(result.cached).toBe('v1')
    await result.fresh
    expect(loader).not.toHaveBeenCalled()
  })

  it('stale hit — cached returns stale data, fresh re-fetches', async () => {
    const seed = vi.fn().mockResolvedValue('old')
    await swr('k', 1000, seed).fresh

    vi.advanceTimersByTime(2000)

    const loader = vi.fn().mockResolvedValue('new')
    const result = swr('k', 1000, loader)
    expect(result.cached).toBe('old')
    await expect(result.fresh).resolves.toBe('new')
    expect(loader).toHaveBeenCalledOnce()
  })

  it('loader throws on stale revalidation — falls back to stale data', async () => {
    const seed = vi.fn().mockResolvedValue('fallback')
    await swr('k', 1000, seed).fresh
    vi.advanceTimersByTime(2000)

    const failingLoader = vi.fn().mockRejectedValue(new Error('network'))
    await expect(swr('k', 1000, failingLoader).fresh).resolves.toBe('fallback')
  })

  it('loader throws on cache miss — propagates the error', async () => {
    const failingLoader = vi.fn().mockRejectedValue(new Error('network'))
    await expect(swr('k', 5000, failingLoader).fresh).rejects.toThrow('network')
  })

  it('corrupt localStorage entry — treated as cache miss, loader is called', async () => {
    storage.setItem('wc:cache:k', 'not{valid json')
    const loader = vi.fn().mockResolvedValue('data')
    const result = swr('k', 5000, loader)
    expect(result.cached).toBeNull()
    await result.fresh
    expect(loader).toHaveBeenCalledOnce()
  })

  it('entry with wrong version is treated as cache miss', async () => {
    storage.setItem('wc:cache:k', JSON.stringify({ v: 999, ts: Date.now(), data: 'stale' }))
    const loader = vi.fn().mockResolvedValue('fresh')
    const result = swr('k', 5000, loader)
    expect(result.cached).toBeNull()
    await result.fresh
    expect(loader).toHaveBeenCalledOnce()
  })
})

describe('invalidate', () => {
  it('removes the entry so the next swr call is a miss', async () => {
    await swr('k', 5000, vi.fn().mockResolvedValue('v1')).fresh

    invalidate('k')

    const loader = vi.fn().mockResolvedValue('v2')
    const result = swr('k', 5000, loader)
    expect(result.cached).toBeNull()
    await result.fresh
    expect(loader).toHaveBeenCalledOnce()
  })

  it('is a no-op when the key does not exist', () => {
    expect(() => invalidate('non-existent')).not.toThrow()
  })
})
