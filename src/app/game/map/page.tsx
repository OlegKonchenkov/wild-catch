'use client'
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useGPS } from '@/hooks/useGPS'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { GameMapSkeleton } from '@/components/game/GameLoading'
import MissionRewardModal from '@/components/game/MissionRewardModal'
import type { CompletedMissionInfo } from '@/components/game/MissionRewardModal'
import type { Session } from '@/lib/types'
import { RARITY_LABELS } from '@/lib/types'
import type { MapPin } from '@/components/map/GameMap'

// Dynamic import — Leaflet is not SSR-safe
const GameMap = dynamic(() => import('@/components/map/GameMap'), { ssr: false })

const ENCOUNTER_COOLDOWN_MS = 30000  // 30s between encounters
// Cumulative distance that, when exceeded, probabilistically triggers a walk-based encounter
const WALK_ENCOUNTER_DIST_M = 25  // trigger after accumulating ~25 m

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

function EggHatchModal({
  creature,
  queueRemaining = 0,
  onDone,
}: {
  creature: { name: string; rarity: string; element: string; image_url: string | null; hp?: number; atk?: number; def?: number; description?: string | null; isStarter?: boolean }
  queueRemaining?: number
  onDone: () => void
}) {
  const [phase, setPhase] = useState<'shake' | 'crack' | 'reveal'>('shake')
  const [cardVisible, setCardVisible] = useState(false)

  useEffect(() => {
    if (creature.isStarter) {
      setPhase('reveal')
      const t = setTimeout(() => setCardVisible(true), 80)
      return () => clearTimeout(t)
    }
    const t1 = setTimeout(() => setPhase('crack'), 900)
    const t2 = setTimeout(() => { setPhase('reveal'); setTimeout(() => setCardVisible(true), 80) }, 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const rarityColor = RARITY_COLOR[creature.rarity] ?? '#9CA3AF'
  const glow = ELEMENT_GLOW[creature.element] ?? rarityColor
  const elemEmoji = ELEMENT_EMOJI[creature.element] ?? '✦'

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center bg-black/88 backdrop-blur-sm">
      {/* Egg animation phases — centered */}
      {phase !== 'reveal' && (
        <div
          className="text-8xl select-none"
          style={{ animation: phase === 'shake' ? 'eggShake 0.85s ease-in-out' : 'eggCrack 0.85s ease-out' }}
        >
          {phase === 'shake' ? '🥚' : '🐣'}
        </div>
      )}

      {/* Reveal — bottom sheet card */}
      {phase === 'reveal' && (
        <>
          {/* Tap backdrop to dismiss */}
          <div className="absolute inset-0" onClick={onDone} />

          {/* Sliding card */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-y-auto"
            style={{
              background: '#080E1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
              maxHeight: '88vh',
              transform: cardVisible ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 mb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Element-tinted header + sprite */}
            <div className="relative pt-2 pb-2" style={{
              background: `linear-gradient(180deg, ${glow}18 0%, transparent 100%)`,
            }}>
              {/* Badge */}
              <div className="flex justify-center mb-3">
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full font-extrabold text-sm"
                  style={{
                    background: glow,
                    color: '#080E1A',
                    boxShadow: `0 4px 20px ${glow}60`,
                    opacity: cardVisible ? 1 : 0,
                    transform: cardVisible ? 'scale(1)' : 'scale(0.6)',
                    transition: 'opacity 0.3s 0.15s, transform 0.4s 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {creature.isStarter ? '🌟 Il tuo Starter!' : '🥚 Schiuso!'}
                </div>
              </div>

              {/* Sprite */}
              <div className="flex justify-center" style={{
                opacity: cardVisible ? 1 : 0,
                transform: cardVisible ? 'scale(1)' : 'scale(0.5)',
                transition: 'opacity 0.35s 0.1s, transform 0.45s 0.1s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <CreatureSprite
                  imageUrl={creature.image_url ?? ''}
                  name={creature.name}
                  animState="idle"
                  size={160}
                  element={creature.element as any}
                  rarity={creature.rarity as any}
                  showAura
                />
              </div>
            </div>

            {/* Info */}
            <div className="px-5 pb-8">
              {/* Name + element + rarity */}
              <div className="text-center mb-4" style={{
                opacity: cardVisible ? 1 : 0,
                transition: 'opacity 0.3s 0.25s',
              }}>
                <h3 className="text-2xl font-bold text-white mb-1">{creature.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-base">{elemEmoji}</span>
                  <span className="text-xs capitalize text-white/40">{creature.element}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${rarityColor}22`, color: rarityColor, border: `1px solid ${rarityColor}55` }}>
                    {RARITY_LABEL[creature.rarity] ?? creature.rarity}
                  </span>
                </div>
                {creature.description && (
                  <p className="text-sm text-white/45 mt-3 leading-relaxed">{creature.description}</p>
                )}
              </div>

              {/* Stats */}
              {(creature.hp || creature.atk || creature.def) && (
                <div className="grid grid-cols-3 gap-2 mb-5" style={{
                  opacity: cardVisible ? 1 : 0,
                  transition: 'opacity 0.3s 0.32s',
                }}>
                  {[
                    { label: 'HP',  value: creature.hp,  color: '#F87171' },
                    { label: 'ATK', value: creature.atk, color: '#FB923C' },
                    { label: 'DEF', value: creature.def, color: '#60A5FA' },
                  ].map(s => (
                    <div key={s.label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${s.color}20` }}
                    >
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-white/35 mt-0.5 font-semibold uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={onDone}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
                style={{
                  background: `linear-gradient(135deg, ${glow} 0%, ${glow}99 100%)`,
                  boxShadow: `0 4px 24px ${glow}45`,
                  opacity: cardVisible ? 1 : 0,
                  transition: 'opacity 0.3s 0.4s',
                }}
              >
                {creature.isStarter
                  ? 'Inizia l\'avventura!'
                  : queueRemaining > 0
                    ? `Continua · ancora ${queueRemaining} ${queueRemaining === 1 ? 'uovo' : 'uova'}`
                    : 'Continua'
                }
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes eggShake {
          0%,100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-10deg) scale(1.05); }
          30% { transform: rotate(10deg) scale(1.05); }
          45% { transform: rotate(-8deg) scale(1.08); }
          60% { transform: rotate(8deg) scale(1.08); }
          75% { transform: rotate(-5deg) scale(1.1); }
          90% { transform: rotate(5deg) scale(1.1); }
        }
        @keyframes eggCrack {
          0% { transform: scale(1); }
          30% { transform: scale(1.3); }
          60% { transform: scale(0.9); }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

interface StarterCreature {
  id: string
  name: string
  rarity: string
  element: string
  image_url: string | null
  sprite_url: string | null
  hp: number
  atk: number
  def: number
  description: string | null
}

function StarterSelect({
  starters,
  onPicked,
}: {
  starters: StarterCreature[]
  onPicked: (creature: StarterCreature) => void
}) {
  const [selected, setSelected] = useState<StarterCreature | null>(null)
  const [confirming, setConfirming] = useState(false)

  const glow = selected ? (ELEMENT_GLOW[selected.element] ?? '#3A9DBC') : '#3A9DBC'
  const rarityColor = selected ? (RARITY_COLOR[selected.rarity] ?? '#9CA3AF') : '#9CA3AF'

  return (
    <div
      className="fixed inset-0 z-[1300] flex flex-col"
      style={{ background: 'linear-gradient(180deg, #020810 0%, #080E1A 100%)' }}
    >
      {/* Header */}
      <div className="shrink-0 px-5 pt-10 pb-4 text-center">
        <div
          className="inline-block text-4xl mb-3"
          style={{ animation: 'starterFloat 3s ease-in-out infinite' }}
        >
          🌟
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Scegli il tuo Starter!</h1>
        <p className="text-sm text-white/45 mt-1">La tua prima creatura compagna di avventura</p>
      </div>

      {/* Creature grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {starters.map(c => {
            const isSelected = selected?.id === c.id
            const cGlow = ELEMENT_GLOW[c.element] ?? '#3A9DBC'
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="relative rounded-2xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95"
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${cGlow}22 0%, ${cGlow}10 100%)`
                    : 'rgba(255,255,255,0.04)',
                  border: isSelected
                    ? `2px solid ${cGlow}`
                    : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: isSelected ? `0 0 18px ${cGlow}40` : 'none',
                }}
              >
                {/* Sprite */}
                <div className="w-24 h-24 flex items-center justify-center">
                  <CreatureSprite
                    imageUrl={c.image_url ?? ''}
                    name={c.name}
                    animState="idle"
                    size={88}
                    element={c.element as any}
                    rarity={c.rarity as any}
                    showAura={isSelected}
                  />
                </div>
                <p className="text-sm font-bold text-white text-center leading-tight">{c.name}</p>
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${cGlow}22`, color: cGlow }}
                >
                  {ELEMENT_EMOJI[c.element] ?? '✦'} {c.element}
                </div>
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: cGlow }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#080E1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel — slides up when a creature is selected */}
      <div
        className="shrink-0 rounded-t-3xl overflow-hidden"
        style={{
          background: '#080E1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          transform: selected ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '55vh',
        }}
      >
        {selected && (
          <div className="overflow-y-auto max-h-full">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 mb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Element header + sprite */}
            <div
              className="relative px-5 pt-2 pb-3"
              style={{ background: `linear-gradient(180deg, ${glow}18 0%, transparent 100%)` }}
            >
              <div className="flex items-center gap-4">
                <CreatureSprite
                  imageUrl={selected.image_url ?? ''}
                  name={selected.name}
                  animState="idle"
                  size={96}
                  element={selected.element as any}
                  rarity={selected.rarity as any}
                  showAura
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-white leading-tight">{selected.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${rarityColor}22`, color: rarityColor, border: `1px solid ${rarityColor}44` }}
                    >
                      {RARITY_LABEL[selected.rarity] ?? selected.rarity}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${glow}22`, color: glow }}
                    >
                      {ELEMENT_EMOJI[selected.element] ?? '✦'} {selected.element}
                    </span>
                  </div>
                  {/* Stats row */}
                  <div className="flex gap-2 mt-2">
                    {[
                      { label: 'HP',  value: selected.hp,  color: '#F87171' },
                      { label: 'ATK', value: selected.atk, color: '#FB923C' },
                      { label: 'DEF', value: selected.def, color: '#60A5FA' },
                    ].map(s => (
                      <div key={s.label} className="flex flex-col items-center">
                        <span className="text-base font-bold" style={{ color: s.color }}>{s.value}</span>
                        <span className="text-[9px] text-white/35 font-semibold uppercase tracking-wide">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selected.description && (
                <p className="text-xs text-white/45 mt-3 leading-relaxed">{selected.description}</p>
              )}
            </div>

            {/* CTA */}
            <div className="px-5 pb-6 pt-2">
              <button
                disabled={confirming}
                onClick={async () => {
                  if (!selected || confirming) return
                  setConfirming(true)
                  onPicked(selected)
                }}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-base disabled:opacity-70 transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${glow} 0%, ${glow}99 100%)`,
                  boxShadow: `0 4px 24px ${glow}45`,
                  color: '#080E1A',
                }}
              >
                {confirming ? 'Scelgo...' : `Scegli ${selected.name}!`}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes starterFloat {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
      `}</style>
    </div>
  )
}

function MapPageInner() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inBounds, setInBounds] = useState(true)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionRestarted, setSessionRestarted] = useState(false)
  const [escaActiveUntil, setEscaActiveUntil] = useState<Date | null>(null)
  const [creatureImageUrl, setCreatureImageUrl] = useState<string | null>(null)
  const [mapPins, setMapPins] = useState<MapPin[]>([])
  const [stepsWalked, setStepsWalked] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [hatchQueue, setHatchQueue] = useState<{ name: string; rarity: string; element: string; image_url: string | null; hp?: number; atk?: number; def?: number; description?: string | null; isStarter?: boolean }[]>([])
  const [missionQueue, setMissionQueue] = useState<CompletedMissionInfo[]>([])
  const [showStarterSelect, setShowStarterSelect] = useState(false)
  const [starters, setStarters] = useState<StarterCreature[]>([])
  const [starterPicked, setStarterPicked] = useState<StarterCreature | null>(null)
  const [starterCheckPending, setStarterCheckPending] = useState(true)
  const starterCheckedRef = useRef(false)
  const starterFlowLockedRef = useRef(true)
  const sessionEndedRef = useRef(false)
  const inBoundsRef = useRef(true)
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
  // Tracks metres walked since the last encounter attempt — resets after each attempt
  const cumDistRef = useRef(0)
  // Prevent concurrent triggerEncounter calls (mutex) and skip when popup is already open
  const triggeringEncounterRef = useRef(false)
  const encounterPopupRef = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    function init(sid: string) {
      starterCheckedRef.current = false
      starterFlowLockedRef.current = true
      setSessionId(sid)
      sessionIdRef.current = sid
      localStorage.setItem('current_session_id', sid)
      setSession(null)
      setStarterCheckPending(true)
      setShowStarterSelect(false)
      setStarters([])
      setStarterPicked(null)
      setCreatureImageUrl(null)
      supabase.from('sessions').select('*').eq('id', sid).single()
        .then(({ data }) => { if (data) setSession(data as unknown as Session) })
      // Load esca status
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('player_sessions')
          .select('esca_active_until, selected_creature_id, steps_walked')
          .eq('user_id', user.id)
          .eq('session_id', sid)
          .single()
          .then(({ data }) => {
            if (data?.esca_active_until) {
              const d = new Date(data.esca_active_until)
              if (d > new Date()) setEscaActiveUntil(d)
            }
            if (typeof data?.steps_walked === 'number') {
              setStepsWalked(data.steps_walked)
            }
            // Load selected creature image
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
      // Load map pins
      fetch(`/api/game/map-pins?sessionId=${sid}`)
        .then(r => r.json())
        .then((d: { pins?: MapPin[] }) => { if (d.pins) setMapPins(d.pins) })
        .catch(() => {})
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
        setShowEncounterPopup(true)
        encounterPopupRef.current = true
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

    // Enqueue all auto-hatched eggs — shown one at a time
    if (data.eggsHatched?.length > 0) {
      setHatchQueue(prev => [...prev, ...data.eggsHatched])
    }

    // Queue walk mission completions for the modal
    if (data.completedMissions?.length > 0) {
      setMissionQueue(prev => [...prev, ...data.completedMissions])
    }

    if (starterFlowLockedRef.current) return

    // Accumulate distance for walk-based encounter trigger
    if (typeof data.distanceMoved === 'number' && data.distanceMoved > 0 && data.distanceMoved < 500) {
      cumDistRef.current += data.distanceMoved
    }

    const cooldownPassed = now - lastEncounterRef.current > ENCOUNTER_COOLDOWN_MS

    // GPS-based trigger (single update moved ≥ 5 m, 30% chance)
    if (data.triggerEncounter && cooldownPassed) {
      const started = await triggerEncounter('gps')
      if (started) { lastEncounterRef.current = now; cumDistRef.current = 0 }
      return
    }

    // Walk-accumulation trigger: fired after WALK_ENCOUNTER_DIST_M metres since last attempt
    if (cumDistRef.current >= WALK_ENCOUNTER_DIST_M && cooldownPassed) {
      const started = await triggerEncounter('gps')
      if (started) { lastEncounterRef.current = now; cumDistRef.current = 0 }
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

  // Check if player needs to pick a starter (first time in session)
  useEffect(() => {
    if (!sessionId || !starterSessionStatus || starterCheckedRef.current) return

    if (!['ready', 'active'].includes(starterSessionStatus)) {
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
  }, [sessionId, starterSessionStatus])

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
    <div className="relative w-full h-full">
      <GameMap
        session={session}
        playerPosition={position ? { lat: position.lat, lng: position.lng } : null}
        sessionId={sessionId!}
        creatureImageUrl={creatureImageUrl}
        pins={mapPins}
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

      {/* Top-left alerts column — stops before the right-side HUD (right-20 = 80px) */}
      <div className="absolute top-2 left-2 right-20 z-[900] flex flex-col gap-1.5" style={{ pointerEvents: gpsError ? 'auto' : 'none' }}>
        {gpsError && (
          <GPSErrorBanner message={gpsError} />
        )}
        {!inBounds && (
          <div className="bg-red-900/90 text-red-200 text-xs px-3 py-2 rounded-xl backdrop-blur-sm font-semibold">
            🚫 Sei fuori dall'area di gioco
          </div>
        )}
      </div>

      {/* Top-right HUD column — step counter + GPS accuracy + esca */}
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
          onDone={() => setMissionQueue([])}
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
                encounterPopupRef.current = false
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
