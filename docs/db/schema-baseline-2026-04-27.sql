


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."close_expired_sessions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."close_expired_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_player_stats"("p_user_id" "uuid", "p_session_id" "uuid", "p_exp" integer, "p_score" integer, "p_gold" integer DEFAULT 0) RETURNS TABLE("old_level" integer, "new_level" integer, "leveled_up" boolean, "gold_reward" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_exp        INTEGER;
  v_old_level      INTEGER;
  v_new_exp        INTEGER;
  v_new_level      INTEGER;
  v_level_gold     INTEGER := 0;
BEGIN
  SELECT exp, level
  INTO   v_old_exp, v_old_level
  FROM   player_sessions
  WHERE  user_id = p_user_id AND session_id = p_session_id;

  v_new_exp := GREATEST(0, COALESCE(v_old_exp, 0) + p_exp);

  SELECT LEAST(
    COALESCE(MAX(t.target_level), 1),
    99
  )
  INTO v_new_level
  FROM (
    SELECT
      level + 1 AS target_level,
      SUM(exp_to_next) OVER (
        ORDER BY level
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS min_exp
    FROM level_exp_config
    WHERE level BETWEEN 1 AND 99
  ) t
  WHERE t.min_exp <= v_new_exp;

  IF v_new_level > COALESCE(v_old_level, 1) THEN
    v_level_gold := 15 + floor(random() * 26)::INTEGER;  -- 15–40 level-up bonus
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           level = v_new_level,
           gold  = gold + v_level_gold + p_gold,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  ELSE
    UPDATE player_sessions
    SET    exp   = v_new_exp,
           gold  = gold + p_gold,
           score = score + p_score
    WHERE  user_id = p_user_id AND session_id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v_old_level, 1),
    v_new_level,
    v_new_level > COALESCE(v_old_level, 1),
    v_level_gold;
END;
$$;


ALTER FUNCTION "public"."increment_player_stats"("p_user_id" "uuid", "p_session_id" "uuid", "p_exp" integer, "p_score" integer, "p_gold" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, FALSE)
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_in_session"("p_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM player_sessions
    WHERE user_id = auth.uid() AND session_id = p_session_id
  )
$$;


