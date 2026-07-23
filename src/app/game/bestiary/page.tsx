'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/client-user'
import { swr } from '@/lib/cache'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import Image from 'next/image'
import { RARITY_COLORS, RARITY_LABELS, RARITY_CATCH_RATES, ALL_ELEMENTS } from '@/lib/types'
import type { Creature, PlayerCreature, Element } from '@/lib/types'
import { strongAgainst, weakAgainst } from '@/lib/game/elements'
import { useBackDismiss } from '@/hooks/useBackDismiss'
import FirstTimeHint from '@/components/game/FirstTimeHint'
import { STATUS_EFFECT_META } from '@/lib/game/combat'
import type { StatusEffect } from '@/lib/game/combat'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { resolveCreatureSprite, ELEMENT_BACKGROUND } from '@/lib/game/battle-scene'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import { GameGridSkeleton } from '@/components/game/GameLoading'
import EquipmentManager from '@/components/game/EquipmentManager'
import AbilityManager from '@/components/game/AbilityManager'
import EnigmaFragmentPanel from '@/components/game/EnigmaFragmentPanel'
import { GiSpellBook, GiOpenBook, GiBreastplate, GiPuzzle } from 'react-icons/gi'
import ElementIcon from '@/components/ui/ElementIcon'

const RARITY_ORDER = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']
const MYSTERY_HINTS: Record<string, string> = {
  fiamma:    'Percepisci calore nelle vicinanze...',
  adriatico: 'Senti il profumo del mare...',
  bosco:     'Un fruscio tra le foglie...',
  terra:     'Il terreno vibra leggermente...',
  armonia:   'Un\'aura di pace nell\'aria...',
}

