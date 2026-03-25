-- ============================================================
-- Core tables (permanent, survive session resets)
-- ============================================================

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
