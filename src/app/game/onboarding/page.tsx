'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'

type PermStatus = 'idle' | 'granted' | 'denied' | 'unavailable'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// ── Tiny helpers reused on the permissions slide ────────────────────────────
function PermissionInstructions({ type }: { type: 'gps' | 'camera' }) {
  const ios = isIOS()
  const label = type === 'gps' ? 'Posizione' : 'Fotocamera'
  return (
    <div className="mt-3 rounded-2xl p-3 text-xs space-y-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <p className="font-bold text-red-400">Come riabilitare {label.toLowerCase()}:</p>
      {ios ? (
        <ol className="text-white/60 space-y-1 list-decimal list-inside">
          <li>Apri <strong className="text-white/80">Impostazioni</strong></li>
          <li><strong className="text-white/80">Privacy → {label} → Safari</strong></li>
          <li>Imposta su <strong className="text-white/80">Consenti</strong> e ricarica</li>
        </ol>
      ) : (
        <ol className="text-white/60 space-y-1 list-decimal list-inside">
          <li>Tocca 🔒 nella barra indirizzi</li>
          <li><strong className="text-white/80">Autorizzazioni sito → {label} → Consenti</strong></li>
          <li>Ricarica la pagina</li>
        </ol>
      )}
    </div>
  )
}

// ── Slide content ───────────────────────────────────────────────────────────
function SlideWelcome() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        className="relative w-44 h-44 mb-6 flex items-center justify-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(58,188,168,0.25) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="text-7xl relative z-10 inline-block"
          animate={{ y: [0, -6, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          🐉
        </motion.span>
        <motion.span
          className="absolute text-3xl"
          style={{ top: 8, left: 16 }}
          animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >🌊</motion.span>
        <motion.span
          className="absolute text-3xl"
          style={{ top: 12, right: 12 }}
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
        >🔥</motion.span>
        <motion.span
          className="absolute text-3xl"
          style={{ bottom: 12, left: 18 }}
          animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: 0.8 }}
        >🌿</motion.span>
      </motion.div>
      <h1 className="text-3xl font-black tracking-tight mb-2 text-white">Le creature si sono risvegliate</h1>
      <p className="text-white/55 leading-relaxed max-w-xs">
        I <strong className="text-[#3ABCA8]">Daimon</strong> — antiche creature mitologiche
        del nostro territorio — sono tornate fra noi.
        Solo chi <strong className="text-white/80">cammina</strong> può scoprirli.
      </p>
    </div>
  )
}

