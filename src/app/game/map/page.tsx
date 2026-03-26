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

function MapPageInner() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inBounds, setInBounds] = useState(true)
  const [sessionEnded, setSessionEnded] = useState(false)
  const sessionEndedRef = useRef(false)
  const inBoundsRef = useRef(true)
  const [showEncounterPopup, setShowEncounterPopup] = useState(false)
  const [pendingEncounter, setPendingEncounter] = useState<{ encounterId: string; creature: { name: string; element: string; rarity: string } } | null>(null)
  const lastEncounterRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
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

    // Skip inaccurate fixes — they would store wrong coordinates in the DB
    // and trigger false "fuori dall'area" warnings. The map marker still
    // updates from useGPS state regardless of this server-call filter.
    if (pos.accuracy > 100) return

    const now = Date.now()
    const res = await fetch('/api/game/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, sessionId: sid }),
    })
    if (!res.ok) return  // network/auth error — keep current inBounds state

    const data = await res.json()

    if (data.sessionEnded) {
      // Session over — stop future GPS calls, show read-only banner (no redirect)
      sessionEndedRef.current = true
      setSessionEnded(true)
      return
    }

    // Only update inBounds from responses that include it (valid position calls)
    if (data.inBounds !== undefined) {
      setInBounds(data.inBounds)
      inBoundsRef.current = data.inBounds
    }

    if (data.triggerEncounter && now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS) {
      lastEncounterRef.current = now
      await triggerEncounter('gps')
    }
  }, [triggerEncounter])

  const { position, error: gpsError } = useGPS(onGPSPosition)

  // Timer-based encounter fallback
  useEffect(() => {
    const sid = sessionIdRef.current
    if (!sid) return
    const minMs = 60000, maxMs = 180000
    let timeout: ReturnType<typeof setTimeout>

    function scheduleTimerEncounter() {
      const delay = minMs + Math.random() * (maxMs - minMs)
      timeout = setTimeout(async () => {
        if (sessionEndedRef.current) return
        if (!inBoundsRef.current) { scheduleTimerEncounter(); return }
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
  }, [sessionId, triggerEncounter])

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