ALTER FUNCTION "public"."is_in_session"("p_session_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."boss_fights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "qr_code_id" "uuid",
    "boss_lineup" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "player_lineup" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "boss_active_slot" integer DEFAULT 0 NOT NULL,
    "player_active_slot" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'selecting'::"text" NOT NULL,
    "reward" "jsonb",
    "reward_claimed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "pin_id" "uuid",
    CONSTRAINT "boss_fights_status_check" CHECK (("status" = ANY (ARRAY['selecting'::"text", 'active'::"text", 'won'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."boss_fights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "element" "text" NOT NULL,
    "rarity" "text" NOT NULL,
    "hp" integer NOT NULL,
    "atk" integer NOT NULL,
    "def" integer NOT NULL,
    "min_level" integer DEFAULT 1 NOT NULL,
    "image_url" "text" DEFAULT ''::"text" NOT NULL,
    "sprite_url" "text" DEFAULT ''::"text" NOT NULL,
    "lottie_url" "text",
    "spawn_weight" integer DEFAULT 10 NOT NULL,
    "evolution_of" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "session_id" "uuid",
    "catch_difficulty" integer DEFAULT 1 NOT NULL,
    "enigma_title" "text",
    "enigma_description" "text",
    "enigma_image_url" "text",
    "enigma_video_url" "text",
    "spawnable" boolean DEFAULT true NOT NULL,
    "attack_sound_url" "text",
    "attack_sound_duration_ms" integer,
    "status_effect" "text",
    "status_effect_chance" double precision DEFAULT 0.15 NOT NULL,
    CONSTRAINT "creatures_atk_check" CHECK (("atk" > 0)),
    CONSTRAINT "creatures_catch_difficulty_check" CHECK ((("catch_difficulty" >= 1) AND ("catch_difficulty" <= 5))),
    CONSTRAINT "creatures_def_check" CHECK (("def" >= 0)),
    CONSTRAINT "creatures_element_check" CHECK (("element" = ANY (ARRAY['fiamma'::"text", 'adriatico'::"text", 'bosco'::"text", 'terra'::"text", 'armonia'::"text"]))),
    CONSTRAINT "creatures_hp_check" CHECK (("hp" > 0)),
    CONSTRAINT "creatures_rarity_check" CHECK (("rarity" = ANY (ARRAY['comune'::"text", 'non_comune'::"text", 'raro'::"text", 'epico'::"text", 'leggendario'::"text", 'mitologico'::"text"]))),
    CONSTRAINT "creatures_status_effect_chance_check" CHECK ((("status_effect_chance" >= (0.0)::double precision) AND ("status_effect_chance" <= (1.0)::double precision))),
    CONSTRAINT "creatures_status_effect_check" CHECK (("status_effect" = ANY (ARRAY['paralisi'::"text", 'confusione'::"text", 'sonno'::"text", 'veleno'::"text"])))
);


ALTER TABLE "public"."creatures" OWNER TO "postgres";


COMMENT ON COLUMN "public"."creatures"."attack_sound_url" IS 'Public URL of the audio clip played during the attack animation';



COMMENT ON COLUMN "public"."creatures"."attack_sound_duration_ms" IS 'How long (ms) to play the clip before cutting it off; defaults to clip length if NULL';



CREATE TABLE IF NOT EXISTS "public"."duel_lineups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "duel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slot" integer NOT NULL,
    "player_creature_id" "uuid" NOT NULL,
    "current_hp" integer NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "fainted_at" timestamp with time zone,
    "active_status" "text",
    "status_turns_left" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "duel_lineups_active_status_check" CHECK (("active_status" = ANY (ARRAY['paralisi'::"text", 'confusione'::"text", 'sonno'::"text", 'veleno'::"text"]))),
    CONSTRAINT "duel_lineups_slot_check" CHECK ((("slot" >= 1) AND ("slot" <= 3)))
);

ALTER TABLE ONLY "public"."duel_lineups" REPLICA IDENTITY FULL;


ALTER TABLE "public"."duel_lineups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."duels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenger_id" "uuid" NOT NULL,
    "opponent_id" "uuid",
    "session_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "winner_id" "uuid",
    "challenger_creature_id" "uuid" NOT NULL,
    "opponent_creature_id" "uuid",
    "room_code" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "current_turn" "text",
    "challenger_hp" integer,
    "opponent_hp" integer,
    CONSTRAINT "duels_current_turn_check" CHECK (("current_turn" = ANY (ARRAY['challenger'::"text", 'opponent'::"text"]))),
    CONSTRAINT "duels_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'active'::"text", 'ended'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."duels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "creature_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "trigger" "text" NOT NULL,
    "wild_creature_hp" integer NOT NULL,
    "player_creature_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "wild_status" "text",
    "wild_status_turns" integer DEFAULT 0 NOT NULL,
    "player_status" "text",
    "player_status_turns" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "encounters_player_status_check" CHECK (("player_status" = ANY (ARRAY['paralisi'::"text", 'confusione'::"text", 'sonno'::"text", 'veleno'::"text"]))),
    CONSTRAINT "encounters_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'caught'::"text", 'fled'::"text", 'fought'::"text"]))),
    CONSTRAINT "encounters_trigger_check" CHECK (("trigger" = ANY (ARRAY['gps'::"text", 'timer'::"text"]))),
    CONSTRAINT "encounters_wild_status_check" CHECK (("wild_status" = ANY (ARRAY['paralisi'::"text", 'confusione'::"text", 'sonno'::"text", 'veleno'::"text"])))
);


ALTER TABLE "public"."encounters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_catch_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "comune_rate" numeric(7,4) DEFAULT 0.70 NOT NULL,
    "non_comune_rate" numeric(7,4) DEFAULT 0.45 NOT NULL,
    "raro_rate" numeric(7,4) DEFAULT 0.25 NOT NULL,
    "epico_rate" numeric(7,4) DEFAULT 0.12 NOT NULL,
    "leggendario_rate" numeric(7,4) DEFAULT 0.05 NOT NULL,
    "mitologico_rate" numeric(7,4) DEFAULT 0.0125 NOT NULL,
    "non_comune_level_bonus" numeric(7,4) DEFAULT 0 NOT NULL,
    "raro_level_bonus" numeric(7,4) DEFAULT 0 NOT NULL,
    "epico_level_bonus" numeric(7,4) DEFAULT 0 NOT NULL,
    "leggendario_level_bonus" numeric(7,4) DEFAULT 0 NOT NULL,
    "mitologico_level_bonus" numeric(7,4) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."global_catch_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hall_of_fame" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "rank" integer NOT NULL,
    "score" integer NOT NULL,
    "creatures_caught" integer NOT NULL,
    "season_label" "text" NOT NULL,
    "awarded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hall_of_fame" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "effect_value" numeric DEFAULT 0 NOT NULL,
    "description" "text" NOT NULL,
    "shop_price" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "session_id" "uuid",
    "egg_rarity" "text",
    "steps_required" integer DEFAULT 0 NOT NULL,
    "image_url" "text",
    "is_redeemable" boolean DEFAULT false NOT NULL,
    "reward" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "in_shop" boolean DEFAULT true NOT NULL,
    CONSTRAINT "items_type_check" CHECK (("type" = ANY (ARRAY['rete'::"text", 'esca'::"text", 'uovo'::"text", 'battaglia'::"text", 'pozione'::"text", 'cura'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."level_exp_config" (
    "level" integer NOT NULL,
    "exp_to_next" integer DEFAULT 50 NOT NULL,
    CONSTRAINT "level_exp_config_exp_to_next_check" CHECK (("exp_to_next" > 0)),
    CONSTRAINT "level_exp_config_level_check" CHECK (("level" >= 1))
);


ALTER TABLE "public"."level_exp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."level_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level" integer NOT NULL,
    "gold" integer DEFAULT 0 NOT NULL,
    "item_id" "uuid",
    "item_qty" integer DEFAULT 1 NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "bonus_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "level_rewards_level_check" CHECK (("level" >= 2))
);


ALTER TABLE "public"."level_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "chapter_order" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "type" "text" NOT NULL,
    "target" "text" NOT NULL,
    "target_count" integer DEFAULT 1 NOT NULL,
    "reward_gold" integer DEFAULT 0 NOT NULL,
    "reward_exp" integer DEFAULT 0 NOT NULL,
    "reward_item_id" "uuid",
    "is_required" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reward_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reward_creature_id" "uuid",
    "unlock_level" integer,
    "unlock_after_mission_id" "uuid",
    CONSTRAINT "missions_unlock_level_check" CHECK ((("unlock_level" IS NULL) OR ("unlock_level" >= 1)))
);


ALTER TABLE "public"."missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "sent_by_admin_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pin_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pin_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pin_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_creatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "creature_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "duplicates_count" integer DEFAULT 1 NOT NULL,
    "evolved" boolean DEFAULT false NOT NULL,
    "caught_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."player_creatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_eggs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "egg_rarity" "text" DEFAULT 'comune'::"text" NOT NULL,
    "steps_required" integer DEFAULT 0 NOT NULL,
    "steps_at_pickup" bigint DEFAULT 0 NOT NULL,
    "hatched_at" timestamp with time zone,
    "hatched_creature_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_eggs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_game_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."player_game_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."player_game_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "player_inventory_quantity_check" CHECK (("quantity" >= 0))
);


ALTER TABLE "public"."player_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."player_missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'generic'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."player_notifications" REPLICA IDENTITY FULL;


ALTER TABLE "public"."player_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "exp" integer DEFAULT 0 NOT NULL,
    "gold" integer DEFAULT 0 NOT NULL,
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "last_position" "point",
    "score_final" integer,
    "selected_creature_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "score" integer DEFAULT 0 NOT NULL,
    "steps_walked" integer DEFAULT 0 NOT NULL,
    "esca_active_until" timestamp with time zone,
    "squad_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    CONSTRAINT "player_sessions_role_check" CHECK (("role" = ANY (ARRAY['player'::"text", 'boss'::"text", 'villain'::"text"])))
);


ALTER TABLE "public"."player_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "nickname" "text",
    "avatar_url" "text",
    "gdpr_consent_at" timestamp with time zone,
    "gdpr_consent_minor" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "uses_remaining" integer,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unique_per_user" boolean DEFAULT false NOT NULL,
    "manual_code" "text",
    CONSTRAINT "qr_codes_manual_code_length" CHECK (("char_length"("manual_code") <= 6)),
    CONSTRAINT "qr_codes_type_check" CHECK (("type" = ANY (ARRAY['uovo'::"text", 'indizio'::"text", 'oggetto'::"text", 'boss'::"text", 'evento'::"text"])))
);


ALTER TABLE "public"."qr_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_scan_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "qr_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "scanned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qr_scan_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "source" "text" NOT NULL,
    "error_code" "text" NOT NULL,
    "message" "text" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "used_by_user_id" "uuid",
    "used_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."session_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_map_pins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    "reward_type" "text",
    "reward_payload" "jsonb",
    "reward_radius_m" integer DEFAULT 50
);


