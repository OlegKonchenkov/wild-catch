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
  const [showEncounterPopup, setShowEncounterPopup] = useState(false)
  const [pendingEncounter, setPendingEncounter] = useState<{ encounterId: string; creature: { name: string; element: string; rarity: string } } | null>(null)
  const lastEncounterRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // ?restored=<sessionId> comes from auth callback after re-login on a new device
    const restored = searchParams.get('restored')
    if (restored) {
      localStorage.setItem('current_session_id', restored)
      router.replace('/game/map')
      return
    }
    const sid = localStorage.getItem('current_session_id')
    if (!sid) { router.push('/home'); return }
    setSessionId(sid)
    sessionIdRef.current = sid

    supabase.from('sessions').select('*').eq('id', sid).single()
      .then(({ data }) => { if (data) setSession(data as unknown as Session) })
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
    if (data.encounterId) {
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
    }
  }, [])

  const onGPSPosition = useCallback(async (pos: { lat: number; lng: number; accuracy: number }) => {
    const sid = sessionIdRef.current
    if (!sid) return

    const now = Date.now()
    const res = await fetch('/api/game/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, sessionId: sid }),
    })
    const data = await res.json()

    if (data.sessionEnded) {
      router.push('/game/profile?ended=1')
      return
    }

    setInBounds(data.inBounds)

    if (data.triggerEncounter && now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS) {
      lastEncounterRef.current = now
      await triggerEncounter('gps')
    }
  }, [router, triggerEncounter])

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
        onEncounterTrigger={(id) => router.push(`/game/encounter/${id}`)}
        sessionId={sessionId!}
      />

      {/* GPS error */}
      {gpsError && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-900/90 text-yellow-200 text-sm px-3 py-2 rounded-lg z-10">
          ⚠️ {gpsError}
        </div>
      )}

      {/* Out of bounds */}
      {!inBounds && (
        <div className="absolute top-2 left-2 right-2 bg-red-900/90 text-red-200 text-sm px-3 py-2 rounded-lg z-10 text-center">
          🚫 Sei fuori dall'area di gioco — torna nella zona indicata!
        </div>
      )}

      {/* QR scan button */}
      <button
        onClick={() => router.push('/game/missions?qr=1')}
        className="absolute bottom-4 right-4 bg-[#3A9DBC] text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg z-10"
      >
        📷
      </button>

      {/* Encounter popup */}
      {showEncounterPopup && pendingEncounter && (
        <div className="absolute inset-x-4 bottom-16 bg-[#0F1F2E] border border-[#3A9DBC] rounded-2xl p-4 z-20 shadow-xl">
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
