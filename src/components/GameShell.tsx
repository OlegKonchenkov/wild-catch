'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useSessionTimer } from '@/hooks/useSessionTimer'

const NAV_ITEMS = [
  { href: '/game/map',      icon: '🗺️', label: 'Mappa'     },
  { href: '/game/bestiary', icon: '🦎', label: 'WildDex'   },
  { href: '/game/duel',     icon: '⚔️', label: 'Duelli'   },
  { href: '/game/missions', icon: '🎯', label: 'Missioni'  },
  { href: '/game/shop',     icon: '🛒', label: 'Shop'      },
  { href: '/game/backpack', icon: '🎒', label: 'Zaino'     },
  { href: '/game/profile',  icon: '🏆', label: 'Classifica'},
  { href: '/game/guide',    icon: '❓', label: 'Guida'     },
  { href: '/home',          icon: '🏠', label: 'Profilo'   },
]

// XP formula: level = floor(exp/50) + 1
// Level N starts at (N-1)*50 EXP
function xpProgress(exp: number, level: number): number {
  const xpInLevel = exp - (level - 1) * 50
  return Math.min(100, Math.max(0, (xpInLevel / 50) * 100))
}

interface LevelUpInfo {
  newLevel: number
  goldReward: number
}

interface NotifPopup {
  type: 'admin_notify' | 'item_redeemed'
  title: string
  message: string
  icon?: string
}

