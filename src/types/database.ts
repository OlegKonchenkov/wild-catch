export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      boss_fights: {
        Row: {
          boss_active_slot: number
          boss_lineup: Json
          created_at: string | null
          ended_at: string | null
          id: string
          pin_id: string | null
          player_active_slot: number
          player_lineup: Json
          qr_code_id: string | null
          reward: Json | null
          reward_claimed: boolean
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          boss_active_slot?: number
          boss_lineup?: Json
          created_at?: string | null
          ended_at?: string | null
          id?: string
          pin_id?: string | null
          player_active_slot?: number
          player_lineup?: Json
          qr_code_id?: string | null
          reward?: Json | null
          reward_claimed?: boolean
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          boss_active_slot?: number
          boss_lineup?: Json
          created_at?: string | null
          ended_at?: string | null
          id?: string
          pin_id?: string | null
          player_active_slot?: number
          player_lineup?: Json
          qr_code_id?: string | null
          reward?: Json | null
          reward_claimed?: boolean
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_fights_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "session_map_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boss_fights_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boss_fights_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      creatures: {
        Row: {
          atk: number
          attack_sound_duration_ms: number | null
          attack_sound_url: string | null
          catch_difficulty: number
          created_at: string | null
          def: number
          description: string
          element: string
          enigma_description: string | null
          enigma_frammento_id: string | null
          enigma_image_url: string | null
          enigma_title: string | null
          enigma_video_url: string | null
          evolution_of: string | null
          hp: number
          id: string
          image_url: string
          lottie_url: string | null
          min_level: number
          name: string
          rarity: string
          session_id: string | null
          spawn_weight: number
          spawnable: boolean
          sprite_url: string
          status_effect: string | null
          status_effect_chance: number
        }
        Insert: {
          atk: number
          attack_sound_duration_ms?: number | null
          attack_sound_url?: string | null
          catch_difficulty?: number
          created_at?: string | null
          def: number
          description: string
          element: string
          enigma_description?: string | null
          enigma_frammento_id?: string | null
          enigma_image_url?: string | null
          enigma_title?: string | null
          enigma_video_url?: string | null
          evolution_of?: string | null
          hp: number
          id?: string
          image_url?: string
          lottie_url?: string | null
          min_level?: number
          name: string
          rarity: string
          session_id?: string | null
          spawn_weight?: number
          spawnable?: boolean
          sprite_url?: string
          status_effect?: string | null
          status_effect_chance?: number
        }
        Update: {
          atk?: number
          attack_sound_duration_ms?: number | null
          attack_sound_url?: string | null
          catch_difficulty?: number
          created_at?: string | null
          def?: number
          description?: string
          element?: string
          enigma_description?: string | null
          enigma_frammento_id?: string | null
          enigma_image_url?: string | null
          enigma_title?: string | null
          enigma_video_url?: string | null
          evolution_of?: string | null
          hp?: number
          id?: string
          image_url?: string
          lottie_url?: string | null
          min_level?: number
          name?: string
          rarity?: string
          session_id?: string | null
          spawn_weight?: number
          spawnable?: boolean
          sprite_url?: string
          status_effect?: string | null
          status_effect_chance?: number
        }
        Relationships: [
          {
            foreignKeyName: "creatures_enigma_frammento_id_fkey"
            columns: ["enigma_frammento_id"]
            isOneToOne: false
            referencedRelation: "enigma_frammenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatures_evolution_of_fkey"
            columns: ["evolution_of"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_lineups: {
        Row: {
          active_status: string | null
          current_hp: number
          duel_id: string
          fainted_at: string | null
          id: string
          is_active: boolean
          player_creature_id: string
          slot: number
          status_turns_left: number
          user_id: string
        }
        Insert: {
          active_status?: string | null
          current_hp: number
          duel_id: string
          fainted_at?: string | null
          id?: string
          is_active?: boolean
          player_creature_id: string
          slot: number
          status_turns_left?: number
          user_id: string
        }
        Update: {
          active_status?: string | null
          current_hp?: number
          duel_id?: string
          fainted_at?: string | null
          id?: string
          is_active?: boolean
          player_creature_id?: string
          slot?: number
          status_turns_left?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_lineups_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_lineups_player_creature_id_fkey"
            columns: ["player_creature_id"]
            isOneToOne: false
            referencedRelation: "player_creatures"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          challenger_creature_id: string
          challenger_hp: number | null
          challenger_id: string
          current_turn: string | null
          ended_at: string | null
          id: string
          opponent_creature_id: string | null
          opponent_hp: number | null
          opponent_id: string | null
          room_code: string
          session_id: string
          started_at: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          challenger_creature_id: string
          challenger_hp?: number | null
          challenger_id: string
          current_turn?: string | null
          ended_at?: string | null
          id?: string
          opponent_creature_id?: string | null
          opponent_hp?: number | null
          opponent_id?: string | null
          room_code: string
          session_id: string
          started_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          challenger_creature_id?: string
          challenger_hp?: number | null
          challenger_id?: string
          current_turn?: string | null
          ended_at?: string | null
          id?: string
          opponent_creature_id?: string | null
          opponent_hp?: number | null
          opponent_id?: string | null
          room_code?: string
          session_id?: string
          started_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duels_challenger_creature_id_fkey"
            columns: ["challenger_creature_id"]
            isOneToOne: false
            referencedRelation: "player_creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_opponent_creature_id_fkey"
            columns: ["opponent_creature_id"]
            isOneToOne: false
            referencedRelation: "player_creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          creature_id: string
          id: string
          player_creature_id: string | null
          player_status: string | null
          player_status_turns: number
          resolved_at: string | null
          session_id: string
          started_at: string | null
          status: string
          trigger: string
          user_id: string
          wild_creature_hp: number
          wild_status: string | null
          wild_status_turns: number
        }
        Insert: {
          creature_id: string
          id?: string
          player_creature_id?: string | null
          player_status?: string | null
          player_status_turns?: number
          resolved_at?: string | null
          session_id: string
          started_at?: string | null
          status?: string
          trigger: string
          user_id: string
          wild_creature_hp: number
          wild_status?: string | null
          wild_status_turns?: number
        }
        Update: {
          creature_id?: string
          id?: string
          player_creature_id?: string | null
          player_status?: string | null
          player_status_turns?: number
          resolved_at?: string | null
          session_id?: string
          started_at?: string | null
          status?: string
          trigger?: string
          user_id?: string
          wild_creature_hp?: number
          wild_status?: string | null
          wild_status_turns?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounters_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_player_creature_id_fkey"
            columns: ["player_creature_id"]
            isOneToOne: false
            referencedRelation: "player_creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      enigma_frammenti: {
        Row: {
          created_at: string | null
          description: string | null
          enigma_id: string
          id: string
          image_url: string | null
          order_index: number | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enigma_id: string
          id?: string
          image_url?: string | null
          order_index?: number | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enigma_id?: string
          id?: string
          image_url?: string | null
          order_index?: number | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enigma_frammenti_enigma_id_fkey"
            columns: ["enigma_id"]
            isOneToOne: false
            referencedRelation: "enigmi"
            referencedColumns: ["id"]
          },
        ]
      }
      enigma_suggerimenti: {
        Row: {
          created_at: string | null
          enigma_id: string
          id: string
          image_url: string | null
          order_index: number | null
          text: string
        }
        Insert: {
          created_at?: string | null
          enigma_id: string
          id?: string
          image_url?: string | null
          order_index?: number | null
          text: string
        }
        Update: {
          created_at?: string | null
          enigma_id?: string
          id?: string
          image_url?: string | null
          order_index?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "enigma_suggerimenti_enigma_id_fkey"
            columns: ["enigma_id"]
            isOneToOne: false
            referencedRelation: "enigmi"
            referencedColumns: ["id"]
          },
        ]
      }
      enigmi: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string
          id: string
          reward_payload: Json | null
          reward_type: string | null
          session_id: string | null
          solution: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string
          id?: string
          reward_payload?: Json | null
          reward_type?: string | null
          session_id?: string | null
          solution: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string
          id?: string
          reward_payload?: Json | null
          reward_type?: string | null
          session_id?: string | null
          solution?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "enigmi_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      global_catch_config: {
        Row: {
          comune_rate: number
          epico_level_bonus: number
          epico_rate: number
          id: number
          leggendario_level_bonus: number
          leggendario_rate: number
          mitologico_level_bonus: number
          mitologico_rate: number
          non_comune_level_bonus: number
          non_comune_rate: number
          raro_level_bonus: number
          raro_rate: number
          updated_at: string
        }
        Insert: {
          comune_rate?: number
          epico_level_bonus?: number
          epico_rate?: number
          id?: number
          leggendario_level_bonus?: number
          leggendario_rate?: number
          mitologico_level_bonus?: number
          mitologico_rate?: number
          non_comune_level_bonus?: number
          non_comune_rate?: number
          raro_level_bonus?: number
          raro_rate?: number
          updated_at?: string
        }
        Update: {
          comune_rate?: number
          epico_level_bonus?: number
          epico_rate?: number
          id?: number
          leggendario_level_bonus?: number
          leggendario_rate?: number
          mitologico_level_bonus?: number
          mitologico_rate?: number
          non_comune_level_bonus?: number
          non_comune_rate?: number
          raro_level_bonus?: number
          raro_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      hall_of_fame: {
        Row: {
          awarded_at: string | null
          creatures_caught: number
          id: string
          rank: number
          score: number
          season_label: string
          session_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          creatures_caught: number
          id?: string
          rank: number
          score: number
          season_label: string
          session_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          creatures_caught?: number
          id?: string
          rank?: number
          score?: number
          season_label?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_of_fame_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          created_at: string | null
          description: string
          effect_value: number
          egg_rarity: string | null
          id: string
          image_url: string | null
          in_shop: boolean
          is_redeemable: boolean
          name: string
          reward: Json
          session_id: string | null
          shop_price: number
          steps_required: number
          type: string
        }
        Insert: {
          created_at?: string | null
          description: string
          effect_value?: number
          egg_rarity?: string | null
          id?: string
          image_url?: string | null
          in_shop?: boolean
          is_redeemable?: boolean
          name: string
          reward?: Json
          session_id?: string | null
          shop_price?: number
          steps_required?: number
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string
          effect_value?: number
          egg_rarity?: string | null
          id?: string
          image_url?: string | null
          in_shop?: boolean
          is_redeemable?: boolean
          name?: string
          reward?: Json
          session_id?: string | null
          shop_price?: number
          steps_required?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      level_exp_config: {
        Row: {
          exp_to_next: number
          level: number
        }
        Insert: {
          exp_to_next?: number
          level: number
        }
        Update: {
          exp_to_next?: number
          level?: number
        }
        Relationships: []
      }
      level_rewards: {
        Row: {
          bonus_items: Json
          created_at: string | null
          description: string
          gold: number
          id: string
          item_id: string | null
          item_qty: number
          level: number
        }
        Insert: {
          bonus_items?: Json
          created_at?: string | null
          description?: string
          gold?: number
          id?: string
          item_id?: string | null
          item_qty?: number
          level: number
        }
        Update: {
          bonus_items?: Json
          created_at?: string | null
          description?: string
          gold?: number
          id?: string
          item_id?: string | null
          item_qty?: number
          level?: number
        }
        Relationships: [
          {
            foreignKeyName: "level_rewards_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          chapter_order: number
          created_at: string | null
          description: string
          id: string
          is_required: boolean
          reward_creature_id: string | null
          reward_exp: number
          reward_gold: number
          reward_item_id: string | null
          reward_items: Json
          session_id: string | null
          target: string
          target_count: number
          title: string
          type: string
          unlock_after_mission_id: string | null
          unlock_level: number | null
        }
        Insert: {
          chapter_order: number
          created_at?: string | null
          description: string
          id?: string
          is_required?: boolean
          reward_creature_id?: string | null
          reward_exp?: number
          reward_gold?: number
          reward_item_id?: string | null
          reward_items?: Json
          session_id?: string | null
          target: string
          target_count?: number
          title: string
          type: string
          unlock_after_mission_id?: string | null
          unlock_level?: number | null
        }
        Update: {
          chapter_order?: number
          created_at?: string | null
          description?: string
          id?: string
          is_required?: boolean
          reward_creature_id?: string | null
          reward_exp?: number
          reward_gold?: number
          reward_item_id?: string | null
          reward_items?: Json
          session_id?: string | null
          target?: string
          target_count?: number
          title?: string
          type?: string
          unlock_after_mission_id?: string | null
          unlock_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_reward_creature_id_fkey"
            columns: ["reward_creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_reward_item_id_fkey"
            columns: ["reward_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_unlock_after_mission_id_fkey"
            columns: ["unlock_after_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          id: string
          sent_at: string | null
          sent_by_admin_id: string | null
          session_id: string
          title: string
        }
        Insert: {
          body: string
          id?: string
          sent_at?: string | null
          sent_by_admin_id?: string | null
          session_id: string
          title: string
        }
        Update: {
          body?: string
          id?: string
          sent_at?: string | null
          sent_by_admin_id?: string | null
          session_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_claims: {
        Row: {
          claimed_at: string
          id: string
          pin_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          pin_id: string
          session_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          pin_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_claims_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "session_map_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_creatures: {
        Row: {
          caught_at: string | null
          creature_id: string
          duplicates_count: number
          evolved: boolean
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          caught_at?: string | null
          creature_id: string
          duplicates_count?: number
          evolved?: boolean
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          caught_at?: string | null
          creature_id?: string
          duplicates_count?: number
          evolved?: boolean
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_creatures_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_creatures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_eggs: {
        Row: {
          created_at: string
          egg_rarity: string
          hatched_at: string | null
          hatched_creature_id: string | null
          id: string
          session_id: string
          steps_at_pickup: number
          steps_required: number
          user_id: string
        }
        Insert: {
          created_at?: string
          egg_rarity?: string
          hatched_at?: string | null
          hatched_creature_id?: string | null
          id?: string
          session_id: string
          steps_at_pickup?: number
          steps_required?: number
          user_id: string
        }
        Update: {
          created_at?: string
          egg_rarity?: string
          hatched_at?: string | null
          hatched_creature_id?: string | null
          id?: string
          session_id?: string
          steps_at_pickup?: number
          steps_required?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_eggs_hatched_creature_id_fkey"
            columns: ["hatched_creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_eggs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_enigma_suggerimenti: {
        Row: {
          id: string
          obtained_at: string | null
          session_id: string
          suggerimento_id: string
          user_id: string
        }
        Insert: {
          id?: string
          obtained_at?: string | null
          session_id: string
          suggerimento_id: string
          user_id: string
        }
        Update: {
          id?: string
          obtained_at?: string | null
          session_id?: string
          suggerimento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_enigma_suggerimenti_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_enigma_suggerimenti_suggerimento_id_fkey"
            columns: ["suggerimento_id"]
            isOneToOne: false
            referencedRelation: "enigma_suggerimenti"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          session_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          session_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          session_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_game_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_inventory: {
        Row: {
          id: string
          item_id: string
          quantity: number
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          quantity?: number
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          quantity?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_inventory_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_missions: {
        Row: {
          completed_at: string | null
          id: string
          mission_id: string
          progress: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          mission_id: string
          progress?: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          mission_id?: string
          progress?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_missions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read: boolean
          session_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          session_id: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          session_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_sessions: {
        Row: {
          esca_active_until: string | null
          exp: number
          gold: number
          id: string
          joined_at: string | null
          last_position: unknown
          last_position_at: string | null
          level: number
          role: string
          score: number
          score_final: number | null
          selected_creature_id: string | null
          session_id: string
          squad_ids: string[] | null
          steps_walked: number
          user_id: string
        }
        Insert: {
          esca_active_until?: string | null
          exp?: number
          gold?: number
          id?: string
          joined_at?: string | null
          last_position?: unknown
          last_position_at?: string | null
          level?: number
          role?: string
          score?: number
          score_final?: number | null
          selected_creature_id?: string | null
          session_id: string
          squad_ids?: string[] | null
          steps_walked?: number
          user_id: string
        }
        Update: {
          esca_active_until?: string | null
          exp?: number
          gold?: number
          id?: string
          joined_at?: string | null
          last_position?: unknown
          last_position_at?: string | null
          level?: number
          role?: string
          score?: number
          score_final?: number | null
          selected_creature_id?: string | null
          session_id?: string
          squad_ids?: string[] | null
          steps_walked?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_selected_creature"
            columns: ["selected_creature_id"]
            isOneToOne: false
            referencedRelation: "player_creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          gdpr_consent_at: string | null
          gdpr_consent_minor: boolean | null
          nickname: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          gdpr_consent_at?: string | null
          gdpr_consent_minor?: boolean | null
          nickname?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          gdpr_consent_at?: string | null
          gdpr_consent_minor?: boolean | null
          nickname?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          created_at: string | null
          enigma_suggerimento_id: string | null
          id: string
          label: string
          manual_code: string | null
          payload: Json
          session_id: string | null
          type: string
          unique_per_user: boolean
          uses_remaining: number | null
        }
        Insert: {
          created_at?: string | null
          enigma_suggerimento_id?: string | null
          id?: string
          label?: string
          manual_code?: string | null
          payload: Json
          session_id?: string | null
          type: string
          unique_per_user?: boolean
          uses_remaining?: number | null
        }
        Update: {
          created_at?: string | null
          enigma_suggerimento_id?: string | null
          id?: string
          label?: string
          manual_code?: string | null
          payload?: Json
          session_id?: string | null
          type?: string
          unique_per_user?: boolean
          uses_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_enigma_suggerimento_id_fkey"
            columns: ["enigma_suggerimento_id"]
            isOneToOne: false
            referencedRelation: "enigma_suggerimenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_log: {
        Row: {
          id: string
          qr_id: string
          scanned_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          qr_id: string
          scanned_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          qr_id?: string
          scanned_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_scan_log_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_errors: {
        Row: {
          context: Json
          created_at: string
          error_code: string
          id: string
          message: string
          session_id: string
          source: string
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          error_code: string
          id?: string
          message: string
          session_id: string
          source: string
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          error_code?: string
          id?: string
          message?: string
          session_id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_errors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_invites: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean
          session_id: string
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          session_id: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          session_id?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_map_pins: {
        Row: {
          created_at: string | null
          description: string
          enigma_id: string | null
          enigma_suggerimento_id: string | null
          id: string
          image_url: string | null
          lat: number
          lng: number
          name: string
          reward_payload: Json | null
          reward_radius_m: number | null
          reward_type: string | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string
          enigma_id?: string | null
          enigma_suggerimento_id?: string | null
          id?: string
          image_url?: string | null
          lat: number
          lng: number
          name?: string
          reward_payload?: Json | null
          reward_radius_m?: number | null
          reward_type?: string | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          enigma_id?: string | null
          enigma_suggerimento_id?: string | null
          id?: string
          image_url?: string | null
          lat?: number
          lng?: number
          name?: string
          reward_payload?: Json | null
          reward_radius_m?: number | null
          reward_type?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_map_pins_enigma_id_fkey"
            columns: ["enigma_id"]
            isOneToOne: false
            referencedRelation: "enigmi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_map_pins_enigma_suggerimento_id_fkey"
            columns: ["enigma_suggerimento_id"]
            isOneToOne: false
            referencedRelation: "enigma_suggerimenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_map_pins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_spawn_config: {
        Row: {
          created_at: string
          epico_bonus: number
          id: string
          leggendario_bonus: number
          non_comune_bonus: number
          raro_bonus: number
          session_id: string
        }
        Insert: {
          created_at?: string
          epico_bonus?: number
          id?: string
          leggendario_bonus?: number
          non_comune_bonus?: number
          raro_bonus?: number
          session_id: string
        }
        Update: {
          created_at?: string
          epico_bonus?: number
          id?: string
          leggendario_bonus?: number
          non_comune_bonus?: number
          raro_bonus?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_spawn_config_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          area_bounds: Json
          auto_end: boolean
          created_at: string | null
          duration_minutes: number
          end_at: string | null
          id: string
          name: string
          narrative_config: Json
          start_at: string | null
          starter_kit: Json | null
          status: string
        }
        Insert: {
          area_bounds?: Json
          auto_end?: boolean
          created_at?: string | null
          duration_minutes?: number
          end_at?: string | null
          id?: string
          name: string
          narrative_config?: Json
          start_at?: string | null
          starter_kit?: Json | null
          status?: string
        }
        Update: {
          area_bounds?: Json
          auto_end?: boolean
          created_at?: string | null
          duration_minutes?: number
          end_at?: string | null
          id?: string
          name?: string
          narrative_config?: Json
          start_at?: string | null
          starter_kit?: Json | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_expired_sessions: { Args: never; Returns: undefined }
      increment_player_stats: {
        Args: {
          p_exp: number
          p_gold?: number
          p_score: number
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          gold_reward: number
          leveled_up: boolean
          new_level: number
          old_level: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_in_session: { Args: { p_session_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
