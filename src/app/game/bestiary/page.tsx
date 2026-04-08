'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { RARITY_COLORS, ELEMENT_EMOJI, RARITY_CATCH_RATES, ELEMENT_MULTIPLIERS } from '@/lib/types'
import type { Creature, PlayerCreature, Element } from '@/lib/types'
import CreatureSprite from '@/components/creature/CreatureSprite'

const RARITY_ORDER = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']

function getVideoEmbed(url: string): { type: 'iframe'; src: string } | { type: 'video'; src: string } | null {
  try {
    const u = new URL(url)
    // YouTube watch
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.searchParams.get('v')) {
      return { type: 'iframe', src: `https://www.youtube.com/embed/${u.searchParams.get('v')}` }
    }
    // YouTube short URL
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0]
      return { type: 'iframe', src: `https://www.youtube.com/embed/${id}` }
    }
    // YouTube embed already
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.pathname.startsWith('/embed/')) {
      return { type: 'iframe', src: url }
    }
    // Vimeo
    if (u.hostname === 'vimeo.com' || u.hostname === 'www.vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` }
    }
    // Direct video file
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
      return { type: 'video', src: url }
    }
    // Fallback: try iframe
    return { type: 'iframe', src: url }
  } catch {
    return null
  }
}
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
  const [showEnigma, setShowEnigma]         = useState(false)
  const [loading, setLoading]               = useState(true)
  const [selectedPcId, setSelectedPcId]     = useState<string | null>(null)
  const [playerLevel, setPlayerLevel]       = useState(1)
  const supabase   = useMemo(() => createClient(), [])
  const userIdRef  = useRef<string | null>(null)
  const sessionRef = useRef<string | null>(null)

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
      .select('selected_creature_id, level')
      .eq('user_id', uid)
      .eq('session_id', sid)
      .single()
      .then(({ data }) => {
        if (data?.selected_creature_id) setSelectedPcId(data.selected_creature_id)
        if (data?.level) setPlayerLevel(data.level as number)
      })
  }

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }
    sessionRef.current = sessionId

    let done = 0
    function finish() { if (++done === 3) setLoading(false) }

    supabase.from('creatures').select('*').order('rarity').then(({ data }) => {
      if (data) setCreatures(
        [...(data as unknown as Creature[])].sort(
          (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
        )
      )
      finish()
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
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
        .select('selected_creature_id, level')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
        .then(({ data }) => {
          if (data?.selected_creature_id) setSelectedPcId(data.selected_creature_id)
          if (data?.level) setPlayerLevel(data.level as number)
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
      setMessage(`✨ ${data.newCreature.name} si è evoluta!`)
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return
      const { data: refreshed } = await supabase
        .from('player_creatures').select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', localStorage.getItem('current_session_id')!)
      if (refreshed) setPlayerCreatures(refreshed as unknown as PlayerCreature[])
    } else {
      setMessage(data.error)
    }
  }

  const RARITY_LABELS: Record<string, string> = {
    comune: 'Comune', non_comune: 'Non Com.', raro: 'Raro', epico: 'Epico', leggendario: 'Legg.', mitologico: 'Mito',
  }

  const caughtCount = playerCreatures.length
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

  const ELEM_TABLE: Record<string, { strong: string[]; weak: string[] }> = {
    fiamma:    { strong: ['bosco'],                              weak: ['adriatico'] },
    adriatico: { strong: ['fiamma'],                             weak: ['terra'] },
    bosco:     { strong: ['terra'],                              weak: ['fiamma'] },
    terra:     { strong: ['adriatico'],                          weak: ['bosco'] },
    armonia:   { strong: ['fiamma', 'adriatico', 'bosco', 'terra'], weak: [] },
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Modale debolezze elementali */}
      <AnimatePresence>
        {showWeakness && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center backdrop-blur-sm"
            onClick={() => setShowWeakness(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[#0F1F2E] border-t border-white/10 rounded-t-3xl w-full max-w-lg pb-10"
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <div className="px-5">
                <h2 className="text-lg font-bold text-white mb-1">Forze & Debolezze</h2>
                <p className="text-xs text-white/40 mb-4">+50% danno quando attacchi un tipo debole</p>
                <div className="space-y-2">
                  {Object.entries(ELEM_TABLE).map(([el, { strong, weak }]) => (
                    <div key={el} className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <span className="text-xl w-8 text-center">{ELEM_META[el].emoji}</span>
                      <div className="flex-1">
                        <p className="text-xs text-white/60 font-semibold">{ELEM_META[el].label}</p>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {strong.map(s => (
                            <span key={s} className="text-[10px] bg-[#34D399]/15 text-[#34D399] px-1.5 py-0.5 rounded">
                              ↑ {ELEM_META[s].emoji}
                            </span>
                          ))}
                          {weak.map(w => (
                            <span key={w} className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">
                              ↓ {ELEM_META[w].emoji}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
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
      <div className="sticky top-0 z-10 bg-[#0A1520]/96 backdrop-blur-md px-4 pt-3 pb-2.5 border-b border-white/5">

        {/* Row 1: title + progress */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white tracking-tight">WildDex</h1>
            <button
              onClick={() => setShowWeakness(true)}
              aria-label="Forze e debolezze"
              className="w-5 h-5 rounded-full bg-white/8 border border-white/10 text-white/35 text-[10px] font-bold flex items-center justify-center active:bg-white/15"
            >
              ?
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/40">
              <span className="text-[#3A9DBC] font-bold">{caughtCount}</span>
              <span className="text-white/25">/{creatures.length}</span>
            </p>
            {/* Mini progress ring-style bar */}
            <div className="w-16 h-1 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3A9DBC, #34D399)' }}
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
                      style={{
                        background: filter === v ? '#3A9DBC' : 'rgba(255,255,255,0.05)',
                        color: filter === v ? 'white' : 'rgba(255,255,255,0.38)',
                      }}>
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
                        {r === 'all' ? '★ Rarità' : RARITY_LABELS[r]}
                      </button>
                    )
                  })}
                </div>

                {/* Element chips */}
                <div className="flex gap-1.5">
                  {(['all', 'fiamma', 'adriatico', 'bosco', 'terra', 'armonia'] as const).map(el => {
                    const active = elementFilter === el
                    const emoji = el !== 'all' ? ELEM_META[el]?.emoji : null
                    return (
                      <button key={el} onClick={() => setElementFilter(el)}
                        className="flex-1 text-[10px] py-1 rounded-lg font-semibold transition-all cursor-pointer"
                        style={{
                          background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                          color: active ? 'white' : 'rgba(255,255,255,0.28)',
                          border: `1px solid ${active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                        {el === 'all' ? 'Elem.' : emoji}
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
      </div>

      <div className="px-4 py-4">
        {message && (
          <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="text-[#F7C841] text-sm text-center mb-4 bg-[#F7C841]/10 rounded-lg p-2">
            {message}
          </motion.p>
        )}

        {loading && (
          <div className="grid grid-cols-3 gap-2 pb-24">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/8 p-2 flex flex-col items-center gap-1.5"
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className="w-14 h-14 rounded-lg bg-white/10 animate-pulse" />
                <div className="w-12 h-2.5 rounded bg-white/10 animate-pulse" />
                <div className="w-8 h-2 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
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

            return (
              <motion.div
                key={creature.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => { setSelected({ creature, pc }); setShowEnigma(false) }}
                className={`relative rounded-2xl overflow-hidden cursor-pointer border transition-all
                  ${caught && pc?.id === selectedPcId
                    ? 'wc-active-card border-2'
                    : caught
                      ? 'bg-gradient-to-b from-white/10 to-white/5 border border-white/15 hover:border-white/30'
                      : 'mystery-shimmer border border-white/5 hover:border-white/10'
                  }`}
              >
                {/* Rarity stripe */}
                <div className="h-0.5" style={{ background: caught ? rarityColor : 'transparent' }} />

                {/* Image area */}
                <div className="relative aspect-square overflow-hidden flex items-center justify-center p-1">
                  {creature.image_url ? (
                    <>
                      <Image
                        src={creature.image_url}
                        alt={caught ? creature.name : '???'}
                        width={80} height={80}
                        className={`w-full h-full object-contain transition-all ${caught ? '' : 'silhouette'}`}
                      />
                      {!caught && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0A1520]/40 rounded-lg">
                          <span className="text-white/30 text-lg font-black">?</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={`text-3xl ${caught ? '' : 'opacity-10'}`}>
                      {caught ? ELEMENT_EMOJI[creature.element] : '?'}
                    </div>
                  )}

                  {/* Caught badge */}
                  {caught && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#34D399] flex items-center justify-center">
                      <span className="text-[9px] font-black text-white">✓</span>
                    </div>
                  )}

                  {/* Evolvibile badge */}
                  {pc && pc.duplicates_count >= 3 && !pc.evolved && (
                    <div className="absolute top-1 left-1 animate-bounce">
                      <span className="text-sm">✨</span>
                    </div>
                  )}

                  {/* Duplicate count */}
                  {pc && pc.duplicates_count > 1 && (
                    <div className="absolute top-1 left-1 bg-[#3A9DBC] text-white text-[9px] font-bold px-1 rounded">
                      ×{pc.duplicates_count}
                    </div>
                  )}

                  {/* Active creature badge */}
                  {pc?.id === selectedPcId && (
                    <div className="wc-active-badge absolute bottom-0 left-0 right-0 text-[#0A1520] text-[8px] font-black text-center py-1 tracking-widest uppercase"
                      style={{ background: 'linear-gradient(90deg, #2BBFAC, #3ABCA8, #2BBFAC)' }}>
                      ⚔ IN SQUADRA
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className={`px-2 pb-2 text-center ${caught ? '' : 'opacity-40'}`}>
                  <p className="text-xs font-bold truncate" style={{ color: caught ? 'white' : '#666' }}>
                    {caught ? creature.name : '???'}
                  </p>
                  {caught && (
                    <p className="text-[9px] mt-0.5" style={{ color: rarityColor }}>
                      {ELEMENT_EMOJI[creature.element]}
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
          const hint = MYSTERY_HINTS[creature.element] ?? 'Qualcosa si muove nell\'ombra...'

          return (
            <motion.div
              key="sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-[#0F1F2E] border-t border-white/10 rounded-t-3xl z-50 pb-8"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              <button onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-white/30 hover:text-white/70 text-xl w-8 h-8 flex items-center justify-center">
                ✕
              </button>

              <div className="px-6 pt-2">
                {/* Image */}
                <div className="flex justify-center mb-4">
                  {caught ? (
                    <CreatureSprite
                      imageUrl={creature.image_url ?? ''}
                      name={creature.name}
                      animState="idle"
                      size={164}
                      element={creature.element}
                      rarity={creature.rarity}
                      showAura
                    />
                  ) : (
                    <div className="relative w-36 h-36">
                      {creature.image_url ? (
                        <>
                          <Image src={creature.image_url} alt="???"
                            fill className="object-contain silhouette-soft" sizes="144px" />
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#0F1F2E]/30 via-[#0F1F2E]/20 to-[#0F1F2E]/50" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">?</div>
                      )}
                    </div>
                  )}
                </div>

                {caught ? (
                  /* ── CAUGHT: full info ── */
                  <>
                    <div className="text-center mb-4">
                      <h3 className="text-2xl font-bold text-white">{creature.name}</h3>
                      {pc?.id === selectedPcId && (
                        <div className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#3A9DBC]/20 border border-[#3A9DBC]/40 text-[#3A9DBC] text-xs font-semibold">
                          Creatura attiva ⚔️
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="text-sm">{ELEMENT_EMOJI[creature.element]}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: `${RARITY_COLORS[creature.rarity]}22`, color: RARITY_COLORS[creature.rarity] }}>
                          {creature.rarity.replace('_', ' ')}
                        </span>
                        {pc.duplicates_count > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#3A9DBC]/20 text-[#3A9DBC]">
                            ×{pc.duplicates_count} duplicati
                          </span>
                        )}
                      </div>
                      {creature.description && (
                        <p className="text-sm text-white/50 mt-3 leading-relaxed">{creature.description}</p>
                      )}
                    </div>

                    {/* Stats — scaled to player level */}
                    {(() => {
                      const lv = Math.max(1, playerLevel)
                      const delta = lv - 1
                      const sHP  = Math.max(1, Math.round(creature.hp  * (1 + delta * 0.14)))
                      const sATK = Math.max(1, Math.round(creature.atk * (1 + delta * 0.10)))
                      const sDEF = Math.max(0, Math.round((creature.def ?? 0) * (1 + delta * 0.09)))
                      const stats = [
                        { label: 'HP',  base: creature.hp,        scaled: sHP,  color: '#F87171' },
                        { label: 'ATK', base: creature.atk,       scaled: sATK, color: '#FB923C' },
                        { label: 'DEF', base: creature.def ?? 0,  scaled: sDEF, color: '#60A5FA' },
                      ]
                      return (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-white/35 uppercase tracking-wider font-bold">Statistiche</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#FBBF24' }}>
                              Lv. {lv}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {stats.map(s => (
                              <div key={s.label} className="rounded-xl p-3 text-center"
                                style={{ background: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                                <p className="text-xl font-black" style={{ color: s.color }}>{s.scaled}</p>
                                <p className="text-[10px] font-bold text-white/50 mt-0.5">{s.label}</p>
                                {lv > 1 && (
                                  <>
                                    <div className="my-1.5 mx-1" style={{ height: '1px', background: `${s.color}20` }} />
                                    <p className="text-[10px] text-white/40 leading-none">
                                      <span className="text-white/25">base </span>
                                      <span className="font-semibold">{s.base}</span>
                                    </p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Difficoltà cattura + % base */}
                    <div className="bg-white/5 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white/40 mb-0.5">Cattura</p>
                        <p className="text-sm font-bold text-[#34D399]">
                          {Math.round((RARITY_CATCH_RATES[creature.rarity] ?? 0.5) * 100)}% base
                        </p>
                        <p className="text-[10px] text-white/30">
                          {['Molto facile','Facile','Normale','Difficile','Molto difficile'][((creature as any).catch_difficulty ?? 1) - 1]}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <span key={n} className={`text-base ${n <= ((creature as any).catch_difficulty ?? 1) ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => handleSelect(pc)}
                        className="flex-1 bg-[#3A9DBC] text-white font-bold py-3.5 rounded-xl">
                        ⚔️ Usa in Battaglia
                      </button>
                      {pc.duplicates_count >= 3 && !pc.evolved && (
                        <button onClick={() => handleEvolve(pc)}
                          className="flex-1 bg-[#F7C841] text-[#0F1F2E] font-bold py-3.5 rounded-xl">
                          ✨ Evolvi
                        </button>
                      )}
                    </div>

                    {/* Enigma button */}
                    <button
                      onClick={() => setShowEnigma(v => !v)}
                      disabled={!creature.enigma_title && !creature.enigma_description}
                      className={`w-full font-bold py-3 rounded-xl text-sm transition-all
                        ${creature.enigma_title || creature.enigma_description
                          ? 'bg-[#4A1D7A]/60 border border-[#7B4DB8]/50 text-[#C084FC] hover:bg-[#4A1D7A]/90'
                          : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'}`}>
                      🧩 Frammento Enigma
                      {(creature.enigma_title || creature.enigma_description) && (
                        <span className="ml-2 text-white/40 text-xs">{showEnigma ? '▲' : '▼'}</span>
                      )}
                    </button>

                    {/* Enigma reveal */}
                    <AnimatePresence>
                      {showEnigma && (creature.enigma_title || creature.enigma_description) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden">
                          <div className="bg-[#1A0D2E] border border-[#7B4DB8]/30 rounded-2xl p-4 space-y-3">
                            {creature.enigma_title && (
                              <h4 className="text-sm font-bold text-[#C084FC]">{creature.enigma_title}</h4>
                            )}
                            {creature.enigma_description && (
                              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{creature.enigma_description}</p>
                            )}
                            {creature.enigma_image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={creature.enigma_image_url} alt="Enigma"
                                className="w-full rounded-xl object-cover max-h-48" />
                            )}
                            {creature.enigma_video_url && (() => {
                              const embed = getVideoEmbed(creature.enigma_video_url)
                              if (!embed) return null
                              return (
                                <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                                  {embed.type === 'iframe' ? (
                                    <iframe
                                      src={embed.src}
                                      className="absolute inset-0 w-full h-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : (
                                    <video src={embed.src} controls className="absolute inset-0 w-full h-full" />
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  /* ── NOT CAUGHT: mystery view ── */
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-white/20 tracking-widest">? ? ?</h3>
                      <p className="text-xs text-white/30 mt-2 italic">{hint}</p>
                    </div>

                    {/* Hidden stats */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {['HP', 'ATK', 'DEF'].map(label => (
                        <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-white/15">—</p>
                          <p className="text-xs text-white/20 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Element hint only */}
                    <div className="bg-white/5 rounded-2xl p-4 text-center mb-5">
                      <p className="text-3xl mb-1">{ELEMENT_EMOJI[creature.element]}</p>
                      <p className="text-xs text-white/30">Elemento rilevato</p>
                    </div>

                    <div className="bg-[#E85D2F]/10 border border-[#E85D2F]/20 rounded-xl px-4 py-3 text-center">
                      <p className="text-sm font-bold text-[#E85D2F]">🎯 Catturala per scoprire tutto!</p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
