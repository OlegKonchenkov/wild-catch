"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/client-user";
import { useWakeLock } from "@/hooks/useWakeLock";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import CreatureSprite from "@/components/creature/CreatureSprite";
import AttackAnimation from "@/components/battle/AttackAnimation";
import CombatFortuneBadge from "@/components/game/CombatFortuneBadge";
import {
  GameBattleSkeleton,
  GameListSkeleton,
} from "@/components/game/GameLoading";
import { GameToast } from "@/components/game/GameToast";
import { useGameToast } from "@/components/game/useGameToast";
import MissionRewardModal from "@/components/game/MissionRewardModal";
import type { CompletedMissionInfo } from "@/components/game/MissionRewardModal";
import { ELEMENT_EMOJI, RARITY_COLORS, RARITY_LABELS } from "@/lib/types";
import type { Element, Rarity } from "@/lib/types";
import { playBossSound } from "@/lib/game/battle-sounds";
import { startBossLoop } from "@/lib/game/sounds/battle-loop";
import {
  playKnockout,
  playVictory,
  playDefeat,
} from "@/lib/game/sounds/events";
import { scaleCombatStats, STATUS_EFFECT_META } from "@/lib/game/combat";
import type { StatusEffect } from "@/lib/game/combat";
import {
  ELEMENT_THEME,
  DEFAULT_THEME,
  BOSS_THEME,
  formatFortuneText,
  type BossSlot,
  type PlayerSlot,
  type SquadCreature,
  type BattagliaItem,
  type CombatFortuneInfo,
} from "@/components/game/boss/types";
import CreatureCard from "@/components/game/boss/CreatureCard";


/* ── Squad Selector ─────────────────────────────────────────────────────────── */

