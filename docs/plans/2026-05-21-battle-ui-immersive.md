# Battle UI — Immersive Full-Scene Redesign — Implementation Plan

> **For Claude (executing agent):** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to implement this task-by-task. You have Supabase CLI access; the author of this plan did not, so all DB/storage/asset steps are delegated to you. Work on a dedicated branch. Commit frequently.

**Goal:** Replace the encounter / duel / boss battle screens with an immersive *full-scene* presentation — each creature lives **inside its own element-themed environment** (separate background layer + transparent creature cutout), with light "diegetic" info overlays, a golden VS emblem with lightning, a portrait squad bar, and game-designer-grade animations. The exact visual target is the attached screenshot and the static mockup at `docs/mockups/2026-05-21-battle-immersive.html`.

**Architecture:** Layer separation. Today each creature image has its background **baked in** (one square illustration). We split that into reusable layers:
1. **Background** — one wide scene per element (5) + one neutral arena (duels), served from `/public/backgrounds/battle/`.
2. **Creature** — transparent PNG, **freshly generated** (native transparent output from gpt-image-2 — NOT background-removed from the old art), composited on top with the existing aura/contact-shadow treatment.
3. **Atmosphere** — seam fog, VS emblem, per-element particles, dynamic reactions (low-HP darken, crit freeze).
4. **HUD** — light glass info cards, portrait squad bar, hierarchic action bar, hairline timer.

A single `<BattleScene>` compositor renders layers 1–3; a `<BattleHud>` set renders layer 4. Encounter, duel and boss all consume the same primitives so the look is consistent and the combat *logic* (APIs, state machines) is untouched.

**Asset strategy (decided by the product owner):** regenerate **everything** — both the creature sprites (as clean native transparent cutouts) and their element backgrounds — for maximum quality and thematic coherence with the game's world (Italian Adriatic/Apennine mythological bestiary, the cute-but-characterful chibi monster style visible in the current art). We do NOT background-remove the old art (fragile, leaves halos/leftover ground).

**NON-DESTRUCTIVE — this is a hard requirement.** Everything new is additive so the owner can `git revert` and be back to today's app with today's images:
- New creature art is written to a NEW column `sprite_cutout_url` and a NEW storage path. The existing `image_url` (baked art) and its storage object are **never overwritten or deleted**.
- Backgrounds are NEW files under `/public/backgrounds/battle/`.
- The sprite resolver prefers the new cutout but **falls back to the old `image_url`**, so the old assets stay live and usable.
- Old images get deleted ONLY later, on explicit owner approval, after they confirm they like the result.

**Tech Stack:** Next.js 16 App Router · React · framer-motion (already in repo) · Supabase (DB + Storage) · OpenAI **gpt-image-2** for asset generation (NOT gpt-image-1.5) · TypeScript strict.

---

## Stato avanzamento - aggiornato 2026-05-21

**Branch corrente:** `feat/battle-immersive-ui`

**Ultimi commit rilevanti:**
- `ff38557` - stato WIP salvato prima di continuare il lavoro.
- `bf9f2f6` - prima rifinitura della scena immersiva.
- `56ceb56` - polish della lower HUD.
- `f85e798` - evidenza piu chiara del membro squadra attivo.
- `6642b70` - VS + fulmini molto piu vicini al mockup.
- `67ecb88` - layout immersivo collegato a incontri, duelli e boss fight.
- `1cbb61c` - preferenza per gli sprite/cutout nelle lineup di battaglia.
- `645d895` - admin artwork aggiornato per salvare cutout come sprite battle.
- `5309c20` - reidratazione degli incontri con `sprite_url` vuoto o mancante.

**Cosa e gia in app:**
- Il nuovo layer condiviso in `src/components/battle/` esiste ed e usato: `BattleScene`, `ElementBackdrop`, `SceneParticles`, `VsEmblem`, `CombatantCard`, `SquadBar`, `ActionBar`, `TurnTimer`, `DamageBurst`, `ImmersiveBattleLayout`, `CaptureOverlay`.
- Il mockup e stato avvicinato con scena full-screen, creature separate nei due ambienti, seam centrale, fulmini/VS dorato, action bar piu compatta, squad bar compatta e membro attivo molto piu leggibile.
- Il layout immersivo e attivo per `encounter`, `duel` e `boss`. Il vecchio layout resta disponibile con `NEXT_PUBLIC_BATTLE_LEGACY_UI=1`.
- Attacchi, danni, crit/freeze, status notice, switch notice, timer lineare, squad switch e overlay cattura sono collegati al nuovo layout senza cambiare la logica combat.
- Gli incontri e i boss propagano `sprite_url` nella UI. Le sessioni/incontri gia salvati con sprite mancante vengono reidratati dal DB.
- L'admin creature ora permette di scegliere fra `Sprite battle` e `Card`: `Sprite battle` salva su `creatures.sprite_url` e storage `creature-artwork/creatures/cutouts/${id}.png`; `Card` resta su `image_url`.
- Verifiche passate: `npm run typecheck`, test `battle-scene`, test admin artwork route, test boss route, test encounter get route.

