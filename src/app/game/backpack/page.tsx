'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import type { ItemType } from '@/lib/types'
import { STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import { GameListSkeleton } from '@/components/game/GameLoading'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import { AbilityGlyph, abilityAccent, buildAbilityChips } from '@/components/game/ability-visuals'
import PackOpenModal, { type PackDrop, type OpenedPack } from '@/components/game/PackOpenModal'
import ChestOpenModal, { type ChestDrop, type OpenedChest } from '@/components/game/ChestOpenModal'
import type { Ability } from '@/lib/game/abilities'
import ElementIcon from '@/components/ui/ElementIcon'
import { RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
import { type IconType } from 'react-icons'
import { GiSpellBook } from 'react-icons/gi'
import {
  GiKnapsack, GiTwoCoins, GiFishingNet, GiFishingLure, GiEggClutch, GiSwordsPower,
  GiStandingPotion, GiHealthPotion, GiBroadsword, GiBreastplate, GiHelmet, GiRing,
  GiSparkles, GiPawPrint, GiCardboardBox, GiLockedChest, GiKeyring,
} from 'react-icons/gi'

const USABLE_FROM_BACKPACK: ItemType[] = ['esca', 'uovo']

const TYPE_META: Record<ItemType, { Icon: IconType; label: string; hint: string; color: string }> = {
  rete:      { Icon: GiFishingNet,    label: 'Rete',      hint: 'Aumenta la probabilità di cattura',    color: '#3A9DBC' },
  esca:      { Icon: GiFishingLure,   label: 'Esca',       hint: 'Attira creature rare nelle vicinanze', color: '#34D399' },
  uovo:      { Icon: GiEggClutch,     label: 'Uovo',       hint: 'Incuba una nuova creatura casuale',    color: '#C084FC' },
  battaglia: { Icon: GiSwordsPower,   label: 'Battaglia', hint: 'Potenzia ATK in duello',               color: '#FBBF24' },
  pozione:   { Icon: GiStandingPotion, label: 'Pozione',   hint: 'Neutralizza debolezza elementale',     color: '#F472B6' },
  cura:      { Icon: GiHealthPotion,  label: 'Cura',       hint: 'Ripristina HP creatura in battaglia',  color: '#34D399' },
  arma:      { Icon: GiBroadsword,    label: 'Arma',       hint: 'Equipaggia dalla DaimonDex (+ATK)',     color: '#FB7185' },
  corazza:   { Icon: GiBreastplate,   label: 'Corazza',   hint: 'Equipaggia dalla DaimonDex (+HP/DEF)',  color: '#60A5FA' },
  elmo:      { Icon: GiHelmet,        label: 'Elmo',       hint: 'Equipaggia dalla DaimonDex (+HP/DEF)',  color: '#FBBF24' },
  accessorio:{ Icon: GiRing,          label: 'Accessorio', hint: 'Equipaggia dalla DaimonDex (bonus misti)', color: '#C084FC' },
  chiave:    { Icon: GiKeyring,        label: 'Chiave',     hint: 'Apre i forzieri del tesoro',            color: '#F59E0B' },
}

// Canonical creature rarity palette + labels (shared with bestiary/combat).
const RARITY_COLOR: Record<string, string> = {
  comune:      '#7AB87A',
  non_comune:  '#4A9FD4',
  raro:        '#E8A820',
  epico:       '#7B4DB8',
  leggendario: '#C8352A',
  mitologico:  '#FF4D6D',
}

const RARITY_LABEL: Record<string, string> = {
  comune:      'Terrestre',
  non_comune:  'Arcaico',
  raro:        'Eroico',
  epico:       'Mostruoso',
  leggendario: 'Leggendario',
  mitologico:  'Mitologico',
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

interface AbilityTokenRow {
  ability_id: string
  quantity: number
  abilities: Ability | null
}

interface PackRow {
  id: string
  quantity: number
  pack_id: string
  pack: {
    id: string
    name: string
    description: string
    rarity: string | null
    image_url: string
    min_drops: number
    max_drops: number
  } | null
}

interface ChestRow {
  id: string
  quantity: number
  chest_id: string
  chest: {
    id: string
    name: string
    description: string
    rarity: string | null
    image_url: string
    key_requirements: { item_id: string; qty: number }[]
    contents: unknown[]
  } | null
}

interface PlayerEgg {
  id: string
  egg_rarity: string
  steps_required: number
  steps_at_pickup: number
  steps_progress: number
  can_hatch: boolean
  created_at: string
}

interface HatchResult {
  id: string
  name: string
  rarity: string
  element: string
  image_url: string | null
  sprite_cutout_url?: string | null
  sprite_url: string | null
  status_effect?: string | null
  status_effect_chance?: number | null
}

// ── Hatching animation overlay ──────────────────────────────────────────────
function HatchingAnimation({
  result,
  onDone,
}: {
  result: HatchResult | null
  onDone: () => void
}) {
  const [phase, setPhase] = useState<'shake' | 'crack' | 'reveal'>('shake')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('crack'), 900)
    const t2 = setTimeout(() => setPhase('reveal'), 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const rarityColor = result ? (RARITY_COLOR[result.rarity] ?? '#7AB87A') : '#7AB87A'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
         onClick={phase === 'reveal' ? onDone : undefined}>
      <AnimatePresence mode="wait">
        {phase === 'shake' && (
          <motion.div key="shake" className="relative flex items-center justify-center"
            animate={{ rotate: [-9, 9, -9, 9, -4, 4, 0] }}
            transition={{ duration: 0.85, repeat: 1, ease: 'easeInOut' }}>
            <div className="absolute rounded-full" style={{ width: 168, height: 168, background: `radial-gradient(circle, ${rarityColor}33 0%, transparent 70%)` }} />
            <GiEggClutch size={108} color={rarityColor} style={{ filter: `drop-shadow(0 0 18px ${rarityColor}aa)` }} />
          </motion.div>
        )}
        {phase === 'crack' && (
          <motion.div key="crack" className="relative flex items-center justify-center">
            {/* expanding light ring + flash */}
            <motion.div className="absolute rounded-full"
              style={{ border: `2px solid ${rarityColor}` }}
              initial={{ width: 70, height: 70, opacity: 0.85 }}
              animate={{ width: 280, height: 280, opacity: 0 }}
              transition={{ duration: 0.95, ease: 'easeOut' }} />
            <motion.div className="absolute rounded-full"
              style={{ background: `radial-gradient(circle, ${rarityColor}77 0%, transparent 70%)` }}
              initial={{ width: 50, height: 50, opacity: 0 }}
              animate={{ width: 230, height: 230, opacity: [0, 1, 0] }}
              transition={{ duration: 0.95 }} />
            <motion.div
              initial={{ scale: 1, rotate: 0, opacity: 1 }}
              animate={{ scale: [1, 1.22, 0.92, 1.4], rotate: [0, -12, 12, 0], opacity: [1, 1, 1, 0] }}
              transition={{ duration: 0.95, ease: 'easeOut' }}>
              <GiEggClutch size={108} color={rarityColor} style={{ filter: `drop-shadow(0 0 28px ${rarityColor})` }} />
            </motion.div>
          </motion.div>
        )}
        {phase === 'reveal' && result && (
          <motion.div key="reveal"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex flex-col items-center gap-4 px-8 w-full max-w-xs">
            <GiSparkles size={36} color={rarityColor} style={{ filter: `drop-shadow(0 0 10px ${rarityColor}aa)` }} />
            {(result.sprite_cutout_url || result.sprite_url || result.image_url) ? (
              <CreatureDiorama
                creature={result}
                size={138}
                anchor="center"
                rounded={20}
                className="w-40"
                style={{ aspectRatio: '5 / 4' }}
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl flex items-center justify-center"
                style={{ background: `${rarityColor}22` }}>
                <GiPawPrint size={56} color={rarityColor} />
              </div>
            )}
            <div className="text-center">
              <p className="text-white font-extrabold text-xl">{result.name}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: rarityColor }}>
                {RARITY_LABEL[result.rarity] ?? result.rarity}
              </p>
            </div>
            {result.status_effect && STATUS_EFFECT_META[result.status_effect as StatusEffect] && (() => {
              const meta = STATUS_EFFECT_META[result.status_effect as StatusEffect]
              const chancePercent = Math.round((result.status_effect_chance ?? 0.15) * 100)
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, type: 'spring', stiffness: 280, damping: 22 }}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 w-full"
                  style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}45`, boxShadow: `0 0 16px ${meta.glow}` }}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-xl"
                  >{meta.emoji}</motion.span>
                  <div className="flex-1">
                    <p className="text-[12px] font-extrabold" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="text-[10px] text-white/40">~{chancePercent}% per attacco</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                    Abilità
                  </span>
                </motion.div>
              )
            })()}
            <p className="text-white/40 text-xs mt-2">Tocca per continuare</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Egg card ─────────────────────────────────────────────────────────────────
function EggCard({
  egg,
  onHatch,
  hatching,
}: {
  egg: PlayerEgg
  onHatch: (id: string) => void
  hatching: string | null
}) {
  const color = RARITY_COLOR[egg.egg_rarity] ?? '#7AB87A'
  const label = RARITY_LABEL[egg.egg_rarity] ?? egg.egg_rarity
  const pct   = egg.steps_required > 0
    ? Math.min(100, Math.round((egg.steps_progress / egg.steps_required) * 100))
    : 100

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center gap-3 rounded-2xl p-3 border transition-all"
      style={{ background: `${color}0a`, borderColor: `${color}28` }}
    >
      {/* Animated egg icon */}
      <motion.div
        animate={egg.can_hatch ? { scale: [1, 1.08, 1], rotate: [-4, 4, -4, 4, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}33` }}
      >
        <GiEggClutch size={26} color={color} style={{ filter: `drop-shadow(0 0 5px ${color}66)` }} />
      </motion.div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="font-bold text-white text-sm">Uovo</p>
          <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
            style={{ background: `${color}20`, color }}>
            {label}
          </span>
        </div>

        {egg.steps_required > 0 ? (
          <>
            <div className="w-full h-1.5 rounded-full bg-white/10 mt-1 mb-0.5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs" style={{ color: egg.can_hatch ? color : 'rgba(255,255,255,0.35)' }}>
              {egg.can_hatch
                ? 'Pronto a schiudersi!'
                : `${egg.steps_progress} / ${egg.steps_required} passi`}
            </p>
          </>
        ) : (
          <p className="text-xs" style={{ color }}>Schiusura immediata</p>
        )}
      </div>

      {/* Hatch button */}
      <div className="shrink-0">
        <button
          onClick={() => onHatch(egg.id)}
          disabled={!egg.can_hatch || hatching === egg.id}
          className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-30"
          style={egg.can_hatch ? { background: `${color}28`, color, border: `1px solid ${color}55` } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {hatching === egg.id ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : <span className="inline-flex items-center gap-1"><GiEggClutch size={13} /> Schiudi</span>}
        </button>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BackpackPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [abilityTokens, setAbilityTokens] = useState<AbilityTokenRow[]>([])
  const [eggs, setEggs]           = useState<PlayerEgg[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<ItemType | 'all'>('all')
  const [usingId, setUsingId]     = useState<string | null>(null)
  const [hatchingId, setHatchingId] = useState<string | null>(null)
  const [hatchResult, setHatchResult] = useState<HatchResult | null>(null)
  const [packs, setPacks] = useState<PackRow[]>([])
  const [openingPackId, setOpeningPackId] = useState<string | null>(null)
  const [packResult, setPackResult] = useState<{ pack: OpenedPack; drops: PackDrop[] } | null>(null)
  const [chests, setChests] = useState<ChestRow[]>([])
  const [chestKeys, setChestKeys] = useState<Record<string, number>>({})
  const [openingChestId, setOpeningChestId] = useState<string | null>(null)
  const [chestResult, setChestResult] = useState<{ chest: OpenedChest; contents: ChestDrop[] } | null>(null)
  const { toast, showSuccess, showApiError, showError, dismiss } = useGameToast()
  const supabase   = useMemo(() => createClient(), [])
  const userIdRef  = useRef<string | null>(null)
  const sessionRef = useRef<string | null>(null)

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

  const fetchEggs = useCallback(() => {
    const sid = sessionRef.current
    if (!sid) return
    fetch(`/api/game/eggs?sessionId=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.eggs) setEggs(d.eggs) })
  }, [])

  const fetchPacks = useCallback(() => {
    const sid = sessionRef.current
    if (!sid) return
    fetch(`/api/game/packs?sessionId=${sid}`)
      .then(r => r.json())
      .then(d => { if (d.packs) setPacks(d.packs as PackRow[]) })
      .catch(() => {})
  }, [])

  const fetchChests = useCallback(() => {
    const sid = sessionRef.current
    if (!sid) return
    fetch(`/api/game/chests?sessionId=${sid}`)
      .then(r => r.json())
      .then(d => {
        if (d.chests) setChests(d.chests as ChestRow[])
        if (d.keys) setChestKeys(Object.fromEntries((d.keys as { item_id: string; quantity: number }[]).map(k => [k.item_id, k.quantity])))
      })
      .catch(() => {})
  }, [])

  async function handleOpenChest(row: ChestRow) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId || openingChestId || !row.chest) return
    setOpeningChestId(row.chest_id)
    try {
      const res = await fetch('/api/game/chests/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chestId: row.chest_id, sessionId }),
      })
      const data = await res.json()
      if (data.success) {
        setChestResult({ chest: data.chest, contents: data.contents })
        setChests(prev => prev.map(c => c.chest_id === row.chest_id ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0))
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        window.dispatchEvent(new CustomEvent('wc:refresh-backpack'))
      } else if (data.missingKeys) {
        const names = (data.missing as { name: string; needed: number; have: number }[])
          .map(m => `${m.name} (${m.have}/${m.needed})`).join(', ')
        showError(`Ti mancano delle chiavi: ${names}`)
      } else {
        showApiError(res.status, data.error ?? 'Apertura fallita')
      }
    } catch {
      showError('Errore di rete')
    }
    setOpeningChestId(null)
  }

  async function handleOpenPack(row: PackRow) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId || openingPackId) return
    setOpeningPackId(row.pack_id)
    try {
      const res = await fetch('/api/game/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: row.pack_id, sessionId }),
      })
      const data = await res.json()
      if (data.success) {
        setPackResult({ pack: data.pack, drops: data.drops })
        // Optimistically decrement locally; realtime will reconcile.
        setPacks(prev => prev.map(p => p.pack_id === row.pack_id ? { ...p, quantity: p.quantity - 1 } : p).filter(p => p.quantity > 0))
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        window.dispatchEvent(new CustomEvent('wc:refresh-backpack'))
      } else {
        showApiError(res.status, data.error ?? 'Apertura fallita')
      }
    } catch {
      showError('Errore di rete')
    }
    setOpeningPackId(null)
  }

  function fetchAbilityTokens() {
    const uid = userIdRef.current
    const sid = sessionRef.current
    if (!uid || !sid) return
    supabase
      .from('player_abilities')
      .select('ability_id, quantity, abilities(*)')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .gt('quantity', 0)
      .then(({ data }) => { if (data) setAbilityTokens(data as unknown as AbilityTokenRow[]) })
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
        showSuccess(data.message ?? 'Oggetto usato!')
        setInventory(prev => prev.map(r =>
          r.id === row.id ? { ...r, quantity: r.quantity - 1 } : r
        ).filter(r => r.quantity > 0))
        if (data.incubating) {
          fetchEggs()
        }
        if (data.activatedUntil) {
          localStorage.setItem('esca_active_until', data.activatedUntil)
          window.dispatchEvent(new CustomEvent('wc:esca-activated', { detail: { until: data.activatedUntil } }))
        }
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      } else {
        showApiError(res.status, data.error ?? 'Errore nell\'uso dell\'oggetto')
      }
    } catch {
      showApiError(0, 'Errore di rete')
    }
    setUsingId(null)
  }

  async function handleHatch(eggId: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    setHatchingId(eggId)
    try {
      const res = await fetch(`/api/game/eggs/${eggId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (data.hatched) {
        setEggs(prev => prev.filter(e => e.id !== eggId))
        setHatchResult(data.creature)
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      } else {
        showApiError(res.status, data.error ?? 'Schiusura fallita')
      }
    } catch {
      showError('Errore di rete')
    }
    setHatchingId(null)
  }

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }
    sessionRef.current = sessionId

    getCurrentUser(supabase).then(user => {
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

      fetchEggs()
      fetchAbilityTokens()
      fetchPacks()
      fetchChests()

      // Realtime: re-fetch whenever inventory changes (shop, QR rewards, item use)
      const channel = supabase
        .channel(`backpack-inv-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_inventory',
          filter: `user_id=eq.${user.id}`,
        }, () => { fetchInventory(); fetchChests() })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_eggs',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchEggs())
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_abilities',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchAbilityTokens())
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_packs',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchPacks())
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_chests',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchChests())
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })

    window.addEventListener('wc:refresh-backpack', fetchInventory)
    return () => window.removeEventListener('wc:refresh-backpack', fetchInventory)
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const types = [...new Set(inventory.map(r => r.items?.type).filter(Boolean))] as ItemType[]
  const filtered = filter === 'all' ? inventory : inventory.filter(r => r.items?.type === filter)
  const totalItems = inventory.reduce((s, r) => s + r.quantity, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #122c3e 0%, #0a1a26 45%, #060f17 100%)' }}>
      {/* Hatching overlay */}
      <AnimatePresence>
        {hatchResult && (
          <HatchingAnimation
            result={hatchResult}
            onDone={() => setHatchResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Pack opening overlay */}
      <AnimatePresence>
        {packResult && (
          <PackOpenModal
            pack={packResult.pack}
            drops={packResult.drops}
            onDone={() => setPackResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Chest opening overlay */}
      <AnimatePresence>
        {chestResult && (
          <ChestOpenModal
            chest={chestResult.chest}
            contents={chestResult.contents}
            onDone={() => setChestResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <GameToast toast={toast} onDismiss={dismiss} />
        </div>
      </div>

      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(247,200,65,0.4), transparent)' }} />
        <div className="flex items-center justify-between mb-3">
          <h1 className="flex items-center gap-2">
            <GiKnapsack size={22} color="#F0843C" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
            <span className="wc-display wc-gold-text" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>Zaino</span>
          </h1>
          {totalItems > 0 && (
            <span className="text-xs rounded-full px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--wc-line)', color: 'var(--wc-ink-dim)' }}>
              {totalItems} oggetti
            </span>
          )}
        </div>

        {/* Type filter pills */}
        {types.length > 0 && (
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
                  <TIcon size={14} color={on ? '#fff' : m.color} /> {m.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <GameListSkeleton rows={4} />
        ) : (
          <>
            {/* ── Bustine section ──────────────────────────────── */}
            {packs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <GiCardboardBox size={13} color="#F59E0B" /> Bustine ({packs.reduce((s, p) => s + p.quantity, 0)})
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {packs.map(row => {
                    if (!row.pack) return null
                    const accent = row.pack.rarity && row.pack.rarity in RARITY_COLORS
                      ? RARITY_COLORS[row.pack.rarity as keyof typeof RARITY_COLORS] : '#F59E0B'
                    const busy = openingPackId === row.pack_id
                    return (
                      <motion.button
                        key={row.id}
                        onClick={() => handleOpenPack(row)}
                        disabled={busy}
                        layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        whileTap={{ scale: 0.96 }}
                        className="relative rounded-2xl p-3 text-left overflow-hidden disabled:opacity-60"
                        style={{ background: `linear-gradient(160deg, ${accent}1c, rgba(255,255,255,0.02))`, border: `1px solid ${accent}44` }}
                      >
                        {row.quantity > 1 && (
                          <span className="absolute top-2 right-2 text-[11px] font-extrabold rounded-full px-1.5 py-0.5"
                            style={{ background: accent, color: '#05070E' }}>×{row.quantity}</span>
                        )}
                        <div className="w-full aspect-[3/4] rounded-xl mb-2 flex items-center justify-center overflow-hidden"
                          style={{ background: `radial-gradient(circle at 40% 30%, ${accent}33, transparent 70%)`, border: `1px solid ${accent}22` }}>
                          {row.pack.image_url
                            ? <img src={row.pack.image_url} alt={row.pack.name} className="w-full h-full object-cover" />
                            : <GiCardboardBox size={46} color={accent} style={{ filter: `drop-shadow(0 0 8px ${accent}77)` }} />}
                        </div>
                        <p className="text-white font-bold text-sm leading-tight line-clamp-1">{row.pack.name}</p>
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color: accent }}>
                          {busy ? 'Apertura…' : 'Tocca per aprire'}
                        </p>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Forzieri section ─────────────────────────────── */}
            {chests.length > 0 && (
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <GiLockedChest size={13} color="#D97706" /> Forzieri ({chests.reduce((s, c) => s + c.quantity, 0)})
                </p>
                <div className="space-y-2">
                  {chests.map(row => {
                    if (!row.chest) return null
                    const accent = row.chest.rarity && row.chest.rarity in RARITY_COLORS
                      ? RARITY_COLORS[row.chest.rarity as keyof typeof RARITY_COLORS] : '#D97706'
                    const reqs = row.chest.key_requirements ?? []
                    const canOpen = reqs.every(r => (chestKeys[r.item_id] ?? 0) >= (r.qty ?? 1))
                    const busy = openingChestId === row.chest_id
                    return (
                      <motion.div key={row.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-2xl p-3 border relative overflow-hidden"
                        style={{ background: `${accent}0e`, borderColor: `${accent}33` }}>
                        <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: accent }} />
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                          style={{ background: `${accent}18`, border: `1px solid ${accent}22` }}>
                          {row.chest.image_url
                            ? <img src={row.chest.image_url} alt={row.chest.name} className="w-full h-full object-cover" />
                            : <GiLockedChest size={30} color={accent} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm truncate">{row.chest.name}</p>
                            {row.quantity > 1 && <span className="text-[11px] text-white/40 font-semibold">×{row.quantity}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <GiKeyring size={12} color="#F59E0B" />
                            {reqs.length === 0
                              ? <span className="text-[11px] text-white/40">Nessuna chiave</span>
                              : reqs.map((r, i) => {
                                  const have = chestKeys[r.item_id] ?? 0
                                  const ok = have >= (r.qty ?? 1)
                                  return (
                                    <span key={i} className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                                      style={{ background: ok ? '#16653420' : '#7f1d1d20', color: ok ? '#4ADE80' : '#F87171' }}>
                                      {have}/{r.qty ?? 1}
                                    </span>
                                  )
                                })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenChest(row)}
                          disabled={!canOpen || busy}
                          className="shrink-0 text-xs font-extrabold px-3.5 py-2 rounded-xl disabled:opacity-40"
                          style={{ background: canOpen ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : 'rgba(255,255,255,0.06)', color: canOpen ? '#05070E' : 'rgba(255,255,255,0.5)' }}>
                          {busy ? '…' : canOpen ? 'Apri' : 'Bloccato'}
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Eggs section ─────────────────────────────────── */}
            {eggs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                  Uova ({eggs.length})
                </p>
                <div className="space-y-2">
                  <AnimatePresence>
                    {eggs.map(egg => (
                      <EggCard
                        key={egg.id}
                        egg={egg}
                        onHatch={handleHatch}
                        hatching={hatchingId}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ── Abilità section (learn them from the DaimonDex) ── */}
            {filter === 'all' && abilityTokens.length > 0 && (
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <GiSpellBook size={13} color="#C084FC" /> Abilità ({abilityTokens.reduce((s, t) => s + t.quantity, 0)})
                </p>
                <div className="space-y-2">
                  {abilityTokens.map(t => {
                    const a = t.abilities
                    if (!a) return null
                    const accent = abilityAccent(a)
                    const chips = buildAbilityChips(a).slice(0, 3)
                    return (
                      <motion.div key={t.ability_id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-2xl p-3 border relative overflow-hidden"
                        style={{ background: `${accent}0a`, borderColor: `${accent}30` }}>
                        <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: accent }} />
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${accent}18`, border: `1px solid ${accent}22` }}>
                          <AbilityGlyph ability={a} size={26} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <p className="font-bold text-white text-sm truncate">{a.name}</p>
                            {a.element && <ElementIcon element={a.element} size={12} />}
                            {a.rarity && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
                                style={{ background: `${RARITY_COLORS[a.rarity]}20`, color: RARITY_COLORS[a.rarity] }}>
                                {RARITY_LABELS[a.rarity]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/45 leading-relaxed line-clamp-2">{a.description}</p>
                          {chips.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {chips.map(c => (
                                <span key={c.key} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none"
                                  style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30` }}>{c.label}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <div className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg font-extrabold text-sm"
                            style={{ background: `${accent}22`, color: accent }}>×{t.quantity}</div>
                          <span className="text-[9px] text-white/30 text-right leading-tight">Impara<br/>dalla DaimonDex</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Items section ─────────────────────────────────── */}
            {(eggs.length > 0 || abilityTokens.length > 0) && inventory.length > 0 && (
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                Oggetti
              </p>
            )}

            {filtered.length === 0 && eggs.length === 0 && abilityTokens.length === 0 ? (
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
            ) : filtered.length === 0 && filter !== 'all' ? (
              <div className="text-center py-8">
                <p className="text-white/30 text-sm">Nessun oggetto di tipo {TYPE_META[filter]?.label}</p>
                <button onClick={() => setFilter('all')} className="text-xs text-[#3A9DBC] hover:text-white transition-colors mt-2">
                  Mostra tutti
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(row => {
                  const item = row.items
                  if (!item) return null
                  const meta = TYPE_META[item.type] ?? { Icon: GiKnapsack, label: item.type, hint: '', color: '#9CA3AF' }
                  const ItemIcon = meta.Icon
                  const usable = USABLE_FROM_BACKPACK.includes(item.type as ItemType)
                  const isUsing = usingId === row.id

                  return (
                    <motion.div
                      key={row.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-stretch rounded-2xl border overflow-hidden"
                      style={{ background: `${meta.color}0a`, borderColor: `${meta.color}28` }}
                    >
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}22` }}
                        >
                          <ItemIcon size={26} color={meta.color} style={{ filter: `drop-shadow(0 1px 2px ${meta.color}55)` }} />
                        </div>
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
                              {(item.type === 'rete' || item.type === 'esca') ? `×${item.effect_value}` : `+${item.effect_value}%`}{' '}{meta.hint}
                            </p>
                          )}
                          {(['arma', 'corazza', 'elmo', 'accessorio'] as ItemType[]).includes(item.type as ItemType) && (
                            <p className="inline-flex items-center gap-1 text-xs mt-0.5" style={{ color: meta.color }}>
                              <GiBreastplate size={12} color={meta.color} /> Equipaggia dalla DaimonDex
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side */}
                      {usable ? (
                        /* ── Full-height use button ── */
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => handleUse(row)}
                          disabled={isUsing}
                          className="shrink-0 flex flex-col items-center justify-center gap-0.5 px-5 min-w-[72px] relative overflow-hidden disabled:opacity-60"
                          style={{ background: `${meta.color}28`, borderLeft: `1px solid ${meta.color}35` }}
                        >
                          {/* Pulse glow behind button */}
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            animate={{ opacity: [0, 0.18, 0] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: meta.color }}
                          />
                          {isUsing ? (
                            <div
                              className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                              style={{ borderColor: meta.color, borderTopColor: 'transparent' }}
                            />
                          ) : (
                            <>
                              <span className="text-base leading-none relative z-10">✨</span>
                              <span className="font-extrabold text-sm relative z-10" style={{ color: meta.color }}>Usa</span>
                              <span className="text-[10px] font-semibold relative z-10" style={{ color: `${meta.color}99` }}>×{row.quantity}</span>
                            </>
                          )}
                        </motion.button>
                      ) : (
                        /* ── Quantity + price (non-usable) ── */
                        <div className="shrink-0 flex flex-col items-end justify-center gap-1 px-3">
                          <div
                            className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg font-extrabold text-sm"
                            style={{ background: `${meta.color}22`, color: meta.color }}
                          >
                            ×{row.quantity}
                          </div>
                          {item.shop_price > 0 && (
                            <p className="inline-flex items-center gap-0.5 text-xs text-white/25">
                              <GiTwoCoins size={11} color="#F7C841" /> {item.shop_price}
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