function SlideGameLoop() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-xs space-y-3 mb-6">
        {[
          { icon: '🚶', title: 'Cammina nel territorio', desc: 'Il tuo cellulare ti segue via GPS. Le creature appaiono nelle vicinanze quando ti muovi.' },
          { icon: '⚔️', title: 'Affronta e cattura', desc: 'Combatti turno per turno. Indebolisci la creatura per aumentare le chance di cattura.' },
          { icon: '🛡️', title: 'Costruisci la tua squadra', desc: 'Fino a 3 creature attive. Elementi diversi, status, abilità — la strategia conta.' },
        ].map((step, i) => (
          <motion.div
            key={step.title}
            className="flex items-start gap-3 rounded-2xl p-3 text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: 'rgba(58,188,168,0.12)', border: '1px solid rgba(58,188,168,0.25)' }}
            >
              {step.icon}
            </div>
            <div>
              <p className="font-bold text-white text-sm mb-0.5">{step.title}</p>
              <p className="text-white/50 text-xs leading-snug">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function SlideQRCodes() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        className="w-32 h-32 mb-5 rounded-2xl flex items-center justify-center relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(247,200,65,0.3)' }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring' }}
      >
        <span className="text-7xl">📱</span>
        <motion.div
          className="absolute inset-x-0 h-1 bg-[#F7C841]/60"
          animate={{ y: [0, 120, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          style={{ boxShadow: '0 0 12px #F7C841' }}
        />
      </motion.div>
      <h2 className="text-2xl font-black text-white mb-2">Cerca i QR code</h2>
      <p className="text-white/55 leading-relaxed max-w-xs mb-4">
        In giro per il territorio troverai QR speciali —
        sui banchi, ai punti di interesse, presso i partner dell'evento.
      </p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
        {[
          { icon: '🎁', label: 'Oggetti' },
          { icon: '🥚', label: 'Uova' },
          { icon: '👑', label: 'Capi Palestra' },
          { icon: '🔍', label: 'Indizi enigmi' },
        ].map(p => (
          <div
            key={p.label}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(247,200,65,0.06)', border: '1px solid rgba(247,200,65,0.2)' }}
          >
            <span className="text-lg">{p.icon}</span>
            <span className="text-xs font-semibold text-white/70">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SlidePermissions({
  gpsStatus, camStatus, gpsLoading, camLoading,
  onRequestGps, onRequestCamera,
}: {
  gpsStatus: PermStatus
  camStatus: PermStatus
  gpsLoading: boolean
  camLoading: boolean
  onRequestGps: () => void
  onRequestCamera: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 overflow-y-auto py-4">
      <div className="text-center mb-4">
        <span className="text-5xl block mb-2">🔐</span>
        <h2 className="text-xl font-black text-white mb-1">Permessi indispensabili</h2>
        <p className="text-white/45 text-xs max-w-xs">
          Senza GPS o fotocamera non potrai esplorare e scansionare. Tocca per concedere.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* GPS card */}
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-start gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(58,157,188,0.15)', border: '1px solid rgba(58,157,188,0.3)' }}>📍</div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">Posizione GPS</p>
              <p className="text-white/45 text-xs mt-0.5">Per la mappa e gli incontri.</p>
            </div>
          </div>
          {gpsStatus === 'idle' ? (
            <button onClick={onRequestGps} disabled={gpsLoading}
              className="w-full py-2 rounded-xl font-bold text-sm"
              style={{ background: 'rgba(58,157,188,0.2)', border: '1px solid rgba(58,157,188,0.5)', color: '#3A9DBC' }}>
              {gpsLoading ? '...' : 'Consenti posizione'}
            </button>
          ) : gpsStatus === 'granted' ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-bold">✅ GPS attivo</div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                ❌ {gpsStatus === 'denied' ? 'Permesso negato' : 'Non disponibile'}
              </div>
              {gpsStatus === 'denied' && <PermissionInstructions type="gps" />}
            </>
          )}
        </div>

        {/* Camera card */}
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-start gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>📷</div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">Fotocamera</p>
              <p className="text-white/45 text-xs mt-0.5">Per scansionare i QR code.</p>
            </div>
          </div>
          {camStatus === 'idle' ? (
            <button onClick={onRequestCamera} disabled={camLoading}
              className="w-full py-2 rounded-xl font-bold text-sm"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)', color: '#34D399' }}>
              {camLoading ? '...' : 'Consenti fotocamera'}
            </button>
          ) : camStatus === 'granted' ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-bold">✅ Fotocamera attiva</div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-1">
                ❌ {camStatus === 'denied' ? 'Permesso negato' : 'Non disponibile'}
              </div>
              {camStatus === 'denied' && <PermissionInstructions type="camera" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SlideReady() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        className="text-7xl mb-6"
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      >
        🌿
      </motion.div>
      <h2 className="text-3xl font-black text-white mb-3">Sei pronto.</h2>
      <p className="text-white/55 leading-relaxed max-w-xs mb-2">
        Inizia a camminare — la mappa farà il resto.
      </p>
      <p className="text-white/30 text-xs max-w-xs">
        Puoi rivedere questo tutorial in qualunque momento dalla pagina <strong className="text-white/55">Guida</strong>.
      </p>
    </div>
  )
}

// ── Carousel container ─────────────────────────────────────────────────────
const TOTAL_SLIDES = 5

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') ?? '/game/map'

  const [slide, setSlide] = useState(0)
  const [direction, setDirection] = useState(1)
  const [gpsStatus,  setGpsStatus]  = useState<PermStatus>('idle')
  const [camStatus,  setCamStatus]  = useState<PermStatus>('idle')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [camLoading, setCamLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('current_session_id')
  }, [])

  // ── Probe permissions on mount so we don't ask twice if already granted ──
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const permissions = (navigator as Navigator & { permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions
    if (!permissions?.query) return
    permissions.query({ name: 'geolocation' as PermissionName }).then(r => {
      if (r.state === 'granted') setGpsStatus('granted')
      else if (r.state === 'denied') setGpsStatus('denied')
    }).catch(() => {})
    permissions.query({ name: 'camera' as PermissionName }).then(r => {
      if (r.state === 'granted') setCamStatus('granted')
      else if (r.state === 'denied') setCamStatus('denied')
    }).catch(() => {})
  }, [])

  function requestGps() {
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
    } catch (e) {
      const name = (e as { name?: string })?.name
      setCamStatus(name === 'NotAllowedError' ? 'denied' : 'unavailable')
    }
    setCamLoading(false)
  }

  // ── Finalize: mark onboarding_seen and navigate to the game ──────────────
  async function finish(skipped: boolean) {
    if (submitting) return
    setSubmitting(true)
    if (sessionId) {
      try {
        await fetch('/api/game/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, seen: true }),
        })
      } catch {
        // Best-effort: don't block navigation on network error. The flag is
        // only an "already-seen" hint; the worst case is we show the intro
        // again next time the user enters this session.
      }
    }
    // skipped is captured for analytics later; route is the same either way.
    void skipped
    router.replace(nextUrl)
  }

  function nextSlide() {
    if (slide >= TOTAL_SLIDES - 1) {
      void finish(false)
      return
    }
    setDirection(1)
    setSlide(s => Math.min(TOTAL_SLIDES - 1, s + 1))
  }
  function prevSlide() {
    if (slide === 0) return
    setDirection(-1)
    setSlide(s => Math.max(0, s - 1))
  }
  function goToSlide(target: number) {
    if (target === slide) return
    setDirection(target > slide ? 1 : -1)
    setSlide(Math.max(0, Math.min(TOTAL_SLIDES - 1, target)))
  }

  // Swipe gesture: trigger nav on > 50px drag.
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -50) nextSlide()
    else if (info.offset.x > 50) prevSlide()
  }

  const isPermissionsSlide = slide === 3
  const permissionsBlocked = isPermissionsSlide && gpsStatus === 'idle'
  const isLast = slide === TOTAL_SLIDES - 1
  const continueLabel = isLast ? 'Inizia l\'avventura' : 'Continua'

  return (
    <main
      // z-[9990] sits above the GameShell header (z-10) AND the bottom nav
      // (which has no explicit z-index but paints in normal flow on top of
      // bare `fixed` elements with z-auto). One under LevelUpModal (z-9999)
      // and the notif popup (z-9990) so nothing critical gets covered if
      // they happen to fire during onboarding.
      className="fixed inset-0 z-[9990] flex flex-col text-white overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #060C18 0%, #0A1628 60%, #0D0305 100%)' }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 10%, rgba(58,188,168,0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(232,93,47,0.08) 0%, transparent 50%)',
        }}
      />

      {/* Header: progress dots + skip */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-6 pb-3">
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className="rounded-full transition-all"
              style={{
                width: i === slide ? 18 : 6,
                height: 6,
                background: i === slide ? '#3ABCA8' : 'rgba(255,255,255,0.18)',
              }}
              aria-label={`Vai a slide ${i + 1}`}
            />
          ))}
        </div>
        {!isLast && (
          <button
            onClick={() => finish(true)}
            disabled={submitting}
            className="text-xs font-semibold text-white/45 hover:text-white/70 px-2 py-1"
          >
            Salta →
          </button>
        )}
      </div>

      {/* Slide stage */}
      <motion.div
        key="stage"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={onDragEnd}
        className="relative flex-1 flex flex-col"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide}
            className="absolute inset-0 flex flex-col"
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          >
            {slide === 0 && <SlideWelcome />}
            {slide === 1 && <SlideGameLoop />}
            {slide === 2 && <SlideQRCodes />}
            {slide === 3 && (
              <SlidePermissions
                gpsStatus={gpsStatus}
                camStatus={camStatus}
                gpsLoading={gpsLoading}
                camLoading={camLoading}
                onRequestGps={requestGps}
                onRequestCamera={requestCamera}
              />
            )}
            {slide === 4 && <SlideReady />}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Bottom action area */}
      <div className="relative z-10 px-5 pb-6 pt-3">
        {isPermissionsSlide && permissionsBlocked && (
          <p className="text-center text-white/30 text-xs mb-3">
            Concedi almeno il GPS per continuare
          </p>
        )}
        {isPermissionsSlide && (gpsStatus === 'denied' || gpsStatus === 'unavailable') && (
          <p className="text-center text-red-400/70 text-xs mb-3">
            ⚠️ Senza GPS il gioco sarà molto limitato — potrai proseguire ma alcune funzioni non saranno disponibili
          </p>
        )}
        <button
          onClick={nextSlide}
          disabled={submitting || permissionsBlocked}
          className="w-full py-3.5 rounded-2xl font-extrabold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isLast
              ? 'linear-gradient(135deg, #E85D2F 0%, #c94a20 100%)'
              : 'linear-gradient(135deg, #3ABCA8 0%, #2d8c7d 100%)',
            boxShadow: isLast
              ? '0 4px 24px rgba(232,93,47,0.4)'
              : '0 4px 20px rgba(58,188,168,0.35)',
          }}
        >
          {submitting ? '...' : continueLabel}
        </button>
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  )
}
