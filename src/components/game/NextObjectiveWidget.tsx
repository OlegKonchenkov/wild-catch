'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import useTweenedInteger from '@/hooks/useTweenedInteger'

export interface NextObjective {
  id: string
  title: string
  type: string
  target: string | null
  target_count: number
  progress: number
  reward_gold: number
  reward_exp: number
  chapter_order: number | null
}

const TYPE_META: Record<string, { icon: string; verb: string }> = {
  cattura:  { icon: '🐾', verb: 'Cattura' },
  duel:     { icon: '⚔️', verb: 'Vinci'   },
  qr:       { icon: '📷', verb: 'Scansiona' },
  walk:     { icon: '🚶', verb: 'Cammina'  },
  collect:  { icon: '🎒', verb: 'Raccogli' },
}

/**
 * Persistent "next objective" HUD on the map. Renders the lowest-order,
 * unlocked, not-yet-completed mission for the current session so the player
 * always knows what to do next — the single biggest "what now?" UX gap.
 *
 * - Tap → /game/missions with the objective scrolled into view.
 * - Auto-refreshes via Supabase realtime on player_missions changes.
 * - Self-hides when objective is null (all done / no missions configured).
 */
export default function NextObjectiveWidget({ sessionId }: { sessionId: string | null }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [objective, setObjective] = useState<NextObjective | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Optimistic step delta broadcast by the map page on every GPS fix
  // (see wc:optimistic-steps-delta in src/app/game/map/page.tsx). For
  // walk missions we add this to the server-reported progress so the
  // bar ticks smoothly between server credits, matching the top-right
  // step counter's cadence. Reset to 0 whenever the underlying
  // objective changes (different mission → different baseline).
  const [optimisticDelta, setOptimisticDelta] = useState(0)
  // Monotonic-max guard: the displayed progress for a given objective must
  // never visually tick backward, even if a server refetch briefly reports
  // a lower number than the optimistic local view (server credits lag the
  // client). Keyed by objective id so a NEW mission legitimately starts
  // from its own (lower) baseline.
  const progressFloorRef = useRef<{ id: string | null; value: number }>({ id: null, value: 0 })
  // Tracks the objective id we've already asked the map page to flush for,
  // so we request an immediate server reconcile exactly ONCE per mission
  // when the optimistic counter first crosses its target — not every fix.
  const flushRequestedForRef = useRef<string | null>(null)

  const fetchNext = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/game/missions/next?sessionId=${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      setObjective(data.objective ?? null)
    } catch {
      // Silent: this is a HUD hint, not core gameplay. A missed refresh
      // will be corrected on the next realtime tick.
    } finally {
      setLoaded(true)
    }
  }, [sessionId])

  // Initial fetch.
  useEffect(() => {
    void fetchNext()
  }, [fetchNext])

  // Realtime: re-fetch whenever this user's player_missions row changes.
  // Mission progress is the only signal we care about — any UPDATE/INSERT
  // could change which mission is "next".
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let unsub: (() => void) | null = null

    getCurrentUser(supabase).then(user => {
      if (cancelled || !user) return
      const channel = supabase
        .channel(`next-obj:${user.id}:${sessionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'player_missions',
          filter: `user_id=eq.${user.id}`,
        }, () => { void fetchNext() })
        .subscribe()
      unsub = () => { supabase.removeChannel(channel) }
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [supabase, sessionId, fetchNext])

  // Window-event fallback: realtime postgres_changes can be flaky (small
  // delays, dropped events on backgrounded tabs, publication misconfig).
  // Every gameplay route that progresses a mission also dispatches
  // `wc:refresh-stats`, so listening here guarantees the widget refreshes
  // immediately even if realtime missed the row update.
  useEffect(() => {
    function onRefresh() { void fetchNext() }
    window.addEventListener('wc:refresh-stats', onRefresh)
    return () => window.removeEventListener('wc:refresh-stats', onRefresh)
  }, [fetchNext])

  // Optimistic step delta listener — keeps the walk progress bar moving
  // between server credits at the same cadence as the top-right step
  // counter. We trust whatever the page broadcasts; if it ever stops
  // emitting (different page mounted, GPS off) the delta naturally stays
  // at its last value, and the next server credit resets it to 0.
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

  // When the objective ROW changes (different mission unlocked), drop
  // any stale optimistic delta — the new mission has its own baseline.
  useEffect(() => {
    setOptimisticDelta(0)
  }, [objective?.id])

  // Threshold flush: the optimistic counter just crossed this walk
  // mission's target but the server (5 s POST cadence) hasn't credited
  // it yet. Ask the map page for ONE immediate position reconcile so the
  // mission completes now instead of after another 10-20 steps. Fires
  // once per objective (guarded by flushRequestedForRef) and only when
  // the server itself hasn't already completed it.
  useEffect(() => {
    if (!objective || objective.type !== 'walk') return
    if (flushRequestedForRef.current === objective.id) return
    const serverProgress = objective.progress
    const optimisticTotal = serverProgress + optimisticDelta
    if (optimisticTotal >= objective.target_count && serverProgress < objective.target_count) {
      flushRequestedForRef.current = objective.id
      window.dispatchEvent(new CustomEvent('wc:request-position-flush'))
    }
  }, [objective, optimisticDelta])

  // ── Progress computation (runs every render, BEFORE the early-return
  //    guard, so the tween hook below keeps a stable call order) ────────
  const target = objective?.target_count ?? 0
  const isWalk = objective?.type === 'walk'
  // Only walk missions track from the optimistic step counter. Other
  // types (cattura, qr, duel) tick by discrete events that the server
  // already reconciles immediately, so no smoothing is needed there.
  const rawProgress = !objective
    ? 0
    : isWalk
      ? Math.min(target, objective.progress + optimisticDelta)
      : Math.min(target, objective.progress)
  // Monotonic-max floor — reset when the objective id changes (a
  // different mission legitimately starts from a lower point).
  const floor = progressFloorRef.current
  const objId = objective?.id ?? null
  if (floor.id !== objId) {
    floor.id = objId
    floor.value = rawProgress
  } else if (rawProgress > floor.value) {
    floor.value = rawProgress
  }
  const flooredProgress = Math.max(rawProgress, floor.value)
  // Tween at the SAME 450 ms as the top-right step counter
  // (useTweenedInteger in map/page.tsx) so a +N jump animates at the
  // same rate in both places — the player perceives the two counters
  // moving together instead of one snapping while the other glides.
  const tweenedProgress = useTweenedInteger(flooredProgress, 450)

  if (!loaded || !objective) return null

  const meta = TYPE_META[objective.type] ?? { icon: '🎯', verb: 'Completa' }
  const pct = target > 0 ? Math.min(100, (tweenedProgress / target) * 100) : 0
  // Variable kept for the JSX below — `progress` is shown alongside the
  // bar (e.g. "12/50 m"). Use the tweened value so the number and bar
  // stay in sync with each other and with the main step counter.
  const progress = tweenedProgress

  function onTap() {
    router.push(`/game/missions?focus=${encodeURIComponent(objective!.id)}`)
  }

  return (
    <AnimatePresence>
      <motion.button
        key={objective.id}
        onClick={onTap}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
        className="text-left rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2.5 shadow-lg active:scale-[0.98]"
        style={{
          background: 'rgba(15,31,46,0.88)',
          border: '1px solid rgba(58,188,168,0.35)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.4), 0 0 0 1px rgba(58,188,168,0.12)',
          maxWidth: 280,
        }}
        data-testid="next-objective-widget"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ background: 'rgba(58,188,168,0.15)', border: '1px solid rgba(58,188,168,0.3)' }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#3ABCA8]">
              Prossimo
            </span>
            {objective.chapter_order != null && (
              <span className="text-[9px] text-white/30 font-mono">#{objective.chapter_order}</span>
            )}
          </div>
          <p className="text-white font-bold text-xs leading-tight truncate">{objective.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4 }}
                style={{ background: 'linear-gradient(90deg, #3ABCA8 0%, #34D399 100%)' }}
              />
            </div>
            <span className="text-[10px] text-white/55 font-mono tabular-nums shrink-0">
              {isWalk ? `${progress}/${target}m` : `${progress}/${target}`}
            </span>
          </div>
        </div>
      </motion.button>
    </AnimatePresence>
  )
}
