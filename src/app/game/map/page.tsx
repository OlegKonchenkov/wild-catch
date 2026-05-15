'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { useWakeLock } from '@/hooks/useWakeLock'
import { haptics } from '@/lib/haptics'
import { useGPS } from '@/hooks/useGPS'
import { evaluateStep, updatePendingDistance } from '@/lib/game/step-counter'
import { haversineDistance } from '@/lib/game/anti-cheat'
import useTweenedInteger from '@/hooks/useTweenedInteger'
import { logSessionErrorClient } from '@/lib/logSessionErrorClient'
import CreatureSprite from '@/components/creature/CreatureSprite'
import EggHatchModal from '@/components/game/EggHatchModal'
import Coachmark, { type CoachmarkStep } from '@/components/game/Coachmark'
import NextObjectiveWidget from '@/components/game/NextObjectiveWidget'
import {
  TUTORIAL_SESSION_ID,
  TUTORIAL_BONUS_SUGGERIMENTO_ID,
  TUTORIAL_PIN_OFFSET_M,
  TUTORIAL_PIN_CLAIM_RADIUS_M,
  TUTORIAL_M7_MISSION_ID,
  TUTORIAL_MISSION_MOMENTS,
  isTutorialQrTarget,
  tutorialQrButtonLabel,
  tutorialPinBearingForUser,
  offsetGpsPoint,
} from '@/lib/game/tutorial'
import type { TutorialMoment } from '@/lib/game/tutorial'
import StarterSelect, { type StarterCreature } from '@/components/game/StarterSelect'
import PinRewardModal, { type PinRewardData } from '@/components/game/PinRewardModal'
import EnigmaModal from '@/components/game/EnigmaModal'
import BossApproachModal from '@/components/game/BossApproachModal'
import { GameMapSkeleton } from '@/components/game/GameLoading'
import MissionRewardModal from '@/components/game/MissionRewardModal'
import type { CompletedMissionInfo } from '@/components/game/MissionRewardModal'
import TutorialMomentModal, { hasSeenTutorialMoment } from '@/components/game/TutorialMomentModal'
import TutorialPinClaimModal from '@/components/game/TutorialPinClaimModal'
import type { Session } from '@/lib/types'
import { RARITY_LABELS } from '@/lib/types'
import type { MapPin } from '@/components/map/GameMap'
import { startMapAmbience, duckMapAmbience, unduckMapAmbience } from '@/lib/game/sounds/map-loop'
import { registerAmbienceDucking } from '@/lib/game/sounds/shared-ac'
import { playEggHatch } from '@/lib/game/sounds/hatch'
import { playEnigmaSolve } from '@/lib/game/sounds/enigma'
import { playEncounterSound } from '@/lib/game/battle-sounds'
import { playMissionComplete } from '@/lib/game/sounds/events'
import { playQrScan, playPinClaim } from '@/lib/game/sounds/ui'
import { track } from '@/lib/analytics'

// Dynamic import — Leaflet is not SSR-safe
const GameMap = dynamic(() => import('@/components/map/GameMap'), { ssr: false })

// First-run coachmarks shown on the map after a player completes the
// onboarding carousel + starter pick. Persisted per-device in localStorage
// (UI hints, not part of the game state — different devices = different
// learning moments, and that's fine).
// Bump this version when you change the steps in a way that justifies
// re-showing the walkthrough — older devices will be considered "unseen".
const COACHMARK_STORAGE_KEY = 'wc:coachmarks:map-seen:v2'
const MAP_COACHMARK_STEPS: CoachmarkStep[] = [
  { key: 'map-area',      title: 'La tua mappa', body: 'Questo è il tuo territorio di caccia. Cammina con il cellulare e le creature appariranno vicino a te.' },
  { key: 'step-counter',  title: 'Contapassi',   body: 'I metri percorsi si accumulano qui. Molte missioni si completano camminando.', preferredSide: 'bottom' },
  { key: 'nav-bestiary',  title: 'DaimonDex',    body: 'Tutte le creature che hai scoperto e catturato. Più completi la collezione, più sale la tua fama.', preferredSide: 'top' },
  { key: 'nav-duelli',    title: 'Duelli',       body: 'Sfida altri giocatori della sessione 1v1 con la tua squadra.', preferredSide: 'top' },
  { key: 'nav-missioni',  title: 'Missioni',     body: 'I tuoi obiettivi attuali — la stessa missione che vedi sempre in alto a sinistra sulla mappa.', preferredSide: 'top' },
  { key: 'nav-enigmi',    title: 'Enigmi',       body: 'Indizi e rompicapi narrativi che si sbloccano scansionando QR code in giro.', preferredSide: 'top' },
  { key: 'nav-shop',      title: 'Shop',         body: 'Spendi oro per reti, esche, pozioni e oggetti che ti aiutano in cattura e battaglia.', preferredSide: 'top' },
  { key: 'nav-zaino',     title: 'Zaino',        body: 'La tua squadra di creature, gli oggetti raccolti e le uova in incubazione.', preferredSide: 'top' },
  { key: 'nav-classifica', title: 'Classifica',  body: 'Il tuo posizionamento nella sessione corrente e le statistiche personali.', preferredSide: 'top' },
  { key: 'nav-guida',     title: 'Guida',        body: 'Ogni meccanica spiegata con esempi animati. Da qui puoi rivedere anche questo tutorial.', preferredSide: 'top' },
]

// Synthetic pin id for the tutorial-only "indizio bonus" pin. Used to
// distinguish it from real DB-backed pins in the proximity-claim flow.
const TUTORIAL_BONUS_PIN_ID = 'tutorial-bonus-hint'
const tutorialBonusAnchorKey = (uid: string) => `wc:tutorial-bonus-anchor:${uid}`
const TUTORIAL_PIN_HINT_SEEN_KEY = 'wc:tutorial-pin-hint-seen'

// sessionStorage key for the per-session optimistic steps_walked total.
// Persists across map ↔ encounter ↔ duel ↔ boss navigations so the
// counter doesn't snap backward when the player returns to the map
// before the throttled position POST has flushed the latest credit.
const STEPS_CACHE_KEY = (sid: string) => `wc:steps-walked:${sid}`

const ENCOUNTER_COOLDOWN_MS = 30000  // 30s between encounters
// Cumulative distance that, when exceeded, probabilistically triggers a walk-based encounter
const WALK_ENCOUNTER_DIST_M = 25  // trigger after accumulating ~25 m
// Minimum interval between server position POSTs — coalesces 1 Hz GPS callbacks into one
// authoritative update every 5 s. Cuts /api/game/position load by ~5×.
const POSITION_POST_INTERVAL_MS = 5000

// ── Map pins client cache ──────────────────────────────────────────────────
// Stale-while-revalidate: on mount we paint pins from the cache instantly,
// then refresh in background. Cache is keyed by sessionId; one entry per
// browser. Invalidated locally on every successful pin claim so the next
// page mount refetches authoritatively from the server.
const MAP_PINS_CACHE_TTL_MS = 5 * 60 * 1000
const mapPinsCacheKey = (sid: string) => `wc:map-pins:${sid}`

type CachedPins = { pins: (MapPin & { claimed?: boolean })[]; ts: number }

