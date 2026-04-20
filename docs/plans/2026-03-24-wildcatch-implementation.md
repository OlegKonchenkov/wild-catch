# WildCatch — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build WildCatch, a mobile-first PWA for outdoor live events where players explore a GPS-bounded area, catch creatures, solve narrative missions via QR codes, and duel each other in realtime.

**Architecture:** Next.js 15 App Router for frontend + API routes; Supabase for PostgreSQL + Google OAuth + Realtime WebSocket + Storage; Vercel Hobby (free) for hosting. All game logic (RNG, catch, fight, scoring) runs server-side only. Session closure handled by Supabase pg_cron + GPS API check-on-poll.

**Tech Stack:** Next.js 15, Tailwind CSS v4, Framer Motion, lottie-react, Supabase JS v2, next-pwa, Leaflet + react-leaflet, Resend, Vitest, @testing-library/react, OpenAI SDK (gpt-image-1)

**Spec:** `docs/superpowers/specs/2026-03-24-wildcatch-design.md`

---

## Phase 1: Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `.env.local.example`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Step 1: Initialize Next.js 15 project**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git
```

When prompted: yes to TypeScript, yes to Tailwind, yes to App Router, yes to src dir.

**Step 2: Install all dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr framer-motion lottie-react leaflet react-leaflet next-pwa resend openai qrcode jspdf
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @types/leaflet @types/qrcode
```

**Step 3: Configure Vitest**

Replace contents of `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

**Step 4: Add test script to package.json**

In `package.json`, add to scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 5: Configure `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
```

**Step 6: Create `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Resend (magic link email)
RESEND_API_KEY=re_...

# OpenAI (artwork generation)
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copy to `.env.local` and fill in values from Supabase project settings.

**Step 7: Run dev server to verify scaffold**

```bash
npm run dev
```

Expected: server starts at http://localhost:3000 without errors.

**Step 8: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js 15 project with full dependency set"
```

---

### Task 2: Supabase Client Helpers + Types

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/types.ts`

**Step 1: Write failing type test**

Create `src/lib/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Creature, Session, PlayerSession } from '@/lib/types'

describe('types', () => {
  it('Creature type has required fields', () => {
    const c: Creature = {
      id: 'uuid', name: 'Fiammare', description: 'desc',
      element: 'fiamma', rarity: 'comune', hp: 60, atk: 40, def: 30,
      min_level: 1, image_url: '', sprite_url: '', lottie_url: null,
      spawn_weight: 10, evolution_of: null,
    }
    expect(c.element).toBe('fiamma')
  })

  it('Session status enum is valid', () => {
    const statuses: Session['status'][] = ['draft', 'ready', 'active', 'ended']
    expect(statuses).toHaveLength(4)
  })
})
```

**Step 2: Run test to see it fail**

```bash
npm run test:run -- src/lib/__tests__/types.test.ts
```

Expected: FAIL — `@/lib/types` not found.

**Step 3: Create `src/lib/types.ts`**

```typescript
export type Element = 'fiamma' | 'adriatico' | 'bosco' | 'terra' | 'armonia'
export type Rarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario'
export type SessionStatus = 'draft' | 'ready' | 'active' | 'ended'
export type ItemType = 'rete' | 'esca' | 'uovo' | 'battaglia'
export type QRCodeType = 'uovo' | 'indizio' | 'oggetto' | 'boss' | 'evento'
export type EncounterStatus = 'active' | 'caught' | 'fled' | 'fought'
export type DuelStatus = 'waiting' | 'active' | 'ended'
export type PlayerRole = 'player' | 'boss' | 'villain'

export interface NarrativeConfig {
  story_title: string
  intro_text: string
  villain_name: string
  chapters: Array<{ order: number; title: string; description: string }>
}

export interface Creature {
  id: string
  name: string
  description: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  def: number
  min_level: number
  image_url: string
  sprite_url: string
  lottie_url: string | null
  spawn_weight: number
  evolution_of: string | null
}

export interface Session {
  id: string
  name: string
  status: SessionStatus
  area_bounds: { north: number; south: number; east: number; west: number }
  duration_minutes: number
  start_at: string | null
  end_at: string | null
  auto_end: boolean
  narrative_config: NarrativeConfig
  created_at: string
}

export interface SessionInvite {
  id: string
  session_id: string
  code: string
  used_by_user_id: string | null
  used_at: string | null
  is_active: boolean
}

export interface PlayerSession {
  id: string
  user_id: string
  session_id: string
  level: number
  exp: number
  gold: number
  role: PlayerRole
  last_position: { x: number; y: number } | null
  score_final: number | null
  selected_creature_id: string | null
  joined_at: string
}

export interface PlayerCreature {
  id: string
  user_id: string
  creature_id: string
  session_id: string
  duplicates_count: number
  evolved: boolean
  caught_at: string
  creature?: Creature
}

export interface Item {
  id: string
  name: string
  type: ItemType
  effect_value: number
  description: string
  shop_price: number
}

export interface PlayerInventory {
  id: string
  user_id: string
  session_id: string
  item_id: string
  quantity: number
  item?: Item
}

export interface Encounter {
  id: string
  user_id: string
  creature_id: string
  session_id: string
  status: EncounterStatus
  trigger: 'gps' | 'timer'
  wild_creature_hp: number
  player_creature_id: string | null
  started_at: string
  resolved_at: string | null
}

export interface Duel {
  id: string
  challenger_id: string
  opponent_id: string | null
  session_id: string
  status: DuelStatus
  winner_id: string | null
  challenger_creature_id: string
  opponent_creature_id: string | null
  room_code: string
  started_at: string
  ended_at: string | null
}

export interface Mission {
  id: string
  session_id: string
  chapter_order: number
  title: string
  description: string
  type: string
  target: string
  target_count: number
  reward_gold: number
  reward_exp: number
  reward_item_id: string | null
  is_required: boolean
}

export interface QRCode {
  id: string
  session_id: string
  type: QRCodeType
  payload: Record<string, unknown>
  uses_remaining: number | null
  label: string
  created_at: string
}

export interface HallOfFame {
  id: string
  user_id: string
  session_id: string
  rank: number
  score: number
  creatures_caught: number
  season_label: string
  awarded_at: string
}

// Element type chart: attacker element -> multiplier for defender
export const ELEMENT_MULTIPLIERS: Record<Element, Partial<Record<Element, number>>> = {
  fiamma: { bosco: 1.5, adriatico: 0.5, terra: 0.5 },
  adriatico: { fiamma: 1.5, terra: 1.5, bosco: 0.5 },
  bosco: { adriatico: 1.5, fiamma: 0.5 },
  terra: { fiamma: 1.5, adriatico: 0.5 },
  armonia: {},  // +15% base damage against all handled separately
}

export const RARITY_CATCH_RATES: Record<Rarity, number> = {
  comune: 0.70,
  non_comune: 0.45,
  raro: 0.25,
  epico: 0.12,
  leggendario: 0.05,
}

export const RARITY_COLORS: Record<Rarity, string> = {
  comune: '#7AB87A',
  non_comune: '#4A9FD4',
  raro: '#E8A820',
  epico: '#7B4DB8',
  leggendario: '#C8352A',
}

export const ELEMENT_EMOJI: Record<Element, string> = {
  fiamma: '🔥',
  adriatico: '🌊',
  bosco: '🌿',
  terra: '⛰️',
  armonia: '🎵',
}
```

**Step 4: Create Supabase client helpers**

`src/lib/supabase/client.ts` (browser-side, for components):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts` (server-side, for API routes + Server Components):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

`src/lib/supabase/admin.ts` (service role, bypasses RLS — only for admin API routes):
```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

**Step 5: Run type test to verify it passes**

```bash
npm run test:run -- src/lib/__tests__/types.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add types, Supabase client helpers"
```

---

### Task 3: Database Migrations

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`
- Create: `supabase/migrations/003_pg_cron_session_close.sql`

**Step 1: Install Supabase CLI**

```bash
npm install --save-dev supabase
npx supabase init
```

This creates the `supabase/` directory with config.

**Step 2: Write `001_initial_schema.sql`**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- ============================================================
-- Core tables (permanent, survive session resets)
-- ============================================================

-- Extend Supabase auth.users with app-specific fields
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS gdpr_consent_minor BOOLEAN DEFAULT FALSE;

-- Creature catalogue
CREATE TABLE creatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  element TEXT NOT NULL CHECK (element IN ('fiamma','adriatico','bosco','terra','armonia')),
  rarity TEXT NOT NULL CHECK (rarity IN ('comune','non_comune','raro','epico','leggendario')),
  hp INTEGER NOT NULL CHECK (hp > 0),
  atk INTEGER NOT NULL CHECK (atk > 0),
  def INTEGER NOT NULL CHECK (def >= 0),
  min_level INTEGER NOT NULL DEFAULT 1,
  image_url TEXT NOT NULL DEFAULT '',
  sprite_url TEXT NOT NULL DEFAULT '',
  lottie_url TEXT,
  spawn_weight INTEGER NOT NULL DEFAULT 10,
  evolution_of UUID REFERENCES creatures(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items catalogue
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rete','esca','uovo','battaglia')),
  effect_value NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  shop_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Session tables
-- ============================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','active','ended')),
  area_bounds JSONB NOT NULL DEFAULT '{}',
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  auto_end BOOLEAN NOT NULL DEFAULT TRUE,
  narrative_config JSONB NOT NULL DEFAULT '{"story_title":"","intro_text":"","villain_name":"","chapters":[]}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  used_by_user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_session_invites_code ON session_invites(code);
CREATE INDEX idx_session_invites_session ON session_invites(session_id);

CREATE TABLE player_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','boss','villain')),
  last_position POINT,
  score_final INTEGER,
  selected_creature_id UUID,  -- FK to player_creatures set after creature tables exist
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);
CREATE INDEX idx_player_sessions_session ON player_sessions(session_id);
CREATE INDEX idx_player_sessions_user ON player_sessions(user_id);

CREATE TABLE hall_of_fame (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  creatures_caught INTEGER NOT NULL,
  season_label TEXT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Gameplay tables
-- ============================================================

CREATE TABLE player_creatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  creature_id UUID NOT NULL REFERENCES creatures(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  duplicates_count INTEGER NOT NULL DEFAULT 1,
  evolved BOOLEAN NOT NULL DEFAULT FALSE,
  caught_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_player_creatures_user_session ON player_creatures(user_id, session_id);

-- Add FK now that player_creatures exists
ALTER TABLE player_sessions
  ADD CONSTRAINT fk_selected_creature
  FOREIGN KEY (selected_creature_id) REFERENCES player_creatures(id);

CREATE TABLE player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE(user_id, session_id, item_id)
);
CREATE INDEX idx_player_inventory_user_session ON player_inventory(user_id, session_id);

CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  creature_id UUID NOT NULL REFERENCES creatures(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','caught','fled','fought')),
  trigger TEXT NOT NULL CHECK (trigger IN ('gps','timer')),
  wild_creature_hp INTEGER NOT NULL,
  player_creature_id UUID REFERENCES player_creatures(id),  -- locked at encounter/start
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_encounters_user_session ON encounters(user_id, session_id, status);

CREATE TABLE duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id),
  opponent_id UUID REFERENCES auth.users(id),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','ended')),
  winner_id UUID REFERENCES auth.users(id),
  challenger_creature_id UUID NOT NULL REFERENCES player_creatures(id),
  opponent_creature_id UUID REFERENCES player_creatures(id),
  room_code TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  UNIQUE(session_id, room_code, status)  -- room_code unique among active duels
);
CREATE INDEX idx_duels_room_code ON duels(room_code, status);

-- ============================================================
-- Missions & QR
-- ============================================================

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  chapter_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 1,
  reward_gold INTEGER NOT NULL DEFAULT 0,
  reward_exp INTEGER NOT NULL DEFAULT 0,
  reward_item_id UUID REFERENCES items(id),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, mission_id)
);

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('uovo','indizio','oggetto','boss','evento')),
  payload JSONB NOT NULL,
  uses_remaining INTEGER,  -- NULL = unlimited
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by_admin_id UUID REFERENCES auth.users(id)
);
```

**Step 3: Write `002_rls_policies.sql`**

Create `supabase/migrations/002_rls_policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_creatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT COALESCE(is_admin, FALSE) FROM auth.users WHERE id = auth.uid()
$$;

-- Helper: check if user is in an active session
CREATE OR REPLACE FUNCTION is_in_session(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM player_sessions
    WHERE user_id = auth.uid() AND session_id = p_session_id
  )
$$;

-- creatures: readable by all authenticated users; writable by admin only
CREATE POLICY "creatures_read" ON creatures FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "creatures_admin_write" ON creatures FOR ALL TO authenticated USING (is_admin());

-- items: same as creatures
CREATE POLICY "items_read" ON items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "items_admin_write" ON items FOR ALL TO authenticated USING (is_admin());

-- sessions: readable by authenticated; writable by admin
CREATE POLICY "sessions_read" ON sessions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sessions_admin_write" ON sessions FOR ALL TO authenticated USING (is_admin());

-- session_invites: admin can do all; players can SELECT own code only
CREATE POLICY "invites_admin" ON session_invites FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "invites_own_read" ON session_invites FOR SELECT TO authenticated
  USING (used_by_user_id = auth.uid());

-- player_sessions: own row only; admin sees all
CREATE POLICY "ps_own" ON player_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- hall_of_fame: readable by all; writable by admin only (or service role)
CREATE POLICY "hof_read" ON hall_of_fame FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "hof_admin_write" ON hall_of_fame FOR ALL TO authenticated USING (is_admin());

-- player_creatures: own rows; admin sees all
CREATE POLICY "pc_own" ON player_creatures FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- player_inventory: own rows; admin sees all
CREATE POLICY "pi_own" ON player_inventory FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- encounters: own rows; admin sees all
CREATE POLICY "enc_own" ON encounters FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- duels: participants or admin
CREATE POLICY "duel_participants" ON duels FOR ALL TO authenticated
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid() OR is_admin());

-- missions: readable by players in session; writable by admin
CREATE POLICY "missions_read" ON missions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "missions_admin_write" ON missions FOR ALL TO authenticated USING (is_admin());

-- player_missions: own rows
CREATE POLICY "pm_own" ON player_missions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- qr_codes: readable by authenticated in session; writable by admin
CREATE POLICY "qr_read" ON qr_codes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qr_admin_write" ON qr_codes FOR ALL TO authenticated USING (is_admin());

-- notifications: readable by all authenticated; writable by admin
CREATE POLICY "notif_read" ON notifications FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "notif_admin_write" ON notifications FOR ALL TO authenticated USING (is_admin());
```

**Step 4: Write `003_pg_cron_session_close.sql`**

Create `supabase/migrations/003_pg_cron_session_close.sql`:

```sql
-- Enable pg_cron extension (Supabase free tier includes this)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: close expired sessions and generate final scores
CREATE OR REPLACE FUNCTION close_expired_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Mark expired sessions as ended
  UPDATE sessions
  SET status = 'ended'
  WHERE status = 'active'
    AND auto_end = TRUE
    AND end_at IS NOT NULL
    AND NOW() >= end_at;
END;
$$;

-- Run every minute (pg_cron is free on Supabase)
SELECT cron.schedule(
  'close-expired-sessions',
  '* * * * *',
  'SELECT close_expired_sessions()'
);

-- Keep-alive: prevent Supabase free tier pausing after 7 days inactivity
-- This Vercel cron (daily) does a simple SELECT; set up via vercel.json
-- See: vercel.json -> crons -> /api/cron/keepalive
```

**Step 5: Apply migrations to Supabase**

Link your Supabase project first:
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Verify in Supabase Dashboard → Table Editor that all tables are created.

**Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add database migrations, RLS policies, pg_cron session close"
```

---

### Task 4: Auth + Middleware + Invite Join Flow

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/api/auth/join/route.ts`
- Create: `src/app/page.tsx` (landing)
- Test: `src/app/api/auth/__tests__/join.test.ts`

**Step 1: Write failing test for join endpoint**

Create `src/app/api/auth/__tests__/join.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { POST } from '../join/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/auth/join', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 if no code provided', async () => {
    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('codice')
  })

  it('returns 404 if code not found', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: { message: 'not found' } })),
            })),
          })),
        })),
      })),
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'user1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const req = new Request('http://localhost/api/auth/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'ABCD1234' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/app/api/auth/__tests__/join.test.ts
```

Expected: FAIL — route file not found.

**Step 3: Create the join API route**

Create `src/app/api/auth/join/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { code } = body

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'Codice invito mancante' }, { status: 400 })
  }

  // Find invite code
  const { data: invite, error: inviteError } = await supabase
    .from('session_invites')
    .select('*, sessions!inner(id, status)')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Codice non valido o già usato' }, { status: 404 })
  }

  // Check code not already used
  if (invite.used_by_user_id) {
    return NextResponse.json({ error: 'Codice già utilizzato' }, { status: 409 })
  }

  // Check session is ready or active
  const sessionStatus = (invite as any).sessions.status
  if (!['ready', 'active'].includes(sessionStatus)) {
    return NextResponse.json({ error: "L'evento non è ancora disponibile" }, { status: 403 })
  }

  const sessionId = invite.session_id

  // Check player not already in session
  const { data: existing } = await supabase
    .from('player_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (existing) {
    // Already joined, just mark code as used if not yet
    return NextResponse.json({ sessionId, alreadyJoined: true })
  }

  // Mark invite as used and create player_session atomically
  const { error: updateError } = await supabase
    .from('session_invites')
    .update({ used_by_user_id: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (updateError) {
    return NextResponse.json({ error: 'Errore di sistema' }, { status: 500 })
  }

  // Create player session with starter kit
  const { error: psError } = await supabase.from('player_sessions').insert({
    user_id: user.id,
    session_id: sessionId,
    gold: 100,
  })

  if (psError) {
    return NextResponse.json({ error: 'Errore creazione profilo giocatore' }, { status: 500 })
  }

  // Give starter kit: 5x Rete Base
  const { data: reteBase } = await supabase
    .from('items')
    .select('id')
    .eq('name', 'Rete Base')
    .single()

  if (reteBase) {
    await supabase.from('player_inventory').insert({
      user_id: user.id,
      session_id: sessionId,
      item_id: reteBase.id,
      quantity: 5,
    })
  }

  return NextResponse.json({ sessionId })
}
```

