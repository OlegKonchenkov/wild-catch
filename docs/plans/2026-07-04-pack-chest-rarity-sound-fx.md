# Suoni ed effetti per rarità su bustine e forzieri — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere suoni (sintetizzati via Web Audio API, nessun file audio esterno) e un boost visivo per rarità alte all'apertura di bustine (`PackOpenModal`) e forzieri (`ChestOpenModal`), che oggi sono completamente muti.

**Architecture:** Nuovo modulo `src/lib/game/sounds/pack-open.ts` che segue esattamente lo stile già presente in `src/lib/game/sounds/hatch.ts` (oscillatori Web Audio via `getSharedAC`/`getSoundStartTime`, suono scalato per rarità). `describeDrop()` in `loot-visuals.tsx` viene esteso per esporre la `rarity` di ogni drop, così sia il colore sia il suono/effetto extra leggono la stessa fonte. I punti di innesco sonoro nei modal usano il callback nativo `onAnimationStart` di Framer Motion per restare sincronizzati con lo stagger visivo già esistente, invece di `setTimeout` paralleli.

**Tech Stack:** Next.js (App Router), React, Framer Motion, Web Audio API, Vitest + Testing Library.

**Riferimento design:** `docs/plans/2026-07-04-pack-chest-rarity-sound-fx-design.md`

---

## Nota su TDD in questo plan

Il codice di sintesi Web Audio (`hatch.ts`, `events.ts`, `ui.ts`, ecc.) **non ha test diretti** in questo repo: costruisce grafi di nodi `AudioContext` senza un valore di ritorno osservabile, e mockare `AudioContext` non darebbe nessuna garanzia utile. La convenzione esistente (vedi `MissionRewardModal.test.tsx`) è testare i **componenti che chiamano** le funzioni sonore, con `vi.mock(...)` sul modulo sound e assert sulle chiamate. Questo plan segue la stessa convenzione: il modulo `pack-open.ts` (Task 2) viene scritto direttamente; i test arrivano nei task di integrazione (3, 4, 5) dove verificano che i componenti chiamino le funzioni giuste con gli argomenti giusti.

---

### Task 1: `rarity` nel LootView condiviso

**Files:**
- Modify: `src/components/game/loot-visuals.tsx`
- Test: `src/components/game/__tests__/loot-visuals.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { describeDrop } from '../loot-visuals'

describe('describeDrop', () => {
  it('exposes rarity for an oggetto drop', () => {
    const v = describeDrop('oggetto', { itemName: 'Erba curativa', rarity: 'raro' })
    expect(v.rarity).toBe('raro')
  })

  it('exposes rarity from eggRarity for an uovo drop', () => {
    const v = describeDrop('uovo', { eggRarity: 'epico' })
    expect(v.rarity).toBe('epico')
  })

  it('exposes rarity from the nested creature for a creatura drop', () => {
    const v = describeDrop('creatura', { creature: { name: 'Grifone', rarity: 'leggendario' } })
    expect(v.rarity).toBe('leggendario')
  })

  it('exposes rarity for personaggio and opera drops', () => {
    expect(describeDrop('personaggio', { name: 'Cesare', rarity: 'mitologico' }).rarity).toBe('mitologico')
    expect(describeDrop('opera', { name: 'Vaso', rarity: 'comune' }).rarity).toBe('comune')
  })

  it('leaves rarity undefined for drops without one (gold, exp, gemme...)', () => {
    expect(describeDrop('gold', { amount: 10 }).rarity).toBeUndefined()
    expect(describeDrop('exp', { amount: 5 }).rarity).toBeUndefined()
  })

  it('leaves rarity undefined when the raw rarity string is not a known Rarity value', () => {
    expect(describeDrop('oggetto', { itemName: 'X', rarity: 'sconosciuta' }).rarity).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/game/__tests__/loot-visuals.test.ts`
Expected: FAIL — `v.rarity` is `undefined` for the `raro`/`epico`/`leggendario`/`mitologico`/`comune` cases because `LootView` doesn't populate it yet (TS may also complain `rarity` doesn't exist on the type, depending on how the test accesses it — that's still an expected failure at this step).

**Step 3: Write minimal implementation**

Replace the whole file `src/components/game/loot-visuals.tsx` with:

```tsx
import type { IconType } from 'react-icons'
import {
  GiTwoCoins, GiCutDiamond, GiSwapBag, GiSpellBook, GiEggClutch, GiPawPrint,
  GiCardboardBox, GiLockedChest, GiTrophyCup, GiScrollUnfurled, GiGreekTemple,
  GiColumnVase, GiLaurelsTrophy, GiSparkles,
} from 'react-icons/gi'
import { RARITY_COLORS } from '@/lib/types'
import type { Rarity } from '@/lib/types'

export interface LootView {
  Icon: IconType
  accent: string
  title: string
  subtitle?: string
  imageUrl?: string | null
  rarity?: Rarity
}

/**
 * Presentation metadata for a single reward drop returned by the reward
 * dispenser. Shared by the pack- and chest-opening reveals so both surfaces
 * describe rewards identically. `rarity` (when present) is also the single
 * source used to scale the reveal sound/visual boost — see pack-open.ts.
 */
export function describeDrop(type: string, detail: Record<string, any> = {}): LootView {
  const asRarity = (r?: string): Rarity | undefined =>
    r && r in RARITY_COLORS ? (r as Rarity) : undefined
  const rarityAccent = (r?: string) => {
    const rarity = asRarity(r)
    return rarity ? RARITY_COLORS[rarity] : undefined
  }

  switch (type) {
    case 'gold':
      return { Icon: GiTwoCoins, accent: '#E8B54A', title: `${detail.amount ?? 0} Oro` }
    case 'gemme':
      return { Icon: GiCutDiamond, accent: '#4FD1C5', title: `${detail.amount ?? 0} Gemme` }
    case 'exp':
      return { Icon: GiSparkles, accent: '#A78BFA', title: `${detail.amount ?? 0} EXP` }
    case 'oggetto':
      return {
        Icon: GiSwapBag,
        accent: rarityAccent(detail.rarity) ?? '#9CA3AF',
        title: detail.itemName ?? 'Oggetto',
        subtitle: detail.quantity && detail.quantity > 1 ? `×${detail.quantity}` : undefined,
        rarity: asRarity(detail.rarity),
      }
    case 'abilita':
      return { Icon: GiSpellBook, accent: '#C084FC', title: detail.abilityName ?? 'Abilità', subtitle: 'Abilità speciale' }
    case 'uovo':
      return {
        Icon: GiEggClutch,
        accent: rarityAccent(detail.eggRarity) ?? '#C084FC',
        title: 'Uovo',
        subtitle: detail.eggRarity,
        rarity: asRarity(detail.eggRarity),
      }
    case 'creatura':
      return {
        Icon: GiPawPrint,
        accent: rarityAccent(detail.creature?.rarity) ?? '#7AB87A',
        title: detail.creature?.name ?? 'Creatura',
        subtitle: detail.creature?.rarity,
        imageUrl: detail.creature?.image_url ?? detail.creature?.sprite_url ?? null,
        rarity: asRarity(detail.creature?.rarity),
      }
    case 'bustina':
      return { Icon: GiCardboardBox, accent: '#F59E0B', title: detail.packName ?? 'Bustina', subtitle: 'Bustina bonus' }
    case 'forziere':
      return { Icon: GiLockedChest, accent: '#D97706', title: detail.chestName ?? 'Forziere', subtitle: 'Forziere' }
    case 'premio':
      return { Icon: GiTrophyCup, accent: '#FF4D6D', title: detail.prizeName ?? 'Premio speciale', subtitle: detail.code ? `Codice ${detail.code}` : 'Premio' }
    case 'personaggio':
      return {
        Icon: GiLaurelsTrophy,
        accent: rarityAccent(detail.rarity) ?? '#F59E0B',
        title: detail.name ?? 'Personaggio',
        subtitle: 'Personaggio culturale',
        imageUrl: detail.image_url,
        rarity: asRarity(detail.rarity),
      }
    case 'opera':
      return {
        Icon: GiColumnVase,
        accent: rarityAccent(detail.rarity) ?? '#38BDF8',
        title: detail.name ?? 'Opera',
        subtitle: 'Opera d’arte',
        imageUrl: detail.image_url,
        rarity: asRarity(detail.rarity),
      }
    case 'aneddoto':
      return { Icon: GiScrollUnfurled, accent: '#A3E635', title: detail.title ?? 'Aneddoto', subtitle: 'Storia' }
    case 'indizio':
      return { Icon: GiScrollUnfurled, accent: '#38BDF8', title: 'Indizio', subtitle: 'Enigma' }
    case 'missione':
      return { Icon: GiGreekTemple, accent: '#F472B6', title: detail.title ?? 'Missione speciale', subtitle: 'Missione' }
    default:
      return { Icon: GiSparkles, accent: '#9CA3AF', title: type }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/game/__tests__/loot-visuals.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/components/game/loot-visuals.tsx src/components/game/__tests__/loot-visuals.test.ts
git commit -m "feat(loot): expose rarity on LootView for sound/visual rarity effects"
```