ALTER TABLE "public"."session_map_pins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_spawn_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "non_comune_bonus" double precision DEFAULT 0.02 NOT NULL,
    "raro_bonus" double precision DEFAULT 0.10 NOT NULL,
    "epico_bonus" double precision DEFAULT 0.20 NOT NULL,
    "leggendario_bonus" double precision DEFAULT 0.40 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_spawn_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "area_bounds" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "duration_minutes" integer DEFAULT 120 NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "auto_end" boolean DEFAULT true NOT NULL,
    "narrative_config" "jsonb" DEFAULT '{"chapters": [], "intro_text": "", "story_title": "", "villain_name": ""}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "starter_kit" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duel_lineups"
    ADD CONSTRAINT "duel_lineups_duel_id_user_id_slot_key" UNIQUE ("duel_id", "user_id", "slot");



ALTER TABLE ONLY "public"."duel_lineups"
    ADD CONSTRAINT "duel_lineups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_session_id_room_code_status_key" UNIQUE ("session_id", "room_code", "status");



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_catch_config"
    ADD CONSTRAINT "global_catch_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."level_exp_config"
    ADD CONSTRAINT "level_exp_config_pkey" PRIMARY KEY ("level");



ALTER TABLE ONLY "public"."level_rewards"
    ADD CONSTRAINT "level_rewards_level_key" UNIQUE ("level");