**Nota importante sullo schema asset:**
- Il piano originale prevedeva una nuova colonna `sprite_cutout_url`. Nel repo attuale esiste gia `creatures.sprite_url`, quindi l'implementazione corrente usa `sprite_url` come campo cutout/battle sprite per evitare una migrazione immediata.
- `resolveCreatureSprite()` supporta comunque `sprite_cutout_url || sprite_url || image_url`, quindi in futuro possiamo ancora migrare a `sprite_cutout_url` se vogliamo separare semanticamente i campi.
- La route admin usa `OPENAI_IMAGE_MODEL ?? 'gpt-image-1.5'`: per chiudere al 100% la Task A1 come scritta, va deciso se impostare `OPENAI_IMAGE_MODEL=gpt-image-2` in env oppure cambiare il fallback del codice a `gpt-image-2`.

**Stato per fase:**
- **Phase A - Asset pipeline:** parziale. La route admin supporta cutout/legacy e salvataggio non distruttivo su `sprite_url`; non sono ancora implementati `kind:'scene'`, migrazione `sprite_cutout_url`, script batch `regen:creatures`, o rigenerazione completa bestiario. Background presenti: `bosco.webp` e `terra.webp`; mancanti `fiamma.webp`, `adriatico.webp`, `armonia.webp`, `arena.webp`.
- **Phase B - Core compositor:** sostanzialmente completata. Componenti scena, backdrop, particelle, VS e compositor sono presenti.
- **Phase C - HUD overlays:** sostanzialmente completata per la battle UI. `CombatantCard`, `SquadBar`, `ActionBar`, `TurnTimer` sono cablati tramite `ImmersiveBattleLayout`. `BattleTopBar` esiste e viene usato nel demo, ma non e ancora cablato nelle schermate reali perche il top bar globale resta fuori dalla battle scene.
- **Phase D - Damage / impact:** parziale-avanzata. `DamageBurst`, crit/freeze, HP ghost bar e passaggio `AttackAnimation` sono presenti. Restano da rifinire micro screen-shake/zoom punch, reazioni super-effective e timing di impatto piu cinematografico.
- **Phase E - Wire screens:** completata come primo rollout. Incontri, duelli e boss usano il layout immersivo, con fallback legacy via env flag.
- **Phase F - Game-designer polish:** ancora da fare come passata dedicata. Priorita consigliata: rigenerare/verificare sprite Miniera via `Sprite battle`, completare background mancanti, poi fare polish su attacco, svenimento/cambio, cattura, vittoria/sconfitta e items drawer.

**Prossimo passo consigliato:**
1. Rigenerare o incollare Miniera in Admin -> Creatures con modalita `Sprite battle`, poi testare incontro/boss/duello.
2. Generare i 4 background mancanti.
3. Decidere se restare su `sprite_url` o introdurre davvero `sprite_cutout_url`.
4. Fare una passata Phase F su animazioni: attacco, lancio rete/cattura, svenimento, cambio creatura, status, vittoria/sconfitta.

---

## 0. Read first / ground truth

Before writing code, read these so you match existing conventions:

- `src/lib/types.ts` — `Element`, `Rarity`, `RARITY_LABELS` (note: `comune`→"Terrestre", `non_comune`→"Arcaico", `raro`→"Eroico", `epico`→"Mostruoso", `leggendario`→"Leggendario", `mitologico`→"Mitologico"), `RARITY_COLORS`, `ELEMENT_EMOJI`, `ELEMENT_MULTIPLIERS`.
- `src/components/game/boss/types.ts` — `ELEMENT_THEME` (per-element `{bg, glow, ground}`), `BOSS_THEME`, `BossSlot`/`PlayerSlot` shapes.
- `src/components/creature/CreatureSprite.tsx` — already renders a sprite with element glow, aura, contact shadow, and `idle/attack/damage/catch/flee/victory` motion variants. **Reuse this; do not reinvent.**
- `src/components/game/boss/CreatureCard.tsx` — current heavy info card (to be replaced by the lighter overlay card).
- `src/components/game/boss/BattleScreen.tsx` — current boss battle layout (cards slammed to edges + VS pill + squad bar + timer + actions). Reference for the data it already has.
- `src/app/game/encounter/[id]/page.tsx` — current encounter screen (~2456 lines). Render block starts at line ~1329. Action buttons CATTURA / LOTTA / OGGETTI / FUGGI.
- `src/app/game/duel/[id]/page.tsx` and `src/app/game/boss/[id]/page.tsx` — the other two screens.
- `src/components/battle/` — `AttackAnimation`, `BattleAtmosphere`, `FloatingDamage`, `StatusAura`, `animations/`.
- `src/app/api/admin/creatures/[id]/artwork/route.ts` — current artwork generation (uses gpt-image-1.5; you will upgrade it).

