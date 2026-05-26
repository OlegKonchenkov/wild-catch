'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { track } from '@/lib/analytics'
import { haptics } from '@/lib/haptics'
import LevelUpModal, { type LevelUpInfo } from '@/components/game/LevelUpModal'
import NotifPopupComponent, { type NotifPopupData } from '@/components/game/NotifPopup'
import PushOptIn from '@/components/game/PushOptIn'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import ImageLightbox from '@/components/ui/ImageLightbox'
import GameTopBar from '@/components/ui/GameTopBar'
import { NAV_ICON } from '@/components/ui/NavIcons'
import ElementIcon from '@/components/ui/ElementIcon'
import { GiRingingBell, GiGears, GiMegaphone, GiJoystick, GiPawPrint } from 'react-icons/gi'
import { getExpProgress } from '@/lib/game/leveling'
import { playLevelUp } from '@/lib/game/sounds/events'
import { getSharedAC } from '@/lib/game/sounds/shared-ac'
import { hydrateAudioOverrides } from '@/lib/game/audio-overrides'

const NAV_ITEMS: Array<{ href: string; key: string; label: string; coachmark?: string }> = [
  { href: '/game/map',      key: 'map',      label: 'Mappa'                                  },
  { href: '/game/bestiary', key: 'bestiary', label: 'DaimonDex', coachmark: 'nav-bestiary'   },
  { href: '/game/duel',     key: 'duel',     label: 'Duelli',    coachmark: 'nav-duelli'     },
  { href: '/game/missions', key: 'missions', label: 'Missioni',  coachmark: 'nav-missioni'   },
  { href: '/game/enigmi',   key: 'enigmi',   label: 'Enigmi',    coachmark: 'nav-enigmi'     },
  { href: '/game/shop',     key: 'shop',     label: 'Shop',      coachmark: 'nav-shop'       },
  { href: '/game/backpack', key: 'backpack', label: 'Zaino',     coachmark: 'nav-zaino'      },
  { href: '/game/profile',  key: 'trophy',   label: 'Classifica', coachmark: 'nav-classifica' },
  { href: '/game/guide',    key: 'guide',    label: 'Guida',     coachmark: 'nav-guida'      },
  { href: '/home',          key: 'home',     label: 'Profilo'                                },
]

function xpProgress(exp: number, level: number): number {
  return getExpProgress(exp, level).percent
}

// Types re-exported from the extracted modal/toast components below — kept
// as local aliases so the rest of the file doesn't need to be touched.
type NotifPopup = NotifPopupData

const REWARD_TYPE_ICONS: Record<string, string> = {
  exp: '⭐', gold: '💰', oggetto: '📦', indizio: '🔍',
  uovo: '🥚', creatura: '🎯', enigma: '🔐', evento: '⚡',
}

// Notifications and game events are stored in Postgres as JSON blobs whose
// shape varies by event type. We type them as Record<string, unknown> so
// callers must narrow before reading, and keep a typed payload accessor
// helper for the small set of fields we actually care about.
type JsonPayload = Record<string, unknown>

interface NotifReward {
  gold?: number
  exp?: number
  bonus_items?: Array<{ name?: string; quantity: number }>
}

interface NotifPayload {
  title?: string
  message?: string
  item_name?: string
  link_url?: string
  reward?: NotifReward
}

interface AdminNotificationRow {
  id: string
  type: string
  payload: NotifPayload | null
  read: boolean
  created_at: string
}

// Game-event payloads vary by event type; the JSX in the events panel
// reads many optional fields ad-hoc. We give them a "wide" optional shape
// rather than per-type narrowing — wrong here trades type ergonomics for a
// fragile codepath in production-critical UI we don't want to risk.
interface GameEventPayload {
  rarity?: string
  element?: string
  evolved?: boolean
  gold?: number
  exp?: number
  gold_reward?: number
  reward_gold?: number
  reward_exp?: number
  new_level?: number
  creature_name?: string
  opponent_name?: string
  winner_name?: string
  boss_name?: string
  title?: string
  mission_target?: string
  item_name?: string
  qr_type?: string
  qr_label?: string
  egg_rarity?: string
  pin_name?: string
  reward_type?: string
  amount?: number
  message?: string
  // catch-specific
  hp?: number
  atk?: number
  def?: number
  via_pin?: boolean
  via_egg?: boolean
  via_qr?: boolean
  starter?: boolean
  evolved_from?: string
  // mission-specific
  target_count?: number
  // duel-specific
  my_creatures?: Array<Record<string, unknown>>
  opp_creatures?: Array<Record<string, unknown>>
  // image url for catch / pin previews
  image_url?: string
  // catch-all for unknown event types
  [extra: string]: unknown
}

interface PlayerGameEventRow {
  id: string
  type: string
  payload: GameEventPayload
  created_at: string
}

function readNum(p: JsonPayload, key: string): number {
  const v = p[key]
  return typeof v === 'number' ? v : 0
}

function readStr(p: JsonPayload, key: string): string | null {
  const v = p[key]
  return typeof v === 'string' ? v : null
}

function readBool(p: JsonPayload, key: string): boolean {
  return Boolean(p[key])
}

function rewardParts(p: JsonPayload): string {
  const parts: string[] = []
  if (readNum(p, 'gold'))         parts.push(`+${readNum(p, 'gold')} 💰`)
  if (readNum(p, 'exp'))          parts.push(`+${readNum(p, 'exp')} ⭐`)
  if (readNum(p, 'gold_reward'))  parts.push(`+${readNum(p, 'gold_reward')} 💰`)
  if (readNum(p, 'reward_gold'))  parts.push(`+${readNum(p, 'reward_gold')} 💰`)
  if (readNum(p, 'reward_exp'))   parts.push(`+${readNum(p, 'reward_exp')} ⭐`)
  return parts.join(' · ')
}

