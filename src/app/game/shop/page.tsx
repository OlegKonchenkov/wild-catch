'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { track } from '@/lib/analytics'
import { swr } from '@/lib/cache'
import type { Item, ItemType } from '@/lib/types'
import MissionRewardModal from '@/components/game/MissionRewardModal'
import type { CompletedMissionInfo } from '@/components/game/MissionRewardModal'
import { GameListSkeleton } from '@/components/game/GameLoading'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'
import { isTutorialSession } from '@/lib/game/tutorial'

const TYPE_META: Record<ItemType, { icon: string; label: string; hint: string; color: string }> = {
  rete:      { icon: '🎯', label: 'Rete',       hint: 'Aumenta la probabilità di cattura',       color: '#3A9DBC' },
  esca:      { icon: '🍖', label: 'Esca',        hint: 'Attira creature rare nelle vicinanze',    color: '#34D399' },
  uovo:      { icon: '🥚', label: 'Uovo',        hint: 'Incuba una nuova creatura casuale',       color: '#C084FC' },
  battaglia: { icon: '⚔️', label: 'Battaglia',  hint: 'Potenzia ATK in duello',                  color: '#FBBF24' },
  pozione:   { icon: '🧪', label: 'Pozione',    hint: 'Neutralizza debolezza elementale',        color: '#F472B6' },
  cura:      { icon: '💊', label: 'Cura',        hint: 'Ripristina HP creatura in battaglia',     color: '#34D399' },
}

export default function ShopPage() {
  const [items, setItems]         = useState<Item[]>([])
  const [gold, setGold]           = useState(0)
  const [filter, setFilter]       = useState<ItemType | 'all'>('all')
  const [buying, setBuying]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [missionQueue, setMissionQueue] = useState<CompletedMissionInfo[]>([])
  const { toast, showSuccess, showApiError, dismiss } = useGameToast()
  const supabase = useMemo(() => createClient(), [])

  const loadShop = useCallback(async () => {
    const sessionId = localStorage.getItem('current_session_id')
    setLoading(true)
    try {
      // Items are read-only catalogue → SWR cache, paint cached instantly.
      // Items are scoped by session: global ones (session_id IS NULL) plus
      // anything specific to the current session. Tutorial-only items don't
      // leak into real-event shops, and event-specific catalogues stay
      // isolated. The cache key includes the sessionId so different
      // sessions get their own SWR entry.
      // Tutorial gets its own catalogue: ONLY tutorial-scoped items, no
      // globals. Real events get session-scoped + globals as before.
      const isTut = !!sessionId && isTutorialSession(sessionId)
      const cacheKey = `shop:items:${sessionId ?? 'no-session'}:${isTut ? 'tut-v3' : 'v2'}`
      const itemsSWR = swr<Item[]>(cacheKey, 10 * 60 * 1000, async () => {
        const base = supabase.from('items').select('*')
          .gt('shop_price', 0).order('type').order('shop_price')
        const { data } = await (
          isTut
            ? base.eq('session_id', sessionId!)
            : sessionId
              ? base.or(`session_id.eq.${sessionId},session_id.is.null`)
              : base.is('session_id', null)
        )
        return (data ?? []) as unknown as Item[]
      })
      if (itemsSWR.cached) setItems(itemsSWR.cached)

      const [items, user] = await Promise.all([
        itemsSWR.fresh,
        getCurrentUser(supabase),
      ])
      setItems(items)
      if (user && sessionId) {
        const { data: ps } = await supabase
          .from('player_sessions').select('gold')
          .eq('user_id', user.id).eq('session_id', sessionId).single()
        if (ps) setGold(ps.gold)
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadShop() }, [loadShop])

  async function buy(item: Item) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId || buying) return
    setBuying(item.id)
    try {
      const res = await fetch('/api/game/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, sessionId }),
      })
      const data = await res.json()
      if (res.ok) {
        setGold(data.remainingGold)
        track('shop_purchase', { sessionId, itemId: item.id, itemType: item.type, price: item.shop_price })
        showSuccess(`${TYPE_META[item.type].icon} ${item.name} acquistato!`)
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        window.dispatchEvent(new CustomEvent('wc:refresh-backpack'))
        if (data.completedMissions?.length) {
          setMissionQueue(prev => [...prev, ...data.completedMissions])
        }
      } else {
        showApiError(res.status, data.error ?? 'Errore acquisto')
      }
    } catch {
      showApiError(0, 'Errore di rete')
    } finally {
      setBuying(null)
    }
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
  const types = [...new Set(items.map(i => i.type))] as ItemType[]

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {missionQueue.length > 0 && (
        <MissionRewardModal
          missions={missionQueue}
          onDone={() => setMissionQueue([])}
        />
      )}
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-[#0A1520]/80">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-extrabold tracking-tight">🛒 Negozio</h1>
          <div className="flex items-center gap-1.5 bg-[#D4A96A]/10 border border-[#D4A96A]/30 rounded-full px-3 py-1">
            <span className="text-base">💰</span>
            <span className="text-[#D4A96A] font-extrabold text-sm">{gold.toLocaleString('it-IT')}</span>
            <span className="text-[#D4A96A]/50 text-xs">oro</span>
          </div>
        </div>

        {/* Type filter pills */}
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
      </div>

      {/* Toast */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <GameListSkeleton rows={5} itemClassName="h-[78px]" />
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/25 py-16 text-sm">Nessun oggetto disponibile</div>
        ) : (
          filtered.map(item => {
            const meta   = TYPE_META[item.type]
            const canBuy = gold >= item.shop_price && !buying
            const isBuying = buying === item.id
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 transition-all"
                style={{ borderColor: canBuy ? `${meta.color}33` : undefined }}
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
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-bold text-white text-sm truncate">{item.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
                      style={{ background: `${meta.color}20`, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-white/45 leading-relaxed line-clamp-2">{item.description}</p>
                  )}
                  {item.effect_value > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: meta.color }}>
                      {(item.type === 'rete' || item.type === 'esca') ? `×${item.effect_value}` : `+${item.effect_value}%`}{' '}{meta.hint}
                    </p>
                  )}
                </div>

                {/* Buy button */}
                <button
                  onClick={() => buy(item)}
                  disabled={!canBuy}
                  className="shrink-0 flex flex-col items-center justify-center w-16 h-12 rounded-xl font-bold text-xs transition-all disabled:opacity-35"
                  style={canBuy ? { background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {isBuying ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-sm">💰</span>
                      <span>{item.shop_price}</span>
                    </>
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