**Visual target:** `docs/mockups/2026-05-21-battle-immersive.html` (open in a browser) + the screenshot the product owner approved ("lo voglio ESATTAMENTE come questo mockup"). Match it: full-scene halves, golden VS + lightning arc, semi-transparent info cards (name + element pill + rarity stars/label + HP bar/numbers; player card also ATK), portrait squad bar with gold-crowned active slot, colored action buttons (CATTURA orange, LOTTA purple, OGGETTI/FUGGI dark), top bar (Lv + XP, gold, timer, bell).

---

## Safety: non-destructive regeneration & rollback (READ BEFORE PHASE A)

The owner wants to be able to throw the whole redesign away and return to the current app with the current images. Honor these rules everywhere:

1. **Never write to `creatures.image_url`** during this work. It holds the current baked art = the rollback safety net. New art goes to `creatures.sprite_cutout_url` only.
2. **Never overwrite or delete the old storage objects** (`creature-artwork/creatures/${id}.png`). New cutouts go to a **separate** path `creature-artwork/creatures/cutouts/${id}.png`.
3. **Backgrounds are additive** new files in `/public/backgrounds/battle/`. They don't replace anything.
4. **The resolver falls back to old art**: `resolveCreatureSprite()` returns `sprite_cutout_url || image_url || ''`. So even mid-migration (some creatures regenerated, some not) the app always has an image.
5. **Rollback procedure** (document it in the PR description): `git revert` the Phase B–F commits → battle screens return to using `image_url`. The `sprite_cutout_url` column + cutout files can stay (harmless) or be dropped later. No data loss either way.
6. **Deletion of old assets happens later**, in a SEPARATE follow-up, only after the owner explicitly approves the new look. Do not include any `DELETE`/storage-remove of old art in this plan's commits.

---

## Phase A — Asset pipeline (gpt-image-2 + cutouts + backgrounds)

> This phase is mostly **yours alone** (CLI/storage/asset gen). Nothing renders differently yet. **Non-destructive** — see the Safety section above.

### Task A1: Upgrade artwork route to gpt-image-2 with transparency option

**Files:**
- Modify: `src/app/api/admin/creatures/[id]/artwork/route.ts`

**What to change:**
1. Model `'gpt-image-1.5'` → `'gpt-image-2'`.
2. Add param `kind?: 'cutout' | 'scene' | 'legacy'` (default `'cutout'` for this work).
   - `'cutout'` → `background:'transparent'`, `output_format:'png'`, `size:'1024x1024'`. Writes to storage `creatures/cutouts/${id}.png` and sets **`sprite_cutout_url` ONLY**. **Must NOT touch `image_url`.**
   - `'scene'` → opaque, portrait `1024x1536`, for element backgrounds (used by the background generation step).
   - `'legacy'` → the current behavior (opaque → `image_url`), kept only for back-compat / manual fixes. Not used by this redesign.
3. Manual-URL mode: keep it, but route it to `sprite_cutout_url` when `kind:'cutout'` so admins can paste a hand-made cutout without overwriting the baked art.
4. Cutout prompt suffix: `"...single centered creature, full body, TRANSPARENT BACKGROUND, no ground, no platform, no shadow, no scenery, no text, soft rim light, square."`
5. **Guardrail:** the only path that writes `image_url` is `kind:'legacy'`. The redesign never calls it. This keeps the rollback net intact.

**Step 1: Read the file and confirm current shape.**
Run: open `src/app/api/admin/creatures/[id]/artwork/route.ts`.

**Step 2: Apply edits** (model + params + cutout storage path + sprite_cutout_url write). Keep manual-URL mode working.

**Step 3: Typecheck.**
Run: `npm run typecheck`
Expected: no NEW errors (a pre-existing `web-push` module error is unrelated — ignore it).

**Step 4: Commit.**
```bash
git add src/app/api/admin/creatures/[id]/artwork/route.ts
git commit -m "feat(artwork): gpt-image-2 + transparent cutout generation"
```

---

### Task A2: Migration — `sprite_cutout_url`

**Files:**
- Create: `supabase/migrations/044_creature_cutout.sql`

```sql
-- Transparent PNG cutout of each creature (no baked background). The battle
-- scene composites this over a per-element background. Falls back to
-- image_url when null. Original baked art in image_url is preserved.
ALTER TABLE creatures ADD COLUMN IF NOT EXISTS sprite_cutout_url TEXT;
```

**Step 1: Write the migration file above.**

**Step 2: Push it (you have CLI).**
Run: `npx supabase db push`
Expected: migration 044 applied. Verify:
Run: `npx supabase db diff` (should report no pending changes) or query `select column_name from information_schema.columns where table_name='creatures' and column_name='sprite_cutout_url';`

**Step 3: Regenerate Supabase types** (kills a lot of `any`):
Run: `npx supabase gen types typescript --linked > src/types/database.ts`
(verify the generated file compiles; if the project uses a different path, match it.)

**Step 4: Commit.**
```bash
git add supabase/migrations/044_creature_cutout.sql src/types/database.ts
git commit -m "feat(db): add creatures.sprite_cutout_url + regen types"
```

---

### Task A3: Generate the 5 element backgrounds + 1 neutral arena