ALTER TABLE ONLY "public"."level_rewards"
    ADD CONSTRAINT "level_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pin_claims"
    ADD CONSTRAINT "pin_claims_pin_id_user_id_key" UNIQUE ("pin_id", "user_id");



ALTER TABLE ONLY "public"."pin_claims"
    ADD CONSTRAINT "pin_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_creatures"
    ADD CONSTRAINT "player_creatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_creatures"
    ADD CONSTRAINT "player_creatures_unique_per_session" UNIQUE ("user_id", "session_id", "creature_id");



ALTER TABLE ONLY "public"."player_eggs"
    ADD CONSTRAINT "player_eggs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_game_events"
    ADD CONSTRAINT "player_game_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_inventory"
    ADD CONSTRAINT "player_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_inventory"
    ADD CONSTRAINT "player_inventory_user_id_session_id_item_id_key" UNIQUE ("user_id", "session_id", "item_id");



ALTER TABLE ONLY "public"."player_missions"
    ADD CONSTRAINT "player_missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_missions"
    ADD CONSTRAINT "player_missions_user_id_mission_id_key" UNIQUE ("user_id", "mission_id");



ALTER TABLE ONLY "public"."player_notifications"
    ADD CONSTRAINT "player_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_sessions"
    ADD CONSTRAINT "player_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_sessions"
    ADD CONSTRAINT "player_sessions_user_id_session_id_key" UNIQUE ("user_id", "session_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."qr_codes"
    ADD CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_scan_log"
    ADD CONSTRAINT "qr_scan_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_scan_log"
    ADD CONSTRAINT "qr_scan_log_qr_id_user_id_key" UNIQUE ("qr_id", "user_id");



ALTER TABLE ONLY "public"."session_errors"
    ADD CONSTRAINT "session_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_map_pins"
    ADD CONSTRAINT "session_map_pins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_spawn_config"
    ADD CONSTRAINT "session_spawn_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_spawn_config"
    ADD CONSTRAINT "session_spawn_config_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_boss_fights_pin_user" ON "public"."boss_fights" USING "btree" ("pin_id", "user_id");



CREATE INDEX "idx_boss_fights_user" ON "public"."boss_fights" USING "btree" ("user_id", "session_id", "status");



CREATE INDEX "idx_duel_lineups_duel_id" ON "public"."duel_lineups" USING "btree" ("duel_id");



CREATE INDEX "idx_duel_lineups_user_duel" ON "public"."duel_lineups" USING "btree" ("user_id", "duel_id");



CREATE INDEX "idx_duels_room_code" ON "public"."duels" USING "btree" ("room_code", "status");



CREATE INDEX "idx_encounters_user_session" ON "public"."encounters" USING "btree" ("user_id", "session_id", "status");



CREATE INDEX "idx_pin_claims_pin_user" ON "public"."pin_claims" USING "btree" ("pin_id", "user_id");



CREATE INDEX "idx_player_creatures_user_session" ON "public"."player_creatures" USING "btree" ("user_id", "session_id");



CREATE INDEX "idx_player_inventory_user_session" ON "public"."player_inventory" USING "btree" ("user_id", "session_id");



CREATE INDEX "idx_player_sessions_session" ON "public"."player_sessions" USING "btree" ("session_id");



CREATE INDEX "idx_player_sessions_user" ON "public"."player_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_session_errors_session" ON "public"."session_errors" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_session_invites_code" ON "public"."session_invites" USING "btree" ("code");



CREATE INDEX "idx_session_invites_session" ON "public"."session_invites" USING "btree" ("session_id");



CREATE UNIQUE INDEX "qr_codes_manual_code_unique" ON "public"."qr_codes" USING "btree" ("manual_code");



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_pin_id_fkey" FOREIGN KEY ("pin_id") REFERENCES "public"."session_map_pins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id");



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_evolution_of_fkey" FOREIGN KEY ("evolution_of") REFERENCES "public"."creatures"("id");



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duel_lineups"
    ADD CONSTRAINT "duel_lineups_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "public"."duels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duel_lineups"
    ADD CONSTRAINT "duel_lineups_player_creature_id_fkey" FOREIGN KEY ("player_creature_id") REFERENCES "public"."player_creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duel_lineups"
    ADD CONSTRAINT "duel_lineups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_challenger_creature_id_fkey" FOREIGN KEY ("challenger_creature_id") REFERENCES "public"."player_creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_opponent_creature_id_fkey" FOREIGN KEY ("opponent_creature_id") REFERENCES "public"."player_creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_opponent_id_fkey" FOREIGN KEY ("opponent_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_creature_id_fkey" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id");



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_player_creature_id_fkey" FOREIGN KEY ("player_creature_id") REFERENCES "public"."player_creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_sessions"
    ADD CONSTRAINT "fk_selected_creature" FOREIGN KEY ("selected_creature_id") REFERENCES "public"."player_creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."level_rewards"
    ADD CONSTRAINT "level_rewards_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_reward_creature_id_fkey" FOREIGN KEY ("reward_creature_id") REFERENCES "public"."creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_reward_item_id_fkey" FOREIGN KEY ("reward_item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_unlock_after_mission_id_fkey" FOREIGN KEY ("unlock_after_mission_id") REFERENCES "public"."missions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sent_by_admin_id_fkey" FOREIGN KEY ("sent_by_admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pin_claims"
    ADD CONSTRAINT "pin_claims_pin_id_fkey" FOREIGN KEY ("pin_id") REFERENCES "public"."session_map_pins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pin_claims"
    ADD CONSTRAINT "pin_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pin_claims"
    ADD CONSTRAINT "pin_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_creatures"
    ADD CONSTRAINT "player_creatures_creature_id_fkey" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id");



ALTER TABLE ONLY "public"."player_creatures"
    ADD CONSTRAINT "player_creatures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_creatures"
    ADD CONSTRAINT "player_creatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_eggs"
    ADD CONSTRAINT "player_eggs_hatched_creature_id_fkey" FOREIGN KEY ("hatched_creature_id") REFERENCES "public"."creatures"("id");



ALTER TABLE ONLY "public"."player_eggs"
    ADD CONSTRAINT "player_eggs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_eggs"
    ADD CONSTRAINT "player_eggs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_game_events"
    ADD CONSTRAINT "player_game_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_game_events"
    ADD CONSTRAINT "player_game_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_inventory"
    ADD CONSTRAINT "player_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."player_inventory"
    ADD CONSTRAINT "player_inventory_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_inventory"
    ADD CONSTRAINT "player_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_missions"
    ADD CONSTRAINT "player_missions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_missions"
    ADD CONSTRAINT "player_missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_notifications"
    ADD CONSTRAINT "player_notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_notifications"
    ADD CONSTRAINT "player_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_sessions"
    ADD CONSTRAINT "player_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_sessions"
    ADD CONSTRAINT "player_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_codes"
    ADD CONSTRAINT "qr_codes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_scan_log"
    ADD CONSTRAINT "qr_scan_log_qr_id_fkey" FOREIGN KEY ("qr_id") REFERENCES "public"."qr_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_scan_log"
    ADD CONSTRAINT "qr_scan_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_scan_log"
    ADD CONSTRAINT "qr_scan_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_errors"
    ADD CONSTRAINT "session_errors_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_errors"
    ADD CONSTRAINT "session_errors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_map_pins"
    ADD CONSTRAINT "session_map_pins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_spawn_config"
    ADD CONSTRAINT "session_spawn_config_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



CREATE POLICY "Admins manage map pins" ON "public"."session_map_pins" USING ("public"."is_admin"());



CREATE POLICY "Anyone can read exp config" ON "public"."level_exp_config" FOR SELECT USING (true);



CREATE POLICY "Players read map pins" ON "public"."session_map_pins" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Players read own events" ON "public"."player_game_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Players read own notifications" ON "public"."player_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Players update own notifications" ON "public"."player_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "admin_read_catch_config" ON "public"."global_catch_config" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_write_catch_config" ON "public"."global_catch_config" USING ("public"."is_admin"());



CREATE POLICY "authenticated_can_read" ON "public"."session_errors" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."boss_fights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boss_fights_own" ON "public"."boss_fights" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."creatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "creatures_admin_write" ON "public"."creatures" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "creatures_read" ON "public"."creatures" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "duel_delete" ON "public"."duels" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "duel_insert" ON "public"."duels" FOR INSERT TO "authenticated" WITH CHECK ((("challenger_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."duel_lineups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "duel_lineups_insert" ON "public"."duel_lineups" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "duel_lineups_select" ON "public"."duel_lineups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."duels" "d"
  WHERE (("d"."id" = "duel_lineups"."duel_id") AND (("d"."challenger_id" = "auth"."uid"()) OR ("d"."opponent_id" = "auth"."uid"()))))));



CREATE POLICY "duel_lineups_update" ON "public"."duel_lineups" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."duels" "d"
  WHERE (("d"."id" = "duel_lineups"."duel_id") AND (("d"."challenger_id" = "auth"."uid"()) OR ("d"."opponent_id" = "auth"."uid"())))))));



