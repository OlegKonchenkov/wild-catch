'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { swr } from '@/lib/cache'
import type { Mission } from '@/lib/types'
import { GameListSkeleton } from '@/components/game/GameLoading'
import { getMissionUnlockState, type MissionUnlockState } from '@/lib/game/mission-unlocks'
import { isTutorialSession } from '@/lib/game/tutorial'
import { periodKeyFor, RECURRENCE_LABELS } from '@/lib/game/recurrence'
import { logSessionErrorClient } from '@/lib/logSessionErrorClient'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'
import dynamic from 'next/dynamic'
import MissionRewardModal from '@/components/game/MissionRewardModal'
import type { CompletedMissionInfo } from '@/components/game/MissionRewardModal'
import { haptics } from '@/lib/haptics'
import { playQrScan } from '@/lib/game/sounds/ui'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import { motion } from 'framer-motion'
import { type IconType } from 'react-icons'
import {
  GiBullseye, GiMagnifyingGlass, GiTwoCoins, GiSparkles, GiPawPrint,
  GiCrossedSwords, GiFootprint, GiKnapsack, GiPuzzle, GiPadlock, GiCheckMark,
} from 'react-icons/gi'

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false })

/* ── Mission type metadata ───────────────────── */
const TYPE_META: Record<string, { icon: string; Icon: IconType; label: string; hint: string; color: string }> = {
  cattura:  { icon: '🐾', Icon: GiPawPrint,       label: 'Cattura',  hint: 'Cattura la creatura indicata',      color: '#3A9DBC' },
  duel:     { icon: '⚔️', Icon: GiCrossedSwords,  label: 'Duello',   hint: 'Vinci un duello contro un altro giocatore', color: '#FBBF24' },
  qr:       { icon: '📷', Icon: GiMagnifyingGlass, label: 'Scansione', hint: 'Scansiona il QR richiesto oppure QR diversi, se la missione non ne specifica uno',   color: '#34D399' },
  walk:     { icon: '🚶', Icon: GiFootprint,      label: 'Cammino',  hint: 'Percorri la distanza indicata (m)', color: '#C084FC' },
  collect:  { icon: '🎒', Icon: GiKnapsack,       label: 'Raccolta', hint: 'Raccogli gli oggetti indicati',     color: '#F97316' },
  enigma:   { icon: '🧩', Icon: GiPuzzle,         label: 'Enigma',   hint: 'Risolvi l’enigma indicato dalla sezione Enigmi (icona \u{1F9E9} nel menu)', color: '#A855F7' },
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? { icon: '🎯', Icon: GiBullseye, label: type, hint: '', color: '#9CA3AF' }
}

/* ── QR scan result display ─────────────────── */
interface ScanResult {
  success?: boolean
  type?: string
  error?: string
  itemName?: string
  quantity?: number
  text?: string
  imageUrl?: string
  eggRarity?: string
  chapterOrder?: number
  creatureId?: string
  eventType?: string
  bossFightId?: string
  bossName?: string
}

