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
import TutorialElementsModal from "@/components/game/TutorialElementsModal";
import { TUTORIAL_SESSION_ID } from "@/lib/game/tutorial";
import { ELEMENT_EMOJI, RARITY_COLORS, RARITY_LABELS } from "@/lib/types";
import type { Element, Rarity } from "@/lib/types";
import { playBossSound } from "@/lib/game/battle-sounds";
import { startBossLoop } from "@/lib/game/sounds/battle-loop";
import {
  playKnockout,
  playVictory,
  playDefeat,
} from "@/lib/game/sounds/events";
import { playHeal } from "@/lib/game/sounds/ui";
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
import SquadSelector, { SquadSelectorSkeleton } from "@/components/game/boss/SquadSelector";
import ResultScreen from "@/components/game/boss/ResultScreen";
import BattleScreen from "@/components/game/boss/BattleScreen";

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export default function BossFightPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useWakeLock(true);

  const [fight, setFight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // load-time errors (full-page screen)
  // Tutorial-only "elements lesson" modal — shown once per device the
  // first time the player enters a boss fight in the tutorial session.
  const [showElementsLesson, setShowElementsLesson] = useState(false);
  useEffect(() => {
    if (!fight) return;
    if (fight.session_id !== TUTORIAL_SESSION_ID) return;
    try {
      if (!localStorage.getItem("wc:tutorial-elements-seen")) {
        setShowElementsLesson(true);
      }
    } catch {
      /* noop */
    }
  }, [fight]);

  // Pre-fight mission rewards parked by the map page when the player
  // scanned the boss QR. The QR-scan mission (e.g. M6 "Sfida il Capo")
  // completes server-side at scan time, but showing its reward modal
  // before the fight would flash on the screen during navigation AND
  // would be narratively wrong (player hasn't won yet). We prepend
  // these to the post-victory mission queue so the player sees them
  // alongside the "you won" rewards.
  const [pendingPreMissions, setPendingPreMissions] = useState<CompletedMissionInfo[]>([]);
  useEffect(() => {
    if (!id) return;
    try {
      const raw = sessionStorage.getItem(`wc:pending-boss-rewards:${id}`);
      if (raw) {
        sessionStorage.removeItem(`wc:pending-boss-rewards:${id}`);
        const parsed = JSON.parse(raw) as CompletedMissionInfo[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPendingPreMissions(parsed);
        }
      }
    } catch {
      /* noop */
    }
  }, [id]);
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
    haptics.tap();
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
              if (data.won) { playVictory(); haptics.victory(); }
              else { playDefeat(); haptics.defeat(); }
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
                    if (data.won) { playVictory(); haptics.victory(); } else { playDefeat(); haptics.defeat(); }
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
                  if (data.won) { playVictory(); haptics.victory(); } else { playDefeat(); haptics.defeat(); }
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
    haptics.tap();
    playHeal();
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
            if (data.won) { playVictory(); haptics.victory(); }
            else { playDefeat(); haptics.defeat(); }
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
        if (data.won) { playVictory(); haptics.victory(); }
        else { playDefeat(); haptics.defeat(); }
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
    haptics.tap();
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
                if (data.lost) playDefeat(); haptics.defeat();
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
              if (data.lost) playDefeat(); haptics.defeat();
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
        if (data.lost) playDefeat(); haptics.defeat();
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
    // Combine pre-fight (QR-scan) mission rewards with post-victory ones
    // so the player sees the boss-QR-scan frammento alongside any boss-win
    // mission completion. Empty arrays drop out cleanly.
    const allMissions = finalResult.won
      ? [...pendingPreMissions, ...bossMissions]
      : bossMissions
    return (
      <div className="h-full relative" style={{ background: BOSS_THEME.bg }}>
        {showBossMissions && allMissions.length > 0 && (
          <MissionRewardModal
            missions={allMissions}
            onDone={() => {
              setShowBossMissions(false);
              setPendingPreMissions([]);
              router.replace("/game/missions");
            }}
          />
        )}
        <ResultScreen
          won={finalResult.won}
          reward={finalResult.reward}
          levelUp={finalResult.levelUp}
          ctaLabel={
            finalResult.won && allMissions.length > 0
              ? "Vedi ricompense"
              : undefined
          }
          onExit={() => {
            if (finalResult.won && allMissions.length > 0) {
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

      {/* Tutorial-only: one-time element/duel lesson overlay */}
      <TutorialElementsModal
        open={showElementsLesson}
        onClose={() => {
          setShowElementsLesson(false);
          try { localStorage.setItem("wc:tutorial-elements-seen", "1"); } catch { /* noop */ }
        }}
      />
    </div>
  );
}