function formatGameEvent(ev: PlayerGameEventRow): { icon: string; title: string; body: string } {
  const p: JsonPayload = ev.payload ?? {}
  switch (ev.type) {
    case 'catch': {
      const rarity = readStr(p, 'rarity')
      const rarityInfo = rarity ? RARITY_DISPLAY[rarity] : null
      const evolved = readBool(p, 'evolved')
      const gold = readNum(p, 'gold')
      const bodyParts = [
        rarityInfo?.label,
        readStr(p, 'element'),
        evolved ? '✨ Evoluta' : '',
        gold ? `+${gold} 💰` : '',
      ].filter(Boolean)
      return {
        icon: evolved ? '✨' : '🎯',
        title: `Catturato: ${readStr(p, 'creature_name') ?? 'creatura'}`,
        body: bodyParts.join(' · '),
      }
    }
    case 'duel_won': {
      const opponent = readStr(p, 'opponent_name')
      return {
        icon: '🏆',
        title: opponent ? `Vinto vs ${opponent}` : 'Duello vinto!',
        body: rewardParts(p) || 'Vittoria in duello',
      }
    }
    case 'duel_lost': {
      const winner = readStr(p, 'winner_name')
      return { icon: '💀', title: winner ? `Perso vs ${winner}` : 'Duello perso', body: '' }
    }
    case 'duel_cancelled': {
      const opponent = readStr(p, 'opponent_name')
      return { icon: '🤝', title: opponent ? `Duello annullato vs ${opponent}` : 'Duello annullato', body: 'Nessun punto assegnato' }
    }
    case 'boss_won': {
      const boss = readStr(p, 'boss_name')
      return {
        icon: '👑',
        title: boss ? `${boss} sconfitto!` : 'Boss sconfitto!',
        body: rewardParts(p),
      }
    }
    case 'boss_lost': {
      const boss = readStr(p, 'boss_name')
      return {
        icon: '💀',
        title: 'Sconfitto dal boss',
        body: boss ? `Boss: ${boss}` : '',
      }
    }
    case 'mission_completed': {
      const mRewards = rewardParts(p)
      const title = readStr(p, 'title')
      return {
        icon: '✅',
        title: title ? `Missione: ${title}` : 'Missione completata!',
        body: mRewards || readStr(p, 'mission_target') || '',
      }
    }
    case 'level_up': {
      const newLevel = readNum(p, 'new_level')
      const goldReward = readNum(p, 'gold_reward')
      return {
        icon: '⭐',
        title: `Livello ${newLevel}!`,
        body: goldReward > 0 ? `+${goldReward} 💰` : 'Nuovo livello raggiunto',
      }
    }
    case 'qr_redeemed': {
      return {
        icon: '📱',
        title: `QR: "${readStr(p, 'item_name') ?? ''}"`,
        body: rewardParts(p),
      }
    }
    case 'pin_claimed': {
      const pinIcon = REWARD_TYPE_ICONS[readStr(p, 'reward_type') ?? ''] ?? '📍'
      const eggRarity = readStr(p, 'egg_rarity')
      const pinReward = rewardParts(p) ||
        readStr(p, 'creature_name') ||
        readStr(p, 'item_name') ||
        (eggRarity ? `Uovo ${eggRarity}` : '')
      return {
        icon: pinIcon,
        title: readStr(p, 'pin_name') ? `Pin: ${readStr(p, 'pin_name')}` : 'Pin riscattato!',
        body: pinReward,
      }
    }
    default:
      return { icon: '🎮', title: ev.type, body: '' }
  }
}

const RARITY_DISPLAY: Record<string, { label: string; color: string }> = {
  comune:      { label: 'Terrestre',   color: '#7AB87A' },
  non_comune:  { label: 'Arcaico',     color: '#4A9FD4' },
  raro:        { label: 'Eroico',      color: '#E8A820' },
  epico:       { label: 'Mostruoso',   color: '#7B4DB8' },
  leggendario: { label: 'Leggendario', color: '#C8352A' },
  mitologico:  { label: 'Mitologico',  color: '#FF4D6D' },
}

