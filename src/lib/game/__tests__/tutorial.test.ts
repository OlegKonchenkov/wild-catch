import { describe, it, expect } from 'vitest'
import {
  TUTORIAL_SESSION_ID,
  TUTORIAL_QR_CODES,
  TUTORIAL_ITEMS,
  isTutorialQrTarget,
  tutorialQrButtonLabel,
  TUTORIAL_USER_SESSION_TABLES,
  TUTORIAL_ENIGMA_ID,
  TUTORIAL_FRAMMENTI,
  TUTORIAL_SUGGERIMENTO_ID,
  TUTORIAL_BONUS_SUGGERIMENTO_ID,
  TUTORIAL_MISSION_FRAMMENTO_GRANTS,
  TUTORIAL_PIN_OFFSET_M,
  TUTORIAL_PIN_CLAIM_RADIUS_M,
  tutorialPinBearingForUser,
  offsetGpsPoint,
} from '@/lib/game/tutorial'

describe('tutorial constants', () => {
  it('exposes a stable session UUID matching migration 030', () => {
    expect(TUTORIAL_SESSION_ID).toBe('7470a101-d41d-0500-0000-000000000001')
  })

  it('TUTORIAL_QR_CODES has manual codes ≤ 6 chars (qr_codes_manual_code_length check)', () => {
    expect(TUTORIAL_QR_CODES.item.length).toBeLessThanOrEqual(6)
    expect(TUTORIAL_QR_CODES.boss.length).toBeLessThanOrEqual(6)
    expect(TUTORIAL_QR_CODES.item).not.toBe(TUTORIAL_QR_CODES.boss)
  })

  it('TUTORIAL_ITEMS exposes both the esca + rete IDs as distinct UUIDs', () => {
    expect(TUTORIAL_ITEMS.esca).toMatch(/^[0-9a-f-]+$/i)
    expect(TUTORIAL_ITEMS.rete).toMatch(/^[0-9a-f-]+$/i)
    expect(TUTORIAL_ITEMS.esca).not.toBe(TUTORIAL_ITEMS.rete)
  })

  it('reset wipe list covers all per-user gameplay tables', () => {
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_creatures')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_inventory')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_eggs')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_missions')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('encounters')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('boss_fights')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('qr_scan_log')
  })

  it('reset wipe list includes the new enigma per-player tables', () => {
    // Added by migration 032 — must be wiped on tutorial replay so a player
    // who already solved gets a fresh enigma flow on reset.
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_enigmi')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_enigma_frammenti')
    expect(TUTORIAL_USER_SESSION_TABLES).toContain('player_enigma_suggerimenti')
  })
})

describe('tutorial enigma constants', () => {
  it('exposes the seed UUID matching migration 032', () => {
    expect(TUTORIAL_ENIGMA_ID).toBe('7470a4e1-d41d-0500-0000-000000000501')
  })

  it('TUTORIAL_FRAMMENTI has two distinct UUIDs', () => {
    expect(TUTORIAL_FRAMMENTI.respiro).toMatch(/^[0-9a-f-]+$/i)
    expect(TUTORIAL_FRAMMENTI.eco).toMatch(/^[0-9a-f-]+$/i)
    expect(TUTORIAL_FRAMMENTI.respiro).not.toBe(TUTORIAL_FRAMMENTI.eco)
  })

  it('TUTORIAL_SUGGERIMENTO_ID is a valid UUID', () => {
    expect(TUTORIAL_SUGGERIMENTO_ID).toMatch(/^[0-9a-f-]+$/i)
  })

  it('mission→frammento grant map covers the first catch (M2) and boss QR (M5)', () => {
    expect(TUTORIAL_MISSION_FRAMMENTO_GRANTS['7470a311-d41d-0500-0000-000000000402'])
      .toBe(TUTORIAL_FRAMMENTI.respiro)
    expect(TUTORIAL_MISSION_FRAMMENTO_GRANTS['7470a311-d41d-0500-0000-000000000405'])
      .toBe(TUTORIAL_FRAMMENTI.eco)
  })

  it('does not grant a frammento for unrelated mission ids', () => {
    expect(TUTORIAL_MISSION_FRAMMENTO_GRANTS['some-other-uuid']).toBeUndefined()
  })

  it('TUTORIAL_BONUS_SUGGERIMENTO_ID is a distinct UUID from the free one', () => {
    expect(TUTORIAL_BONUS_SUGGERIMENTO_ID).toMatch(/^[0-9a-f-]+$/i)
    expect(TUTORIAL_BONUS_SUGGERIMENTO_ID).not.toBe(TUTORIAL_SUGGERIMENTO_ID)
  })
})

