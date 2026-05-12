'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { swr } from '@/lib/cache'
import type { Mission } from '@/lib/types'
import { getMissionUnlockState, type MissionUnlockState } from '@/lib/game/mission-unlocks'
import { logSessionErrorClient } from '@/lib/logSessionErrorClient'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'
import dynamic from 'next/dynamic'
import MissionRewardModal from '@/components/game/MissionRewardModal'
import type { CompletedMissionInfo } from '@/components/game/MissionRewardModal'

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false })

/* ── Mission type metadata ───────────────────── */
const TYPE_META: Record<string, { icon: string; label: string; hint: string; color: string }> = {
  cattura:  { icon: '🐾', label: 'Cattura',  hint: 'Cattura la creatura indicata',      color: '#3A9DBC' },
  duel:     { icon: '⚔️', label: 'Duello',   hint: 'Vinci un duello contro un altro giocatore', color: '#FBBF24' },
  qr:       { icon: '📷', label: 'Scansione', hint: 'Scansiona il QR richiesto oppure QR diversi, se la missione non ne specifica uno',   color: '#34D399' },
  walk:     { icon: '🚶', label: 'Cammino',  hint: 'Percorri la distanza indicata (m)', color: '#C084FC' },
  collect:  { icon: '🎒', label: 'Raccolta', hint: 'Raccogli gli oggetti indicati',     color: '#F97316' },
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? { icon: '🎯', label: type, hint: '', color: '#9CA3AF' }
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: `${meta.color}18`, border: `1.5px solid ${meta.color}30` }}>
            {meta.icon}
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
                <span className="text-xs bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/25 px-2 py-0.5 rounded-md font-semibold">
                  ✅ Completata
                </span>
              )}
              {locked && (
                <span className="text-xs bg-white/8 text-white/45 border border-white/15 px-2 py-0.5 rounded-md font-semibold">
                  🔒 Bloccata
                </span>
              )}
            </div>
            <h2 className="text-white font-extrabold text-base leading-tight">
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

        {mission.type === 'cattura' && creaturePreview?.image_url && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 relative" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {/* Hero image */}
            <div className="relative w-full h-36 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={creaturePreview.image_url}
                alt={mission.target ?? ''}
                className="w-full h-full object-contain scale-110"
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
            <span className="text-xl mt-0.5">{meta.icon}</span>
            <div>
              <p className="text-white/80 text-sm">{meta.hint}</p>
              {mission.target && (
                <p className="text-xs text-white/45 mt-0.5">
                  Obiettivo: <span className="text-white/70 font-semibold">{mission.target}</span>
                </p>
              )}
              <p className="text-xs text-white/45 mt-0.5">
                Quantità: <span className="text-white/70 font-semibold">{mission.target_count}×</span>
              </p>
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
            <span className="text-lg">🪙</span>
            <div>
              <p className="text-[#F7C841] font-extrabold text-sm">{mission.reward_gold}</p>
              <p className="text-white/30 text-xs">Oro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#3A9DBC]/8 border border-[#3A9DBC]/20 rounded-xl px-3 py-2.5">
            <span className="text-lg">✨</span>
            <div>
              <p className="text-[#3A9DBC] font-extrabold text-sm">{mission.reward_exp}</p>
              <p className="text-white/30 text-xs">EXP</p>
            </div>
          </div>
        </div>

        {/* QR button if mission type is qr */}
        {mission.type === 'qr' && !completed && !locked && (
          <button
            onClick={() => { onClose(); onScanQR() }}
            className="w-full bg-[#34D399] text-[#0a1520] font-extrabold py-3.5 rounded-xl text-sm mb-3 flex items-center justify-center gap-2"
          >
            <span className="text-lg">📷</span> Scansiona QR ora
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
interface CreaturePreview { image_url: string | null; rarity: string }
interface CreaturePreviewRow { name: string; image_url: string | null; rarity: string }
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
      const missionsSWR = swr<Mission[]>(`missions:${sessionId}:v1`, 10 * 60 * 1000, async () => {
        const { data } = await supabase.from('missions')
          .select('*').or(`session_id.eq.${sessionId},session_id.is.null`)
          .order('chapter_order')
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
            .select('mission_id, progress, completed_at')
            .eq('user_id', user.id)
            .eq('session_id', sessionId)
            .in('mission_id', missionIds),
          supabase
            .from('player_sessions')
            .select('level')
            .eq('user_id', user.id)
            .eq('session_id', sessionId)
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
            supabase.from('creatures').select('name, image_url, rarity').in('name', captureTargets),
            sessionId
              ? supabase.from('player_creatures')
                  .select('creatures(name)')
                  .eq('user_id', user.id)
                  .eq('session_id', sessionId)
              : Promise.resolve({ data: [] }),
          ])
          const previews: Record<string, CreaturePreview> = {}
          for (const c of (crRes.data ?? []) as CreaturePreviewRow[]) {
            previews[c.name] = { image_url: c.image_url, rarity: c.rarity }
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

  const pmMap = useMemo(() =>
    Object.fromEntries(playerMissions.map(pm => [pm.mission_id, pm])),
    [playerMissions]
  )

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
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Toast overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-[#0A1520]/80 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">🎯 Missioni</h1>
            {totalCount > 0 && (
              <p className="text-xs text-white/35 mt-0.5">
                {doneCount}/{unlockedCount || totalCount} completate
                {lockedCount > 0 && <span className="text-white/25"> · {lockedCount} bloccate</span>}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowScanner(true)}
            disabled={scanning}
            className="flex items-center gap-1.5 bg-[#34D399] text-[#0a1520] font-extrabold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition-all active:scale-95"
          >
            {scanning
              ? <span className="w-4 h-4 border-2 border-[#0a1520]/40 border-t-[#0a1520] rounded-full animate-spin" />
              : <span>📷</span>
            }
            {scanning ? 'Lettura...' : 'Scansiona QR'}
          </button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-[#34D399] rounded-full transition-all"
              style={{ width: `${Math.round((doneCount / Math.max(1, unlockedCount)) * 100)}%` }}
            />
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-1.5">
          {(['all', 'todo', 'done'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                filter === f ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Tutte' : f === 'todo' ? 'Da fare' : 'Completate'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="bg-white/5 rounded-2xl h-24 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🎯</span>
            <p className="text-white/30 text-sm">
              {filter === 'done' ? 'Nessuna missione completata' : filter === 'todo' ? 'Tutte le missioni completate!' : 'Nessuna missione attiva'}
            </p>
          </div>
        ) : (
          filtered.map(mission => {
            const meta = typeMeta(mission.type)
            const pm = pmMap[mission.id]
            const progress = pm?.progress ?? 0
            const completed = !!pm?.completed_at
            const unlockState = unlockMap[mission.id]
            const locked = !completed && !unlockState?.unlocked
            const pct = Math.min(100, Math.round((progress / Math.max(1, mission.target_count)) * 100))

            return (
              <button
                key={mission.id}
                onClick={() => setDetailMission(mission)}
                className={`w-full text-left flex items-center gap-3 rounded-2xl p-3.5 border transition-all active:scale-[0.98] ${locked ? 'opacity-70' : ''}`}
                style={{
                  background: locked ? 'rgba(255,255,255,0.035)' : completed ? `${meta.color}07` : `${meta.color}0a`,
                  borderColor: locked ? 'rgba(255,255,255,0.10)' : completed ? `${meta.color}25` : `${meta.color}28`,
                }}
              >
                {/* Progress ring OR creature thumbnail for cattura missions */}
                {mission.type === 'cattura' && mission.target && creaturePreviews[mission.target]?.image_url ? (
                  <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creaturePreviews[mission.target].image_url!}
                      alt={mission.target}
                      className="w-full h-full object-contain"
                      style={caughtNames.has(mission.target) ? undefined : {
                        filter: locked ? 'blur(4px) brightness(0.38) saturate(0.1)' : 'blur(3px) brightness(0.5) saturate(0.2)',
                      }}
                    />
                    {completed && (
                      <span className="absolute -top-1 -right-1 text-xs leading-none">✅</span>
                    )}
                  </div>
                ) : (
                  <div className="relative shrink-0">
                    <ProgressRing pct={pct} color={locked ? 'rgba(255,255,255,0.35)' : completed ? '#34D399' : meta.color} />
                    <span className="absolute inset-0 flex items-center justify-center text-base">
                      {completed ? '✅' : locked ? '🔒' : meta.icon}
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
                  <p className="font-bold text-white text-sm leading-tight truncate">
                    {mission.title}
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
                    <span className="text-xs text-[#F7C841]/60">🪙 {mission.reward_gold}</span>
                    <span className="text-xs text-white/35">✨ {mission.reward_exp}</span>
                  </div>
                </div>

                {/* Chevron */}
                <span className="text-white/20 text-sm shrink-0">›</span>
              </button>
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
