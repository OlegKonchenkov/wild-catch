interface GameScreenLoadingProps {
  label?: string
}

interface GameBattleSkeletonProps {
  background?: string
  accent?: string
}

interface GameListSkeletonProps {
  rows?: number
  className?: string
  itemClassName?: string
}

interface GameGridSkeletonProps {
  items?: number
  className?: string
}

export function GameMapSkeleton() {
  return (
    <div className="relative h-full overflow-hidden" style={{ background: '#0A1520' }}>
      <style>{`
        @keyframes wcsk-sweep { to { transform: rotate(360deg); } }
        @keyframes wcsk-ring  { 0% { transform: scale(0.35); opacity: 0.55; } 80% { transform: scale(1); opacity: 0; } 100% { opacity: 0; } }
        @keyframes wcsk-core  { 0%,100% { transform: scale(0.85); opacity: 0.8; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes wcsk-shim  { 0% { background-position: -180% 0; } 100% { background-position: 180% 0; } }
        .wcsk-shim {
          background-image: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(58,188,168,0.16) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 180% 100%;
          animation: wcsk-shim 1.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wcsk-sweep, .wcsk-ring, .wcsk-core, .wcsk-shim { animation: none; }
        }
      `}</style>

      {/* Map-grid hint (reads as streets so the transition to the real
          tiles isn't a hard cut) */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#101E2C_0%,#0A1520_100%)]" />
        <div className="absolute inset-x-0 top-[16%] h-px bg-white/[0.05]" />
        <div className="absolute inset-x-0 top-[40%] h-px bg-white/[0.05]" />
        <div className="absolute inset-x-0 top-[66%] h-px bg-white/[0.05]" />
        <div className="absolute inset-x-0 top-[86%] h-px bg-white/[0.05]" />
        <div className="absolute inset-y-0 left-[20%] w-px bg-white/[0.05]" />
        <div className="absolute inset-y-0 left-[50%] w-px bg-white/[0.05]" />
        <div className="absolute inset-y-0 left-[78%] w-px bg-white/[0.05]" />
        <div className="absolute left-[16%] top-[20%] h-32 w-px rotate-45 bg-white/[0.06] origin-top" />
        <div className="absolute left-[60%] top-[6%] h-44 w-px -rotate-12 bg-white/[0.06] origin-top" />
        <div className="absolute left-[40%] top-[46%] h-36 w-px rotate-[28deg] bg-white/[0.06] origin-top" />
      </div>

      {/* Atmospheric overlay — matches the live map's vignette + teal
          top-glow so loading → loaded is seamless */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, rgba(6,12,24,0.30) 78%, rgba(4,8,18,0.62) 100%), ' +
            'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(58,188,168,0.10) 0%, transparent 55%)',
        }}
      />

      {/* Centre: radar sweep + the same teal presence halo the live map
          renders for the player, so the loading marker IS the player
          marker materialising */}
      <div className="absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-44 w-44 flex items-center justify-center">
          <div
            className="wcsk-sweep absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(58,188,168,0.22) 0deg, rgba(58,188,168,0.02) 60deg, transparent 110deg, transparent 360deg)',
              animation: 'wcsk-sweep 2.6s linear infinite',
            }}
          />
          <div className="absolute inset-0 rounded-full border border-[#3ABCA8]/15" />
          <div className="absolute inset-[26%] rounded-full border border-[#3ABCA8]/12" />
          <div
            className="wcsk-ring absolute rounded-full border-2 border-[#3ABCA8]/40"
            style={{ width: 132, height: 132, animation: 'wcsk-ring 2.6s ease-out infinite' }}
          />
          <div
            className="wcsk-ring absolute rounded-full border-2 border-[#3ABCA8]/40"
            style={{ width: 132, height: 132, animation: 'wcsk-ring 2.6s ease-out infinite', animationDelay: '1.1s' }}
          />
          <div
            className="wcsk-core relative rounded-full"
            style={{
              width: 18, height: 18,
              background: 'radial-gradient(circle,#3ABCA8 0%,rgba(58,188,168,0.35) 70%,transparent 72%)',
              boxShadow: '0 0 16px 4px rgba(58,188,168,0.55)',
              animation: 'wcsk-core 2.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Top-left: objective + egg widget placeholders (live map anchors) */}
      <div className="absolute left-2 top-2 flex flex-col gap-1.5">
        <div className="wcsk-shim h-[52px] w-[210px] rounded-xl border border-[#3ABCA8]/20" />
        <div className="wcsk-shim h-[30px] w-[150px] rounded-lg border border-white/8" style={{ animationDelay: '0.2s' }} />
      </div>

      {/* Top-right: step counter card placeholder */}
      <div className="absolute right-2 top-2">
        <div className="wcsk-shim h-[52px] w-[124px] rounded-xl border border-white/10" style={{ animationDelay: '0.35s' }} />
      </div>

      {/* Bottom: encounter/objective action card placeholder */}
      <div className="absolute inset-x-4 bottom-4 rounded-[28px] border border-[#3ABCA8]/30 bg-[#0D1E2E]/90 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3">
          <div className="wcsk-shim h-14 w-14 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="wcsk-shim h-4 w-40 rounded" style={{ animationDelay: '0.15s' }} />
            <div className="wcsk-shim h-3 w-28 rounded" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <div className="wcsk-shim h-14 flex-1 rounded-2xl" style={{ animationDelay: '0.1s' }} />
          <div className="wcsk-shim h-14 w-24 rounded-2xl" style={{ animationDelay: '0.25s' }} />
        </div>
      </div>
    </div>
  )
}