export default function BestiaryPage() {
  const [creatures, setCreatures]           = useState<Creature[]>([])
  const [playerCreatures, setPlayerCreatures] = useState<PlayerCreature[]>([])
  const [selected, setSelected]             = useState<{ creature: Creature; pc: PlayerCreature | null } | null>(null)
  const [message, setMessage]               = useState('')
  const [filter, setFilter]                 = useState<'all' | 'caught' | 'missing'>('all')
  const [rarityFilter, setRarityFilter]     = useState<string>('all')
  const [elementFilter, setElementFilter]   = useState<string>('all')
  const [search, setSearch]                 = useState('')
  const [showFilters, setShowFilters]       = useState(false)
  const [showWeakness, setShowWeakness]     = useState(false)
  const [showStatusInfo, setShowStatusInfo] = useState(false)
  const [detailTab, setDetailTab]           = useState<'panoramica' | 'abilita' | 'equip' | 'enigma'>('panoramica')
  const [equipReloadKey, setEquipReloadKey] = useState(0)
  const [equipCounts, setEquipCounts]       = useState<Record<string, number>>({})
  const [loading, setLoading]               = useState(true)
  // Creature IDs that were caught for the first time but not yet revealed
  // in the bestiary. Drives a one-time sparkle animation on the matching
  // card the next time the page is opened. Cleared after rendering once.
  const [newlyCaughtIds, setNewlyCaughtIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem('wc:bestiary-new')
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        if (Array.isArray(ids) && ids.length > 0) {
          setNewlyCaughtIds(new Set(ids))
          // Clear immediately so a second visit doesn't replay the reveal.
          localStorage.removeItem('wc:bestiary-new')
        }
      }
    } catch { /* noop */ }
  }, [])
  const [selectedPcId, setSelectedPcId]     = useState<string | null>(null)
  const [playerLevel, setPlayerLevel]       = useState(1)
  // Set of creature IDs that have an evolved form
  const [evolvableIds, setEvolvableIds]     = useState<Set<string>>(new Set())
  const [squad, setSquad]                   = useState<string[]>([]) // array of player_creatures.id (up to 3)
  const [squadSaving, setSquadSaving]       = useState(false)
  // Reveal card after manual evolution
  const [forgingGoldId, setForgingGoldId] = useState<string | null>(null)
  const [evolveReveal, setEvolveReveal]     = useState<{ name: string; rarity: string; element: string; image_url: string | null; sprite_cutout_url: string | null; sprite_url: string | null; hp: number; atk: number; def: number; description: string | null; copiesRemaining: number } | null>(null)
  const [evolvePhase, setEvolvePhase]       = useState<'charge' | 'flash' | 'reveal'>('charge')
  const [evolveCardVisible, setEvolveCardVisible] = useState(false)
  const supabase   = useMemo(() => createClient(), [])
  const userIdRef  = useRef<string | null>(null)
  const sessionRef = useRef<string | null>(null)

  // Auto-dismiss the inline toast — previously it stayed on screen until the
  // next action overwrote it, so "creatura selezionata" / "forgiato in GOLD"
  // messages lingered indefinitely.
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3200)
    return () => clearTimeout(t)
  }, [message])

  // Native-app Back: the hardware / swipe Back closes the open detail sheet or
  // the weakness modal instead of navigating away from the DaimonDex.
  useBackDismiss(!!selected, () => setSelected(null))
  useBackDismiss(showWeakness, () => setShowWeakness(false))

  // Swipe-down-to-dismiss for the detail bottom sheet. Drag is started only
  // from the grab handle (dragListener=false) so the sheet's inner scroll is
  // never hijacked. A firm downward flick or drag past ~130px closes it.
  const detailDragControls = useDragControls()
  const onSheetDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.y > 130 || info.velocity.y > 700) setSelected(null)
  }

  function fetchPlayerCreatures() {
    const uid = userIdRef.current
    const sid = sessionRef.current
    if (!uid || !sid) return
    supabase
      .from('player_creatures')
      .select('*, creatures(*)')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .then(({ data }) => { if (data) setPlayerCreatures(data as unknown as PlayerCreature[]) })
  }

  function fetchSelectedCreature() {
    const uid = userIdRef.current
    const sid = sessionRef.current
    if (!uid || !sid) return
    supabase
      .from('player_sessions')
      .select('selected_creature_id, level, squad_ids')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .single()
      .then(({ data }) => {
        if (data?.selected_creature_id) setSelectedPcId(data.selected_creature_id)
        if (data?.level) setPlayerLevel(data.level as number)
        if ((data as any)?.squad_ids) setSquad((data as any).squad_ids as string[])
      })
  }

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }
    sessionRef.current = sessionId

    let done = 0
    function finish() { if (++done === 3) setLoading(false) }

    // Bestiary is read-heavy and the underlying data rarely changes mid-session.
    // SWR: paint cached creature catalogue instantly, then revalidate.
    const applyCreatures = (data: Creature[] | null | undefined) => {
      if (!data) return
      const list = [...data].sort(
        (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
      )
      setCreatures(list)
      const ids = new Set<string>(
        list
          .filter(c => (c as any).evolution_of)
          .map(c => (c as any).evolution_of as string)
      )
      setEvolvableIds(ids)
    }

    const creaturesSWR = swr<Creature[]>('creatures:v1', 10 * 60 * 1000, async () => {
      const { data } = await supabase
        .from('creatures')
        .select('*, enigma_frammento:enigma_frammenti(id, enigma_id, title, description, image_url, video_url, order_index, enigma:enigmi(id, title))')
        .order('rarity')
      return (data ?? []) as unknown as Creature[]
    })
    if (creaturesSWR.cached) applyCreatures(creaturesSWR.cached)
    creaturesSWR.fresh.then(applyCreatures).finally(finish)

    getCurrentUser(supabase).then(user => {
      if (!user) { finish(); finish(); return }
      userIdRef.current = user.id

      supabase
        .from('player_creatures')
        .select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .then(({ data }) => { if (data) setPlayerCreatures(data as unknown as PlayerCreature[]); finish() })

      supabase
        .from('player_sessions')
        .select('selected_creature_id, level, squad_ids')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
        .then(({ data }) => {
          if (data?.selected_creature_id) setSelectedPcId(data.selected_creature_id)
          if (data?.level) setPlayerLevel(data.level as number)
          if ((data as any)?.squad_ids) setSquad((data as any).squad_ids as string[])
          finish()
        })

      // Realtime: refresh creature list on any player_creatures change
      const channel = supabase
        .channel(`bestiary-pc-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_creatures',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchPlayerCreatures()
          fetchSelectedCreature()
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })

    // Also refresh on explicit event (e.g. from encounter page before realtime arrives)
    window.addEventListener('wc:refresh-bestiary', fetchPlayerCreatures)
    return () => window.removeEventListener('wc:refresh-bestiary', fetchPlayerCreatures)
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Equipped-piece counts per owned creature — drives the grid badge.
  useEffect(() => {
    const sid = sessionRef.current
    if (!sid || playerCreatures.length === 0) { setEquipCounts({}); return }
    let cancelled = false
    const ids = playerCreatures.map(p => p.id)
    supabase
      .from('creature_equipment')
      .select('player_creature_id')
      .in('player_creature_id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return
        const counts: Record<string, number> = {}
        for (const r of data as { player_creature_id: string }[]) {
          counts[r.player_creature_id] = (counts[r.player_creature_id] ?? 0) + 1
        }
        setEquipCounts(counts)
      })
    return () => { cancelled = true }
  }, [supabase, playerCreatures, equipReloadKey])

  function getPc(creatureId: string) {
    return playerCreatures.find(pc => pc.creature_id === creatureId) ?? null
  }

  async function handleSelect(pc: PlayerCreature) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    const res = await fetch('/api/game/creature/select', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId: pc.id, sessionId }),
    })
    if (res.ok) {
      const name = creatures.find(c => c.id === pc.creature_id)?.name ?? 'Creatura'
      setSelectedPcId(pc.id)
      setMessage(`${name} selezionata come creatura attiva!`)
    }
  }

  async function handleSquadSlot(slotIdx: number, pcId: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId || squadSaving) return
    setSquadSaving(true)

    const newSquad = [...squad]
    // Remove this creature from any existing slot
    const existingIdx = newSquad.indexOf(pcId)
    if (existingIdx !== -1) newSquad.splice(existingIdx, 1)

    if (slotIdx === -1) {
      // -1 = remove from squad entirely
    } else {
      // Insert at requested slot, pad with empty slots if needed
      while (newSquad.length < slotIdx) newSquad.push('')
      newSquad.splice(slotIdx, 0, pcId)
    }

    // Cap to 3, remove empty strings
    const filtered = newSquad.filter(Boolean).slice(0, 3)

    const res = await fetch('/api/game/squad', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, squadIds: filtered }),
    })
    if (res.ok) {
      setSquad(filtered)
      if (filtered.length > 0) setSelectedPcId(filtered[0])
    }
    setSquadSaving(false)
  }

  async function handleEvolve(pc: PlayerCreature) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    const res = await fetch('/api/game/creature/evolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCreatureId: pc.id, sessionId }),
    })
    const data = await res.json()
    if (res.ok) {
      // Refresh collection
      const user = await getCurrentUser(supabase)
      if (user) {
        const { data: refreshed } = await supabase
          .from('player_creatures').select('*, creatures(*)')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
        if (refreshed) setPlayerCreatures(refreshed as unknown as PlayerCreature[])
      }
      // Close detail panel and run animation → reveal card
      setSelected(null)
      const cr = data.newCreature
      setEvolvePhase('charge')
      setEvolveCardVisible(false)
      setEvolveReveal({
        name: cr.name, rarity: cr.rarity, element: cr.element,
        image_url: cr.image_url ?? null,
        sprite_cutout_url: cr.sprite_cutout_url ?? null, sprite_url: cr.sprite_url ?? null,
        hp: cr.hp, atk: cr.atk, def: cr.def, description: cr.description ?? null,
        copiesRemaining: data.copiesRemaining,
      })
      setTimeout(() => setEvolvePhase('flash'), 1400)
      setTimeout(() => { setEvolvePhase('reveal'); setTimeout(() => setEvolveCardVisible(true), 80) }, 1900)
    } else {
      setMessage(data.error)
    }
  }

  async function handleForgeGold(playerCreatureId: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId || forgingGoldId) return
    setForgingGoldId(playerCreatureId)
    try {
      const res = await fetch('/api/game/creature/forge-gold', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCreatureId, sessionId }),
      })
      const data = await res.json()
      if (res.ok) {
        // Aggiorna la collezione in place (copie e flag GOLD)
        setPlayerCreatures(prev => prev.map(p => p.id === playerCreatureId
          ? { ...p, duplicates_count: data.remainingCopies, is_gold: true }
          : p))
        window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        setMessage(`🥇 ${data.creatureName ?? 'Daimon'} forgiato in GOLD! +10% alle stats`)
      } else {
        setMessage(data.error ?? 'Forgiatura fallita')
      }
    } catch {
      setMessage('Errore di rete')
    } finally {
      setForgingGoldId(null)
    }
  }

  const RARITY_FILTER_LABELS: Record<string, string> = {
    comune: 'Terr.', non_comune: 'Arcaico', raro: 'Eroico', epico: 'Mostr.', leggendario: 'Legg.', mitologico: 'Mito',
  }

  const caughtCount = new Set(playerCreatures.map(pc => pc.creature_id)).size
  const activeFilterCount = (filter !== 'all' ? 1 : 0) + (rarityFilter !== 'all' ? 1 : 0) + (elementFilter !== 'all' ? 1 : 0)

  function resetFilters() {
    setFilter('all'); setRarityFilter('all'); setElementFilter('all'); setSearch('')
  }

  const filtered = creatures.filter(c => {
    if (filter === 'caught'  && !getPc(c.id)) return false
    if (filter === 'missing' &&  getPc(c.id)) return false
    if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
    if (elementFilter !== 'all' && c.element !== elementFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.element.toLowerCase().includes(q)) return false
    }
    return true
  })

  const ELEM_META: Record<string, { label: string; emoji: string }> = {
    fiamma:    { label: 'Fiamma',    emoji: '🔥' },
    adriatico: { label: 'Adriatico', emoji: '🌊' },
    bosco:     { label: 'Bosco',     emoji: '🌿' },
    terra:     { label: 'Terra',     emoji: '🪨' },
    armonia:   { label: 'Armonia',   emoji: '✨' },
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'radial-gradient(120% 65% at 50% 0%, #122c3e 0%, #0a1a26 45%, #060f17 100%)' }}>
      {/* Modale debolezze elementali */}
      <AnimatePresence>
        {showWeakness && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center backdrop-blur-sm"
            onClick={() => setShowWeakness(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[#0F1F2E] border-t border-white/10 rounded-t-3xl w-full max-w-lg pb-10"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_e, info) => { if (info.offset.y > 130 || info.velocity.y > 700) setShowWeakness(false) }}
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-2" style={{ cursor: 'grab' }}>
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <div className="px-5">
                <h2 className="text-lg font-bold text-white mb-1">Forze & Debolezze</h2>
                <p className="text-xs text-white/40 mb-4">+50% danno quando attacchi un tipo debole</p>
                <div className="space-y-2">
                  {ALL_ELEMENTS.map(el => {
                    // Forze/debolezze derivate dalle math di combattimento
                    // (strongAgainst/weakAgainst) invece di una tabella locale,
                    // così questo pannello non può mai divergere dal chart reale.
                    const strong = strongAgainst(el)
                    const weak = weakAgainst(el)
                    return (
                    <div key={el} className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <span className="w-8 flex justify-center"><ElementIcon element={el} size={20} /></span>
                      <div className="flex-1">
                        <p className="text-xs text-white/60 font-semibold">{ELEM_META[el].label}</p>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {strong.map(s => (
                            <span key={s} className="text-[10px] bg-[#34D399]/15 text-[#34D399] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                              ↑ <ElementIcon element={s} size={11} />
                            </span>
                          ))}
                          {weak.map(w => (
                            <span key={w} className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                              ↓ <ElementIcon element={w} size={11} />
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) })}
                </div>
                <p className="text-[10px] text-white/20 mt-3 text-center">
                  ✨ Armonia: forte su tutti, nessuna debolezza
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .silhouette { filter: brightness(0.15) saturate(0) blur(0.5px) contrast(0.8); }
        .silhouette-soft { filter: brightness(0.12) saturate(0) blur(2px) contrast(0.7); }
        @keyframes evolvePulse {
          from { opacity: 0.7; transform: scale(0.95); }
          to   { opacity: 1;   transform: scale(1.05); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .mystery-shimmer {
          background: linear-gradient(90deg, #0a1520 25%, #162030 50%, #0a1520 75%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        @keyframes wc-active-glow {
          0%, 100% {
            box-shadow: 0 0 0 2px #3ABCA8, 0 0 14px rgba(58,188,168,0.55), 0 0 32px rgba(58,188,168,0.20);
          }
          50% {
            box-shadow: 0 0 0 2px #5DDDCA, 0 0 22px rgba(58,188,168,0.85), 0 0 48px rgba(58,188,168,0.35);
          }
        }
        @keyframes wc-active-badge {
          0%, 100% { opacity: 1; transform: scaleX(1); }
          50% { opacity: 0.85; transform: scaleX(1.04); }
        }
        .wc-active-card {
          animation: wc-active-glow 1.8s ease-in-out infinite;
          border-color: #3ABCA8 !important;
          background: linear-gradient(to bottom, rgba(58,188,168,0.22), rgba(58,188,168,0.06)) !important;
        }
        .wc-active-badge {
          animation: wc-active-badge 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2.5" style={{ background: 'rgba(12,29,44,0.78)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(247,200,65,0.16)' }}>

        {/* Row 1: title + progress */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <GiSpellBook size={20} color="#B98BF0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
            <h1 className="wc-display wc-gold-text" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>DaimonDex</h1>
            <button
              onClick={() => setShowWeakness(true)}
              aria-label="Forze e debolezze"
              className="relative w-5 h-5 rounded-full bg-white/8 border border-white/10 text-white/35 text-[10px] font-bold flex items-center justify-center active:bg-white/15 before:absolute before:content-[''] before:-inset-2.5"
            >
              ?
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs">
              <span className="wc-display font-bold" style={{ color: '#5FD0E0', fontSize: 14 }}>{caughtCount}</span>
              <span className="text-white/30">/{creatures.length}</span>
            </p>
            {/* Mini progress bar */}
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.3)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #46BAD8, #34D399)', boxShadow: '0 0 8px rgba(70,186,216,0.6)' }}
                initial={{ width: 0 }}
                animate={{ width: `${creatures.length ? (caughtCount / creatures.length) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: search + filter toggle */}
        <div className="flex gap-2 items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none"
              fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nome o elemento…"
              className="w-full bg-white/6 border border-white/8 rounded-xl pl-8 pr-7 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#3A9DBC]/50 focus:bg-white/8 transition-all"
            />
            <AnimatePresence>
              {search && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Filter toggle button */}
          <motion.button
            onClick={() => setShowFilters(f => !f)}
            whileTap={{ scale: 0.93 }}
            className="relative flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
            style={{
              background: showFilters || activeFilterCount > 0 ? 'rgba(58,157,188,0.18)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showFilters || activeFilterCount > 0 ? 'rgba(58,157,188,0.45)' : 'rgba(255,255,255,0.09)'}`,
              color: showFilters || activeFilterCount > 0 ? '#3A9DBC' : 'rgba(255,255,255,0.45)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            <span>Filtri</span>
            <AnimatePresence>
              {activeFilterCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#3A9DBC] text-white text-[9px] font-black flex items-center justify-center"
                >
                  {activeFilterCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Collapsible filter panel */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                {/* Status tabs */}
                <div className="flex gap-1.5">
                  {([['all', 'Tutti'], ['caught', 'Catturati'], ['missing', 'Mancanti']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setFilter(v)}
                      className="flex-1 text-xs py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                      style={filter === v
                        ? { background: 'linear-gradient(180deg, #56C8E0, #2a7d98)', color: 'white', boxShadow: '0 0 10px rgba(70,186,216,0.4)' }
                        : { background: 'rgba(255,255,255,0.05)', color: 'var(--wc-ink-dim)' }}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Rarity chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                  {(['all', 'comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico'] as const).map(r => {
                    const active = rarityFilter === r
                    const color = r !== 'all' ? RARITY_COLORS[r] : null
                    return (
                      <button key={r} onClick={() => setRarityFilter(r)}
                        className="shrink-0 text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
                        style={{
                          background: active ? (color ? `${color}22` : 'rgba(255,255,255,0.13)') : 'rgba(255,255,255,0.04)',
                          color: active ? (color ?? 'white') : 'rgba(255,255,255,0.28)',
                          border: `1px solid ${active ? (color ? `${color}50` : 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        {r === 'all' ? '★ Rarità' : RARITY_FILTER_LABELS[r]}
                      </button>
                    )
                  })}
                </div>

                {/* Element chips */}
                <div className="flex gap-1.5">
                  {(['all', 'fiamma', 'adriatico', 'bosco', 'terra', 'armonia'] as const).map(el => {
                    const active = elementFilter === el
                    return (
                      <button key={el} onClick={() => setElementFilter(el)}
                        className="flex-1 flex items-center justify-center text-[10px] py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                        style={{
                          background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                          color: active ? 'white' : 'rgba(255,255,255,0.4)',
                          border: `1px solid ${active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                        {el === 'all' ? 'Elem.' : <ElementIcon element={el} size={15} />}
                      </button>
                    )
                  })}
                </div>

                {/* Reset link — only when filters active */}
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters}
                    className="w-full text-[10px] text-white/30 hover:text-white/60 text-center cursor-pointer py-0.5 transition-colors">
                    Reimposta filtri
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Squad bar — 3 slots */}
        <div className="pt-2.5 pb-0.5">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Squadra</span>
            {squad.length > 0 && (
              <span className="text-[9px] text-white/25">· tocca per dettagli</span>
            )}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(slotIdx => {
              const pcId = squad[slotIdx]
              const pc = pcId ? playerCreatures.find(p => p.id === pcId) : null
              const cr = pc ? creatures.find(c => c.id === pc.creature_id) : null
              const isLead = slotIdx === 0
              return (
                <div key={slotIdx} className="relative flex-1" style={{ height: 72 }}>
                  {/* Main tap target */}
                  <button
                    onClick={() => { if (pc && cr) { setSelected({ creature: cr, pc }); setShowStatusInfo(false); setDetailTab('panoramica') } }}
                    className="w-full h-full rounded-xl overflow-hidden transition-all relative"
                    style={{
                      background: pc
                        ? isLead ? 'rgba(58,188,168,0.12)' : 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.03)',
                      border: pc
                        ? isLead ? '1.5px solid rgba(58,188,168,0.5)' : '1.5px solid rgba(255,255,255,0.3)'
                        : '1px dashed rgba(255,255,255,0.08)',
                    }}
                  >
                    {pc && cr ? (
                      <>
                        {cr.sprite_cutout_url ? (
                          <>
                            <Image src={ELEMENT_BACKGROUND[cr.element]} alt="" fill sizes="120px" className="object-cover" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(4,6,10,0.7), rgba(4,6,10,0.12))' }} />
                            <Image src={resolveCreatureSprite(cr)} alt={cr.name} width={64} height={64} className="absolute inset-0 w-full h-full object-contain p-1" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.55))' }} />
                          </>
                        ) : cr.image_url ? (
                          <img src={cr.image_url} alt={cr.name} className="absolute inset-0 w-full h-full object-contain p-1" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center"><ElementIcon element={cr.element} size={26} /></span>
                        )}
                        {/* Bottom gradient + name */}
                        <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5 pt-3"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
                          <p className="text-[8px] font-bold truncate leading-none text-center"
                            style={{ color: isLead ? '#3ABCA8' : 'rgba(255,255,255,0.6)' }}>{cr.name}</p>
                        </div>
                        {/* Slot badge top-left */}
                        <span className="absolute top-1 left-1 text-[7px] font-black px-1 py-0.5 rounded"
                          style={{ background: isLead ? 'rgba(58,188,168,0.9)' : 'rgba(0,0,0,0.55)', color: isLead ? '#0A1520' : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
                          {isLead ? '⚔' : slotIdx + 1}
                        </span>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                        <span className="text-lg font-bold leading-none" style={{ color: 'rgba(255,255,255,0.1)' }}>+</span>
                        <span className="text-[8px] font-semibold" style={{ color: 'rgba(255,255,255,0.1)' }}>{isLead ? 'Cap.' : `· ${slotIdx + 1}`}</span>
                      </div>
                    )}
                  </button>

                  {/* ✕ remove — only when occupied */}
                  {pc && (
                    <button
                      onClick={e => { e.stopPropagation(); handleSquadSlot(-1, pc.id) }}
                      disabled={squadSaving}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black disabled:opacity-40 z-10"
                      style={{ background: 'rgba(239,68,68,0.9)', color: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                      aria-label="Rimuovi"
                    >✕</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {message && (
          <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="text-[#F7C841] text-sm text-center mb-4 bg-[#F7C841]/10 rounded-lg p-2">
            {message}
          </motion.p>
        )}

        {loading && (
          <GameGridSkeleton items={9} />
        )}

        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-3"
          >
            <svg className="w-10 h-10 text-white/15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p className="text-sm text-white/30 font-medium">Nessuna creatura trovata</p>
            <button
              onClick={resetFilters}
              className="text-xs text-[#3A9DBC]/70 hover:text-[#3A9DBC] transition-colors mt-1 cursor-pointer"
            >
              Reimposta filtri
            </button>
          </motion.div>
        )}

        {!loading && filtered.length > 0 && <div className="grid grid-cols-3 gap-2 pb-24">
          {filtered.map((creature, i) => {
            const pc = getPc(creature.id)
            const caught = !!pc
            const rarityColor = RARITY_COLORS[creature.rarity]

            const canEvolve = !!(pc && pc.duplicates_count >= 3 && evolvableIds.has(pc.creature_id))
            const isNewReveal = newlyCaughtIds.has(creature.id)

            return (
              <motion.div
                key={creature.id}
                initial={
                  isNewReveal
                    ? { opacity: 0, scale: 0.55, rotate: -8 }
                    : { opacity: 0, scale: 0.9 }
                }
                animate={
                  isNewReveal
                    ? { opacity: 1, scale: [0.55, 1.14, 1], rotate: [0, 0, 0] }
                    : { opacity: 1, scale: 1 }
                }
                transition={
                  isNewReveal
                    ? { delay: i * 0.02 + 0.15, duration: 0.7, times: [0, 0.6, 1], type: 'tween' }
                    : { delay: i * 0.02 }
                }
                whileTap={{ scale: 0.93 }}
                onClick={() => { setSelected({ creature, pc }); setShowStatusInfo(false); setDetailTab('panoramica') }}
                className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all
                  ${canEvolve
                    ? 'border-2 border-[#F7C841]'
                    : caught && pc && squad[0] === pc.id
                      ? 'wc-active-card border-2'
                      : caught && pc && squad.includes(pc.id)
                        ? 'wc-active-card border-2'
                        : caught
                          ? 'bg-gradient-to-b from-white/10 to-white/5 border border-white/15 hover:border-white/30'
                          : 'mystery-shimmer border border-white/5 hover:border-white/10'
                  }`}
                style={canEvolve ? {
                  boxShadow: '0 0 12px rgba(247,200,65,0.45), 0 0 4px rgba(247,200,65,0.3)',
                } : isNewReveal ? {
                  boxShadow: '0 0 24px rgba(58,188,168,0.55), 0 0 8px rgba(58,188,168,0.4)',
                } : undefined}
              >
                {/* "Nuovo!" badge — one-time reveal */}
                {isNewReveal && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.4, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.02 + 0.55, type: 'spring', stiffness: 350, damping: 18 }}
                    className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider"
                    style={{
                      background: 'linear-gradient(135deg, #3ABCA8, #34D399)',
                      color: '#0F1F2E',
                      boxShadow: '0 2px 6px rgba(58,188,168,0.55)',
                    }}
                  >
                    Nuovo!
                  </motion.div>
                )}
                {/* Rarity stripe */}
                <div className="h-[3px]" style={{ background: canEvolve ? '#F7C841' : caught ? rarityColor : 'rgba(255,255,255,0.04)' }} />

                {/* Image area */}
                <div className="relative aspect-square overflow-hidden flex items-center justify-center">
                  {/* Caught + cutout → mini diorama (element bg + transparent
                      cutout). Uncaught / legacy art → muted portrait + mystery. */}
                  {caught && creature.sprite_cutout_url ? (
                    <>
                      <Image src={ELEMENT_BACKGROUND[creature.element]} alt="" fill sizes="140px" className="object-cover" />
                      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(115% 92% at 50% 30%, transparent 40%, rgba(4,6,10,0.62) 100%)' }} />
                      <Image
                        src={resolveCreatureSprite(creature)}
                        alt={creature.name}
                        width={80} height={80}
                        className="relative w-full h-full object-contain p-1.5"
                        style={{ filter: 'drop-shadow(0 5px 7px rgba(0,0,0,0.55))' }}
                      />
                    </>
                  ) : creature.image_url ? (
                    <div className="relative w-full h-full flex items-center justify-center p-2">
                      <div className="absolute pointer-events-none" style={{ inset: '10%', borderRadius: '50%', background: caught ? `radial-gradient(circle at 50% 44%, ${rarityColor}33 0%, ${rarityColor}14 44%, transparent 70%)` : 'radial-gradient(circle at 50% 44%, rgba(255,255,255,0.05) 0%, transparent 68%)' }} />
                      <div className="absolute pointer-events-none" style={{ bottom: '11%', left: '50%', width: '52%', height: '8%', transform: 'translateX(-50%)', borderRadius: '50%', background: 'rgba(0,0,0,0.42)', filter: 'blur(4px)' }} />
                      <Image src={creature.image_url} alt={caught ? creature.name : '???'} width={80} height={80} className={`relative w-full h-full object-contain transition-all ${caught ? '' : 'silhouette'}`} />
                      {!caught && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0A1520]/40 rounded-lg">
                          <span className="text-white/30 text-lg font-black">?</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center justify-center ${caught ? '' : 'text-3xl opacity-10'}`}>
                      {caught ? <ElementIcon element={creature.element} size={30} /> : '?'}
                    </div>
                  )}

                  {/* Squad slot badge — top-left */}
                  {pc && squad.includes(pc.id) && (() => {
                    const slotIdx = squad.indexOf(pc.id)
                    const isLead = slotIdx === 0
                    return (
                      <div className="absolute top-1 left-1 text-[8px] font-black px-1 py-0.5 rounded-md leading-none"
                        style={{ background: isLead ? '#3ABCA8' : 'rgba(100,116,139,0.85)', color: isLead ? '#0A1520' : 'white' }}>
                        {isLead ? '⚔' : slotIdx + 1}
                      </div>
                    )
                  })()}

                  {/* Copy count — top-right */}
                  {pc && (
                    <div className="absolute top-1 right-1 text-[8px] font-bold px-1 py-0.5 rounded-md leading-none"
                      style={{ background: 'rgba(0,0,0,0.55)', color: pc.duplicates_count > 1 ? '#60CDDD' : 'rgba(255,255,255,0.45)' }}>
                      {(pc as { is_gold?: boolean }).is_gold ? '🥇 ' : ''}×{pc.duplicates_count}
                    </div>
                  )}
                  {/* Status effect indicator dot — bottom-left */}
                  {caught && (creature as any).status_effect && STATUS_EFFECT_META[(creature as any).status_effect as StatusEffect] && (() => {
                    const meta = STATUS_EFFECT_META[(creature as any).status_effect as StatusEffect]
                    return (
                      <div className="absolute bottom-1 left-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] leading-none"
                        style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}70`, boxShadow: `0 0 6px ${meta.glow}` }}
                        title={meta.label}>
                        {meta.emoji}
                      </div>
                    )
                  })()}
                  {/* Equipped gear badge — bottom-right */}
                  {pc && (equipCounts[pc.id] ?? 0) > 0 && (
                    <div className="absolute bottom-1 right-1 text-[8px] font-bold px-1 py-0.5 rounded-md leading-none flex items-center gap-0.5"
                      style={{ background: 'rgba(58,188,168,0.22)', color: '#3ABCA8', border: '1px solid rgba(58,188,168,0.5)' }}
                      title="Equipaggiamento">
                      ⚙️{equipCounts[pc.id]}
                    </div>
                  )}
                </div>

                {/* Name + element + rarity */}
                <div className={`px-1.5 pb-1.5 ${caught ? '' : 'opacity-40'}`}>
                  <div className="flex items-center gap-1">
                    <p className="text-[11px] font-bold truncate flex-1 leading-tight" style={{ color: caught ? 'white' : '#666' }}>
                      {caught ? creature.name : '???'}
                    </p>
                    {caught && <ElementIcon element={creature.element} size={12} className="shrink-0" />}
                  </div>
                  {caught && (
                    <p className="text-[8px] font-semibold mt-0.5 leading-none capitalize truncate" style={{ color: canEvolve ? '#F7C841' : rarityColor }}>
                      {canEvolve ? '✨ evolvi' : RARITY_LABELS[creature.rarity]}
                    </p>
                  )}
                </div>

              </motion.div>
            )
          })}
        </div>}
      </div>

      {/* Detail bottom sheet */}

      <AnimatePresence>
        {selected && (() => {
          const { creature, pc } = selected
          const caught = !!pc
          const rarityColor = RARITY_COLORS[creature.rarity]
          const hint = MYSTERY_HINTS[creature.element] ?? 'Qualcosa si muove nell\'ombra...'

          return (
            <motion.div
              key="sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-[#0F1F2E] border-t border-white/10 rounded-t-3xl z-50 overflow-y-auto"
              style={{ maxHeight: '88vh' }}
              drag="y"
              dragListener={false}
              dragControls={detailDragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onSheetDragEnd}
            >
              {/* Drag handle — grab here to swipe the sheet down and dismiss */}
              <div
                className="flex justify-center pt-3 pb-2 sticky top-0 bg-[#0F1F2E] z-10"
                style={{ touchAction: 'none', cursor: 'grab' }}
                onPointerDown={e => detailDragControls.start(e)}
              >
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <button onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-white/30 hover:text-white/70 text-xl w-8 h-8 flex items-center justify-center z-20">
                ✕
              </button>

              <div className="pb-8">

                {/* ── Hero block: atmospheric image + identity ── */}
                <div className="relative overflow-hidden"
                  style={{ background: caught ? `radial-gradient(ellipse at 50% 10%, ${rarityColor}28 0%, ${rarityColor}08 45%, transparent 70%), #0C1B29` : '#0C1B29' }}>
                  {/* Rarity gradient stripe */}
                  <div className="h-[3px]" style={{ background: caught ? `linear-gradient(90deg, transparent 0%, ${rarityColor}CC 40%, ${rarityColor}CC 60%, transparent 100%)` : 'rgba(255,255,255,0.04)' }} />

                  {/* Showcase rays — slow rotating light fan behind the
                      creature, intensity scaled by rarity (subtle for
                      comune, dramatic for leggendario/mitologico). Sits
                      under the sprite; decorative only. */}
                  {caught && !creature.sprite_cutout_url && (() => {
                    const RAY_ALPHA: Record<string, number> = {
                      comune: 0.05, non_comune: 0.08, raro: 0.13,
                      epico: 0.20, leggendario: 0.30, mitologico: 0.42,
                    }
                    const a = RAY_ALPHA[creature.rarity] ?? 0.1
                    return (
                      <motion.div
                        aria-hidden
                        className="absolute left-1/2 pointer-events-none"
                        style={{
                          top: 150, width: 460, height: 460,
                          marginLeft: -230, marginTop: -230,
                          background: `conic-gradient(from 0deg, ${rarityColor}00 0deg, ${rarityColor}${Math.round(a * 255).toString(16).padStart(2, '0')} 18deg, ${rarityColor}00 40deg, ${rarityColor}00 90deg, ${rarityColor}${Math.round(a * 255).toString(16).padStart(2, '0')} 108deg, ${rarityColor}00 130deg, ${rarityColor}00 180deg, ${rarityColor}${Math.round(a * 255).toString(16).padStart(2, '0')} 198deg, ${rarityColor}00 220deg, ${rarityColor}00 270deg, ${rarityColor}${Math.round(a * 255).toString(16).padStart(2, '0')} 288deg, ${rarityColor}00 310deg, ${rarityColor}00 360deg)`,
                          maskImage: 'radial-gradient(circle, #000 30%, transparent 68%)',
                          WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 68%)',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
                      />
                    )
                  })()}

                  {/* Creature image */}
                  <div className="relative flex justify-center pt-7 pb-5">
                    {caught ? (() => {
                      const sprite = resolveCreatureSprite(creature)
                      if (!creature.sprite_cutout_url) {
                        return (
                          <div
                            className={creature.image_url ? 'cursor-zoom-in' : undefined}
                            onClick={() => creature.image_url && window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: creature.image_url }))}
                            title={creature.image_url ? 'Tocca per ingrandire' : undefined}
                          >
                            <CreatureSprite imageUrl={sprite} name={creature.name} animState="idle" size={180} element={creature.element} rarity={creature.rarity} showAura />
                          </div>
                        )
                      }
                      const diff = Math.max(1, Math.min(5, (creature as any).catch_difficulty ?? 1))
                      const catchPct = Math.round((RARITY_CATCH_RATES[creature.rarity] ?? 0.5) * 100)
                      const inSquad = pc != null && squad.includes(pc.id)
                      const isCap = pc != null && squad[0] === pc.id
                      return (
                        <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '1 / 1', maxHeight: 360, border: `1px solid ${rarityColor}44`, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                          <Image src={ELEMENT_BACKGROUND[creature.element]} alt="" fill priority sizes="(max-width:480px) 92vw, 440px" className="object-cover" />
                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 90% at 50% 26%, transparent 38%, rgba(4,6,10,0.5) 100%)' }} />
                          <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '64%', background: 'linear-gradient(to top, rgba(5,8,14,0.9) 0%, rgba(5,8,14,0.46) 42%, transparent 78%)' }} />
                          {/* creature — larger, grounded above the info plate */}
                          <div
                            className={`absolute inset-x-0 top-0 flex items-end justify-center pb-1 ${sprite ? 'cursor-zoom-in' : ''}`}
                            style={{ bottom: 84 }}
                            onClick={() => sprite && window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: sprite }))}
                            title={sprite ? 'Tocca per ingrandire' : undefined}
                          >
                            <CreatureSprite imageUrl={sprite} name={creature.name} animState="idle" size={210} element={creature.element} rarity={creature.rarity} showAura />
                          </div>
                          {/* overlaid info plate */}
                          <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
                            <div className="flex items-center gap-2">
                              <h3 className="wc-display text-[24px] font-bold text-white leading-none tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.75)' }}>{creature.name}</h3>
                              {inSquad && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black" style={{ background: isCap ? 'rgba(58,188,168,0.92)' : 'rgba(255,255,255,0.18)', color: isCap ? '#06121a' : '#fff' }}>
                                  {isCap ? '⚔ CAP' : `· ${squad.indexOf(pc!.id) + 1}`}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(0,0,0,0.42)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                                <ElementIcon element={creature.element} size={13} /><span className="capitalize">{creature.element}</span>
                              </span>
                              <span className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{ background: `${rarityColor}2e`, color: '#fff', border: `1px solid ${rarityColor}`, backdropFilter: 'blur(4px)' }}>
                                {RARITY_LABELS[creature.rarity]}
                              </span>
                              {pc != null && pc.duplicates_count > 1 && (
                                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(0,0,0,0.42)', color: '#60CDDD', border: '1px solid rgba(96,205,221,0.4)', backdropFilter: 'blur(4px)' }}>×{pc.duplicates_count}</span>
                              )}
                              <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)' }} title="Difficoltà di cattura · catturabilità base">
                                <span className="text-[12px] tracking-[0.5px] leading-none" style={{ color: '#F4D27A' }}>
                                  {'★'.repeat(diff)}<span style={{ color: 'rgba(255,255,255,0.26)' }}>{'★'.repeat(5 - diff)}</span>
                                </span>
                                <span className="text-[10px] font-extrabold leading-none" style={{ color: '#7FE0A0' }}>{catchPct}%</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })() : (
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        {creature.image_url ? (
                          <>
                            <Image src={creature.image_url} alt="???"
                              fill className="object-contain silhouette-soft" sizes="160px" />
                            <span className="relative text-5xl font-black text-white/15 z-10">?</span>
                          </>
                        ) : (
                          <span className="text-6xl opacity-15">?</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Name + squad badge + pills — only when the hero diorama isn't carrying the info */}
                  {!(caught && creature.sprite_cutout_url) && (
                  <div className="px-5 pb-5">
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="wc-display text-[22px] font-bold text-white leading-tight flex-1 tracking-tight">
                        {caught ? creature.name : '? ? ?'}
                      </h3>
                      {caught && squad.includes(pc.id) && (
                        <div className="mt-0.5 shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black"
                          style={{
                            background: squad[0] === pc.id ? 'rgba(58,188,168,0.18)' : 'rgba(255,255,255,0.08)',
                            border: squad[0] === pc.id ? '1.5px solid rgba(58,188,168,0.55)' : '1px solid rgba(255,255,255,0.2)',
                            color: squad[0] === pc.id ? '#3ABCA8' : 'rgba(255,255,255,0.55)',
                          }}>
                          {squad[0] === pc.id ? '⚔ CAP' : `· ${squad.indexOf(pc.id) + 1}`}
                        </div>
                      )}
                    </div>

                    {caught ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Element */}
                        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <ElementIcon element={creature.element} size={13} />
                          <span className="capitalize">{creature.element}</span>
                        </span>
                        {/* Rarity */}
                        <span className="text-[11px] px-2.5 py-1 rounded-full font-bold capitalize"
                          style={{ background: `${rarityColor}1A`, color: rarityColor, border: `1px solid ${rarityColor}40` }}>
                          {RARITY_LABELS[creature.rarity]}
                        </span>
                        {/* Copies */}
                        {pc.duplicates_count > 1 && (
                          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: 'rgba(58,157,188,0.12)', color: '#60CDDD', border: '1px solid rgba(58,157,188,0.25)' }}>
                            ×{pc.duplicates_count} copie
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 italic">{hint}</p>
                    )}
                  </div>
                  )}
                </div>

                {/* ── Content ── */}
                <div className="px-5 pt-5 space-y-4">
                  {caught ? (
                    <>
                      {/* Tab bar */}
                      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {([
                          { id: 'panoramica' as const, label: 'Info',    Icon: GiOpenBook,    accent: '58,188,168',  fg: '#3ABCA8' },
                          { id: 'abilita'    as const, label: 'Abilità', Icon: GiSpellBook,   accent: '184,139,240', fg: '#C084FC' },
                          { id: 'equip'      as const, label: 'Equip',   Icon: GiBreastplate, accent: '58,188,168',  fg: '#3ABCA8' },
                          { id: 'enigma'     as const, label: 'Enigma',  Icon: GiPuzzle,      accent: '123,77,184',  fg: '#C084FC' },
                        ]).map(t => {
                          const active = detailTab === t.id
                          return (
                            <button key={t.id}
                              onClick={() => setDetailTab(t.id)}
                              className="flex-1 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                              style={active
                                ? { background: `rgba(${t.accent},0.18)`, color: t.fg, border: `1px solid rgba(${t.accent},0.4)` }
                                : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
                              <t.Icon size={15} />{t.label}
                            </button>
                          )
                        })}
                      </div>

                      {detailTab === 'abilita' && (
                        <AbilityManager
                          key={`ab:${pc.id}`}
                          sessionId={sessionRef.current}
                          playerCreatureId={pc.id}
                          element={creature.element}
                          rarity={creature.rarity}
                          playerLevel={playerLevel}
                        />
                      )}

                      {detailTab === 'equip' && (
                        <EquipmentManager
                          key={`${pc.id}:${equipReloadKey}`}
                          sessionId={sessionRef.current}
                          playerCreatureId={pc.id}
                          baseHp={creature.hp}
                          baseAtk={creature.atk}
                          baseDef={creature.def ?? 0}
                          playerLevel={playerLevel}
                          onChanged={() => setEquipReloadKey(k => k + 1)}
                        />
                      )}

                      {detailTab === 'enigma' && (
                        <EnigmaFragmentPanel
                          enigmaTitle={(creature.enigma_frammento as any)?.enigma?.title ?? null}
                          fragmentTitle={creature.enigma_frammento?.title ?? creature.enigma_title ?? null}
                          description={creature.enigma_frammento?.description ?? creature.enigma_description ?? null}
                          imageUrl={creature.enigma_frammento?.image_url ?? creature.enigma_image_url ?? null}
                          videoUrl={creature.enigma_frammento?.video_url ?? creature.enigma_video_url ?? null}
                        />
                      )}

                      {detailTab === 'panoramica' && (
                      <div className="space-y-4">
                      {/* Description */}
                      {creature.description && (
                        <p className="text-sm text-white/50 leading-relaxed italic -mt-1">{creature.description}</p>
                      )}

                      {/* Stats */}
                      {(() => {
                        const lv = Math.max(1, playerLevel)
                        const delta = lv - 1
                        const sHP  = Math.max(1, Math.round(creature.hp  * (1 + delta * 0.14)))
                        const sATK = Math.max(1, Math.round(creature.atk * (1 + delta * 0.10)))
                        const sDEF = Math.max(0, Math.round((creature.def ?? 0) * (1 + delta * 0.09)))
                        const stats = [
                          { label: 'HP',  base: creature.hp,       scaled: sHP,  color: '#F87171' },
                          { label: 'ATK', base: creature.atk,      scaled: sATK, color: '#FB923C' },
                          { label: 'DEF', base: creature.def ?? 0, scaled: sDEF, color: '#60A5FA' },
                        ]
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <p className="text-[11px] text-white/35 uppercase tracking-widest font-bold">Statistiche</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24' }}>
                                Lv. {lv}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {stats.map(s => (
                                <div key={s.label} className="relative rounded-2xl px-2 py-2.5 text-center overflow-hidden"
                                  style={{ background: `linear-gradient(160deg, ${s.color}1f, ${s.color}08)`, border: `1px solid ${s.color}33`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                                  <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: s.color, opacity: 0.7 }} />
                                  <p className="text-[22px] font-black leading-none" style={{ color: s.color, textShadow: `0 0 14px ${s.color}55` }}>{s.scaled}</p>
                                  <p className="text-[9px] font-bold text-white/55 mt-1 tracking-wider uppercase">{s.label}</p>
                                  {lv > 1 && s.scaled !== s.base && (
                                    <p className="text-[9px] text-white/35 mt-1 leading-none">base <span className="font-semibold text-white/55">{s.base}</span></p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── Abilità Speciale (status effect) ── */}
                      {(creature as any).status_effect && STATUS_EFFECT_META[(creature as any).status_effect as StatusEffect] && (() => {
                        const effect = (creature as any).status_effect as StatusEffect
                        const meta = STATUS_EFFECT_META[effect]
                        const chancePercent = Math.round(((creature as any).status_effect_chance ?? 0.15) * 100)
                        const EFFECT_DETAILS: Record<StatusEffect, { description: string; duration: string }> = {
                          paralisi:      { description: 'Per 2 turni ha il 35% di attaccare normalmente e il 65% di fallire il turno.', duration: '2 turni' },
                          confusione:    { description: 'Per 3 turni ha il 50% di attaccare normalmente e il 50% di colpirsi da solo.', duration: '3 turni' },
                          sonno:         { description: "Per 2 turni salta sempre l'attacco.", duration: '2 turni' },
                          veleno:        { description: "All'inizio del suo turno perde il 10% degli HP massimi finché resta in campo.", duration: 'Finché in campo' },
                          scottatura:    { description: "All'inizio del turno perde l'8% degli HP massimi e attacca più debolmente.", duration: '3 turni' },
                          congelamento:  { description: 'Resta congelato e salta il turno, con il 25% di scongelarsi ogni turno.', duration: '~2 turni' },
                          rigenerazione: { description: "All'inizio del turno recupera il 10% degli HP massimi.", duration: '3 turni' },
                          marchio:       { description: 'Marchiato: subisce il 25% di danni in più dagli attacchi.', duration: '3 turni' },
                        }
                        const detail = EFFECT_DETAILS[effect]
                        return (
                          <div>
                            <div
                              className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer select-none transition-all"
                              style={{
                                background: `${meta.color}0e`,
                                border: `1px solid ${meta.color}35`,
                                boxShadow: showStatusInfo ? `0 0 16px ${meta.glow}` : 'none',
                              }}
                              onClick={() => setShowStatusInfo(v => !v)}
                            >
                              <motion.span
                                className="text-xl shrink-0 leading-none"
                                animate={{ opacity: [1, 0.6, 1] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                              >
                                {meta.emoji}
                              </motion.span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-extrabold leading-tight" style={{ color: meta.color }}>{meta.label}</p>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                                    {chancePercent}%
                                  </span>
                                </div>
                                <p className="text-[10px] text-white/35 mt-0.5">Abilità speciale · tocca per dettagli</p>
                              </div>
                              <motion.span
                                className="text-white/30 text-xs font-bold shrink-0"
                                animate={{ rotate: showStatusInfo ? 180 : 0 }}
                                transition={{ duration: 0.22 }}
                              >▼</motion.span>
                            </div>
                            <AnimatePresence initial={false}>
                              {showStatusInfo && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-1.5 rounded-xl px-4 py-3 space-y-2.5"
                                    style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}22` }}>
                                    <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Come funziona</p>
                                    <p className="text-sm text-white/70 leading-relaxed">{detail.description}</p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                                        style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35` }}>
                                        ⏱ {detail.duration}
                                      </span>
                                      <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        ~{chancePercent}% per attacco
                                      </span>
                                      {meta.preventsAttack && (
                                        <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                                          style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                                          🚫 Blocca attacco
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })()}

                      {/* Catch difficulty + base rate now live on the hero plate (no duplicate block) */}

                      {/* Evolution callout */}
                      {pc.duplicates_count >= 3 && evolvableIds.has(pc.creature_id) && (
                        <div className="rounded-2xl p-3 flex items-center gap-3"
                          style={{ background: 'linear-gradient(135deg, rgba(247,200,65,0.12) 0%, rgba(245,158,11,0.08) 100%)', border: '1.5px solid rgba(247,200,65,0.35)', boxShadow: '0 0 16px rgba(247,200,65,0.15)' }}>
                          <span className="text-2xl shrink-0" style={{ animation: 'evolvePulse 1s ease-in-out infinite alternate' }}>✨</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[#F7C841] font-extrabold text-sm leading-tight">Evoluzione disponibile!</p>
                            <p className="text-white/50 text-xs mt-0.5">
                              Hai <span className="text-white/80 font-bold">{pc.duplicates_count} copie</span> — consuma 2 per far evolvere questa creatura
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Forgiatura GOLD (Wave 3): 3ª copia + 25 gemme → +10% stats base */}
                      {(pc as { is_gold?: boolean }).is_gold ? (
                        <div className="rounded-2xl p-3 flex items-center gap-3"
                          style={{ background: 'linear-gradient(135deg, rgba(243,194,51,0.18) 0%, rgba(184,134,11,0.10) 100%)', border: '1.5px solid rgba(243,194,51,0.55)', boxShadow: '0 0 20px rgba(243,194,51,0.2)' }}>
                          <span className="text-2xl shrink-0">🥇</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-sm leading-tight" style={{ color: '#F3C233' }}>Variante GOLD</p>
                            <p className="text-white/50 text-xs mt-0.5">+10% a tutte le statistiche base, per sempre</p>
                          </div>
                        </div>
                      ) : pc.duplicates_count >= 3 ? (
                        <button
                          onClick={() => handleForgeGold(pc.id)}
                          disabled={forgingGoldId === pc.id}
                          className="w-full rounded-2xl p-3 flex items-center gap-3 text-left disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg, rgba(243,194,51,0.10) 0%, rgba(255,255,255,0.02) 100%)', border: '1.5px solid rgba(243,194,51,0.4)' }}>
                          <span className="text-2xl shrink-0">🥇</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-sm leading-tight" style={{ color: '#F3C233' }}>
                              {forgingGoldId === pc.id ? 'Forgiatura…' : 'Forgia la variante GOLD'}
                            </p>
                            <p className="text-white/50 text-xs mt-0.5">
                              Consuma <span className="text-white/80 font-bold">2 copie + 25 💎</span> → +10% stats base permanente
                            </p>
                          </div>
                        </button>
                      ) : null}

                      {/* Squad assignment */}
                      <div>
                        <div className="flex items-baseline justify-between mb-2.5">
                          <p className="text-[11px] font-bold text-white/35 uppercase tracking-widest">Squadra da battaglia</p>
                          <p className="text-[10px] font-semibold" style={{ color: squad.includes(pc.id) ? 'rgba(58,188,168,0.9)' : 'rgba(255,255,255,0.4)' }}>
                            {squad.includes(pc.id) ? '✓ in squadra · tocca per togliere' : 'tocca uno slot per schierare'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {[0, 1, 2].map(slotIdx => {
                            const inSlot = squad[slotIdx] === pc.id
                            const occupantId = squad[slotIdx]
                            const slotTaken = !!occupantId && !inSlot
                            const occupantPc = slotTaken ? playerCreatures.find(p => p.id === occupantId) : null
                            const occupantCr = occupantPc ? creatures.find(c => c.id === occupantPc.creature_id) : null
                            const isLead = slotIdx === 0
                            return (
                              <motion.button
                                key={slotIdx}
                                layout
                                whileTap={{ scale: 0.93 }}
                                disabled={squadSaving}
                                onClick={() => inSlot ? handleSquadSlot(-1, pc.id) : handleSquadSlot(slotIdx, pc.id)}
                                className="flex-1 relative rounded-xl overflow-hidden transition-all disabled:opacity-50"
                                style={{
                                  height: 80,
                                  background: inSlot
                                    ? isLead ? 'rgba(58,188,168,0.18)' : 'rgba(255,255,255,0.12)'
                                    : slotTaken
                                    ? 'rgba(255,255,255,0.04)'
                                    : isLead
                                    ? 'rgba(58,188,168,0.08)'
                                    : 'rgba(58,188,168,0.04)',
                                  border: inSlot
                                    ? isLead ? '1.5px solid rgba(58,188,168,0.7)' : '1.5px solid rgba(255,255,255,0.3)'
                                    : slotTaken
                                    ? '1px dashed rgba(255,255,255,0.12)'
                                    : '1.5px dashed rgba(58,188,168,0.55)',
                                  boxShadow: !inSlot && !slotTaken
                                    ? isLead
                                      ? '0 0 12px rgba(58,188,168,0.2), inset 0 0 12px rgba(58,188,168,0.08)'
                                      : '0 0 8px rgba(58,188,168,0.12), inset 0 0 8px rgba(58,188,168,0.05)'
                                    : undefined,
                                }}
                              >
                                {inSlot ? (
                                  creature.sprite_cutout_url ? (
                                    <>
                                      <Image src={ELEMENT_BACKGROUND[creature.element]} alt="" fill sizes="120px" className="object-cover" />
                                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(4,6,10,0.62), rgba(4,6,10,0.12))' }} />
                                      <Image src={resolveCreatureSprite(creature)} alt={creature.name} width={68} height={68} className="absolute inset-0 w-full h-full object-contain p-1.5" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.55))' }} />
                                    </>
                                  ) : creature.image_url
                                    ? <img src={creature.image_url} alt={creature.name} className="absolute inset-0 w-full h-full object-contain p-2" />
                                    : <span className="absolute inset-0 flex items-center justify-center"><ElementIcon element={creature.element} size={30} /></span>
                                ) : occupantCr ? (
                                  occupantCr.sprite_cutout_url ? (
                                    <div className="absolute inset-0 opacity-45">
                                      <Image src={ELEMENT_BACKGROUND[occupantCr.element]} alt="" fill sizes="120px" className="object-cover" />
                                      <Image src={resolveCreatureSprite(occupantCr)} alt={occupantCr.name} width={68} height={68} className="absolute inset-0 w-full h-full object-contain p-2" />
                                    </div>
                                  ) : occupantCr.image_url
                                    ? <img src={occupantCr.image_url} alt={occupantCr.name} className="absolute inset-0 w-full h-full object-contain p-2 opacity-40" />
                                    : <span className="absolute inset-0 flex items-center justify-center opacity-30"><ElementIcon element={occupantCr.element} size={30} /></span>
                                ) : (
                                  /* Empty slot — visible call-to-action */
                                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                    <span
                                      className="animate-pulse w-8 h-8 rounded-full flex items-center justify-center"
                                      style={{
                                        background: 'rgba(58,188,168,0.18)',
                                        border: '1.5px solid rgba(58,188,168,0.7)',
                                        boxShadow: '0 0 10px rgba(58,188,168,0.4)',
                                      }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M7 2v10M2 7h10" stroke="#3ABCA8" strokeWidth="2.2" strokeLinecap="round"/>
                                      </svg>
                                    </span>
                                    <span className="text-[8px] font-extrabold tracking-wide" style={{ color: 'rgba(58,188,168,0.85)' }}>
                                      {isLead ? 'Capitano' : 'Riserva'}
                                    </span>
                                  </span>
                                )}
                                {/* Bottom label for filled/taken slots */}
                                {(inSlot || slotTaken) && (
                                  <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 pt-4"
                                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
                                    <span className="text-[8px] font-bold leading-none block text-center"
                                      style={{ color: inSlot ? (isLead ? '#3ABCA8' : 'white') : 'rgba(255,255,255,0.25)' }}>
                                      {isLead ? 'Capitano' : `Slot ${slotIdx + 1}`}
                                    </span>
                                  </div>
                                )}
                                {inSlot && (
                                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                                    style={{ background: isLead ? '#3ABCA8' : 'rgba(255,255,255,0.75)', color: '#0A1520' }}>✓</span>
                                )}
                                {slotTaken && (
                                  <span className="absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none" style={{ background: 'rgba(58,188,168,0.9)', color: '#06121a' }} title="Sostituisci">↔</span>
                                )}
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Evolve button */}
                      {pc.duplicates_count >= 3 && evolvableIds.has(pc.creature_id) && (
                        <button onClick={() => handleEvolve(pc)}
                          className="w-full font-extrabold py-3.5 rounded-xl text-[#0F1F2E]"
                          style={{ background: 'linear-gradient(135deg, #F7C841 0%, #F59E0B 100%)', boxShadow: '0 4px 16px rgba(247,200,65,0.4)' }}>
                          ✨ Evolvi
                        </button>
                      )}

                      </div>
                      )}
                    </>
                  ) : (
                    /* ── NOT CAUGHT: mystery view ── */
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {['HP', 'ATK', 'DEF'].map(label => (
                          <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-white/15">—</p>
                            <p className="text-xs text-white/20 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl p-4 text-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="mb-1.5 flex justify-center"><ElementIcon element={creature.element} size={30} /></p>
                        <p className="text-xs text-white/30">Elemento rilevato</p>
                      </div>

                      <div className="bg-[#E85D2F]/10 border border-[#E85D2F]/20 rounded-xl px-4 py-3 text-center">
                        <p className="text-sm font-bold text-[#E85D2F]">🎯 Catturala per scoprire tutto!</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* First-time explainer for the Daimon detail sheet (caught creatures
          only — that's when the tabs + squad controls are present). */}
      <FirstTimeHint
        id="bestiary-detail-v1"
        active={!!selected && !!selected.pc}
        accent="#3ABCA8"
        icon={<GiOpenBook />}
        eyebrow="Scheda Daimon"
        title="Tutto sul tuo Daimon"
        body={
          <>
            Le schede <b className="text-white/90">Info · Abilità · Equip · Enigma</b> raccolgono
            statistiche, mosse ed equipaggiamento. Più in basso, tocca uno slot{' '}
            <b className="text-white/90">Squadra</b> per schierare il Daimon: il 1º slot è il tuo
            Capitano.
          </>
        }
      />

      {/* ── Evolution animation + reveal card ────────────────────────── */}
      {evolveReveal && (() => {
        const cr = evolveReveal
        const rarityColor = RARITY_COLORS[cr.rarity as keyof typeof RARITY_COLORS] ?? '#9CA3AF'
        const elemGlow: Record<string, string> = {
          fiamma: '#FF6B35', adriatico: '#3A9DBC', bosco: '#34D399', terra: '#A78BFA', armonia: '#F9A8D4',
        }
        const glow = elemGlow[cr.element] ?? rarityColor
        return (
          <div className="fixed inset-0 z-[1200] flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm">

            {/* ── CHARGE phase: spinning energy rings ── */}
            {evolvePhase === 'charge' && (
              <div className="flex flex-col items-center gap-6 select-none">
                {/* Concentric spinning rings */}
                <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
                  {/* Outer ring */}
                  <div style={{
                    position: 'absolute', width: 180, height: 180, borderRadius: '50%',
                    border: `3px solid ${glow}`,
                    boxShadow: `0 0 24px ${glow}88, inset 0 0 24px ${glow}22`,
                    animation: 'evolveRingOuter 1.2s linear infinite',
                  }} />
                  {/* Middle ring */}
                  <div style={{
                    position: 'absolute', width: 130, height: 130, borderRadius: '50%',
                    border: `2px solid ${glow}99`,
                    boxShadow: `0 0 16px ${glow}66`,
                    animation: 'evolveRingMid 0.8s linear infinite reverse',
                  }} />
                  {/* Inner ring */}
                  <div style={{
                    position: 'absolute', width: 80, height: 80, borderRadius: '50%',
                    border: `2px dashed ${glow}cc`,
                    animation: 'evolveRingInner 0.5s linear infinite',
                  }} />
                  {/* Core glow */}
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `radial-gradient(circle, white 0%, ${glow} 60%, transparent 100%)`,
                    boxShadow: `0 0 40px ${glow}, 0 0 80px ${glow}66`,
                    animation: 'evolvePulse 0.6s ease-in-out infinite alternate',
                  }} />
                </div>
                <p className="text-white/60 text-sm font-semibold tracking-widest uppercase"
                  style={{ animation: 'evolvePulse 0.6s ease-in-out infinite alternate' }}>
                  Evoluzione in corso...
                </p>
              </div>
            )}

            {/* ── FLASH phase: white blast ── */}
            {evolvePhase === 'flash' && (
              <div
                className="absolute inset-0"
                style={{ background: 'white', animation: 'evolveFlash 0.5s ease-out forwards' }}
              />
            )}

            {/* ── REVEAL phase: bottom sheet card ── */}
            {evolvePhase === 'reveal' && (
              <>
                <div className="absolute inset-0" onClick={() => { setEvolveReveal(null); setEvolveCardVisible(false) }} />
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-y-auto"
                  style={{
                    background: '#080E1A',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderBottom: 'none',
                    maxHeight: '88vh',
                    transform: evolveCardVisible ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <div className="flex justify-center pt-3 mb-1">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>

                  <div className="relative pt-2 pb-2" style={{
                    background: `linear-gradient(180deg, ${glow}18 0%, transparent 100%)`,
                  }}>
                    {/* Badge */}
                    <div className="flex justify-center mb-3">
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full font-extrabold text-sm"
                        style={{
                          background: '#F7C841', color: '#080E1A',
                          boxShadow: '0 4px 20px rgba(247,200,65,0.5)',
                          opacity: evolveCardVisible ? 1 : 0,
                          transform: evolveCardVisible ? 'scale(1)' : 'scale(0.6)',
                          transition: 'opacity 0.3s 0.15s, transform 0.4s 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                        }}>
                        ✨ Evoluzione!
                      </div>
                    </div>
                    {/* Sprite */}
                    <div className="flex justify-center" style={{
                      opacity: evolveCardVisible ? 1 : 0,
                      transform: evolveCardVisible ? 'scale(1)' : 'scale(0.5)',
                      transition: 'opacity 0.35s 0.1s, transform 0.45s 0.1s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>
                      <CreatureDiorama
                        creature={cr}
                        size={158}
                        anchor="center"
                        rounded={20}
                        className="w-full"
                        style={{ aspectRatio: '5 / 4', maxWidth: 300 }}
                      />
                    </div>
                  </div>

                  <div className="px-5 pb-8">
                    {/* Name + element + rarity */}
                    <div className="text-center mb-4" style={{
                      opacity: evolveCardVisible ? 1 : 0, transition: 'opacity 0.3s 0.25s',
                    }}>
                      <h3 className="text-2xl font-bold text-white mb-1">{cr.name}</h3>
                      <div className="flex items-center justify-center gap-2">
                        <span className="flex"><ElementIcon element={cr.element} size={16} /></span>
                        <span className="text-xs capitalize text-white/40">{cr.element}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${rarityColor}22`, color: rarityColor, border: `1px solid ${rarityColor}55` }}>
                          {RARITY_LABELS[cr.rarity as keyof typeof RARITY_LABELS]}
                        </span>
                      </div>
                      {cr.description && (
                        <p className="text-sm text-white/45 mt-3 leading-relaxed">{cr.description}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4" style={{
                      opacity: evolveCardVisible ? 1 : 0, transition: 'opacity 0.3s 0.32s',
                    }}>
                      {[
                        { label: 'HP',  value: cr.hp,  color: '#F87171' },
                        { label: 'ATK', value: cr.atk, color: '#FB923C' },
                        { label: 'DEF', value: cr.def, color: '#60A5FA' },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl p-3 text-center"
                          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${s.color}20` }}>
                          <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-[10px] text-white/35 mt-0.5 font-semibold uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Copies note */}
                    <p className="text-center text-xs text-white/30 mb-4" style={{
                      opacity: evolveCardVisible ? 1 : 0, transition: 'opacity 0.3s 0.38s',
                    }}>
                      2 copie consumate · {cr.copiesRemaining} {cr.copiesRemaining === 1 ? 'copia' : 'copie'} rimanenti
                    </p>

                    {/* CTA */}
                    <button
                      onClick={() => { setEvolveReveal(null); setEvolveCardVisible(false) }}
                      className="w-full py-4 rounded-2xl font-extrabold text-base"
                      style={{
                        background: 'linear-gradient(135deg, #F7C841 0%, #F59E0B 100%)',
                        boxShadow: '0 4px 24px rgba(247,200,65,0.4)',
                        color: '#0F1F2E',
                        opacity: evolveCardVisible ? 1 : 0,
                        transition: 'opacity 0.3s 0.4s',
                      }}
                    >
                      Continua
                    </button>
                  </div>
                </div>
              </>
            )}

            <style>{`
              @keyframes evolveRingOuter {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes evolveRingMid {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes evolveRingInner {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes evolvePulse {
                from { opacity: 0.6; transform: scale(0.92); }
                to   { opacity: 1;   transform: scale(1.08); }
              }
              @keyframes evolveFlash {
                0%   { opacity: 1; }
                100% { opacity: 0; }
              }
            `}</style>
          </div>
        )
      })()}
    </div>
  )
}