function readMapPinsCache(sid: string): CachedPins | null {
  try {
    const raw = localStorage.getItem(mapPinsCacheKey(sid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPins
    if (typeof parsed?.ts !== 'number' || !Array.isArray(parsed?.pins)) return null
    return parsed
  } catch { return null }
}

function writeMapPinsCache(sid: string, pins: (MapPin & { claimed?: boolean })[]): void {
  try { localStorage.setItem(mapPinsCacheKey(sid), JSON.stringify({ pins, ts: Date.now() })) } catch {}
}

function invalidateMapPinsCache(sid: string): void {
  try { localStorage.removeItem(mapPinsCacheKey(sid)) } catch {}
}

function GPSErrorBanner({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false)
  const isDenied = message.toLowerCase().includes('abilita') || message.toLowerCase().includes('denied')
  const ios = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(120,53,15,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(251,191,36,0.3)' }}>
      <button
        onClick={() => isDenied && setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm">⚠️</span>
        <span className="flex-1 text-yellow-200 text-xs font-semibold">{message}</span>
        {isDenied && <span className="text-yellow-400/60 text-xs">{expanded ? '▲' : '▼ Come risolvere'}</span>}
      </button>
      {expanded && isDenied && (
        <div className="px-3 pb-3 text-xs text-yellow-100/70 space-y-1 border-t border-yellow-400/20 pt-2">
          {ios ? (
            <>
              <p className="font-bold text-yellow-200">iPhone/iPad:</p>
              <p>Impostazioni → Privacy → Localizzazione → Safari → Consenti</p>
            </>
          ) : (
            <>
              <p className="font-bold text-yellow-200">Android:</p>
              <p>Tocca 🔒 nella barra indirizzi → Autorizzazioni → Posizione → Consenti</p>
            </>
          )}
          <p className="text-yellow-200/50 mt-1">Poi ricarica la pagina.</p>
        </div>
      )}
    </div>
  )
}

const RARITY_COLOR: Record<string, string> = {
  comune:      '#9CA3AF',
  non_comune:  '#34D399',
  raro:        '#3A9DBC',
  epico:       '#C084FC',
  leggendario: '#FBBF24',
  mitologico:  '#FF4D6D',
}

const RARITY_LABEL: Record<string, string> = {
  comune:      'Terrestre',
  non_comune:  'Arcaico',
  raro:        'Eroico',
  epico:       'Mostruoso',
  leggendario: 'Leggendario',
  mitologico:  'Mitologico',
}

const ELEMENT_GLOW: Record<string, string> = {
  fiamma:    '#FF6B35',
  adriatico: '#3A9DBC',
  bosco:     '#34D399',
  terra:     '#A78BFA',
  armonia:   '#F9A8D4',
}

const ELEMENT_EMOJI: Record<string, string> = {
  fiamma: '🔥', adriatico: '🌊', bosco: '🌿', terra: '⚡', armonia: '✨',
}





// ── BossApproachModal ─────────────────────────────────────────────────────────
// Shown when a boss pin enters proximity range — lets the player choose
// to fight now or postpone (manual tap on the pin will re-open it later).

function MapPageInner() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inBounds, setInBounds] = useState(true)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionRestarted, setSessionRestarted] = useState(false)
  const [escaActiveUntil, setEscaActiveUntil] = useState<Date | null>(null)
  const [creatureImageUrl, setCreatureImageUrl] = useState<string | null>(null)
  const [mapPins, setMapPins] = useState<MapPin[]>([])
  const [claimedPinIds, setClaimedPinIds] = useState<Set<string>>(new Set())
  const claimedPinIdsRef = useRef<Set<string>>(new Set())
  const [pinReward, setPinReward] = useState<PinRewardData | null>(null)
  const pinRewardRef = useRef<PinRewardData | null>(null)
  const mapPinsRef = useRef<MapPin[]>([])
  const claimingPinRef = useRef(false)
  const [pendingBossPin, setPendingBossPin]     = useState<MapPin | null>(null)
  const pendingBossPinRef = useRef<MapPin | null>(null)
  const [pendingEnigmaPin, setPendingEnigmaPin] = useState<MapPin | null>(null)
  const pendingEnigmaPinRef = useRef<MapPin | null>(null)
  const [declinedBossPinIds, setDeclinedBossPinIds]     = useState<Set<string>>(new Set())
  const declinedBossPinIdsRef = useRef<Set<string>>(new Set())
  const [declinedEnigmaPinIds, setDeclinedEnigmaPinIds] = useState<Set<string>>(new Set())
  const declinedEnigmaPinIdsRef = useRef<Set<string>>(new Set())
  const [stepsWalked, setStepsWalked] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [hatchQueue, setHatchQueue] = useState<{ name: string; rarity: string; element: string; image_url: string | null; hp?: number; atk?: number; def?: number; description?: string | null; isStarter?: boolean }[]>([])
  const [missionQueue, setMissionQueue] = useState<CompletedMissionInfo[]>([])
  const [showStarterSelect, setShowStarterSelect] = useState(false)
  const [starters, setStarters] = useState<StarterCreature[]>([])
  const [starterPicked, setStarterPicked] = useState<StarterCreature | null>(null)
  const [starterCheckPending, setStarterCheckPending] = useState(true)
  // 'pending' until player_sessions loads; then 'has' (skip starter API entirely)
  // or 'missing' (run the starter API check). Gates the starter effect so it
  // doesn't race the player_sessions fetch and waste a round-trip.
  const [hasSelectedCreatureCheck, setHasSelectedCreatureCheck] = useState<'pending' | 'has' | 'missing'>('pending')
  const starterCheckedRef = useRef(false)
  const starterFlowLockedRef = useRef(true)
  const sessionEndedRef = useRef(false)
  const inBoundsRef = useRef(true)
  // Refs kept in sync with state so GPS callbacks (closures) always read fresh values
  useEffect(() => { claimedPinIdsRef.current = claimedPinIds }, [claimedPinIds])
  useEffect(() => { pinRewardRef.current = pinReward }, [pinReward])
  useEffect(() => { mapPinsRef.current = mapPins }, [mapPins])
  useEffect(() => { pendingBossPinRef.current = pendingBossPin }, [pendingBossPin])
  useEffect(() => { pendingEnigmaPinRef.current = pendingEnigmaPin }, [pendingEnigmaPin])
  useEffect(() => { declinedBossPinIdsRef.current = declinedBossPinIds }, [declinedBossPinIds])
  useEffect(() => { declinedEnigmaPinIdsRef.current = declinedEnigmaPinIds }, [declinedEnigmaPinIds])
  useEffect(() => { sessionStatusRef.current = (session?.status as string) ?? 'active' }, [session?.status])

  // Persist the optimistic step total to sessionStorage so a remount of
  // the map (encounter/duel/boss back-button) doesn't snap the counter
  // backward to whatever the server last persisted. Init reads this and
  // takes max(server, cached).
  useEffect(() => {
    const sid = sessionIdRef.current
    if (!sid || stepsWalked <= 0) return
    try {
      sessionStorage.setItem(STEPS_CACHE_KEY(sid), String(stepsWalked))
    } catch { /* quota */ }
  }, [stepsWalked])

  // Background ambience loop + ducking registration — starts on mount, stops on unmount
  useEffect(() => {
    registerAmbienceDucking(duckMapAmbience, unduckMapAmbience)
    const stop = startMapAmbience()
    return () => {
      registerAmbienceDucking(null, null)
      stop()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [showEncounterPopup, setShowEncounterPopup] = useState(false)
  const [pendingEncounter, setPendingEncounter] = useState<{
    encounterId: string
    creature: {
      name: string
      element: string
      rarity: string
      image_url?: string | null
      sprite_url?: string | null
    }
  } | null>(null)
  const lastEncounterRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null)
  // State mirror of "have we received at least one GPS fix yet?" — used to
  // retrigger effects that need a position (e.g. the tutorial bonus pin
  // placement) which would otherwise read the ref once during their first
  // run and silently bail when the fix hadn't arrived in time.
  const [hasGpsFix, setHasGpsFix] = useState(false)
  // Last `stepsWalked` value confirmed by the SERVER, regardless of any
  // local optimistic credit. Optimistic ticks can pull the local total
  // ahead of the server, so comparing the new server total against the
  // React state would miss real credits — we'd then fail to ping the
  // next-objective widget. This ref is the authoritative "did the server
  // actually credit something new?" gauge.
  const lastServerStepsRef = useRef(0)
  // Tracks metres walked since the last encounter attempt — resets after each attempt
  const cumDistRef = useRef(0)
  // Prevent concurrent triggerEncounter calls (mutex) and skip when popup is already open
  const triggeringEncounterRef = useRef(false)
  const encounterPopupRef = useRef(false)
  // GPS POST throttling — coalesce frequent fixes into one authoritative POST per 5 s
  const lastPositionPostAtRef = useRef(0)
  const positionPostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPositionRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null)

  // ── Optimistic local step counter ──────────────────────────────────────────
  // Two-layer model:
  //   1. `stepsWalked` (state) is the server-authoritative committed count.
  //      It's mutated locally only when evaluateStep passes (i.e. the same
  //      strict anti-cheat filter the server uses) and reconciled on every
  //      server POST response.
  //   2. `pendingDistance` (state, metres) is the optimistic distance the
  //      player has accumulated *since* the last credit — capped just below
  //      the credit threshold so the visible counter ticks every second
  //      while walking, but never overshoots a credit that's about to fire.
  // Display = stepsWalked + round(pendingDistance), then tweened.
  //
  // Critical detail: the local baseline is NOT updated on every fix (as the
  // server does between POSTs). It moves only on (a) a real credit firing,
  // or (b) the server POST reconciliation overwriting it. Updating it on
  // every fix would reset distance-from-baseline to ~1.4 m each second and
  // the SNR filter would never reach its threshold — the counter stayed
  // frozen until the 5 s server POST surfaced its own credit, which is
  // exactly the "non si attiva, poi salta" UX we're fixing.
  const localBaselineRef = useRef<{ lat: number; lng: number; ts: number; accuracy: number } | null>(null)
  const sessionStatusRef = useRef<string>('active')
  const [pendingDistance, setPendingDistance] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  // Keep the screen awake while the map is mounted — outdoor play would
  // otherwise lose the GPS marker and any in-flight encounter modals.
  useWakeLock(true)

  // Tween the visible counter so any jump (server reconciliation, missed
  // GPS fix catch-up) animates instead of snapping. Pure presentation.
  // Displayed value = committed credit + currently-pending optimistic metres
  // so the number ticks forward every GPS fix while walking.
  const displayedSteps = useTweenedInteger(stepsWalked + Math.round(pendingDistance), 450)

  // Tutorial mode: the always-on demo session has no physical QR codes in
  // the world, so we surface a "simulated scan" button on the map HUD.
  // Tapping it hits the normal /api/game/qr/scan endpoint with the seeded
  // tutorial QR manual_code matching the **current mission target** — so a
  // single button context-switches between "spawn an item" and "evoke the
  // tutorial boss" depending on where the player is in the story arc.
  // Missions, rewards, bestiary, and boss flow exactly like a real scan.
  const isTutorialSession = sessionId === TUTORIAL_SESSION_ID
  const [tutorialQrBusy, setTutorialQrBusy] = useState(false)
  const [tutorialQrResult, setTutorialQrResult] = useState<string | null>(null)
  const [tutorialNextTarget, setTutorialNextTarget] = useState<string | null>(null)
  // True iff the player's CURRENT next objective is M7 — the final 50 m
  // walk ("Maestro Daimologo"). The tutorial bonus pin is tied to this:
  // it appears only when M7 is active so walking 50 m toward the pin
  // completes both at once. Resolves over a /api/game/missions/next fetch.
  const [tutorialOnM7, setTutorialOnM7] = useState(false)
  // Sticky "the bonus-pin storyline has been reached" flag. Goes true the
  // first time we observe an objective with chapter_order >= 7 (i.e. M7
  // active OR any later mission). Stays true forever in-session so the
  // bonus pin remains creatable even if M7 auto-completes on the same
  // /position POST as the boss defeat (anchor would otherwise never be
  // created because tutorialOnM7 was never observably true). Reset on
  // session change.
  const [tutorialBonusUnlocked, setTutorialBonusUnlocked] = useState(false)

  // Resolve which tutorial QR (if any) the next-objective is asking for.
  // Re-fetches on every mission completion event so the button morphs from
  // "Simula scansione" → "Evoca il Capo" as the player progresses.
  const refreshTutorialTarget = useCallback(async () => {
    if (!isTutorialSession || !sessionId) {
      setTutorialNextTarget(null)
      setTutorialOnM7(false)
      return
    }
    try {
      const res = await fetch(`/api/game/missions/next?sessionId=${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      const target = data?.objective?.target ?? null
      setTutorialNextTarget(isTutorialQrTarget(target) ? target : null)
      setTutorialOnM7(data?.objective?.id === TUTORIAL_M7_MISSION_ID)
      // Sticky-lock the bonus-pin gate the first time we see the
      // storyline reach chapter 7 (M7) or beyond. We deliberately
      // never unset — once unlocked, the pin remains creatable for
      // the rest of the session even if the player completes M7
      // before the map effect gets a chance to read tutorialOnM7=true.
      const chapter = data?.objective?.chapter_order
      if (typeof chapter === 'number' && chapter >= 7) {
        setTutorialBonusUnlocked(true)
      }
    } catch {
      // Best-effort: realtime will retrigger this on the next mission update.
    }
  }, [isTutorialSession, sessionId])

  useEffect(() => { void refreshTutorialTarget() }, [refreshTutorialTarget])

  // ── Tutorial bonus map pin ────────────────────────────────────────────────
  // A single map pin dropped ~40 m from the player's first GPS fix, in a
  // deterministic per-user direction. Walking within 25 m auto-claims it,
  // granting an extra enigma suggerimento. Purely client-side overlay —
  // no row in session_map_pins — so the existing pin RLS / fetch path is
  // unaffected. localStorage stores the anchor so the pin stays put across
  // reloads; the DB (player_enigma_suggerimenti) is authoritative for
  // the "already claimed" check, so a tutorial reset cleanly re-arms it.
  const [tutorialBonusPin, setTutorialBonusPin] = useState<MapPin | null>(null)
  const [tutorialBonusClaimed, setTutorialBonusClaimed] = useState<boolean | null>(null) // null = unknown yet
  const tutorialBonusClaimingRef = useRef(false)
  // When the player walks onto the bonus pin we surface a full reward
  // modal (TutorialPinClaimModal). `null` = no modal; non-null = open.
  // The boolean tells the modal whether to phrase itself as "you just got
  // it" or "you already had it" — the API distinguishes via alreadyClaimed.
  const [tutorialBonusReward, setTutorialBonusReward] = useState<{ alreadyClaimed: boolean } | null>(null)
  const [showPinHint, setShowPinHint] = useState(false)

  // ── Tutorial moments queue ────────────────────────────────────────────────
  // After MissionRewardModal drains, we may need to show one or more
  // narrative beats ("first catch!", "boss defeated", "tutorial complete").
  // The queue is built from the mission completions surfaced by the server.
  const [tutorialMomentQueue, setTutorialMomentQueue] = useState<TutorialMoment[]>([])

  // Resolve claimed status from the DB once we know the user + tutorial scope
  useEffect(() => {
    if (!isTutorialSession) { setTutorialBonusClaimed(null); return }
    let cancelled = false
    void (async () => {
      const user = await getCurrentUser(supabase)
      if (!user || cancelled) return
      const { data } = await supabase
        .from('player_enigma_suggerimenti')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_id', TUTORIAL_SESSION_ID)
        .eq('suggerimento_id', TUTORIAL_BONUS_SUGGERIMENTO_ID)
        .maybeSingle()
      if (cancelled) return
      setTutorialBonusClaimed(!!data)
    })()
    return () => { cancelled = true }
  }, [isTutorialSession, supabase])

  // Place the pin: needs (tutorial session, M7 unlocked, not claimed, GPS
  // fix). The pin is tied to mission #7 — "Maestro Daimologo", a 50 m
  // walk. We compute its position the FIRST time M7 becomes the active
  // objective (anchor = player's GPS at that moment) and offset it by
  // 50 m + 25 m claim radius so a straight-line walk to the pin
  // completes both the mission and the claim simultaneously, giving the
  // otherwise-arbitrary "walk 50 m" a concrete visual goal.
  useEffect(() => {
    // Visibility gate — the pin only ever depends on (tutorial session,
    // not yet claimed). It does NOT depend on M7 still being active: the
    // walk-50m mission can complete in a direction OTHER than the pin
    // (player wanders, pacing back and forth, etc.), and the bonus
    // suggerimento is rewarded by REACHING THE PIN — independent of the
    // mission state. Earlier we also gated on `tutorialOnM7`, which made
    // the pin vanish the moment M7 completed even if the bonus was
    // unclaimed; user feedback flagged this as confusing.
    if (!isTutorialSession || tutorialBonusClaimed !== false) {
      setTutorialBonusPin(null)
      return
    }

    let cancelled = false
    void (async () => {
      const user = await getCurrentUser(supabase)
      if (!user || cancelled) return

      // Two creation paths:
      //  (1) An anchor already exists in localStorage → re-use it, even
      //      if M7 has since completed. This makes the pin persist across
      //      mission completion until claimed.
      //  (2) No anchor yet → only create one when M7 is the active
      //      objective AND we have a GPS fix. Without M7 being active we
      //      don't want the pin to materialize out of nowhere; the
      //      "Maestro Daimologo" beat introduces it.
      const key = tutorialBonusAnchorKey(user.id)
      let anchor: { lat: number; lng: number } | null = null
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
            anchor = { lat: parsed.lat, lng: parsed.lng }
          }
        }
      } catch { /* fall through */ }
      if (!anchor) {
        // Path-2 gate: only create a new anchor once the storyline has
        // reached chapter 7+ (M7 or later). Using `tutorialBonusUnlocked`
        // — which becomes sticky-true the moment we observe an objective
        // at chapter >= 7 — instead of `tutorialOnM7` (which is only
        // true while M7 is the active objective). M7 can auto-complete
        // on the same POST as the boss defeat, leaving M8 active before
        // the map ever observes M7 as the next objective. That used to
        // leave the player on the enigma mission with no pin.
        if (!tutorialBonusUnlocked) return
        const pos = lastPosRef.current
        if (!pos) return                      // wait for first GPS fix
        anchor = { lat: pos.lat, lng: pos.lng }
        try { localStorage.setItem(key, JSON.stringify(anchor)) } catch { /* quota */ }
      }

      const bearing = tutorialPinBearingForUser(user.id)
      const pinPos = offsetGpsPoint(anchor, bearing, TUTORIAL_PIN_OFFSET_M)
      if (cancelled) return
      setTutorialBonusPin({
        id: TUTORIAL_BONUS_PIN_ID,
        lat: pinPos.lat,
        lng: pinPos.lng,
        name: '💡 Punto di destinazione del Maestro',
        description: 'Cammina fino a qui per completare il tirocinio — riceverai anche un indizio bonus sull\'enigma.',
        reward_type: 'enigma',
        reward_radius_m: TUTORIAL_PIN_CLAIM_RADIUS_M,
      })
      // First time we drop the pin on this device, surface a hint banner
      // so the player knows to look at the map (the marker is small and
      // easy to miss). Dismissed forever via localStorage flag.
      try {
        if (!localStorage.getItem(TUTORIAL_PIN_HINT_SEEN_KEY)) {
          setShowPinHint(true)
        }
      } catch { /* noop */ }
    })()
    return () => { cancelled = true }
  }, [isTutorialSession, tutorialBonusClaimed, tutorialBonusUnlocked, hasGpsFix, supabase])

  // Proximity claim — fires from the GPS callback so it ticks even between
  // server POSTs. Wrapped in its own ref-guarded flow to avoid double posts.
  const tryClaimTutorialBonus = useCallback(async (pos: { lat: number; lng: number }) => {
    if (tutorialBonusClaimingRef.current) return
    const pin = tutorialBonusPin
    if (!pin) return
    if (tutorialBonusClaimed) return
    const R = 6371000
    const dLat = (pos.lat - pin.lat) * Math.PI / 180
    const dLon = (pos.lng - pin.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(pin.lat * Math.PI / 180) * Math.cos(pos.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (dist > (pin.reward_radius_m ?? TUTORIAL_PIN_CLAIM_RADIUS_M)) return

    tutorialBonusClaimingRef.current = true
    try {
      const res = await fetch('/api/game/tutorial/claim-pin', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        playPinClaim()
        haptics.missionDone()
        setTutorialBonusClaimed(true)
        setTutorialBonusPin(null)
        setTutorialBonusReward({ alreadyClaimed: !!data.alreadyClaimed })
      }
    } catch {
      /* network error — user can re-trigger by walking past the pin again */
    } finally {
      tutorialBonusClaimingRef.current = false
    }
  }, [tutorialBonusPin, tutorialBonusClaimed])

  // The mission-completion modal lifecycle ends with the queue draining;
  // hook into wc:refresh-stats (already fired by the encounter/qr/boss
  // success paths) so the simulated-button stays in sync without a
  // dedicated channel here.
  useEffect(() => {
    if (!isTutorialSession) return
    function onMissionTick() { void refreshTutorialTarget() }
    window.addEventListener('wc:refresh-stats', onMissionTick)
    return () => window.removeEventListener('wc:refresh-stats', onMissionTick)
  }, [isTutorialSession, refreshTutorialTarget])

  async function simulateTutorialQr() {
    if (tutorialQrBusy || !sessionId || !tutorialNextTarget) return
    setTutorialQrBusy(true)
    setTutorialQrResult(null)
    try {
      const res = await fetch('/api/game/qr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, qrId: tutorialNextTarget }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // Aural + tactile confirmation — was silent before.
        playQrScan()
        haptics.tap()
        if (data.bossFightId) {
          // Boss QR scanned — drop the player straight into the fight.
          // The boss-QR mission completes SERVER-SIDE at scan time (it's
          // type='qr', not 'boss_won'), so the server returned the mission
          // completion + any frammento grant immediately. Showing the
          // reward modal HERE would flash it for a split-second during the
          // router.push to the boss page — and would also be narratively
          // wrong (the player hasn't beaten the boss yet). Park the
          // payload in sessionStorage and the boss page picks it up after
          // the fight ends.
          if (data.completedMissions?.length > 0) {
            try {
              sessionStorage.setItem(
                `wc:pending-boss-rewards:${data.bossFightId}`,
                JSON.stringify(data.completedMissions),
              )
            } catch { /* quota — fall back to losing the modal */ }
          }
          router.push(`/game/boss/${data.bossFightId}`)
          return
        }
        if (data.itemName) {
          setTutorialQrResult(`✓ ${data.itemName} aggiunto allo zaino`)
        } else {
          setTutorialQrResult('✓ Scansione riuscita')
        }
        if (data.completedMissions?.length > 0) {
          setMissionQueue(prev => [...prev, ...data.completedMissions])
        }
        window.dispatchEvent(new CustomEvent('wc:refresh-backpack'))
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      } else if (data.alreadyScanned) {
        setTutorialQrResult('Hai già scansionato questo segno')
      } else {
        setTutorialQrResult(data.error ?? 'Errore scansione')
      }
    } catch {
      setTutorialQrResult('Errore di rete')
    } finally {
      setTutorialQrBusy(false)
      setTimeout(() => setTutorialQrResult(null), 4000)
    }
  }

  // First-run coachmarks — fire after the map is fully usable (session +
  // starter check both resolved) and only if not already seen on this device.
  const [showCoachmarks, setShowCoachmarks] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!session || starterCheckPending) return
    if (showStarterSelect) return // wait until starter picker closes
    // ALSO wait for the starter-hatch celebration card to drain. Tapping
    // "Inizia l'avventura!" flips showStarterSelect=false immediately
    // but pushes a starter entry into hatchQueue for the reveal card.
    // Without this guard the 1/10 "La tua mappa" coachmark would
    // overlap the still-mounted starter celebration (visible in
    // user-reported screenshot). `starterPicked` itself stays truthy
    // for the whole map session so we DON'T gate on it — only on the
    // queue actively containing the starter entry.
    if (hatchQueue.some(e => e.isStarter)) return
    if (localStorage.getItem(COACHMARK_STORAGE_KEY) === '1') return
    // Small delay so (a) the GameMap finishes its first paint before we
    // measure the bounding rects of nav items / step counter, and
    // (b) any closing modal (StarterSelect picker, EggHatchModal starter
    // celebration) finishes its framer-motion exit before the coachmark
    // overlay paints on top. 700 ms is long enough for the modal exits
    // (~300 ms) without feeling laggy.
    const t = setTimeout(() => setShowCoachmarks(true), 700)
    return () => clearTimeout(t)
  }, [session, starterCheckPending, showStarterSelect, hatchQueue])

  useEffect(() => {
    function init(sid: string) {
      starterCheckedRef.current = false
      starterFlowLockedRef.current = true
      // Reset the optimistic step accumulator — different session, new baseline.
      localBaselineRef.current = null
      setPendingDistance(0)
      // Reset the server-side step gauge so the first reconciliation in the
      // new session can correctly detect "did the server credit anything?".
      lastServerStepsRef.current = 0
      // Reset the sticky bonus-pin unlock — refreshTutorialTarget will
      // re-evaluate from the next /api/game/missions/next response.
      setTutorialBonusUnlocked(false)
      setSessionId(sid)
      sessionIdRef.current = sid
      localStorage.setItem('current_session_id', sid)
      setSession(null)
      setStarterCheckPending(true)
      setHasSelectedCreatureCheck('pending')
      setShowStarterSelect(false)
      setStarters([])
      setStarterPicked(null)
      setCreatureImageUrl(null)
      supabase.from('sessions').select('*').eq('id', sid).single()
        .then(({ data }) => { if (data) setSession(data as unknown as Session) })
      // Load esca status
      getCurrentUser(supabase).then(user => {
        if (!user) return
        supabase.from('player_sessions')
          .select('esca_active_until, selected_creature_id, steps_walked, onboarding_seen')
          .eq('user_id', user.id)
          .eq('session_id', sid)
          .single()
          .then(({ data }) => {
            // ── First-session onboarding gate ────────────────────────────
            // If the player hasn't seen / skipped the intro for this
            // session, send them to the tutorial first. The onboarding page
            // marks the flag and routes back here when done.
            if (data && data.onboarding_seen === false) {
              router.replace(`/game/onboarding?next=${encodeURIComponent(`/game/map?restored=${sid}`)}`)
              return
            }
            if (data?.esca_active_until) {
              const d = new Date(data.esca_active_until)
              if (d > new Date()) setEscaActiveUntil(d)
            }
            if (typeof data?.steps_walked === 'number') {
              // Compare server's count to any locally-cached optimistic
              // total from a previous mount. The server is authoritative
              // for the bottom bound, but local credit may be ahead if a
              // position POST didn't flush before the page navigated
              // away (e.g. player tapped an encounter). Take the max so
              // the visible counter is strictly non-decreasing.
              let cached = 0
              try {
                const raw = sessionStorage.getItem(STEPS_CACHE_KEY(sid))
                if (raw) cached = parseInt(raw, 10) || 0
              } catch { /* noop */ }
              setStepsWalked(Math.max(data.steps_walked, cached))
              // Seed the server-side gauge so the next /position reconciliation
              // doesn't spuriously look like "server credited" on the first
              // POST after restore.
              lastServerStepsRef.current = data.steps_walked
            }
            // Signal the starter effect: returning players (selected_creature_id
            // already set) skip the /api/game/starters round-trip and unblock the
            // skeleton immediately. Brand-new sessions still hit the API.
            setHasSelectedCreatureCheck(data?.selected_creature_id ? 'has' : 'missing')
            if (data?.selected_creature_id) {
              supabase.from('player_creatures')
                .select('creatures(image_url)')
                .eq('id', data.selected_creature_id)
                .single()
                .then(({ data: pc }) => {
                  const url = (pc?.creatures as any)?.image_url
                  if (url) setCreatureImageUrl(url)
                })
            }
          })
      })
      // Load map pins (includes claimed status per user) with stale-while-revalidate.
      // Cache hit → paint immediately AND refresh in the background. Cache miss → fetch.
      const applyPins = (pins: (MapPin & { claimed?: boolean })[]) => {
        setMapPins(pins)
        setClaimedPinIds(new Set(pins.filter(p => p.claimed).map(p => p.id)))
      }
      const fetchPinsFresh = () => fetch(`/api/game/map-pins?sessionId=${sid}`)
        .then(r => r.json())
        .then((d: { pins?: (MapPin & { claimed?: boolean })[] }) => {
          if (d.pins) {
            applyPins(d.pins)
            writeMapPinsCache(sid, d.pins)
          }
        })
        .catch(() => {})

      const cached = readMapPinsCache(sid)
      if (cached && Date.now() - cached.ts < MAP_PINS_CACHE_TTL_MS) {
        applyPins(cached.pins)
        // Background refresh keeps state authoritative within the TTL window
        void fetchPinsFresh()
      } else {
        void fetchPinsFresh()
      }
    }

    // ?restored=<sid> from auth callback OR history re-entry from home page
    const restored = searchParams.get('restored')
    if (restored) {
      init(restored)
      router.replace('/game/map')
      return
    }

    const sid = localStorage.getItem('current_session_id')
    if (sid) {
      init(sid)
    } else {
      // localStorage was cleared — ask the server which session this player is in
      fetch('/api/auth/restore')
        .then(r => r.json())
        .then((d: { sessionId: string | null }) => {
          if (d.sessionId) {
            localStorage.setItem('current_session_id', d.sessionId)
            init(d.sessionId)
          } else {
            router.push('/home')
          }
        })
        .catch(() => router.push('/home'))
    }
  }, [])

  useEffect(() => {
    starterFlowLockedRef.current =
      starterCheckPending ||
      (showStarterSelect && !starterPicked) ||
      hatchQueue.some(entry => entry.isStarter)
  }, [starterCheckPending, showStarterSelect, starterPicked, hatchQueue])

  // Restore pending encounter popup after tab switch / navigation away and back
  // The DB auto-expires encounters older than 3 minutes, so we use the same window.
  useEffect(() => {
    const POPUP_MAX_AGE_MS = 3 * 60 * 1000
    try {
      const raw = sessionStorage.getItem('wc:pending_popup')
      if (!raw) return
      const { encounterId, creature, shownAt } = JSON.parse(raw)
      if (Date.now() - shownAt < POPUP_MAX_AGE_MS && encounterId && creature) {
        setPendingEncounter({ encounterId, creature })
        setShowEncounterPopup(true)
        encounterPopupRef.current = true
      } else {
        sessionStorage.removeItem('wc:pending_popup')
      }
    } catch {
      sessionStorage.removeItem('wc:pending_popup')
    }
  }, [])

  // ── Handle pin tap from map — show boss/enigma modals ─────────────────────
  const handlePinTap = useCallback((pin: MapPin) => {
    const sid = sessionIdRef.current
    if (!sid) return
    // Tutorial bonus pin uses its own (proximity-only) claim flow and is
    // not backed by a session_map_pins row — never route it through the
    // real enigma/boss modal stack.
    if (pin.id === TUTORIAL_BONUS_PIN_ID) {
      const pos = lastPosRef.current
      if (pos) void tryClaimTutorialBonus(pos)
      return
    }
    // Only act on boss/enigma pins that aren't yet claimed
    if (pin.reward_type !== 'boss' && pin.reward_type !== 'enigma') return
    if (claimedPinIdsRef.current.has(pin.id)) return

    // Client-side GPS proximity check (server will verify again)
    const pos = lastPosRef.current
    if (pos) {
      const R = 6371000
      const dLat = (pin.lat - pos.lat) * Math.PI / 180
      const dLon = (pin.lng - pos.lng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(pos.lat * Math.PI / 180) * Math.cos(pin.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const threshold = (pin.reward_radius_m ?? 50) + 20
      if (dist > threshold) return
    }

    if (pin.reward_type === 'boss') setPendingBossPin(pin)
    else if (pin.reward_type === 'enigma') {
      // Clear declined so the modal reopens on manual tap
      setDeclinedEnigmaPinIds(prev => { const s = new Set(prev); s.delete(pin.id); return s })
      setPendingEnigmaPin(pin)
    }
  }, [tryClaimTutorialBonus])

  const triggerEncounter = useCallback(async (trigger: 'gps' | 'timer' = 'gps'): Promise<boolean> => {
    // Mutex: skip if another trigger is in-flight or popup already showing
    if (triggeringEncounterRef.current) return false
    if (encounterPopupRef.current) return false
    if (starterFlowLockedRef.current) return false

    triggeringEncounterRef.current = true
    try {
      const sid = sessionIdRef.current
      if (!sid) return false
      const res = await fetch('/api/game/encounter/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, trigger }),
      })
      const data = await res.json()
      if (data.encounterId && data.creature) {
        sessionStorage.setItem(`encounter_${data.encounterId}`, JSON.stringify({
          encounterId: data.encounterId,
          creature: data.creature,
          wildHp: data.wildHp,
          wildHpMax: data.wildHp,
          catchBonus: 0,
          turns: 0,
          squadCreatures: data.squadCreatures ?? [],
        }))
        // Persist popup so it survives tab switches (valid for 3 min, matching DB auto-expire)
        sessionStorage.setItem('wc:pending_popup', JSON.stringify({
          encounterId: data.encounterId,
          creature: data.creature,
          shownAt: Date.now(),
        }))
        setPendingEncounter(data)
        playEncounterSound()
        haptics.encounter()
        setShowEncounterPopup(true)
        encounterPopupRef.current = true
        track('encounter_started', {
          sessionId: sid,
          trigger,
          creatureRarity: data.creature?.rarity ?? 'unknown',
          creatureElement: data.creature?.element ?? 'unknown',
        })
        return true
      } else if (data.encounterId) {
        // Stale active encounter — navigate only when no popup is showing
        router.push(`/game/encounter/${data.encounterId}`)
        return true
      }
      return false
    } finally {
      triggeringEncounterRef.current = false
    }
  }, [router])

  // Authoritative server POST: validates session/bounds, advances steps, hatches eggs,
  // and may trigger an encounter. Throttled by onGPSPosition to one call per
  // POSITION_POST_INTERVAL_MS to keep load light on free-tier Supabase.
  const firePositionPost = useCallback(async () => {
    const pos = pendingPositionRef.current
    pendingPositionRef.current = null
    if (!pos) return
    const sid = sessionIdRef.current
    if (!sid || sessionEndedRef.current) return

    lastPositionPostAtRef.current = Date.now()

    // Position posts can race the page lifecycle: this function is
    // dispatched from a 5 s setTimeout, so it may fire AFTER the user
    // tapped an encounter / boss / duel and the map is unmounting.
    // The in-flight fetch then rejects with "Failed to fetch" — a real
    // network/lifecycle error, but irrelevant: the next map mount will
    // re-sync state from the server anyway. Catch and swallow rather
    // than letting it bubble up as an unhandled rejection (Sentry noise).
    let res: Response
    try {
      res = await fetch('/api/game/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, sessionId: sid }),
      })
    } catch {
      // Offline, page unloading, or DNS blip — best-effort POST, skip.
      return
    }
    if (!res.ok) return

    let data: any
    try {
      data = await res.json()
    } catch {
      // Body parse failure (server returned non-JSON) — also a no-op.
      return
    }

    if (data.sessionEnded) {
      sessionEndedRef.current = true
      setSessionEnded(true)
      return
    }

    if (data.inBounds !== undefined) {
      setInBounds(data.inBounds)
      inBoundsRef.current = data.inBounds
    }

    if (typeof data.stepsWalked === 'number') {
      // Server is authoritative. Two cases:
      //
      //  (a) Server credited new steps → data.stepsWalked > previous.
      //      The credit already absorbed the distance the user walked, so
      //      we zero the pending bucket and reset the local baseline to
      //      the current fix. Display = new total + 0 — strictly higher
      //      than before, no flicker.
      //
      //  (b) Server did NOT credit (jitter under SNR threshold) →
      //      data.stepsWalked === previous. Previously we zeroed pending
      //      here too, which made the visible counter drop by a few
      //      metres every reconciliation cycle when the player was
      //      walking slowly. Keep pending and the local baseline as they
      //      were so the display only ticks forward.
      // Did the SERVER credit new steps on this reconciliation? Compare
      // against `lastServerStepsRef` (the last server-confirmed total)
      // NOT against the React state — optimistic local credits can pull
      // the state ahead, so `data.stepsWalked > stepsWalked` would miss
      // real credits whenever the server is catching up to us.
      // /api/game/position has already bumped player_missions.progress
      // for any active walk mission on every server credit, so we kick
      // the next-objective widget here. Without this, the persistent
      // mission HUD only updates on (flaky) Supabase realtime or when a
      // mission outright completes.
      const serverCreditedNewSteps = data.stepsWalked > lastServerStepsRef.current
      lastServerStepsRef.current = data.stepsWalked

      setStepsWalked(prev => {
        // Step total is monotonic non-decreasing. If the server is briefly
        // behind a locally-credited optimistic tick (we credited 5m before
        // the server saw the fix), keep the higher local value so the
        // display doesn't snap backwards. The server will catch up next
        // reconciliation.
        const next = Math.max(prev, data.stepsWalked)
        if (next > prev) {
          setPendingDistance(0)
          localBaselineRef.current = {
            lat: pos.lat, lng: pos.lng, ts: Date.now(), accuracy: pos.accuracy,
          }
        }
        return next
      })

      if (serverCreditedNewSteps) {
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      }
    }

    if (data.eggsHatched?.length > 0) {
      setHatchQueue(prev => [...prev, ...data.eggsHatched])
      haptics.hatch()
      for (const egg of data.eggsHatched as Array<{ rarity: string }>) {
        track('egg_hatched', { sessionId: sid, eggRarity: 'unknown', resultRarity: egg.rarity ?? 'unknown' })
      }
    }

    if (data.completedMissions?.length > 0) {
      setMissionQueue(prev => [...prev, ...data.completedMissions])
      haptics.missionDone()
      // Refresh next-objective widget + any other UI listening for stat
      // changes. The walk-mission path (driven by /api/game/position) was
      // the only completion route NOT firing this event, so the persistent
      // next-objective HUD kept showing the just-completed mission until
      // page reload.
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      for (const m of data.completedMissions as Array<CompletedMissionInfo>) {
        track('mission_completed', {
          sessionId: sid,
          missionId: 'unknown',
          missionType: 'walk',
          rewardGold: m.rewardGold ?? 0,
          rewardExp: m.rewardExp ?? 0,
        })
      }
    }

    if (starterFlowLockedRef.current) return
    if (data.sessionStatus && data.sessionStatus !== 'active') return

    // ── Pin proximity check (uses the throttled POST's pos) ─────────────────
    if (!claimingPinRef.current && !pinRewardRef.current && !pendingBossPinRef.current && !pendingEnigmaPinRef.current) {
      const nearPin = mapPinsRef.current.find(pin => {
        if (!pin.reward_type) return false
        if (claimedPinIdsRef.current.has(pin.id)) return false
        if (pin.reward_type === 'boss'   && declinedBossPinIdsRef.current.has(pin.id))   return false
        if (pin.reward_type === 'enigma' && declinedEnigmaPinIdsRef.current.has(pin.id)) return false
        const dLat = (pos.lat - pin.lat) * Math.PI / 180
        const dLon = (pos.lng - pin.lng) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(pin.lat * Math.PI / 180) * Math.cos(pos.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
        const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return dist <= (pin.reward_radius_m ?? 50)
      })
      if (nearPin) {
        if (nearPin.reward_type === 'boss') {
          setPendingBossPin(nearPin)
          return
        }
        if (nearPin.reward_type === 'enigma') {
          setPendingEnigmaPin(nearPin)
          return
        }
        claimingPinRef.current = true
        fetch('/api/game/map-pins/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinId: nearPin.id, sessionId: sid, lat: pos.lat, lng: pos.lng }),
        })
          .then(r => r.json())
          .then((d: any) => {
            if (d.success) {
              // Aural + tactile feedback — pin claims used to be silent.
              playPinClaim()
              haptics.missionDone()
              setClaimedPinIds(prev => new Set([...prev, nearPin.id]))
              invalidateMapPinsCache(sid)
              setPinReward(d as PinRewardData)
              if (d.completedMissions?.length > 0) {
                setMissionQueue(prev => [...prev, ...d.completedMissions])
                window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
              }
            }
            if (d.alreadyClaimed) {
              setClaimedPinIds(prev => new Set([...prev, nearPin.id]))
              invalidateMapPinsCache(sid)
            }
          })
          .catch(() => {})
          .finally(() => { claimingPinRef.current = false })
      }
    }

    if (typeof data.distanceMoved === 'number' && data.distanceMoved > 0 && data.distanceMoved < 500) {
      cumDistRef.current += data.distanceMoved
    }

    const cooldownPassed = Date.now() - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS

    if (data.triggerEncounter && cooldownPassed) {
      const started = await triggerEncounter('gps')
      if (started) { lastEncounterRef.current = Date.now(); cumDistRef.current = 0 }
      return
    }

    if (cumDistRef.current >= WALK_ENCOUNTER_DIST_M && cooldownPassed) {
      const started = await triggerEncounter('gps')
      if (started) { lastEncounterRef.current = Date.now(); cumDistRef.current = 0 }
    }
  }, [triggerEncounter])

  const onGPSPosition = useCallback((pos: { lat: number; lng: number; accuracy: number }) => {
    const sid = sessionIdRef.current
    if (!sid || sessionEndedRef.current) return

    // Visual updates always happen at GPS rate — marker, accuracy, lastPos
    setGpsAccuracy(Math.round(pos.accuracy))
    lastPosRef.current = { lat: pos.lat, lng: pos.lng }
    // Promote "we have a fix" to state on the FIRST fix so effects gated
    // on a position (tutorial bonus pin) re-run as soon as GPS resolves.
    // setState bails out when value is unchanged, so calling unconditionally
    // is safe — avoids needing `hasGpsFix` in this callback's deps.
    setHasGpsFix(true)

    // Skip very inaccurate fixes (map marker already updated above)
    if (pos.accuracy > 300) return

    // Tutorial bonus pin proximity — fires off the GPS tick so it claims
    // even when no server POST is in flight. The function is a no-op when
    // the pin isn't placed or has been claimed.
    void tryClaimTutorialBonus({ lat: pos.lat, lng: pos.lng })

    // ── Optimistic local step credit + smooth pending interpolation ───────
    const baseline = localBaselineRef.current
    const now = Date.now()
    if (!baseline) {
      // First fix in this session — establish baseline, no credit yet.
      localBaselineRef.current = { lat: pos.lat, lng: pos.lng, ts: now, accuracy: pos.accuracy }
    } else {
      const distanceMoved = haversineDistance(baseline, { lat: pos.lat, lng: pos.lng })

      // ── GPS re-localization guard ─────────────────────────────────────
      // If the new fix is SIGNIFICANTLY more accurate than the baseline,
      // the device has just settled onto a better location estimate — the
      // big positional shift between baseline and now reflects the GPS
      // refining its guess, not the player actually walking that
      // distance. Silently rebase to the new fix and skip the credit/
      // pending update for this tick. Without this, going from indoor
      // (acc≈100m, position off by ~30-50m) to outdoor (acc≈10m) would
      // credit a phantom "step" of tens of metres while the player is
      // standing still. The server path runs into the same case in
      // theory but is throttled to one POST per ~5s so GPS has usually
      // settled by then — here we run on every fix (1Hz) so we need
      // the explicit guard. Conservative thresholds (baseline >30m, new
      // ≤ 50% of baseline) keep normal accuracy wobble untouched.
      if (baseline.accuracy > 30 && pos.accuracy * 2 < baseline.accuracy) {
        localBaselineRef.current = { lat: pos.lat, lng: pos.lng, ts: now, accuracy: pos.accuracy }
        setPendingDistance(0)
        // Trailing throttle handles the server POST below — let it fire
        // normally so the server can independently confirm position.
        pendingPositionRef.current = pos
        if (positionPostTimeoutRef.current) return
        const elapsed = now - lastPositionPostAtRef.current
        const wait = Math.max(0, POSITION_POST_INTERVAL_MS - elapsed)
        positionPostTimeoutRef.current = setTimeout(() => {
          positionPostTimeoutRef.current = null
          void firePositionPost()
        }, wait)
        return
      }

      const result = evaluateStep({
        distanceMoved,
        accuracy: pos.accuracy,
        elapsedMs: now - baseline.ts,
        sessionStatus: sessionStatusRef.current,
        inBounds: inBoundsRef.current,
      })
      if (result.stepsIncrement > 0) {
        // A real credit fires — flush the pending bucket into the committed
        // counter (the credit already encodes that distance) and reset the
        // baseline so the next accumulation starts fresh.
        setStepsWalked(prev => prev + result.stepsIncrement)
        setPendingDistance(0)
        localBaselineRef.current = { lat: pos.lat, lng: pos.lng, ts: now, accuracy: pos.accuracy }
      } else if (sessionStatusRef.current === 'active' && inBoundsRef.current && pos.accuracy <= 50) {
        // No credit this tick, but the fix is accurate enough that we
        // believe the displacement. Grow the optimistic "pending" bucket
        // (monotonic-max, capped just below the credit threshold) so the
        // visible counter ticks forward every fix while walking.
        setPendingDistance(prev => updatePendingDistance({
          previousPending: prev,
          distanceMoved,
          accuracy: pos.accuracy,
        }))
      }
      // Deliberately NOT calling shouldUpdateBaseline here — see top-of-file
      // comment. The baseline only moves on credit or on server reconciliation.
    }

    // Trailing throttle: keep latest pos, schedule one POST per interval
    pendingPositionRef.current = pos
    if (positionPostTimeoutRef.current) return  // already scheduled; latest pos will be used

    const elapsed = now - lastPositionPostAtRef.current
    const wait = Math.max(0, POSITION_POST_INTERVAL_MS - elapsed)

    positionPostTimeoutRef.current = setTimeout(() => {
      positionPostTimeoutRef.current = null
      void firePositionPost()
    }, wait)
  }, [firePositionPost, tryClaimTutorialBonus])

  // Clean up any pending timer on unmount so we don't leak
  useEffect(() => () => {
    if (positionPostTimeoutRef.current) {
      clearTimeout(positionPostTimeoutRef.current)
      positionPostTimeoutRef.current = null
    }
  }, [])

  const { position, error: gpsError } = useGPS(onGPSPosition)

  // Log GPS errors to session_errors once per session (avoid DB spam on repeated callbacks)
  const gpsErrorLoggedRef = useRef<string | null>(null)
  useEffect(() => {
    const sid = sessionIdRef.current
    if (!gpsError || !sid || gpsErrorLoggedRef.current === gpsError) return
    gpsErrorLoggedRef.current = gpsError
    const isDenied = gpsError.includes('Abilita il GPS')
    logSessionErrorClient({
      sessionId: sid,
      source: 'map',
      errorCode: isDenied ? 'gps_denied' : 'gps_unavailable',
      message: gpsError,
    })
  }, [gpsError])

  // Timer-based encounter fallback
  useEffect(() => {
    const sid = sessionIdRef.current
    if (!sid) return
    const minMs = 45000, maxMs = 90000   // 45–90 s (was 60–180 s)
    let timeout: ReturnType<typeof setTimeout>

    function scheduleTimerEncounter() {
      const delay = minMs + Math.random() * (maxMs - minMs)
      timeout = setTimeout(async () => {
        if (sessionEndedRef.current) return
        if (starterFlowLockedRef.current) { scheduleTimerEncounter(); return }
        if (!inBoundsRef.current) { scheduleTimerEncounter(); return }
        const now = Date.now()
        if (now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS) {
          try {
            const started = await triggerEncounter('timer')
            if (started) lastEncounterRef.current = now
          } catch {
            // network error — leave cooldown reset so next tick retries immediately
          }
        }
        scheduleTimerEncounter()  // always reschedule, regardless of errors
      }, delay)
    }
    scheduleTimerEncounter()

    return () => clearTimeout(timeout)
  }, [sessionId, triggerEncounter])

  // Listen for esca activation from backpack
  useEffect(() => {
    function onEscaActivated(e: Event) {
      const until = (e as CustomEvent<{ until: string }>).detail?.until
      if (until) setEscaActiveUntil(new Date(until))
    }
    window.addEventListener('wc:esca-activated', onEscaActivated)
    return () => window.removeEventListener('wc:esca-activated', onEscaActivated)
  }, [])

  const [escaSecondsLeft, setEscaSecondsLeft] = useState(0)
  const starterSessionStatus = session?.status

  // Stable pins array reference — important because GameMap's marker-render
  // useEffect uses [mapReady, pins] as deps and tears every marker (and
  // their open popups) on any change. Without useMemo a fresh array would
  // be created on every parent re-render (escaSecondsLeft tick, GPS fix,
  // tutorial state, etc.) and player-opened popups would flicker shut.
  const renderedPins = useMemo(
    () => tutorialBonusPin ? [...mapPins, tutorialBonusPin] : mapPins,
    [mapPins, tutorialBonusPin],
  )

  // Countdown tick — updates every second while esca is active
  useEffect(() => {
    if (!escaActiveUntil) { setEscaSecondsLeft(0); return }
    function tick() {
      const secs = Math.max(0, Math.round((escaActiveUntil!.getTime() - Date.now()) / 1000))
      setEscaSecondsLeft(secs)
      if (secs <= 0) setEscaActiveUntil(null)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [escaActiveUntil])

  // Check if player needs to pick a starter (first time in session).
  // Waits for player_sessions to resolve — returning players (hasSelectedCreatureCheck === 'has')
  // skip the API call entirely, unblocking the skeleton ~1 round-trip earlier.
  useEffect(() => {
    if (!sessionId || !starterSessionStatus || starterCheckedRef.current) return
    if (hasSelectedCreatureCheck === 'pending') return

    if (!['ready', 'active'].includes(starterSessionStatus)) {
      starterCheckedRef.current = true
      setStarterCheckPending(false)
      setShowStarterSelect(false)
      return
    }

    if (hasSelectedCreatureCheck === 'has') {
      starterCheckedRef.current = true
      setStarterCheckPending(false)
      setShowStarterSelect(false)
      return
    }

    starterCheckedRef.current = true
    setStarterCheckPending(true)
    fetch(`/api/game/starters?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.starterAvailable && !d.alreadyHasCreatures && d.starters?.length > 0) {
          setStarters(d.starters)
          setShowStarterSelect(true)
        }
      })
      .catch(() => {})
      .finally(() => setStarterCheckPending(false))
  }, [sessionId, starterSessionStatus, hasSelectedCreatureCheck])

  // Realtime broadcast: session_ended / session_restarted from admin
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`map:session:${sessionId}`)
      .on('broadcast', { event: 'session_ended' }, () => {
        sessionEndedRef.current = true
        setSessionEnded(true)
      })
      .on('broadcast', { event: 'session_restarted' }, () => {
        setSessionRestarted(true)
        setTimeout(() => router.push('/home'), 3000)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, supabase, router])

  if (!session || starterCheckPending) {
    return <GameMapSkeleton />
  }

  return (
    <div className="relative w-full h-full" data-coachmark="map-area">
      <GameMap
        session={session}
        playerPosition={position ? { lat: position.lat, lng: position.lng } : null}
        sessionId={sessionId!}
        creatureImageUrl={creatureImageUrl}
        pins={renderedPins}
        onPinTap={handlePinTap}
      />

      {/* Tutorial bonus pin — full-screen reward modal */}
      {tutorialBonusReward && (
        <TutorialPinClaimModal
          alreadyClaimed={tutorialBonusReward.alreadyClaimed}
          onClose={() => setTutorialBonusReward(null)}
        />
      )}

      {/* Tutorial bonus pin — first-time discovery hint. The Leaflet
          marker is small so without this many players never notice it.
          Dismissed forever once tapped. */}
      {showPinHint && tutorialBonusPin && (
        <div className="absolute z-[855] top-20 left-1/2 -translate-x-1/2 max-w-[320px] w-[88%] px-4 py-3 rounded-2xl bg-[#7B4DB8]/95 text-white shadow-xl backdrop-blur-sm border border-[#C084FC]/40">
          <div className="flex items-start gap-2.5">
            <span className="text-2xl shrink-0 leading-none">💡</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-snug">Il maestro ha tracciato la rotta finale</p>
              <p className="text-[12px] text-white/80 leading-snug mt-0.5">
                Cammina verso il pin viola sulla mappa — completerà il tirocinio e ti darà un indizio bonus sull&apos;enigma.
              </p>
            </div>
            <button
              onClick={() => {
                setShowPinHint(false)
                try { localStorage.setItem(TUTORIAL_PIN_HINT_SEEN_KEY, '1') } catch { /* noop */ }
              }}
              className="shrink-0 text-white/70 hover:text-white text-base leading-none px-1"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Tutorial-only: simulated QR scan button. Real events spawn QR
          codes on physical objects; the always-on demo can't, so we surface
          this button only when the current mission target is a tutorial QR
          (item or boss). The button's label + colour scheme adapt: teal
          spell for items, red skull-warning for the boss. */}
      {isTutorialSession && tutorialNextTarget && (() => {
        const isBoss = tutorialNextTarget === 'TUTBSS'
        const gradient = isBoss
          ? 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)'
          : 'linear-gradient(135deg, #3ABCA8 0%, #2d8c7d 100%)'
        const shadow = isBoss
          ? '0 6px 18px rgba(232,93,47,0.4)'
          : '0 6px 18px rgba(58,188,168,0.4)'
        const border = isBoss
          ? '1px solid rgba(232,93,47,0.6)'
          : '1px solid rgba(58,188,168,0.6)'
        return (
          <div className="absolute z-[850] bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
            {tutorialQrResult && (
              <div
                className="rounded-lg px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
                style={{
                  background: isBoss ? 'rgba(232,93,47,0.18)' : 'rgba(58,188,168,0.18)',
                  border: isBoss ? '1px solid rgba(232,93,47,0.35)' : '1px solid rgba(58,188,168,0.35)',
                  color: isBoss ? '#E85D2F' : '#3ABCA8',
                  maxWidth: 260,
                  textAlign: 'center',
                }}
              >
                {tutorialQrResult}
              </div>
            )}
            <button
              onClick={simulateTutorialQr}
              disabled={tutorialQrBusy}
              className="rounded-2xl px-4 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
              style={{ background: gradient, boxShadow: shadow, border }}
            >
              {tutorialQrBusy ? '...' : tutorialQrButtonLabel(tutorialNextTarget)}
            </button>
            <span className="text-[10px] text-white/40 font-mono">tutorial only</span>
          </div>
        )
      })()}

      {/* First-run coachmarks — fires once per device after onboarding+starter */}
      {showCoachmarks && (
        <Coachmark
          steps={MAP_COACHMARK_STEPS}
          onClose={() => {
            setShowCoachmarks(false)
            try { localStorage.setItem(COACHMARK_STORAGE_KEY, '1') } catch {}
          }}
        />
      )}

      {/* Session restarted overlay */}
      {sessionRestarted && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[1100] backdrop-blur-sm">
          <div className="bg-[#0F1F2E] border border-[#3A9DBC] rounded-2xl p-6 mx-4 text-center">
            <div className="text-3xl mb-3">🔄</div>
            <p className="text-white font-bold text-lg">Sessione ripristinata</p>
            <p className="text-white/60 text-sm mt-1">Verrai reindirizzato alla home...</p>
          </div>
        </div>
      )}

      {/* Top-left alerts column — stops before the right-side HUD (right-20 = 80px) */}
      <div className="absolute top-2 left-2 right-20 z-[1500] flex flex-col gap-1.5" style={{ pointerEvents: gpsError ? 'auto' : 'none' }}>
        {gpsError && (
          <GPSErrorBanner message={gpsError} />
        )}
        {!inBounds && (
          <div className="bg-red-900/90 text-red-200 text-xs px-3 py-2 rounded-xl backdrop-blur-sm font-semibold">
            🚫 Sei fuori dall'area di gioco
          </div>
        )}
      </div>

      {/* Top-left HUD — persistent "next objective" widget. Self-hides when
          no unlocked, non-completed mission exists. */}
      <div className="absolute top-2 left-2 z-[900]">
        <NextObjectiveWidget sessionId={sessionId} />
      </div>

      {/* Top-right HUD column — step counter + GPS accuracy + esca */}
      <div className="absolute top-2 right-2 z-[900] flex flex-col items-end gap-1.5">
        <motion.div
          data-coachmark="step-counter"
          className="bg-[#0F1F2E]/85 border border-white/10 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 relative overflow-hidden"
          // Subtle glow pulse when a credit fires — keyed off stepsWalked
          // (server-confirmed) so we don't fire on pending interpolation.
          animate={{ boxShadow: stepsWalked > 0 ? [
            '0 0 0 0 rgba(58,157,188,0)',
            '0 0 0 6px rgba(58,157,188,0.18)',
            '0 0 0 0 rgba(58,157,188,0)',
          ] : '0 0 0 0 rgba(58,157,188,0)' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          key={stepsWalked}
        >
          <span className="text-sm">👟</span>
          <div className="flex flex-col items-start leading-none">
            <span className="text-white font-bold text-sm leading-tight tabular-nums">{displayedSteps.toLocaleString('it-IT')} m</span>
            <span className="text-white/30 text-[9px] uppercase tracking-wide mt-0.5">Passi sessione</span>
          </div>
        </motion.div>
        {gpsAccuracy !== null && (
          <div className={`text-[10px] px-2 py-1 rounded-full backdrop-blur-sm border font-medium ${
            gpsAccuracy <= 20  ? 'bg-[#34D399]/15 border-[#34D399]/30 text-[#34D399]' :
            gpsAccuracy <= 100 ? 'bg-[#F7C841]/15 border-[#F7C841]/30 text-[#F7C841]' :
                                 'bg-[#E85D2F]/15 border-[#E85D2F]/30 text-[#E85D2F]'
          }`}>
            GPS ±{gpsAccuracy}m
          </div>
        )}
        {escaActiveUntil && escaSecondsLeft > 0 && (
          <div
            className="backdrop-blur-sm rounded-2xl px-3 py-2 flex items-center gap-2 whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.25) 0%, rgba(16,185,129,0.18) 100%)',
              border: '1.5px solid rgba(52,211,153,0.7)',
              boxShadow: '0 0 12px rgba(52,211,153,0.35), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <span className="text-base leading-none" style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.8))' }}>🪱</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-extrabold text-[#34D399] uppercase tracking-wider">Esca attiva</span>
              <span className="text-[11px] font-mono font-bold text-white">
                {Math.floor(escaSecondsLeft / 60)}:{String(escaSecondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Starter selection — shown when player has no creatures in this session */}
      {showStarterSelect && !starterPicked && (
        <StarterSelect
          starters={starters}
          onPicked={async (creature) => {
            const sid = sessionId
            if (!sid) return
            const res = await fetch('/api/game/starter/pick', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sid, creatureId: creature.id }),
            })
            if (res.ok) {
              setStarterPicked(creature)
              setShowStarterSelect(false)
              setCreatureImageUrl(creature.image_url)
              // Show the reveal card via the hatch queue (same bottom-sheet UI)
              setHatchQueue(prev => [{
                name: creature.name,
                rarity: creature.rarity,
                element: creature.element,
                image_url: creature.image_url,
                hp: creature.hp,
                atk: creature.atk,
                def: creature.def,
                description: creature.description,
                isStarter: true,
              }, ...prev])
            }
          }}
        />
      )}

      {/* Egg hatched modal — shows one at a time, queue advances on dismiss */}
      {hatchQueue.length > 0 && (
        <EggHatchModal
          key={hatchQueue[0].name + hatchQueue.length}
          creature={hatchQueue[0]}
          queueRemaining={hatchQueue.length - 1}
          onDone={() => setHatchQueue(prev => prev.slice(1))}
        />
      )}

      {/* QR scan button — dark glass, game-themed */}
      <button
        onClick={() => router.push('/game/missions?qr=1')}
        className="absolute bottom-4 right-4 z-[900] flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl transition-all active:scale-95"
        style={{
          background: 'rgba(10, 20, 35, 0.82)',
          border: '1.5px solid rgba(58,157,188,0.55)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 18px rgba(58,157,188,0.18), 0 4px 14px rgba(0,0,0,0.5)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#3A9DBC" strokeWidth="1.8"/>
          <rect x="5.5" y="5.5" width="3" height="3" rx="0.5" fill="#3A9DBC"/>
          <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="#3A9DBC" strokeWidth="1.8"/>
          <rect x="15.5" y="5.5" width="3" height="3" rx="0.5" fill="#3A9DBC"/>
          <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#3A9DBC" strokeWidth="1.8"/>
          <rect x="5.5" y="15.5" width="3" height="3" rx="0.5" fill="#3A9DBC"/>
          <path d="M13 13h2.5M13 16h2.5M13 19h2.5M16.5 13h4M16.5 16h4M16.5 19h4" stroke="#3A9DBC" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#3A9DBC' }}>SCAN</span>
      </button>

      {/* Walk mission reward modal */}
      {missionQueue.length > 0 && (
        <MissionRewardModal
          missions={missionQueue}
          onDone={() => {
            // When the standard rewards modal closes, collect any tutorial
            // moments tied to the missions that just completed and queue
            // them up. We dedupe via localStorage so revisiting an old
            // completion doesn't replay the modal.
            if (isTutorialSession) {
              const moments: TutorialMoment[] = []
              for (const m of missionQueue) {
                if (!m.missionId) continue
                const moment = TUTORIAL_MISSION_MOMENTS[m.missionId]
                if (moment && !hasSeenTutorialMoment(moment.key)) {
                  moments.push(moment)
                }
              }
              if (moments.length > 0) setTutorialMomentQueue(prev => [...prev, ...moments])
            }
            setMissionQueue([])
          }}
        />
      )}

      {/* Tutorial narrative beats — fired after MissionRewardModal closes */}
      {tutorialMomentQueue.length > 0 && (
        <TutorialMomentModal
          moment={tutorialMomentQueue[0]}
          onClose={() => setTutorialMomentQueue(prev => prev.slice(1))}
        />
      )}

      {/* Boss pin approach confirm — shown before auto-claiming a boss pin */}
      {pendingBossPin && (
        <BossApproachModal
          pin={pendingBossPin}
          sessionId={sessionId!}
          playerPos={lastPosRef.current}
          onFight={(reward) => {
            setClaimedPinIds(prev => new Set([...prev, pendingBossPin.id]))
            const sid = sessionIdRef.current
            if (sid) invalidateMapPinsCache(sid)
            setPendingBossPin(null)
            if (reward.bossFightId) {
              window.location.href = `/game/boss/${reward.bossFightId}`
            }
          }}
          onLater={() => {
            setDeclinedBossPinIds(prev => new Set([...prev, pendingBossPin.id]))
            setPendingBossPin(null)
          }}
        />
      )}

      {/* Enigma pin modal */}
      {pendingEnigmaPin && (
        <EnigmaModal
          pin={pendingEnigmaPin}
          sessionId={sessionId!}
          playerPos={lastPosRef.current}
          onSuccess={(reward) => {
            setClaimedPinIds(prev => new Set([...prev, pendingEnigmaPin.id]))
            const sid = sessionIdRef.current
            if (sid) invalidateMapPinsCache(sid)
            setPendingEnigmaPin(null)
            setPinReward(reward as PinRewardData)
          }}
          onClose={() => {
            // Mark declined so GPS doesn't re-trigger immediately; player can tap manually to retry
            setDeclinedEnigmaPinIds(prev => new Set([...prev, pendingEnigmaPin.id]))
            setPendingEnigmaPin(null)
          }}
        />
      )}

      {/* Pin proximity reward modal */}
      {pinReward && (
        <PinRewardModal
          reward={pinReward}
          onDone={() => setPinReward(null)}
        />
      )}

      {/* Encounter popup */}
      {showEncounterPopup && pendingEncounter && (
        <div className="absolute inset-x-4 bottom-16 bg-[#0F1F2E] border border-[#3A9DBC] rounded-2xl p-4 z-[1000] shadow-xl">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(58,157,188,0.18), rgba(255,255,255,0.04))',
                border: '1px solid rgba(58,157,188,0.28)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <CreatureSprite
                imageUrl={pendingEncounter.creature.image_url || pendingEncounter.creature.sprite_url || ''}
                name={pendingEncounter.creature.name}
                size={48}
                element={pendingEncounter.creature.element}
                rarity={pendingEncounter.creature.rarity}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Creatura selvatica</p>
              <p className="font-bold text-white truncate">{pendingEncounter.creature.name}</p>
              <p className="text-sm text-[#3A9DBC]">
                {pendingEncounter.creature.element} · {RARITY_LABELS[pendingEncounter.creature.rarity as keyof typeof RARITY_LABELS]}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                setShowEncounterPopup(false)
                // Keep encounterPopupRef.current = true through the navigation.
                // The map doesn't unmount instantly; between this click and the
                // actual unmount, a throttled position POST may still fire and
                // its response (triggerEncounter=true) would otherwise spawn a
                // second sound/vibration. Clearing pendingPosition + the
                // pending timeout makes the guard belt-and-braces.
                pendingPositionRef.current = null
                if (positionPostTimeoutRef.current) {
                  clearTimeout(positionPostTimeoutRef.current)
                  positionPostTimeoutRef.current = null
                }
                sessionStorage.removeItem('wc:pending_popup')
                router.push(`/game/encounter/${pendingEncounter.encounterId}`)
              }}
              className="flex-1 bg-[#E85D2F] text-white font-bold py-3 rounded-xl"
            >
              AFFRONTA
            </button>
            <button
              onClick={() => {
                setShowEncounterPopup(false)
                encounterPopupRef.current = false
                sessionStorage.removeItem('wc:pending_popup')
                lastEncounterRef.current = 0  // reset cooldown so GPS works immediately
                // Mark encounter as fled so DB doesn't block future encounters
                if (pendingEncounter) {
                  fetch('/api/game/encounter/flee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ encounterId: pendingEncounter.encounterId }),
                  }).catch(() => {})
                }
              }}
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

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0F1F2E]" />}>
      <MapPageInner />
    </Suspense>
  )
}
