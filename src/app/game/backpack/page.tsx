'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ItemType } from '@/lib/types'

const USABLE_FROM_BACKPACK: ItemType[] = ['esca', 'uovo']

const TYPE_META: Record<ItemType, { icon: string; label: string; hint: string; color: string }> = {
  rete:      { icon: '🎯', label: 'Rete',      hint: 'Aumenta la probabilità di cattura',    color: '#3A9DBC' },
  esca:      { icon: '🍖', label: 'Esca',       hint: 'Attira creature rare nelle vicinanze', color: '#34D399' },
  uovo:      { icon: '🥚', label: 'Uovo',       hint: 'Incuba una nuova creatura casuale',    color: '#C084FC' },
  battaglia: { icon: '⚔️', label: 'Battaglia', hint: 'Potenzia ATK in duello',               color: '#FBBF24' },
  pozione:   { icon: '🧪', label: 'Pozione',   hint: 'Neutralizza debolezza elementale',     color: '#F472B6' },
  cura:      { icon: '💊', label: 'Cura',       hint: 'Ripristina HP creatura in battaglia',  color: '#34D399' },
}

interface InventoryRow {
  id: string
  quantity: number
  items: {
    id: string
    name: string
    type: ItemType
    description: string
    effect_value: number
    shop_price: number
  }
}

export default function BackpackPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<ItemType | 'all'>('all')
  const [usingId, setUsingId]     = useState<string | null>(null)
  const [toast, setToast]         = useState<string | null>(null)
  const supabase   = useMemo(() => createClient(), [])
  const userIdRef  = useRef<string | null>(null)
  const sessionRef = useRef<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function fetchInventory() {
    const uid = userIdRef.current
    const sid = sessionRef.current
    if (!uid || !sid) return
    supabase
      .from('player_inventory')
      .select('id, quantity, items(id, name, type, description, effect_value, shop_price)')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .gt('quantity', 0)
      .order('quantity', { ascending: false })
      .then(({ data }) => { if (data) setInventory(data as unknown as InventoryRow[]) })
  }

  async function handleUse(row: InventoryRow) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    setUsingId(row.id)
    try {
      const res = await fetch('/api/game/item/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: row.id, sessionId }),
      })
      const data = await res.json()
      if (data.used) {
        showToast(data.message ?? 'Oggetto usato!')
        setInventory(prev => prev.map(r =>
          r.id === row.id ? { ...r, quantity: r.quantity - 1 } : r
        ).filter(r => r.quantity > 0))
        if (data.activatedUntil) {
          localStorage.setItem('esca_active_until', data.activatedUntil)
        }
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      } else {
        showToast(data.error ?? 'Errore nell\'uso dell\'oggetto')
      }
    } catch {
      showToast('Errore di rete')
    }
    setUsingId(null)
  }

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }
    sessionRef.current = sessionId

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      userIdRef.current = user.id

      supabase
        .from('player_inventory')
        .select('id, quantity, items(id, name, type, description, effect_value, shop_price)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .gt('quantity', 0)
        .order('quantity', { ascending: false })
        .then(({ data }) => {
          if (data) setInventory(data as unknown as InventoryRow[])
          setLoading(false)
        })

      // Realtime: re-fetch whenever inventory changes (shop, QR rewards, item use)
      const channel = supabase
        .channel(`backpack-inv-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_inventory',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchInventory())
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })

    // Also respond to explicit refresh events
    window.addEventListener('wc:refresh-backpack', fetchInventory)
    return () => window.removeEventListener('wc:refresh-backpack', fetchInventory)
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const types = [...new Set(inventory.map(r => r.items?.type).filter(Boolean))] as ItemType[]
  const filtered = filter === 'all' ? inventory : inventory.filter(r => r.items?.type === filter)

  const totalItems = inventory.reduce((s, r) => s + r.quantity, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-[#0F1F2E] border border-[#3A9DBC]/40 text-white text-sm px-4 py-3 rounded-xl shadow-xl text-center animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-[#0A1520]/80">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-extrabold tracking-tight">🎒 Zaino</h1>
          {totalItems > 0 && (
            <span className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
              {totalItems} oggetti
            </span>
          )}
        </div>

        {/* Type filter pills */}
        {types.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button
              onClick={() => setFilter('all')}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                filter === 'all' ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50 hover:text-white'
              }`}
            >
              Tutti
            </button>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                  filter === t ? 'text-white' : 'bg-white/5 text-white/50 hover:text-white'
                }`}
                style={filter === t ? { backgroundColor: TYPE_META[t].color } : undefined}
              >
                {TYPE_META[t].icon} {TYPE_META[t].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="bg-white/5 rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🎒</span>
            <p className="text-white/30 text-sm">
              {filter === 'all' ? 'Lo zaino è vuoto' : `Nessun oggetto di tipo ${TYPE_META[filter]?.label}`}
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-xs text-[#3A9DBC] hover:text-white transition-colors">
                Mostra tutti
              </button>
            )}
          </div>
        ) : (
          filtered.map(row => {
            const item = row.items
            if (!item) return null
            const meta = TYPE_META[item.type] ?? { icon: '📦', label: item.type, hint: '', color: '#9CA3AF' }
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-2xl p-3 border transition-all"
                style={{ background: `${meta.color}0a`, borderColor: `${meta.color}28` }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: `${meta.color}18` }}
                >
                  {meta.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <p className="font-bold text-white text-sm">{item.name}</p>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
                      style={{ background: `${meta.color}20`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-white/45 leading-relaxed">{item.description}</p>
                  )}
                  {item.effect_value > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: meta.color }}>
                      +{item.effect_value}% {meta.hint}
                    </p>
                  )}
                </div>

                {/* Quantity + optional Use button */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <div
                    className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg font-extrabold text-sm"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                  >
                    ×{row.quantity}
                  </div>
                  {USABLE_FROM_BACKPACK.includes(item.type as ItemType) && (
                    <button
                      onClick={() => handleUse(row)}
                      disabled={usingId === row.id}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                      style={{ background: `${meta.color}25`, color: meta.color }}
                    >
                      {usingId === row.id ? '...' : 'Usa'}
                    </button>
                  )}
                  {item.shop_price > 0 && (
                    <p className="text-xs text-white/25">💰{item.shop_price}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
