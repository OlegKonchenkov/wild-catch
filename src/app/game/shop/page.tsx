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
import { haptics } from '@/lib/haptics'
import { playCoin } from '@/lib/game/sounds/ui'
import CountUp from '@/components/game/CountUp'
import { motion } from 'framer-motion'
import { type IconType } from 'react-icons'
import {
  GiSwapBag, GiTwoCoins, GiFishingNet, GiFishingLure, GiEggClutch, GiSwordsPower,
  GiStandingPotion, GiHealthPotion, GiBroadsword, GiBreastplate, GiHelmet, GiRing, GiKeyring,
} from 'react-icons/gi'

const TYPE_META: Record<ItemType, { icon: string; Icon: IconType; label: string; hint: string; color: string }> = {
  rete:      { icon: '🎯', Icon: GiFishingNet,    label: 'Rete',       hint: 'Aumenta la probabilità di cattura',    color: '#3A9DBC' },
  esca:      { icon: '🍖', Icon: GiFishingLure,   label: 'Esca',        hint: 'Attira creature rare nelle vicinanze', color: '#34D399' },
  uovo:      { icon: '🥚', Icon: GiEggClutch,     label: 'Uovo',        hint: 'Incuba una nuova creatura casuale',    color: '#C084FC' },
  battaglia: { icon: '⚔️', Icon: GiSwordsPower,   label: 'Battaglia',  hint: 'Potenzia ATK in duello',               color: '#FBBF24' },
  pozione:   { icon: '🧪', Icon: GiStandingPotion, label: 'Pozione',    hint: 'Neutralizza debolezza elementale',     color: '#F472B6' },
  cura:      { icon: '💊', Icon: GiHealthPotion,  label: 'Cura',        hint: 'Ripristina HP creatura in battaglia',  color: '#34D399' },
  arma:      { icon: '🗡️', Icon: GiBroadsword,    label: 'Arma',        hint: 'Equipaggiamento (+ATK)',               color: '#FB7185' },
  corazza:   { icon: '🛡️', Icon: GiBreastplate,   label: 'Corazza',    hint: 'Equipaggiamento (+HP/DEF)',            color: '#60A5FA' },
  elmo:      { icon: '⛑️', Icon: GiHelmet,        label: 'Elmo',        hint: 'Equipaggiamento (+HP/DEF)',            color: '#FBBF24' },
  accessorio:{ icon: '💍', Icon: GiRing,          label: 'Accessorio',  hint: 'Equipaggiamento (bonus misti)',        color: '#C084FC' },
  chiave:    { icon: '🗝️', Icon: GiKeyring,       label: 'Chiave',      hint: 'Apre i forzieri del tesoro',           color: '#F59E0B' },
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
        // Aural + tactile confirmation of a successful purchase — the
        // transaction used to be silent. The "ka-ching" + tap haptic
        // make the spending tangible.
        playCoin()
        haptics.tap()
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
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #122c3e 0%, #0a1a26 45%, #060f17 100%)' }}>
      {missionQueue.length > 0 && (
        <MissionRewardModal
          missions={missionQueue}
          onDone={() => setMissionQueue([])}
        />
      )}
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(247,200,65,0.4), transparent)' }} />
        <div className="flex items-center justify-between mb-3">
          <h1 className="flex items-center gap-2">
            <GiSwapBag size={22} color="#F3C233" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
            <span className="wc-display wc-gold-text" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>Negozio</span>
          </h1>
          <div className="flex items-center gap-1.5 rounded-full" style={{ padding: '4px 11px', background: 'rgba(247,200,65,0.1)', border: '1px solid rgba(247,200,65,0.28)' }}>
            <GiTwoCoins size={16} color="#F3C233" />
            <CountUp
              value={gold}
              durationMs={550}
              formatter={n => n.toLocaleString('it-IT')}
              className="wc-display font-bold text-sm tabular-nums"
              style={{ color: '#FFE08A' }}
            />
            <span className="text-xs" style={{ color: 'rgba(247,200,65,0.5)' }}>oro</span>
          </div>
        </div>

        {/* Type filter pills — scrollbar hidden, right edge fades to hint scroll */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
          style={{ WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)', maskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)' }}
        >
          <button
            onClick={() => setFilter('all')}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
            style={filter === 'all'
              ? { background: 'linear-gradient(180deg, #56C8E0, #2a7d98)', color: '#fff', boxShadow: '0 0 10px rgba(70,186,216,0.4)' }
              : { background: 'rgba(255,255,255,0.05)', color: 'var(--wc-ink-dim)' }}
          >
            Tutti
          </button>
          {types.map(t => {
            const m = TYPE_META[t]
            const TIcon = m.Icon
            const on = filter === t
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={on
                  ? { background: `linear-gradient(180deg, ${m.color}, ${m.color}bb)`, color: '#fff', boxShadow: `0 0 10px ${m.color}55` }
                  : { background: 'rgba(255,255,255,0.05)', color: 'var(--wc-ink-dim)' }}
              >
                <TIcon size={14} color={on ? '#fff' : m.color} />
                {m.label}
              </button>
            )
          })}
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
          filtered.map((item, i) => {
            const meta   = TYPE_META[item.type]
            const canBuy = gold >= item.shop_price && !buying
            const isBuying = buying === item.id
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut', delay: Math.min(i * 0.035, 0.32) }}
                className="wc-panel flex items-center gap-3 p-3"
                style={{ borderRadius: 18 }}
              >
                {/* Icon gem tile */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(180deg, ${meta.color}38, ${meta.color}10)`, border: `1px solid ${meta.color}3a`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)' }}
                >
                  <meta.Icon size={27} color={meta.color} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-bold text-white text-sm truncate">{item.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 uppercase tracking-wide"
                      style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}3a` }}>
                      {meta.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-white/45 leading-relaxed line-clamp-2">{item.description}</p>
                  )}
                  {item.effect_value > 0 && (
                    <p className="text-xs mt-0.5 font-semibold" style={{ color: meta.color }}>
                      {(item.type === 'rete' || item.type === 'esca') ? `×${item.effect_value}` : `+${item.effect_value}%`}{' '}{meta.hint}
                    </p>
                  )}
                </div>

                {/* Buy button — gilded when affordable */}
                <button
                  onClick={() => buy(item)}
                  disabled={!canBuy}
                  className="shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-40"
                  style={{ width: 60, height: 46, ...(canBuy
                    ? { background: 'linear-gradient(180deg, #FFE07A, #E8A11E)', color: '#3a2a05', border: '1px solid rgba(247,200,65,0.6)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 10px -3px rgba(247,200,65,0.5)' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }) }}
                >
                  {isBuying ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <GiTwoCoins size={15} color={canBuy ? '#6e4e0c' : 'rgba(255,255,255,0.3)'} />
                      <span className="wc-display" style={{ fontSize: 13, lineHeight: 1 }}>{item.shop_price}</span>
                    </>
                  )}
                </button>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