function ScanResultCard({ result, onClose, onBossFight }: { result: ScanResult; onClose: () => void; onBossFight?: (id: string) => void }) {
  const isError = !!result.error || !result.success

  function resultContent() {
    if (isError) {
      return (
        <div className="text-center space-y-2">
          <span className="text-5xl block">❌</span>
          <p className="text-white font-bold">Scansione fallita</p>
          <p className="text-red-400/80 text-sm">{result.error ?? 'Errore sconosciuto'}</p>
        </div>
      )
    }
    switch (result.type) {
      case 'oggetto':
        return (
          <div className="text-center space-y-2">
            <span className="text-5xl block">🎁</span>
            <p className="text-white font-bold">Oggetto trovato!</p>
            <p className="text-[#34D399] font-bold text-lg">{result.itemName} ×{result.quantity}</p>
            <p className="text-white/50 text-sm">Aggiunto al tuo zaino</p>
          </div>
        )
      case 'indizio':
        return (
          <div className="space-y-3">
            <div className="text-center">
              <span className="text-4xl block mb-1">🔍</span>
              <p className="text-white font-bold">Indizio sbloccato!</p>
              {result.chapterOrder && <p className="text-white/40 text-xs">Capitolo {result.chapterOrder}</p>}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/80 text-sm leading-relaxed italic">&quot;{result.text}&quot;</p>
            </div>
            {result.imageUrl && (
              <img src={result.imageUrl} alt="Indizio" className="w-full rounded-xl max-h-48 object-cover" />
            )}
          </div>
        )
      case 'uovo':
        return (
          <div className="text-center space-y-2">
            <span className="text-5xl block">🥚</span>
            <p className="text-white font-bold">Uovo trovato!</p>
            <p className="text-[#C084FC] font-bold capitalize">{result.eggRarity}</p>
            <p className="text-white/50 text-sm">L&apos;uovo sarà incubato durante il gioco</p>
          </div>
        )
      case 'boss':
        return (
          <div className="text-center space-y-3">
            <span className="text-5xl block">💀</span>
            <p className="text-white font-bold">Capo Palestra!</p>
            <p className="text-white/50 text-sm">{result.bossName ?? 'Un potente boss'} ti sfida!</p>
            {result.bossFightId && onBossFight && (
              <button
                onClick={() => { onClose(); onBossFight(result.bossFightId!) }}
                className="w-full bg-red-500 text-white font-extrabold py-3 rounded-xl text-sm mt-2"
              >
                ⚔️ Vai alla battaglia →
              </button>
            )}
          </div>
        )
      case 'evento':
        return (
          <div className="text-center space-y-2">
            <span className="text-5xl block">⚡</span>
            <p className="text-white font-bold">Evento attivato!</p>
            <p className="text-[#FBBF24] text-sm capitalize">{result.eventType?.replace('_', ' ')}</p>
          </div>
        )
      default:
        return (
          <div className="text-center space-y-2">
            <span className="text-5xl block">✅</span>
            <p className="text-white font-bold">QR scansionato!</p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
        isError
          ? 'bg-[#1a0a0a] border-red-500/30'
          : 'bg-[#0d1e2e] border-[#3A9DBC]/30'
      }`}>
        {resultContent()}
        {result.type !== 'boss' && (
          <button
            onClick={onClose}
            className={`w-full mt-5 py-3 rounded-xl font-bold text-sm ${
              isError ? 'bg-red-500/20 text-red-400' : 'bg-[#3A9DBC] text-white'
            }`}
          >
            {isError ? 'Riprova' : 'Ottimo! 🎉'}
          </button>
        )}
        {result.type === 'boss' && !result.bossFightId && (
          <button onClick={onClose} className="w-full mt-5 py-3 rounded-xl font-bold text-sm bg-white/10 text-white/50">
            Chiudi
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Mission detail modal ────────────────────── */
interface PlayerMissionData {
  mission_id: string
  progress: number
  completed_at: string | null
  period_key?: string | null
}

function MissionDetailModal({
  mission, playerData, creaturePreview, isCaught, unlockState, onClose, onScanQR,
}: {
  mission: Mission
  playerData: PlayerMissionData | undefined
  creaturePreview?: CreaturePreview | null
  isCaught?: boolean
  unlockState: MissionUnlockState
  onClose: () => void
  onScanQR: () => void
}) {
  const meta = typeMeta(mission.type)
  const progress = playerData?.progress ?? 0
  const completed = !!playerData?.completed_at
  const locked = !unlockState.unlocked && !completed
  const pct = Math.min(100, Math.round((progress / Math.max(1, mission.target_count)) * 100))

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm bg-[#0d1e2e] border border-white/15 rounded-t-3xl p-6 shadow-2xl"
        style={{ maxHeight: '85dvh', overflowY: 'auto' }}>
        {/* Drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(180deg, ${meta.color}30, ${meta.color}10)`, border: `1px solid ${meta.color}3a`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' }}>
            <meta.Icon size={30} color={meta.color} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {mission.is_required && (
                <span className="text-xs bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/25 px-2 py-0.5 rounded-md font-semibold">
                  ⭐ Obbligatoria
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}30` }}>
                {meta.label}
              </span>
              {completed && (
                <span className="text-xs inline-flex items-center gap-1 bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/25 px-2 py-0.5 rounded-md font-semibold">
                  <GiCheckMark size={11} /> Completata
                </span>
              )}
              {locked && (
                <span className="text-xs inline-flex items-center gap-1 bg-white/8 text-white/45 border border-white/15 px-2 py-0.5 rounded-md font-semibold">
                  <GiPadlock size={11} /> Bloccata
                </span>
              )}
            </div>
            <h2 className="wc-display text-white font-bold text-lg leading-tight">
              #{mission.chapter_order} {mission.title}
            </h2>
          </div>
        </div>

        {/* Description */}
        {mission.description && (
          <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3 mb-4">
            <p className="text-white/70 text-sm leading-relaxed">{mission.description}</p>
          </div>
        )}

        {/* Creature preview — cattura missions only */}
        {locked && (
          <div className="bg-white/4 border border-white/10 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-1">Si sblocca quando</p>
            <p className="text-white/70 text-sm leading-relaxed">
              {unlockState.reasons.join(' oppure ')}
            </p>
          </div>
        )}

        {mission.type === 'cattura' && creaturePreview && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 relative" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {/* Hero image */}
            <div className="relative w-full h-36 overflow-hidden">
              <CreatureDiorama
                creature={creaturePreview}
                size={150}
                anchor="center"
                rounded={0}
                className="w-full h-full"
                style={isCaught ? undefined : {
                  filter: 'blur(5px) brightness(0.55) saturate(0.3)',
                }}
              />
              {/* gradient overlay */}
              <div className="absolute inset-0" style={{
                background: isCaught
                  ? 'linear-gradient(to top, rgba(13,30,46,0.85) 0%, transparent 55%)'
                  : 'linear-gradient(to top, rgba(13,30,46,0.92) 0%, rgba(13,30,46,0.4) 55%, transparent 100%)',
              }} />
              {/* Name + badge anchored bottom */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-end justify-between">
                <div>
                  <p className="text-white font-extrabold text-base leading-tight drop-shadow">
                    {mission.target}
                  </p>
                  {!isCaught && (
                    <p className="text-xs text-white/45 mt-0.5">Trovala e catturala!</p>
                  )}
                </div>
                {isCaught ? (
                  <span className="text-xs bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/35 px-2 py-1 rounded-lg font-semibold shrink-0">
                    ✅ Nel DaimonDex
                  </span>
                ) : (
                  <span className="text-xs bg-white/8 text-white/40 border border-white/12 px-2 py-1 rounded-lg font-semibold shrink-0">
                    🔍 Da trovare
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* How to complete */}
        <div className={`mb-4 ${locked ? 'opacity-45' : ''}`}>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Come completare</p>
          <div className="flex items-start gap-3 bg-white/4 border border-white/8 rounded-xl px-4 py-3">
            <meta.Icon size={20} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p className="text-white/80 text-sm">{meta.hint}</p>
              {/* For enigma missions `mission.target` is the enigma's UUID,
                  which is unfriendly to the player — the hint already
                  routes them to the Enigmi section. Walk's target is the
                  raw empty string by convention. Skip the obiettivo line
                  in both cases. */}
              {mission.target && mission.type !== 'enigma' && mission.type !== 'walk' && (
                <p className="text-xs text-white/45 mt-0.5">
                  Obiettivo: <span className="text-white/70 font-semibold">{mission.target}</span>
                </p>
              )}
              {/* Enigma is binary (risolto / non risolto) — quantity is
                  always 1× and adds no info. Walk's target_count is the
                  distance in metres, already implied by the type icon. */}
              {mission.type !== 'enigma' && (
                <p className="text-xs text-white/45 mt-0.5">
                  {mission.type === 'walk' ? 'Distanza' : 'Quantità'}: <span className="text-white/70 font-semibold">
                    {mission.target_count}{mission.type === 'walk' ? ' m' : '×'}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className={`mb-4 ${locked ? 'opacity-45' : ''}`}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-white/40 font-semibold uppercase tracking-wider">Progresso</span>
            <span style={{ color: completed ? '#34D399' : meta.color }} className="font-bold">
              {progress} / {mission.target_count}
            </span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: completed ? '#34D399' : meta.color }}
            />
          </div>
        </div>

        {/* Rewards */}
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Ricompense</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="flex items-center gap-2 bg-[#F7C841]/8 border border-[#F7C841]/20 rounded-xl px-3 py-2.5">
            <GiTwoCoins size={20} color="#F7C841" />
            <div>
              <p className="wc-display text-[#F7C841] font-bold text-base leading-none">{mission.reward_gold}</p>
              <p className="text-white/30 text-xs mt-0.5">Oro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#46BAD8]/8 border border-[#46BAD8]/20 rounded-xl px-3 py-2.5">
            <GiSparkles size={20} color="#46BAD8" />
            <div>
              <p className="wc-display text-[#46BAD8] font-bold text-base leading-none">{mission.reward_exp}</p>
              <p className="text-white/30 text-xs mt-0.5">EXP</p>
            </div>
          </div>
        </div>

        {/* QR button if mission type is qr */}
        {mission.type === 'qr' && !completed && !locked && (
          <button
            onClick={() => { onClose(); onScanQR() }}
            className="w-full font-extrabold py-3.5 rounded-xl text-sm mb-3 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(180deg, #4ee0a0, #1f9e6e)', color: '#062017', border: '1px solid rgba(120,255,200,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
          >
            <GiMagnifyingGlass size={18} /> Scansiona QR ora
          </button>
        )}

        <button onClick={onClose}
          className="w-full bg-white/5 border border-white/10 text-white/50 font-semibold py-3 rounded-xl text-sm">
          Chiudi
        </button>
      </div>
    </div>
  )
}

/* ── Progress ring (small) ───────────────────── */
function ProgressRing({ pct, color, size = 36 }: { pct: number; color: string; size?: number }) {
  const r = (size - 5) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * pct / 100
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.4s' }} />
    </svg>
  )
}

/* ── Page ────────────────────────────────────── */
interface CreaturePreview {
  name: string
  element: string
  image_url: string | null
  sprite_cutout_url: string | null
  sprite_url: string | null
  rarity: string
}
interface CreaturePreviewRow {
  name: string
  element: string
  image_url: string | null
  sprite_cutout_url: string | null
  sprite_url: string | null
  rarity: string
}
interface PlayerCreatureNameRow { creatures?: { name?: string | null } | Array<{ name?: string | null }> | null }

export default function MissionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [missions, setMissions]       = useState<Mission[]>([])
  const [playerMissions, setPlayerMissions] = useState<PlayerMissionData[]>([])
  const [loading, setLoading]         = useState(true)
  const [detailMission, setDetailMission] = useState<Mission | null>(null)
  const { toast, showApiError, dismiss } = useGameToast()
  const [showScanner, setShowScanner] = useState(() => searchParams.get('qr') === '1')
  const [scanResult, setScanResult]   = useState<ScanResult | null>(null)
  const [scanning, setScanning]       = useState(false)
  const [pendingMissions, setPendingMissions] = useState<CompletedMissionInfo[]>([])
  const [filter, setFilter]           = useState<'all' | 'todo' | 'done'>('all')
  const [playerLevel, setPlayerLevel] = useState(1)
  // creature_name → { image_url, rarity }
  const [creaturePreviews, setCreaturePreviews] = useState<Record<string, CreaturePreview>>({})
  // creature_name → whether player has caught it
  const [caughtNames, setCaughtNames] = useState<Set<string>>(new Set())
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }

    async function load() {
      // Missions for this session are static for the event's lifetime → SWR cache.
      // Real events pull both event-scoped and global missions; the tutorial
      // session is isolated (no globals) so its chain stays a clean story.
      // Bump the cache key version for tutorial so old caches with globals
      // don't survive the scope change.
      const isTut = isTutorialSession(sessionId)
      const cacheKey = `missions:${sessionId}:${isTut ? 'tut-v2' : 'v1'}`
      const missionsSWR = swr<Mission[]>(cacheKey, 10 * 60 * 1000, async () => {
        const base = supabase.from('missions').select('*').order('chapter_order')
        const { data } = await (isTut
          ? base.eq('session_id', sessionId!) // guarded non-null at line 438
          : base.or(`session_id.eq.${sessionId},session_id.is.null`))
        return (data ?? []) as Mission[]
      })
      if (missionsSWR.cached) setMissions(missionsSWR.cached)

      const [missionList, user] = await Promise.all([
        missionsSWR.fresh,
        getCurrentUser(supabase),
      ])
      setMissions(missionList)
      if (user && missionList.length > 0) {
        const missionIds = missionList.map(m => m.id)
        const [{ data: pm }, { data: ps }] = await Promise.all([
          supabase
            .from('player_missions')
            .select('mission_id, progress, completed_at, period_key')
            .eq('user_id', user.id)
            .eq('session_id', sessionId!)
            .in('mission_id', missionIds),
          supabase
            .from('player_sessions')
            .select('level')
            .eq('user_id', user.id)
            .eq('session_id', sessionId!)
            .maybeSingle(),
        ])
        setPlayerMissions((pm ?? []) as PlayerMissionData[])
        setPlayerLevel(typeof ps?.level === 'number' ? ps.level : 1)

        // Load creature previews for cattura missions
        const captureTargets = [...new Set(
          missionList.filter(m => m.type === 'cattura' && m.target).map(m => m.target!)
        )]
        if (captureTargets.length > 0) {
          const [crRes, pcRes] = await Promise.all([
            supabase.from('creatures').select('name, element, image_url, sprite_cutout_url, sprite_url, rarity').in('name', captureTargets),
            sessionId
              ? supabase.from('player_creatures')
                  .select('creatures(name)')
                  .eq('user_id', user.id)
                  .eq('session_id', sessionId)
              : Promise.resolve({ data: [] }),
          ])
          const previews: Record<string, CreaturePreview> = {}
          for (const c of (crRes.data ?? []) as CreaturePreviewRow[]) {
            previews[c.name] = {
              name: c.name,
              element: c.element,
              image_url: c.image_url,
              sprite_cutout_url: c.sprite_cutout_url,
              sprite_url: c.sprite_url,
              rarity: c.rarity,
            }
          }
          setCreaturePreviews(previews)
          const caught = new Set<string>(
            ((pcRes.data ?? []) as PlayerCreatureNameRow[])
              .map(pc => Array.isArray(pc.creatures) ? pc.creatures[0]?.name : pc.creatures?.name)
              .filter((name): name is string => !!name)
          )
          setCaughtNames(caught)
        }
      }
      setLoading(false)
    }

    load()
  }, [supabase])

  async function handleScanResult(qrData: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    setShowScanner(false)
    setScanning(true)
    try {
      const res = await fetch('/api/game/qr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrId: qrData, sessionId }),
      })
      const data = await res.json()
      if (res.status === 403) {
        // Session not active — show unified toast, skip scan result card
        showApiError(res.status, data.error ?? 'Sessione non attiva')
        return
      }
      setScanResult(res.ok ? data : { error: data.error ?? 'Errore sconosciuto', success: false })
      if (res.ok && data.success) {
        playQrScan()
        haptics.tap()
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        window.dispatchEvent(new CustomEvent('wc:refresh-backpack'))
        if (data.completedMissions?.length) {
          setPendingMissions(data.completedMissions)
        }
      }
    } catch {
      setScanResult({ error: 'Errore di rete', success: false })
    } finally {
      setScanning(false)
    }
  }

  // Le missioni ricorrenti mostrano solo la riga del periodo CORRENTE: al
  // cambio periodo la missione riappare da zero, le righe vecchie sono storia.
  const pmMap = useMemo(() => {
    const map: Record<string, PlayerMissionData> = {}
    for (const m of missions) {
      const period = periodKeyFor(m.recurrence)
      const row = playerMissions.find(pm => pm.mission_id === m.id && (pm.period_key ?? '') === period)
      if (row) map[m.id] = row
    }
    return map
  }, [missions, playerMissions])

  const missionTitleById = useMemo(() =>
    Object.fromEntries(missions.map(m => [m.id, m.title])),
    [missions]
  )

  const completedMissionIds = useMemo(() =>
    playerMissions.filter(pm => pm.completed_at).map(pm => pm.mission_id),
    [playerMissions]
  )

  const unlockMap = useMemo(() =>
    Object.fromEntries(missions.map(m => [
      m.id,
      getMissionUnlockState(m, {
        playerLevel,
        completedMissionIds,
        missionTitleById,
      }),
    ])),
    [missions, playerLevel, completedMissionIds, missionTitleById]
  )

  const filtered = useMemo(() => {
    if (filter === 'todo') return missions.filter(m => !pmMap[m.id]?.completed_at && unlockMap[m.id]?.unlocked)
    if (filter === 'done') return missions.filter(m => !!pmMap[m.id]?.completed_at)
    return missions
  }, [missions, pmMap, unlockMap, filter])

  const doneCount = missions.filter(m => !!pmMap[m.id]?.completed_at).length
  const unlockedCount = missions.filter(m => pmMap[m.id]?.completed_at || unlockMap[m.id]?.unlocked).length
  const lockedCount = Math.max(0, missions.length - unlockedCount)
  const totalCount = missions.length

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #122c3e 0%, #0a1a26 45%, #060f17 100%)' }}>
      {/* Toast overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {/* Header */}
      <div className="relative px-4 pt-4 pb-3 shrink-0">
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(247,200,65,0.4), transparent)' }} />
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2">
              <GiBullseye size={22} color="#F0A93C" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              <span className="wc-display wc-gold-text" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>Missioni</span>
            </h1>
            {totalCount > 0 && (
              <p className="text-xs text-white/40 mt-0.5">
                {doneCount}/{unlockedCount || totalCount} completate
                {lockedCount > 0 && <span className="text-white/25"> · {lockedCount} bloccate</span>}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowScanner(true)}
            disabled={scanning}
            className="flex items-center gap-1.5 font-extrabold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition-all active:scale-95 shrink-0"
            style={{ background: 'linear-gradient(180deg, #4ee0a0, #1f9e6e)', color: '#062017', border: '1px solid rgba(120,255,200,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 10px -3px rgba(52,211,153,0.5)' }}
          >
            {scanning
              ? <span className="w-4 h-4 border-2 border-[#062017]/40 border-t-[#062017] rounded-full animate-spin" />
              : <GiMagnifyingGlass size={16} />
            }
            {scanning ? 'Lettura...' : 'Scansiona QR'}
          </button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (() => {
          const pct = Math.round((doneCount / Math.max(1, unlockedCount)) * 100)
          return (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.35)' }}>
                <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(180deg, #5ee6a6, #1f9e6e)', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
              </div>
              <span className="wc-display tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: '#5ee6a6' }}>{pct}%</span>
            </div>
          )
        })()}

        {/* Filter pills */}
        <div className="flex gap-1.5">
          {(['all', 'todo', 'done'] as const).map(f => {
            const on = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={on
                  ? { background: 'linear-gradient(180deg, #56C8E0, #2a7d98)', color: '#fff', boxShadow: '0 0 10px rgba(70,186,216,0.4)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'var(--wc-ink-dim)' }}
              >
                {f === 'all' ? 'Tutte' : f === 'todo' ? 'Da fare' : 'Completate'}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          <GameListSkeleton rows={3} className="space-y-2.5" itemClassName="h-24" />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🎯</span>
            <p className="text-white/30 text-sm">
              {filter === 'done' ? 'Nessuna missione completata' : filter === 'todo' ? 'Tutte le missioni completate!' : 'Nessuna missione attiva'}
            </p>
          </div>
        ) : (
          filtered.map((mission, idx) => {
            const meta = typeMeta(mission.type)
            const pm = pmMap[mission.id]
            const progress = pm?.progress ?? 0
            const completed = !!pm?.completed_at
            const unlockState = unlockMap[mission.id]
            const locked = !completed && !unlockState?.unlocked
            const pct = Math.min(100, Math.round((progress / Math.max(1, mission.target_count)) * 100))

            return (
              <motion.button
                key={mission.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: locked ? 0.72 : 1, y: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut', delay: Math.min(idx * 0.035, 0.32) }}
                onClick={() => setDetailMission(mission)}
                className="w-full text-left flex items-center gap-3 p-3.5 active:scale-[0.98] wc-panel"
                style={{
                  borderRadius: 18,
                  borderLeft: `3px solid ${locked ? 'rgba(255,255,255,0.14)' : completed ? '#44d08a' : meta.color}`,
                }}
              >
                {/* Progress ring OR creature thumbnail for cattura missions */}
                {mission.type === 'cattura' && mission.target && creaturePreviews[mission.target] ? (
                  <div className="relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden"
                    style={{ border: `1px solid ${completed ? 'rgba(68,208,138,0.6)' : 'rgba(255,255,255,0.1)'}`, boxShadow: completed ? '0 0 14px -3px rgba(68,208,138,0.55)' : undefined }}>
                    <CreatureDiorama
                      creature={creaturePreviews[mission.target]}
                      size={70}
                      anchor="center"
                      rounded={14}
                      showAura={false}
                      className="w-full h-full"
                      style={caughtNames.has(mission.target) ? undefined : {
                        filter: locked ? 'blur(4px) brightness(0.38) saturate(0.1)' : 'blur(3px) brightness(0.5) saturate(0.2)',
                      }}
                    />
                    {completed && (
                      <span className="absolute -top-1 -right-1 rounded-full flex items-center justify-center" style={{ background: '#0a1a26', padding: 2, boxShadow: '0 0 6px rgba(68,208,138,0.6)' }}>
                        <GiCheckMark size={12} color="#44d08a" />
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative shrink-0 w-16 h-16 flex items-center justify-center">
                    <ProgressRing pct={pct} size={50} color={locked ? 'rgba(255,255,255,0.35)' : completed ? '#34D399' : meta.color} />
                    <span className="absolute inset-0 flex items-center justify-center">
                      {completed ? <GiCheckMark size={20} color="#44d08a" /> : locked ? <GiPadlock size={18} color="rgba(255,255,255,0.45)" /> : <meta.Icon size={22} color={meta.color} />}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
                      style={{ background: `${meta.color}20`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {mission.is_required && (
                      <span className="text-xs text-[#FBBF24]/70 shrink-0">⭐</span>
                    )}
                    {completed && (
                      <span className="text-xs text-[#34D399]/70 shrink-0 font-semibold">Completata</span>
                    )}
                    {locked && (
                      <span className="text-xs text-white/45 shrink-0 font-semibold">🔒 Bloccata</span>
                    )}
                  </div>
                  <p className="font-bold text-white text-[15px] leading-tight truncate">
                    {mission.title}
                    {mission.recurrence && (
                      <span className="ml-1.5 align-middle text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                        style={{
                          background: mission.recurrence === 'daily' ? 'rgba(255,179,107,0.15)' : mission.recurrence === 'weekly' ? 'rgba(56,189,248,0.15)' : 'rgba(192,132,252,0.15)',
                          color: mission.recurrence === 'daily' ? '#FFB36B' : mission.recurrence === 'weekly' ? '#38BDF8' : '#C084FC',
                        }}>
                        🔁 {RECURRENCE_LABELS[mission.recurrence]}
                      </span>
                    )}
                  </p>
                  {locked ? (
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-1">
                      {unlockState?.reasons.join(' oppure ') || 'Missione non ancora sbloccata'}
                    </p>
                  ) : mission.type === 'cattura' && mission.target ? (
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-1">
                      Cattura: <span className="text-white/65 font-semibold">{mission.target}</span>
                    </p>
                  ) : mission.description ? (
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-1">
                      {mission.description}
                    </p>
                  ) : null}
                  {/* Progress text + rewards */}
                  <div className={`flex items-center gap-2 mt-1.5 ${locked ? 'opacity-45' : ''}`}>
                    <span className="text-xs font-semibold" style={{ color: completed ? '#34D399' : meta.color }}>
                      {progress}/{mission.target_count}
                    </span>
                    <span className="text-white/15">·</span>
                    <span className="text-xs flex items-center gap-0.5" style={{ color: 'rgba(247,200,65,0.85)' }}><GiTwoCoins size={12} color="#F7C841" /> {mission.reward_gold}</span>
                    <span className="text-xs flex items-center gap-0.5" style={{ color: 'rgba(70,186,216,0.85)' }}><GiSparkles size={12} color="#46BAD8" /> {mission.reward_exp}</span>
                  </div>
                </div>

                {/* Chevron */}
                <span className="text-white/20 text-sm shrink-0">›</span>
              </motion.button>
            )
          })
        )}
      </div>

      {/* QR Scanner */}
      {showScanner && (
        <QrScanner
          onScan={handleScanResult}
          onClose={() => setShowScanner(false)}
          onPermissionError={(code) => {
            const sid = localStorage.getItem('current_session_id')
            if (!sid) return
            logSessionErrorClient({
              sessionId: sid,
              source: 'missions',
              errorCode: code,
              message: code === 'camera_denied' ? 'Permesso fotocamera negato durante scansione QR' : 'Fotocamera non disponibile durante scansione QR',
            })
          }}
        />
      )}

      {/* Scan result */}
      {scanResult && (
        <ScanResultCard
          result={scanResult}
          onClose={() => {
            setScanResult(null)
            // Show mission reward modal after scan result dismissed (if any missions completed)
            // pendingMissions already set — modal will appear automatically
          }}
          onBossFight={(bossFightId) => {
            setScanResult(null)
            setPendingMissions([]) // boss fight page shown — skip mission modal here
            router.push(`/game/boss/${bossFightId}`)
          }}
        />
      )}

      {/* Mission reward modal — shown after scan result is closed */}
      {!scanResult && pendingMissions.length > 0 && (
        <div className="absolute inset-0 z-[80]">
          <MissionRewardModal
            missions={pendingMissions}
            onDone={() => setPendingMissions([])}
          />
        </div>
      )}

      {/* Mission detail modal */}
      {detailMission && (
        <MissionDetailModal
          mission={detailMission}
          playerData={pmMap[detailMission.id]}
          creaturePreview={detailMission.target ? creaturePreviews[detailMission.target] : null}
          isCaught={detailMission.target ? caughtNames.has(detailMission.target) : false}
          unlockState={unlockMap[detailMission.id] ?? getMissionUnlockState(detailMission, {
            playerLevel,
            completedMissionIds,
            missionTitleById,
          })}
          onClose={() => setDetailMission(null)}
          onScanQR={() => { setDetailMission(null); setShowScanner(true) }}
        />
      )}
    </div>
  )
}