**Step 4: Create middleware**

Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect /game/* routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/game') && !user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protect /admin/* routes — must be authenticated + admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    const { data: userData } = await supabase
      .from('auth.users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!userData?.is_admin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/game/:path*', '/admin/:path*', '/auth/:path*'],
}
```

**Step 5: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/game/map'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
```

**Step 6: Create landing page**

Create `src/app/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleGoogleSignIn() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Store code and redirect to login
      sessionStorage.setItem('pending_code', code.toUpperCase())
      await handleGoogleSignIn()
      return
    }

    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    router.push('/game/map')
  }

  return (
    <main className="min-h-screen bg-[#0F1F2E] flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-white mb-2">WildCatch</h1>
      <p className="text-[#3A9DBC] text-sm mb-10">
        La prima avventura outdoor dove catturi creature e risolvi misteri
      </p>

      <form onSubmit={handleJoinWithCode} className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="Inserisci codice invito"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-center text-xl tracking-widest uppercase"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="w-full bg-[#E85D2F] text-white font-bold py-4 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Connessione...' : 'PARTECIPA'}
        </button>
      </form>

      <div className="my-6 text-white/30 text-sm">oppure accedi con</div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex items-center gap-3 bg-white text-[#1C2B3A] font-semibold px-6 py-3 rounded-xl"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continua con Google
      </button>
    </main>
  )
}
```

**Step 7: Run tests**

```bash
npm run test:run -- src/app/api/auth/__tests__/join.test.ts
```

Expected: PASS

**Step 8: Commit**

```bash
git add src/
git commit -m "feat: auth middleware, join endpoint, landing page"
```

---

## Phase 2: Core Game Loop

### Task 5: Game Shell + GPS Hook + Position API

**Files:**
- Create: `src/app/(game)/layout.tsx`
- Create: `src/hooks/useGPS.ts`
- Create: `src/app/api/game/position/route.ts`
- Create: `src/lib/game/anti-cheat.ts`
- Test: `src/lib/game/__tests__/anti-cheat.test.ts`

**Step 1: Write failing anti-cheat tests**

Create `src/lib/game/__tests__/anti-cheat.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isValidGPSSpeed } from '@/lib/game/anti-cheat'

describe('isValidGPSSpeed', () => {
  it('accepts normal walking speed', () => {
    // 10m in 10s = 1 m/s = 3.6 km/h
    expect(isValidGPSSpeed(
      { lat: 43.9097, lng: 12.9094 },
      { lat: 43.9098, lng: 12.9094 }, // ~11m north
      10000 // 10 seconds
    )).toBe(true)
  })

  it('rejects teleportation (>60 km/h)', () => {
    // 1km in 1s
    expect(isValidGPSSpeed(
      { lat: 43.9097, lng: 12.9094 },
      { lat: 43.9187, lng: 12.9094 }, // ~1000m
      1000  // 1 second
    )).toBe(false)
  })

  it('accepts first position (no previous)', () => {
    expect(isValidGPSSpeed(null, { lat: 43.9097, lng: 12.9094 }, 0)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/game/__tests__/anti-cheat.test.ts
```

Expected: FAIL

**Step 3: Create anti-cheat module**

Create `src/lib/game/anti-cheat.ts`:

```typescript
const MAX_SPEED_KMH = 60
const EARTH_RADIUS_M = 6371000

interface LatLng { lat: number; lng: number }

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function isValidGPSSpeed(
  previous: LatLng | null,
  current: LatLng,
  elapsedMs: number
): boolean {
  if (!previous || elapsedMs === 0) return true
  const distanceM = haversineDistance(previous, current)
  const speedKmh = (distanceM / (elapsedMs / 1000)) * 3.6
  return speedKmh <= MAX_SPEED_KMH
}

export function isWithinBounds(
  pos: LatLng,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return pos.lat <= bounds.north && pos.lat >= bounds.south &&
         pos.lng <= bounds.east && pos.lng >= bounds.west
}
```

**Step 4: Create GPS hook**

Create `src/hooks/useGPS.ts`:

```typescript
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

export interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export function useGPS(onPosition?: (pos: GPSPosition) => void) {
  const [position, setPosition] = useState<GPSPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('GPS non disponibile su questo dispositivo')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gpsPos: GPSPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        setPosition(gpsPos)
        onPosition?.(gpsPos)
      },
      (err) => {
        switch (err.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            setError('Abilita il GPS per giocare')
            break
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            setError('GPS non disponibile. Spostati in un luogo aperto')
            break
          default:
            setError('Errore GPS')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, error }
}
```

**Step 5: Create position API route**

Create `src/app/api/game/position/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidGPSSpeed, isWithinBounds } from '@/lib/game/anti-cheat'

// Rate limiting: track last request time per user in memory
// For production scale, use Redis; for MVP this works within a single serverless instance
const lastRequestTime = new Map<string, number>()
const RATE_LIMIT_MS = 5000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Rate limit: 1 req per 5s per user
  const now = Date.now()
  const lastTime = lastRequestTime.get(user.id) ?? 0
  if (now - lastTime < RATE_LIMIT_MS) {
    return NextResponse.json({ error: 'Troppo veloce' }, { status: 429 })
  }
  lastRequestTime.set(user.id, now)

  const { lat, lng, accuracy, sessionId } = await request.json()

  if (!lat || !lng || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get player session
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('id, last_position, joined_at')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Get session details
  const { data: session } = await supabase
    .from('sessions')
    .select('status, area_bounds, end_at')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Check session expiry
  if (session.status === 'ended') {
    return NextResponse.json({ sessionEnded: true })
  }
  if (session.status === 'active' && session.end_at && new Date() >= new Date(session.end_at)) {
    // Close the session immediately
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', sessionId)
    return NextResponse.json({ sessionEnded: true })
  }

  const currentPos = { lat, lng }
  const prevPos = playerSession.last_position
    ? { lat: (playerSession.last_position as any).x, lng: (playerSession.last_position as any).y }
    : null
  const elapsed = prevPos ? now - new Date(playerSession.joined_at).getTime() : 0

  // Anti-cheat: validate speed
  if (!isValidGPSSpeed(prevPos, currentPos, elapsed)) {
    return NextResponse.json({ error: 'Spostamento non valido', valid: false }, { status: 400 })
  }

  // Check within bounds
  const bounds = session.area_bounds as any
  const inBounds = bounds ? isWithinBounds(currentPos, bounds) : true

  // Update GPS position
  await supabase
    .from('player_sessions')
    .update({ last_position: `(${lat},${lng})` })
    .eq('id', playerSession.id)

  // Determine if encounter should trigger
  let triggerEncounter = false
  if (inBounds && session.status === 'active') {
    const distanceMoved = prevPos
      ? Math.sqrt((lat - prevPos.lat) ** 2 + (lng - prevPos.lng) ** 2) * 111000
      : 0
    const highAccuracy = accuracy < 50

    if (highAccuracy && distanceMoved >= 20) {
      // Random chance weighted by zone (simplified: flat 15% per 20m movement)
      triggerEncounter = Math.random() < 0.15
    } else if (!highAccuracy) {
      // GPS fallback: timer-based trigger (handled client-side with 60-180s random)
      triggerEncounter = false
    }
  }

  return NextResponse.json({
    valid: true,
    inBounds,
    triggerEncounter,
    sessionStatus: session.status,
  })
}
```

**Step 6: Create game shell layout**

Create `src/app/(game)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GameShell from '@/components/GameShell'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return <GameShell>{children}</GameShell>
}
```

Create `src/components/GameShell.tsx`:

```tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/game/map',      icon: '🗺️', label: 'Mappa'     },
  { href: '/game/bestiary', icon: '📖', label: 'Bestiario' },
  { href: '/game/missions', icon: '🎯', label: 'Missioni'  },
  { href: '/game/backpack', icon: '🎒', label: 'Zaino'     },
  { href: '/game/profile',  icon: '👤', label: 'Profilo'   },
]

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-screen bg-[#0F1F2E] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0F1F2E]/95 border-b border-white/10 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#F7C841]">Lv 1</span>
          <div className="w-24 h-2 bg-white/10 rounded-full">
            <div className="h-full w-1/3 bg-[#F7C841] rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#D4A96A]">
          <span className="text-sm">💰</span>
          <span className="text-sm font-bold">100</span>
        </div>
        {/* Timer placeholder — populated by game state */}
        <div className="text-sm text-[#E85D2F] font-mono">⏱ --:--</div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">{children}</main>

      {/* Bottom navigation */}
      <nav className="flex border-t border-white/10 bg-[#0F1F2E]/95">
        {NAV_ITEMS.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
              pathname === href ? 'text-[#3A9DBC]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
```

**Step 7: Run anti-cheat tests**

```bash
npm run test:run -- src/lib/game/__tests__/anti-cheat.test.ts
```

Expected: PASS

**Step 8: Commit**

```bash
git add src/
git commit -m "feat: game shell, GPS hook, position API with anti-cheat"
```

---

### Task 6: Encounter API (start + catch + fight)

**Files:**
- Create: `src/lib/game/rng.ts`
- Create: `src/lib/game/elements.ts`
- Create: `src/app/api/game/encounter/start/route.ts`
- Create: `src/app/api/game/encounter/catch/route.ts`
- Create: `src/app/api/game/encounter/fight/route.ts`
- Test: `src/lib/game/__tests__/rng.test.ts`
- Test: `src/lib/game/__tests__/elements.test.ts`

**Step 1: Write failing RNG tests**

Create `src/lib/game/__tests__/rng.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { rollCatch, rollDice, selectCreatureForEncounter } from '@/lib/game/rng'
import type { Rarity } from '@/lib/types'

describe('rollCatch', () => {
  it('comune with no bonus catches more than 60% of the time', () => {
    let caught = 0
    for (let i = 0; i < 1000; i++) if (rollCatch('comune', 0)) caught++
    expect(caught).toBeGreaterThan(600)
    expect(caught).toBeLessThan(800)
  })

  it('leggendario without bonus misses most of the time', () => {
    let caught = 0
    for (let i = 0; i < 1000; i++) if (rollCatch('leggendario', 0)) caught++
    expect(caught).toBeLessThan(100)
  })

  it('bonus additivo increases catch rate', () => {
    let noBonus = 0, withBonus = 0
    for (let i = 0; i < 1000; i++) {
      if (rollCatch('raro', 0)) noBonus++
      if (rollCatch('raro', 0.20)) withBonus++
    }
    expect(withBonus).toBeGreaterThan(noBonus)
  })
})

describe('rollDice', () => {
  it('returns value between 0.8 and 1.2', () => {
    for (let i = 0; i < 100; i++) {
      const v = rollDice()
      expect(v).toBeGreaterThanOrEqual(0.8)
      expect(v).toBeLessThanOrEqual(1.2)
    }
  })
})

describe('selectCreatureForEncounter', () => {
  it('selects creature proportional to spawn_weight', () => {
    const creatures = [
      { id: 'a', spawn_weight: 90, rarity: 'comune' as Rarity, min_level: 1 },
      { id: 'b', spawn_weight: 10, rarity: 'raro' as Rarity, min_level: 1 },
    ]
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 1000; i++) {
      const c = selectCreatureForEncounter(creatures, 1)
      counts[c!.id as 'a' | 'b']++
    }
    expect(counts.a).toBeGreaterThan(800)
    expect(counts.b).toBeLessThan(200)
  })
})
```

Create `src/lib/game/__tests__/elements.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getElementMultiplier } from '@/lib/game/elements'

