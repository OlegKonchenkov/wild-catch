'use client'
import { useEffect, useState } from 'react'
import { GiDeathSkull, GiCrossedSwords } from 'react-icons/gi'
import type { MapPin } from '@/components/map/GameMap'
import type { PinRewardData } from '@/components/game/PinRewardModal'

// Shown when a boss pin enters proximity range — lets the player choose
// to fight now or postpone (manual tap on the pin will re-open it later).
export default function BossApproachModal({
  pin,
  sessionId,
  playerPos,
  onFight,
  onLater,
}: {
  pin: MapPin
  sessionId: string
  playerPos: { lat: number; lng: number } | null
  onFight: (reward: PinRewardData) => void
  onLater: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  async function handleFight() {
    if (claiming) return
    setClaiming(true)
    setClaimError(null)
    try {
      const res = await fetch('/api/game/map-pins/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinId: pin.id, sessionId, lat: playerPos?.lat ?? pin.lat, lng: playerPos?.lng ?? pin.lng }),
      })
      const d: any = await res.json()
      if ((d.success || d.alreadyClaimed) && d.bossFightId) {
        onFight(d as PinRewardData)
      } else {
        setClaimError(d.error ?? 'Errore nell\'avviare la battaglia.')
      }
    } catch {
      setClaimError('Errore di rete, riprova.')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-end justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onLater} />
      <div
        className="relative w-full rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0D0608 0%, #1A060A 100%)',
          border: '1px solid rgba(232,93,47,0.3)',
          borderBottom: 'none',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div className="flex justify-center pt-3 mb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-5 pb-8 space-y-4 pt-2">
          <div className="flex items-start gap-3 bg-[#E85D2F]/10 border border-[#E85D2F]/25 rounded-2xl p-3">
            <span className="text-2xl leading-none mt-0.5">📍</span>
            <div>
              <p className="text-xs font-bold text-[#E85D2F] uppercase tracking-wide">Luogo raggiunto</p>
              <p className="text-base font-extrabold text-white mt-0.5">{pin.name}</p>
            </div>
          </div>
          <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-5 text-center">
            <div className="flex justify-center mb-3">
              <GiDeathSkull size={56} color="#FF5A45" style={{ filter: 'drop-shadow(0 0 16px rgba(232,93,47,0.6))' }} />
            </div>
            <p className="wc-display text-white font-extrabold text-lg">Capo Palestra</p>
            <p className="text-red-300/70 text-sm mt-1">Un boss ti sfida in battaglia!</p>
            <p className="text-white/35 text-xs mt-2">Sei pronto ad affrontarlo?</p>
          </div>
          {claimError && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/25 rounded-xl px-3 py-2 text-center">
              ⚠ {claimError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onLater}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white/60 transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Più tardi
            </button>
            <button
              onClick={handleFight}
              disabled={claiming}
              className="flex-[2] py-3.5 rounded-xl font-extrabold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)',
                boxShadow: '0 4px 20px rgba(232,93,47,0.4)',
              }}
            >
              {claiming ? 'Avvio...' : <span className="inline-flex items-center gap-1.5"><GiCrossedSwords size={16} color="#fff" /> Affronta ora!</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
