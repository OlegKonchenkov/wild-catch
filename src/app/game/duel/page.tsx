'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/types'
import CreatureSprite from '@/components/creature/CreatureSprite'

interface ActiveCreature {
  playerCreatureId: string
  name: string
  element: string
  rarity: string
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
      const body: Record<string, string> = {
        sessionId,
        playerCreatureId: creature.playerCreatureId,
      }
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
        <p className="text-5xl">⚔️</p>
        <p className="text-white font-bold text-lg">Nessuna creatura selezionata</p>
        <p className="text-white/50 text-sm">Vai al Bestiario e seleziona una creatura attiva prima di sfidare qualcuno.</p>
        <button
          onClick={() => router.push('/game/bestiary')}
          className="bg-[#3A9DBC] text-white font-bold py-3 px-6 rounded-xl"
        >
          Vai al Bestiario
        </button>
      </div>
    )
  }

  const rarityColor = creature ? RARITY_COLORS[creature.rarity] : '#94a3b8'
  const elementEmoji = creature ? ELEMENT_EMOJI[creature.element] ?? '✨' : ''

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      <h1 className="text-2xl font-extrabold text-white mb-1">⚔️ Duello PvP</h1>
      <p className="text-white/40 text-sm mb-5">Sfida un altro giocatore in tempo reale</p>

      {/* Active creature card */}
      {creature ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6 flex items-center gap-4">
          <CreatureSprite imageUrl={creature.image_url} name={creature.name} animState="idle" size={80} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 mb-0.5">Creatura attiva</p>
            <p className="font-bold text-white text-lg leading-tight truncate">{creature.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span>{elementEmoji}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
                style={{ backgroundColor: rarityColor }}>
                {creature.rarity}
              </span>
              <span className="text-xs text-white/40">HP {creature.hp} · ATK {creature.atk}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6 h-24 animate-pulse" />
      )}

      {/* Create */}
      <button
        onClick={() => connect()}
        disabled={!creature || loading}
        className="w-full bg-[#E85D2F] text-white font-bold py-4 rounded-xl mb-5 text-base disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading && !joinCode ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : '⚔️ Crea Sfida'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs">oppure entra con un codice</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Join */}
      <div className="flex gap-2">
        <input
          value={joinCode}
          onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)); setError(null) }}
          placeholder="ABCD"
          maxLength={4}
          autoCapitalize="characters"
          className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white font-mono text-2xl text-center tracking-[0.3em] placeholder-white/20 focus:outline-none focus:border-[#3A9DBC] transition-colors"
        />
        <button
          onClick={() => connect(joinCode)}
          disabled={joinCode.length < 4 || !creature || loading}
          className="bg-[#3A9DBC] text-white font-bold px-5 rounded-xl disabled:opacity-40 flex items-center justify-center min-w-[64px]"
        >
          {loading && joinCode.length === 4 ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Entra'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          ⚠️ {error}
        </p>
      )}

      <p className="text-white/20 text-xs text-center mt-8 leading-relaxed px-2">
        Crea una sfida e condividi il codice a 4 lettere con un altro giocatore nella sessione.
        Il duello inizia non appena entrambi si connettono.
      </p>
    </div>
  )
}
