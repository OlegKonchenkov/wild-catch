'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSessionTimer } from '@/hooks/useSessionTimer'

const NAV_ITEMS = [
  { href: '/game/map',      icon: '🗺️', label: 'Mappa'     },
  { href: '/game/bestiary', icon: '📖', label: 'Bestiario' },
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

  const [gold, setGold]     = useState<number | null>(null)
  const [level, setLevel]   = useState<number>(1)
  const [endAt, setEndAt]   = useState<string | null>(null)

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      // Gold + level
      supabase.from('player_sessions')
        .select('gold, level')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
        .then(({ data }) => {
          if (data) { setGold(data.gold); setLevel(data.level ?? 1) }
        })
    })

    // Session end time
    supabase.from('sessions')
      .select('end_at')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => { if (data?.end_at) setEndAt(data.end_at) })
  }, [supabase])

  const timer = useSessionTimer({
    endAt,
    onExpired: () => router.replace('/game/profile?ended=1'),
  })

  return (
    <div className="flex flex-col h-screen bg-[#0F1F2E] text-white">
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

      {/* Bottom navigation */}
      <nav className="flex border-t border-white/10 bg-[#0F1F2E]/95 overflow-x-auto">
        {NAV_ITEMS.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-shrink-0 flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
              pathname === href ? 'text-[#3A9DBC]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