function SquadSelector({
  creatures,
  lineup,
  onToggle,
  onRemoveSlot,
  onConfirm,
  bossName,
  bossLineup,
  starting,
  playerLevel,
}: {
  creatures: SquadCreature[];
  lineup: (SquadCreature | null)[];
  onToggle: (c: SquadCreature) => void;
  onRemoveSlot: (i: number) => void;
  onConfirm: () => void;
  bossName: string;
  bossLineup: BossSlot[];
  starting: boolean;
  playerLevel: number;
}) {
  const filledCount = lineup.filter(Boolean).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(247,200,65,0.12)",
              border: "1px solid rgba(247,200,65,0.3)",
            }}
          >
            <span className="text-xl">💀</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">
              Capo Palestra
            </h1>
            <p className="text-white/40 text-xs">
              {bossName} ti sfida! Scegli la tua squadra
            </p>
          </div>
        </div>

        {/* Boss lineup preview — with images */}
        <div className="flex items-center gap-2 mt-3">
          {bossLineup.map((bc, i) => (
            <div
              key={i}
              className="flex-1 flex items-center gap-2 rounded-xl px-2 py-1.5"
              style={{
                background: "rgba(247,200,65,0.06)",
                border: "1px solid rgba(247,200,65,0.2)",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg overflow-hidden shrink-0"
                style={{ background: "rgba(247,200,65,0.1)" }}
              >
                {bc.image_url ? (
                  <img
                    src={bc.image_url}
                    alt={bc.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base">
                    {ELEMENT_EMOJI[bc.element] ?? "?"}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white/80 truncate">
                  {bc.name}
                </p>
                <p className="text-[9px] text-white/35">
                  {ELEMENT_EMOJI[bc.element]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Squad slots — with images */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-semibold">
          La tua squadra ({filledCount}/3)
        </p>
        <div className="flex gap-2">
          {lineup.map((c, i) => (
            <button
              key={i}
              onClick={() => c && onRemoveSlot(i)}
              className="flex-1 rounded-xl border-2 transition-all overflow-hidden"
              style={{
                height: 64,
                borderColor: c
                  ? "rgba(58,157,188,0.6)"
                  : "rgba(255,255,255,0.12)",
                borderStyle: c ? "solid" : "dashed",
                background: c
                  ? "rgba(58,157,188,0.08)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              {c ? (
                <div className="flex items-center gap-1.5 h-full px-2">
                  <div
                    className="w-9 h-9 rounded-lg overflow-hidden shrink-0"
                    style={{ background: `${RARITY_COLORS[c.rarity]}18` }}
                  >
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base">
                        {ELEMENT_EMOJI[c.element]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-white truncate">
                      {c.name}
                    </p>
                    <p
                      className="text-[9px]"
                      style={{ color: RARITY_COLORS[c.rarity] }}
                    >
                      {c.rarity}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-white/20 text-2xl font-light">+</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Creature list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {creatures.map((c) => {
          const inLineup = lineup.some(
            (l) => l?.playerCreatureId === c.playerCreatureId,
          );
          const scaled = scaleCombatStats(
            { hp: c.hp, atk: c.atk, def: c.def },
            playerLevel,
          );
          return (
            <button
              key={c.playerCreatureId}
              onClick={() => onToggle(c)}
              className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-all"
              style={{
                borderColor: inLineup
                  ? "rgba(58,157,188,0.5)"
                  : "rgba(255,255,255,0.07)",
                background: inLineup
                  ? "rgba(58,157,188,0.08)"
                  : "rgba(255,255,255,0.03)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                style={{ background: `${RARITY_COLORS[c.rarity]}18` }}
              >
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">
                    {ELEMENT_EMOJI[c.element]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-white text-sm truncate">
                  {c.name}
                </p>
                <p
                  className="text-xs"
                  style={{ color: RARITY_COLORS[c.rarity] }}
                >
                  {RARITY_LABELS[c.rarity]}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {(
                  [
                    { label: "HP", val: scaled.hp, color: "#F87171" },
                    { label: "ATK", val: scaled.atk, color: "#FB923C" },
                    { label: "DEF", val: scaled.def, color: "#60A5FA" },
                  ] as const
                ).map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center rounded-lg px-1.5 py-1 min-w-[32px]"
                    style={{
                      background: `${s.color}12`,
                      border: `1px solid ${s.color}22`,
                    }}
                  >
                    <span
                      className="text-[11px] font-black leading-none"
                      style={{ color: s.color }}
                    >
                      {s.val}
                    </span>
                    <span className="text-[8px] font-bold text-white/35 leading-none mt-0.5">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              {inLineup && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(58,157,188,0.2)",
                    border: "1px solid rgba(58,157,188,0.5)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3A9DBC"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="w-3 h-3"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={onConfirm}
          disabled={filledCount < 1 || starting}
          className="w-full text-white font-extrabold py-3.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{
            background:
              filledCount < 1 || starting
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)",
            boxShadow:
              filledCount >= 1 && !starting
                ? "0 4px 20px rgba(232,93,47,0.4)"
                : "none",
          }}
        >
          {starting
            ? "Inizio battaglia..."
            : filledCount < 1
              ? "Seleziona almeno 1 creatura"
              : "⚔️ Inizia la battaglia!"}
        </button>
      </div>
    </div>
  );
}

/* ── Battle Screen ──────────────────────────────────────────────────────────── */

function SquadSelectorSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl shrink-0 animate-pulse"
            style={{
              background: "rgba(247,200,65,0.12)",
              border: "1px solid rgba(247,200,65,0.2)",
            }}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-36 rounded bg-white/10 animate-pulse" />
            <div className="h-2.5 w-48 max-w-full rounded bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-xl px-2 py-1.5"
              style={{
                background: "rgba(247,200,65,0.05)",
                border: "1px solid rgba(247,200,65,0.15)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2.5 w-4/5 rounded bg-white/10 animate-pulse" />
                  <div className="h-2 w-1/3 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="h-3 w-28 rounded bg-white/10 animate-pulse mb-2" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.03]"
              style={{ height: 64 }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <GameListSkeleton rows={5} itemClassName="h-[72px]" />
      </div>

      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="h-12 rounded-xl bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

function BattleScreen({
  bossLineup,
  playerLineup,
  bossActiveSlot,
  onAttack,
  attacking,
  bossAttacking,
  log,
  animState,
  bossAnimState,
  lastDamage,
  battagliaItems,
  curaItems,
  selectedItemId,
  onSelectItem,
  onHeal,
  onSwitch,
  switchNotice,
  fortuneNotice,
  critNotice,
  statusNotice,
  bossFainting,
  playerFainting,
  attackAnim,
  onAttackAnimComplete,
}: {
  bossLineup: BossSlot[];
  playerLineup: PlayerSlot[];
  bossActiveSlot: number;
  onAttack: () => void;
  attacking: boolean;
  bossAttacking: boolean;
  log: string[];
  animState: "idle" | "attack" | "damage";
  bossAnimState: "idle" | "attack" | "damage";
  lastDamage: {
    amount: number;
    target: "me" | "boss";
    id: number;
    isCrit?: boolean;
  } | null;
  battagliaItems: BattagliaItem[];
  curaItems: BattagliaItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onHeal: (itemId: string) => void;
  onSwitch: (playerCreatureId: string) => void;
  switchNotice: string | null;
  fortuneNotice: {
    id: number;
    text: string;
    tone: CombatFortuneInfo["tone"];
  } | null;
  critNotice: { id: number } | null;
  statusNotice: {
    id: number;
    emoji: string;
    text: string;
    color: string;
    glow: string;
  } | null;
  bossFainting: boolean;
  playerFainting: boolean;
  attackAnim: {
    key: number;
    element: string;
    rarity: string;
    side: "left" | "right";
    soundUrl?: string | null;
    soundDurationMs?: number | null;
  } | null;
  onAttackAnimComplete: () => void;
}) {
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [pendingSwitchCreatureId, setPendingSwitchCreatureId] = useState<string | null>(null);
  const [showBossIntro, setShowBossIntro] = useState(true);
  const [turnTimer, setTurnTimer] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoFightRef = useRef(false);
  const onAttackRef = useRef(onAttack);
  useEffect(() => {
    onAttackRef.current = onAttack;
  });

  // Play boss intro sound + start background loop on mount; stop loop on unmount
  useEffect(() => {
    playBossSound();
    const stopLoop = startBossLoop();
    return () => {
      stopLoop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTurnTimer(30);
    autoFightRef.current = false;
    timerRef.current = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          if (!autoFightRef.current) {
            autoFightRef.current = true;
            onAttackRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!attacking && !bossAttacking) {
      resetTimer();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attacking, bossAttacking]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeBoss = bossLineup[bossActiveSlot];
  const activePlayer = playerLineup.find((c) => c.is_active && !c.fainted);
  const playerSleeping = activePlayer?.active_status === "sonno";

  useEffect(() => {
    if (playerSleeping && selectedItemId) onSelectItem(null);
  }, [onSelectItem, playerSleeping, selectedItemId]);

  if (!activeBoss || !activePlayer) return null;

  // Build lineup dots
  const bossLineupDots = bossLineup.map((c, i) => ({
    color: "#F7C841",
    isActive: i === bossActiveSlot && !c.fainted,
    fainted: c.fainted,
  }));
  const playerLineupDots = [...playerLineup]
    .sort((a, b) => a.slot - b.slot)
    .map((c) => ({
      color: RARITY_COLORS[c.rarity] ?? "#3A9DBC",
      isActive: c.is_active,
      fainted: c.fainted,
    }));

  // Element-themed background
  const playerTheme = ELEMENT_THEME[activePlayer.element] ?? DEFAULT_THEME;
  const selectedItem = battagliaItems.find(
    (it) => it.inventoryId === selectedItemId,
  );

  return (
    <div
      className="flex flex-col h-full overflow-hidden select-none relative"
      style={{ background: BOSS_THEME.bg }}
    >
      {/* ── Atmospheric background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Boss glow — top-right */}
        <div
          className="absolute top-0 right-0 w-[65%] h-[55%]"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, rgba(247,200,65,0.22) 0%, transparent 70%)",
          }}
        />
        {/* Player element glow — bottom-left */}
        <div
          className="absolute bottom-0 left-0 w-[65%] h-[50%]"
          style={{
            background: `radial-gradient(ellipse at 20% 80%, ${playerTheme.glow}22 0%, transparent 70%)`,
          }}
        />
        {/* Mid shadow */}
        <div
          className="absolute inset-x-0"
          style={{
            top: "38%",
            height: "24%",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
          }}
        />
        {/* Ground line */}
        <div
          className="absolute inset-x-0"
          style={{
            top: "48%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${playerTheme.glow}18, rgba(247,200,65,0.18), transparent)`,
          }}
        />
      </div>

      {/* Switch notice */}
      <AnimatePresence>
        {switchNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-xl px-4 py-2 text-sm font-bold text-[#C084FC] text-center"
            style={{
              background: "rgba(123,77,184,0.18)",
              border: "1px solid rgba(123,77,184,0.4)",
              backdropFilter: "blur(8px)",
            }}
          >
            ✨ {switchNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Items modal ── */}
      <AnimatePresence>
        {showItemsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowItemsModal(false)}
              className="absolute inset-0 z-20"
              style={{
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl overflow-hidden"
              style={{
                background: "rgba(8,14,28,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "none",
              }}
            >
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <p className="font-extrabold text-white text-base">
                  Oggetti Battaglia
                </p>
                <button
                  onClick={() => setShowItemsModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="w-4 h-4"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-4 pb-6 flex flex-col gap-3">
                {!playerSleeping && battagliaItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">
                      ⚔️ Battaglia — potenzia ATK questo turno
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {battagliaItems.map((item) => (
                        <button
                          key={item.inventoryId}
                          onClick={() => {
                            onSelectItem(
                              selectedItemId === item.inventoryId
                                ? null
                                : item.inventoryId,
                            );
                            setShowItemsModal(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                          style={{
                            background:
                              selectedItemId === item.inventoryId
                                ? "rgba(251,191,36,0.12)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${selectedItemId === item.inventoryId ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.07)"}`,
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: "rgba(255,255,255,0.06)" }}
                          >
                            ⚔️
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-[#FBBF24]">
                              +{item.effectValue}% ATK
                            </p>
                          </div>
                          <span className="text-sm font-bold text-white/35 shrink-0">
                            ×{item.quantity}
                          </span>
                          {selectedItemId === item.inventoryId && (
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: "#FBBF24" }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {curaItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">
                      💚 Cura — ripristina HP (il boss attacca)
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {curaItems.map((item) => (
                        <button
                          key={item.inventoryId}
                          onClick={() => {
                            onHeal(item.inventoryId);
                            setShowItemsModal(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                          style={{
                            background: "rgba(52,211,153,0.08)",
                            border: "1px solid rgba(52,211,153,0.25)",
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: "rgba(52,211,153,0.1)" }}
                          >
                            💚
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-[#34D399]">
                              +{item.effectValue}% HP
                            </p>
                          </div>
                          <span className="text-sm font-bold text-white/35 shrink-0">
                            ×{item.quantity}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── BATTLE FIELD ── */}
      <div className="relative flex-1 z-10 overflow-hidden">
        {/* Boss card — top-right, flush to right edge */}
        <motion.div
          className="absolute z-10"
          style={{ top: 12, right: 0, left: "8%" }}
          animate={
            bossAnimState === "attack"
              ? { x: -14, scale: 1.03 }
              : bossAnimState === "damage"
                ? { x: 8, opacity: 0.6 }
                : { x: 0, scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`boss-${bossActiveSlot}`}
              initial={{ opacity: 0, x: showBossIntro ? 340 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={
                showBossIntro
                  ? { type: "spring", stiffness: 80, damping: 14, delay: 3.3 }
                  : { duration: 0.25 }
              }
            >
              <CreatureCard
                imageUrl={activeBoss.image_url || activeBoss.sprite_url}
                name={activeBoss.name}
                element={activeBoss.element}
                rarity="leggendaria"
                currentHp={activeBoss.current_hp}
                maxHp={activeBoss.max_hp}
                atk={activeBoss.atk}
                animState={bossAnimState}
                side="right"
                lineup={bossLineupDots}
                lineupLabel="Boss"
                isBoss
                fainting={bossFainting}
                statusEffect={activeBoss.active_status}
                statusTurnsLeft={activeBoss.status_turns_left}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Player card — bottom-left, flush to left edge */}
        <motion.div
          className="absolute z-10"
          style={{ bottom: 12, left: 0, right: "8%" }}
          animate={
            animState === "attack"
              ? { x: 14, scale: 1.03 }
              : animState === "damage"
                ? { x: -8, opacity: 0.6 }
                : { x: 0, scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activePlayer.player_creature_id}
              initial={{ opacity: 0, x: showBossIntro ? -340 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={
                showBossIntro
                  ? { type: "spring", stiffness: 80, damping: 14, delay: 4.0 }
                  : { duration: 0.25 }
              }
            >
              <CreatureCard
                imageUrl={activePlayer.image_url}
                name={activePlayer.name}
                element={activePlayer.element}
                rarity={activePlayer.rarity}
                currentHp={activePlayer.current_hp}
                maxHp={activePlayer.max_hp}
                atk={activePlayer.atk}
                animState={animState}
                side="left"
                lineup={playerLineupDots}
                lineupLabel="Tu"
                fainting={playerFainting}
                statusEffect={activePlayer.active_status}
                statusTurnsLeft={activePlayer.status_turns_left}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── Attack animation overlay ── */}
        {attackAnim && (
          <AttackAnimation
            key={attackAnim.key}
            element={attackAnim.element}
            rarity={attackAnim.rarity}
            side={attackAnim.side}
            soundUrl={attackAnim.soundUrl}
            soundDurationMs={attackAnim.soundDurationMs}
            onComplete={onAttackAnimComplete}
          />
        )}

        {/* ── Standalone damage floats (outside cards, not clipped) ── */}
        <AnimatePresence>
          {lastDamage?.target === "boss" && (
            <motion.div
              key={`boss-dmg-${lastDamage.id}`}
              initial={{ opacity: 1, y: 0, scale: lastDamage.isCrit ? 1.4 : 1 }}
              animate={{ opacity: 0, y: -80, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute pointer-events-none z-50"
              style={{ top: "28%", left: "50%", transform: "translateX(-50%)" }}
            >
              <span
                style={
                  lastDamage.isCrit
                    ? {
                        color: "#FB923C",
                        fontSize: 44,
                        fontWeight: 900,
                        textShadow:
                          "0 0 28px rgba(249,115,22,0.95), 0 0 56px rgba(249,115,22,0.5), 0 2px 8px rgba(0,0,0,0.9)",
                      }
                    : {
                        color: "#EF4444",
                        fontSize: 38,
                        fontWeight: 900,
                        textShadow:
                          "0 0 24px rgba(239,68,68,0.9), 0 0 48px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.9)",
                      }
                }
              >
                -{lastDamage.amount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {lastDamage?.target === "me" && (
            <motion.div
              key={`me-dmg-${lastDamage.id}`}
              initial={{ opacity: 1, y: 0, scale: lastDamage.isCrit ? 1.4 : 1 }}
              animate={{ opacity: 0, y: -80, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute pointer-events-none z-50"
              style={{
                bottom: "32%",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <span
                style={
                  lastDamage.isCrit
                    ? {
                        color: "#FB923C",
                        fontSize: 44,
                        fontWeight: 900,
                        textShadow:
                          "0 0 28px rgba(249,115,22,0.95), 0 0 56px rgba(249,115,22,0.5), 0 2px 8px rgba(0,0,0,0.9)",
                      }
                    : {
                        color: "#EF4444",
                        fontSize: 38,
                        fontWeight: 900,
                        textShadow:
                          "0 0 24px rgba(239,68,68,0.9), 0 0 48px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.9)",
                      }
                }
              >
                -{lastDamage.amount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="absolute inset-x-0 z-20 pointer-events-none"
          style={{ top: "46%", transform: "translateY(-50%)" }}
        >
          <div className="flex items-center justify-center px-4">
            <AnimatePresence mode="wait">
              {statusNotice && (
                <motion.div
                  key={`status-center-${statusNotice.id}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full text-center"
                  style={{
                    background: `${statusNotice.color}18`,
                    border: `1px solid ${statusNotice.color}55`,
                    color: statusNotice.color,
                    boxShadow: `0 0 12px ${statusNotice.glow}`,
                    maxWidth: 240,
                  }}
                >
                  {statusNotice.emoji} {statusNotice.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Turn / Log strip ── */}
      <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-1.5">
        <div
          className="flex-1 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06))",
          }}
        />
        <AnimatePresence mode="wait">
          {critNotice ? (
            <motion.div
              key={`crit-${critNotice.id}`}
              initial={{ opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold"
              style={{
                background: "rgba(249,115,22,0.2)",
                border: "1px solid rgba(249,115,22,0.55)",
                color: "#FB923C",
              }}
            >
              ⚡ CRITICO! ×1.75
            </motion.div>
          ) : bossAttacking ? (
            <motion.div
              key="boss-turn"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{
                background: "rgba(247,200,65,0.15)",
                border: "1px solid rgba(247,200,65,0.4)",
              }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[#F7C841]"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold text-[#F7C841]">
                Capo Palestra attacca!
              </span>
            </motion.div>
          ) : switchNotice ? (
            <motion.div
              key="switch"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="text-[10px] font-bold text-[#C084FC] px-3 py-1 rounded-full"
              style={{
                background: "rgba(123,77,184,0.18)",
                border: "1px solid rgba(123,77,184,0.4)",
              }}
            >
              ✨ {switchNotice}
            </motion.div>
          ) : fortuneNotice ? (
            <motion.div
              key={`fortune-${fortuneNotice.id}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
            >
              <CombatFortuneBadge
                text={fortuneNotice.text}
                tone={fortuneNotice.tone}
              />
            </motion.div>
          ) : (
            <AnimatePresence>
              {log[log.length - 1] && (
                <motion.span
                  key={log.length}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] font-semibold text-white/35 text-center"
                >
                  {log[log.length - 1]}
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </AnimatePresence>
        <div
          className="flex-1 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)",
          }}
        />
      </div>

      {/* ── SQUAD BAR ── */}
      {playerLineup.length >= 2 && (
        <div className="shrink-0 px-3 pb-1.5 z-10">
          <div className="flex gap-1.5">
            {[...playerLineup]
              .sort((a, b) => a.slot - b.slot)
              .map((slot) => {
                const hpPct = Math.max(
                  0,
                  Math.min(100, (slot.current_hp / slot.max_hp) * 100),
                );
                const hpColor =
                  hpPct > 50 ? "#34D399" : hpPct > 25 ? "#FBBF24" : "#EF4444";
                const isActive = slot.is_active;
                const isFainted = slot.fainted;
                const canSwitch = !attacking && !bossAttacking && !isActive && !isFainted;
                return (
                  <div
                    key={slot.player_creature_id}
                    onClick={() => canSwitch && setPendingSwitchCreatureId(slot.player_creature_id)}
                    className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all"
                    style={{
                      background: isActive
                        ? "rgba(255,255,255,0.1)"
                        : isFainted
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(255,255,255,0.04)",
                      border: isActive
                        ? "1px solid rgba(255,255,255,0.22)"
                        : canSwitch
                          ? "1px solid rgba(255,255,255,0.22)"
                          : "1px solid rgba(255,255,255,0.07)",
                      opacity: isFainted ? 0.35 : 1,
                      cursor: canSwitch ? "pointer" : "default",
                    }}
                  >
                    {slot.image_url ? (
                      <img
                        src={slot.image_url}
                        alt={slot.name}
                        className="w-6 h-6 object-contain shrink-0"
                        style={{ filter: isFainted ? "grayscale(1)" : "none" }}
                      />
                    ) : (
                      <span className="text-sm shrink-0 leading-none">
                        {ELEMENT_EMOJI[
                          slot.element as keyof typeof ELEMENT_EMOJI
                        ] ?? "✦"}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-white/50 truncate leading-none mb-0.5">
                        {slot.name}
                      </p>
                      <div
                        className="h-[4px] rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          animate={{ width: `${hpPct}%` }}
                          transition={{ duration: 0.4 }}
                          style={{ background: hpColor }}
                        />
                      </div>
                    </div>
                    {isActive && !isFainted && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                    )}
                    {canSwitch && <span className="text-[9px] text-white/50 shrink-0">↻</span>}
                    {isFainted && (
                      <span className="text-[9px] text-red-400/60 shrink-0 font-bold">
                        ✕
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── TIMER BAR ── */}
      {(() => {
        const timerPct = (turnTimer / 30) * 100;
        const timerUrgent = turnTimer <= 10;
        return (
          <div className="shrink-0 px-4 pb-1 z-10">
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${timerPct}%`,
                    background: bossAttacking
                      ? "rgba(247,200,65,0.4)"
                      : timerUrgent
                        ? "#EF4444"
                        : "#34D399",
                  }}
                  animate={
                    timerUrgent && !bossAttacking
                      ? { opacity: [1, 0.4, 1] }
                      : {}
                  }
                  transition={
                    timerUrgent && !bossAttacking
                      ? { duration: 0.5, repeat: Infinity }
                      : {}
                  }
                />
              </div>
              {!bossAttacking && (
                <span
                  className={`text-[11px] font-mono font-bold w-6 text-right shrink-0 ${timerUrgent ? "text-red-400" : "text-white/35"}`}
                >
                  {turnTimer}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── ACTIONS ── */}
      <div className="shrink-0 px-4 pb-5 pt-1 z-10 flex gap-2">
        {/* Items button */}
        {(battagliaItems.length > 0 || curaItems.length > 0) && (
          <motion.button
            onClick={() => setShowItemsModal(true)}
            whileTap={{ scale: 0.95 }}
            className="w-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
            style={{
              background: selectedItemId
                ? "rgba(251,191,36,0.12)"
                : "rgba(255,255,255,0.06)",
              border: `1px solid ${selectedItemId ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.09)"}`,
            }}
          >
            <span className="text-lg leading-none">🗡️</span>
            {selectedItemId && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
            )}
          </motion.button>
        )}

        {/* Attack button */}
        <motion.button
          onClick={onAttack}
          disabled={attacking || bossAttacking}
          whileTap={!attacking && !bossAttacking ? { scale: 0.95 } : {}}
          className="flex-1 relative overflow-hidden rounded-2xl py-4 font-extrabold text-white text-base disabled:cursor-not-allowed transition-all"
          style={{
            background: bossAttacking
              ? "rgba(247,200,65,0.08)"
              : attacking
                ? "rgba(255,255,255,0.06)"
                : selectedItemId
                  ? "linear-gradient(135deg, #FBBF24 0%, #d97706 100%)"
                  : "linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)",
            boxShadow:
              !attacking && !bossAttacking
                ? selectedItemId
                  ? "0 4px 20px rgba(251,191,36,0.35)"
                  : "0 4px 20px rgba(232,93,47,0.4)"
                : "none",
            border: bossAttacking ? "1px solid rgba(247,200,65,0.25)" : "none",
            opacity: attacking || bossAttacking ? 0.7 : 1,
          }}
        >
          {bossAttacking ? (
            <span className="text-[#F7C841]/60 text-sm">
              Turno del Capo Palestra...
            </span>
          ) : attacking ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {playerSleeping
                ? "💤 Passa"
                : `⚔️ ${selectedItem ? `Attacca (+${selectedItem.effectValue}% ATK)` : "Attacca!"}`}
            </span>
          )}
        </motion.button>
      </div>

      {/* ── BOSS INTRO OVERLAY (golden dramatic wipe) ── */}
      <AnimatePresence>
        {showBossIntro && (
          <motion.div
            className="absolute inset-0 z-[100] overflow-hidden pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 1, 1, 0] }}
            transition={{ duration: 4.0, times: [0, 0.42, 0.68, 0.82, 1.0] }}
            onAnimationComplete={() => setShowBossIntro(false)}
            style={{ background: "#070400" }}
          >
            {/* Pre-glow: gold pulse */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                width: 10,
                height: 10,
                marginTop: -5,
                marginLeft: -5,
                background: "#F7C841",
                filter: "blur(18px)",
              }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 16, 35], opacity: [0, 0.7, 0] }}
              transition={{
                duration: 1.1,
                times: [0, 0.5, 1],
                ease: "easeOut",
                delay: 0.05,
              }}
            />
            {/* White burst ring */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                width: 22,
                height: 22,
                marginTop: -11,
                marginLeft: -11,
                background: "white",
              }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 110, opacity: 0 }}
              transition={{
                duration: 0.9,
                ease: [0.1, 0.85, 0.28, 1],
                delay: 0.2,
              }}
            />
            {/* Gold ring */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                width: 16,
                height: 16,
                marginTop: -8,
                marginLeft: -8,
                background: "#F7C841",
                filter: "blur(6px)",
              }}
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 85, opacity: 0 }}
              transition={{
                duration: 1.0,
                delay: 0.3,
                ease: [0.1, 0.85, 0.28, 1],
              }}
            />
            {/* Double border ring (gold) */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                width: 8,
                height: 8,
                marginTop: -4,
                marginLeft: -4,
                border: "2px solid rgba(247,200,65,0.9)",
                filter: "blur(1px)",
              }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: [1, 45, 90], opacity: [1, 0.5, 0] }}
              transition={{
                duration: 1.0,
                delay: 0.38,
                times: [0, 0.55, 1],
                ease: "easeOut",
              }}
            />
            {/* Second gold ripple ring */}
            <motion.div
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                width: 14,
                height: 14,
                marginTop: -7,
                marginLeft: -7,
                border: "1.5px solid rgba(247,200,65,0.6)",
                filter: "blur(2px)",
              }}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: [1, 28, 65], opacity: [0.8, 0.4, 0] }}
              transition={{
                duration: 1.3,
                delay: 0.58,
                times: [0, 0.5, 1],
                ease: "easeOut",
              }}
            />
            {/* White flash */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 0] }}
              transition={{
                duration: 0.7,
                delay: 0.42,
                times: [0, 0.28, 0.6, 1],
              }}
              style={{
                background:
                  "radial-gradient(ellipse 85% 65% at center, white 0%, rgba(247,200,65,0.7) 42%, transparent 72%)",
              }}
            />
            {/* Gold tint */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 0.65, delay: 0.8, times: [0, 0.4, 1] }}
              style={{
                background:
                  "radial-gradient(ellipse 70% 55% at center, rgba(247,200,65,0.85) 0%, rgba(247,200,65,0.25) 55%, transparent 80%)",
              }}
            />
            {/* Ambient gold glow — breathes during hold phase */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.28, 0.12, 0.28, 0] }}
              transition={{
                duration: 2.4,
                delay: 1.2,
                times: [0, 0.2, 0.5, 0.75, 1],
              }}
              style={{
                background:
                  "radial-gradient(ellipse 65% 55% at center, rgba(247,200,65,0.5) 0%, transparent 65%)",
              }}
            />
            {/* Boss title reveal */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.12, 1.02, 0.85],
              }}
              transition={{
                duration: 2.8,
                delay: 0.9,
                times: [0, 0.1, 0.72, 1.0],
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.3em",
                  color: "rgba(247,200,65,0.85)",
                  textTransform: "uppercase",
                }}
              >
                Capo Palestra
              </span>
              <span
                style={{
                  fontSize: 68,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: "white",
                  textShadow:
                    "0 0 40px rgba(247,200,65,0.9), 0 0 80px rgba(247,200,65,0.5), 0 4px 16px rgba(0,0,0,0.9)",
                  lineHeight: 1.1,
                }}
              >
                💀
              </span>
            </motion.div>
            {/* Starburst scanlines — 12 directions */}
            {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map(
              (angle, i) => (
                <motion.div
                  key={angle}
                  className="absolute"
                  style={{
                    top: "50%",
                    left: "50%",
                    width: 2.5,
                    height: "200%",
                    marginLeft: -1.25,
                    transformOrigin: "top center",
                    rotate: `${angle}deg`,
                    background:
                      "linear-gradient(to bottom, transparent 0%, rgba(247,200,65,0.7) 32%, rgba(247,200,65,0.7) 68%, transparent 100%)",
                  }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: [0, 1, 1], opacity: [0, 0.9, 0] }}
                  transition={{
                    duration: 1.1,
                    delay: 0.28 + i * 0.018,
                    times: [0, 0.22, 1],
                    ease: "easeOut",
                  }}
                />
              ),
            )}
            {/* Second scanline wave — gold-tinted, wider */}
            {[
              7.5, 22.5, 37.5, 52.5, 67.5, 82.5, 97.5, 112.5, 127.5, 142.5,
              157.5, 172.5,
            ].map((angle, i) => (
              <motion.div
                key={`b-${angle}`}
                className="absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  width: 4,
                  height: "200%",
                  marginLeft: -2,
                  transformOrigin: "top center",
                  rotate: `${angle}deg`,
                  background:
                    "linear-gradient(to bottom, transparent 0%, rgba(247,200,65,0.4) 35%, rgba(247,200,65,0.4) 65%, transparent 100%)",
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 1], opacity: [0, 0.65, 0] }}
                transition={{
                  duration: 1.5,
                  delay: 0.52 + i * 0.018,
                  times: [0, 0.2, 1],
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SWITCH CONFIRM MODAL ── */}
      <AnimatePresence>
        {pendingSwitchCreatureId && (() => {
          const slot = playerLineup.find(c => c.player_creature_id === pendingSwitchCreatureId)
          if (!slot) return null
          return (
            <motion.div
              key="boss-switch-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end justify-center pb-10"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
              onClick={() => setPendingSwitchCreatureId(null)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="bg-[#111827] rounded-3xl px-6 py-5 mx-4 w-full max-w-sm"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                onClick={e => e.stopPropagation()}
              >
                <p className="text-white/60 text-sm text-center mb-3">Cambia creatura?</p>
                {slot.image_url && (
                  <img src={slot.image_url} alt={slot.name} className="w-16 h-16 object-contain mx-auto mb-2" />
                )}
                <p className="text-white font-bold text-center text-lg mb-1">{slot.name}</p>
                <p className="text-white/40 text-xs text-center mb-4">Il Capo Palestra potrà contrattaccare</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingSwitchCreatureId(null)}
                    className="flex-1 py-3 rounded-2xl text-white/50 text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => {
                      const pcId = pendingSwitchCreatureId
                      setPendingSwitchCreatureId(null)
                      resetTimer()
                      onSwitch(pcId)
                    }}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm"
                    style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
                  >
                    ↻ Cambia
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  );
}

/* ── Result Screen ──────────────────────────────────────────────────────────── */

function ResultScreen({
  won,
  reward,
  levelUp,
  onExit,
  ctaLabel,
}: {
  won: boolean;
  reward: any;
  levelUp: { newLevel: number; goldReward: number } | null;
  onExit: () => void;
  ctaLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="text-7xl"
      >
        {won ? "🏆" : "💀"}
      </motion.div>

      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-1">
          {won ? "Vittoria!" : "Sconfitta"}
        </h2>
        <p className="text-white/50 text-sm">
          {won
            ? "Hai sconfitto il Capo Palestra!"
            : "Il Capo Palestra è troppo forte..."}
        </p>
      </div>

      {won && reward && (
        <div
          className="w-full rounded-2xl p-4 space-y-3"
          style={{
            background: "rgba(247,200,65,0.06)",
            border: "1px solid rgba(247,200,65,0.2)",
          }}
        >
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold text-center">
            Ricompense
          </p>

          <div className="grid grid-cols-2 gap-2">
            {(reward.gold ?? 0) > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(247,200,65,0.08)",
                  border: "1px solid rgba(247,200,65,0.2)",
                }}
              >
                <span className="text-lg">🪙</span>
                <div>
                  <p
                    className="font-extrabold text-sm"
                    style={{ color: "#F7C841" }}
                  >
                    {reward.gold}
                  </p>
                  <p className="text-white/30 text-xs">Oro</p>
                </div>
              </div>
            )}
            {(reward.exp ?? 0) > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(58,157,188,0.08)",
                  border: "1px solid rgba(58,157,188,0.2)",
                }}
              >
                <span className="text-lg">✨</span>
                <div>
                  <p
                    className="font-extrabold text-sm"
                    style={{ color: "#3A9DBC" }}
                  >
                    {reward.exp}
                  </p>
                  <p className="text-white/30 text-xs">EXP</p>
                </div>
              </div>
            )}
          </div>

          {reward.item_name && (
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span className="text-xl">🎁</span>
              <div>
                <p className="font-extrabold text-sm text-white">
                  {reward.item_name}
                </p>
                <p className="text-white/30 text-xs">
                  × {reward.item_qty ?? 1} oggetto
                </p>
              </div>
            </div>
          )}

          {reward.creature && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <p className="text-xs text-white/40 px-3 pt-2.5 pb-1 font-semibold uppercase tracking-wider">
                Creatura catturata!
              </p>
              <div className="flex items-center gap-3 px-3 pb-3">
                {(reward.creature.image_url || reward.creature.sprite_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      reward.creature.image_url ?? reward.creature.sprite_url
                    }
                    alt={reward.creature.name}
                    className="w-14 h-14 rounded-xl object-cover"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                )}
                <div>
                  <p className="font-extrabold text-sm text-white">
                    {reward.creature.name}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {RARITY_COLORS[
                      reward.creature.rarity as keyof typeof RARITY_COLORS
                    ] ? (
                      <span
                        style={{
                          color:
                            RARITY_COLORS[
                              reward.creature
                                .rarity as keyof typeof RARITY_COLORS
                            ],
                        }}
                      >
                        {RARITY_LABELS[
                          reward.creature.rarity as keyof typeof RARITY_LABELS
                        ] ?? reward.creature.rarity}
                      </span>
                    ) : (
                      reward.creature.rarity
                    )}
                    {reward.creature.element &&
                      ` · ${ELEMENT_EMOJI[reward.creature.element as keyof typeof ELEMENT_EMOJI] ?? ""} ${reward.creature.element}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {levelUp && (
            <div className="text-center">
              <span className="text-sm font-bold" style={{ color: "#F7C841" }}>
                ⭐ Level Up! Livello {levelUp.newLevel}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onExit}
        className="w-full text-white font-extrabold py-4 rounded-2xl text-base"
        style={{
          background: won
            ? "linear-gradient(135deg, #F7C841 0%, #d4a030 100%)"
            : "rgba(255,255,255,0.08)",
          boxShadow: won ? "0 4px 20px rgba(247,200,65,0.35)" : "none",
          color: won ? "#0D0205" : "white",
        }}
      >
        {ctaLabel ?? (won ? "Continua →" : "Torna al gioco")}
      </button>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export default function BossFightPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useWakeLock(true);

  const [fight, setFight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // load-time errors (full-page screen)
  const {
    toast: actionToast,
    showApiError: showActionError,
    dismiss: dismissActionToast,
  } = useGameToast();

  // Squad selector state
  const [allCreatures, setAllCreatures] = useState<SquadCreature[]>([]);
  const [lineup, setLineup] = useState<(SquadCreature | null)[]>([
    null,
    null,
    null,
  ]);
  const [starting, setStarting] = useState(false);
  const [loadingCreatures, setLoadingCreatures] = useState(true);
  const [playerLevel, setPlayerLevel] = useState(1);

  // Battle state
  const [bossLineup, setBossLineup] = useState<BossSlot[]>([]);
  const [playerLineup, setPlayerLineup] = useState<PlayerSlot[]>([]);
  const [bossActiveSlot, setBossActiveSlot] = useState(0);
  const [attacking, setAttacking] = useState(false);
  const [bossAttacking, setBossAttacking] = useState(false);
  const attackingRef = useRef(false);
  const [log, setLog] = useState<string[]>([]);
  const [animState, setAnimState] = useState<"idle" | "attack" | "damage">(
    "idle",
  );
  const [bossAnimState, setBossAnimState] = useState<
    "idle" | "attack" | "damage"
  >("idle");
  const [lastDamage, setLastDamage] = useState<{
    amount: number;
    target: "me" | "boss";
    id: number;
    isCrit?: boolean;
  } | null>(null);
  const [critNotice, setCritNotice] = useState<{ id: number } | null>(null);
  const [battagliaItems, setBattagliaItems] = useState<BattagliaItem[]>([]);
  const [curaItems, setCuraItems] = useState<BattagliaItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const [bossFainting, setBossFainting] = useState(false);
  const [playerFainting, setPlayerFainting] = useState(false);
  const [fortuneNotice, setFortuneNotice] = useState<{
    id: number;
    text: string;
    tone: CombatFortuneInfo["tone"];
  } | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    id: number;
    emoji: string;
    text: string;
    color: string;
    glow: string;
  } | null>(null);
  const [finalResult, setFinalResult] = useState<{
    won: boolean;
    reward: any;
    levelUp: any;
  } | null>(null);
  const [bossMissions, setBossMissions] = useState<CompletedMissionInfo[]>([]);
  const [showBossMissions, setShowBossMissions] = useState(false);
  const [attackAnim, setAttackAnim] = useState<{
    key: number;
    element: string;
    rarity: string;
    side: "left" | "right";
    soundUrl?: string | null;
    soundDurationMs?: number | null;
  } | null>(null);

  const addLog = (msg: string) => setLog((prev) => [...prev.slice(-9), msg]);

  function flashFortuneNotice(fortune: CombatFortuneInfo | null | undefined) {
    const text = formatFortuneText(fortune);
    if (!text || !fortune) return;

    const id = Date.now();
    setFortuneNotice({ id, text, tone: fortune.tone });
    setTimeout(async () => {
      setFortuneNotice((current) => (current?.id === id ? null : current));
    }, 1800);
  }

  function flashCritNotice() {
    const id = Date.now();
    setCritNotice({ id });
    setTimeout(() => {
      setCritNotice((current) => (current?.id === id ? null : current));
    }, 1600);
  }

  function flashStatusNotice(effect: StatusEffect, text: string) {
    const meta = STATUS_EFFECT_META[effect];
    if (!meta) return;
    const id = Date.now();
    setStatusNotice({
      id,
      emoji: meta.emoji,
      text,
      color: meta.color,
      glow: meta.glow,
    });
    setTimeout(
      () => setStatusNotice((current) => (current?.id === id ? null : current)),
      2400,
    );
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  function syncActivePlayerPreview(
    activePlayerId: string | undefined,
    nextPlayerLineup: PlayerSlot[] | undefined,
    hpOverride?: number | null,
  ) {
    if (!activePlayerId || !nextPlayerLineup) return;
    const nextSlot = nextPlayerLineup.find(
      (slot) => slot.player_creature_id === activePlayerId,
    );
    if (!nextSlot) return;

    setPlayerLineup((prev) =>
      prev.map((slot) =>
        slot.player_creature_id === activePlayerId
          ? {
              ...slot,
              current_hp: hpOverride ?? nextSlot.current_hp,
              fainted: nextSlot.fainted,
            }
          : slot,
      ),
    );
  }

  function syncActivePlayerStatus(
    activePlayerId: string | undefined,
    nextPlayerLineup: PlayerSlot[] | undefined,
  ) {
    if (!activePlayerId || !nextPlayerLineup) return;
    const nextSlot = nextPlayerLineup.find(
      (slot) => slot.player_creature_id === activePlayerId,
    );
    if (!nextSlot) return;

    setPlayerLineup((prev) =>
      prev.map((slot) =>
        slot.player_creature_id === activePlayerId
          ? {
              ...slot,
              active_status: nextSlot.active_status,
              status_turns_left: nextSlot.status_turns_left,
              fainted: nextSlot.fainted,
            }
          : slot,
      ),
    );
  }

  function syncActiveBossPreview(
    activeBossSlot: number,
    nextBossLineup: BossSlot[] | undefined,
    hpOverride?: number | null,
  ) {
    if (!nextBossLineup) return;
    const nextSlot = nextBossLineup[activeBossSlot];
    if (!nextSlot) return;

    setBossLineup((prev) =>
      prev.map((slot, index) =>
        index === activeBossSlot
          ? {
              ...slot,
              current_hp: hpOverride ?? nextSlot.current_hp,
              fainted: nextSlot.fainted,
            }
          : slot,
      ),
    );
  }

  function syncActiveBossStatus(
    activeBossSlot: number,
    nextBossLineup: BossSlot[] | undefined,
  ) {
    if (!nextBossLineup) return;
    const nextSlot = nextBossLineup[activeBossSlot];
    if (!nextSlot) return;

    setBossLineup((prev) =>
      prev.map((slot, index) =>
        index === activeBossSlot
          ? {
              ...slot,
              active_status: nextSlot.active_status,
              status_turns_left: nextSlot.status_turns_left,
              fainted: nextSlot.fainted,
            }
          : slot,
      ),
    );
  }

  async function presentPlayerTurnStartStatus(options: {
    activePlayerId?: string;
    nextPlayerLineup?: PlayerSlot[];
    preTurnStatusEvent?: Record<string, any> | null;
    statusTickEvents?: Array<Record<string, any>>;
    playerHpBeforeBossAttack?: number | null;
  }) {
    const {
      activePlayerId,
      nextPlayerLineup,
      preTurnStatusEvent,
      statusTickEvents,
      playerHpBeforeBossAttack,
    } = options;
    const playerPoisonTick = statusTickEvents?.find(
      (tick) => tick.target === "player" && tick.type === "veleno",
    ) as Record<string, any> | undefined;

    if (!preTurnStatusEvent && !playerPoisonTick) return;

    syncActivePlayerPreview(
      activePlayerId,
      nextPlayerLineup,
      playerHpBeforeBossAttack,
    );

    if (preTurnStatusEvent?.type === "sonno") {
      const text = preTurnStatusEvent.cleared
        ? "Sonno curato, ma il turno salta"
        : "Sonno — turno saltato";
      flashStatusNotice("sonno", text);
      addLog(`💤 ${text}`);
      await wait(650);
      syncActivePlayerStatus(activePlayerId, nextPlayerLineup);
      return;
    }

    if (preTurnStatusEvent?.type === "paralisi") {
      const skipped = Boolean(preTurnStatusEvent.paralysisSkip);
      const text = skipped
        ? "Paralisi — turno saltato"
        : preTurnStatusEvent.cleared
          ? "Paralisi curata — attacca!"
          : "Paralisi — attacca lo stesso";
      flashStatusNotice("paralisi", text);
      addLog(`⚡ ${text}`);
      await wait(skipped ? 650 : 300);
      syncActivePlayerStatus(activePlayerId, nextPlayerLineup);
      return;
    }

    if (preTurnStatusEvent?.type === "confusione") {
      if (preTurnStatusEvent.selfHit) {
        const damage = Number(preTurnStatusEvent.selfDamage ?? 0);
        const text = preTurnStatusEvent.fainted
          ? "Confusione — si colpisce e sviene!"
          : `Confusione — si colpisce da solo! (${damage} danni)`;
        flashStatusNotice("confusione", text);
        addLog(`💫 ${text}`);
        if (damage > 0) {
          setLastDamage({ amount: damage, target: "me", id: Date.now() });
          setAnimState("damage");
          await wait(900);
          setAnimState("idle");
          setLastDamage(null);
        } else {
          await wait(650);
        }
      } else {
        const text = preTurnStatusEvent.cleared
          ? "Confusione curata — attacca!"
          : "Confusione — resiste e attacca";
        flashStatusNotice("confusione", text);
        addLog(`💫 ${text}`);
        await wait(300);
      }
      syncActivePlayerStatus(activePlayerId, nextPlayerLineup);
      return;
    }

    if (playerPoisonTick) {
      const damage = Number(playerPoisonTick.poisonDamage ?? 0);
      const text = playerPoisonTick.fainted
        ? "Veleno — svieni!"
        : `Veleno — ${damage} danni`;
      flashStatusNotice("veleno", text);
      addLog(`☠️ ${text}`);
      if (damage > 0) {
        setLastDamage({ amount: damage, target: "me", id: Date.now() });
        setAnimState("damage");
        await wait(900);
        setAnimState("idle");
        setLastDamage(null);
      } else {
        await wait(650);
      }
      syncActivePlayerStatus(activePlayerId, nextPlayerLineup);
    }
  }

  async function presentBossTurnStartStatus(options: {
    activeBossSlot: number;
    nextBossLineup?: BossSlot[];
    statusAppliedToBoss?: StatusEffect | null;
    statusTickEvents?: Array<Record<string, any>>;
  }) {
    const {
      activeBossSlot,
      nextBossLineup,
      statusAppliedToBoss,
      statusTickEvents,
    } = options;
    const bossStatusTick = statusTickEvents?.find(
      (tick) => tick.target === "boss",
    ) as Record<string, any> | undefined;

    if (statusAppliedToBoss) {
      const text = `Boss afflitto da ${STATUS_EFFECT_META[statusAppliedToBoss]?.label ?? statusAppliedToBoss}!`;
      flashStatusNotice(statusAppliedToBoss, text);
      addLog(`🎯 ${text}`);
      await wait(350);
    }

    if (!bossStatusTick) {
      syncActiveBossStatus(activeBossSlot, nextBossLineup);
      return;
    }

    const effect = bossStatusTick.type as StatusEffect;
    syncActiveBossPreview(
      activeBossSlot,
      nextBossLineup,
      bossStatusTick.newHp ?? undefined,
    );

    if (effect === "sonno") {
      const text = bossStatusTick.cleared
        ? "Boss si sveglia, ma il turno salta"
        : "Boss addormentato — turno saltato";
      flashStatusNotice(effect, text);
      addLog(`💤 ${text}`);
      await wait(650);
      syncActiveBossStatus(activeBossSlot, nextBossLineup);
      return;
    }

    if (effect === "paralisi") {
      const skipped = Boolean(bossStatusTick.paralysisSkip);
      const text = skipped
        ? "Boss paralizzato — turno saltato"
        : bossStatusTick.cleared
          ? "Boss non è più paralizzato e attacca"
          : "Boss paralizzato, ma attacca lo stesso";
      flashStatusNotice(effect, text);
      addLog(`⚡ ${text}`);
      await wait(skipped ? 650 : 300);
      syncActiveBossStatus(activeBossSlot, nextBossLineup);
      return;
    }

    if (effect === "confusione") {
      if (bossStatusTick.selfHit) {
        const damage = Number(bossStatusTick.selfDamage ?? 0);
        const text = bossStatusTick.fainted
          ? "Boss confuso — si colpisce e sviene!"
          : `Boss confuso — si colpisce da solo! (${damage} danni)`;
        flashStatusNotice(effect, text);
        addLog(`💫 ${text}`);
        if (damage > 0) {
          setLastDamage({ amount: damage, target: "boss", id: Date.now() });
          setBossAnimState("damage");
          await wait(900);
          setBossAnimState("idle");
          setLastDamage(null);
        } else {
          await wait(650);
        }
      } else {
        const text = bossStatusTick.cleared
          ? "Boss non è più confuso e attacca"
          : "Boss confuso, ma riesce ad attaccare";
        flashStatusNotice(effect, text);
        addLog(`💫 ${text}`);
        await wait(300);
      }
      syncActiveBossStatus(activeBossSlot, nextBossLineup);
      return;
    }

    if (effect === "veleno") {
      const damage = Number(bossStatusTick.poisonDamage ?? 0);
      const text = bossStatusTick.fainted
        ? "Boss avvelenato — sviene!"
        : `Boss avvelenato — ${damage} danni`;
      flashStatusNotice(effect, text);
      addLog(`☠️ ${text}`);
      if (damage > 0) {
        setLastDamage({ amount: damage, target: "boss", id: Date.now() });
        setBossAnimState("damage");
        await wait(900);
        setBossAnimState("idle");
        setLastDamage(null);
      } else {
        await wait(650);
      }
      syncActiveBossStatus(activeBossSlot, nextBossLineup);
    }
  }

  useEffect(() => {
    const sessionId = localStorage.getItem("current_session_id");

    async function load() {
      try {
        const [fightRes, user] = await Promise.all([
          fetch(`/api/game/boss/${id}`),
          sessionId ? getCurrentUser(supabase) : Promise.resolve(null),
        ]);
        if (!fightRes.ok) {
          setError("Boss fight non trovato");
          return;
        }
        const { fight: f } = await fightRes.json();
        setFight(f);

        if (f.status === "won" || f.status === "lost") {
          setFinalResult({
            won: f.status === "won",
            reward: f.status === "won" && !f.reward_claimed ? f.reward : null,
            levelUp: null,
          });
          return;
        }

        if (f.status === "active") {
          setBossLineup(f.boss_lineup);
          setPlayerLineup(f.player_lineup);
          setBossActiveSlot(f.boss_active_slot);
          addLog("Battaglia in corso...");
        }

        if (sessionId && user) {
          const [crRes, invRes, lvRes] = await Promise.all([
            supabase
              .from("player_creatures")
              .select(
                "id, creatures(name, element, rarity, hp, atk, def, image_url)",
              )
              .eq("user_id", user.id)
              .eq("session_id", sessionId),
            supabase
              .from("player_inventory")
              .select("id, quantity, items(name, type, effect_value)")
              .eq("user_id", user.id)
              .eq("session_id", sessionId)
              .gt("quantity", 0),
            supabase
              .from("player_sessions")
              .select("level")
              .eq("user_id", user.id)
              .eq("session_id", sessionId)
              .single(),
          ]);
          if (lvRes.data) setPlayerLevel((lvRes.data as any).level ?? 1);

          const RARITY_ORDER = [
            "comune",
            "non_comune",
            "raro",
            "epico",
            "leggendario",
            "mitologico",
          ];
          const mapped: SquadCreature[] = ((crRes.data ?? []) as any[])
            .filter((pc) => pc.creatures)
            .map((pc) => ({
              playerCreatureId: pc.id,
              name: pc.creatures.name,
              element: pc.creatures.element,
              rarity: pc.creatures.rarity,
              hp: pc.creatures.hp,
              atk: pc.creatures.atk,
              def: pc.creatures.def ?? 0,
              image_url: pc.creatures.image_url,
            }))
            .sort(
              (a, b) =>
                RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
            );
          setAllCreatures(mapped);

          // Patch player lineup with image_url from creature data (fixes resumed fights
          // where the JSONB was saved before image_url was added to the API response)
          if (f.status === "active") {
            const imgById: Record<string, string> = {};
            mapped.forEach((c) => {
              if (c.image_url) imgById[c.playerCreatureId] = c.image_url;
            });
            setPlayerLineup((prev: PlayerSlot[]) =>
              prev.map((slot) => ({
                ...slot,
                image_url:
                  slot.image_url || imgById[slot.player_creature_id] || "",
              })),
            );
          }

          const bItems: BattagliaItem[] = ((invRes.data ?? []) as any[])
            .filter(
              (inv) => inv.items?.type === "battaglia" && inv.quantity > 0,
            )
            .map((inv) => ({
              inventoryId: inv.id,
              name: inv.items.name,
              effectValue: inv.items.effect_value,
              quantity: inv.quantity,
            }));
          setBattagliaItems(bItems);
          const cItems: BattagliaItem[] = ((invRes.data ?? []) as any[])
            .filter((inv) => inv.items?.type === "cura" && inv.quantity > 0)
            .map((inv) => ({
              inventoryId: inv.id,
              name: inv.items.name,
              effectValue: inv.items.effect_value,
              quantity: inv.quantity,
            }));
          setCuraItems(cItems);
        }
      } finally {
        setLoadingCreatures(false);
        setLoading(false);
      }
    }

    load();
  }, [id, supabase]);

  function toggleCreature(c: SquadCreature) {
    setLineup((prev) => {
      const idx = prev.findIndex(
        (l) => l?.playerCreatureId === c.playerCreatureId,
      );
      if (idx !== -1) {
        const next = prev.filter((_, i) => i !== idx);
        return [...next, null] as (SquadCreature | null)[];
      }
      const emptyIdx = prev.findIndex((l) => l === null);
      if (emptyIdx === -1) return prev;
      const next = [...prev];
      next[emptyIdx] = c;
      return next;
    });
  }

  function removeSlot(i: number) {
    setLineup((prev) => {
      const next = prev.filter((_, j) => j !== i);
      return [...next, null] as (SquadCreature | null)[];
    });
  }

  async function confirmLineup() {
    const filled = lineup.filter(Boolean) as SquadCreature[];
    if (filled.length < 1) return;
    setStarting(true);
    const res = await fetch(`/api/game/boss/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        lineup: filled.map((c, i) => ({
          playerCreatureId: c.playerCreatureId,
          slot: i,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showActionError(res.status, data.error ?? "Errore avvio");
      setStarting(false);
      return;
    }

    setBossLineup(data.bossLineup);
    setPlayerLineup(data.playerLineup);
    setBossActiveSlot(0);
    setFight((prev: any) => ({ ...prev, status: "active" }));
    addLog("La battaglia contro il Capo Palestra è iniziata!");
    setStarting(false);
  }

  async function handleAttack() {
    if (attackingRef.current) return;
    attackingRef.current = true;
    setAttacking(true);
    const actingPlayerNow = playerLineup.find(
      (c: PlayerSlot) => c.is_active && !c.fainted,
    );
    const isSleepingTurn = actingPlayerNow?.active_status === "sonno";
    const statusMayChangeAttack =
      actingPlayerNow?.active_status === "paralisi" ||
      actingPlayerNow?.active_status === "confusione" ||
      actingPlayerNow?.active_status === "veleno";
    const usedItemId = isSleepingTurn ? null : selectedItemId;
    if (!isSleepingTurn && !statusMayChangeAttack) {
      setAnimState("attack");
      setTimeout(() => setAnimState("idle"), 300);
    }
    if (!isSleepingTurn && !statusMayChangeAttack && actingPlayerNow) {
      setAttackAnim({
        key: Date.now(),
        element: actingPlayerNow.element,
        rarity: actingPlayerNow.rarity,
        side: "left",
        soundUrl: actingPlayerNow.attack_sound_url,
        soundDurationMs: actingPlayerNow.attack_sound_duration_ms,
      });
    }

    const res = await fetch(`/api/game/boss/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "attack",
        itemId: usedItemId || undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showActionError(res.status, data.error ?? "Errore attacco");
      attackingRef.current = false;
      setAttacking(false);
      return;
    }

    if (usedItemId && data.playerDamage > 0) {
      setBattagliaItems((prev) =>
        prev
          .map((item) =>
            item.inventoryId === usedItemId
              ? { ...item, quantity: item.quantity - 1 }
              : item,
          )
          .filter((item) => item.quantity > 0),
      );
      setSelectedItemId(null);
    }

    const nextBossLineup = data.bossLineup as BossSlot[];
    const nextPlayerLineup = data.playerLineup as PlayerSlot[];
    const actingPlayer =
      playerLineup.find((c: PlayerSlot) => c.is_active && !c.fainted) ??
      nextPlayerLineup.find((c: PlayerSlot) => c.is_active);
    const playerActionPrevented = Boolean(
      data.preTurnStatusEvent?.turnPassed ||
      data.preTurnStatusEvent?.selfHit ||
      data.preTurnStatusEvent?.paralysisSkip,
    );

    const isOver = data.status === "won" || data.status === "lost";
    const bossCreatureFainted =
      nextBossLineup[bossActiveSlot]?.fainted === true;

    await presentPlayerTurnStartStatus({
      activePlayerId: actingPlayerNow?.player_creature_id,
      nextPlayerLineup,
      preTurnStatusEvent: data.preTurnStatusEvent ?? null,
      statusTickEvents: data.statusTickEvents as
        | Array<Record<string, any>>
        | undefined,
      playerHpBeforeBossAttack: data.playerHpBeforeBossAttack ?? null,
    });

    if (statusMayChangeAttack && data.playerDamage > 0 && actingPlayerNow) {
      setAnimState("attack");
      setTimeout(() => setAnimState("idle"), 300);
      setAttackAnim({
        key: Date.now(),
        element: actingPlayerNow.element,
        rarity: actingPlayerNow.rarity,
        side: "left",
        soundUrl: actingPlayerNow.attack_sound_url,
        soundDurationMs: actingPlayerNow.attack_sound_duration_ms,
      });
    }

    if (data.playerDamage > 0) {
      const playerFortuneText = formatFortuneText(
        data.playerFortune as CombatFortuneInfo | undefined,
      );
      const playerCritLabel = data.playerCrit ? " · ⚡ CRITICO! ×1.75" : "";
      addLog(
        `${actingPlayer?.name ?? "Tu"} colpisce per ${data.playerDamage} danni${playerCritLabel}${playerFortuneText && !data.playerCrit ? ` · ${playerFortuneText}` : ""}!`,
      );
      if (data.playerCrit) flashCritNotice();
      else
        flashFortuneNotice(data.playerFortune as CombatFortuneInfo | undefined);
    }

    if (data.playerDamage <= 0) {
      setLog((prev) =>
        prev.filter((msg) => !msg.includes("colpisce per 0 danni")).slice(-9),
      );
    }

    // Status effects before attack
    if (false && data.preTurnStatusEvent) {
      const se = data.preTurnStatusEvent;
      const effect = se.type as StatusEffect;
      if (se.turnPassed)
        flashStatusNotice(
          effect,
          `${STATUS_EFFECT_META[effect]?.label ?? effect} — turno saltato`,
        );
      else if (se.selfHit)
        flashStatusNotice(effect, `Confusione — colpisce se stesso!`);
    }
    if (false && data.statusTickEvents?.length) {
      for (const tick of data.statusTickEvents as any[]) {
        const effect = tick.type as StatusEffect;
        if (tick.target === "boss")
          flashStatusNotice(
            effect,
            `${STATUS_EFFECT_META[effect]?.label ?? effect} — ${tick.poisonDamage ?? ""} danno al Boss`,
          );
        if (tick.target === "player")
          flashStatusNotice(
            effect,
            `${STATUS_EFFECT_META[effect]?.label ?? effect} — ${tick.poisonDamage ?? ""} danno a te`,
          );
      }
    }
    const playerTookPreTurnStatusDamage =
      Boolean(data.preTurnStatusEvent?.selfHit) ||
      Boolean(
        (data.statusTickEvents as Array<{ target?: string }> | undefined)?.some(
          (tick) => tick.target === "player",
        ),
      );
    if (
      false &&
      playerTookPreTurnStatusDamage &&
      data.playerHpBeforeBossAttack != null
    ) {
      setPlayerLineup((prev) =>
        prev.map((slot) =>
          slot.is_active
            ? { ...slot, current_hp: data.playerHpBeforeBossAttack }
            : slot,
        ),
      );
    }

    // Phase 1: show damage on boss (update HP bar only, don't switch yet)
    if (data.playerDamage > 0) {
      setBossLineup((prev) =>
        prev.map((slot, i) =>
          i === bossActiveSlot
            ? {
                ...slot,
                current_hp: nextBossLineup[i]?.current_hp ?? slot.current_hp,
              }
            : slot,
        ),
      );
      setLastDamage({
        amount: data.playerDamage,
        target: "boss",
        id: Date.now(),
        isCrit: !!data.playerCrit,
      });
      setBossAnimState("damage");
    } else {
      setBossLineup(nextBossLineup);
    }

    setTimeout(
      async () => {
        setBossAnimState("idle");
        setLastDamage(null);
        await presentBossTurnStartStatus({
          activeBossSlot: bossActiveSlot,
          nextBossLineup,
          statusAppliedToBoss:
            (data.statusAppliedToBoss as StatusEffect | null | undefined) ??
            null,
          statusTickEvents: data.statusTickEvents as
            | Array<Record<string, any>>
            | undefined,
        });

        // Show status applied to boss RIGHT HERE — before counter-attack, not after
        if (false && data.statusAppliedToBoss) {
          const effect = data.statusAppliedToBoss as StatusEffect;
          flashStatusNotice(
            effect,
            `Boss afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`,
          );
        }

        if (bossCreatureFainted) {
          // Boss creature fainted — show faint animation, then switch
          playKnockout();
          setBossFainting(true);
          setTimeout(() => {
            setBossFainting(false);
            setBossLineup(nextBossLineup);
            const newBossSlot = nextBossLineup.findIndex(
              (c: BossSlot) => !c.fainted,
            );
            setBossActiveSlot(newBossSlot === -1 ? 0 : newBossSlot);
            setPlayerLineup(nextPlayerLineup);
            if (data.bossSwitchedTo) {
              setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`);
              setTimeout(() => setSwitchNotice(null), 2000);
            }
            if (isOver) {
              window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
              if (data.levelUp)
                window.dispatchEvent(
                  new CustomEvent("wc:level-up", { detail: data.levelUp }),
                );
              if (data.completedMissions?.length)
                setBossMissions(data.completedMissions);
              if (data.won) playVictory();
              else playDefeat();
              setTimeout(
                () =>
                  setFinalResult({
                    won: data.won,
                    reward: data.reward,
                    levelUp: data.levelUp,
                  }),
                400,
              );
            }
            attackingRef.current = false;
            setAttacking(false);
          }, 1000);
        } else if (data.bossDamage > 0) {
          // Phase 2: boss counter-attacks
          setBossAttacking(true);
          const counterBoss = nextBossLineup[bossActiveSlot];
          if (counterBoss) {
            setAttackAnim({
              key: Date.now() + 1,
              element: counterBoss.element,
              rarity: "leggendario",
              side: "right",
            });
          }
          setTimeout(() => {
            setBossAttacking(false);
            // Update player HP bar before damage animation
            setPlayerLineup((prev) =>
              prev.map((slot) =>
                slot.is_active
                  ? { ...slot, current_hp: data.newPlayerHp }
                  : slot,
              ),
            );
            setLastDamage({
              amount: data.bossDamage,
              target: "me",
              id: Date.now(),
              isCrit: !!data.bossCrit,
            });
            setAnimState("damage");
            const bossFortuneText = formatFortuneText(
              data.bossFortune as CombatFortuneInfo | undefined,
            );
            const bossCritLabel = data.bossCrit ? " · ⚡ CRITICO! ×1.75" : "";
            addLog(
              `Il Capo Palestra risponde con ${data.bossDamage} danni${bossCritLabel}${bossFortuneText && !data.bossCrit ? ` · ${bossFortuneText}` : ""}!`,
            );
            if (data.bossCrit) flashCritNotice();
            else
              flashFortuneNotice(
                data.bossFortune as CombatFortuneInfo | undefined,
              );

            if (data.bossSwitchedTo) {
              setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`);
              setTimeout(() => setSwitchNotice(null), 2000);
            }

            // Detect if player creature fainted from boss counter-attack
            const currentActivePlayer = playerLineup.find(
              (c) => c.is_active && !c.fainted,
            );
            const playerCreatureFainted =
              currentActivePlayer != null &&
              nextPlayerLineup.find(
                (c) =>
                  c.player_creature_id ===
                  currentActivePlayer.player_creature_id,
              )?.fainted === true;

            if (playerCreatureFainted) {
              setTimeout(() => {
                setAnimState("idle");
                setLastDamage(null);
                playKnockout();
                setPlayerFainting(true);
                setTimeout(() => {
                  setPlayerFainting(false);
                  setPlayerLineup(nextPlayerLineup);
                  setBossLineup(nextBossLineup);
                  if (data.statusAppliedToPlayer) {
                    const effect = data.statusAppliedToPlayer as StatusEffect;
                    setTimeout(
                      () =>
                        flashStatusNotice(
                          effect,
                          `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`,
                        ),
                      600,
                    );
                  }
                  if (data.playerSwitchedTo) {
                    setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
                    setTimeout(() => setSwitchNotice(null), 2000);
                  }
                  if (isOver) {
                    if (data.won) playVictory(); else playDefeat();
                    window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
                    if (data.levelUp)
                      window.dispatchEvent(
                        new CustomEvent("wc:level-up", {
                          detail: data.levelUp,
                        }),
                      );
                    if (data.completedMissions?.length)
                      setBossMissions(data.completedMissions);
                    setTimeout(
                      () =>
                        setFinalResult({
                          won: data.won,
                          reward: data.reward,
                          levelUp: data.levelUp,
                        }),
                      400,
                    );
                  }
                  attackingRef.current = false;
                  setAttacking(false);
                }, 1000);
              }, 900);
            } else {
              setTimeout(() => {
                setPlayerLineup(nextPlayerLineup);
                setBossLineup(nextBossLineup);
                setAnimState("idle");
                setLastDamage(null);
                if (data.statusAppliedToPlayer) {
                  const effect = data.statusAppliedToPlayer as StatusEffect;
                  setTimeout(
                    () =>
                      flashStatusNotice(
                        effect,
                        `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`,
                      ),
                    600,
                  );
                }
                if (data.playerSwitchedTo) {
                  setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
                  setTimeout(() => setSwitchNotice(null), 2000);
                }
                if (isOver) {
                  if (data.won) playVictory(); else playDefeat();
                  window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
                  if (data.levelUp)
                    window.dispatchEvent(
                      new CustomEvent("wc:level-up", { detail: data.levelUp }),
                    );
                  if (data.completedMissions?.length)
                    setBossMissions(data.completedMissions);
                  setTimeout(
                    () =>
                      setFinalResult({
                        won: data.won,
                        reward: data.reward,
                        levelUp: data.levelUp,
                      }),
                    400,
                  );
                }
                attackingRef.current = false;
                setAttacking(false);
              }, 900);
            }
          }, 1100);
        } else {
          // No counter-attack, boss alive (edge case: 0 damage)
          setBossLineup(nextBossLineup);
          const newBossSlot = nextBossLineup.findIndex(
            (c: BossSlot) => !c.fainted,
          );
          setBossActiveSlot(newBossSlot === -1 ? 0 : newBossSlot);
          setPlayerLineup(nextPlayerLineup);
          if (data.bossSwitchedTo) {
            setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`);
            setTimeout(() => setSwitchNotice(null), 2000);
          }
          if (data.statusAppliedToPlayer) {
            const effect = data.statusAppliedToPlayer as StatusEffect;
            setTimeout(
              () =>
                flashStatusNotice(
                  effect,
                  `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`,
                ),
              800,
            );
          }
          if (isOver) {
            window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
            if (data.levelUp)
              window.dispatchEvent(
                new CustomEvent("wc:level-up", { detail: data.levelUp }),
              );
            if (data.completedMissions?.length)
              setBossMissions(data.completedMissions);
            setTimeout(
              () =>
                setFinalResult({
                  won: data.won,
                  reward: data.reward,
                  levelUp: data.levelUp,
                }),
              400,
            );
          }
          attackingRef.current = false;
          setAttacking(false);
        }
      },
      data.playerDamage > 0 ? 900 : playerActionPrevented ? 150 : 250,
    );
  }

  async function handleHeal(itemId: string) {
    if (attackingRef.current) return;
    attackingRef.current = true;
    setAttacking(true);

    const res = await fetch(`/api/game/boss/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "heal", itemId }),
    });
    const data = await res.json();

    if (!res.ok) {
      showActionError(res.status, data.error ?? "Errore cura");
      attackingRef.current = false;
      setAttacking(false);
      return;
    }

    if (data.healed) {
      setCuraItems((prev) =>
        prev
          .map((it) =>
            it.inventoryId === itemId
              ? { ...it, quantity: it.quantity - 1 }
              : it,
          )
          .filter((it) => it.quantity > 0),
      );
    }

    const nextPlayerLineup = data.playerLineup as PlayerSlot[] | undefined;
    const nextBossLineup = data.bossLineup as BossSlot[] | undefined;
    const isOver = data.status === "won" || data.status === "lost";
    const actingPlayer =
      playerLineup.find((c: PlayerSlot) => c.is_active && !c.fainted) ??
      nextPlayerLineup?.find((c: PlayerSlot) => c.is_active);

    await presentPlayerTurnStartStatus({
      activePlayerId: actingPlayer?.player_creature_id,
      nextPlayerLineup,
      preTurnStatusEvent: data.preTurnStatusEvent ?? null,
      statusTickEvents: data.statusTickEvents as
        | Array<Record<string, any>>
        | undefined,
      playerHpBeforeBossAttack: data.playerHpBeforeBossAttack ?? null,
    });

    if (data.playerHpBeforeBossAttack != null) {
      syncActivePlayerPreview(
        actingPlayer?.player_creature_id,
        nextPlayerLineup,
        data.playerHpBeforeBossAttack,
      );
    }

    if (data.healedHp != null) {
      addLog(`Cura +${data.healAmount} HP`);
      await wait(250);
    }

    await presentBossTurnStartStatus({
      activeBossSlot: bossActiveSlot,
      nextBossLineup,
      statusTickEvents: data.statusTickEvents as
        | Array<Record<string, any>>
        | undefined,
    });

    if (false && data.preTurnStatusEvent) {
      const se = data.preTurnStatusEvent;
      const effect = se.type as StatusEffect;
      if (se.turnPassed)
        flashStatusNotice(
          effect,
          `${STATUS_EFFECT_META[effect]?.label ?? effect} — turno saltato`,
        );
      else if (se.selfHit)
        flashStatusNotice(effect, `Confusione — colpisce se stesso!`);
    }
    if (false && data.statusTickEvents?.length) {
      for (const tick of data.statusTickEvents as any[]) {
        const effect = tick.type as StatusEffect;
        if (tick.target === "boss")
          flashStatusNotice(
            effect,
            `${STATUS_EFFECT_META[effect]?.label ?? effect} — ${tick.poisonDamage ?? ""} danno al Boss`,
          );
        if (tick.target === "player")
          flashStatusNotice(
            effect,
            `${STATUS_EFFECT_META[effect]?.label ?? effect} — ${tick.poisonDamage ?? ""} danno a te`,
          );
      }
    }

    if (false && data.playerHpBeforeBossAttack != null) {
      setPlayerLineup((prev) =>
        prev.map((slot) =>
          slot.is_active
            ? { ...slot, current_hp: data.playerHpBeforeBossAttack }
            : slot,
        ),
      );
    }

    if (false && data.healedHp != null) {
      addLog(`💚 Cura +${data.healAmount} HP`);
    }

    // Boss counter-attack animation
    if (
      data.bossDamage > 0 &&
      data.newPlayerHp != null &&
      nextPlayerLineup &&
      nextBossLineup
    ) {
      setBossAttacking(true);
      setTimeout(() => {
        setBossAttacking(false);
        setPlayerLineup(nextPlayerLineup);
        setBossLineup(nextBossLineup);
        setLastDamage({
          amount: data.bossDamage,
          target: "me",
          id: Date.now(),
          isCrit: !!data.bossCrit,
        });
        setAnimState("damage");
        addLog(`Il Capo Palestra risponde con ${data.bossDamage} danni!`);
        if (data.bossSwitchedTo) {
          setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`);
          setTimeout(() => setSwitchNotice(null), 2000);
        }
        if (data.statusAppliedToPlayer) {
          const effect = data.statusAppliedToPlayer as StatusEffect;
          setTimeout(
            () =>
              flashStatusNotice(
                effect,
                `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`,
              ),
            450,
          );
        }
        if (data.playerSwitchedTo) {
          setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
          setTimeout(() => setSwitchNotice(null), 2000);
        }
        setTimeout(() => {
          setAnimState("idle");
          setLastDamage(null);
          if (isOver) {
            if (data.won) playVictory();
            else playDefeat();
            setTimeout(
              () =>
                setFinalResult({ won: data.won, reward: null, levelUp: null }),
              400,
            );
          }
          attackingRef.current = false;
          setAttacking(false);
        }, 900);
      }, 250);
    } else {
      if (nextPlayerLineup) setPlayerLineup(nextPlayerLineup);
      if (nextBossLineup) setBossLineup(nextBossLineup);
      if (data.bossSwitchedTo) {
        setSwitchNotice(`${data.bossSwitchedTo} entra in battaglia!`);
        setTimeout(() => setSwitchNotice(null), 2000);
      }
      if (data.playerSwitchedTo) {
        setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
        setTimeout(() => setSwitchNotice(null), 2000);
      }
      if (data.statusAppliedToPlayer) {
        const effect = data.statusAppliedToPlayer as StatusEffect;
        setTimeout(
          () =>
            flashStatusNotice(
              effect,
              `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`,
            ),
          450,
        );
      }
      if (isOver) {
        if (data.won) playVictory();
        else playDefeat();
        setTimeout(
          () =>
            setFinalResult({
              won: data.won,
              reward: data.reward ?? null,
              levelUp: data.levelUp ?? null,
            }),
          400,
        );
      }
      attackingRef.current = false;
      setAttacking(false);
    }
  }

  async function handleSurrender() {
    await fetch(`/api/game/boss/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "surrender" }),
    });
    router.replace("/game/missions");
  }

  async function handleSwitch(targetPlayerCreatureId: string) {
    if (attackingRef.current) return;
    attackingRef.current = true;
    setAttacking(true);

    const res = await fetch(`/api/game/boss/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", targetPlayerCreatureId }),
    });
    const data = await res.json();

    if (!res.ok) {
      showActionError(res.status, data.error ?? "Errore cambio");
      attackingRef.current = false;
      setAttacking(false);
      return;
    }

    const nextPlayerLineup = data.playerLineup as PlayerSlot[];
    const nextBossLineup = data.bossLineup as BossSlot[];
    const isOver = data.status === "won" || data.status === "lost";

    if (data.bossDamage > 0) {
      setBossAttacking(true);
      const counterBoss = nextBossLineup[bossActiveSlot];
      if (counterBoss) {
        setAttackAnim({ key: Date.now(), element: counterBoss.element, rarity: "leggendario", side: "right" });
      }
      addLog(`↻ Cambio creatura! Il Capo Palestra contrattacca per ${data.bossDamage} danni!`);
      setTimeout(() => {
        setBossAttacking(false);
        setPlayerLineup((prev) => prev.map((slot) =>
          slot.is_active ? { ...slot, current_hp: data.newPlayerHp } : slot,
        ));
        setLastDamage({ amount: data.bossDamage, target: "me", id: Date.now() });
        setAnimState("damage");

        const swTarget = nextPlayerLineup.find((c) => c.player_creature_id === targetPlayerCreatureId);
        const playerFainted = swTarget?.fainted === true;

        if (playerFainted) {
          setTimeout(() => {
            setAnimState("idle");
            setLastDamage(null);
            playKnockout();
            setPlayerFainting(true);
            setTimeout(() => {
              setPlayerFainting(false);
              setPlayerLineup(nextPlayerLineup);
              setBossLineup(nextBossLineup);
              if (data.statusAppliedToPlayer) {
                const effect = data.statusAppliedToPlayer as StatusEffect;
                setTimeout(() => flashStatusNotice(effect, `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`), 600);
              }
              if (data.playerSwitchedTo) {
                setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
                setTimeout(() => setSwitchNotice(null), 2000);
              }
              if (isOver) {
                window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
                if (data.lost) playDefeat();
                setTimeout(() => setFinalResult({ won: false, reward: null, levelUp: null }), 400);
              }
              attackingRef.current = false;
              setAttacking(false);
            }, 1000);
          }, 900);
        } else {
          setTimeout(() => {
            setPlayerLineup(nextPlayerLineup);
            setBossLineup(nextBossLineup);
            setAnimState("idle");
            setLastDamage(null);
            if (data.statusAppliedToPlayer) {
              const effect = data.statusAppliedToPlayer as StatusEffect;
              setTimeout(() => flashStatusNotice(effect, `Sei afflitto da ${STATUS_EFFECT_META[effect]?.label ?? effect}!`), 600);
            }
            if (data.playerSwitchedTo) {
              setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
              setTimeout(() => setSwitchNotice(null), 2000);
            }
            if (isOver) {
              window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
              if (data.lost) playDefeat();
              setTimeout(() => setFinalResult({ won: false, reward: null, levelUp: null }), 400);
            }
            attackingRef.current = false;
            setAttacking(false);
          }, 900);
        }
      }, 1100);
    } else {
      addLog("↻ Hai cambiato creatura!");
      setPlayerLineup(nextPlayerLineup);
      setBossLineup(nextBossLineup);
      if (data.playerSwitchedTo) {
        setSwitchNotice(`${data.playerSwitchedTo} entra in campo!`);
        setTimeout(() => setSwitchNotice(null), 2000);
      }
      if (isOver) {
        window.dispatchEvent(new CustomEvent("wc:refresh-stats"));
        if (data.lost) playDefeat();
        setTimeout(() => setFinalResult({ won: false, reward: null, levelUp: null }), 400);
      }
      attackingRef.current = false;
      setAttacking(false);
    }
  }

  if (loading) {
    return (
      <GameBattleSkeleton
        background={BOSS_THEME.bg}
        accent="rgba(247,200,65,0.16)"
      />
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4 px-6"
        style={{ background: BOSS_THEME.bg }}
      >
        <span className="text-4xl">❌</span>
        <p className="text-red-400 text-center">{error}</p>
        <button
          onClick={() => router.back()}
          className="text-[#3A9DBC] underline text-sm"
        >
          Torna indietro
        </button>
      </div>
    );
  }

  if (finalResult) {
    return (
      <div className="h-full relative" style={{ background: BOSS_THEME.bg }}>
        {showBossMissions && bossMissions.length > 0 && (
          <MissionRewardModal
            missions={bossMissions}
            onDone={() => {
              setShowBossMissions(false);
              router.replace("/game/missions");
            }}
          />
        )}
        <ResultScreen
          won={finalResult.won}
          reward={finalResult.reward}
          levelUp={finalResult.levelUp}
          ctaLabel={
            finalResult.won && bossMissions.length > 0
              ? "Vedi ricompense"
              : undefined
          }
          onExit={() => {
            if (finalResult.won && bossMissions.length > 0) {
              setShowBossMissions(true);
            } else {
              router.replace("/game/missions");
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="h-full text-white flex flex-col overflow-hidden relative"
      style={{ background: BOSS_THEME.bg }}
    >
      {/* Action toast — always on top during combat */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={actionToast} onDismiss={dismissActionToast} />
        </div>
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 z-10 relative"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button onClick={() => router.back()} className="text-white/40 text-sm">
          ← Indietro
        </button>
        <span
          className="text-sm font-bold"
          style={{ color: "rgba(247,200,65,0.7)" }}
        >
          💀 Capo Palestra
        </span>
        {fight?.status === "active" && (
          <button onClick={handleSurrender} className="text-red-400/50 text-xs">
            Arrenditi
          </button>
        )}
        {fight?.status !== "active" && <span className="w-16" />}
      </div>

      {fight?.status === "selecting" || fight?.status === undefined ? (
        loadingCreatures ? (
          <div className="flex-1 overflow-hidden">
            <SquadSelectorSkeleton />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <SquadSelector
              creatures={allCreatures}
              lineup={lineup}
              onToggle={toggleCreature}
              onRemoveSlot={removeSlot}
              onConfirm={confirmLineup}
              bossName={fight?.boss_lineup?.[0]?.name ?? "Boss"}
              bossLineup={fight?.boss_lineup ?? []}
              starting={starting}
              playerLevel={playerLevel}
            />
          </div>
        )
      ) : (
        <div className="flex-1 overflow-hidden relative">
          <BattleScreen
            bossLineup={bossLineup}
            playerLineup={playerLineup}
            bossActiveSlot={bossActiveSlot}
            onAttack={handleAttack}
            attacking={attacking}
            bossAttacking={bossAttacking}
            log={log}
            animState={animState}
            bossAnimState={bossAnimState}
            lastDamage={lastDamage}
            battagliaItems={battagliaItems}
            curaItems={curaItems}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onHeal={handleHeal}
            onSwitch={handleSwitch}
            switchNotice={switchNotice}
            fortuneNotice={fortuneNotice}
            critNotice={critNotice}
            statusNotice={statusNotice}
            bossFainting={bossFainting}
            playerFainting={playerFainting}
            attackAnim={attackAnim}
            onAttackAnimComplete={() => setAttackAnim(null)}
          />
        </div>
      )}
    </div>
  );
}
