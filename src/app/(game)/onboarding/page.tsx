'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [gpsAttempted, setGpsAttempted] = useState(false)

  function requestGps() {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      setGpsAttempted(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsStatus('success')
        setGpsAttempted(true)
      },
      () => {
        setGpsStatus('error')
        setGpsAttempted(true)
      }
    )
  }

  return (
    <main className="min-h-screen bg-[#0F1F2E] flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-3xl font-bold mb-2 text-center">Benvenuto in WildCatch! 🌿</h1>
      <p className="text-[#3A9DBC] text-sm text-center mb-8 max-w-xs">
        Un&apos;avventura outdoor dove catturerai creature rare usando la tua posizione GPS.
      </p>

      <div className="w-full max-w-sm space-y-4 mb-8">
        <div className="bg-white/10 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">📍</span>
          <div>
            <h2 className="font-semibold text-white">Esplora l&apos;area</h2>
            <p className="text-white/60 text-sm">Muoviti fisicamente per incontrare creature selvatiche</p>
          </div>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h2 className="font-semibold text-white">Cattura e combatti</h2>
            <p className="text-white/60 text-sm">Cattura creature rare e sfida altri giocatori in duelli PvP</p>
          </div>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <h2 className="font-semibold text-white">Scala la classifica</h2>
            <p className="text-white/60 text-sm">Completa missioni e guadagna punti per vincere</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={requestGps}
          disabled={gpsAttempted}
          className="w-full bg-[#1E3A5F] border border-[#3A9DBC] text-[#3A9DBC] font-semibold py-3 rounded-xl disabled:opacity-60"
        >
          📍 Attiva GPS
        </button>

        {gpsStatus === 'success' && (
          <p className="text-green-400 text-sm text-center">✅ GPS attivo!</p>
        )}
        {gpsStatus === 'error' && (
          <p className="text-yellow-400 text-sm text-center">⚠️ GPS non disponibile. Puoi continuare senza.</p>
        )}

        <button
          onClick={() => router.push('/game')}
          disabled={!gpsAttempted}
          className="w-full bg-[#E85D2F] text-white font-bold py-4 rounded-xl disabled:opacity-50"
        >
          Inizia l&apos;avventura!
        </button>
      </div>
    </main>
  )
}
