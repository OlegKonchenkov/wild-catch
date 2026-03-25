'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/lib/types'

export default function ShopPage() {
  const [items, setItems] = useState<Item[]>([])
  const [gold, setGold] = useState(0)
  const [message, setMessage] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.from('items').select('*').order('shop_price').then(({ data }) => {
      if (data) setItems(data as unknown as Item[])
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('player_sessions').select('gold').eq('user_id', user.id).eq('session_id', sessionId).single()
        .then(({ data }) => { if (data) setGold(data.gold) })
    })
  }, [supabase])

  async function buy(item: Item) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    const res = await fetch('/api/game/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, sessionId }),
    })
    const data = await res.json()

    if (res.ok) {
      setGold(data.remainingGold)
      setMessage(`Acquistato: ${data.itemName}!`)
    } else {
      setMessage(data.error)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const ITEM_TYPE_LABEL: Record<string, string> = {
    rete: '🎯 Rete', esca: '🍖 Esca', uovo: '🥚 Uovo', battaglia: '⚔️ Battaglia'
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Shop</h1>
        <span className="text-[#D4A96A] font-bold">💰 {gold} Oro</span>
      </div>

      {message && (
        <p className="text-[#F7C841] text-sm text-center mb-3 bg-[#F7C841]/10 rounded-lg p-2">{message}</p>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="text-2xl">{ITEM_TYPE_LABEL[item.type]?.split(' ')[0]}</div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{item.name}</p>
              <p className="text-xs text-white/50">{item.description}</p>
            </div>
            <button
              onClick={() => buy(item)}
              disabled={gold < item.shop_price}
              className="bg-[#D4A96A] text-[#0F1F2E] font-bold px-3 py-2 rounded-lg text-sm disabled:opacity-40"
            >
              💰 {item.shop_price}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