describe('getElementMultiplier', () => {
  it('fiamma vs bosco = 1.5 (advantage)', () => {
    expect(getElementMultiplier('fiamma', 'bosco')).toBe(1.5)
  })

  it('fiamma vs adriatico = 0.5 (disadvantage)', () => {
    expect(getElementMultiplier('fiamma', 'adriatico')).toBe(0.5)
  })

  it('bosco vs bosco = 1.0 (neutral)', () => {
    expect(getElementMultiplier('bosco', 'bosco')).toBe(1.0)
  })

  it('armonia gets +15% base bonus', () => {
    expect(getElementMultiplier('armonia', 'fiamma')).toBe(1.15)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run -- src/lib/game/__tests__/rng.test.ts src/lib/game/__tests__/elements.test.ts
```

Expected: FAIL

**Step 3: Implement RNG module**

Create `src/lib/game/rng.ts`:

```typescript
import { RARITY_CATCH_RATES } from '@/lib/types'
import type { Rarity } from '@/lib/types'

export function rollDice(): number {
  return 0.8 + Math.random() * 0.4  // 0.8 to 1.2
}

export function rollCatch(rarity: Rarity, bonusAdditive: number): boolean {
  const baseRate = RARITY_CATCH_RATES[rarity]
  const rate = Math.min(1.0, baseRate + bonusAdditive)
  return Math.random() < rate
}

interface SpawnableCreature {
  id: string
  spawn_weight: number
  rarity: Rarity
  min_level: number
}

export function selectCreatureForEncounter(
  creatures: SpawnableCreature[],
  playerLevel: number
): SpawnableCreature | null {
  // Filter by min_level
  const eligible = creatures.filter(c => c.min_level <= playerLevel)
  if (eligible.length === 0) return null

  const totalWeight = eligible.reduce((sum, c) => sum + c.spawn_weight, 0)
  let random = Math.random() * totalWeight

  for (const creature of eligible) {
    random -= creature.spawn_weight
    if (random <= 0) return creature
  }
  return eligible[eligible.length - 1]
}

export function calculateFightDamage(atk: number): number {
  return Math.round(atk * rollDice())
}
```

**Step 4: Implement elements module**

Create `src/lib/game/elements.ts`:

```typescript
import { ELEMENT_MULTIPLIERS } from '@/lib/types'
import type { Element } from '@/lib/types'

export function getElementMultiplier(attackerElement: Element, defenderElement: Element): number {
  if (attackerElement === 'armonia') return 1.15  // +15% vs all

  const multipliers = ELEMENT_MULTIPLIERS[attackerElement]
  return multipliers[defenderElement] ?? 1.0
}
```

**Step 5: Run tests — should pass**

```bash
npm run test:run -- src/lib/game/__tests__/rng.test.ts src/lib/game/__tests__/elements.test.ts
```

Expected: PASS

**Step 6: Create encounter/start route**

Create `src/app/api/game/encounter/start/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { selectCreatureForEncounter } from '@/lib/game/rng'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, trigger = 'gps' } = await request.json()

  // Get player session
  const { data: playerSession } = await supabase
    .from('player_sessions')
    .select('id, level, selected_creature_id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!playerSession) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  // Check no active encounter already
  const { data: existing } = await supabase
    .from('encounters')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .single()

  if (existing) return NextResponse.json({ error: 'Incontro già in corso', encounterId: existing.id })

  // Get session creatures (from sessions table or creature catalogue)
  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, spawn_weight, rarity, min_level, hp, element')

  if (!creatures?.length) return NextResponse.json({ error: 'Nessuna creatura disponibile' }, { status: 500 })

  // RNG creature selection — server-side only
  const selected = selectCreatureForEncounter(creatures, playerSession.level)
  if (!selected) return NextResponse.json({ error: 'Nessuna creatura idonea' }, { status: 500 })

  // Get full creature data
  const { data: creature } = await supabase
    .from('creatures')
    .select('*')
    .eq('id', selected.id)
    .single()

  if (!creature) return NextResponse.json({ error: 'Errore dati creatura' }, { status: 500 })

  // Create encounter
  const { data: encounter, error: encError } = await supabase
    .from('encounters')
    .insert({
      user_id: user.id,
      creature_id: creature.id,
      session_id: sessionId,
      status: 'active',
      trigger,
      wild_creature_hp: creature.hp,
      player_creature_id: playerSession.selected_creature_id,
    })
    .select()
    .single()

  if (encError) return NextResponse.json({ error: 'Errore creazione incontro' }, { status: 500 })

  // Return creature data (no catch thresholds — never expose RNG to client)
  return NextResponse.json({
    encounterId: encounter.id,
    creature: {
      id: creature.id,
      name: creature.name,
      element: creature.element,
      rarity: creature.rarity,
      hp: creature.hp,
      image_url: creature.image_url,
      sprite_url: creature.sprite_url,
      lottie_url: creature.lottie_url,
    },
    wildHp: creature.hp,
  })
}
```

**Step 7: Create encounter/catch route**

Create `src/app/api/game/encounter/catch/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rollCatch } from '@/lib/game/rng'

const ITEM_BONUSES: Record<string, number> = {
  'Rete Base': 0,
  'Rete Avanzata': 0.10,
  'Rete Speciale': 0.20,
  'Rete Leggendaria': 0.35,
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { encounterId, itemId } = await request.json()

  // Get active encounter
  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato o già concluso' }, { status: 404 })

  const creature = (encounter as any).creatures

  // Get item bonus
  let bonus = 0
  if (itemId) {
    const { data: invItem } = await supabase
      .from('player_inventory')
      .select('quantity, items(name)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    if (invItem && invItem.quantity > 0) {
      const itemName = (invItem as any).items?.name ?? ''
      bonus = ITEM_BONUSES[itemName] ?? 0
      // Consume the item
      await supabase
        .from('player_inventory')
        .update({ quantity: invItem.quantity - 1 })
        .eq('id', itemId)
    }
  }

  // HP reduction bonus: if wild HP ≤ 30% of max, add +20%
  const hpRatio = encounter.wild_creature_hp / creature.hp
  if (hpRatio <= 0.3) bonus += 0.20

  // RNG catch — server-side only
  const caught = rollCatch(creature.rarity, bonus)

  if (!caught) {
    // Creature flees
    await supabase
      .from('encounters')
      .update({ status: 'fled', resolved_at: new Date().toISOString() })
      .eq('id', encounterId)

    return NextResponse.json({ caught: false, result: 'fuggita' })
  }

  // Success — add to player_creatures
  await supabase
    .from('encounters')
    .update({ status: 'caught', resolved_at: new Date().toISOString() })
    .eq('id', encounterId)

  // Check for existing duplicate
  const { data: existing } = await supabase
    .from('player_creatures')
    .select('id, duplicates_count, creature_id')
    .eq('user_id', user.id)
    .eq('creature_id', creature.id)
    .eq('session_id', encounter.session_id)
    .maybeSingle()

  let evolvedTriggered = false
  let newCreatureId = creature.id

  if (existing) {
    const newCount = existing.duplicates_count + 1
    await supabase
      .from('player_creatures')
      .update({ duplicates_count: newCount })
      .eq('id', existing.id)

    // Check evolution at 3 duplicates
    if (newCount >= 3 && !existing.evolved) {
      const { data: evolvedForm } = await supabase
        .from('creatures')
        .select('id')
        .eq('evolution_of', creature.id)
        .single()

      if (evolvedForm) {
        await supabase
          .from('player_creatures')
          .update({ evolved: true, creature_id: evolvedForm.id })
          .eq('id', existing.id)
        evolvedTriggered = true
        newCreatureId = evolvedForm.id
      }
    }
  } else {
    await supabase.from('player_creatures').insert({
      user_id: user.id,
      creature_id: creature.id,
      session_id: encounter.session_id,
      duplicates_count: 1,
    })
  }

  // Award EXP and score
  const rarityMultiplier = { comune: 1, non_comune: 2, raro: 3, epico: 4, leggendario: 5 }
  const rarityMult = rarityMultiplier[creature.rarity as keyof typeof rarityMultiplier] ?? 1
  const expGain = existing ? 3 : 10
  const scoreGain = existing ? 3 : 10 * rarityMult

  await supabase.rpc('increment_player_stats', {
    p_user_id: user.id,
    p_session_id: encounter.session_id,
    p_exp: expGain,
    p_score: scoreGain,
  })

  return NextResponse.json({
    caught: true,
    evolved: evolvedTriggered,
    newCreatureId,
    expGain,
    scoreGain,
  })
}
```

**Step 8: Create encounter/fight route**

Create `src/app/api/game/encounter/fight/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage } from '@/lib/game/rng'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

const RARE_TIERS = ['raro', 'epico', 'leggendario']
const MAX_TURNS = 5

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { encounterId } = await request.json()

  // Get encounter with creature data
  const { data: encounter } = await supabase
    .from('encounters')
    .select('*, creatures(*)')
    .eq('id', encounterId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!encounter) return NextResponse.json({ error: 'Incontro non trovato' }, { status: 404 })

  const wildCreature = (encounter as any).creatures

  // Count turns taken so far (fights resolved)
  const { count: turnCount } = await supabase
    .from('encounters')
    .select('id', { count: 'exact' })
    .eq('id', encounterId)

  // Simple turn counter via a metadata field would be cleaner;
  // for MVP we use a separate check on fight count stored on encounter
  // Here we track via a simple convention: wild_creature_hp changes mark turns
  // We'll add a turns_taken field; for now approximate from HP change
  // TODO: add turns_taken column in next migration

  // Get player's locked creature for this encounter
  if (!encounter.player_creature_id) {
    return NextResponse.json({
      error: 'Nessuna creatura selezionata. Seleziona una creatura dal Bestiario prima di combattere.'
    }, { status: 400 })
  }

  const { data: playerCreature } = await supabase
    .from('player_creatures')
    .select('*, creatures(*)')
    .eq('id', encounter.player_creature_id)
    .single()

  if (!playerCreature) return NextResponse.json({ error: 'Creatura giocatore non trovata' }, { status: 404 })

  const playerCr = (playerCreature as any).creatures

  // Check max turns (approximate: if wild_creature_hp is unchanged after 5 full damage values)
  // For MVP, track via a dedicated encounter field — simplified here
  const isRarePlus = RARE_TIERS.includes(wildCreature.rarity)

  let wildHpRemaining = encounter.wild_creature_hp
  let playerTookDamage = false
  let playerDamage = 0
  let wildDamage = 0

  // Rara+ attacks first
  if (isRarePlus) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    // Player creature doesn't lose HP permanently (resets after encounter)
    playerTookDamage = true
  }

  // Player attacks
  const elementMult = getElementMultiplier(
    playerCr.element as Element,
    wildCreature.element as Element
  )
  playerDamage = Math.round(calculateFightDamage(playerCr.atk) * elementMult)
  wildHpRemaining = Math.max(0, wildHpRemaining - playerDamage)

  // Non-rare attacks after player
  if (!isRarePlus && wildHpRemaining > 0) {
    wildDamage = calculateFightDamage(wildCreature.atk)
    playerTookDamage = true
  }

  // Determine outcome
  let fightResult: 'ongoing' | 'fled' | 'catchable' = 'ongoing'
  let newStatus: string = 'active'

  if (wildHpRemaining === 0) {
    // Creature flees — not catchable
    fightResult = 'fled'
    newStatus = 'fought'
  } else if (wildHpRemaining <= wildCreature.hp * 0.3) {
    fightResult = 'catchable'  // ready to catch with +20% bonus
  }

  // Update encounter HP
  await supabase
    .from('encounters')
    .update({
      wild_creature_hp: wildHpRemaining,
      status: newStatus === 'fought' ? 'fought' : 'active',
      resolved_at: newStatus === 'fought' ? new Date().toISOString() : null,
    })
    .eq('id', encounterId)

  return NextResponse.json({
    wildHpRemaining,
    wildHpMax: wildCreature.hp,
    playerDamage,
    wildDamage,
    playerTookDamage,
    elementMultiplier: elementMult,
    fightResult,
    catchBonus: fightResult === 'catchable' ? 0.20 : 0,
  })
}
```

**Step 9: Add `increment_player_stats` RPC to Supabase**

This must be run in Supabase SQL Editor (or added as migration 004):

```sql
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_user_id UUID, p_session_id UUID, p_exp INTEGER, p_score INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exp INTEGER;
  v_level INTEGER;
  v_new_level INTEGER;
BEGIN
  UPDATE player_sessions
  SET exp = exp + p_exp
  WHERE user_id = p_user_id AND session_id = p_session_id
  RETURNING exp, level INTO v_exp, v_level;

  -- Level up: every 100 EXP
  v_new_level := GREATEST(1, v_exp / 100 + 1);
  IF v_new_level > v_level THEN
    UPDATE player_sessions
    SET level = v_new_level
    WHERE user_id = p_user_id AND session_id = p_session_id;
  END IF;
END;
$$;
```

Save this as `supabase/migrations/004_rpcs.sql` and push:

```bash
npx supabase db push
```

**Step 10: Run all game logic tests**

```bash
npm run test:run
```

Expected: all PASS

**Step 11: Commit**

```bash
git add src/ supabase/
git commit -m "feat: encounter API (start/catch/fight), RNG engine, element system"
```

---

### Task 7: Encounter UI

**Files:**
- Create: `src/app/(game)/encounter/[id]/page.tsx`
- Create: `src/components/creature/CreatureSprite.tsx`
- Create: `src/components/creature/HPBar.tsx`

**Step 1: Create HPBar component**

Create `src/components/creature/HPBar.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'

interface Props {
  current: number
  max: number
  label?: string
}

export default function HPBar({ current, max, label }: Props) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 50 ? '#34d399' : pct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-white/70 mb-1">
          <span>{label}</span>
          <span>{current} / {max}</span>
        </div>
      )}
      <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: '100%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
```

**Step 2: Create CreatureSprite with idle animation**

Create `src/components/creature/CreatureSprite.tsx`:

```tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

type AnimState = 'idle' | 'attack' | 'damage' | 'catch' | 'flee' | 'victory'

interface Props {
  imageUrl: string
  name: string
  animState?: AnimState
  size?: number
}

const ANIM_VARIANTS = {
  idle: {
    y: [0, -8, 0],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  attack: {
    x: [-20, 20, 0],
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  damage: {
    x: [0, -8, 8, -8, 0],
    filter: ['brightness(1)', 'brightness(3)', 'brightness(1)'],
    transition: { duration: 0.35 },
  },
  catch: {
    scale: [1, 0.8, 0.2],
    opacity: [1, 0.8, 0],
    transition: { duration: 0.6, ease: 'easeIn' },
  },
  flee: {
    x: [0, 300],
    opacity: [1, 0],
    transition: { duration: 0.5, ease: 'easeIn' },
  },
  victory: {
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0],
    transition: { duration: 0.6 },
  },
}

export default function CreatureSprite({ imageUrl, name, animState = 'idle', size = 200 }: Props) {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      animate={ANIM_VARIANTS[animState]}
      key={animState}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={size}
          height={size}
          className="object-contain drop-shadow-2xl"
          priority
        />
      ) : (
        <div
          className="rounded-full bg-white/10 flex items-center justify-center text-5xl"
          style={{ width: size, height: size }}
        >
          🐾
        </div>
      )}
    </motion.div>
  )
}
```

**Step 3: Create encounter page**

Create `src/app/(game)/encounter/[id]/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'
import { RARITY_COLORS, ELEMENT_EMOJI } from '@/lib/types'
import type { Creature } from '@/lib/types'

interface EncounterState {
  encounterId: string
  creature: Partial<Creature>
  wildHp: number
  wildHpMax: number
  catchBonus: number
  turns: number
}

export default function EncounterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [state, setState] = useState<EncounterState | null>(null)
  const [animState, setAnimState] = useState<'idle' | 'attack' | 'damage' | 'catch' | 'flee'>('idle')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'caught' | 'fled' | 'evolved' | null>(null)

  useEffect(() => {
    // Load encounter from sessionStorage (set by map page when encounter triggered)
    const stored = sessionStorage.getItem(`encounter_${id}`)
    if (stored) setState(JSON.parse(stored))
  }, [id])

  async function handleFight() {
    if (!state || loading) return
    setLoading(true)
    setMessage('')

    const res = await fetch('/api/game/encounter/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId }),
    })
    const data = await res.json()

    if (!res.ok) { setMessage(data.error); setLoading(false); return }

    // Play animations
    if (data.playerTookDamage) {
      setAnimState('damage')
      await new Promise(r => setTimeout(r, 400))
    }
    setAnimState('idle')

    setState(prev => prev ? {
      ...prev,
      wildHp: data.wildHpRemaining,
      catchBonus: data.catchBonus,
      turns: prev.turns + 1,
    } : null)

    if (data.fightResult === 'fled') {
      setAnimState('flee')
      setMessage('La creatura è fuggita!')
      setResult('fled')
    } else if (data.fightResult === 'catchable') {
      setMessage(`HP basso! Bonus cattura +${Math.round(data.catchBonus * 100)}% 🎯`)
    } else {
      setMessage(`Danno inflitto: ${data.playerDamage} (×${data.elementMultiplier.toFixed(1)})`)
    }

    setLoading(false)
  }

  async function handleCatch() {
    if (!state || loading) return
    setLoading(true)

    const res = await fetch('/api/game/encounter/catch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: state.encounterId }),
    })
    const data = await res.json()

    if (data.caught) {
      setAnimState('catch')
      await new Promise(r => setTimeout(r, 700))
      setResult(data.evolved ? 'evolved' : 'caught')
      setMessage(data.evolved ? '✨ Evoluzione!' : '✅ Catturato!')
    } else {
      setAnimState('flee')
      setMessage('La creatura è fuggita...')
      setResult('fled')
    }
    setLoading(false)
  }

  function handleFlee() {
    router.back()
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        Caricamento incontro...
      </div>
    )
  }

  const rarityColor = RARITY_COLORS[state.creature.rarity ?? 'comune']
  const elementEmoji = ELEMENT_EMOJI[state.creature.element ?? 'fiamma']

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0F1F2E] to-[#1A3A2E] p-4">
      {/* Creature header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white">{state.creature.name}</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-lg">{elementEmoji}</span>
          <span className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
            style={{ backgroundColor: rarityColor }}>
            {state.creature.rarity}
          </span>
        </div>
      </div>

      {/* Creature sprite */}
      <div className="flex-1 flex items-center justify-center">
        <CreatureSprite
          imageUrl={state.creature.image_url ?? ''}
          name={state.creature.name ?? ''}
          animState={animState}
          size={240}
        />
      </div>

      {/* HP bar */}
      <div className="mb-4">
        <HPBar current={state.wildHp} max={state.wildHpMax} label="HP Creatura" />
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center text-sm text-[#F7C841] mb-3"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!result && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCatch}
            disabled={loading}
            className="bg-[#E85D2F] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            🎯 CATTURA
            {state.catchBonus > 0 && (
              <div className="text-xs text-[#F7C841]">+{Math.round(state.catchBonus * 100)}%</div>
            )}
          </button>
          <button
            onClick={handleFight}
            disabled={loading || state.turns >= 5}
            className="bg-[#7B4DB8] text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
          >
            ⚔️ COMBATTI
            <div className="text-xs text-white/70">{state.turns}/5</div>
          </button>
          <button
            onClick={handleFlee}
            className="bg-white/10 text-white font-bold py-4 rounded-xl text-sm"
          >
            🏃 FUGGI
          </button>
        </div>
      )}

      {/* Result overlay */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="text-2xl font-bold text-white mb-4">
            {result === 'caught' ? '✅ Catturato!' : result === 'evolved' ? '✨ Evoluzione!' : '💨 Fuggita'}
          </p>
          <button
            onClick={() => router.push('/game/map')}
            className="bg-[#3A9DBC] text-white font-bold py-3 px-8 rounded-xl"
          >
            Continua
          </button>
        </motion.div>
      )}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: encounter UI with animations, fight/catch buttons"
```

---

### Task 8: Map Screen

**Files:**
- Create: `src/app/(game)/map/page.tsx`
- Create: `src/components/map/GameMap.tsx`

**Step 1: Create GameMap component**

Create `src/components/map/GameMap.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import type { Session } from '@/lib/types'

interface Props {
  session: Session
  playerPosition: { lat: number; lng: number } | null
  onEncounterTrigger: (encounterId: string, creature: any) => void
  sessionId: string
}

export default function GameMap({ session, playerPosition, onEncounterTrigger, sessionId }: Props) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Lazy import Leaflet (not SSR compatible)
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css')

      if (mapRef.current || !mapContainerRef.current) return

      const bounds = session.area_bounds
      const center: [number, number] = [
        (bounds.north + bounds.south) / 2,
        (bounds.east + bounds.west) / 2,
      ]

      const map = L.map(mapContainerRef.current!, {
        center,
        zoom: 16,
        zoomControl: false,
        maxBounds: L.latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        ),
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Draw bounding box
      L.rectangle(
        [[bounds.south, bounds.west], [bounds.north, bounds.east]],
        { color: '#3A9DBC', weight: 2, fillOpacity: 0.05 }
      ).addTo(map)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update player marker
  useEffect(() => {
    if (!playerPosition || !mapRef.current) return
    import('leaflet').then(L => {
      const { lat, lng } = playerPosition

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        const icon = L.divIcon({
          html: '<div style="width:16px;height:16px;background:#E85D2F;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(232,93,47,0.3)"></div>',
          iconSize: [16, 16],
          className: '',
        })
        markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current)
      }
    })
  }, [playerPosition])

  return <div ref={mapContainerRef} className="w-full h-full" />
}
```

**Step 2: Create map page**

Create `src/app/(game)/map/page.tsx`:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useGPS } from '@/hooks/useGPS'
import type { Session } from '@/lib/types'

// Dynamic import — Leaflet is not SSR-safe
const GameMap = dynamic(() => import('@/components/map/GameMap'), { ssr: false })

const ENCOUNTER_COOLDOWN_MS = 30000  // 30s between encounters

export default function MapPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inBounds, setInBounds] = useState(true)
  const [notification, setNotification] = useState<string | null>(null)
  const [showEncounterPopup, setShowEncounterPopup] = useState(false)
  const [pendingEncounter, setPendingEncounter] = useState<any>(null)
  const lastEncounterRef = useRef(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get current session from storage or API
    const sid = localStorage.getItem('current_session_id')
    if (!sid) { router.push('/'); return }
    setSessionId(sid)

    supabase.from('sessions').select('*').eq('id', sid).single()
      .then(({ data }) => { if (data) setSession(data as unknown as Session) })
  }, [])

  const { position, error: gpsError } = useGPS(async (pos) => {
    if (!sessionId) return

    const now = Date.now()
    const res = await fetch('/api/game/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, sessionId }),
    })
    const data = await res.json()

    if (data.sessionEnded) {
      router.push('/game/profile?ended=1')
      return
    }

    setInBounds(data.inBounds)

    if (data.triggerEncounter && now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS) {
      lastEncounterRef.current = now
      await triggerEncounter()
    }
  })

  // Timer-based encounter fallback when GPS accuracy is low
  useEffect(() => {
    if (!sessionId) return
    const minMs = 60000, maxMs = 180000
    let timeout: ReturnType<typeof setTimeout>

    function scheduleTimerEncounter() {
      const delay = minMs + Math.random() * (maxMs - minMs)
      timeout = setTimeout(async () => {
        const now = Date.now()
        if (now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS) {
          lastEncounterRef.current = now
          await triggerEncounter('timer')
        }
        scheduleTimerEncounter()
      }, delay)
    }
    scheduleTimerEncounter()

    return () => clearTimeout(timeout)
  }, [sessionId])

  async function triggerEncounter(trigger: 'gps' | 'timer' = 'gps') {
    if (!sessionId) return
    const res = await fetch('/api/game/encounter/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, trigger }),
    })
    const data = await res.json()
    if (data.encounterId) {
      // Store encounter data for the encounter page
      sessionStorage.setItem(`encounter_${data.encounterId}`, JSON.stringify({
        encounterId: data.encounterId,
        creature: data.creature,
        wildHp: data.wildHp,
        wildHpMax: data.wildHp,
        catchBonus: 0,
        turns: 0,
      }))
      setPendingEncounter(data)
      setShowEncounterPopup(true)
    }
  }

  if (!session) {
    return <div className="flex items-center justify-center h-full text-white">Caricamento mappa...</div>
  }

  return (
    <div className="relative w-full h-full">
      <GameMap
        session={session}
        playerPosition={position ? { lat: position.lat, lng: position.lng } : null}
        onEncounterTrigger={(id, c) => router.push(`/game/encounter/${id}`)}
        sessionId={sessionId!}
      />

      {/* GPS error */}
      {gpsError && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-900/90 text-yellow-200 text-sm px-3 py-2 rounded-lg z-10">
          ⚠️ {gpsError}
        </div>
      )}

      {/* Out of bounds */}
      {!inBounds && (
        <div className="absolute top-2 left-2 right-2 bg-red-900/90 text-red-200 text-sm px-3 py-2 rounded-lg z-10 text-center">
          🚫 Sei fuori dall'area di gioco — torna nella zona indicata!
        </div>
      )}

      {/* QR scan button */}
      <button
        onClick={() => router.push('/game/missions?qr=1')}
        className="absolute bottom-4 right-4 bg-[#3A9DBC] text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg z-10"
      >
        📷
      </button>

      {/* Encounter popup */}
      {showEncounterPopup && pendingEncounter && (
        <div className="absolute inset-x-4 bottom-16 bg-[#0F1F2E] border border-[#3A9DBC] rounded-2xl p-4 z-20 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🐾</div>
            <div>
              <p className="font-bold text-white">Una {pendingEncounter.creature.name} selvatica!</p>
              <p className="text-sm text-[#3A9DBC]">{pendingEncounter.creature.element} · {pendingEncounter.creature.rarity}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                setShowEncounterPopup(false)
                router.push(`/game/encounter/${pendingEncounter.encounterId}`)
              }}
              className="flex-1 bg-[#E85D2F] text-white font-bold py-3 rounded-xl"
            >
              AFFRONTA
            </button>
            <button
              onClick={() => setShowEncounterPopup(false)}
              className="px-4 bg-white/10 text-white rounded-xl"
            >
              Fuggi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: map screen with GPS tracking, encounter popup, Leaflet integration"
```

