'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PermStatus = 'idle' | 'granted' | 'denied' | 'unavailable'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function PermissionInstructions({ type }: { type: 'gps' | 'camera' }) {
  const ios = isIOS()
  const label = type === 'gps' ? 'Posizione' : 'Fotocamera'
  return (
    <div className="mt-3 rounded-2xl p-4 text-xs space-y-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <p className="font-bold text-red-400">Come riabilitare {label.toLowerCase()}:</p>
      {ios ? (
        <ol className="text-white/60 space-y-1 list-decimal list-inside">
          <li>Apri <strong className="text-white/80">Impostazioni</strong> del telefono</li>
          <li>Vai su <strong className="text-white/80">Privacy e sicurezza → {label}</strong></li>
          <li>Trova <strong className="text-white/80">Safari</strong> (o Chrome) e imposta su <strong className="text-white/80">Consenti</strong></li>
          <li>Torna qui e ricarica la pagina</li>
        </ol>
      ) : (
        <ol className="text-white/60 space-y-1 list-decimal list-inside">
          <li>Tocca l'icona 🔒 nella barra degli indirizzi</li>
          <li>Seleziona <strong className="text-white/80">Autorizzazioni sito</strong></li>
          <li>Imposta <strong className="text-white/80">{label}</strong> su <strong className="text-white/80">Consenti</strong></li>
          <li>Ricarica la pagina</li>
        </ol>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [gpsStatus,  setGpsStatus]  = useState<PermStatus>('idle')
  const [camStatus,  setCamStatus]  = useState<PermStatus>('idle')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [camLoading, setCamLoading] = useState(false)

  async function requestGps() {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      () => { setGpsStatus('granted'); setGpsLoading(false) },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'unavailable')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  async function requestCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setCamStatus('unavailable'); return }
    setCamLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      stream.getTracks().forEach(t => t.stop())
      setCamStatus('granted')
    } catch (e: any) {
      setCamStatus(e.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    }
    setCamLoading(false)
  }

  const canProceed = gpsStatus === 'granted' || gpsStatus === 'denied' || gpsStatus === 'unavailable'

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-5 pt-10 pb-8 text-white"
      style={{ background: 'linear-gradient(160deg, #060C18 0%, #0A1628 60%, #0D0305 100%)' }}>

      {/* Logo / title */}
      <div className="mb-8 text-center">
        <div className="text-6xl mb-4">🌿</div>
        <h1 className="text-3xl font-black tracking-tight mb-1">Daimon</h1>
        <p className="text-white/45 text-sm">Un'avventura outdoor nel mondo reale</p>
      </div>

      {/* Features strip */}
      <div className="w-full max-w-sm grid grid-cols-3 gap-2 mb-8">
        {[
          { icon: '📍', label: 'Esplora' },
          { icon: '⚔️', label: 'Combatti' },
          { icon: '🏆', label: 'Vinci' },
        ].map(f => (
          <div key={f.label} className="rounded-2xl py-3 flex flex-col items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-2xl">{f.icon}</span>
            <span className="text-[11px] text-white/50 font-semibold">{f.label}</span>
          </div>
        ))}
      </div>

      {/* Permission cards */}
      <div className="w-full max-w-sm space-y-3 mb-6">

        {/* ── CRITICAL warning ── */}
        <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span className="text-xl mt-0.5">⚠️</span>
          <p className="text-sm text-red-300 leading-snug">
            <strong>GPS e fotocamera sono indispensabili.</strong> Senza di essi non potrai incontrare creature, scansionare QR code o completare missioni.
          </p>
        </div>

        {/* GPS card */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: 'rgba(58,157,188,0.15)', border: '1px solid rgba(58,157,188,0.3)' }}>📍</div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">Posizione GPS</p>
              <p className="text-white/45 text-xs mt-0.5 leading-snug">
                Serve per mostrarti la mappa, far apparire le creature vicino a te e registrare la distanza percorsa nelle missioni.
              </p>
            </div>
          </div>

          {gpsStatus === 'idle' ? (
            <button onClick={requestGps} disabled={gpsLoading}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'rgba(58,157,188,0.2)', border: '1px solid rgba(58,157,188,0.5)', color: '#3A9DBC' }}>
              {gpsLoading ? '...' : '📍 Consenti posizione'}
            </button>
          ) : gpsStatus === 'granted' ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
              <span>✅</span> GPS attivo — ottimo!
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                <span>❌</span> {gpsStatus === 'denied' ? 'Permesso negato' : 'GPS non disponibile'}
              </div>
              {gpsStatus === 'denied' && <PermissionInstructions type="gps" />}
            </>
          )}
        </div>

        {/* Camera card */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>📷</div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">Fotocamera</p>
              <p className="text-white/45 text-xs mt-0.5 leading-snug">
                Serve per scansionare i QR code dei Capi Palestra e delle missioni speciali. Senza non puoi sbloccare questi contenuti.
              </p>
            </div>
          </div>

          {camStatus === 'idle' ? (
            <button onClick={requestCamera} disabled={camLoading}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)', color: '#34D399' }}>
              {camLoading ? '...' : '📷 Consenti fotocamera'}
            </button>
          ) : camStatus === 'granted' ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
              <span>✅</span> Fotocamera attiva — ottimo!
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                <span>❌</span> {camStatus === 'denied' ? 'Permesso negato' : 'Fotocamera non disponibile'}
              </div>
              {camStatus === 'denied' && <PermissionInstructions type="camera" />}
            </>
          )}
        </div>
      </div>

      {/* Proceed button */}
      <div className="w-full max-w-sm">
        {!canProceed ? (
          <p className="text-center text-white/30 text-xs mb-3">Concedi almeno il GPS per continuare</p>
        ) : (gpsStatus === 'denied' || gpsStatus === 'unavailable') ? (
          <p className="text-center text-red-400/70 text-xs mb-3">
            ⚠️ Senza GPS il gioco sarà molto limitato
          </p>
        ) : null}

        <button
          onClick={() => router.push('/game')}
          disabled={!canProceed}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canProceed
              ? 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)'
              : 'rgba(255,255,255,0.08)',
            boxShadow: canProceed ? '0 4px 24px rgba(232,93,47,0.4)' : 'none',
          }}
        >
          {canProceed ? 'Inizia l\'avventura! 🌿' : 'Concedi il GPS per continuare'}
        </button>
      </div>
    </main>
  )
}