**Files:**
- Create: `public/backgrounds/battle/bosco.webp`
- Create: `public/backgrounds/battle/fiamma.webp`
- Create: `public/backgrounds/battle/adriatico.webp`
- Create: `public/backgrounds/battle/terra.webp`
- Create: `public/backgrounds/battle/armonia.webp`
- Create: `public/backgrounds/battle/arena.webp` (neutral, for duels)

**Generation:** Use gpt-image-2, size `1024x1536` (portrait — battle is portrait), quality `high`, `background: 'opaque'`, `output_format: 'png'`, then convert to `.webp` (~quality 82, target <300 KB each) before committing. Each background is a **wide, atmospheric, EMPTY environment** (no creatures, no characters, no text) with a clear dark mid-band where the seam/VS will sit, and room top + bottom for a creature to stand. Match the painterly, slightly-stylized look of the existing creature art.

Prompts (one per file). Prefix all with:
`"Wide vertical environment background for a mobile creature-battle game set on the Italian Adriatic coast and Apennine forests. Painterly, semi-stylized, rich but slightly desaturated, cinematic depth, soft volumetric light, NO creatures, NO characters, NO text, NO UI, empty stage with foreground floor and atmospheric background, a slightly darker horizontal band across the vertical middle. Subject: "`

| File | Subject suffix |
|---|---|
| `bosco.webp` | `an enchanted Apennine forest clearing, mossy stones, ferns, mushrooms, shafts of green-gold light through the canopy, drifting spores.` |
| `fiamma.webp` | `a volcanic ember cavern, cracked obsidian floor, rivers of glowing lava in the distance, floating embers and heat haze.` |
| `adriatico.webp` | `a luminous underwater Adriatic grotto, rippling caustics, kelp, distant blue light shafts, drifting bubbles and silt.` |
| `terra.webp` | `a crystalline rock canyon at dusk, layered sandstone, amber crystal veins, drifting dust motes, warm earthy tones.` |
| `armonia.webp` | `a twilight marble sanctuary, soft violet aurora, floating glyph-lights and gentle sparkles, ethereal harmonious calm.` |
| `arena.webp` | `a neutral stone duel arena under an overcast sky, worn flagstones, faint banners, balanced cool-neutral lighting.` |