CREATE POLICY "duel_select" ON "public"."duels" FOR SELECT TO "authenticated" USING ((("status" = 'waiting'::"text") OR ("challenger_id" = "auth"."uid"()) OR ("opponent_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "duel_update" ON "public"."duels" FOR UPDATE TO "authenticated" USING ((("status" = 'waiting'::"text") OR ("challenger_id" = "auth"."uid"()) OR ("opponent_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."duels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enc_own" ON "public"."encounters" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."encounters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "everyone reads level_rewards" ON "public"."level_rewards" FOR SELECT USING (true);



ALTER TABLE "public"."global_catch_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hall_of_fame" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hof_admin_write" ON "public"."hall_of_fame" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "hof_read" ON "public"."hall_of_fame" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "invites_admin" ON "public"."session_invites" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "invites_own_read" ON "public"."session_invites" FOR SELECT TO "authenticated" USING (("used_by_user_id" = "auth"."uid"()));



ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "items_admin_write" ON "public"."items" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "items_read" ON "public"."items" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."level_exp_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."level_rewards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "level_rewards_player_read" ON "public"."level_rewards" FOR SELECT USING (true);



ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "missions_admin_write" ON "public"."missions" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "missions_read" ON "public"."missions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notif_admin_write" ON "public"."notifications" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "notif_read" ON "public"."notifications" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pc_duel_read" ON "public"."player_creatures" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."duel_lineups" "dl"
     JOIN "public"."duels" "d" ON (("d"."id" = "dl"."duel_id")))
  WHERE (("dl"."player_creature_id" = "player_creatures"."id") AND (("d"."challenger_id" = "auth"."uid"()) OR ("d"."opponent_id" = "auth"."uid"()))))));