const EVENT_THEMES: Record<string, { color: string; dimColor: string; label: string }> = {
  catch:             { color: '#3A9DBC', dimColor: 'rgba(58,157,188,0.12)',  label: 'Cattura'   },
  duel_won:          { color: '#34D399', dimColor: 'rgba(52,211,153,0.10)',  label: 'Duello'    },
  duel_lost:         { color: '#F87171', dimColor: 'rgba(248,113,113,0.08)', label: 'Duello'    },
  duel_cancelled:    { color: '#94A3B8', dimColor: 'rgba(148,163,184,0.08)', label: 'Duello'    },
  boss_won:          { color: '#F7C841', dimColor: 'rgba(247,200,65,0.10)',  label: 'Boss'      },
  boss_lost:         { color: '#F87171', dimColor: 'rgba(248,113,113,0.08)', label: 'Boss'      },
  mission_completed: { color: '#A78BFA', dimColor: 'rgba(167,139,250,0.10)', label: 'Missione'  },
  level_up:          { color: '#F7C841', dimColor: 'rgba(247,200,65,0.10)',  label: 'Livello'   },
  qr_redeemed:       { color: '#C084FC', dimColor: 'rgba(192,132,252,0.10)', label: 'QR Code'   },
  pin_claimed:       { color: '#38BDF8', dimColor: 'rgba(56,189,248,0.10)',  label: 'Pin'       },
}

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const navRef   = useRef<HTMLElement>(null)

  const [gold, setGold]             = useState<number | null>(null)
  const [level, setLevel]           = useState<number | null>(null)
  const [exp, setExp]               = useState<number | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [endAt, setEndAt]           = useState<string | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [levelUpInfo, setLevelUpInfo]   = useState<LevelUpInfo | null>(null)
  const [notifPopup, setNotifPopup] = useState<NotifPopup | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifTab, setNotifTab] = useState<'messaggi' | 'eventi'>('messaggi')
  const [showPushSettings, setShowPushSettings] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [gameEvents, setGameEvents] = useState<PlayerGameEventRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  const initRef = useRef(false)

  function loadSessionData(sid: string) {
    getCurrentUser(supabase).then(user => {
      if (!user) { setStatsLoading(false); return }
      setUserId(user.id)
      Promise.all([
        supabase.from('player_sessions')
          .select('gold, level, exp')
          .eq('user_id', user.id)
          .eq('session_id', sid)
          .single(),
        supabase.from('sessions')
          .select('end_at, start_at, duration_minutes, status')
          .eq('id', sid)
          .single(),
      ]).then(([psResult, sessResult]) => {
        if (psResult.data) {
          setGold(psResult.data.gold)
          setLevel(psResult.data.level ?? 1)
          setExp(psResult.data.exp ?? 0)
        }
        const sess = sessResult.data
        if (sess) {
          setSessionStatus(sess.status ?? null)
          if (sess.end_at) {
            setEndAt(sess.end_at)
          } else if (sess.start_at && sess.duration_minutes) {
            const computed = new Date(
              new Date(sess.start_at).getTime() + sess.duration_minutes * 60 * 1000
            ).toISOString()
            setEndAt(computed)
          }
        }
        setStatsLoading(false)
      })
    })
  }

  useEffect(() => {
    const sid = localStorage.getItem('current_session_id')
    if (sid) {
      initRef.current = true
      loadSessionData(sid)
      // Populate the audio-override cache so the synth-vs-uploaded-mp3
      // decision in startMapAmbience/startEncounterLoop/etc. is synchronous
      // by the time the player navigates to a battle screen.
      hydrateAudioOverrides(sid)
    }

    function onStorage(e: StorageEvent) {
      if (e.key === 'current_session_id' && e.newValue && !initRef.current) {
        initRef.current = true
        setStatsLoading(true)
        loadSessionData(e.newValue)
        hydrateAudioOverrides(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)

    const fallback = setTimeout(() => {
      if (initRef.current) return
      const sid2 = localStorage.getItem('current_session_id')
      if (sid2) {
        initRef.current = true
        loadSessionData(sid2)
        hydrateAudioOverrides(sid2)
      } else {
        setStatsLoading(false)
      }
    }, 1500)

    return () => {
      window.removeEventListener('storage', onStorage)
      clearTimeout(fallback)
    }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active nav into view on route change
  useEffect(() => {
    const active = navRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [pathname])

  useEffect(() => {
    const inEncounter = pathname.startsWith('/game/encounter/')
    const inDuelFight = pathname.startsWith('/game/duel/') && pathname !== '/game/duel'
    const inBossFight = pathname.startsWith('/game/boss/')
    if (inEncounter || inDuelFight || inBossFight) return

    const prefetchRoutes = NAV_ITEMS
      .map(item => item.href)
      .filter(href => href !== pathname)

    const runPrefetch = () => {
      prefetchRoutes.forEach(href => {
        router.prefetch(href)
      })
    }

    const browserWindow = window as Window & typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (typeof browserWindow.requestIdleCallback === 'function') {
      const idleId = browserWindow.requestIdleCallback(runPrefetch, { timeout: 1200 })
      return () => browserWindow.cancelIdleCallback?.(idleId)
    }

    const timeoutId = globalThis.setTimeout(runPrefetch, 250)
    return () => globalThis.clearTimeout(timeoutId)
  }, [pathname, router])

  const timer = useSessionTimer({
    endAt,
    onExpired: () => setSessionEnded(true),
  })

  // Fix mobile viewport height
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function applyHeight() {
      if (rootRef.current) rootRef.current.style.height = `${window.innerHeight}px`
    }
    applyHeight()
    window.addEventListener('resize', applyHeight)
    window.addEventListener('orientationchange', applyHeight)
    return () => {
      window.removeEventListener('resize', applyHeight)
      window.removeEventListener('orientationchange', applyHeight)
    }
  }, [])

  // Refresh stats dynamically on any game event
  useEffect(() => {
    function onRefresh() {
      const sid = localStorage.getItem('current_session_id')
      if (sid) loadSessionData(sid)
    }
    window.addEventListener('wc:refresh-stats', onRefresh)
    return () => window.removeEventListener('wc:refresh-stats', onRefresh)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load notification history + unread count
  const loadNotifications = (uid: string) => {
    const sid = localStorage.getItem('current_session_id')
    if (!sid) return
    supabase
      .from('player_notifications')
      .select('*')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setNotifications(data)
          setUnreadCount(data.filter(n => !n.read).length)
        }
      })
  }

  const openNotifPanel = () => {
    setShowNotifPanel(true)
    if (userId) {
      setNotifLoading(true)
      const sid = localStorage.getItem('current_session_id')
      if (sid) {
        supabase
          .from('player_notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('session_id', sid)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(({ data }) => {
            if (data) setNotifications(data)
            setNotifLoading(false)
            // Mark all as read
            supabase
              .from('player_notifications')
              .update({ read: true })
              .eq('user_id', userId)
              .eq('session_id', sid)
              .eq('read', false)
              .then(() => setUnreadCount(0))
          })
      } else {
        setNotifLoading(false)
      }
    }
  }

  // Load game events
  const loadGameEvents = (uid: string) => {
    const sid = localStorage.getItem('current_session_id')
    if (!sid) return
    setEventsLoading(true)
    supabase
      .from('player_game_events')
      .select('*')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setGameEvents(data)
        setEventsLoading(false)
      })
  }

  // Player notifications realtime subscription
  useEffect(() => {
    if (!userId) return
    const sid = localStorage.getItem('current_session_id')
    if (!sid) return
    // Initial load
    loadNotifications(userId)
    loadGameEvents(userId)
    const channel = supabase
      .channel(`player-notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'player_notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as AdminNotificationRow
        // Add to list
        setNotifications(prev => [row, ...prev])
        setUnreadCount(prev => prev + 1)
        // Show popup
        if (row.type === 'item_redeemed') {
          const r = row.payload?.reward ?? {}
          const parts: string[] = []
          if (r.gold) parts.push(`+${r.gold} 💰`)
          if (r.exp) parts.push(`+${r.exp} ⭐`)
          setNotifPopup({
            type: 'item_redeemed',
            title: `✅ "${row.payload?.item_name}" riscattato!`,
            message: parts.length > 0 ? `Ricompensa: ${parts.join(' · ')}` : 'Oggetto consumato.',
            icon: '✅',
          })
          setTimeout(() => setNotifPopup(null), 6000)
        } else {
          setNotifPopup({
            type: 'admin_notify',
            title: row.payload?.title ?? 'Messaggio',
            message: row.payload?.message ?? '',
            icon: '📢',
          })
          setTimeout(() => setNotifPopup(null), 6000)
        }
      })
      .subscribe()

    // Game events realtime
    const eventsChannel = supabase
      .channel(`player-game-events:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'player_game_events',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setGameEvents(prev => [payload.new as PlayerGameEventRow, ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(eventsChannel)
    }
  }, [userId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: user-specific broadcast (admin_notify direct)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`shell:user:${userId}`)
      .on('broadcast', { event: 'admin_notify' }, ({ payload }) => {
        if (payload?.title) {
          setNotifPopup({ type: 'admin_notify', title: payload.title, message: payload.message ?? '', icon: '📢' })
          setTimeout(() => setNotifPopup(null), 6000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  // Show level-up notification
  useEffect(() => {
    function onLevelUp(e: Event) {
      const detail = (e as CustomEvent<LevelUpInfo>).detail
      if (detail?.newLevel) {
        playLevelUp()
        haptics.levelUp()
        setLevelUpInfo(detail)
        setTimeout(() => setLevelUpInfo(null), 4000)
        const sid = typeof window !== 'undefined' ? localStorage.getItem('current_session_id') : null
        if (sid) track('level_up', { sessionId: sid, newLevel: detail.newLevel })
      }
    }
    window.addEventListener('wc:level-up', onLevelUp)
    return () => window.removeEventListener('wc:level-up', onLevelUp)
  }, [])

  useEffect(() => {
    const warmup = () => {
      const ac = getSharedAC()
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
    }
    document.addEventListener('touchstart', warmup, { once: true, passive: true })
    document.addEventListener('click', warmup, { once: true })
    return () => {
      document.removeEventListener('touchstart', warmup)
      document.removeEventListener('click', warmup)
    }
  }, [])

  // Realtime: admin chiude sessione o aggiorna durata → aggiornamento immediato
  useEffect(() => {
    const sid = localStorage.getItem('current_session_id')
    if (!sid) return
    const channel = supabase
      .channel(`shell:session:${sid}`)
      .on('broadcast', { event: 'session_ended' }, () => setSessionEnded(true))
      .on('broadcast', { event: 'admin_notify' }, ({ payload }) => {
        if (payload?.title) {
          setNotifPopup({ type: 'admin_notify', title: payload.title, message: payload.message ?? '', icon: '📢' })
          setTimeout(() => setNotifPopup(null), 6000)
        }
      })
      .on('broadcast', { event: 'session_duration_updated' }, ({ payload }) => {
        if (payload?.endAt) setEndAt(payload.endAt)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const xpPct = exp !== null && level !== null ? xpProgress(exp, level) : 0

  return (
    <div ref={rootRef} className="flex flex-col bg-[#0F1F2E] text-white overflow-hidden" style={{ height: '100dvh' }}>
      <ImageLightbox />
      {/* Session status banner */}
      {!sessionEnded && sessionStatus === 'ready' && (
        <div className="flex-none bg-[#F7C841]/15 border-b border-[#F7C841]/35 px-4 py-1.5 text-center">
          <p className="text-[11px] text-[#F7C841] font-semibold">⏳ Sessione in attesa — il gioco non è ancora iniziato</p>
        </div>
      )}
      {sessionEnded && (
        <div className="flex-none bg-[#7B4DB8]/20 border-b border-[#7B4DB8]/40 px-4 py-1.5 text-center">
          <p className="text-[11px] text-[#C084FC] font-semibold">🏁 Sessione terminata — modalità visualizzazione</p>
        </div>
      )}

      {/* Header — premium prototype */}
      <GameTopBar
        level={level}
        xpPct={xpPct}
        gold={gold}
        timerFormatted={timer.formatted || ''}
        timerCritical={timer.isCritical}
        timerWarning={timer.isWarning}
        statsLoading={statsLoading}
        unreadCount={unreadCount}
        onBell={openNotifPanel}
      />

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">
        {/* Light cross-section transition. OPACITY ONLY — deliberately no
            transform: a lingering translate would create a containing
            block and break the `position: fixed` fullscreen overlays the
            map / encounter / duel / boss screens rely on. Keyed by
            pathname (no AnimatePresence exit) so the new section just
            fades in cleanly with no unmount race or scroll jank. */}
        <motion.div
          key={pathname}
          className="w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom navigation — Gilded Relic rail */}
      <nav
        ref={navRef}
        className="nav-scrollable relative flex flex-shrink-0"
        style={{
          background: 'radial-gradient(120% 180% at 50% 130%, #1a3142 0%, #0c1c2b 55%, #081420 100%)',
          borderTop: '1px solid rgba(247,200,65,0.42)',
          boxShadow: 'inset 0 1px 0 rgba(255,236,150,0.14), inset 0 10px 24px -12px rgba(0,0,0,0.6)',
          overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 'env(safe-area-inset-bottom)',
        } as React.CSSProperties}
      >
        {(() => {
          const inEncounter = pathname.startsWith('/game/encounter/')
          const inDuelFight = pathname.startsWith('/game/duel/') && pathname !== '/game/duel'
          const inBossFight = pathname.startsWith('/game/boss/')
          const inAnyBattle = inEncounter || inDuelFight || inBossFight
          if (inAnyBattle) {
            const battleMsg = inBossFight
              ? '💀 Sfida al Capo Palestra — combatti!'
              : inDuelFight
                ? '⚔️ Duello in corso — combatti!'
                : '⚔️ Incontro in corso — cattura o fuggi'
            return (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(247,200,65,0.4)' }}>{battleMsg}</span>
                </div>
                {NAV_ITEMS.map(({ href, key, label }) => {
                  const Icon = NAV_ICON[key]
                  return (
                    <span
                      key={href}
                      className="flex-shrink-0 flex flex-col items-center pt-1.5 pb-1 gap-0.5 cursor-not-allowed select-none"
                      style={{ minWidth: 56, width: `${100 / NAV_ITEMS.length}%`, opacity: 0.22 }}
                    >
                      {Icon && <Icon size={26} />}
                      <span className="truncate w-full text-center px-0.5 text-[10px]" style={{ color: 'var(--wc-ink-faint)' }}>{label}</span>
                    </span>
                  )
                })}
              </>
            )
          }
          return NAV_ITEMS.map(({ href, key, label, coachmark }) => {
            const Icon = NAV_ICON[key]
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                data-active={active ? 'true' : 'false'}
                data-coachmark={coachmark}
                className="relative flex-shrink-0 flex flex-col items-center pt-1.5 pb-1 gap-0.5 transition-all"
                style={{ minWidth: 56, width: `${100 / NAV_ITEMS.length}%` }}
              >
                {active && (
                  <span aria-hidden className="absolute top-0 rounded-full"
                    style={{ width: 24, height: 2.5, background: 'linear-gradient(90deg, #7FE6FF, #46BAD8)', boxShadow: '0 0 10px rgba(70,186,216,0.9)' }} />
                )}
                <motion.span
                  animate={{ scale: active ? 1.14 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                  style={{ opacity: active ? 1 : 0.82 }}
                >
                  {Icon && <Icon size={27} active={active} />}
                </motion.span>
                <span className="truncate w-full text-center px-0.5 text-[10px] font-semibold"
                  style={{ color: active ? '#7FE6FF' : 'var(--wc-ink-faint)' }}>{label}</span>
              </Link>
            )
          })
        })()}
      </nav>

      <LevelUpModal info={levelUpInfo} onDismiss={() => setLevelUpInfo(null)} />

      {/* Notification history panel */}
      <AnimatePresence>
        {showNotifPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9980] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNotifPanel(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-[min(100%,360px)] bg-[#0D1E2E] border-l border-white/10 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
                <h2 className="wc-display font-bold text-white text-base inline-flex items-center gap-2"><GiRingingBell size={18} color="#46bad8" /> Notifiche</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPushSettings(v => !v)}
                    aria-label={showPushSettings ? 'Nascondi impostazioni notifiche' : 'Impostazioni notifiche push'}
                    aria-expanded={showPushSettings}
                    title="Impostazioni notifiche push"
                    className="flex items-center justify-center transition-all"
                    style={{
                      width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                      background: showPushSettings ? 'rgba(58,188,168,0.18)' : 'transparent',
                      border: `1px solid ${showPushSettings ? 'rgba(58,188,168,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      color: showPushSettings ? '#3ABCA8' : 'rgba(255,255,255,0.55)',
                      fontSize: 15, lineHeight: 1,
                    }}
                  ><GiGears size={16} /></button>
                  <button onClick={() => setShowNotifPanel(false)} className="text-white/40 hover:text-white text-xl px-2">✕</button>
                </div>
              </div>
              {/* Push opt-in — visibile solo su tap dell'ingranaggio */}
              {showPushSettings && (
                <div className="border-b border-white/8 flex-shrink-0">
                  <PushOptIn expanded />
                </div>
              )}
              {/* Tabs */}
              <div className="flex-none px-4 py-2 border-b border-white/8">
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                  {(['messaggi', 'eventi'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setNotifTab(tab)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: notifTab === tab ? 'rgba(58,157,188,0.8)' : 'transparent',
                        color: notifTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {tab === 'messaggi' ? <><GiMegaphone size={13} /> Messaggi</> : <><GiJoystick size={13} /> Gioco</>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Messaggi list */}
              {notifTab === 'messaggi' && (
                <div className="flex-1 overflow-y-auto py-2">
                  {notifLoading ? (
                    <div className="space-y-2 px-4 pt-2">
                      {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
                      <GiRingingBell size={48} color="rgba(255,255,255,0.18)" />
                      <p className="text-sm">Nessun messaggio</p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const isRedeemed = n.type === 'item_redeemed'
                      const icon = isRedeemed ? '✅' : '📢'
                      const title = isRedeemed
                        ? `"${n.payload?.item_name}" riscattato`
                        : (n.payload?.title ?? 'Messaggio')
                      const body = isRedeemed
                        ? (() => {
                            const r = n.payload?.reward ?? {}
                            const p: string[] = []
                            if (r.gold) p.push(`+${r.gold} 💰`)
                            if (r.exp) p.push(`+${r.exp} ⭐`)
                            return p.length > 0 ? `Ricompensa: ${p.join(' · ')}` : ''
                          })()
                        : (n.payload?.message ?? '')
                      const time = new Date(n.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                      const fullDate = new Date(n.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      const isExpanded = expandedNotifId === n.id
                      return (
                        <div key={n.id} className={n.read ? 'opacity-60' : ''}>
                          <button
                            onClick={() => setExpandedNotifId(isExpanded ? null : n.id)}
                            className="w-full flex gap-3 px-4 py-3 border-b border-white/5 text-left active:bg-white/5 transition-colors cursor-pointer"
                          >
                            <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-white leading-snug">{title}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-white/30">{time}</span>
                                  <motion.span
                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="text-white/25 text-sm leading-none"
                                  >›</motion.span>
                                </div>
                              </div>
                              {body && <p className="text-xs text-white/50 mt-0.5 truncate">{body}</p>}
                            </div>
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#3A9DBC] shrink-0 mt-2" />}
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="mx-4 mb-3 mt-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                  {isRedeemed ? (
                                    <>
                                      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-2">Dettagli riscatto</p>
                                      {n.payload?.item_name && (
                                        <p className="text-sm font-bold text-white mb-2">📦 {n.payload.item_name}</p>
                                      )}
                                      {(() => {
                                        const r = n.payload?.reward ?? {}
                                        const bonusItems: Array<{ quantity: number }> = r.bonus_items ?? []
                                        return (
                                          <>
                                            {(r.gold || r.exp) && (
                                              <div className="flex gap-2 flex-wrap mb-2">
                                                {r.gold ? <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(212,169,106,0.15)', color: '#D4A96A' }}>+{r.gold} 💰</span> : null}
                                                {r.exp  ? <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(247,200,65,0.15)',  color: '#F7C841' }}>+{r.exp} ⭐</span>  : null}
                                              </div>
                                            )}
                                            {bonusItems.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mb-2">
                                                {bonusItems.map((bi, i) => (
                                                  <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    🎁 ×{bi.quantity} oggetto
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        )
                                      })()}
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-2">Messaggio admin</p>
                                      {n.payload?.message && (
                                        <p className="text-xs text-white/70 leading-relaxed mb-2">{n.payload.message}</p>
                                      )}
                                    </>
                                  )}
                                  <p className="text-[10px] text-white/25">{fullDate}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
              {/* Gioco eventi list */}
              {notifTab === 'eventi' && (
                <div className="flex-1 overflow-y-auto py-2">
                  {eventsLoading ? (
                    <div className="space-y-2 px-4 pt-2">
                      {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
                    </div>
                  ) : gameEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
                      <GiJoystick size={48} color="rgba(255,255,255,0.18)" />
                      <p className="text-sm">Nessun evento di gioco</p>
                    </div>
                  ) : (
                    gameEvents.map((ev) => {
                      const { icon, title, body } = formatGameEvent(ev)
                      const time     = new Date(ev.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                      const fullDate = new Date(ev.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      const isExpanded = expandedEventId === ev.id
                      const p = ev.payload ?? {}
                      const theme = EVENT_THEMES[ev.type as string] ?? { color: '#60A5FA', dimColor: 'rgba(96,165,250,0.08)', label: ev.type }
                      const rarityInfo = p.rarity ? RARITY_DISPLAY[p.rarity as string] : null

                      // ── helpers ──────────────────────────────────────────────
                      const RewardChips = ({ gold, exp }: { gold?: number; exp?: number }) => (
                        (gold || exp) ? (
                          <div className="flex gap-2 flex-wrap">
                            {gold ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(212,169,106,0.18)', color: '#D4A96A', border: '1px solid rgba(212,169,106,0.3)' }}>+{gold} 💰</span> : null}
                            {exp  ? <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(247,200,65,0.15)',  color: '#F7C841', border: '1px solid rgba(247,200,65,0.3)'  }}>+{exp} ⭐</span>  : null}
                          </div>
                        ) : null
                      )
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const DuelSquadColumn = ({ label, creatures, accentColor }: { label: string; creatures: any[]; accentColor: string }) => (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accentColor + 'AA' }}>{label}</p>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {creatures.map((cr: any, i: number) => {
                            const crRarity = cr.rarity ? RARITY_DISPLAY[cr.rarity as string] : null
                            return (
                              <div key={i} className="flex items-center gap-1.5 rounded-lg p-1.5" style={{ background: 'rgba(0,0,0,0.22)', border: `1px solid ${crRarity?.color ?? accentColor}22` }}>
                                <div className="w-9 h-9 rounded-md shrink-0 overflow-hidden flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                  {cr.image_url
                                    ? <img src={cr.image_url} alt={cr.name} className="w-full h-full object-contain" />
                                    : <GiPawPrint size={18} color="rgba(255,255,255,0.4)" />
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-white truncate leading-tight">{cr.name ?? '—'}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {crRarity && <span className="text-[9px] font-bold px-1 py-0.5 rounded-full" style={{ background: `${crRarity.color}20`, color: crRarity.color }}>{crRarity.label}</span>}
                                    {cr.element && <span className="inline-flex items-center px-1 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}><ElementIcon element={cr.element as string} size={10} /></span>}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )

                      return (
                        <div key={ev.id}>
                          {/* ── list row ────────────────────────────────────── */}
                          <button
                            onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                            className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/5 text-left transition-colors cursor-pointer"
                            style={{
                              borderLeft: `3px solid ${isExpanded ? theme.color : theme.color + '55'}`,
                              background: isExpanded ? theme.dimColor : 'transparent',
                            }}
                          >
                            {/* Icon pill */}
                            <span
                              className="text-base shrink-0 w-8 h-8 flex items-center justify-center rounded-xl mt-0.5"
                              style={{ background: theme.dimColor, border: `1px solid ${theme.color}30` }}
                            >
                              {icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-white leading-snug">{title}</p>
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <span className="text-[10px]" style={{ color: theme.color + 'BB' }}>{time}</span>
                                  <motion.span
                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="text-sm leading-none"
                                    style={{ color: theme.color + '88' }}
                                  >›</motion.span>
                                </div>
                              </div>
                              {body && (
                                <p className="text-xs mt-0.5 truncate" style={{ color: theme.color + 'BB' }}>{body}</p>
                              )}
                            </div>
                          </button>

                          {/* ── expanded detail ──────────────────────────────── */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="mx-3 mb-3 mt-1 rounded-xl overflow-hidden"
                                  style={{ border: `1px solid ${theme.color}30`, background: theme.dimColor }}
                                >
                                  {/* color header band */}
                                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: `${theme.color}18`, borderBottom: `1px solid ${theme.color}25` }}>
                                    <span className="text-sm">{icon}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.color }}>{theme.label}</span>
                                    <span className="ml-auto text-[10px]" style={{ color: theme.color + '80' }}>{fullDate}</span>
                                  </div>

                                  <div className="p-3 space-y-2.5">

                                    {/* ── CATCH ─────────────────────────────── */}
                                    {ev.type === 'catch' && (
                                      <>
                                        {/* Creature card */}
                                        <div className="flex gap-3 rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${rarityInfo?.color ?? '#ffffff'}22` }}>
                                          {/* Image */}
                                          <div className="w-16 h-16 rounded-lg shrink-0 overflow-hidden flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                            {p.image_url
                                              ? <img src={p.image_url} alt={p.creature_name} className="w-full h-full object-contain" />
                                              : <GiPawPrint size={28} color="rgba(255,255,255,0.4)" />
                                            }
                                          </div>
                                          {/* Info */}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white leading-tight mb-1">{p.creature_name ?? '—'}</p>
                                            <div className="flex flex-wrap gap-1 mb-2">
                                              {rarityInfo && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${rarityInfo.color}22`, color: rarityInfo.color, border: `1px solid ${rarityInfo.color}50` }}>
                                                  {rarityInfo.label}
                                                </span>
                                              )}
                                              {p.element && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
                                                  <ElementIcon element={p.element as string} size={11} /> {p.element}
                                                </span>
                                              )}
                                              {p.evolved && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>✨ Ev.</span>}
                                            </div>
                                            {/* Stats */}
                                            {(p.hp || p.atk || p.def) && (
                                              <div className="flex gap-2.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                                {p.hp  != null && <span>❤️ {p.hp}</span>}
                                                {p.atk != null && <span>⚔️ {p.atk}</span>}
                                                {p.def != null && <span>🛡️ {p.def}</span>}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {/* Source + rewards */}
                                        <div className="flex flex-wrap gap-1.5">
                                          {p.via_pin  && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(58,157,188,0.15)',  color: '#3A9DBC' }}>📍 pin</span>}
                                          {p.via_egg  && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)',  color: '#FBBF24' }}>🥚 uovo</span>}
                                          {p.via_qr   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(192,132,252,0.15)', color: '#C084FC' }}>📱 QR</span>}
                                          {p.starter  && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)',  color: '#34D399' }}>⭐ starter</span>}
                                        </div>
                                        <RewardChips gold={p.gold} exp={p.exp} />
                                      </>
                                    )}

                                    {/* ── DUEL WON ──────────────────────────── */}
                                    {ev.type === 'duel_won' && (() => {
                                      const oppName = p.opponent_name as string | null
                                      const mySquad  = (p.my_creatures  as any[]) ?? []
                                      const oppSquad = (p.opp_creatures as any[]) ?? []
                                      return (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <p className="text-base font-extrabold" style={{ color: '#34D399' }}>🏆 Vittoria!</p>
                                            {oppName && <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>vs {oppName}</span>}
                                          </div>
                                          {(mySquad.length > 0 || oppSquad.length > 0) && (
                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                              <DuelSquadColumn label="La tua squadra" creatures={mySquad} accentColor="#34D399" />
                                              <DuelSquadColumn label="Avversario" creatures={oppSquad} accentColor="#F87171" />
                                            </div>
                                          )}
                                          <RewardChips gold={p.gold} exp={p.exp} />
                                        </>
                                      )
                                    })()}

                                    {/* ── DUEL LOST ─────────────────────────── */}
                                    {ev.type === 'duel_lost' && (() => {
                                      const winnerName = p.winner_name as string | null
                                      const mySquad    = (p.my_creatures  as any[]) ?? []
                                      const oppSquad   = (p.opp_creatures as any[]) ?? []
                                      return (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <p className="text-base font-extrabold" style={{ color: '#F87171' }}>💀 Sconfitta</p>
                                            {winnerName && <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>vs {winnerName}</span>}
                                          </div>
                                          {(mySquad.length > 0 || oppSquad.length > 0) && (
                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                              <DuelSquadColumn label="La tua squadra" creatures={mySquad} accentColor="#F87171" />
                                              <DuelSquadColumn label="Avversario" creatures={oppSquad} accentColor="#34D399" />
                                            </div>
                                          )}
                                        </>
                                      )
                                    })()}

                                    {/* ── DUEL CANCELLED ───────────────────── */}
                                    {ev.type === 'duel_cancelled' && (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <p className="text-base font-extrabold" style={{ color: '#94A3B8' }}>🤝 Duello annullato</p>
                                          {p.opponent_name && <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>vs {p.opponent_name as string}</span>}
                                        </div>
                                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Il duello è stato interrotto — nessun punto assegnato.</p>
                                      </>
                                    )}

                                    {/* ── BOSS WON ──────────────────────────── */}
                                    {ev.type === 'boss_won' && (
                                      <>
                                        {p.boss_name && <p className="text-base font-extrabold" style={{ color: '#F7C841' }}>💀 {p.boss_name}</p>}
                                        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(247,200,65,0.15)', color: '#F7C841', border: '1px solid rgba(247,200,65,0.35)' }}>
                                          👑 Capo Palestra sconfitto
                                        </span>
                                        <RewardChips gold={p.gold} exp={p.exp} />
                                      </>
                                    )}

                                    {/* ── BOSS LOST ─────────────────────────── */}
                                    {ev.type === 'boss_lost' && (
                                      <>
                                        {p.boss_name && <p className="text-base font-extrabold" style={{ color: 'rgba(255,255,255,0.75)' }}>💀 {p.boss_name}</p>}
                                        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                                          Sconfitta dal Capo Palestra
                                        </span>
                                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Puoi ritentare la sfida al prossimo incontro.</p>
                                      </>
                                    )}

                                    {/* ── MISSION COMPLETED ─────────────────── */}
                                    {ev.type === 'mission_completed' && (
                                      <>
                                        <p className="text-base font-extrabold text-white">
                                          {p.title ?? p.mission_target ?? 'Missione completata!'}
                                        </p>
                                        {/* Objective detail */}
                                        {(p.mission_target || (p.target_count ?? 0) > 1) && (
                                          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                                            <span className="text-sm">🎯</span>
                                            <p className="text-xs text-white/70">
                                              {(p.target_count ?? 0) > 1
                                                ? `${p.target_count}× ${p.mission_target ?? 'completamenti'}`
                                                : (p.mission_target ?? 'completato')}
                                            </p>
                                          </div>
                                        )}
                                        <RewardChips gold={p.reward_gold} exp={p.reward_exp} />
                                      </>
                                    )}

                                    {/* ── LEVEL UP ──────────────────────────── */}
                                    {ev.type === 'level_up' && (
                                      <>
                                        <div className="flex items-end gap-2">
                                          <span className="font-black leading-none" style={{ fontSize: 48, color: '#F7C841', textShadow: '0 0 24px rgba(247,200,65,0.5)' }}>{p.new_level}</span>
                                          <span className="text-sm font-bold mb-1.5" style={{ color: 'rgba(247,200,65,0.7)' }}>Livello raggiunto!</span>
                                        </div>
                                        {(p.gold_reward ?? 0) > 0 && (
                                          <span className="inline-block text-sm font-bold px-3 py-1.5 rounded-xl" style={{ background: 'rgba(212,169,106,0.18)', color: '#D4A96A', border: '1px solid rgba(212,169,106,0.35)' }}>
                                            +{p.gold_reward} 💰 bonus livello
                                          </span>
                                        )}
                                      </>
                                    )}

                                    {/* ── QR REDEEMED ───────────────────────── */}
                                    {ev.type === 'qr_redeemed' && (
                                      <>
                                        <p className="text-sm font-bold text-white">{p.item_name ?? 'QR riscattato'}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {p.qr_type && (
                                            <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(192,132,252,0.12)', color: '#C084FC', border: '1px solid rgba(192,132,252,0.28)' }}>
                                              {REWARD_TYPE_ICONS[p.qr_type as string] ?? '📱'} {p.qr_type}
                                            </span>
                                          )}
                                          {p.egg_rarity && (
                                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24' }}>🥚 {p.egg_rarity}</span>
                                          )}
                                        </div>
                                        {p.qr_label && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Etichetta: {p.qr_label}</p>}
                                        <RewardChips gold={p.gold} exp={p.exp} />
                                      </>
                                    )}

                                    {/* ── PIN CLAIMED ───────────────────────── */}
                                    {ev.type === 'pin_claimed' && (
                                      <>
                                        <p className="text-sm font-bold text-white">{p.pin_name ?? 'Pin'}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {p.reward_type && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.28)' }}>
                                              {REWARD_TYPE_ICONS[p.reward_type as string] ?? '🎁'} {p.reward_type}
                                            </span>
                                          )}
                                          {p.creature_name && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }}>🎯 {p.creature_name}</span>}
                                          {p.item_name    && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }}>📦 {p.item_name}</span>}
                                          {p.egg_rarity   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24' }}>🥚 uovo {p.egg_rarity}</span>}
                                        </div>
                                        <RewardChips
                                          gold={p.gold ?? (p.reward_type === 'gold' ? p.amount : undefined)}
                                          exp={p.exp   ?? (p.reward_type === 'exp'  ? p.amount : undefined)}
                                        />
                                      </>
                                    )}

                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <NotifPopupComponent popup={notifPopup} onDismiss={() => setNotifPopup(null)} />
    </div>
  )
}
