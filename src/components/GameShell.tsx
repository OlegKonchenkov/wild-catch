'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useSessionTimer } from '@/hooks/useSessionTimer'

const NAV_ITEMS = [
  { href: '/game/map',      icon: '🗺️', label: 'Mappa'     },
  { href: '/game/bestiary', icon: '📖', label: 'Bestiario' },
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

  const initRef = useRef(false)

  function loadSessionData(sid: string) {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setStatsLoading(false); return }
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

        {/* Timer */}
        <div className={`text-sm font-mono ${
          timer.isCritical ? 'text-red-400 animate-pulse' :
          timer.isWarning  ? 'text-amber-400' : 'text-[#E85D2F]'
        }`}>
          ⏱ {timer.formatted || '--:--'}
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
          if (inEncounter) {
            return (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-white/25 tracking-widest uppercase">⚔️ Incontro in corso — cattura o fuggi</span>
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
    </div>
  )
}
