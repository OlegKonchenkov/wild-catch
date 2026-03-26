'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import type { Rarity, Element } from '@/lib/types'
import CreatureSprite from '@/components/creature/CreatureSprite'
import { motion, AnimatePresence } from 'framer-motion'

interface ActiveCreature {
  playerCreatureId: string
  name: string
  element: Element
  rarity: Rarity
  hp: number
  atk: number
  image_url: string
}

export default function DuelLobbyPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [creature, setCreature] = useState<ActiveCreature | null>(null)
  const [noCreature, setNoCreature] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('player_sessions')
        .select('selected_creature_id')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single()
        .then(({ data: ps }) => {
          if (!ps?.selected_creature_id) { setNoCreature(true); return }
          supabase
            .from('player_creatures')
            .select('id, creatures(name, element, rarity, hp, atk, image_url)')
            .eq('id', ps.selected_creature_id)
            .single()
            .then(({ data: pc }) => {
              const cr = (pc as any)?.creatures
              if (!cr) { setNoCreature(true); return }
              setCreature({
                playerCreatureId: pc!.id,
                name: cr.name, element: cr.element, rarity: cr.rarity,
                hp: cr.hp, atk: cr.atk, image_url: cr.image_url,
              })
            })
        })
    })
  }, [supabase])

  async function connect(roomCode?: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId || !creature || loading) return
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, string> = { sessionId, playerCreatureId: creature.playerCreatureId }
      if (roomCode) body.roomCode = roomCode.toUpperCase()
      const res = await fetch('/api/game/duel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/game/duel/${data.duelId}`)
      } else {
        setError(data.error ?? 'Errore connessione')
        setLoading(false)
      }
    } catch {
      setError('Errore di rete')
      setLoading(false)
    }
  }

  if (noCreature) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 mx-auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E85D2F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M14.5 17.5L3 6V3h3l11.5 11.5M16.5 15.5l1.5 1.5M8 2l4 4M2 8l4 4M5 15l-2 2 2 2 2-2M15 5l2-2 2 2-2 2"/>
            </svg>
          </div>
        </motion.div>
        <p className="text-white font-bold text-lg">Nessuna creatura selezionata</p>
        <p className="text-white/50 text-sm leading-relaxed">Vai al Bestiario e seleziona una creatura attiva prima di sfidare qualcuno.</p>
        <button onClick={() => router.push('/game/bestiary')}
          className="bg-[#3A9DBC] text-white font-bold py-3 px-6 rounded-xl cursor-pointer active:scale-95 transition-transform">
          Vai al Bestiario
        </button>
      </div>
    )
  }

  const rarityColor = creature ? RARITY_COLORS[creature.rarity] : '#94a3b8'
  const elementEmoji = creature ? ELEMENT_EMOJI[creature.element] ?? '✨' : ''

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
      {/* Hero banner */}
      <div className="relative px-4 pt-5 pb-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E85D2F]/10 via-transparent to-[#7B4DB8]/10 pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-xs text-[#E85D2F] font-bold tracking-widest uppercase mb-1">Arena</p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">Duello PvP</h1>
          <p className="text-white/40 text-sm mt-0.5">Sfida un altro giocatore in tempo reale</p>
        </motion.div>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">
        {/* Creature card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {creature ? (
            <div
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                border: `1px solid ${rarityColor}40`,
                boxShadow: `0 0 20px ${rarityColor}15`,
              }}
            >
              {/* Glow blob */}
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20 blur-2xl pointer-events-none"
                style={{ background: rarityColor }} />

              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">La tua creatura</p>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <CreatureSprite imageUrl={creature.image_url} name={creature.name} animState="idle" size={72} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-white text-base leading-tight truncate">{creature.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-sm">{elementEmoji}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold text-white"
                      style={{ backgroundColor: rarityColor }}>
                      {creature.rarity}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[11px] text-white/40">HP <span className="text-white/70 font-semibold">{creature.hp}</span></span>
                    <span className="text-[11px] text-white/40">ATK <span className="text-white/70 font-semibold">{creature.atk}</span></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/10 h-[96px] animate-pulse" />
          )}
        </motion.div>

        {/* Create challenge */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <button
            onClick={() => connect()}
            disabled={!creature || loading}
            className="w-full relative overflow-hidden rounded-2xl py-5 font-extrabold text-white text-base cursor-pointer active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
              boxShadow: creature && !loading ? '0 4px 20px rgba(232,93,47,0.4)' : 'none',
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading && !joinCode ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M14.5 17.5L3 6V3h3l11.5 11.5M16.5 15.5l1.5 1.5M8 2l4 4M2 8l4 4M5 15l-2 2 2 2 2-2M15 5l2-2 2 2-2 2"/>
                  </svg>
                  Crea Sfida
                </>
              )}
            </span>
          </button>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/25 text-xs">oppure unisciti con un codice</span>
          <div className="flex-1 h-px bg-white/10" />
        </motion.div>

        {/* Join */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}
          className="flex flex-col gap-2">
          <input
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)); setError(null) }}
            placeholder="A B C D"
            maxLength={4}
            autoCapitalize="characters"
            inputMode="text"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white font-mono text-2xl text-center tracking-[0.5em] placeholder-white/15 focus:outline-none focus:border-[#3A9DBC] transition-colors"
            style={{ letterSpacing: '0.5em' }}
          />
          <button
            onClick={() => connect(joinCode)}
            disabled={joinCode.length < 4 || !creature || loading}
            className="w-full py-4 rounded-xl font-bold text-sm cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: joinCode.length === 4 && creature
                ? 'linear-gradient(135deg, #3A9DBC 0%, #2a7a99 100%)'
                : 'rgba(255,255,255,0.05)',
              color: joinCode.length === 4 && creature ? 'white' : 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {loading && joinCode.length === 4 ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : 'Entra nel Duello'}
          </button>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="text-white/20 text-xs text-center leading-relaxed px-2 mt-1">
          Crea una sfida e condividi il codice a 4 lettere con un altro giocatore della sessione. Il duello inizia non appena entrambi si connettono.
        </p>
      </div>
    </div>
  )
}
