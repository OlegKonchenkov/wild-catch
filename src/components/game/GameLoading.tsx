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