CREATE POLICY "pc_own" ON "public"."player_creatures" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "pi_own" ON "public"."player_inventory" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."pin_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pin_claims_insert" ON "public"."pin_claims" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "pin_claims_select" ON "public"."pin_claims" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "player inserts own eggs" ON "public"."player_eggs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "player sees own eggs" ON "public"."player_eggs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "player updates own eggs" ON "public"."player_eggs" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."player_creatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_eggs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_game_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_insert_own_scan" ON "public"."qr_scan_log" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."player_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_read_own_scans" ON "public"."qr_scan_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."player_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "players insert own lineup" ON "public"."duel_lineups" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "players read creatures" ON "public"."creatures" FOR SELECT USING ((("session_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."player_sessions" "ps"
  WHERE (("ps"."user_id" = "auth"."uid"()) AND ("ps"."session_id" = "creatures"."session_id"))))));



CREATE POLICY "players read items" ON "public"."items" FOR SELECT USING ((("session_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."player_sessions" "ps"
  WHERE (("ps"."user_id" = "auth"."uid"()) AND ("ps"."session_id" = "items"."session_id"))))));



CREATE POLICY "players read missions" ON "public"."missions" FOR SELECT USING ((("session_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."player_sessions" "ps"
  WHERE (("ps"."user_id" = "auth"."uid"()) AND ("ps"."session_id" = "missions"."session_id"))))));