function formatGameEvent(ev: any): { icon: string; title: string; body: string } {
  const p = ev.payload ?? {}
  switch (ev.type) {
    case 'catch':
      return {
        icon: '🎯',
        title: `Catturato: ${p.creature_name ?? 'creatura'}`,
        body: [p.rarity, p.evolved ? 'evoluto!' : ''].filter(Boolean).join(' · '),
      }
    case 'duel_won':
      return { icon: '🏆', title: 'Duello vinto!', body: '' }
    case 'duel_lost':
      return { icon: '💀', title: 'Duello perso', body: '' }
    case 'boss_won':
      return {
        icon: '👑',
        title: 'Boss sconfitto!',
        body: p.gold ? `+${p.gold} 💰 · +${p.exp ?? 0} ⭐` : '',
      }
    case 'boss_lost':
      return { icon: '💀', title: 'Sconfitto dal boss', body: '' }
    case 'mission_completed':
      return { icon: '✅', title: 'Missione completata!', body: p.mission_target ? p.mission_target : '' }
    case 'level_up':
      return { icon: '⭐', title: `Livello ${p.new_level}!`, body: p.gold_reward > 0 ? `+${p.gold_reward} 💰` : '' }
    case 'qr_redeemed': {
      const parts: string[] = []
      if (p.gold) parts.push(`+${p.gold} 💰`)
      if (p.exp)  parts.push(`+${p.exp} ⭐`)
      return { icon: '📱', title: `QR: "${p.item_name}"`, body: parts.join(' · ') }
    }
    default:
      return { icon: '🎮', title: ev.type, body: '' }
  }
}

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const navRef   = useRef<HTMLElement>(null)

  const [gold, setGold]             = useState<number | null>(null)
  const [level, setLevel]           = useState<number | null>(null)
  const [exp, setExp]               = useState<number | null>(null)
  const [endAt, setEndAt]           = useState<string | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [levelUpInfo, setLevelUpInfo]   = useState<LevelUpInfo | null>(null)
  const [notifPopup, setNotifPopup] = useState<NotifPopup | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifTab, setNotifTab] = useState<'messaggi' | 'eventi'>('messaggi')
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [gameEvents, setGameEvents] = useState<any[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const initRef = useRef(false)

  function loadSessionData(sid: string) {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setStatsLoading(false); return }
      setUserId(user.id)
      Promise.all([
        supabase.from('player_sessions')
          .select('gold, level, exp')
          .eq('user_id', user.id)
          .eq('session_id', sid)
          .single(),
        supabase.from('sessions')
          .select('end_at, start_at, duration_minutes')
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
    }

    function onStorage(e: StorageEvent) {
      if (e.key === 'current_session_id' && e.newValue && !initRef.current) {
        initRef.current = true
        setStatsLoading(true)
        loadSessionData(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)

    const fallback = setTimeout(() => {
      if (initRef.current) return
      const sid2 = localStorage.getItem('current_session_id')
      if (sid2) {
        initRef.current = true
        loadSessionData(sid2)
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
        const row = payload.new as any
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
        setGameEvents(prev => [payload.new, ...prev])
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
        setLevelUpInfo(detail)
        // Auto-dismiss after 4s
        setTimeout(() => setLevelUpInfo(null), 4000)
      }
    }
    window.addEventListener('wc:level-up', onLevelUp)
    return () => window.removeEventListener('wc:level-up', onLevelUp)
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
      {/* Session-ended banner */}
      {sessionEnded && (
        <div className="flex-none bg-[#7B4DB8]/20 border-b border-[#7B4DB8]/40 px-4 py-1.5 text-center">
          <p className="text-[11px] text-[#C084FC] font-semibold">🏁 Sessione terminata — modalità visualizzazione</p>
        </div>
      )}

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-2 bg-[#0F1F2E]/95 border-b border-white/10 z-10">
        {/* Level + XP bar */}
        <div className="flex flex-col gap-0.5 min-w-[52px]">
          {statsLoading
            ? <div className="w-10 h-4 rounded bg-white/10 animate-pulse" />
            : <span className="text-sm font-bold text-[#F7C841]">Lv {level ?? 1}</span>
          }
          {/* XP progress bar */}
          <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#F7C841]"
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Gold */}
        <div className="flex items-center gap-1 text-[#D4A96A]">
          {statsLoading
            ? <div className="w-12 h-4 rounded bg-white/10 animate-pulse" />
            : <><span className="text-sm">💰</span><span className="text-sm font-bold">{gold ?? '—'}</span></>
          }
        </div>

        {/* Timer + bell */}
        <div className="flex items-center gap-2">
          <div className={`text-sm font-mono ${
            timer.isCritical ? 'text-red-400 animate-pulse' :
            timer.isWarning  ? 'text-amber-400' : 'text-[#E85D2F]'
          }`}>
            ⏱ {timer.formatted || '--:--'}
          </div>
          <button
            onClick={openNotifPanel}
            className="relative p-1 text-white/50 hover:text-white transition-colors"
            aria-label="Notifiche"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">{children}</main>

      {/* Bottom navigation */}
      <nav
        ref={navRef}
        className="nav-scrollable relative flex border-t border-white/10 bg-[#0F1F2E]/95 flex-shrink-0"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 'env(safe-area-inset-bottom)' } as React.CSSProperties}
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
                  <span className="text-[10px] text-white/25 tracking-widest uppercase">{battleMsg}</span>
                </div>
                {NAV_ITEMS.map(({ href, icon, label }) => (
                  <span
                    key={href}
                    className="flex-shrink-0 flex flex-col items-center py-2 gap-0.5 text-xs text-white/15 cursor-not-allowed select-none"
                    style={{ minWidth: 56, width: `${100 / NAV_ITEMS.length}%` }}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="truncate w-full text-center px-0.5">{label}</span>
                  </span>
                ))}
              </>
            )
          }
          return NAV_ITEMS.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              data-active={pathname === href ? 'true' : 'false'}
              className={`flex-shrink-0 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                pathname === href ? 'text-[#3A9DBC]' : 'text-white/50 hover:text-white/80'
              }`}
              style={{ minWidth: 56, width: `${100 / NAV_ITEMS.length}%` }}
            >
              <span className="text-xl">{icon}</span>
              <span className="truncate w-full text-center px-0.5">{label}</span>
            </Link>
          ))
        })()}
      </nav>

      {/* Level-up modal */}
      <AnimatePresence>
        {levelUpInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            onClick={() => setLevelUpInfo(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

            {/* Sparkle rings */}
            <motion.div
              className="absolute rounded-full border-2 border-[#F7C841]/20"
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{ width: 500, height: 500, opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
            />
            <motion.div
              className="absolute rounded-full border border-[#F7C841]/30"
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{ width: 380, height: 380, opacity: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
            />

            {/* Card */}
            <motion.div
              initial={{ scale: 0.4, y: 60, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="relative z-10 text-center px-10 py-8 rounded-3xl bg-[#0F1F2E]/90 border border-[#F7C841]/30"
              style={{ boxShadow: '0 0 60px rgba(247,200,65,0.25), 0 20px 60px rgba(0,0,0,0.6)' }}
            >
              {/* Star */}
              <motion.div
                className="text-6xl mb-3"
                animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                ⭐
              </motion.div>

              <p className="text-[#F7C841]/80 text-xs font-bold tracking-[0.25em] uppercase mb-1">
                Livello
              </p>

              <motion.p
                className="font-black text-white leading-none"
                style={{ fontSize: '5.5rem' }}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
              >
                {levelUpInfo.newLevel}
              </motion.p>

              {levelUpInfo.goldReward > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4A96A]/15 border border-[#D4A96A]/30"
                >
                  <span className="text-lg">💰</span>
                  <span className="text-[#D4A96A] font-bold text-lg">+{levelUpInfo.goldReward}</span>
                </motion.div>
              )}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-5 text-white/35 text-xs"
              >
                Tocca per continuare
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <h2 className="font-bold text-white text-base">🔔 Notifiche</h2>
                <button onClick={() => setShowNotifPanel(false)} className="text-white/40 hover:text-white text-xl">✕</button>
              </div>
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
                      {tab === 'messaggi' ? '📢 Messaggi' : '🎮 Gioco'}
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
                      <span className="text-5xl">🔕</span>
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
                      return (
                        <div key={n.id}
                          className={`flex gap-3 px-4 py-3 border-b border-white/5 ${n.read ? 'opacity-60' : ''}`}>
                          <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white leading-snug">{title}</p>
                              <span className="text-[10px] text-white/30 shrink-0 mt-0.5">{time}</span>
                            </div>
                            {body && <p className="text-xs text-white/50 mt-0.5">{body}</p>}
                          </div>
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#3A9DBC] shrink-0 mt-2" />}
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
                      {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
                    </div>
                  ) : gameEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
                      <span className="text-5xl">🎮</span>
                      <p className="text-sm">Nessun evento di gioco</p>
                    </div>
                  ) : (
                    gameEvents.map((ev: any) => {
                      const { icon, title, body } = formatGameEvent(ev)
                      const time = new Date(ev.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={ev.id} className="flex gap-3 px-4 py-3 border-b border-white/5">
                          <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white leading-snug">{title}</p>
                              <span className="text-[10px] text-white/30 shrink-0 mt-0.5">{time}</span>
                            </div>
                            {body && <p className="text-xs text-white/50 mt-0.5">{body}</p>}
                          </div>
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

      {/* Admin/system notification popup */}
      <AnimatePresence>
        {notifPopup && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-4 left-4 right-4 z-[9990] pointer-events-auto"
            onClick={() => setNotifPopup(null)}
          >
            <div className="bg-[#0F1F2E]/95 border border-[#3A9DBC]/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm flex items-start gap-3"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(58,157,188,0.2)' }}>
              <span className="text-2xl shrink-0 mt-0.5">{notifPopup.icon ?? '📢'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm leading-tight">{notifPopup.title}</p>
                {notifPopup.message && (
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{notifPopup.message}</p>
                )}
              </div>
              <button className="text-white/30 hover:text-white text-lg leading-none shrink-0 mt-0.5">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
