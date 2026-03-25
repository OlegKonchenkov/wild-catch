'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BackpackPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('player_inventory')
        .select('*, items(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .gt('quantity', 0)
        .then(({ data }) => { if (data) setInventory(data) })
    })
  }, [supabase])

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-white mb-4">Zaino</h1>
      {inventory.length === 0 ? (
        <p className="text-center text-white/30 py-8">Zaino vuoto</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {inventory.map(inv => (
            <div key={inv.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="font-bold text-white text-sm">{inv.items?.name}</p>
              <p className="text-xs text-white/50">{inv.items?.description}</p>
              <p className="text-[#F7C841] font-bold mt-1">×{inv.quantity}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