describe('tutorial bonus pin geometry', () => {
  it('offset / claim-radius constants make sense (pin reachable by walking)', () => {
    expect(TUTORIAL_PIN_OFFSET_M).toBeGreaterThan(TUTORIAL_PIN_CLAIM_RADIUS_M)
    expect(TUTORIAL_PIN_OFFSET_M).toBeLessThanOrEqual(80) // not a marathon
    expect(TUTORIAL_PIN_CLAIM_RADIUS_M).toBeGreaterThan(10) // larger than typical GPS jitter
  })

  it('tutorialPinBearingForUser is deterministic for the same uid', () => {
    const a = tutorialPinBearingForUser('00000000-0000-0000-0000-000000000001')
    const b = tutorialPinBearingForUser('00000000-0000-0000-0000-000000000001')
    expect(a).toBe(b)
  })

  it('tutorialPinBearingForUser distributes across [0, 360)', () => {
    const a = tutorialPinBearingForUser('00000000-0000-0000-0000-000000000001')
    const b = tutorialPinBearingForUser('00000000-0000-0000-0000-000000000002')
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(360)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
    // Different uids should very likely produce different bearings; both
    // bearings being identical here would be a regression of the hash.
    expect(a).not.toBe(b)
  })

  it('offsetGpsPoint places the destination ~distance metres away', () => {
    const anchor = { lat: 45.0, lng: 9.0 }
    const dst = offsetGpsPoint(anchor, 0, 40) // due north
    // 40 m north ≈ +0.00036 deg lat (= 40 / 111111)
    expect(dst.lat - anchor.lat).toBeCloseTo(40 / 111111, 5)
    expect(dst.lng).toBeCloseTo(anchor.lng, 5)
  })

  it('offsetGpsPoint bearing 90° moves east, longitude grows', () => {
    const anchor = { lat: 45.0, lng: 9.0 }
    const dst = offsetGpsPoint(anchor, 90, 40)
    expect(dst.lat).toBeCloseTo(anchor.lat, 5)
    expect(dst.lng).toBeGreaterThan(anchor.lng)
  })
})

describe('isTutorialQrTarget', () => {
  it('recognises both tutorial QR manual codes', () => {
    expect(isTutorialQrTarget(TUTORIAL_QR_CODES.item)).toBe(true)
    expect(isTutorialQrTarget(TUTORIAL_QR_CODES.boss)).toBe(true)
  })

  it('rejects unrelated targets', () => {
    expect(isTutorialQrTarget('SOMETHING_ELSE')).toBe(false)
    expect(isTutorialQrTarget('')).toBe(false)
    expect(isTutorialQrTarget(null)).toBe(false)
    expect(isTutorialQrTarget(undefined)).toBe(false)
  })
})

describe('tutorialQrButtonLabel', () => {
  it('uses the boss-themed label for the boss QR target', () => {
    expect(tutorialQrButtonLabel(TUTORIAL_QR_CODES.boss)).toContain('Capo')
    expect(tutorialQrButtonLabel(TUTORIAL_QR_CODES.boss)).toContain('💀')
  })

  it('uses the generic-scan label for the item QR target', () => {
    const label = tutorialQrButtonLabel(TUTORIAL_QR_CODES.item)
    expect(label).toContain('Simula')
    expect(label).toContain('🪄')
  })

  it('falls back to the generic label for unknown / null targets', () => {
    expect(tutorialQrButtonLabel(null)).toContain('Simula')
    expect(tutorialQrButtonLabel('unknown')).toContain('Simula')
  })
})
