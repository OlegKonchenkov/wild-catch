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
    <div className="relative h-full overflow-hidden" style={{ background: '#060C18' }}>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(58,157,188,0.12),transparent_35%),radial-gradient(circle_at_75%_20%,rgba(52,211,153,0.08),transparent_28%),linear-gradient(180deg,#101922_0%,#060C18_100%)]" />
          <div className="absolute inset-x-0 top-[14%] h-px bg-white/6" />
          <div className="absolute inset-x-0 top-[34%] h-px bg-white/6" />
          <div className="absolute inset-x-0 top-[58%] h-px bg-white/6" />
          <div className="absolute inset-x-0 top-[78%] h-px bg-white/6" />
          <div className="absolute inset-y-0 left-[22%] w-px bg-white/6" />
          <div className="absolute inset-y-0 left-[48%] w-px bg-white/6" />
          <div className="absolute inset-y-0 left-[74%] w-px bg-white/6" />
          <div className="absolute left-[18%] top-[22%] h-24 w-px rotate-45 bg-white/8 origin-top" />
          <div className="absolute left-[58%] top-[8%] h-40 w-px -rotate-12 bg-white/8 origin-top" />
          <div className="absolute left-[42%] top-[44%] h-32 w-px rotate-[28deg] bg-white/8 origin-top" />
        </div>

        <div className="absolute right-4 top-4 flex flex-col gap-3">
          <div className="rounded-2xl border border-white/8 bg-[#0D1E2E]/90 px-4 py-3 w-32 animate-pulse">
            <div className="h-3 w-14 rounded bg-white/10 mb-2" />
            <div className="h-2.5 w-20 rounded bg-white/6" />
          </div>
          <div className="h-10 w-28 rounded-full border border-[#34D399]/20 bg-[#34D399]/10 animate-pulse" />
          <div className="h-10 w-32 rounded-full border border-[#34D399]/20 bg-[#34D399]/10 animate-pulse" />
        </div>

        <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#3A9DBC]/10 animate-ping" />
            <div className="absolute inset-[10px] rounded-full border border-[#3A9DBC]/25 bg-[#0D1E2E] animate-pulse" />
            <div className="absolute inset-[22px] rounded-full bg-[#3A9DBC]/40 animate-pulse" />
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4 rounded-[28px] border border-[#3A9DBC]/40 bg-[#0D1E2E]/96 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-white/8 animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-28 rounded bg-[#3A9DBC]/20 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="h-14 flex-1 rounded-2xl bg-[#E85D2F]/80 animate-pulse" />
            <div className="h-14 w-24 rounded-2xl bg-white/10 animate-pulse" />
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