export function GameScreenLoading({ label = 'Caricamento...' }: GameScreenLoadingProps) {
  return (
    <div className="flex h-full items-center justify-center" style={{ background: '#060C18' }}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#3A9DBC] border-t-transparent animate-spin" />
        <p className="text-sm text-white/50">{label}</p>
      </div>
    </div>
  )
}

export function GameSectionSkeleton() {
  return (
    <div className="min-h-full px-4 pt-4 pb-24 space-y-4" style={{ background: '#060C18' }}>
      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            <div className="h-2.5 w-40 rounded bg-white/5 animate-pulse" />
          </div>
          <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 flex-1 rounded-full bg-white/8 animate-pulse" />
        ))}
      </div>

      <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-4 space-y-3">
        <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
        <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
      </div>

      <GameListSkeleton rows={4} />
    </div>
  )
}

export function GameBattleSkeleton({
  background = '#060C18',
  accent = 'rgba(58,157,188,0.2)',
}: GameBattleSkeletonProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden px-4 pt-4 pb-5" style={{ background }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
      </div>

      <div className="flex-1 space-y-5">
        <div className="ml-auto w-[82%] rounded-[22px] border border-white/8 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 rounded-2xl bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
              <div className="h-2.5 w-full rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
          <div className="h-2.5 w-12 rounded bg-white/10 animate-pulse" />
          <div className="h-2 w-16 rounded bg-white/5 animate-pulse" />
        </div>

        <div className="w-[82%] rounded-[22px] border border-white/8 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 rounded-2xl bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
              <div className="h-2.5 w-full rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-3">
        <div className="h-10 rounded-2xl bg-white/[0.04] px-3 py-2">
          <div className="h-2.5 w-40 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-white/[0.06] animate-pulse" />
          <div className="h-14 flex-1 rounded-2xl animate-pulse" style={{ background: accent }} />
          <div className="h-14 w-20 shrink-0 rounded-2xl bg-white/[0.06] animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function GameListSkeleton({
  rows = 4,
  className = 'space-y-2',
  itemClassName = 'h-20',
}: GameListSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`rounded-2xl border border-white/8 bg-white/5 ${itemClassName}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex h-full items-center gap-3 px-3">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
              <div className="h-2.5 w-4/5 rounded bg-white/5 animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-white/5 animate-pulse" />
            </div>
            <div className="h-10 w-16 shrink-0 rounded-xl bg-white/10 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GameGridSkeleton({
  items = 9,
  className = 'grid grid-cols-3 gap-2 pb-24',
}: GameGridSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/8 bg-white/5 p-2"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-14 w-14 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-white/10 animate-pulse" />
            <div className="h-2 w-8 rounded bg-white/5 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GameProfileSkeleton() {
  return (
    <div className="px-4 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/10 animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
            <div className="h-2.5 w-40 rounded bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-black/25 px-1.5 py-2.5">
              <div className="mx-auto h-4 w-10 rounded bg-white/10 animate-pulse" />
              <div className="mx-auto mt-2 h-2.5 w-14 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-2.5 w-28 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-4 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
