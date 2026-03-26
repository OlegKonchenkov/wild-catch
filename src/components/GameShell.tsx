'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo, useRef } from 'react'
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
  { href: '/home',          icon: '🏠', label: 'Home'      },
]

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const navRef   = useRef<HTMLElement>(null)

  const [gold, setGold]     = useState<number | null>(null)
  const [level, setLevel]   = useState<number>(1)
  const [endAt, setEndAt]   = useState<string | null>(null)

  const initRef = useRef(false)

  function loadSessionData(sid: string) {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      Promise.all([
        supabase.from('player_sessions')
          .select('gold, level')
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
      })
    })
  }

  useEffect(() => {
    // Initial load
    const sid = localStorage.getItem('current_session_id')
    if (sid) {
      initRef.current = true
      loadSessionData(sid)
    }

    // Listen for localStorage changes from map/page.tsx restore flow
    // (fires when another tab or the same page sets 'current_session_id')
    function onStorage(e: StorageEvent) {
      if (e.key === 'current_session_id' && e.newValue && !initRef.current) {
        initRef.current = true
        loadSessionData(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)

    // Also poll once after 1.5s in case localStorage was empty on first render
    // but gets populated by map/page.tsx restore flow (same-tab, no storage event)
    const fallback = setTimeout(() => {
      if (initRef.current) return
      const sid2 = localStorage.getItem('current_session_id')
      if (sid2) {
        initRef.current = true
        loadSessionData(sid2)
      }
    }, 1500)

    return () => {
      window.removeEventListener('storage', onStorage)
      clearTimeout(fallback)
    }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the active nav item into view whenever the route changes
  useEffect(() => {
    const active = navRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [pathname])

  const timer = useSessionTimer({
    endAt,
    onExpired: () => router.replace('/game/profile?ended=1'),
  })

  // Fix mobile viewport height after hard refresh: window.innerHeight is always accurate,
  // whereas 100dvh can be off when the browser address bar is visible on page load.
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

  // Refresh header stats (gold, level) whenever the game changes them
  useEffect(() => {
    function onRefresh() {
      const sid = localStorage.getItem('current_session_id')
      if (sid) loadSessionData(sid)
    }
    window.addEventListener('wc:refresh-stats', onRefresh)
    return () => window.removeEventListener('wc:refresh-stats', onRefresh)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className="flex flex-col bg-[#0F1F2E] text-white overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0F1F2E]/95 border-b border-white/10 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#F7C841]">Lv {level}</span>
        </div>
        <div className="flex items-center gap-1 text-[#D4A96A]">
          <span className="text-sm">💰</span>
          <span className="text-sm font-bold">{gold ?? '—'}</span>
        </div>
        <div className={`text-sm font-mono ${
          timer.isCritical ? 'text-red-400 animate-pulse' :
          timer.isWarning  ? 'text-amber-400' : 'text-[#E85D2F]'
        }`}>
          ⏱ {timer.formatted || '--:--'}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">{children}</main>

      {/* Bottom navigation — horizontal scroll when items overflow */}
      <nav
        ref={navRef}
        className="nav-scrollable flex border-t border-white/10 bg-[#0F1F2E]/95 flex-shrink-0"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 'env(safe-area-inset-bottom)' } as React.CSSProperties}
      >
        {NAV_ITEMS.map(({ href, icon, label }) => (
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
        ))}
      </nav>
    </div>
  )
}
