# Level EXP Cap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allineare EXP, level-up e progressione UI alla curva ufficiale con livello massimo 99.

**Architecture:** La progressione verrà centralizzata in un helper TypeScript condiviso e in una nuova migrazione SQL che riallinea la RPC `increment_player_stats`. I flow che passano già dalla RPC erediteranno il fix automaticamente; il solo flow legacy `redeem-item` userà lo stesso helper per restare coerente.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Vitest, Supabase/Postgres SQL migrations.

---

### Task 1: Documentare la curva EXP condivisa

**Files:**
- Create: `src/lib/game/leveling.ts`
- Test: `src/lib/game/__tests__/leveling.test.ts`

**Step 1: Write the failing test**

Verificare:
- `7055 EXP` porta al livello `20`
- `7915 EXP` porta al livello `21`
- `getLevelForExp(...)` non supera `99`
- `getExpProgress(...)` restituisce `100%` al livello `99`

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/game/__tests__/leveling.test.ts`

**Step 3: Write minimal implementation**

Creare helper con:
- `MAX_PLAYER_LEVEL`
- `getExpToNextLevel`
- `getTotalExpForLevel`
- `getLevelForExp`
- `getExpProgress`

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/game/__tests__/leveling.test.ts`

**Step 5: Commit**

```bash
git add src/lib/game/leveling.ts src/lib/game/__tests__/leveling.test.ts
git commit -m "fix: add shared leveling curve helper"
```

### Task 2: Riallineare la RPC SQL e il cap massimo

**Files:**
- Create: `supabase/migrations/023_level_cap_99.sql`

**Step 1: Write the failing test**

Usare il test TypeScript come spec della curva, poi validare che la migrazione ricrei `increment_player_stats` con:
- uso di `level_exp_config`
- cap massimo `99`
- normalizzazione `20..99 = 860`

**Step 2: Run test to verify it fails**

Confermare dal codice attuale che la funzione usa ancora `v_new_exp / 50 + 1`.

**Step 3: Write minimal implementation**

Creare migrazione che:
- reinserisce `20..99` a `860`
- ricrea `increment_player_stats`
- limita `new_level` a `99`

**Step 4: Run test to verify it passes**

Verificare il file SQL e i riferimenti da repo.

**Step 5: Commit**

```bash
git add supabase/migrations/023_level_cap_99.sql
git commit -m "fix: cap level progression at 99"
```

### Task 3: Correggere i flow TypeScript che bypassano la RPC

**Files:**
- Modify: `src/app/api/admin/players/redeem-item/route.ts`
- Modify: `src/app/api/admin/exp-config/route.ts`
- Test: `src/app/api/admin/players/redeem-item/__tests__/route.test.ts`

**Step 1: Write the failing test**

Testare che `redeem-item`:
- usi la curva corretta vicino alla soglia `19 -> 20`
- non superi il livello `99`

Testare che `exp-config`:
- rifiuti livelli oltre `99`
- forzi `860` per i livelli `20..99`

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/api/admin/players/redeem-item/__tests__/route.test.ts`

**Step 3: Write minimal implementation**

Importare il helper di livellamento in `redeem-item` e aggiornare la validazione di `exp-config`.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/api/admin/players/redeem-item/__tests__/route.test.ts`

**Step 5: Commit**

```bash
git add src/app/api/admin/players/redeem-item/route.ts src/app/api/admin/exp-config/route.ts src/app/api/admin/players/redeem-item/__tests__/route.test.ts
git commit -m "fix: align admin exp flows with level cap"
```

### Task 4: Aggiornare la progress bar EXP lato UI

**Files:**
- Modify: `src/components/GameShell.tsx`

**Step 1: Write the failing test**

Usare il test del helper come oracolo per la percentuale mostrata dalla UI.

**Step 2: Run test to verify it fails**

Confermare che `GameShell` usa ancora blocchi fissi da `50 EXP`.

**Step 3: Write minimal implementation**

Sostituire la formula inline con `getExpProgress`.

**Step 4: Run test to verify it passes**

Verificare con lint/test TypeScript mirati.

**Step 5: Commit**

```bash
git add src/components/GameShell.tsx
git commit -m "fix: update exp progress bar for capped curve"
```

### Task 5: Eseguire verifica finale

**Files:**
- Modify: nessuno

**Step 1: Run targeted tests**

```bash
npm run test:run -- src/lib/game/__tests__/leveling.test.ts src/app/api/admin/players/redeem-item/__tests__/route.test.ts
```

**Step 2: Run broader safety checks**

```bash
npm run test:run
```

**Step 3: Review diff**

```bash
git diff -- docs/plans/2026-04-21-level-exp-cap-design.md docs/plans/2026-04-21-level-exp-cap.md src/lib/game/leveling.ts src/app/api/admin/players/redeem-item/route.ts src/app/api/admin/exp-config/route.ts src/components/GameShell.tsx supabase/migrations/023_level_cap_99.sql
```

**Step 4: Commit**

```bash
git add .
git commit -m "fix: align exp progression with level 99 cap"
```
