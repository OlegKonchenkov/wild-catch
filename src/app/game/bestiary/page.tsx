'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { RARITY_COLORS, ELEMENT_EMOJI } from '@/lib/types'
import type { Creature, PlayerCreature } from '@/lib/types'

export default function BestiaryPage() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [playerCreatures, setPlayerCreatures] = useState<PlayerCreature[]>([])
  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null)
  const [selectedPlayerCreature, setSelectedPlayerCreature] = useState<PlayerCreature | null>(null)
  const [message, setMessage] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    supabase.from('creatures').select('*').order('rarity').then(({ data }) => {
      if (data) setCreatures(data as unknown as Creature[])
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('player_creatures')
        .select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .then(({ data }) => {
          if (data) setPlayerCreatures(data as unknown as PlayerCreature[])
        })
    })
  }, [])

  function getPlayerCreature(creatureId: string) {
    return playerCreatures.find(pc => pc.creature_id === creatureId)
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
      setSelectedPlayerCreature(pc)
      setMessage(`${pc.creature?.name} selezionata come creatura attiva!`)
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
      // Refresh player creatures
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return
      const { data: refreshed } = await supabase
        .from('player_creatures')
        .select('*, creatures(*)')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
      if (refreshed) setPlayerCreatures(refreshed as unknown as PlayerCreature[])
    } else {
      setMessage(data.error)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-white mb-1">Bestiario</h1>
      <p className="text-white/50 text-sm mb-4">
        {playerCreatures.length} / {creatures.length} creature catturate
      </p>

      {message && (
        <p className="text-[#F7C841] text-sm text-center mb-4 bg-[#F7C841]/10 rounded-lg p-2">
          {message}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {creatures.map(creature => {
          const pc = getPlayerCreature(creature.id)
          const caught = !!pc
          const rarityColor = RARITY_COLORS[creature.rarity]

          return (
            <motion.div
              key={creature.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedCreature(creature); setSelectedPlayerCreature(pc ?? null) }}
              className={`relative rounded-xl p-2 border cursor-pointer ${
                caught ? 'bg-white/10 border-white/20' : 'bg-black/30 border-white/5'
              }`}
            >
              <div
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: rarityColor }}
              />
              <div className="aspect-square rounded-lg overflow-hidden mb-1">
                {caught && creature.image_url ? (
                  <Image src={creature.image_url} alt={creature.name} width={80} height={80}
                    className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center text-2xl">
                    {caught ? ELEMENT_EMOJI[creature.element] : '❓'}
                  </div>
                )}
              </div>
              <p className={`text-xs text-center font-medium truncate ${caught ? 'text-white' : 'text-white/30'}`}>
                {caught ? creature.name : '???'}
              </p>
              {pc && pc.duplicates_count > 1 && (
                <span className="absolute top-1 left-1 text-xs bg-[#3A9DBC] text-white rounded px-1">
                  ×{pc.duplicates_count}
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {selectedCreature && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 bg-[#0F1F2E] border-t border-white/10 rounded-t-2xl p-6 z-50"
          >
            <button onClick={() => setSelectedCreature(null)} className="absolute top-4 right-4 text-white/50">✕</button>
            <div className="text-center">
              {selectedCreature.image_url ? (
                <Image src={selectedCreature.image_url} alt={selectedCreature.name}
                  width={120} height={120} className="mx-auto mb-3 object-contain" />
              ) : (
                <div className="text-6xl mx-auto mb-3">{ELEMENT_EMOJI[selectedCreature.element]}</div>
              )}
              <h3 className="text-xl font-bold text-white">{selectedCreature.name}</h3>
              <p className="text-sm text-white/60 mt-1">{selectedCreature.description}</p>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <span className="text-red-400">❤️ {selectedCreature.hp}</span>
                <span className="text-orange-400">⚔️ {selectedCreature.atk}</span>
                <span className="text-blue-400">🛡️ {selectedCreature.def}</span>
              </div>
              {selectedPlayerCreature && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleSelect(selectedPlayerCreature)}
                    className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl"
                  >
                    Usa in Battaglia
                  </button>
                  {selectedPlayerCreature.duplicates_count >= 3 && !selectedPlayerCreature.evolved && (
                    <button
                      onClick={() => handleEvolve(selectedPlayerCreature)}
                      className="flex-1 bg-[#F7C841] text-[#0F1F2E] font-bold py-3 rounded-xl"
                    >
                      ✨ Evolvi
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
