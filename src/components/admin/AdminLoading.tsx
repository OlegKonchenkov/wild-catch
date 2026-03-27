'use client'

interface AdminListSkeletonProps {
  rows?: number
  itemClassName?: string
  className?: string
}

export function AdminListSkeleton({
  rows = 4,
  itemClassName = 'h-16',
  className = 'space-y-2',
}: AdminListSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className={`rounded-xl border border-white/10 bg-white/5 animate-pulse ${itemClassName}`}
        />
      ))}
    </div>
  )
}

interface AdminTableSkeletonProps {
  rows?: number
  columns?: number
}

export function AdminTableSkeleton({ rows = 4, columns = 5 }: AdminTableSkeletonProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="h-3 w-40 rounded bg-white/10 animate-pulse" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, colIdx) => (
              <div key={colIdx} className="h-9 rounded bg-white/10 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminInlineSpinner({ label = 'Caricamento...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-white/50 text-sm">
      <span className="inline-block w-4 h-4 rounded-full border-2 border-white/25 border-t-[#3A9DBC] animate-spin" />
      <span>{label}</span>
    </div>
  )
}