---

## Phase 3: Advanced Mechanics

### Task 9: Bestiary + Creature Select + Evolution

**Files:**
- Create: `src/app/(game)/bestiary/page.tsx`
- Create: `src/app/api/game/creature/evolve/route.ts`
- Create: `src/app/api/game/creature/select/route.ts`

**Step 1: Create creature evolve + select routes**

Create `src/app/api/game/creature/select/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, sessionId } = await request.json()

  // Verify player owns this creature
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('id')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!pc) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })

  await supabase
    .from('player_sessions')
    .update({ selected_creature_id: playerCreatureId })
    .eq('user_id', user.id)
    .eq('session_id', sessionId)

  return NextResponse.json({ success: true })
}
```

Create `src/app/api/game/creature/evolve/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { playerCreatureId, sessionId } = await request.json()

  // Get player creature
  const { data: pc } = await supabase
    .from('player_creatures')
    .select('*, creatures(*)')
    .eq('id', playerCreatureId)
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!pc) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })
  if (pc.evolved) return NextResponse.json({ error: 'Già evoluta' }, { status: 400 })
  if (pc.duplicates_count < 3) {
    return NextResponse.json({
      error: `Servono 3 duplicati (hai ${pc.duplicates_count})`
    }, { status: 400 })
  }

  const baseCreatureId = (pc as any).creatures?.id
  const { data: evolvedForm } = await supabase
    .from('creatures')
    .select('*')
    .eq('evolution_of', baseCreatureId)
    .single()

  if (!evolvedForm) return NextResponse.json({ error: 'Nessuna forma evoluta disponibile' }, { status: 404 })

  await supabase
    .from('player_creatures')
    .update({ evolved: true, creature_id: evolvedForm.id })
    .eq('id', playerCreatureId)

  return NextResponse.json({
    evolved: true,
    newCreature: {
      id: evolvedForm.id,
      name: evolvedForm.name,
      element: evolvedForm.element,
      image_url: evolvedForm.image_url,
    },
  })
}
```

**Step 2: Create bestiary page**

Create `src/app/(game)/bestiary/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { RARITY_COLORS, ELEMENT_EMOJI } from '@/lib/types'
import type { Creature, PlayerCreature } from '@/lib/types'

export default function BestiaryPage() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [playerCreatures, setPlayerCreatures] = useState<PlayerCreature[]>([])
  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null)
  const [selectedPlayerCreature, setSelectedPlayerCreature] = useState<PlayerCreature | null>(null)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.from('creatures').select('*').order('rarity').then(({ data }) => {
      if (data) setCreatures(data as unknown as Creature[])
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('player_creatures')
        .select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .then(({ data }) => {
          if (data) setPlayerCreatures(data as unknown as PlayerCreature[])
        })
    })
  }, [])

  function getPlayerCreature(creatureId: string) {
    return playerCreatures.find(pc => pc.creature_id === creatureId)
  }

  async function handleSelect(pc: PlayerCreature) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    const res = await fetch('/api/game/creature/select', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId: pc.id, sessionId }),
    })
    if (res.ok) {
      setSelectedPlayerCreature(pc)
      setMessage(`${pc.creature?.name} selezionata come creatura attiva!`)
    }
  }

  async function handleEvolve(pc: PlayerCreature) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    const res = await fetch('/api/game/creature/evolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId: pc.id, sessionId }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`✨ ${data.newCreature.name} si è evoluta!`)
      // Refresh player creatures
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return
      const { data: refreshed } = await supabase
        .from('player_creatures')
        .select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
      if (refreshed) setPlayerCreatures(refreshed as unknown as PlayerCreature[])
    } else {
      setMessage(data.error)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-white mb-1">Bestiario</h1>
      <p className="text-white/50 text-sm mb-4">
        {playerCreatures.length} / {creatures.length} creature catturate
      </p>

      {message && (
        <p className="text-[#F7C841] text-sm text-center mb-4 bg-[#F7C841]/10 rounded-lg p-2">
          {message}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {creatures.map(creature => {
          const pc = getPlayerCreature(creature.id)
          const caught = !!pc
          const rarityColor = RARITY_COLORS[creature.rarity]

          return (
            <motion.div
              key={creature.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedCreature(creature); setSelectedPlayerCreature(pc ?? null) }}
              className={`relative rounded-xl p-2 border cursor-pointer ${
                caught ? 'bg-white/10 border-white/20' : 'bg-black/30 border-white/5'
              }`}
            >
              <div
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: rarityColor }}
              />
              <div className="aspect-square rounded-lg overflow-hidden mb-1">
                {caught && creature.image_url ? (
                  <Image src={creature.image_url} alt={creature.name} width={80} height={80}
                    className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center text-2xl">
                    {caught ? ELEMENT_EMOJI[creature.element] : '❓'}
                  </div>
                )}
              </div>
              <p className={`text-xs text-center font-medium truncate ${caught ? 'text-white' : 'text-white/30'}`}>
                {caught ? creature.name : '???'}
              </p>
              {pc && pc.duplicates_count > 1 && (
                <span className="absolute top-1 left-1 text-xs bg-[#3A9DBC] text-white rounded px-1">
                  ×{pc.duplicates_count}
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {selectedCreature && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 bg-[#0F1F2E] border-t border-white/10 rounded-t-2xl p-6 z-50"
          >
            <button onClick={() => setSelectedCreature(null)} className="absolute top-4 right-4 text-white/50">✕</button>
            <div className="text-center">
              {selectedCreature.image_url ? (
                <Image src={selectedCreature.image_url} alt={selectedCreature.name}
                  width={120} height={120} className="mx-auto mb-3 object-contain" />
              ) : (
                <div className="text-6xl mx-auto mb-3">{ELEMENT_EMOJI[selectedCreature.element]}</div>
              )}
              <h3 className="text-xl font-bold text-white">{selectedCreature.name}</h3>
              <p className="text-sm text-white/60 mt-1">{selectedCreature.description}</p>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <span className="text-red-400">❤️ {selectedCreature.hp}</span>
                <span className="text-orange-400">⚔️ {selectedCreature.atk}</span>
                <span className="text-blue-400">🛡️ {selectedCreature.def}</span>
              </div>
              {selectedPlayerCreature && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleSelect(selectedPlayerCreature)}
                    className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl"
                  >
                    Usa in Battaglia
                  </button>
                  {selectedPlayerCreature.duplicates_count >= 3 && !selectedPlayerCreature.evolved && (
                    <button
                      onClick={() => handleEvolve(selectedPlayerCreature)}
                      className="flex-1 bg-[#F7C841] text-[#0F1F2E] font-bold py-3 rounded-xl"
                    >
                      ✨ Evolvi
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: bestiary, creature select, manual evolution trigger"
```

---

### Task 10: Missions + QR Scan

**Files:**
- Create: `src/app/(game)/missions/page.tsx`
- Create: `src/app/api/game/qr/scan/route.ts`
- Test: `src/app/api/game/qr/__tests__/scan.test.ts`

**Step 1: Write failing QR scan test**

Create `src/app/api/game/qr/__tests__/scan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { POST } from '../scan/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/game/qr/scan', () => {
  it('returns 400 if qrId missing', async () => {
    const mockClient = {
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'u1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mockClient as any)

    const req = new Request('http://localhost/api/game/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Run test to verify fail**

```bash
npm run test:run -- src/app/api/game/qr/__tests__/scan.test.ts
```

Expected: FAIL

**Step 3: Create QR scan route**

Create `src/app/api/game/qr/scan/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { qrId, sessionId } = body

  if (!qrId || !sessionId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Get QR code
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('id', qrId)
    .eq('session_id', sessionId)
    .single()

  if (!qr) return NextResponse.json({ error: 'QR code non valido' }, { status: 404 })

  // Check uses remaining
  if (qr.uses_remaining !== null && qr.uses_remaining <= 0) {
    return NextResponse.json({ error: 'QR code esaurito' }, { status: 410 })
  }

  // Decrement uses
  if (qr.uses_remaining !== null) {
    await supabase
      .from('qr_codes')
      .update({ uses_remaining: qr.uses_remaining - 1 })
      .eq('id', qrId)
  }

  const payload = qr.payload as any
  let result: Record<string, unknown> = { type: qr.type }

  switch (qr.type) {
    case 'oggetto': {
      // Add item to player inventory
      const { data: existing } = await supabase
        .from('player_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .eq('item_id', payload.item_id)
        .single()

      if (existing) {
        await supabase.from('player_inventory')
          .update({ quantity: existing.quantity + payload.quantity })
          .eq('id', existing.id)
      } else {
        await supabase.from('player_inventory').insert({
          user_id: user.id, session_id: sessionId,
          item_id: payload.item_id, quantity: payload.quantity,
        })
      }

      const { data: item } = await supabase.from('items').select('name').eq('id', payload.item_id).single()
      result = { ...result, itemName: (item as any)?.name, quantity: payload.quantity }
      break
    }

    case 'indizio': {
      // Unlock mission chapter
      result = {
        ...result,
        chapterOrder: payload.chapter_order,
        text: payload.text,
        imageUrl: payload.image_url,
      }
      break
    }

    case 'uovo': {
      // Give egg item to player — resolved later via distance/encounters
      result = { ...result, eggRarity: payload.egg_rarity }
      break
    }

    case 'boss': {
      // Trigger boss encounter
      result = {
        ...result,
        creatureId: payload.creature_id,
        levelOverride: payload.level_override,
      }
      break
    }

    case 'evento': {
      result = { ...result, eventType: payload.event_type, effect: payload.effect }
      break
    }
  }

  return NextResponse.json({ success: true, ...result })
}
```

**Step 4: Create missions page**

Create `src/app/(game)/missions/page.tsx`:

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Mission } from '@/lib/types'

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    supabase
      .from('missions')
      .select('*')
      .eq('session_id', sessionId)
      .order('chapter_order')
      .then(({ data }) => { if (data) setMissions(data as unknown as Mission[]) })
  }, [])

  async function handleScanResult(qrData: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    setScanning(false)
    // QR data is the qr_codes.id UUID
    const res = await fetch('/api/game/qr/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrId: qrData, sessionId }),
    })
    const data = await res.json()
    setScanResult(data)
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Missioni</h1>
        <button
          onClick={() => setScanning(true)}
          className="bg-[#3A9DBC] text-white px-4 py-2 rounded-xl text-sm font-bold"
        >
          📷 Scansiona QR
        </button>
      </div>

      {scanResult && (
        <div className="bg-[#3A9DBC]/20 border border-[#3A9DBC] rounded-xl p-4 mb-4">
          <p className="text-white font-bold">QR Scansionato! ✅</p>
          <p className="text-sm text-white/70 mt-1">
            {scanResult.type === 'oggetto' && `Ricevuto: ${scanResult.itemName} ×${scanResult.quantity}`}
            {scanResult.type === 'indizio' && `Indizio sbloccato: ${scanResult.text}`}
            {scanResult.type === 'uovo' && `Uovo ${scanResult.eggRarity} trovato!`}
          </p>
          <button onClick={() => setScanResult(null)} className="text-xs text-white/50 mt-2">Chiudi</button>
        </div>
      )}

      <div className="space-y-3">
        {missions.map((mission, i) => (
          <div key={mission.id}
            className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3A9DBC]/20 border border-[#3A9DBC] flex items-center justify-center text-sm font-bold text-[#3A9DBC]">
                {mission.chapter_order}
              </div>
              <div>
                <p className="font-bold text-white text-sm">{mission.title}</p>
                <p className="text-xs text-white/50">{mission.description}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-white/50">
              <span>🥇 {mission.reward_exp} EXP</span>
              <span>💰 {mission.reward_gold} Oro</span>
            </div>
          </div>
        ))}
        {missions.length === 0 && (
          <p className="text-center text-white/30 py-8">Nessuna missione attiva</p>
        )}
      </div>
    </div>
  )
}
```

**Step 5: Run QR test**

```bash
npm run test:run -- src/app/api/game/qr/__tests__/scan.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: missions page, QR scan API with all payload types"
```

---

### Task 11: Duels (PvP Realtime)

**Files:**
- Create: `src/app/api/game/duel/connect/route.ts`
- Create: `src/app/api/game/duel/action/route.ts`
- Create: `src/app/(game)/duel/[id]/page.tsx`
- Test: `src/app/api/game/duel/__tests__/connect.test.ts`

**Step 1: Write failing duel connect test**

Create `src/app/api/game/duel/__tests__/connect.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { POST } from '../connect/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/game/duel/connect', () => {
  it('returns 400 if sessionId missing', async () => {
    const mock = {
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'u1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const req = new Request('http://localhost/api/game/duel/connect', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Run to fail**

```bash
npm run test:run -- src/app/api/game/duel/__tests__/connect.test.ts
```

**Step 3: Create duel connect route**

Create `src/app/api/game/duel/connect/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Room code chars: exclude ambiguous 0, O, I, 1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { sessionId, roomCode, playerCreatureId } = body

  if (!sessionId || !playerCreatureId) {
    return NextResponse.json({ error: 'sessionId e playerCreatureId richiesti' }, { status: 400 })
  }

  if (roomCode) {
    // Join existing duel
    const { data: duel } = await supabase
      .from('duels')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .single()

    if (!duel) return NextResponse.json({ error: 'Stanza non trovata o già iniziata' }, { status: 404 })
    if (duel.challenger_id === user.id) return NextResponse.json({ error: 'Sei già in questa stanza' }, { status: 409 })

    const { data: updated } = await supabase
      .from('duels')
      .update({
        opponent_id: user.id,
        opponent_creature_id: playerCreatureId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', duel.id)
      .select()
      .single()

    return NextResponse.json({ duelId: updated!.id, role: 'opponent', roomCode: duel.room_code })
  } else {
    // Create new duel — retry on room code collision
    let code = generateRoomCode()
    let attempts = 0

    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('duels')
        .select('id')
        .eq('room_code', code)
        .eq('session_id', sessionId)
        .eq('status', 'waiting')
        .maybeSingle()

      if (!existing) break
      code = generateRoomCode()
      attempts++
    }

    const { data: duel, error: createError } = await supabase
      .from('duels')
      .insert({
        challenger_id: user.id,
        challenger_creature_id: playerCreatureId,
        session_id: sessionId,
        status: 'waiting',
        room_code: code,
      })
      .select()
      .single()

    if (createError) return NextResponse.json({ error: 'Errore creazione duello' }, { status: 500 })

    return NextResponse.json({ duelId: duel.id, role: 'challenger', roomCode: code })
  }
}
```

**Step 4: Create duel action route**

Create `src/app/api/game/duel/action/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFightDamage } from '@/lib/game/rng'
import { getElementMultiplier } from '@/lib/game/elements'
import type { Element } from '@/lib/types'

