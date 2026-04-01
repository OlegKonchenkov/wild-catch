'use client'
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useGPS } from '@/hooks/useGPS'
import type { Session } from '@/lib/types'

// Dynamic import — Leaflet is not SSR-safe
const GameMap = dynamic(() => import('@/components/map/GameMap'), { ssr: false })

const ENCOUNTER_COOLDOWN_MS = 30000  // 30s between encounters
// Cumulative distance that, when exceeded, probabilistically triggers a walk-based encounter
const WALK_ENCOUNTER_DIST_M = 25  // trigger after accumulating ~25 m

function MapPageInner() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inBounds, setInBounds] = useState(true)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionRestarted, setSessionRestarted] = useState(false)
  const [escaActiveUntil, setEscaActiveUntil] = useState<Date | null>(null)
  const [stepsWalked, setStepsWalked] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [hatchedCreature, setHatchedCreature] = useState<{ name: string; rarity: string } | null>(null)
  const sessionEndedRef = useRef(false)
  const inBoundsRef = useRef(true)
  const [showEncounterPopup, setShowEncounterPopup] = useState(false)
  const [pendingEncounter, setPendingEncounter] = useState<{ encounterId: string; creature: { name: string; element: string; rarity: string } } | null>(null)
  const lastEncounterRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  // Tracks metres walked since the last encounter attempt — resets after each attempt
  const cumDistRef = useRef(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    function init(sid: string) {
      setSessionId(sid)
      sessionIdRef.current = sid
      localStorage.setItem('current_session_id', sid)
      supabase.from('sessions').select('*').eq('id', sid).single()
        .then(({ data }) => { if (data) setSession(data as unknown as Session) })
      // Load esca status
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('player_sessions')
          .select('esca_active_until')
          .eq('user_id', user.id)
          .eq('session_id', sid)
          .single()
          .then(({ data }) => {
            if (data?.esca_active_until) {
              const d = new Date(data.esca_active_until)
              if (d > new Date()) setEscaActiveUntil(d)
            }
          })
      })
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

  const triggerEncounter = useCallback(async (trigger: 'gps' | 'timer' = 'gps') => {
    const sid = sessionIdRef.current
    if (!sid) return
    const res = await fetch('/api/game/encounter/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, trigger }),
    })
    const data = await res.json()
    if (data.encounterId && data.creature) {
      cumDistRef.current = 0  // reset walk accumulator after a successful encounter
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
    } else if (data.encounterId) {
      // Encounter already in progress — go directly to the battle page
      router.push(`/game/encounter/${data.encounterId}`)
    }
  }, [router])

  const onGPSPosition = useCallback(async (pos: { lat: number; lng: number; accuracy: number }) => {
    const sid = sessionIdRef.current
    if (!sid || sessionEndedRef.current) return

    // Update accuracy display regardless of whether we send to server
    setGpsAccuracy(Math.round(pos.accuracy))

    // Skip very inaccurate fixes for server calls (map marker still updates from useGPS).
    // 300m is generous — on poor GPS we still want step counting to work.
    if (pos.accuracy > 300) return

    const now = Date.now()
    const res = await fetch('/api/game/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, sessionId: sid }),
    })
    if (!res.ok) return  // network/auth error — keep current inBounds state

    const data = await res.json()

    if (data.sessionEnded) {
      sessionEndedRef.current = true
      setSessionEnded(true)
      return
    }

    if (data.inBounds !== undefined) {
      setInBounds(data.inBounds)
      inBoundsRef.current = data.inBounds
    }

    // Update step counter from server's authoritative value
    if (typeof data.stepsWalked === 'number') {
      setStepsWalked(data.stepsWalked)
    }

    // Show hatch notification for the first egg that hatched (auto-hatched server-side)
    if (data.eggsHatched?.length > 0) {
      setHatchedCreature(data.eggsHatched[0])
      setTimeout(() => setHatchedCreature(null), 5000)
    }

    // Accumulate distance for walk-based encounter trigger
    if (typeof data.distanceMoved === 'number' && data.distanceMoved > 0 && data.distanceMoved < 500) {
      cumDistRef.current += data.distanceMoved
    }

    const cooldownPassed = now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS

    // GPS-based trigger (single update moved ≥ 5 m, 30% chance)
    if (data.triggerEncounter && cooldownPassed) {
      lastEncounterRef.current = now
      cumDistRef.current = 0
      await triggerEncounter('gps')
      return
    }

    // Walk-accumulation trigger: fired after WALK_ENCOUNTER_DIST_M metres since last attempt
    if (cumDistRef.current >= WALK_ENCOUNTER_DIST_M && cooldownPassed) {
      cumDistRef.current = 0
      lastEncounterRef.current = now
      await triggerEncounter('gps')
    }
  }, [triggerEncounter])

  const { position, error: gpsError } = useGPS(onGPSPosition)

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
        if (!inBoundsRef.current) { scheduleTimerEncounter(); return }
        const now = Date.now()
        if (now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS) {
          lastEncounterRef.current = now
          try {
            await triggerEncounter('timer')
          } catch {
            // network error — reset cooldown so the next timer tick can retry
            lastEncounterRef.current = 0
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

  // Clear esca indicator when it expires
  useEffect(() => {
    if (!escaActiveUntil) return
    const ms = escaActiveUntil.getTime() - Date.now()
    if (ms <= 0) { setEscaActiveUntil(null); return }
    const t = setTimeout(() => setEscaActiveUntil(null), ms)
    return () => clearTimeout(t)
  }, [escaActiveUntil])

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

  if (!session) {
    return <div className="flex items-center justify-center h-full text-white">Caricamento mappa...</div>
  }

  return (
    <div className="relative w-full h-full">
      <GameMap
        session={session}
        playerPosition={position ? { lat: position.lat, lng: position.lng } : null}
        sessionId={sessionId!}
      />

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

      {/* Session ended overlay on map */}
      {sessionEnded && (
        <div className="absolute top-2 left-2 right-2 bg-[#7B4DB8]/80 text-[#E9D5FF] text-xs px-3 py-2 rounded-xl z-[900] text-center backdrop-blur-sm">
          🏁 Sessione terminata — la mappa è in sola lettura
        </div>
      )}

      {/* GPS error */}
      {gpsError && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-900/90 text-yellow-200 text-sm px-3 py-2 rounded-lg z-[900]">
          ⚠️ {gpsError}
        </div>
      )}

      {/* Out of bounds */}
      {!inBounds && (
        <div className="absolute top-2 left-2 right-2 bg-red-900/90 text-red-200 text-sm px-3 py-2 rounded-lg z-[900] text-center">
          🚫 Sei fuori dall'area di gioco — torna nella zona indicata!
        </div>
      )}

      {/* Step counter + GPS accuracy overlay */}
      <div className="absolute top-2 right-2 z-[900] flex flex-col items-end gap-1.5">
        <div className="bg-[#0F1F2E]/85 border border-white/10 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-sm">👟</span>
          <div className="flex flex-col items-start leading-none">
            <span className="text-white font-bold text-sm leading-tight">{stepsWalked.toLocaleString('it-IT')} m</span>
            <span className="text-white/30 text-[9px] uppercase tracking-wide mt-0.5">Passi sessione</span>
          </div>
        </div>
        {gpsAccuracy !== null && (
          <div className={`text-[10px] px-2 py-1 rounded-full backdrop-blur-sm border font-medium ${
            gpsAccuracy <= 20  ? 'bg-[#34D399]/15 border-[#34D399]/30 text-[#34D399]' :
            gpsAccuracy <= 100 ? 'bg-[#F7C841]/15 border-[#F7C841]/30 text-[#F7C841]' :
                                 'bg-[#E85D2F]/15 border-[#E85D2F]/30 text-[#E85D2F]'
          }`}>
            GPS ±{gpsAccuracy}m
          </div>
        )}
      </div>

      {/* Esca active indicator */}
      {escaActiveUntil && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#34D399]/20 border border-[#34D399]/40 text-[#34D399] text-xs px-3 py-1.5 rounded-full z-[900] flex items-center gap-1.5 backdrop-blur-sm whitespace-nowrap">
          <span>🪱</span>
          <span className="font-semibold">Esca attiva</span>
        </div>
      )}

      {/* Egg hatched notification */}
      {hatchedCreature && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#C084FC]/20 border border-[#C084FC]/40 text-[#E9D5FF] text-sm px-4 py-2.5 rounded-2xl z-[900] flex items-center gap-2 backdrop-blur-sm whitespace-nowrap shadow-lg">
          <span className="text-lg">🥚</span>
          <div>
            <div className="font-bold leading-tight">Uovo schiuso!</div>
            <div className="text-xs text-[#C084FC]">{hatchedCreature.name} · {hatchedCreature.rarity}</div>
          </div>
        </div>
      )}

      {/* QR scan button */}
      <button
        onClick={() => router.push('/game/missions?qr=1')}
        className="absolute bottom-4 right-4 bg-[#3A9DBC] text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg z-[900]"
      >
        📷
      </button>

      {/* Encounter popup */}
      {showEncounterPopup && pendingEncounter && (
        <div className="absolute inset-x-4 bottom-16 bg-[#0F1F2E] border border-[#3A9DBC] rounded-2xl p-4 z-[1000] shadow-xl">
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

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0F1F2E]" />}>
      <MapPageInner />
    </Suspense>
  )
}