---

### Task 2: Modulo sonoro `pack-open.ts`

**Files:**
- Create: `src/lib/game/sounds/pack-open.ts`

Nessun test diretto (vedi nota TDD in cima al plan) — scritto direttamente, stile identico a `hatch.ts`.

**Step 1: Write the module**

```ts
/**
 * Pack / chest opening sounds — synthesized via Web Audio API.
 * Complexity and volume scale with rarity, mirroring the pattern in hatch.ts.
 *
 *   playPackTear    – paper rip + wax-seal crack, on the tap that opens a pack
 *   playPackBurst   – boom + sparkle cascade, synced with the burst flash;
 *                     scales with the PACK's own rarity
 *   playChestUnlock – key jingle + hinge creak + lid clunk; scales with the
 *                     CHEST's own rarity
 *   playDropReveal  – short per-drop reveal tick; scales with the rarity of
 *                     the individual drop (or a plain tick if it has none).
 *                     Reserves only ~0.13s of queue time so rapid staggered
 *                     reveals (140ms apart) don't drift out of sync.
 */

import { getSharedAC, getSoundStartTime } from './shared-ac'

type RarityKey = string | null | undefined

// ── Shared helpers ────────────────────────────────────────────────────────────
function noiseBurst(
  ac: AudioContext, now: number, durationS: number,
  filterType: BiquadFilterType, freqStart: number, freqEnd: number, Q: number,
  vol: number, rampS: number,
): void {
  const len = Math.floor(ac.sampleRate * durationS)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const filt = ac.createBiquadFilter()
  filt.type = filterType
  filt.frequency.setValueAtTime(freqStart, now)
  if (freqEnd !== freqStart) filt.frequency.exponentialRampToValueAtTime(freqEnd, now + durationS)
  filt.Q.value = Q
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + rampS)
  src.connect(filt); filt.connect(g); g.connect(ac.destination)
  src.start(now); src.stop(now + rampS + 0.02)
}

function tick(ac: AudioContext, t: number, freq: number, vol: number, dur = 0.14): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.02)
}

function bassThump(ac: AudioContext, t: number, freqStart: number, freqEnd: number, vol: number, dur: number): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freqStart, t)
  o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04)
  o.connect(g); g.connect(ac.destination)
  o.start(t); o.stop(t + dur + 0.06)
}

// ── Pack tear ─────────────────────────────────────────────────────────────────
const TEAR_MULT: Record<string, number> = {
  comune: 0.55, non_comune: 0.62, raro: 0.70,
  epico: 0.80, leggendario: 0.92, mitologico: 1.00,
}

export function playPackTear(rarity?: RarityKey, vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.30)
  const mult = TEAR_MULT[rarity ?? ''] ?? 0.62

  // Paper rip — bandpass noise sweeping down in pitch
  noiseBurst(ac, now, 0.22, 'bandpass', 2200, 900, 0.8, vol * mult * 0.6, 0.22)

  // Wax-seal crack — bright highpass transient right at the tear point
  noiseBurst(ac, now + 0.02, 0.05, 'highpass', 1800, 1800, 1, vol * mult, 0.05)
}

// ── Pack burst ────────────────────────────────────────────────────────────────
const BURST_NOTES: Record<string, number[]> = {
  comune:      [1046.5, 1318.5],
  non_comune:  [1046.5, 1318.5, 1567.98],
  raro:        [1046.5, 1318.5, 1567.98, 2093.0],
  epico:       [783.99, 1046.5, 1318.5, 1567.98, 2093.0],
  leggendario: [523.25, 783.99, 1046.5, 1318.5, 1567.98, 2093.0],
  mitologico:  [392.0, 523.25, 783.99, 1046.5, 1318.5, 1567.98, 2093.0, 2637.02],
}
const BURST_BASS_FREQ: Record<string, number> = {
  leggendario: 74, mitologico: 68,
}

export function playPackBurst(rarity?: RarityKey, vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const notes = BURST_NOTES[rarity ?? ''] ?? BURST_NOTES.non_comune
  const now = getSoundStartTime(0.5 + notes.length * 0.045)

  bassThump(ac, now, BURST_BASS_FREQ[rarity ?? ''] ?? 90, 45, vol * 0.60, 0.30)
  noiseBurst(ac, now, 0.18, 'lowpass', 3200, 3200, 1, vol * 0.35, 0.18)

  notes.forEach((freq, i) => tick(ac, now + 0.08 + i * 0.045, freq, vol * 0.30, 0.42))
}

// ── Chest unlock ──────────────────────────────────────────────────────────────
const UNLOCK_MULT: Record<string, number> = {
  comune: 0.55, non_comune: 0.62, raro: 0.70,
  epico: 0.80, leggendario: 0.92, mitologico: 1.00,
}
const UNLOCK_BASS_FREQ: Record<string, number> = {
  leggendario: 64, mitologico: 58,
}

export function playChestUnlock(rarity?: RarityKey, vol = 0.55): void {
  const ac = getSharedAC(); if (!ac) return
  const now = getSoundStartTime(0.9)
  const mult = UNLOCK_MULT[rarity ?? ''] ?? 0.62

  // Key jingle — two quick metallic ticks
  ;[1600, 2100].forEach((freq, i) => {
    const t = now + i * 0.05
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(vol * mult * 0.35, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.09)
  })

  // Hinge creak — descending bandpass noise
  noiseBurst(ac, now + 0.12, 0.34, 'bandpass', 900, 320, 4, vol * mult * 0.30, 0.34)

  // Lid clunk — bass thump, deeper for rarer chests
  bassThump(ac, now + 0.5, UNLOCK_BASS_FREQ[rarity ?? ''] ?? 80, 48, vol * mult * 0.65, 0.26)
}

// ── Per-drop reveal ───────────────────────────────────────────────────────────
export function playDropReveal(rarity?: RarityKey, vol = 0.45): void {
  const ac = getSharedAC(); if (!ac) return
  // Short reservation keeps staggered reveals (140ms apart) from drifting late.
  const now = getSoundStartTime(0.13)

  if (!rarity) {
    tick(ac, now, 720, vol * 0.30, 0.10)
    return
  }

  if (rarity === 'comune') {
    tick(ac, now, 660, vol * 0.32, 0.16)
    tick(ac, now + 0.05, 880, vol * 0.22, 0.14)

  } else if (rarity === 'non_comune') {
    tick(ac, now, 660, vol * 0.34, 0.16)
    tick(ac, now + 0.06, 988, vol * 0.28, 0.20)

  } else if (rarity === 'raro') {
    ;[880, 1174.66, 1567.98].forEach((freq, i) => tick(ac, now + i * 0.045, freq, vol * 0.30, 0.22))

  } else if (rarity === 'epico') {
    ;[659.25, 987.77, 1318.5].forEach((freq, i) => tick(ac, now + i * 0.04, freq, vol * 0.34, 0.26))
    tick(ac, now, 110, vol * 0.30, 0.16)

  } else {
    // leggendario / mitologico — sub thump + widest sparkle
    bassThump(ac, now, rarity === 'mitologico' ? 66 : 74, 40, vol * 0.42, 0.22)
    const notes = rarity === 'mitologico'
      ? [659.25, 987.77, 1318.5, 1760, 2349.32]
      : [659.25, 987.77, 1318.5, 1760]
    notes.forEach((freq, i) => tick(ac, now + 0.03 + i * 0.035, freq, vol * 0.32, 0.30))
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/game/sounds/pack-open.ts
git commit -m "feat(sound): add pack/chest open + drop-reveal sounds scaled by rarity"
```

