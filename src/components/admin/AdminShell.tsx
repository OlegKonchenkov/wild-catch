'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',             label: '📊 Dashboard'  },
  { href: '/admin/sessions',    label: '🎮 Sessioni'   },
  { href: '/admin/creatures',   label: '🐾 Creature'   },
  { href: '/admin/missions',    label: '🎯 Missioni'   },
  { href: '/admin/qrcodes',     label: '📷 QR Codes'   },
  { href: '/admin/invites',     label: '🎟️ Inviti'     },
  { href: '/admin/players',     label: '👥 Giocatori'  },
  { href: '/admin/leaderboard', label: '🏆 Classifica' },
  { href: '/admin/guide',       label: '📘 Guida Admin' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-screen bg-[#0F1F2E] text-white">
      {/* Sidebar (desktop) */}
      <nav className="hidden md:flex flex-col w-48 border-r border-white/10 p-4 gap-1 shrink-0">
        <div className="font-bold text-[#3A9DBC] mb-4 text-lg">⚙️ Admin</div>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === href ? 'bg-[#3A9DBC]/20 text-[#3A9DBC]' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}>
            {label}
          </Link>
        ))}
      </nav>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 flex overflow-x-auto bg-[#0F1F2E] border-t border-white/10 z-10">
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`flex-shrink-0 px-3 py-2 text-xs text-center ${
              pathname === href ? 'text-[#3A9DBC]' : 'text-white/40'
            }`}>
            {label.split(' ')[0]}<br/>{label.split(' ').slice(1).join(' ')}
          </Link>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">{children}</main>
    </div>
  )
}