**Step 1:** Generate each (you may script it: call OpenAI images API with your key, or temporarily reuse the artwork route's plumbing with `kind:'scene'`). Save PNG, convert to webp, place in `public/backgrounds/battle/`.

**Step 2:** Eyeball each: empty (no creatures), portrait, dark mid-band present, < 300 KB.

**Step 3: Commit.**
```bash
git add public/backgrounds/battle/
git commit -m "feat(assets): per-element battle backgrounds + neutral arena"
```

---

### Task A4: Regenerate creatures as native transparent sprites (non-destructive, batch)

We **regenerate** every creature as a clean native transparent PNG via gpt-image-2 — we do NOT background-remove the old art. This gives crisp edges and lets us upgrade the style to be more on-theme and consistent across the whole bestiary. The old art in `image_url` stays untouched (rollback).

**Shared style guide (use for EVERY creature so the bestiary feels like one family).** Prefix every creature prompt with this preamble, then append the per-creature subject:

```
STYLE: Single creature for a mobile creature-catching game set in a mythological
Italian world (Adriatic coast + Apennine forests). Cute-but-characterful chibi
monster, big expressive eyes, chunky friendly proportions, hand-painted semi-stylized
shading, soft rim light, vivid but slightly earthy palette. Centered, full body,
facing camera 3/4. TRANSPARENT BACKGROUND — no ground, no platform, no shadow baked in,
no scenery, no text, no UI, no border. Square. Subject:
```

Per-creature subject = build from the creature's existing `name` + `description` + element + rarity (rarer → more ornate/imposing; element → motif: bosco=plants/moss, fiamma=embers/lava, adriatico=water/shells, terra=rock/crystal, armonia=light/runes). Keep the subject faithful to the creature's established identity so players still recognize it (e.g. "Muschio" stays a round moss creature).

gpt-image-2 params: `size:'1024x1024'`, `quality:'high'`, `background:'transparent'`, `output_format:'png'`.

> **Consistency tip:** generations are independent and style can drift. Lock it by (a) keeping the style preamble byte-identical for all, and (b) optionally passing 1–2 approved creatures as style references via the gpt-image-2 *edits/reference* input once you have a couple you like.

**Files:**
- Create: `scripts/regenerate-creatures.ts`
- Modify: `package.json` (add `"regen:creatures": "tsx scripts/regenerate-creatures.ts"` + devDep `tsx`)

**Step 1:** Write the script. It must be **idempotent and non-destructive**:
- For each creature, build the prompt (preamble + subject from name/description/element/rarity).
- Call gpt-image-2 (transparent). Upload the PNG to `creature-artwork/creatures/cutouts/${id}.png`. Set `creatures.sprite_cutout_url` ONLY. **Never touch `image_url`.**
- Skip creatures that already have a `sprite_cutout_url` unless a `--force` flag is passed.
- Support `--only <id>` to regenerate a single creature (for hand-tuning).
- Log each result with the public cutout URL for QA. Failures are logged, not fatal.

**Step 2: Dry-run a single creature first.**
Run: `npm run regen:creatures -- --only <some-creature-id>`
QA the cutout URL: clean transparent edges, recognizable, on-style.

**Step 3:** Once the style is approved, run the full batch.
Run: `npm run regen:creatures`
Expected: every creature gets `sprite_cutout_url`; `image_url` unchanged for all.

**Step 4: QA** ~8 cutouts across elements/rarities. Re-tune prompt or re-run `--force --only <id>` for any that miss.

**Step 5: Commit.**
```bash
git add scripts/regenerate-creatures.ts package.json package-lock.json
git commit -m "feat(assets): regenerate creatures as native transparent sprites (non-destructive)"
```

**Acceptance for Phase A:** every creature has a clean native-transparent `sprite_cutout_url`; `image_url` untouched for all (rollback intact); 6 background webp files exist; artwork route uses gpt-image-2 and writes cutouts to the cutout path only.

---

## Phase B — Core compositor

### Task B1: Element background config

**Files:**
- Create: `src/lib/game/battle-scene.ts`

```ts
import type { Element } from '@/lib/types'

// Static backgrounds served by Next from /public — CDN cached, versioned with
// the app. Add a per-session override later if branding requires it (YAGNI now).
export const ELEMENT_BACKGROUND: Record<Element, string> = {
  bosco:     '/backgrounds/battle/bosco.webp',
  fiamma:    '/backgrounds/battle/fiamma.webp',
  adriatico: '/backgrounds/battle/adriatico.webp',
  terra:     '/backgrounds/battle/terra.webp',
  armonia:   '/backgrounds/battle/armonia.webp',
}
export const ARENA_BACKGROUND = '/backgrounds/battle/arena.webp'

/** Cutout-first sprite resolver: transparent cutout, else baked art, else ''. */
export function resolveCreatureSprite(c: { sprite_cutout_url?: string | null; image_url?: string | null }): string {
  return c.sprite_cutout_url || c.image_url || ''
}
```

**Step 1: Write a test** `src/lib/game/__tests__/battle-scene.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveCreatureSprite, ELEMENT_BACKGROUND } from '../battle-scene'

describe('resolveCreatureSprite', () => {
  it('prefers cutout', () => {
    expect(resolveCreatureSprite({ sprite_cutout_url: 'a.png', image_url: 'b.png' })).toBe('a.png')
  })
  it('falls back to baked art', () => {
    expect(resolveCreatureSprite({ sprite_cutout_url: null, image_url: 'b.png' })).toBe('b.png')
  })
  it('empty when neither', () => {
    expect(resolveCreatureSprite({})).toBe('')
  })
})
describe('ELEMENT_BACKGROUND', () => {
  it('covers all 5 elements', () => {
    expect(Object.keys(ELEMENT_BACKGROUND)).toHaveLength(5)
  })
})
```
**Step 2:** Run `npx vitest run src/lib/game/__tests__/battle-scene.test.ts` → FAIL (module missing).
**Step 3:** Implement `battle-scene.ts` (above).
**Step 4:** Run again → PASS.
**Step 5:** Commit `feat(battle): element background config + sprite resolver`.

---

### Task B2: `<ElementBackdrop>` — one scene half

**Files:**
- Create: `src/components/battle/ElementBackdrop.tsx`

Renders a full background image for one half of the screen with:
- `next/image` `fill` `object-cover`, `priority`.
- Subtle parallax (translate on a slow loop, ~6px) so it feels alive.
- A `dim` prop (0–1) used for low-HP darkening / crit freeze (apply via an overlay `rgba(0,0,0,dim)` + `filter: saturate()`).
- Per-element ambient particles layer (spores/embers/bubbles/dust/sparkles) — implement a small `<SceneParticles element={} />` (CSS-animated divs, like the mockup's `rise` keyframe). Element → particle style map.

Props: `{ element: Element | 'arena'; half: 'top' | 'bottom'; dim?: number }`.

**Acceptance:** rendering `<ElementBackdrop element="bosco" half="top" />` shows the forest webp covering the top half with drifting spores.

Commit `feat(battle): ElementBackdrop with parallax + ambient particles`.

---

### Task B3: `<VsEmblem>` — golden VS + lightning

**Files:**
- Create: `src/components/battle/VsEmblem.tsx`

Recreate the screenshot's emblem: a circular gold-ringed badge with "VS" in a bold display weight, and **two lightning arcs** branching left/right across the seam. Build the arcs as animated SVG paths (jagged polylines) with a gold gradient stroke + glow filter; animate `stroke-dashoffset` for a strike-in on mount, then a subtle idle flicker (opacity 0.7↔1, 1.4s loop). Keep it `pointer-events:none`.

Props: `{ struck?: boolean }` (true plays the one-shot strike).

**Acceptance:** matches the screenshot's gold VS + lightning; strike animation fires once on battle start.

Commit `feat(battle): VsEmblem with lightning strike`.

---

### Task B4: `<BattleScene>` compositor

**Files:**
- Create: `src/components/battle/BattleScene.tsx`

Composites the whole stage:
```
<div class="scene">                       // flex column, full height
  <ElementBackdrop half=top element={enemy.element} dim={enemyDim} />
     <CreatureStage side="enemy" .../>     // wraps CreatureSprite cutout
  <ElementBackdrop half=bottom element={player.element} dim={playerDim} />
     <CreatureStage side="player" .../>
  <SeamFog />                              // blurred gradient band
  <VsEmblem struck={justStarted} />
  {children}                              // HUD overlays passed by the screen
</div>
```

Props (TS interface):
```ts
interface BattleCombatant {
  element: Element
  spriteUrl: string            // resolveCreatureSprite(...)
  rarity: Rarity
  animState: 'idle'|'attack'|'damage'|'catch'|'flee'|'victory'
  fainting?: boolean
  hpPct: number                // 0..1, drives low-HP darken
}
interface BattleSceneProps {
  enemy: BattleCombatant
  player: BattleCombatant
  arena?: boolean              // true → both halves use ARENA_BACKGROUND (duels)
  freeze?: boolean             // crit freeze-frame
  children?: React.ReactNode   // HUD
}
```
Behavior:
- `enemyDim`/`playerDim` computed from `hpPct` (e.g. dim = `0.35 * (1 - hpPct)` clamped) so a near-dead creature's half darkens. When `freeze` true, push a global vignette + briefly pause particle animations (toggle a CSS class).
- `<CreatureStage>` is a thin wrapper: positions the cutout in its half (enemy upper-center, player lower-center), sizes responsively (`min(38vw, 22vh, 200px)`), forwards `animState`/`fainting` to `CreatureSprite` (showAura on).
- `arena` mode: both halves render `ARENA_BACKGROUND`, VS still shown.

**Acceptance:** `<BattleScene>` renders two themed halves with cutouts floating in them, fog seam, VS — visually equal to the mockup with REAL assets.

Commit `feat(battle): BattleScene compositor + CreatureStage + SeamFog`.

---

## Phase C — HUD overlays (match the screenshot)

> All HUD pieces are **overlays** rendered as `children` of `<BattleScene>`. They float over the art; they do not own layout of the scene.

### Task C1: `<CombatantCard>` (the floating info card)

**Files:**
- Create: `src/components/battle/CombatantCard.tsx`

Replaces the heavy `CreatureCard` for the in-scene overlay. Matches the screenshot card:
- Semi-transparent dark rounded card (`rgba(8,12,20,.6)` + `backdrop-blur`), border tinted by rarity/element.
- Row 1: element emoji chip + **name** (bold, ~18px).
- Row 2: rarity label pill (use `RARITY_LABELS`, colored via `RARITY_COLORS`) + element label ("Bosco"/"Terra"...). For the enemy, optionally a 5-star difficulty row (`★★☆☆☆`) like the screenshot — drive from `catch_difficulty` if available.
- Player card only: ATK row (`⚔ 102`).
- HP bar (good/mid/low color thresholds 50/25) + `current/max` mono numbers.
- Props mirror what each screen already has (name, element, rarity, currentHp, maxHp, atk?, side, stars?).

Position: enemy card top-left, player card lower-right area (per screenshot) — but the SCREEN places it; the card is layout-agnostic (accepts className/style).

**Acceptance:** visually equals the two cards in the screenshot.

Commit `feat(battle): CombatantCard floating info overlay`.

### Task C2: `<SquadBar>` portrait edition

**Files:**
- Create: `src/components/battle/SquadBar.tsx`

Three (or N) portrait tiles like the screenshot: rounded portrait + name + HP bar; active slot has a **gold crown + gold border**; fainted = grayscale + ✕. Tap a non-active, non-fainted slot → `onSwitch(id)` (the screen owns the confirm flow). Keep the existing switch-eligibility rules (not active, not fainted, turn budget left).

Commit `feat(battle): SquadBar portrait tiles`.

### Task C3: `<ActionBar>` hierarchic

**Files:**
- Create: `src/components/battle/ActionBar.tsx`

Match the screenshot's four buttons but with clear hierarchy:
- Primary action wide and colored (encounter: **CATTURA** orange `#E85D2F`→`#c94a20`; boss/duel: **ATTACCA**). Each button: icon + bold label + optional sub-line (e.g. catch chance, `turns/5`).
- Secondary buttons (LOTTA purple `#7B4DB8`, OGGETTI, FUGGI) styled per screenshot.
- Disabled/loading states (spinner) preserved from current screens.

Props are a list of action descriptors so each screen passes its own set (encounter has CATTURA+LOTTA+OGGETTI+FUGGI; boss has ATTACCA+items; duel has ATTACCA+items+forfeit).

Commit `feat(battle): ActionBar with action hierarchy`.

### Task C4: `<TurnTimer>` hairline + `<BattleTopBar>`

**Files:**
- Create: `src/components/battle/TurnTimer.tsx` (hairline progress + mono seconds; urgent shake < 5s)
- Create: `src/components/battle/BattleTopBar.tsx` (Lv + XP bar, gold, session timer, bell) — match screenshot; reuse existing GameShell data if available, else accept props.

Commit `feat(battle): TurnTimer + BattleTopBar`.

---

## Phase D — Damage / impact system (game-feel)

### Task D1: `<DamageBurst>` — ink/impact number

**Files:**
- Modify or wrap: `src/components/battle/FloatingDamage.tsx` → add a `<DamageBurst>` variant.

Spec:
- Normal hit: number in bold display, rises + scales, **radial impact splat** behind (cremisi `#C13A2B` for damage, green for poison-tick), 0.9s.
- **Crit**: gold number, ~1.4× size, gold splat, AND trigger the scene `freeze` for ~150 ms (pass a callback up; the screen sets `freeze` true then false). Optional micro screen-shake (translate the scene ±3px, 120ms).
- Heal: green `+N` rising softly.

Props: `{ amount; kind: 'damage'|'crit'|'poison'|'heal'; target: 'enemy'|'player' }`.

**Acceptance:** matches mockup phone 2 (crit −87 in gold + splat + freeze vignette).

Commit `feat(battle): DamageBurst with crit freeze + screen shake`.

### Task D2: Hit reactions on cutout + HP drain ghost

**Files:**
- Modify: `src/components/creature/CreatureSprite.tsx` (already has a `damage` variant — verify it reads well at scene scale)
- Modify: HP bar in `CombatantCard` to render a **trailing ghost** (a second bar that lags the real HP by ~300ms in a lighter red) so damage amount is visible as a draining tail.

Commit `feat(battle): HP drain ghost + verified hit reaction`.

---

## Phase E — Wire screens (one at a time, verify each)

> Do NOT touch combat logic, API calls, or state machines. Only swap the *presentation* layer: replace the old card/field markup with `<BattleScene>` + HUD components, feeding the same state values.

### Task E1: Encounter

**Files:**
- Modify: `src/app/game/encounter/[id]/page.tsx` (render block ~1329–1740)

- Replace the bespoke battle-field markup (wild card top, player card bottom, VS pill, damage floats, squad bar, action row) with:
  ```
  <BattleScene enemy={...} player={...} freeze={freeze}>
     <BattleTopBar .../>
     <CombatantCard side="enemy" .../>
     <CombatantCard side="player" .../>
     <DamageBurst .../>           // when lastDamage present
     <SquadBar .../>
     <TurnTimer .../>
     <ActionBar actions={[CATTURA, LOTTA, OGGETTI, FUGGI]} .../>
  </BattleScene>
  ```
- Keep the net-throw catch overlay, catch-success banner, items bottom-sheet (or migrate to side-drawer in Phase F), switch confirm, and the result overlays.
- Feed `spriteUrl={resolveCreatureSprite(creature)}` for both combatants. Ensure the encounter `start`/`get` API selects `sprite_cutout_url` (add it to the `.select(...)` if missing — search the encounter API routes).

**Verify:**
- Run `npm run typecheck` (no new errors).
- Run `npm run dev`, trigger an encounter, compare to `docs/mockups/2026-05-21-battle-immersive.html` + screenshot.
- Confirm: scene immersive, cards readable, VS + lightning, crit freeze, catch flow still works, switch still works, flee still works.

Commit `feat(encounter): immersive full-scene battle UI`.

### Task E2: Duel

**Files:**
- Modify: `src/app/game/duel/[id]/page.tsx`

Same swap. Use `arena` mode (`<BattleScene arena>`) since PvP mixes two elements — neutral arena reads fairer. Show both player nicknames in the top area (duel-specific). Keep realtime/turn/reconnection logic untouched. Action set: ATTACCA + items + forfeit.

Commit `feat(duel): immersive full-scene battle UI`.

### Task E3: Boss / Capo Palestra

**Files:**
- Modify: `src/components/game/boss/BattleScreen.tsx` + `src/app/game/boss/[id]/page.tsx`

Same swap. **Keep the existing boss-intro overlay** (`BattleScreen.tsx:653–774`) — it's the strongest moment; only re-tint it to the gold VS palette for consistency. Boss uses its gold theme accents on the HUD. Boss element backdrop = the boss creature's element; player half = active player creature's element. Action set: ATTACCA + items.

Commit `feat(boss): immersive full-scene battle UI`.

---

## Phase F — Game-designer animation polish

> The product owner asked for "animazioni come game designer esperti". Do this pass last, across all three screens, using the shared components so it lands everywhere at once.

### Task F1: Battle entrance choreography
- On mount: backgrounds fade+parallax-settle (250ms), creatures slide in from their sides with spring (enemy from right, player from left), VS lightning strike fires after both land, first turn timer starts only after the choreography (~1.2s). Encounter & duel get a lighter version; boss keeps its full intro then this.

### Task F2: Attack choreography
- Lunge (anticipation pull-back → snap forward, already in `CreatureSprite.attack`), spawn `AttackAnimation` element VFX traveling attacker→target, target plays `damage` variant + flash, `DamageBurst` lands at impact, HP ghost drains. Super-effective (element multiplier ≥ 1.5): add a brief element-colored ring pulse on the target + a marginal "Efficace!" label.

### Task F3: Crit, catch, faint, victory/defeat
- Crit: freeze-frame (D1) + zoom-punch on the scene (scale 1→1.04→1, 180ms) + gold flash.
- Catch success: creature cutout **dissolves into element particles** (catch variant + particle burst) then the bestiary reveal card slides up. Keep net-throw.
- Faint: grayscale + slump + sink + fade (extend `CreatureSprite`), then switch-in choreography for the next squad member.
- Victory/Defeat: restyle existing `ResultScreen` to the new palette/type; keep the boss victory confetti.

### Task F4: Background reactivity
- Low HP (<25%) of either combatant: that half slowly desaturates + a faint red vignette breathes. Status effects: tint the half (poison=green wash, sleep=blue dim, etc.) using `STATUS_EFFECT_META`.

### Task F5: Items as side-drawer (optional, if time)
- Replace the items bottom-sheet with a right side-drawer (~70% width) so the enemy stays visible while choosing. Item rows as small "cards" with icon + name + effect + quantity.

**Acceptance for Phase F:** each transition reads intentionally; nothing janks; 60fps on a mid phone; matches the polish bar of the boss intro across all moments.

Commit each task separately (`polish(battle): entrance choreography`, etc.).

---

## Visual spec quick-reference (so you don't guess)

- **Element accents** (`ELEMENT_THEME.glow`): bosco `#2ECC6A`, fiamma `#FF5520`, adriatico `#00C4E8`, terra `#D4A060`, armonia `#B060F8`. Boss gold `#F7C841`.
- **Rarity colors** (`RARITY_COLORS`) + **labels** (`RARITY_LABELS`) — reuse, don't invent.
- **HP thresholds:** >50% `#34D399`, >25% `#FBBF24`, else `#EF4444`.
- **Action colors:** CATTURA `linear-gradient(#E85D2F,#c94a20)`, LOTTA `linear-gradient(#7B4DB8,#5c3a8c)`, ATTACCA boss `linear-gradient(#E85D2F,#c94a20)` or gold when item active.
- **Damage:** normal `#EF4444`, crit gold `#F7C841`/`#FB923C`, poison `#4ADE80`, heal `#34D399`.
- **Fonts:** match the screenshot's bold rounded sans for names/labels; keep the app's existing body font elsewhere. Mono (tabular) for HP/ATK/timer numbers so they don't jitter. Do NOT introduce a serif/manuscript direction — the owner rejected that.
- **Cards:** `rgba(8,12,20,.55–.65)` + `backdrop-filter: blur(12px)`, 1px rarity/element-tinted border, radius 16–20.

---

## Acceptance criteria (whole feature)

1. Encounter, duel, boss all render the immersive full-scene layout matching `docs/mockups/2026-05-21-battle-immersive.html` + the approved screenshot, with REAL element backgrounds and transparent creature cutouts.
2. No creature shows a baked rectangular background in battle (cutout-first; baked art only as fallback when a cutout failed).
2b. **Non-destructive verified:** every creature's `image_url` is byte-identical to before this work; old storage objects still present; reverting Phase B–F restores the current app exactly. No old asset deleted.
3. Combat logic, APIs, realtime, anti-cheat, timers, switch/heal/item/flee flows are behaviorally unchanged (verify by playing each mode end-to-end).
4. `npm run typecheck` shows no NEW errors; `npx vitest run` green except the 4 known pre-existing balance failures.
5. Animations: entrance, attack, crit freeze, catch dissolve, faint, victory/defeat all present and smooth on a mid-tier phone.
6. New creatures generated via the admin artwork tool produce a transparent cutout automatically (gpt-image-2 + `background:transparent`).

---

## What only YOU (CLI agent) can do — checklist

- [ ] `npx supabase db push` for migration 044
- [ ] `npx supabase gen types typescript --linked` to regen DB types
- [ ] Generate the 6 background webp via gpt-image-2 (needs `OPENAI_API_KEY`)
- [ ] Dry-run regeneration on ONE creature, get owner sign-off on the style, THEN batch
- [ ] Run the creature regeneration batch (non-destructive: writes `sprite_cutout_url` + cutout path only)
- [ ] Confirm storage bucket `creature-artwork` is public and holds `creatures/cutouts/*` (old `creatures/*.png` untouched)
- [ ] Verify NO creature's `image_url` changed (e.g. snapshot before/after)
- [ ] Verify `OPENAI_API_KEY` present in the env you run against
- [ ] Do NOT delete any old asset — deletion is a separate, owner-approved follow-up

## Suggested commit / branch hygiene

- Branch: `feat/battle-immersive-ui`
- One commit per task above (messages provided). Open a PR when Phase E is playable; land Phase F polish in follow-up commits.
- Do NOT skip hooks. Do NOT force-push. Keep combat logic out of the diffs (presentation-only).
