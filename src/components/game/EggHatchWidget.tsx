'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiEggClutch } from 'react-icons/gi'
import useTweenedInteger from '@/hooks/useTweenedInteger'

/**
 * Compact "closest egg to hatching" HUD chip, stacked under the mission
 * widget. Eggs hatch on walked metres exactly like walk missions, but the
 * player otherwise has no on-map feedback on how close one is — they only
 * find out when the EggHatchModal pops. This chip mirrors the mission
 * widget's live cadence (same optimistic-step delta, same 450 ms tween,
 * same monotonic-max floor) so the two read as one coherent system.
 *
 * Deliberately lighter than NextObjectiveWidget: no big icon box, no
 * title — just 🥚 + a thin bar + "p/req m". Shows ONLY the single egg
 * with the fewest metres remaining; self-hides when there are none.
 */

interface EggView {
  id: string
  egg_rarity: string
  steps_required: number
  steps_progress: number   // server-clamped (stepsWalked - steps_at_pickup)
  can_hatch: boolean
}

const RARITY_COLOR: Record<string, string> = {
  comune:      '#7AB87A',
  non_comune:  '#4A9FD4',
  raro:        '#E8A820',
  epico:       '#7B4DB8',
  leggendario: '#C8352A',
  mitologico:  '#FF4D6D',
}

export default function EggHatchWidget({ sessionId }: { sessionId: string | null }) {
  const [egg, setEgg] = useState<EggView | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [optimisticDelta, setOptimisticDelta] = useState(0)
  const progressFloorRef = useRef<{ id: string | null; value: number }>({ id: null, value: 0 })
  const flushRequestedForRef = useRef<string | null>(null)

  const fetchEggs = useCallback(async () => {
    if (!sessionId) { setLoaded(true); return }
    try {
      const res = await fetch(`/api/game/eggs?sessionId=${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      const eggs: EggView[] = Array.isArray(data.eggs) ? data.eggs : []
      // Closest to hatching = smallest remaining (required − progress).
      // step-required 0 eggs hatch on next tick → treat remaining as 0.
      const closest = eggs
        .filter(e => e.steps_required >= 0)
        .sort((a, b) =>
          (a.steps_required - a.steps_progress) - (b.steps_required - b.steps_progress),
        )[0] ?? null
      setEgg(closest)
    } catch {
      // HUD hint only — a missed refresh self-corrects on the next event.
    } finally {
      setLoaded(true)
    }
  }, [sessionId])

  useEffect(() => { void fetchEggs() }, [fetchEggs])

  // Re-fetch on the shared stats-refresh event (fired by every gameplay
  // route that can change egg/step state, incl. the threshold flush).
  useEffect(() => {
    function onRefresh() { void fetchEggs() }
    window.addEventListener('wc:refresh-stats', onRefresh)
    return () => window.removeEventListener('wc:refresh-stats', onRefresh)
  }, [fetchEggs])

  // Live optimistic delta from the map page (same event the mission
  // widget consumes) so the bar ticks at GPS rate between server credits.
  useEffect(() => {
    function onDelta(e: Event) {
      const detail = (e as CustomEvent<{ delta: number }>).detail
      if (typeof detail?.delta === 'number') {
        setOptimisticDelta(Math.max(0, detail.delta))
      }
    }
    window.addEventListener('wc:optimistic-steps-delta', onDelta)
    return () => window.removeEventListener('wc:optimistic-steps-delta', onDelta)
  }, [])

  // New egg becomes "closest" → drop stale optimistic delta.
  useEffect(() => { setOptimisticDelta(0) }, [egg?.id])

  // Threshold flush: optimistic progress crossed steps_required but the
  // server hasn't hatched yet → ask the map page for one immediate
  // reconcile so the egg hatches now, not after another 10-20 steps.
  useEffect(() => {
    if (!egg) return
    if (flushRequestedForRef.current === egg.id) return
    const optimisticTotal = egg.steps_progress + optimisticDelta
    if (optimisticTotal >= egg.steps_required && !egg.can_hatch) {
      flushRequestedForRef.current = egg.id
      window.dispatchEvent(new CustomEvent('wc:request-position-flush'))
    }
  }, [egg, optimisticDelta])

  // Progress math (BEFORE the early-return so the tween hook keeps a
  // stable call order, same pattern as NextObjectiveWidget).
  const required = egg?.steps_required ?? 0
  const rawProgress = !egg
    ? 0
    : Math.min(required, egg.steps_progress + optimisticDelta)
  const floor = progressFloorRef.current
  const eggId = egg?.id ?? null
  if (floor.id !== eggId) {
    floor.id = eggId
    floor.value = rawProgress
  } else if (rawProgress > floor.value) {
    floor.value = rawProgress
  }
  const flooredProgress = Math.max(rawProgress, floor.value)
  const tweened = useTweenedInteger(flooredProgress, 450)

  if (!loaded || !egg || required <= 0) return null

  const pct = required > 0 ? Math.min(100, (tweened / required) * 100) : 0
  const color = RARITY_COLOR[egg.egg_rarity] ?? '#9CA3AF'

  return (
    <AnimatePresence>
      <motion.div
        key={egg.id}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden flex items-center gap-2 rounded-xl px-2.5 py-1.5"
        style={{
          width: 154,
          background:
            `radial-gradient(circle at 18% 18%, ${color}24, transparent 34%), ` +
            'linear-gradient(150deg, rgba(8,36,46,0.90) 0%, rgba(5,18,27,0.96) 100%)',
          border: `1.5px solid ${color}88`,
          boxShadow: `0 0 14px ${color}26, 0 6px 16px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: 'blur(10px) saturate(1.16)',
        }}
        data-testid="egg-hatch-widget"
      >
        <span
          className="pointer-events-none absolute inset-x-4 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}cc, transparent)` }}
        />
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `radial-gradient(circle, ${color}28 0%, rgba(8,30,38,0.66) 100%)`,
            border: `1px solid ${color}88`,
            boxShadow: `0 0 10px ${color}30, inset 0 0 9px ${color}18`,
          }}
        >
          <GiEggClutch size={15} color={color} style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className="text-[8px] font-black uppercase tracking-[0.14em]"
              style={{ color: `${color}`, textShadow: `0 0 7px ${color}55` }}
            >
              Uovo
            </span>
            <span className="text-[8.5px] font-mono tabular-nums shrink-0" style={{ color: 'rgba(255,255,255,0.62)' }}>
              {tweened}/{required}m
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 0 5px rgba(0,0,0,0.34)' }}>
            <motion.div
              className="h-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
              style={{ background: `linear-gradient(90deg, ${color}, #83F7FF)`, boxShadow: `0 0 8px ${color}aa` }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