CREATE POLICY "players see duel lineups" ON "public"."duel_lineups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."duels" "d"
  WHERE (("d"."id" = "duel_lineups"."duel_id") AND (("d"."challenger_id" = "auth"."uid"()) OR ("d"."opponent_id" = "auth"."uid"()))))));



CREATE POLICY "players see own lineup" ON "public"."duel_lineups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pm_own" ON "public"."player_missions" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_own" ON "public"."profiles" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "profiles_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ps_duel_read" ON "public"."player_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."duels" "d"
  WHERE (("d"."session_id" = "player_sessions"."session_id") AND (("d"."challenger_id" = "auth"."uid"()) OR ("d"."opponent_id" = "auth"."uid"())) AND (("d"."challenger_id" = "player_sessions"."user_id") OR ("d"."opponent_id" = "player_sessions"."user_id"))))));



CREATE POLICY "ps_own" ON "public"."player_sessions" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "qr_admin_write" ON "public"."qr_codes" TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."qr_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qr_read" ON "public"."qr_codes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."qr_scan_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role manages level_rewards" ON "public"."level_rewards" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."session_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_map_pins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_spawn_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_admin_write" ON "public"."sessions" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "sessions_read" ON "public"."sessions" FOR SELECT TO "authenticated" USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."close_expired_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."close_expired_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_expired_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_player_stats"("p_user_id" "uuid", "p_session_id" "uuid", "p_exp" integer, "p_score" integer, "p_gold" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_player_stats"("p_user_id" "uuid", "p_session_id" "uuid", "p_exp" integer, "p_score" integer, "p_gold" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_player_stats"("p_user_id" "uuid", "p_session_id" "uuid", "p_exp" integer, "p_score" integer, "p_gold" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_in_session"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_in_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_in_session"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."boss_fights" TO "anon";
GRANT ALL ON TABLE "public"."boss_fights" TO "authenticated";
GRANT ALL ON TABLE "public"."boss_fights" TO "service_role";



GRANT ALL ON TABLE "public"."creatures" TO "anon";
GRANT ALL ON TABLE "public"."creatures" TO "authenticated";
GRANT ALL ON TABLE "public"."creatures" TO "service_role";



GRANT ALL ON TABLE "public"."duel_lineups" TO "anon";
GRANT ALL ON TABLE "public"."duel_lineups" TO "authenticated";
GRANT ALL ON TABLE "public"."duel_lineups" TO "service_role";



GRANT ALL ON TABLE "public"."duels" TO "anon";
GRANT ALL ON TABLE "public"."duels" TO "authenticated";
GRANT ALL ON TABLE "public"."duels" TO "service_role";



GRANT ALL ON TABLE "public"."encounters" TO "anon";
GRANT ALL ON TABLE "public"."encounters" TO "authenticated";
GRANT ALL ON TABLE "public"."encounters" TO "service_role";



GRANT ALL ON TABLE "public"."global_catch_config" TO "anon";
GRANT ALL ON TABLE "public"."global_catch_config" TO "authenticated";
GRANT ALL ON TABLE "public"."global_catch_config" TO "service_role";



GRANT ALL ON TABLE "public"."hall_of_fame" TO "anon";
GRANT ALL ON TABLE "public"."hall_of_fame" TO "authenticated";
GRANT ALL ON TABLE "public"."hall_of_fame" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."level_exp_config" TO "anon";
GRANT ALL ON TABLE "public"."level_exp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."level_exp_config" TO "service_role";



GRANT ALL ON TABLE "public"."level_rewards" TO "anon";
GRANT ALL ON TABLE "public"."level_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."level_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."missions" TO "anon";
GRANT ALL ON TABLE "public"."missions" TO "authenticated";
GRANT ALL ON TABLE "public"."missions" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pin_claims" TO "anon";
GRANT ALL ON TABLE "public"."pin_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."pin_claims" TO "service_role";



GRANT ALL ON TABLE "public"."player_creatures" TO "anon";
GRANT ALL ON TABLE "public"."player_creatures" TO "authenticated";
GRANT ALL ON TABLE "public"."player_creatures" TO "service_role";



GRANT ALL ON TABLE "public"."player_eggs" TO "anon";
GRANT ALL ON TABLE "public"."player_eggs" TO "authenticated";
GRANT ALL ON TABLE "public"."player_eggs" TO "service_role";



GRANT ALL ON TABLE "public"."player_game_events" TO "anon";
GRANT ALL ON TABLE "public"."player_game_events" TO "authenticated";
GRANT ALL ON TABLE "public"."player_game_events" TO "service_role";



GRANT ALL ON TABLE "public"."player_inventory" TO "anon";
GRANT ALL ON TABLE "public"."player_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."player_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."player_missions" TO "anon";
GRANT ALL ON TABLE "public"."player_missions" TO "authenticated";
GRANT ALL ON TABLE "public"."player_missions" TO "service_role";



GRANT ALL ON TABLE "public"."player_notifications" TO "anon";
GRANT ALL ON TABLE "public"."player_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."player_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."player_sessions" TO "anon";
GRANT ALL ON TABLE "public"."player_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."player_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."qr_codes" TO "anon";
GRANT ALL ON TABLE "public"."qr_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_codes" TO "service_role";



GRANT ALL ON TABLE "public"."qr_scan_log" TO "anon";
GRANT ALL ON TABLE "public"."qr_scan_log" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_scan_log" TO "service_role";



GRANT ALL ON TABLE "public"."session_errors" TO "anon";
GRANT ALL ON TABLE "public"."session_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."session_errors" TO "service_role";



GRANT ALL ON TABLE "public"."session_invites" TO "anon";
GRANT ALL ON TABLE "public"."session_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."session_invites" TO "service_role";



GRANT ALL ON TABLE "public"."session_map_pins" TO "anon";
GRANT ALL ON TABLE "public"."session_map_pins" TO "authenticated";
GRANT ALL ON TABLE "public"."session_map_pins" TO "service_role";



GRANT ALL ON TABLE "public"."session_spawn_config" TO "anon";
GRANT ALL ON TABLE "public"."session_spawn_config" TO "authenticated";
GRANT ALL ON TABLE "public"."session_spawn_config" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