---

### Task 3: Integrare i suoni in `PackOpenModal`

**Files:**
- Modify: `src/components/game/PackOpenModal.tsx`
- Test: `src/components/game/__tests__/PackOpenModal.test.tsx`

**Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PackOpenModal from '../PackOpenModal'

vi.mock('@/lib/game/sounds/pack-open', () => ({
  playPackTear: vi.fn(),
  playPackBurst: vi.fn(),
  playDropReveal: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playUiTap: vi.fn(),
}))

import { playPackTear, playPackBurst, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('<PackOpenModal>', () => {
  it('plays tear + burst sounds scaled to the pack rarity when tapped open', () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina Epica', rarity: 'epico' }}
      drops={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(playPackTear).toHaveBeenCalledWith('epico')
    expect(playPackBurst).toHaveBeenCalledWith('epico')
  })

  it('plays a drop-reveal sound per drop once the reveal phase begins', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[
        { type: 'gold', ok: true, detail: { amount: 10 } },
        { type: 'oggetto', ok: true, detail: { itemName: 'Erba', rarity: 'raro' } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('10 Oro', {}, { timeout: 3000 })
    expect(playDropReveal).toHaveBeenCalledWith(undefined)
    expect(playDropReveal).toHaveBeenCalledWith('raro')
  })

  it('plays a UI tap when the final CTA button is pressed', async () => {
    const onDone = vi.fn()
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[{ type: 'gold', ok: true, detail: { amount: 10 } }]}
      onDone={onDone}
    />)
    fireEvent.click(screen.getByRole('button'))
    const cta = await screen.findByText('Fantastico!', {}, { timeout: 3000 })
    fireEvent.click(cta)
    expect(playUiTap).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/game/__tests__/PackOpenModal.test.tsx`
Expected: FAIL — `pack-open.ts` module isn't imported yet by the component, so the mocked functions are never called (`expect(playPackTear).toHaveBeenCalledWith('epico')` fails with 0 calls).

**Step 3: Write minimal implementation**

In `src/components/game/PackOpenModal.tsx`:

1. Add imports right after the existing ones (after line 7, `import type { Rarity } from '@/lib/types'`):

```tsx
import { playPackTear, playPackBurst, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'
import { RARITY_RANK } from '@/lib/types'
```

2. Replace the `tear` callback (current lines 25-29):

```tsx
  const tear = useCallback(() => {
    if (phase !== 'sealed') return
    playPackTear(pack.rarity)
    setPhase('burst')
    playPackBurst(pack.rarity)
    setTimeout(() => setPhase('reveal'), 620)
  }, [phase, pack.rarity])
```

3. Add a pack-rarity boost flag right after `packAccent` (current lines 22-23):

```tsx
  const isPackEpicPlus = !!pack.rarity && pack.rarity in RARITY_RANK
    && RARITY_RANK[pack.rarity as Rarity] >= RARITY_RANK.epico
```

4. In the burst phase block (current lines 83-93), add a second shockwave ring for epico+ packs, and boost the flash opacity:

```tsx
        {phase === 'burst' && (
          <motion.div key="burst" className="absolute inset-0 flex items-center justify-center" exit={{ opacity: 0 }}>
            <motion.div className="rounded-full"
              style={{ background: `radial-gradient(circle, #fff 0%, ${packAccent} 40%, transparent 72%)` }}
              initial={{ width: 40, height: 40, opacity: 0.9 }}
              animate={{ width: 900, height: 900, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }} />
            {isPackEpicPlus && (
              <motion.div className="absolute rounded-full" data-testid="pack-burst-boost"
                style={{ background: `radial-gradient(circle, #fff 0%, ${packAccent} 55%, transparent 78%)` }}
                initial={{ width: 20, height: 20, opacity: 1 }}
                animate={{ width: 1200, height: 1200, opacity: 0 }}
                transition={{ duration: 0.85, delay: 0.1, ease: 'easeOut' }} />
            )}
            <motion.div className="absolute inset-0 bg-white"
              initial={{ opacity: 0 }} animate={{ opacity: isPackEpicPlus ? [0, 1, 0] : [0, 0.85, 0] }} transition={{ duration: 0.5 }} />
          </motion.div>
        )}
```

5. Wire the final CTA button (current line 115) to also play a tap:

```tsx
              <motion.button onClick={() => { playUiTap(); onDone() }}
```

6. In `DropCard`, pass rarity through to the sound + add the epico+ visual boost. Replace the whole `DropCard` function (current lines 131-163):

```tsx
function DropCard({ drop, index }: { drop: PackDrop; index: number }) {
  const v = describeDrop(drop.type, drop.detail)
  const { Icon } = v
  const isEpicPlus = !!v.rarity && RARITY_RANK[v.rarity] >= RARITY_RANK.epico
  return (
    <motion.div style={{ perspective: 800 }}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.14, type: 'spring', stiffness: 220, damping: 18 }}>
      <motion.div className="relative rounded-2xl p-4 h-full flex flex-col items-center text-center"
        style={{
          transformStyle: 'preserve-3d',
          background: `linear-gradient(160deg, ${v.accent}22 0%, rgba(255,255,255,0.03) 100%)`,
          border: `1px solid ${v.accent}55`,
          boxShadow: `0 8px 26px ${v.accent}22, inset 0 0 20px ${v.accent}12`,
        }}
        initial={{ rotateY: 180 }} animate={{ rotateY: 0 }}
        onAnimationStart={() => playDropReveal(v.rarity)}
        transition={{ delay: 0.26 + index * 0.14, duration: 0.5, ease: 'easeOut' }}>
        {isEpicPlus && (
          <motion.div aria-hidden data-testid="drop-rarity-burst"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: `radial-gradient(circle, ${v.accent}66 0%, transparent 70%)` }}
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ delay: 0.26 + index * 0.14, duration: 0.35, ease: 'easeOut' }} />
        )}
        <div className="relative mb-2 rounded-xl flex items-center justify-center"
          style={{ width: 62, height: 62, background: `radial-gradient(circle at 40% 30%, ${v.accent}44, transparent 70%)` }}>
          {v.imageUrl
            ? <img src={v.imageUrl} alt={v.title} className="w-14 h-14 object-contain rounded-lg" />
            : <Icon size={38} color={v.accent} style={{ filter: `drop-shadow(0 0 8px ${v.accent}88)` }} />}
        </div>
        <p className="text-white font-bold text-sm leading-tight line-clamp-2">{v.title}</p>
        {v.subtitle && (
          <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide capitalize"
            style={{ background: `${v.accent}22`, color: v.accent }}>
            {v.subtitle}
          </span>
        )}
      </motion.div>
    </motion.div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/game/__tests__/PackOpenModal.test.tsx`
Expected: PASS (3 tests)

**Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: same pre-existing failures as before this task (see `pre-existing-test-failures` memory — unrelated `after()`/stale-numeric-expectation failures), no new failures.

**Step 6: Commit**

```bash
git add src/components/game/PackOpenModal.tsx src/components/game/__tests__/PackOpenModal.test.tsx
git commit -m "feat(pack): wire tear/burst/reveal sounds + rarity visual boost"
```

---

### Task 4: Integrare i suoni in `ChestOpenModal`

**Files:**
- Modify: `src/components/game/ChestOpenModal.tsx`
- Test: `src/components/game/__tests__/ChestOpenModal.test.tsx`

**Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ChestOpenModal from '../ChestOpenModal'

vi.mock('@/lib/game/sounds/pack-open', () => ({
  playChestUnlock: vi.fn(),
  playDropReveal: vi.fn(),
}))
vi.mock('@/lib/game/sounds/ui', () => ({
  playUiTap: vi.fn(),
}))

import { playChestUnlock, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('<ChestOpenModal>', () => {
  it('plays the unlock sound scaled to the chest rarity when tapped open', () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere Leggendario', rarity: 'leggendario' }}
      contents={[]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    expect(playChestUnlock).toHaveBeenCalledWith('leggendario')
  })

  it('plays a drop-reveal sound per content item once the reveal phase begins', async () => {
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'comune' }}
      contents={[
        { type: 'gold', ok: true, detail: { amount: 20 } },
        { type: 'creatura', ok: true, detail: { creature: { name: 'Lupo', rarity: 'mitologico' } } },
      ]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('20 Oro', {}, { timeout: 3000 })
    expect(playDropReveal).toHaveBeenCalledWith(undefined)
    expect(playDropReveal).toHaveBeenCalledWith('mitologico')
  })

  it('plays a UI tap when the final CTA button is pressed', async () => {
    const onDone = vi.fn()
    render(<ChestOpenModal
      chest={{ name: 'Forziere', rarity: 'comune' }}
      contents={[{ type: 'gold', ok: true, detail: { amount: 20 } }]}
      onDone={onDone}
    />)
    fireEvent.click(screen.getByRole('button'))
    const cta = await screen.findByText('Continua', {}, { timeout: 3000 })
    fireEvent.click(cta)
    expect(playUiTap).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/game/__tests__/ChestOpenModal.test.tsx`
Expected: FAIL — no sound module imported yet.

**Step 3: Write minimal implementation**

In `src/components/game/ChestOpenModal.tsx`:

1. Add imports after the existing ones (after line 7):

```tsx
import { playChestUnlock, playDropReveal } from '@/lib/game/sounds/pack-open'
import { playUiTap } from '@/lib/game/sounds/ui'
import { RARITY_RANK } from '@/lib/types'
```

2. Add a rarity-boost flag next to `accent` (current lines 20-21):

```tsx
  const isChestEpicPlus = !!chest.rarity && chest.rarity in RARITY_RANK
    && RARITY_RANK[chest.rarity as Rarity] >= RARITY_RANK.epico
```

3. Replace the `unlock` callback (current lines 23-27):

```tsx
  const unlock = useCallback(() => {
    if (phase !== 'locked') return
    playChestUnlock(chest.rarity)
    setPhase('unlocking')
    setTimeout(() => setPhase('reveal'), 900)
  }, [phase, chest.rarity])
```

4. Boost the ambient glow ring for epico+ chests — update the ambient `motion.div` (current lines 33-36):

```tsx
      <motion.div aria-hidden className="absolute pointer-events-none rounded-full" data-testid={isChestEpicPlus ? 'chest-unlock-boost' : undefined}
        style={{ width: 460, height: 460, background: `radial-gradient(circle, ${accent}${isChestEpicPlus ? '33' : '22'} 0%, transparent 68%)` }}
        animate={{ scale: phase === 'reveal' ? [1, 1.15, 1] : (isChestEpicPlus ? [1, 1.08, 1] : 1), opacity: phase === 'locked' ? 0.5 : 0.9 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
```

5. Wire the final CTA button (current line 111):

```tsx
              <motion.button onClick={() => { playUiTap(); onDone() }}
```

6. Add the per-drop reveal sound + rarity boost inside the `contents.map` render (current lines 85-107) — replace that block with:

```tsx
                {contents.map((d, i) => {
                  const v = describeDrop(d.type, d.detail)
                  const { Icon } = v
                  const isEpicPlus = !!v.rarity && RARITY_RANK[v.rarity] >= RARITY_RANK.epico
                  return (
                    <motion.div key={i}
                      className="relative rounded-2xl p-4 flex flex-col items-center text-center"
                      style={{ background: `linear-gradient(160deg, ${v.accent}22, rgba(255,255,255,0.03))`, border: `1px solid ${v.accent}55` }}
                      initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      onAnimationStart={() => playDropReveal(v.rarity)}
                      transition={{ delay: 0.15 + i * 0.14, type: 'spring', stiffness: 220, damping: 17 }}>
                      {isEpicPlus && (
                        <motion.div aria-hidden data-testid="drop-rarity-burst"
                          className="absolute inset-0 rounded-2xl pointer-events-none"
                          style={{ background: `radial-gradient(circle, ${v.accent}66 0%, transparent 70%)` }}
                          initial={{ scale: 0.4, opacity: 0.9 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ delay: 0.15 + i * 0.14, duration: 0.35, ease: 'easeOut' }} />
                      )}
                      <div className="mb-2 rounded-xl flex items-center justify-center"
                        style={{ width: 62, height: 62, background: `radial-gradient(circle at 40% 30%, ${v.accent}44, transparent 70%)` }}>
                        {v.imageUrl
                          ? <img src={v.imageUrl} alt={v.title} className="w-14 h-14 object-contain rounded-lg" />
                          : <Icon size={38} color={v.accent} style={{ filter: `drop-shadow(0 0 8px ${v.accent}88)` }} />}
                      </div>
                      <p className="text-white font-bold text-sm leading-tight line-clamp-2">{v.title}</p>
                      {v.subtitle && (
                        <span className="mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide capitalize"
                          style={{ background: `${v.accent}22`, color: v.accent }}>{v.subtitle}</span>
                      )}
                    </motion.div>
                  )
                })}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/game/__tests__/ChestOpenModal.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/components/game/ChestOpenModal.tsx src/components/game/__tests__/ChestOpenModal.test.tsx
git commit -m "feat(chest): wire unlock/reveal sounds + rarity visual boost"
```

---

### Task 5: Lampo dorato per drop mitologici + tap sui pulsanti bustina/forziere in zaino

**Files:**
- Modify: `src/components/game/PackOpenModal.tsx`
- Modify: `src/components/game/ChestOpenModal.tsx`
- Modify: `src/app/game/backpack/page.tsx`
- Test: estende `src/components/game/__tests__/PackOpenModal.test.tsx`

**Step 1: Write the failing test**

Add to `PackOpenModal.test.tsx` (inside the existing `describe` block):

```tsx
  it('flashes gold across the screen when a mitologico drop is revealed', async () => {
    render(<PackOpenModal
      pack={{ name: 'Bustina', rarity: 'comune' }}
      drops={[{ type: 'creatura', ok: true, detail: { creature: { name: 'Fenice', rarity: 'mitologico' } } }]}
      onDone={() => {}}
    />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByTestId('mitologico-flash', {}, { timeout: 3000 })
  })
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/game/__tests__/PackOpenModal.test.tsx`
Expected: FAIL — `findByTestId('mitologico-flash')` times out, element doesn't exist.

**Step 3: Write minimal implementation**

In `DropCard` (both `PackOpenModal.tsx` and `ChestOpenModal.tsx`), add the full-screen flash right after the `isEpicPlus` sparkle overlay block added in Task 3/4:

```tsx
        {v.rarity === 'mitologico' && (
          <motion.div aria-hidden data-testid="mitologico-flash"
            className="fixed inset-0 pointer-events-none z-[1210]"
            style={{ background: 'radial-gradient(circle at 50% 45%, #FFD76699 0%, transparent 70%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ delay: 0.26 + index * 0.14, duration: 0.35, ease: 'easeOut' }} />
        )}
```

(In `ChestOpenModal.tsx`, use `delay: 0.15 + i * 0.14` to match that file's stagger, and place it in the `contents.map` block next to the `drop-rarity-burst` element added in Task 4.)

In `src/app/game/backpack/page.tsx`:

1. Add the import near the other component imports (after line 20, `import { RARITY_COLORS, RARITY_LABELS } from '@/lib/types'`):

```tsx
import { playUiTap } from '@/lib/game/sounds/ui'
```

2. Update the pack list button `onClick` (current line 800):

```tsx
                        onClick={() => { playUiTap(); handleOpenPack(row) }}
```

3. Update the chest "Apri" button `onClick` (current line 875):

```tsx
                          onClick={() => { playUiTap(); handleOpenChest(row) }}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/game/__tests__/PackOpenModal.test.tsx`
Expected: PASS (4 tests)

**Step 5: Typecheck the backpack page change (it has no test harness — verify via tsc)**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by the `page.tsx` or modal edits.

**Step 6: Commit**

```bash
git add src/components/game/PackOpenModal.tsx src/components/game/ChestOpenModal.tsx src/app/game/backpack/page.tsx src/components/game/__tests__/PackOpenModal.test.tsx
git commit -m "feat(pack): mitologico full-screen flash + tap sound on backpack open buttons"
```

---

### Task 6: Verifica manuale in browser

**Files:** nessuno (solo verifica)

**Step 1:** Avviare il dev server e aprire `/game/backpack` con un utente che abbia almeno una bustina e un forziere di rarità diverse in inventario (usare l'admin/seed esistente se serve per generarne uno di rarità alta).

**Step 2:** Cliccare una bustina in lista → verificare: tap silenzioso ok (nessun suono richiesto qui, solo su strappo interno al modal), poi tap sull'immagine sigillata → sentire lo strappo, poi il boom/burst, poi un tick/sparkle per ogni drop rivelato, scalando in intensità con la rarità di ciascun drop. Se la bustina è epica+, verificare il secondo anello di shockwave più ampio. Se un drop è mitologico, verificare il lampo dorato a schermo intero.

**Step 3:** Ripetere per un forziere: tap "Apri" → chiave/cigolio/clunk, poi reveal dei contenuti con gli stessi effetti per-rarità.

**Step 4:** Verificare che il pulsante finale "Fantastico!"/"Continua" produca un tap leggero.

**Step 5:** Controllare la console del browser per errori Web Audio (context sospeso, ecc.) — nessun errore atteso.

Se qualcosa non torna, tornare al task corrispondente e correggere prima di procedere.

---

### Task 7: Suite completa + lint + typecheck finali

**Step 1:** `npx vitest run` — Expected: nessuna nuova failure oltre a quelle pre-esistenti già note (vedi memoria `pre-existing-test-failures`).

**Step 2:** `npm run lint` — Expected: nessun nuovo errore/warning sui file toccati.

**Step 3:** `npx tsc --noEmit` — Expected: nessun nuovo errore.

**Step 4:** Se tutto verde, il lavoro è pronto per essere integrato (merge/PR secondo la convenzione del repo).
