'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/game/map',      icon: '🗺️', label: 'Mappa'     },
  { href: '/game/bestiary', icon: '📖', label: 'Bestiario' },
  { href: '/game/missions', icon: '🎯', label: 'Missioni'  },
  { href: '/game/backpack', icon: '🎒', label: 'Zaino'     },
  { href: '/game/profile',  icon: '👤', label: 'Profilo'   },
]

export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-screen bg-[#0F1F2E] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0F1F2E]/95 border-b border-white/10 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#F7C841]">Lv 1</span>
          <div className="w-24 h-2 bg-white/10 rounded-full">
            <div className="h-full w-1/3 bg-[#F7C841] rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#D4A96A]">
          <span className="text-sm">💰</span>
          <span className="text-sm font-bold">100</span>
        </div>
        <div className="text-sm text-[#E85D2F] font-mono">⏱ --:--</div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">{children}</main>

      {/* Bottom navigation */}
      <nav className="flex border-t border-white/10 bg-[#0F1F2E]/95">
        {NAV_ITEMS.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
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
