import { describe, it, expect } from 'vitest'
import {
  TUTORIAL_SESSION_ID,
  TUTORIAL_QR_CODES,
  TUTORIAL_ITEMS,
  isTutorialQrTarget,
  tutorialQrButtonLabel,
  TUTORIAL_USER_SESSION_TABLES,
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