interface DuelState {
  challenger_hp: number
  opponent_hp: number
  challenger_hp_max: number
  opponent_hp_max: number
  turn: number
  log: string[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { duelId, action } = await request.json()
  // action: 'attack' | 'surrender'

  const { data: duel } = await supabase
    .from('duels')
    .select('*, challenger_creature:player_creatures!challenger_creature_id(*, creatures(*)), opponent_creature:player_creatures!opponent_creature_id(*, creatures(*))')
    .eq('id', duelId)
    .eq('status', 'active')
    .single()

  if (!duel) return NextResponse.json({ error: 'Duello non trovato' }, { status: 404 })

  const isChallenger = duel.challenger_id === user.id
  const isOpponent = duel.opponent_id === user.id
  if (!isChallenger && !isOpponent) return NextResponse.json({ error: 'Non sei in questo duello' }, { status: 403 })

  if (action === 'surrender') {
    const winnerId = isChallenger ? duel.opponent_id : duel.challenger_id
    await supabase.from('duels').update({ status: 'ended', winner_id: winnerId, ended_at: new Date().toISOString() }).eq('id', duelId)
    await awardDuelResults(supabase, duel.session_id, winnerId!, user.id)
    return NextResponse.json({ ended: true, winner: 'opponent' })
  }

  // Get creature stats from the FK-joined data
  const challengerCr = (duel as any).challenger_creature?.creatures
  const opponentCr = (duel as any).opponent_creature?.creatures

  if (!challengerCr || !opponentCr) {
    return NextResponse.json({ error: 'Dati creature non disponibili' }, { status: 500 })
  }

  // Get or initialize duel state from Supabase realtime (use notifications channel as state store)
  // For MVP, state is computed from a dedicated duel_state column we add as metadata
  // Simplified: compute damage for this turn and return result

  const attackerCr = isChallenger ? challengerCr : opponentCr
  const defenderCr = isChallenger ? opponentCr : challengerCr

  const mult = getElementMultiplier(attackerCr.element as Element, defenderCr.element as Element)
  const damage = Math.round(calculateFightDamage(attackerCr.atk) * mult)

  // Broadcast action via Supabase Realtime to both players
  await supabase.channel(`duel:${duelId}`).send({
    type: 'broadcast',
    event: 'duel_action',
    payload: {
      actorId: user.id,
      action,
      damage,
      elementMultiplier: mult,
    },
  })

  return NextResponse.json({ damage, elementMultiplier: mult, action })
}

async function awardDuelResults(supabase: any, sessionId: string, winnerId: string, loserId: string) {
  await supabase.rpc('increment_player_stats', { p_user_id: winnerId, p_session_id: sessionId, p_exp: 15, p_score: 15 })
  await supabase.rpc('increment_player_stats', { p_user_id: loserId, p_session_id: sessionId, p_exp: 5, p_score: 0 })
}
```

**Step 5: Create duel page**

Create `src/app/(game)/duel/[id]/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import CreatureSprite from '@/components/creature/CreatureSprite'
import HPBar from '@/components/creature/HPBar'

export default function DuelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [duel, setDuel] = useState<any>(null)
  const [myHp, setMyHp] = useState(100)
  const [opponentHp, setOpponentHp] = useState(100)
  const [myHpMax, setMyHpMax] = useState(100)
  const [opponentHpMax, setOpponentHpMax] = useState(100)
  const [log, setLog] = useState<string[]>([])
  const [waiting, setWaiting] = useState(true)
  const [result, setResult] = useState<'won' | 'lost' | null>(null)
  const [animState, setAnimState] = useState<'idle' | 'attack' | 'damage'>('idle')
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('duels')
      .select('*, challenger_creature:player_creatures!challenger_creature_id(*, creatures(*)), opponent_creature:player_creatures!opponent_creature_id(*, creatures(*))')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDuel(data)
          const ch = (data as any).challenger_creature?.creatures
          const op = (data as any).opponent_creature?.creatures
          if (ch) { setMyHp(ch.hp); setMyHpMax(ch.hp) }
          if (op) { setOpponentHp(op.hp); setOpponentHpMax(op.hp) }
          setWaiting(data.status === 'waiting')
        }
      })

    // Subscribe to duel actions
    const channel = supabase
      .channel(`duel:${id}`)
      .on('broadcast', { event: 'duel_action' }, ({ payload }) => {
        const { actorId, action, damage } = payload
        const isMyAction = actorId === supabase.auth.getUser().then(r => r.data.user?.id)

        if (action === 'attack') {
          setAnimState('damage')
          setTimeout(() => setAnimState('idle'), 400)

          // Simplified: opponent action damages me, my action damages opponent
          // Full HP tracking would require server-authoritative state
          const isOpponentAction = true // simplified
          if (isOpponentAction) {
            setMyHp(prev => Math.max(0, prev - damage))
          } else {
            setOpponentHp(prev => Math.max(0, prev - damage))
          }
          setLog(prev => [`💥 Danno: ${damage}`, ...prev.slice(0, 4)])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${id}` },
        ({ new: updated }) => {
          if (updated.status === 'ended') {
            supabase.auth.getUser().then(({ data: { user } }) => {
              setResult(updated.winner_id === user?.id ? 'won' : 'lost')
            })
          }
          setWaiting(updated.status === 'waiting')
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function handleAttack() {
    const sessionId = localStorage.getItem('current_session_id')
    setAnimState('attack')
    setTimeout(() => setAnimState('idle'), 400)
    await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: id, action: 'attack', sessionId }),
    })
  }

  async function handleSurrender() {
    await fetch('/api/game/duel/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId: id, action: 'surrender' }),
    })
  }

  const myCr = duel?.challenger_creature?.creatures
  const oppCr = duel?.opponent_creature?.creatures

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0F1F2E] via-[#1A1A2E] to-[#0F1F2E] p-4">
      {waiting && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0F1F2E]/90 z-20">
          <div className="text-center">
            <p className="text-xl font-bold text-white mb-2">In attesa dell'avversario...</p>
            <p className="text-[#3A9DBC] text-sm">Codice stanza: <span className="font-mono text-xl">{duel?.room_code}</span></p>
          </div>
        </div>
      )}

      {/* Opponent */}
      <div className="text-center mb-2">
        <p className="text-sm text-white/50">Avversario</p>
        {oppCr && <HPBar current={opponentHp} max={opponentHpMax} label={oppCr.name} />}
      </div>

      <div className="flex justify-around flex-1 items-center">
        <div className="opacity-70">
          {oppCr && <CreatureSprite imageUrl={oppCr.image_url} name={oppCr.name} animState="idle" size={140} />}
        </div>
        <div className="text-4xl font-bold text-white/20">VS</div>
        <div>
          {myCr && <CreatureSprite imageUrl={myCr.image_url} name={myCr.name} animState={animState} size={140} />}
        </div>
      </div>

      {/* My HP */}
      <div className="mb-4">
        <p className="text-sm text-white/50 mb-1 text-right">La tua creatura</p>
        {myCr && <HPBar current={myHp} max={myHpMax} label={myCr.name} />}
      </div>

      {/* Log */}
      <div className="h-12 overflow-hidden mb-3">
        {log.map((l, i) => (
          <p key={i} className="text-xs text-white/60 text-center">{l}</p>
        ))}
      </div>

      {/* Actions */}
      {!result && !waiting && (
        <div className="flex gap-2">
          <button onClick={handleAttack} className="flex-1 bg-[#E85D2F] text-white font-bold py-4 rounded-xl">⚔️ ATTACCA</button>
          <button onClick={handleSurrender} className="bg-white/10 text-white px-4 rounded-xl">🏳️</button>
        </div>
      )}

      {result && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <p className="text-3xl font-bold text-white mb-2">{result === 'won' ? '🏆 Vittoria!' : '💀 Sconfitta'}</p>
          <button onClick={() => router.push('/game/map')} className="bg-[#3A9DBC] text-white font-bold py-3 px-8 rounded-xl">
            Torna alla Mappa
          </button>
        </motion.div>
      )}
    </div>
  )
}
```

**Step 6: Run duel test**

```bash
npm run test:run -- src/app/api/game/duel/__tests__/connect.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/
git commit -m "feat: PvP duel system with realtime WebSocket actions"
```

---

### Task 12: Shop + Backpack

**Files:**
- Create: `src/app/api/game/shop/buy/route.ts`
- Create: `src/app/(game)/shop/page.tsx`
- Create: `src/app/(game)/backpack/page.tsx`
- Test: `src/app/api/game/shop/__tests__/buy.test.ts`

**Step 1: Write failing shop test**

Create `src/app/api/game/shop/__tests__/buy.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { POST } from '../buy/route'
import { createClient } from '@/lib/supabase/server'

describe('POST /api/game/shop/buy', () => {
  it('returns 400 if no itemId', async () => {
    const mock = {
      auth: { getUser: vi.fn(() => ({ data: { user: { id: 'u1' } }, error: null })) },
    }
    vi.mocked(createClient).mockResolvedValue(mock as any)
    const req = new Request('http://localhost/api/game/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Run to fail**

```bash
npm run test:run -- src/app/api/game/shop/__tests__/buy.test.ts
```

**Step 3: Create shop buy route**

Create `src/app/api/game/shop/buy/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { itemId, sessionId, quantity = 1 } = body

  if (!itemId || !sessionId) {
    return NextResponse.json({ error: 'itemId e sessionId richiesti' }, { status: 400 })
  }

  // Get item price
  const { data: item } = await supabase
    .from('items')
    .select('id, name, shop_price')
    .eq('id', itemId)
    .single()

  if (!item) return NextResponse.json({ error: 'Oggetto non trovato' }, { status: 404 })

  const totalCost = item.shop_price * quantity

  // Get player gold
  const { data: ps } = await supabase
    .from('player_sessions')
    .select('id, gold')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .single()

  if (!ps) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (ps.gold < totalCost) return NextResponse.json({ error: 'Oro insufficiente' }, { status: 402 })

  // Atomic: deduct gold + add item
  const { error: goldError } = await supabase
    .from('player_sessions')
    .update({ gold: ps.gold - totalCost })
    .eq('id', ps.id)
    .eq('gold', ps.gold)  // optimistic lock

  if (goldError) return NextResponse.json({ error: 'Errore transazione' }, { status: 500 })

  // Add item to inventory (upsert)
  const { data: existing } = await supabase
    .from('player_inventory')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('session_id', sessionId)
    .eq('item_id', itemId)
    .single()

  if (existing) {
    await supabase.from('player_inventory')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id)
  } else {
    await supabase.from('player_inventory').insert({
      user_id: user.id, session_id: sessionId, item_id: itemId, quantity,
    })
  }

  return NextResponse.json({
    success: true,
    remainingGold: ps.gold - totalCost,
    itemName: item.name,
    quantity,
  })
}
```

**Step 4: Create shop + backpack pages**

Create `src/app/(game)/shop/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/lib/types'

export default function ShopPage() {
  const [items, setItems] = useState<Item[]>([])
  const [gold, setGold] = useState(0)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.from('items').select('*').order('shop_price').then(({ data }) => {
      if (data) setItems(data as unknown as Item[])
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('player_sessions').select('gold').eq('user_id', user.id).eq('session_id', sessionId).single()
        .then(({ data }) => { if (data) setGold(data.gold) })
    })
  }, [])

  async function buy(item: Item) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    const res = await fetch('/api/game/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, sessionId }),
    })
    const data = await res.json()

    if (res.ok) {
      setGold(data.remainingGold)
      setMessage(`Acquistato: ${data.itemName}!`)
    } else {
      setMessage(data.error)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const ITEM_TYPE_LABEL: Record<string, string> = {
    rete: '🎯 Rete', esca: '🍖 Esca', uovo: '🥚 Uovo', battaglia: '⚔️ Battaglia'
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Shop</h1>
        <span className="text-[#D4A96A] font-bold">💰 {gold} Oro</span>
      </div>

      {message && (
        <p className="text-[#F7C841] text-sm text-center mb-3 bg-[#F7C841]/10 rounded-lg p-2">{message}</p>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="text-2xl">{ITEM_TYPE_LABEL[item.type]?.split(' ')[0]}</div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{item.name}</p>
              <p className="text-xs text-white/50">{item.description}</p>
            </div>
            <button
              onClick={() => buy(item)}
              disabled={gold < item.shop_price}
              className="bg-[#D4A96A] text-[#0F1F2E] font-bold px-3 py-2 rounded-lg text-sm disabled:opacity-40"
            >
              💰 {item.shop_price}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create `src/app/(game)/backpack/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BackpackPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('player_inventory')
        .select('*, items(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .gt('quantity', 0)
        .then(({ data }) => { if (data) setInventory(data) })
    })
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-white mb-4">Zaino</h1>
      {inventory.length === 0 ? (
        <p className="text-center text-white/30 py-8">Zaino vuoto</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {inventory.map(inv => (
            <div key={inv.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="font-bold text-white text-sm">{inv.items?.name}</p>
              <p className="text-xs text-white/50">{inv.items?.description}</p>
              <p className="text-[#F7C841] font-bold mt-1">×{inv.quantity}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 5: Run tests**

```bash
npm run test:run -- src/app/api/game/shop/__tests__/buy.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: shop buy API, shop page, backpack page"
```

---

### Task 13: Profile + Leaderboard

**Files:**
- Create: `src/app/(game)/profile/page.tsx`

**Step 1: Create profile page**

Create `src/app/(game)/profile/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

interface LeaderboardEntry {
  rank: number
  nickname: string
  score: number
  creatures_caught: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [hallOfFame, setHallOfFame] = useState<any[]>([])
  const searchParams = useSearchParams()
  const sessionEnded = searchParams.get('ended') === '1'
  const supabase = createClient()

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      // Profile
      supabase.from('player_sessions').select('*, auth.users(nickname, avatar_url)')
        .eq('user_id', user.id).eq('session_id', sessionId).single()
        .then(({ data }) => { if (data) setProfile(data) })

      // Hall of fame
      supabase.from('hall_of_fame').select('*')
        .eq('user_id', user.id).order('awarded_at', { ascending: false }).limit(5)
        .then(({ data }) => { if (data) setHallOfFame(data) })
    })

    // Leaderboard — polling every 30s
    function fetchLeaderboard() {
      supabase
        .from('player_sessions')
        .select('score_final, level, exp, user_id')
        .eq('session_id', sessionId)
        .order('exp', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          if (data) {
            setLeaderboard(data.map((p: any, i: number) => ({
              rank: i + 1,
              nickname: p.user_id.slice(0, 8),  // simplified; join with users for nickname
              score: p.exp,
              creatures_caught: 0,  // join with player_creatures count
            })))
          }
        })
    }

    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4">
      {sessionEnded && (
        <div className="bg-[#7B4DB8]/20 border border-[#7B4DB8] rounded-xl p-4 mb-4 text-center">
          <p className="text-2xl font-bold text-white">🏆 Evento Terminato!</p>
          <p className="text-white/70 text-sm mt-1">La classifica finale è stata generata</p>
        </div>
      )}

      {/* Profile card */}
      {profile && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#3A9DBC] flex items-center justify-center text-xl">
              👤
            </div>
            <div>
              <p className="font-bold text-white">Giocatore</p>
              <p className="text-sm text-[#3A9DBC]">Livello {profile.level}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div><p className="text-[#F7C841] font-bold">{profile.exp}</p><p className="text-xs text-white/50">EXP</p></div>
            <div><p className="text-[#D4A96A] font-bold">{profile.gold}</p><p className="text-xs text-white/50">Oro</p></div>
            <div><p className="text-white font-bold">{profile.level}</p><p className="text-xs text-white/50">Livello</p></div>
          </div>
        </div>
      )}

      {/* Live leaderboard */}
      <h2 className="text-lg font-bold text-white mb-3">Classifica Live</h2>
      <div className="space-y-2 mb-6">
        {leaderboard.map(entry => (
          <div key={entry.rank} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
            <span className={`font-bold text-lg w-8 text-center ${
              entry.rank === 1 ? 'text-[#F7C841]' :
              entry.rank === 2 ? 'text-gray-300' :
              entry.rank === 3 ? 'text-[#D4A96A]' : 'text-white/40'
            }`}>
              {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
            </span>
            <span className="flex-1 text-white text-sm">{entry.nickname}</span>
            <span className="text-[#F7C841] font-bold text-sm">{entry.score} pt</span>
          </div>
        ))}
        {leaderboard.length === 0 && (
          <p className="text-center text-white/30 py-4">Caricamento classifica...</p>
        )}
      </div>

      {/* Hall of Fame */}
      {hallOfFame.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-[#F7C841] mb-3">🏆 Hall of Fame</h2>
          <div className="space-y-2">
            {hallOfFame.map(hof => (
              <div key={hof.id} className="bg-[#F7C841]/10 border border-[#F7C841]/30 rounded-xl p-3">
                <div className="flex justify-between">
                  <span className="text-white font-bold">{hof.season_label}</span>
                  <span className="text-[#F7C841]">#{hof.rank}</span>
                </div>
                <p className="text-sm text-white/60">{hof.score} punti · {hof.creatures_caught} creature</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/
git commit -m "feat: profile page with live leaderboard polling and Hall of Fame"
```

---

## Phase 4: Admin Panel

### Task 14: Admin Shell + Auth Guard

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/page.tsx` (dashboard)
- Create: `src/app/api/admin/dashboard/route.ts`

**Step 1: Create admin layout**

Create `src/app/(admin)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Check admin flag directly from auth.users
  const { data } = await supabase
    .from('auth.users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!data?.is_admin) redirect('/')

  return <AdminShell>{children}</AdminShell>
}
```

Create `src/components/admin/AdminShell.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',             label: '📊 Dashboard'  },
  { href: '/admin/sessions',    label: '🎮 Sessioni'   },
  { href: '/admin/creatures',   label: '🐾 Creature'   },
  { href: '/admin/missions',    label: '🎯 Missioni'   },
  { href: '/admin/qrcodes',     label: '📷 QR Codes'   },
  { href: '/admin/invites',     label: '🎟️ Inviti'     },
  { href: '/admin/players',     label: '👥 Giocatori'  },
  { href: '/admin/leaderboard', label: '🏆 Classifica' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-screen bg-[#0F1F2E] text-white">
      {/* Sidebar (desktop) / Bottom nav (mobile) */}
      <nav className="hidden md:flex flex-col w-48 border-r border-white/10 p-4 gap-1 shrink-0">
        <div className="font-bold text-[#3A9DBC] mb-4 text-lg">⚙️ Admin</div>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === href ? 'bg-[#3A9DBC]/20 text-[#3A9DBC]' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}>
            {label}
          </Link>
        ))}
      </nav>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 flex overflow-x-auto bg-[#0F1F2E] border-t border-white/10 z-10">
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`flex-shrink-0 px-3 py-2 text-xs text-center ${
              pathname === href ? 'text-[#3A9DBC]' : 'text-white/40'
            }`}>
            {label.split(' ')[0]}<br/>{label.split(' ').slice(1).join(' ')}
          </Link>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">{children}</main>
    </div>
  )
}
```

**Step 2: Create dashboard API + page**

Create `src/app/api/admin/dashboard/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const [players, encounters, duels, session] = await Promise.all([
    supabase.from('player_sessions').select('id', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('encounters').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('duels').select('id, status', { count: 'exact' }).eq('session_id', sessionId),
    supabase.from('sessions').select('status, end_at, name').eq('id', sessionId).single(),
  ])

  const caughtCount = encounters.data?.filter(e => e.status === 'caught').length ?? 0

  return NextResponse.json({
    sessionName: session.data?.name,
    sessionStatus: session.data?.status,
    endAt: session.data?.end_at,
    playerCount: players.count ?? 0,
    encounterTotal: encounters.count ?? 0,
    caughtCount,
    duelCount: duels.count ?? 0,
    activeDuels: duels.data?.filter(d => d.status === 'active').length ?? 0,
  })
}
```

Create `src/app/(admin)/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  sessionName: string; sessionStatus: string; endAt: string | null
  playerCount: number; encounterTotal: number; caughtCount: number
  duelCount: number; activeDuels: number
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [notifText, setNotifText] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) } })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const fetch = () => {
      window.fetch(`/api/admin/dashboard?sessionId=${selectedId}`)
        .then(r => r.json()).then(setStats)
    }
    fetch()
    const i = setInterval(fetch, 10000)
    return () => clearInterval(i)
  }, [selectedId])

  async function sendNotification() {
    if (!selectedId || !notifText.trim()) return
    await fetch('/api/admin/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, title: 'Annuncio', body: notifText }),
    })
    setNotifText('')
  }

  async function closeSession() {
    if (!selectedId || !confirm('Chiudere la sessione ora?')) return
    await fetch('/api/admin/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId }),
    })
    window.location.reload()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>

      {/* Session selector */}
      <div className="mb-4">
        <select
          value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 w-full"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Giocatori', value: stats.playerCount, color: '#3A9DBC' },
              { label: 'Catture', value: stats.caughtCount, color: '#34d399' },
              { label: 'Duelli', value: stats.duelCount, color: '#7B4DB8' },
              { label: 'Incontri', value: stats.encounterTotal, color: '#E85D2F' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={notifText} onChange={e => setNotifText(e.target.value)}
                placeholder="Messaggio broadcast..."
                className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={sendNotification}
                className="bg-[#3A9DBC] text-white px-4 rounded-lg font-bold text-sm">
                📢
              </button>
            </div>

            {stats.sessionStatus === 'active' && (
              <button onClick={closeSession}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">
                🔴 Termina Sessione Ora
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: admin shell, dashboard with live stats and quick actions"
```

---

### Task 15: Admin Session Wizard

**Files:**
- Create: `src/app/(admin)/sessions/page.tsx`
- Create: `src/app/api/admin/session/create/route.ts`
- Create: `src/app/api/admin/session/start/route.ts`
- Create: `src/app/api/admin/session/close/route.ts`

**Step 1: Create session management API routes**

Create `src/app/api/admin/session/create/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json()
  const { name, narrativeConfig, areaBounds, durationMinutes } = body

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name,
      narrative_config: narrativeConfig,
      area_bounds: areaBounds,
      duration_minutes: durationMinutes,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessionId: data.id })
}
```

Create `src/app/api/admin/session/start/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId } = await request.json()

  const { data: session } = await supabase
    .from('sessions')
    .select('duration_minutes, status')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  if (session.status !== 'ready') {
    return NextResponse.json({ error: "La sessione deve essere in stato 'pronta'" }, { status: 400 })
  }

  const startAt = new Date()
  const endAt = new Date(startAt.getTime() + session.duration_minutes * 60 * 1000)

  await supabase.from('sessions').update({
    status: 'active',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
  }).eq('id', sessionId)

  return NextResponse.json({ started: true, endAt: endAt.toISOString() })
}
```

Create `src/app/api/admin/session/close/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId } = await request.json()
  const admin = createAdminClient()

  // Close session
  await admin.from('sessions').update({
    status: 'ended',
    end_at: new Date().toISOString(),
  }).eq('id', sessionId)

  // Generate leaderboard — top players by EXP
  const { data: players } = await admin
    .from('player_sessions')
    .select('user_id, exp, level')
    .eq('session_id', sessionId)
    .order('exp', { ascending: false })

  if (players) {
    // Get current session name for season label
    const { data: session } = await admin.from('sessions').select('name').eq('id', sessionId).single()
    const seasonLabel = session?.name ?? 'Evento WildCatch'

    // Count creatures per player
    const hofEntries = await Promise.all(players.slice(0, 10).map(async (p, i) => {
      const { count } = await admin
        .from('player_creatures')
        .select('id', { count: 'exact' })
        .eq('user_id', p.user_id)
        .eq('session_id', sessionId)

      return {
        user_id: p.user_id,
        session_id: sessionId,
        rank: i + 1,
        score: p.exp,
        creatures_caught: count ?? 0,
        season_label: seasonLabel,
      }
    }))

    // Insert Hall of Fame entries
    await admin.from('hall_of_fame').insert(hofEntries)

    // Update score_final
    await Promise.all(players.map((p, i) =>
      admin.from('player_sessions')
        .update({ score_final: p.exp })
        .eq('user_id', p.user_id)
        .eq('session_id', sessionId)
    ))
  }

  // Broadcast session end via Realtime
  await admin.channel(`session:${sessionId}`).send({
    type: 'broadcast',
    event: 'session_ended',
    payload: { sessionId },
  })

  return NextResponse.json({ closed: true })
}
```

**Step 2: Create session wizard page**

Create `src/app/(admin)/sessions/page.tsx` — 4-step wizard:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/admin/MapPicker'), { ssr: false })

type WizardStep = 1 | 2 | 3 | 4

export default function SessionsPage() {
  const [step, setStep] = useState<WizardStep>(1)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Step 1: Narrative
  const [sessionName, setSessionName] = useState('')
  const [storyTitle, setStoryTitle] = useState('')
  const [introText, setIntroText] = useState('')
  const [villainName, setVillainName] = useState('')

  // Step 2: Area
  const [areaBounds, setAreaBounds] = useState<any>(null)
  const [durationMinutes, setDurationMinutes] = useState(120)

  // Step 3: (creature selection — simplified, full impl in creature admin)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard?sessionId=list').then(r => {
      // workaround: load sessions directly
    })
    // Load sessions
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().from('sessions').select('*').order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setSessions(data) })
    })
  }, [])

  async function createSession() {
    setLoading(true)
    const res = await fetch('/api/admin/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sessionName,
        narrativeConfig: { story_title: storyTitle, intro_text: introText, villain_name: villainName, chapters: [] },
        areaBounds,
        durationMinutes,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setSessionId(data.sessionId)
      setStep(4)
    }
    setLoading(false)
  }

  async function setReady(sid: string) {
    await import('@/lib/supabase/client').then(({ createClient }) =>
      createClient().from('sessions').update({ status: 'ready' }).eq('id', sid)
    )
    window.location.reload()
  }

  async function startSession(sid: string) {
    await fetch('/api/admin/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    window.location.reload()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Gestione Sessioni</h1>

      {/* Existing sessions */}
      <div className="space-y-3 mb-8">
        {sessions.map(s => (
          <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">{s.name}</p>
                <p className="text-sm text-white/50">{s.duration_minutes} min · {s.status}</p>
              </div>
              <div className="flex gap-2">
                {s.status === 'draft' && (
                  <button onClick={() => setReady(s.id)}
                    className="bg-[#F7C841] text-[#0F1F2E] px-3 py-1 rounded-lg text-sm font-bold">
                    Pronta
                  </button>
                )}
                {s.status === 'ready' && (
                  <button onClick={() => startSession(s.id)}
                    className="bg-[#34d399] text-[#0F1F2E] px-3 py-1 rounded-lg text-sm font-bold">
                    ▶ START
                  </button>
                )}
                {s.status === 'active' && (
                  <span className="text-[#34d399] font-bold text-sm">🟢 Attiva</span>
                )}
                {s.status === 'ended' && (
                  <span className="text-white/40 text-sm">Terminata</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create new session wizard */}
      <div className="border border-white/20 rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Crea Nuova Sessione</h2>

        {/* Step indicators */}
        <div className="flex gap-2 mb-6">
          {([1, 2, 3, 4] as WizardStep[]).map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-[#3A9DBC]' : 'bg-white/10'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 1: Nome e Narrativa</p>
            <input value={sessionName} onChange={e => setSessionName(e.target.value)}
              placeholder="Nome evento (es. WildCatch Estate 2026)"
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            <input value={storyTitle} onChange={e => setStoryTitle(e.target.value)}
              placeholder="Titolo storia"
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            <textarea value={introText} onChange={e => setIntroText(e.target.value)}
              placeholder="Testo introduttivo mostrato ai giocatori..."
              rows={3}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 resize-none" />
            <input value={villainName} onChange={e => setVillainName(e.target.value)}
              placeholder="Nome antagonista"
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            <button onClick={() => setStep(2)} disabled={!sessionName}
              className="w-full bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-50">
              Avanti →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 2: Area e Durata</p>
            <div className="h-64 rounded-xl overflow-hidden border border-white/20">
              <MapPicker onBoundsChange={setAreaBounds} />
            </div>
            <div>
              <label className="text-sm text-white/50">Durata (minuti)</label>
              <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(+e.target.value)}
                min={30} max={480}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">← Indietro</button>
              <button onClick={() => setStep(3)} disabled={!areaBounds}
                className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-50">Avanti →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 3: Creature</p>
            <p className="text-white/70 text-sm">
              Le creature disponibili vengono dal catalogo globale. Puoi configurare le probabilità di spawn
              dalla sezione <strong>Creature</strong> dopo aver creato la sessione.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">← Indietro</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl">Avanti →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 4: Rivedi e Crea</p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
              <p><span className="text-white/50">Nome:</span> <span className="text-white">{sessionName}</span></p>
              <p><span className="text-white/50">Storia:</span> <span className="text-white">{storyTitle || '—'}</span></p>
              <p><span className="text-white/50">Durata:</span> <span className="text-white">{durationMinutes} min</span></p>
              <p><span className="text-white/50">Area:</span> <span className="text-white">{areaBounds ? 'Definita ✅' : 'Non definita ⚠️'}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">← Indietro</button>
              <button onClick={createSession} disabled={loading}
                className="flex-1 bg-[#34d399] text-[#0F1F2E] font-bold py-3 rounded-xl disabled:opacity-50">
                {loading ? 'Creazione...' : '✅ Crea Sessione'}
              </button>
            </div>
            {sessionId && (
              <div className="bg-[#34d399]/10 border border-[#34d399] rounded-xl p-3 text-center">
                <p className="text-[#34d399] font-bold">Sessione creata!</p>
                <p className="text-sm text-white/60">Imposta come "Pronta" per distribuire i codici invito</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

Create `src/components/admin/MapPicker.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'

interface Bounds { north: number; south: number; east: number; west: number }

export default function MapPicker({ onBoundsChange }: { onBoundsChange: (b: Bounds) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    import('leaflet').then(L => {
      const map = L.map(containerRef.current!, { center: [43.91, 12.91], zoom: 15 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

      let rectangle: any = null

      // Simple bounding box draw via two clicks
      let firstPoint: L.LatLng | null = null

      map.on('click', (e) => {
        if (!firstPoint) {
          firstPoint = e.latlng
        } else {
          const bounds = L.latLngBounds(firstPoint, e.latlng)
          if (rectangle) map.removeLayer(rectangle)
          rectangle = L.rectangle(bounds, { color: '#3A9DBC', weight: 2 }).addTo(map)

          onBoundsChange({
            north: bounds.getNorth(), south: bounds.getSouth(),
            east: bounds.getEast(), west: bounds.getWest(),
          })
          firstPoint = null
        }
      })
    })
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full z-10 pointer-events-none">
        Click per primo angolo, poi secondo angolo
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: admin session wizard (4 steps), start/close API routes"
```

---

### Task 16: Admin Invites + QR Code Export

**Files:**
- Create: `src/app/api/admin/invites/route.ts`
- Create: `src/app/(admin)/invites/page.tsx`
- Create: `src/app/api/admin/qrcodes/route.ts`
- Create: `src/app/(admin)/qrcodes/page.tsx`

**Step 1: Create invites API**

Create `src/app/api/admin/invites/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, quantity } = await request.json()

  if (!sessionId || !quantity || quantity < 1 || quantity > 500) {
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Generate unique codes
  const codes: string[] = []
  const existing = new Set<string>()

  // Fetch existing codes for this session to avoid duplicates
  const { data: existingCodes } = await admin
    .from('session_invites')
    .select('code')
    .eq('session_id', sessionId)

  existingCodes?.forEach(c => existing.add(c.code))

  while (codes.length < quantity) {
    const code = generateCode()
    if (!existing.has(code)) { codes.push(code); existing.add(code) }
  }

  const invites = codes.map(code => ({ session_id: sessionId, code }))
  const { data, error } = await admin.from('session_invites').insert(invites).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes, count: data?.length ?? 0 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId richiesto' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('session_invites')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ invites: data ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { inviteId } = await request.json()
  const admin = createAdminClient()
  await admin.from('session_invites').update({ is_active: false }).eq('id', inviteId)

  return NextResponse.json({ revoked: true })
}
```

**Step 2: Create invites page**

Create `src/app/(admin)/invites/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InvitesPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [invites, setInvites] = useState<any[]>([])
  const [quantity, setQuantity] = useState(50)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/invites?sessionId=${selectedId}`)
      .then(r => r.json()).then(d => setInvites(d.invites ?? []))
  }, [selectedId])

  async function generateCodes() {
    setLoading(true)
    await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, quantity }),
    })
    const res = await fetch(`/api/admin/invites?sessionId=${selectedId}`)
    const data = await res.json()
    setInvites(data.invites ?? [])
    setLoading(false)
  }

  function exportCSV() {
    const csv = 'Codice,Usato\n' + invites.map(i =>
      `${i.code},${i.used_by_user_id ? 'Sì' : 'No'}`
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `inviti_${selectedId}.csv`; a.click()
  }

  const usedCount = invites.filter(i => i.used_by_user_id).length

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Codici Invito</h1>

      <div className="flex gap-2 mb-4">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <p className="text-white/50 text-sm mb-3">Genera nuovi codici</p>
        <div className="flex gap-2">
          <input type="number" value={quantity} onChange={e => setQuantity(+e.target.value)}
            min={1} max={200}
            className="w-24 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          <button onClick={generateCodes} disabled={loading || !selectedId}
            className="flex-1 bg-[#3A9DBC] text-white font-bold py-2 rounded-lg disabled:opacity-50">
            {loading ? 'Generazione...' : 'Genera Codici'}
          </button>
          {invites.length > 0 && (
            <button onClick={exportCSV}
              className="bg-[#34d399] text-[#0F1F2E] font-bold px-4 rounded-lg">
              CSV
            </button>
          )}
        </div>
      </div>

      {invites.length > 0 && (
        <div>
          <p className="text-sm text-white/50 mb-2">
            {invites.length} codici totali · {usedCount} usati · {invites.length - usedCount} disponibili
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {invites.map(inv => (
              <div key={inv.id}
                className={`rounded-lg p-2 text-center font-mono text-sm font-bold ${
                  inv.used_by_user_id
                    ? 'bg-white/5 text-white/30 line-through'
                    : inv.is_active ? 'bg-[#3A9DBC]/20 text-[#3A9DBC]' : 'bg-red-900/20 text-red-400'
                }`}>
                {inv.code}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Create QR codes admin**

Create `src/app/api/admin/qrcodes/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, type, payload, usesRemaining, label } = await request.json()

  const { data, error } = await supabase.from('qr_codes').insert({
    session_id: sessionId, type, payload, uses_remaining: usesRemaining ?? null, label,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ qrCode: data })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  const { data } = await supabase.from('qr_codes').select('*')
    .eq('session_id', sessionId!).order('created_at', { ascending: false })

  return NextResponse.json({ qrCodes: data ?? [] })
}
```

Create `src/app/(admin)/qrcodes/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QRCodeType } from '@/lib/types'

export default function QRCodesPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [qrCodes, setQrCodes] = useState<any[]>([])
  const [type, setType] = useState<QRCodeType>('oggetto')
  const [label, setLabel] = useState('')
  const [payload, setPayload] = useState('{}')
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sessions').select('id, name').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/qrcodes?sessionId=${selectedId}`)
      .then(r => r.json()).then(d => setQrCodes(d.qrCodes ?? []))
  }, [selectedId])

  async function createQR() {
    let parsedPayload: any
    try { parsedPayload = JSON.parse(payload) }
    catch { alert('Payload JSON non valido'); return }

    const res = await fetch('/api/admin/qrcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, type, payload: parsedPayload, usesRemaining, label }),
    })
    const data = await res.json()
    if (res.ok) {
      setQrCodes(prev => [data.qrCode, ...prev])
      setLabel(''); setPayload('{}')
    }
  }

  async function downloadQR(qrId: string, qrLabel: string) {
    // Generate QR code image client-side using qrcode library
    const QRCode = await import('qrcode')
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrId, { width: 300 })
    const link = document.createElement('a')
    link.download = `qr_${qrLabel || qrId}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const PAYLOAD_TEMPLATES: Record<QRCodeType, string> = {
    oggetto: '{"item_id":"UUID_ITEM","quantity":1}',
    indizio: '{"chapter_order":1,"text":"Testo indizio...","image_url":null}',
    uovo: '{"egg_rarity":"comune","creature_pool":[]}',
    boss: '{"creature_id":"UUID_CREATURE","level_override":10}',
    evento: '{"event_type":"bonus_exp","effect":{"multiplier":2,"duration_minutes":10}}',
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">QR Codes</h1>

      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 mb-4">
        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 space-y-3">
        <p className="font-bold text-white">Crea QR Code</p>
        <div className="flex gap-2">
          <select value={type} onChange={e => { setType(e.target.value as QRCodeType); setPayload(PAYLOAD_TEMPLATES[e.target.value as QRCodeType]) }}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
            {(['oggetto','indizio','uovo','boss','evento'] as QRCodeType[]).map(t =>
              <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Etichetta (es. Stazione A)"
            className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea value={payload} onChange={e => setPayload(e.target.value)}
          rows={3} className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 font-mono text-xs resize-none" />
        <div className="flex gap-2">
          <input type="number" placeholder="Usi (vuoto=illimitato)"
            value={usesRemaining ?? ''} onChange={e => setUsesRemaining(e.target.value ? +e.target.value : null)}
            className="w-40 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          <button onClick={createQR}
            className="flex-1 bg-[#E85D2F] text-white font-bold py-2 rounded-lg">
            Crea QR
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {qrCodes.map(qr => (
          <div key={qr.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{qr.label || qr.type}</p>
              <p className="text-xs text-white/40 font-mono">{qr.id.slice(0, 12)}...</p>
              <p className="text-xs text-white/40">
                {qr.uses_remaining === null ? '∞ usi' : `${qr.uses_remaining} usi rimanenti`}
              </p>
            </div>
            <button onClick={() => downloadQR(qr.id, qr.label)}
              className="bg-[#3A9DBC] text-white px-3 py-1.5 rounded-lg text-sm">
              ⬇ PNG
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: admin invites batch generation + QR code creation/export"
```

---

### Task 17: Admin Creatures CRUD + AI Artwork

**Files:**
- Create: `src/app/(admin)/creatures/page.tsx`
- Create: `src/app/api/admin/creatures/route.ts`
- Create: `src/app/api/admin/creatures/[id]/artwork/route.ts`

**Step 1: Creatures API**

Create `src/app/api/admin/creatures/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin.from('creatures').select('*').order('name')
  return NextResponse.json({ creatures: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await request.json()
  const { name, description, element, rarity, hp, atk, def, minLevel, spawnWeight, evolutionOf } = body

  const admin = createAdminClient()
  const { data, error } = await admin.from('creatures').insert({
    name, description, element, rarity, hp, atk, def,
    min_level: minLevel ?? 1,
    spawn_weight: spawnWeight ?? 10,
    evolution_of: evolutionOf ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ creature: data })
}
```

Create `src/app/api/admin/creatures/[id]/artwork/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'

const ART_STYLE_SUFFIX = [
  'Mediterranean adventure illustration style,',
  'bold 2-3px outline, cel-shading, warm Italian summer ambient light,',
  'clean white background, Pokémon-style creature design,',
  'vibrant colors, digital illustration, high quality',
].join(' ')

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { prompt, imageType = 'main' } = await request.json()
  // imageType: 'main' | 'thumbnail' | 'encounter' | 'ui'

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key non configurata' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const admin = createAdminClient()

  // Get creature for context
  const { data: creature } = await admin.from('creatures').select('name, element, description').eq('id', params.id).single()
  if (!creature) return NextResponse.json({ error: 'Creatura non trovata' }, { status: 404 })

  const fullPrompt = `${creature.name}, ${creature.element} element creature, ${creature.description}. ${prompt ? prompt + '. ' : ''}${ART_STYLE_SUFFIX}`

  const configs: Record<string, { size: '1024x1024' | '1536x1024'; quality: 'high' | 'medium' }> = {
    main:      { size: '1024x1024', quality: 'high' },
    thumbnail: { size: '1024x1024', quality: 'medium' },
    encounter: { size: '1536x1024', quality: 'high' },
    ui:        { size: '1024x1024', quality: 'medium' },
  }
  const { size, quality } = configs[imageType] ?? configs.main

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      size,
      quality,
      n: 1,
    })

    const imageData = response.data[0]
    const imageUrl = imageData.url
    if (!imageUrl) return NextResponse.json({ error: 'Nessuna immagine generata' }, { status: 500 })

    // Download image and upload to Supabase Storage
    const imgRes = await fetch(imageUrl)
    const buffer = await imgRes.arrayBuffer()
    const fileName = `creatures/${params.id}/${imageType}_${Date.now()}.png`

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('wildcatch')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage.from('wildcatch').getPublicUrl(fileName)

    // Update creature with new image URL
    const field = imageType === 'main' ? 'image_url' : imageType === 'thumbnail' ? 'sprite_url' : 'image_url'
    await admin.from('creatures').update({ [field]: publicUrl }).eq('id', params.id)

    return NextResponse.json({ imageUrl: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Errore generazione immagine' }, { status: 500 })
  }
}
```

**Step 2: Create creatures admin page**

Create `src/app/(admin)/creatures/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { Element, Rarity } from '@/lib/types'

const ELEMENTS: Element[] = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia']
const RARITIES: Rarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario']

export default function CreaturesPage() {
  const [creatures, setCreatures] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({
    name: '', description: '', element: 'fiamma' as Element, rarity: 'comune' as Rarity,
    hp: 60, atk: 40, def: 30, spawnWeight: 10, evolutionOf: ''
  })
  const [artPrompt, setArtPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/creatures').then(r => r.json())
      .then(d => setCreatures(d.creatures ?? []))
  }, [])

  async function createCreature() {
    const res = await fetch('/api/admin/creatures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, minLevel: 1 }),
    })
    const data = await res.json()
    if (res.ok) {
      setCreatures(prev => [...prev, data.creature])
      setMessage(`Creatura "${form.name}" creata!`)
    } else {
      setMessage(data.error)
    }
  }

  async function generateArtwork(creatureId: string, type: string) {
    setGenerating(true)
    const res = await fetch(`/api/admin/creatures/${creatureId}/artwork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: artPrompt, imageType: type }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Artwork generato!')
      // Refresh creature
      const refreshed = await fetch('/api/admin/creatures').then(r => r.json())
      setCreatures(refreshed.creatures ?? [])
    } else {
      setMessage(data.error)
    }
    setGenerating(false)
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Creature Catalogue</h1>
      {message && <p className="text-[#F7C841] text-sm mb-4 bg-[#F7C841]/10 rounded-lg p-2">{message}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create form */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h2 className="font-bold mb-3">Nuova Creatura</h2>
          <div className="space-y-2">
            {[
              ['Nome', 'name', 'text'],
              ['Descrizione', 'description', 'text'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="text-xs text-white/50">{label}</label>
                <input type={type as string} value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-white/50">Elemento</label>
                <select value={form.element} onChange={e => setForm(p => ({ ...p, element: e.target.value as Element }))}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                  {ELEMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50">Rarità</label>
                <select value={form.rarity} onChange={e => setForm(p => ({ ...p, rarity: e.target.value as Rarity }))}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                  {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['hp', 'atk', 'def'] as const).map(stat => (
                <div key={stat}>
                  <label className="text-xs text-white/50">{stat.toUpperCase()}</label>
                  <input type="number" value={(form as any)[stat]}
                    onChange={e => setForm(p => ({ ...p, [stat]: +e.target.value }))}
                    className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-white/50">Evoluzione di (UUID creatura base, opzionale)</label>
              <input value={form.evolutionOf}
                onChange={e => setForm(p => ({ ...p, evolutionOf: e.target.value }))}
                placeholder="lascia vuoto se è una forma base"
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-xs mt-0.5 font-mono" />
            </div>
            <button onClick={createCreature}
              className="w-full bg-[#E85D2F] text-white font-bold py-2 rounded-xl">
              Crea Creatura
            </button>
          </div>
        </div>

        {/* Creature list */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {creatures.map(c => (
            <div key={c.id} onClick={() => setSelected(c)}
              className={`flex items-center gap-3 bg-white/5 border rounded-xl p-3 cursor-pointer transition-colors ${
                selected?.id === c.id ? 'border-[#3A9DBC]' : 'border-white/10 hover:border-white/20'
              }`}>
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                {c.image_url ? (
                  <Image src={c.image_url} alt={c.name} width={48} height={48} className="w-full h-full object-contain" />
                ) : <div className="w-full h-full flex items-center justify-center text-xl">🐾</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{c.name}</p>
                <p className="text-xs text-white/40">{c.element} · {c.rarity} · HP:{c.hp} ATK:{c.atk}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Artwork generation panel */}
      {selected && (
        <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="font-bold mb-3">Genera Artwork AI — {selected.name}</h3>
          <div className="flex gap-2 mb-3">
            <input value={artPrompt} onChange={e => setArtPrompt(e.target.value)}
              placeholder="Prompt aggiuntivo (opzionale)"
              className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[['main','Artwork (1024×1024 high)'],['thumbnail','Thumbnail (medium)'],['encounter','Incontro (1536×1024 high)']].map(([type, label]) => (
              <button key={type} onClick={() => generateArtwork(selected.id, type)} disabled={generating}
                className="bg-[#7B4DB8] text-white py-2 px-3 rounded-xl text-xs font-bold disabled:opacity-50">
                {generating ? '⏳' : '🎨'} {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/30 mt-2">Modello: gpt-image-1 · Costo: $0.042–$0.250 per immagine</p>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: admin creatures CRUD with AI artwork generation via gpt-image-1"
```

---

### Task 18: Admin Notify + Players View

**Files:**
- Create: `src/app/api/admin/notify/route.ts`
- Create: `src/app/(admin)/players/page.tsx`

**Step 1: Notify API**

Create `src/app/api/admin/notify/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { sessionId, title, body } = await request.json()
  if (!sessionId || !title || !body) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Save notification to DB
  await admin.from('notifications').insert({
    session_id: sessionId,
    title, body,
    sent_by_admin_id: user.id,
  })

  // Broadcast via Supabase Realtime
  await admin.channel(`session:${sessionId}:notifications`).send({
    type: 'broadcast',
    event: 'admin_notification',
    payload: { title, body },
  })

  return NextResponse.json({ sent: true })
}
```

**Step 2: Players page**

Create `src/app/(admin)/players/page.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PlayersPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [players, setPlayers] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sessions').select('id, name').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const fetch = () => {
      supabase.from('player_sessions')
        .select('*, user_id, level, exp, gold, role, score_final')
        .eq('session_id', selectedId)
        .order('exp', { ascending: false })
        .then(({ data }) => { if (data) setPlayers(data) })
    }
    fetch()
    const i = setInterval(fetch, 15000)
    return () => clearInterval(i)
  }, [selectedId])

  async function grantGold(userId: string, amount: number) {
    await supabase.from('player_sessions')
      .update({ gold: supabase.raw(`gold + ${amount}`) as any })
      .eq('user_id', userId).eq('session_id', selectedId)
    alert(`+${amount} Oro assegnato`)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Giocatori</h1>

      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 mb-4">
        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-white/40 w-6 text-sm">#{i + 1}</span>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{p.user_id.slice(0, 12)}...</p>
              <p className="text-xs text-white/40">Lv {p.level} · {p.exp} EXP · 💰 {p.gold}</p>
            </div>
            <button onClick={() => grantGold(p.user_id, 50)}
              className="text-xs bg-[#D4A96A] text-[#0F1F2E] px-2 py-1 rounded-lg font-bold">
              +50 🪙
            </button>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-center text-white/30 py-8">Nessun giocatore in questa sessione</p>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: admin notify broadcast, players live view"
```

---

## Phase 5: Polish & Infrastructure

### Task 19: PWA Configuration + Keep-Alive Cron

**Files:**
- Modify: `next.config.ts`
- Create: `public/manifest.json`
- Create: `src/app/api/cron/keepalive/route.ts`
- Create: `vercel.json`

**Step 1: Configure next-pwa**

Update `next.config.ts`:

```typescript
import type { NextConfig } from 'next'
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/[a-z]+\.tile\.openstreetmap\.org\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'osm-tiles',
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'creature-images',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets' },
    },
  ],
})

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

module.exports = withPWA(nextConfig)
```

**Step 2: Create PWA manifest**

Create `public/manifest.json`:

```json
{
  "name": "WildCatch",
  "short_name": "WildCatch",
  "description": "La prima avventura outdoor dove catturi creature e risolvi misteri",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F1F2E",
  "theme_color": "#3A9DBC",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Place placeholder icons at `public/icons/icon-192.png` and `public/icons/icon-512.png` (generate from AI art or use a placeholder).

Add to `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
export const metadata: Metadata = {
  manifest: '/manifest.json',
  themeColor: '#3A9DBC',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'WildCatch' },
}
```

**Step 3: Keep-alive cron**

Create `src/app/api/cron/keepalive/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  // Simple keep-alive ping to prevent Supabase free tier from pausing
  const { data } = await admin.from('sessions').select('id').limit(1)
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
```

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/keepalive",
      "schedule": "0 12 * * *"
    }
  ]
}
```

Add `CRON_SECRET` to `.env.local.example`:

```bash
CRON_SECRET=your-random-secret-here
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: PWA manifest/service worker, Supabase keep-alive daily cron"
```

---

### Task 20: Onboarding Flow + GDPR-K

**Files:**
- Create: `src/app/(game)/onboarding/page.tsx`
- Modify: `src/app/auth/callback/route.ts`

**Step 1: Create onboarding page**

Create `src/app/(game)/onboarding/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SLIDES = [
  { title: 'Esplora!', body: 'Muoviti nell\'area evento per incontrare creature selvatiche', emoji: '🗺️' },
  { title: 'Cattura!', body: 'Usa le Reti per catturare creature. Più rara la creatura, più difficile la cattura', emoji: '🎯' },
  { title: 'Risolvi!', body: 'Scansiona QR code fisici e completa missioni per sbloccare la storia', emoji: '🔍' },
]

export default function OnboardingPage() {
  const [slide, setSlide] = useState(0)
  const [nickname, setNickname] = useState('')
  const [gdprConsent, setGdprConsent] = useState(false)
  const [gdprMinor, setGdprMinor] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function completeOnboarding() {
    if (!gdprConsent) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // Update user profile
    await supabase.auth.updateUser({
      data: {
        nickname: nickname.trim() || user.email?.split('@')[0] ?? 'Avventuriero',
        gdpr_consent_at: new Date().toISOString(),
        gdpr_consent_minor: gdprMinor,
      }
    })

    // Re-process pending invite code
    const pendingCode = sessionStorage.getItem('pending_code')
    if (pendingCode) {
      sessionStorage.removeItem('pending_code')
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pendingCode }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('current_session_id', data.sessionId)
      }
    }

    router.push('/game/map')
  }

  if (slide < SLIDES.length) {
    const s = SLIDES[slide]
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-7xl mb-6">{s.emoji}</div>
        <h2 className="text-2xl font-bold text-white mb-3">{s.title}</h2>
        <p className="text-white/60 text-lg mb-8">{s.body}</p>
        <div className="flex gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-[#3A9DBC]' : 'w-2 bg-white/20'}`} />
          ))}
        </div>
        <button onClick={() => setSlide(s => s + 1)}
          className="w-full max-w-xs bg-[#E85D2F] text-white font-bold py-4 rounded-xl text-lg">
          {slide < SLIDES.length - 1 ? 'Avanti →' : 'Quasi pronto!'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center h-full p-6 max-w-sm mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Scegli il tuo nome</h2>
      <p className="text-white/50 text-sm mb-6">Come vuoi essere conosciuto dagli altri giocatori?</p>

      <input
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        placeholder="Il tuo nickname"
        maxLength={20}
        className="bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-lg mb-6"
      />

      <div className="space-y-3 mb-8">
        <label className="flex gap-3 items-start cursor-pointer">
          <input type="checkbox" checked={gdprConsent} onChange={e => setGdprConsent(e.target.checked)}
            className="mt-1 accent-[#3A9DBC]" />
          <span className="text-sm text-white/70">
            Ho 14 anni o più, oppure ho il consenso di un genitore/tutore. Accetto la raccolta dei dati necessari per il gioco (nickname, progressi).
          </span>
        </label>

        <label className="flex gap-3 items-center cursor-pointer">
          <input type="checkbox" checked={gdprMinor} onChange={e => setGdprMinor(e.target.checked)}
            className="accent-[#3A9DBC]" />
          <span className="text-sm text-white/50">Ho meno di 14 anni (gioco con il consenso di un genitore)</span>
        </label>
      </div>

      <button
        onClick={completeOnboarding}
        disabled={!gdprConsent || loading}
        className="w-full bg-[#3A9DBC] text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
      >
        {loading ? 'Caricamento...' : 'Inizia l\'avventura! 🎮'}
      </button>
    </div>
  )
}
```

**Step 2: Update auth callback to redirect to onboarding on first login**

Update `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // First-time login: no nickname set → go to onboarding
      if (user && !user.user_metadata?.nickname) {
        return NextResponse.redirect(`${origin}/game/onboarding`)
      }
      return NextResponse.redirect(`${origin}/game/map`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
```

**Step 3: Add game/onboarding to middleware**

Update `src/middleware.ts` — add `/game/onboarding` to protected game routes (already covered by `/game/:path*` matcher).

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: onboarding flow with tutorial slides, nickname + GDPR-K consent"
```

---

### Task 21: Seed Data — Starter Items + 30 Creatures Scaffold

**Files:**
- Create: `supabase/seed.sql`
- Create: `scripts/generate-artwork.ts`

**Step 1: Create seed SQL**

Create `supabase/seed.sql`:

```sql
-- Starter items
INSERT INTO items (name, type, effect_value, description, shop_price) VALUES
  ('Rete Base',        'rete',      0.00, 'Rete standard per catturare creature',              0),
  ('Rete Avanzata',    'rete',      0.10, 'Rete migliorata: +10% probabilità di cattura',    50),
  ('Rete Speciale',    'rete',      0.20, 'Rete rara: +20% probabilità di cattura',          120),
  ('Rete Leggendaria', 'rete',      0.35, 'Rete leggendaria: +35% probabilità di cattura',  300),
  ('Esca Profumata',   'esca',      0.00, 'Attira creature nelle vicinanze per 5 minuti',     80),
  ('Esca Rara',        'esca',      0.00, 'Attira creature rare per 10 minuti',              200),
  ('Pozione',          'battaglia', 15.0, 'Cura la tua creatura in battaglia (+15 HP)',        40),
  ('Super Pozione',    'battaglia', 30.0, 'Cura potenziata per la tua creatura (+30 HP)',      90),
  ('Uovo Comune',      'uovo',      0.00, 'Uovo contenente una creatura comune',              100),
  ('Uovo Raro',        'uovo',      0.00, 'Uovo contenente una creatura rara',                250);

-- 30 creature scaffold (images generated separately via AI script)
-- Base forms (15 creatures, one per element × rarity tier)
INSERT INTO creatures (name, description, element, rarity, hp, atk, def, spawn_weight) VALUES
  -- Fiamma
  ('Fiammino',   'Piccola creatura di fuoco che lascia scie di braci',          'fiamma',    'comune',     40, 35, 20, 70),
  ('Braciola',   'Spirito del fuoco che danza tra le erbe secche',              'fiamma',    'non_comune', 60, 50, 30, 45),
  ('Piraga',     'Serpente di lava nato dalle rocce vulcaniche',                'fiamma',    'raro',       80, 70, 40, 25),
  ('Infernale',  'Drago di fuoco emerso dalle fessure vulcaniche',              'fiamma',    'epico',     110, 90, 55, 12),
  ('Rovente',    'Antico spirito del vulcano, signore delle fiamme eterne',     'fiamma',    'leggendario',140,115, 70,  5),
  -- Adriatico
  ('Spruzzino',  'Creaturina marina che schizza acqua dagli occhi',             'adriatico', 'comune',     45, 30, 25, 70),
  ('Vortichino', 'Piccolo vortice marino con personalità capricciosa',          'adriatico', 'non_comune', 65, 45, 40, 45),
  ('Cavalondo',  'Cavalcaonde antico che guida i pesci nelle tempeste',         'adriatico', 'raro',       85, 65, 55, 25),
  ('Mareggiata', 'Spirito delle grandi onde dell\'Adriatico',                   'adriatico', 'epico',     115, 85, 70, 12),
  ('Poseidone',  'Guardiano eterno delle acque adriatiche',                     'adriatico', 'leggendario',145,110, 85,  5),
  -- Bosco
  ('Fogliolina', 'Creatura foglia che si mimetizza tra gli alberi',             'bosco',     'comune',     50, 28, 30, 70),
  ('Arbusto',    'Spirito del bosco appenninico con radici preziose',           'bosco',     'non_comune', 70, 42, 45, 45),
  ('Cervo Mago', 'Cervo mistico guardiano del bosco marchigiano',               'bosco',     'raro',       90, 60, 60, 25),
  ('Foresta',    'Antico spirito arboreo che protegge la flora locale',         'bosco',     'epico',     120, 80, 75, 12),
  ('Driade',     'Entità primordiale della foresta adriatica',                  'bosco',     'leggendario',150,105, 90,  5),
  -- Terra
  ('Sassolino',  'Piccola creatura di argilla delle colline marchigiane',       'terra',     'comune',     55, 25, 35, 70),
  ('Collinetta', 'Spirito delle dolci colline pesaresi',                        'terra',     'non_comune', 75, 38, 52, 45),
  ('Rupicolo',   'Guardiano delle antiche rocce calcaree',                      'terra',     'raro',       95, 55, 68, 25),
  ('Terremoto',  'Creatura tellurica che scuote la terra al galoppo',           'terra',     'epico',     125, 75, 82, 12),
  ('Appennino',  'Leggendario spirito della catena appenninica',                'terra',     'leggendario',155,100, 95,  5),
  -- Armonia (solo Epico/Leggendario)
  ('Melodia',    'Spirito musicale nato dalle note rossiane',                   'armonia',   'epico',     112, 88, 65, 10),
  ('Sinfonia',   'Leggendaria creatura sonora dell\'UNESCO City of Music',      'armonia',   'leggendario',142,112, 80,  3);

-- Evolved forms for starter creatures (comuni)
INSERT INTO creatures (name, description, element, rarity, hp, atk, def, spawn_weight, evolution_of)
SELECT
  c.name || '+',
  'Forma evoluta di ' || c.name || '. Più potente e maestosa.',
  c.element,
  'non_comune',
  ROUND(c.hp * 1.5),
  ROUND(c.atk * 1.5),
  ROUND(c.def * 1.5),
  0,  -- evolved forms don't spawn wild
  c.id
FROM creatures c
WHERE c.rarity = 'comune';
```

Apply seed:

```bash
npx supabase db reset --db-url YOUR_DB_URL  # only on dev
# Or run in Supabase SQL Editor for production
```

**Step 2: Create artwork generation script**

Create `scripts/generate-artwork.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * WildCatch AI Artwork Generator
 * Usage: npx tsx scripts/generate-artwork.ts
 *
 * Generates all 3 image types for each creature using OpenAI gpt-image-1
 * Estimated cost: ~$14.20 total (see spec Section 4 for breakdown)
 *
 * Prerequisites:
 *   - OPENAI_API_KEY in environment
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 *   - Creatures already seeded in database
 */
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ART_STYLE = 'Mediterranean adventure illustration, bold 2-3px outline, cel-shading, warm Italian summer ambient light, clean white background, Pokémon-style creature design, vibrant colors'

const IMAGE_CONFIGS = [
  { type: 'main',      size: '1024x1024' as const, quality: 'high' as const,   field: 'image_url'  },
  { type: 'thumbnail', size: '1024x1024' as const, quality: 'medium' as const, field: 'sprite_url' },
  { type: 'encounter', size: '1536x1024' as const, quality: 'high' as const,   field: 'image_url'  },
]

async function main() {
  const { data: creatures, error } = await supabase
    .from('creatures')
    .select('id, name, element, description, rarity')
    .order('rarity')

  if (error || !creatures) { console.error('Error fetching creatures:', error); process.exit(1) }

  console.log(`Found ${creatures.length} creatures to process`)

  // Create output dir for downloaded images
  const outDir = 'scripts/generated-artwork'
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  for (const creature of creatures) {
    console.log(`\nProcessing: ${creature.name} (${creature.element}, ${creature.rarity})`)

    for (const config of IMAGE_CONFIGS) {
      const prompt = `${creature.name}, ${creature.element} element creature, ${creature.description}, ${ART_STYLE}`

      try {
        console.log(`  Generating ${config.type} (${config.quality})...`)

        const response = await openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          size: config.size,
          quality: config.quality,
          n: 1,
        })

        const imageUrl = response.data[0]?.url
        if (!imageUrl) { console.warn(`  No URL returned for ${config.type}`); continue }

        // Download image
        const imgRes = await fetch(imageUrl)
        const buffer = Buffer.from(await imgRes.arrayBuffer())

        const fileName = `creatures/${creature.id}/${config.type}.png`
        const localPath = path.join(outDir, `${creature.name}_${config.type}.png`)

        // Save locally as backup
        fs.writeFileSync(localPath, buffer)

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('wildcatch')
          .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

        if (uploadError) { console.warn(`  Upload failed: ${uploadError.message}`); continue }

        const { data: { publicUrl } } = supabase.storage.from('wildcatch').getPublicUrl(fileName)

        // Update creature record (only update image_url once — use main type)
        if (config.type === 'main') {
          await supabase.from('creatures').update({ image_url: publicUrl }).eq('id', creature.id)
        } else if (config.type === 'thumbnail') {
          await supabase.from('creatures').update({ sprite_url: publicUrl }).eq('id', creature.id)
        }

        console.log(`  ✅ ${config.type} → ${publicUrl.slice(-30)}`)

        // Rate limit: wait 1s between requests to avoid OpenAI rate limiting
        await new Promise(r => setTimeout(r, 1000))

      } catch (err: any) {
        console.error(`  ❌ Error for ${creature.name}/${config.type}:`, err.message)
      }
    }
  }

  console.log('\n✅ Artwork generation complete!')
  console.log(`Images saved locally to: ${outDir}/`)
}

main().catch(console.error)
```

Add to `package.json`:

```json
"generate-artwork": "tsx scripts/generate-artwork.ts"
```

**Step 3: Set up Supabase Storage bucket**

Run in Supabase Dashboard → Storage → Create bucket:
- Name: `wildcatch`
- Public: yes (creature images are public)

**Step 4: Commit**

```bash
git add supabase/ scripts/
git commit -m "feat: seed data (30 creatures + evolved forms + items), AI artwork generator script"
```

---

### Task 22: Final Integration + Deployment

**Files:**
- Modify: `src/app/(game)/layout.tsx` (session timer + notifications)
- Create: `src/hooks/useSessionTimer.ts`
- Create: `src/hooks/useNotifications.ts`

**Step 1: Session timer hook**

Create `src/hooks/useSessionTimer.ts`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSessionTimer(sessionId: string | null) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null) // seconds
  const [warning, setWarning] = useState<'10min' | '5min' | 'ended' | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!sessionId) return

    supabase.from('sessions').select('end_at, status').eq('id', sessionId).single()
      .then(({ data }) => {
        if (!data?.end_at) return
        const endAt = new Date(data.end_at).getTime()

        const interval = setInterval(() => {
          const now = Date.now()
          const remaining = Math.max(0, Math.floor((endAt - now) / 1000))
          setTimeLeft(remaining)

          if (remaining === 0) { setWarning('ended'); clearInterval(interval) }
          else if (remaining <= 5 * 60 && warning !== '5min' && warning !== 'ended') setWarning('5min')
          else if (remaining <= 10 * 60 && !warning) setWarning('10min')
        }, 1000)

        return () => clearInterval(interval)
      })

    // Subscribe to session end broadcast
    const channel = supabase.channel(`session:${sessionId}`)
      .on('broadcast', { event: 'session_ended' }, () => setWarning('ended'))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return { timeLeft, formattedTime: timeLeft !== null ? formatTime(timeLeft) : '--:--', warning }
}
```

**Step 2: Admin notification listener hook**

Create `src/hooks/useNotifications.ts`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GameNotification { title: string; body: string; id: string }

export function useNotifications(sessionId: string | null) {
  const [notifications, setNotifications] = useState<GameNotification[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session:${sessionId}:notifications`)
      .on('broadcast', { event: 'admin_notification' }, ({ payload }) => {
        const notif: GameNotification = {
          id: Date.now().toString(),
          title: payload.title,
          body: payload.body,
        }
        setNotifications(prev => [notif, ...prev].slice(0, 5))
        // Auto-dismiss after 8 seconds
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 8000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  return { notifications, dismiss: (id: string) => setNotifications(prev => prev.filter(n => n.id !== id)) }
}
```

**Step 3: Update GameShell with timer + notifications**

Update `src/components/GameShell.tsx` to wire in these hooks — replace the static header with:

```tsx
// In GameShell, add:
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useNotifications } from '@/hooks/useNotifications'
import { AnimatePresence, motion } from 'framer-motion'

// Inside the component:
const sessionId = typeof window !== 'undefined' ? localStorage.getItem('current_session_id') : null
const { formattedTime, warning } = useSessionTimer(sessionId)
const { notifications, dismiss } = useNotifications(sessionId)

// Replace timer in header with:
<div className={`text-sm font-mono ${warning === '5min' || warning === 'ended' ? 'text-red-400 animate-pulse' : 'text-[#E85D2F]'}`}>
  ⏱ {formattedTime}
</div>

// Above main content, add notification banners:
<AnimatePresence>
  {notifications.map(n => (
    <motion.div key={n.id} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
      className="absolute top-0 inset-x-0 bg-[#3A9DBC] text-white p-3 z-50 flex items-start justify-between"
      onClick={() => dismiss(n.id)}>
      <div>
        <p className="font-bold text-sm">{n.title}</p>
        <p className="text-xs opacity-80">{n.body}</p>
      </div>
      <span className="text-white/60 ml-2">✕</span>
    </motion.div>
  ))}
</AnimatePresence>
```

**Step 4: Deploy to Vercel**

1. Push to GitHub:

```bash
git push origin master
```

2. Go to vercel.com → Import repository → `OlegKonchenkov/wild-catch`

3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `OPENAI_API_KEY`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL

4. Configure Supabase Auth:
   - Dashboard → Auth → URL Configuration → Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`
   - Enable Google provider → paste Google OAuth credentials

5. Enable Supabase Realtime for tables:
   - Dashboard → Database → Replication → Enable `duels`, `sessions`, `notifications`

6. Run `supabase db push` one more time pointing at production Supabase URL

**Step 5: Run full test suite before deploy**

```bash
npm run test:run
npm run build
```

Expected: all tests PASS, build succeeds with no errors.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: session timer with warnings, admin notification banners, production deployment config"
```

---

## Post-v1 Feature: Effetti di Stato

Aggiunto dopo il piano iniziale. Implementato in migration `022_status_effects.sql`.

### Schema aggiunto

```sql
-- creatures
ALTER TABLE creatures
  ADD COLUMN status_effect text CHECK (status_effect IN ('paralisi','confusione','sonno','veleno')),
  ADD COLUMN status_effect_chance float DEFAULT 0.15,
  ADD COLUMN catch_difficulty int DEFAULT 3;

-- encounters
ALTER TABLE encounters
  ADD COLUMN wild_status text,
  ADD COLUMN wild_status_turns int DEFAULT 0,
  ADD COLUMN player_status text,
  ADD COLUMN player_status_turns int DEFAULT 0;

-- duel_lineups: active_status, status_turns_left
-- boss_fights: player_lineup e boss_lineup JSONB con active_status/status_turns_left per slot
```

### Logica — `src/lib/game/combat.ts`

`STATUS_EFFECT_META` definisce durata e comportamento per effetto:

| Effetto | turns | preventsAttack |
|---|---|---|
| paralisi | 2 | false (65% skip, 35% attacca) |
| sonno | 2 | true (sempre skip) |
| confusione | 3 | false (50% self-hit) |
| veleno | 0 (permanente) | false |

### Regole di applicazione (tutte le modalità)

1. Effetto applicato **al momento del danno** — non a fine turno
2. Re-applicazione **resetta il counter** (nessun guard `!existingStatus`)
3. Paralisi/sonno applicati questo turno → bloccano già il controattacco nello stesso turno
4. Bonus catch rate: sonno ×2.0, paralisi/confusione ×1.5

### Differenze per modalità

**Encounter fight/catch** (`encounter/fight/route.ts`, `encounter/catch/route.ts`):
- Pre-turn tick su wild e player prima del combattimento
- Status applicato post-player-attack ma pre-counter-attack del wild
- Catch route: addormentata = blocked; paralizzata = non fugge, 35% contrattacca

**Boss fight** (`boss/[id]/route.ts`):
- Pre-turn tick su player e boss (veleno + sonno/paralisi/confusione)
- Player→boss status rollato PRIMA del counter-attack del boss
- `skipBossAttack` flag analogamente a `skipWildAttack`

**Duel** (`duel/action/route.ts`):
- Sonno: return anticipato (skip turno automatico)
- Paralisi: tick + 65% return anticipato, 35% cade attraverso all'attacco normale
- Confusione: tick + 50% self-hit con return, 50% cade attraverso
- Scrittura su `duel_lineups.active_status` PRIMA di flip `duels.current_turn` (evita race condition postgres_changes)

---

## Appendix: Supabase MCP Setup

When you receive MCP credentials from the user, configure the Supabase MCP server to allow direct database operations without copying SQL into the dashboard.

Expected config in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_SUPABASE_PAT"
      }
    }
  }
}
```

Once configured, migrations and SQL can be run directly via MCP tools instead of CLI.

---

## Summary

| Phase | Tasks | Key Deliverables |
|---|---|---|
| 1: Foundation | 1–4 | Scaffold, DB schema, RLS, auth, invite join |
| 2: Core Game | 5–8 | GPS+map, encounters, catch/fight, bestiary |
| 3: Mechanics | 9–13 | Evolution, missions, QR, duels, shop, profile |
| 4: Admin | 14–18 | Session wizard, invites, QR gen, creatures, players |
| 5: Polish | 19–22 | PWA, timer, notifications, seed, artwork script, deploy |

**Total: 22 tasks, ~55 steps** — each step is runnable in 2–5 minutes.

**Testing strategy:** Vitest unit tests on all API routes (game logic, RNG, anti-cheat). UI tested manually — too GPS/realtime-dependent for automated testing at MVP scale.

**After completing all tasks:** Run `npm run test:run` (all PASS) + `npm run build` (zero errors), then push to Vercel.
