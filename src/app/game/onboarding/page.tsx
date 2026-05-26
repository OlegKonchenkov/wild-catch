'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  GiFootprint, GiCrossedSwords, GiBattleGear, GiSwapBag, GiEggClutch, GiCrown,
  GiMagnifyingGlass, GiPadlock, GiPositionMarker, GiCctvCamera,
} from 'react-icons/gi'
import ElementIcon from '@/components/ui/ElementIcon'
import BgmController from '@/components/BgmController'

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
// Three elemental satellites orbiting the dragon. Each orbits at a different
// radius/speed/phase so the cluster never aligns into a static-looking ring.
function OrbitingElement({ element, radius, duration, delay, phase }: {
  element: string; radius: number; duration: number; delay: number; phase: number
}) {
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 pointer-events-none"
      style={{ marginTop: -16, marginLeft: -16 }}
      animate={{ rotate: [phase, phase + 360] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
    >
      <motion.span
        className="block"
        style={{ transform: `translate(${radius}px, 0)` }}
        animate={{ scale: [1, 1.15, 1], filter: ['drop-shadow(0 0 4px rgba(58,188,168,0.3))', 'drop-shadow(0 0 10px rgba(58,188,168,0.6))', 'drop-shadow(0 0 4px rgba(58,188,168,0.3))'] }}
        transition={{ duration: 2.2, delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ElementIcon element={element} size={30} />
      </motion.span>
    </motion.div>
  )
}

function SlideWelcome() {
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-6 text-center"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } } }}
    >
      <motion.div
        className="relative w-48 h-48 mb-6 flex items-center justify-center"
        variants={{ hidden: { scale: 0.6, opacity: 0 }, show: { scale: 1, opacity: 1 } }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        {/* Outer breathing aura — wider + more contrast for "awakening" feel */}
        <motion.div
          className="absolute -inset-6 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(58,188,168,0.32) 0%, rgba(58,188,168,0.05) 45%, transparent 70%)' }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Inner accent halo */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(247,200,65,0.18) 0%, transparent 60%)' }}
          animate={{ scale: [1.05, 0.95, 1.05], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* The real Daimon guardian — same art as the launcher icon /
            boot splash so the identity is seamless from install → splash
            → onboarding. Square navy tile edge feathered with a radial
            mask so it dissolves into the slide's dark gradient + the
            ambient particles instead of reading as a pasted box. */}
        <motion.img
          src="/icons/icon-512.png"
          alt="Daimon"
          className="relative z-10"
          style={{
            width: 156, height: 156, objectFit: 'contain',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 60%, transparent 78%)',
            maskImage: 'radial-gradient(circle at 50% 50%, #000 60%, transparent 78%)',
            filter: 'drop-shadow(0 6px 22px rgba(0,0,0,0.45))',
          }}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <OrbitingElement element="adriatico" radius={78} duration={7}  delay={0}   phase={0}   />
        <OrbitingElement element="fiamma"    radius={70} duration={8.5} delay={0.3} phase={120} />
        <OrbitingElement element="bosco"     radius={82} duration={9.5} delay={0.6} phase={240} />
      </motion.div>
      <motion.h1
        className="wc-display text-3xl font-black tracking-tight mb-2 text-white"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        Le creature si sono risvegliate
      </motion.h1>
      <motion.p
        className="text-white/55 leading-relaxed max-w-xs"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        I <strong className="text-[#3ABCA8]">Daimon</strong> — antiche creature mitologiche
        del nostro territorio — sono tornate fra noi.
        Solo chi <strong className="text-white/80">cammina</strong> può scoprirli.
      </motion.p>
    </motion.div>
  )
}

function SlideGameLoop() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-xs space-y-3 mb-6">
        {([
          { Icon: GiFootprint,     title: 'Cammina nel territorio', desc: 'Il tuo cellulare ti segue via GPS. Le creature appaiono nelle vicinanze quando ti muovi.' },
          { Icon: GiCrossedSwords, title: 'Affronta e cattura', desc: 'Combatti turno per turno. Indebolisci la creatura per aumentare le chance di cattura.' },
          { Icon: GiBattleGear,    title: 'Costruisci la tua squadra', desc: 'Fino a 3 creature attive. Elementi diversi, status, abilità — la strategia conta.' },
        ] as const).map((step, i) => (
          <motion.div
            key={step.title}
            className="flex items-start gap-3 rounded-2xl p-3 text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(58,188,168,0.12)', border: '1px solid rgba(58,188,168,0.25)' }}
            >
              <step.Icon size={22} color="#5FD0BF" />
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
        className="w-36 h-36 mb-5 rounded-2xl flex items-center justify-center relative overflow-hidden"
        style={{ background: '#0A1421', border: '1px solid rgba(247,200,65,0.3)' }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring' }}
      >
        {/* Arcane sigil art framed as a viewfinder; scanner line +
            corner brackets sit on top to sell the "scan the seal" idea */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/slide-qr.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* Scanner line — slower, more dramatic */}
        <motion.div
          className="absolute inset-x-0 h-1 bg-[#F7C841]/60"
          animate={{ y: [0, 120, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          style={{ boxShadow: '0 0 12px #F7C841' }}
        />
        {/* L-shaped corner brackets that pulse — sells the "viewfinder" idea */}
        {[
          { top: 6,    left: 6,    rot: 0   },
          { top: 6,    right: 6,   rot: 90  },
          { bottom: 6, right: 6,   rot: 180 },
          { bottom: 6, left: 6,    rot: 270 },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 pointer-events-none"
            style={{ ...c, transform: `rotate(${c.rot}deg)` }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 2, background: '#F7C841', boxShadow: '0 0 6px #F7C841' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 14, background: '#F7C841', boxShadow: '0 0 6px #F7C841' }} />
          </motion.div>
        ))}
      </motion.div>
      <h2 className="wc-display text-2xl font-black text-white mb-2">Cerca i QR code</h2>
      <p className="text-white/55 leading-relaxed max-w-xs mb-4">
        In giro per il territorio troverai QR speciali —
        sui banchi, ai punti di interesse, presso i partner dell'evento.
      </p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
        {([
          { Icon: GiSwapBag,        label: 'Oggetti' },
          { Icon: GiEggClutch,      label: 'Uova' },
          { Icon: GiCrown,          label: 'Capi Palestra' },
          { Icon: GiMagnifyingGlass, label: 'Indizi enigmi' },
        ] as const).map(p => (
          <div
            key={p.label}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(247,200,65,0.06)', border: '1px solid rgba(247,200,65,0.2)' }}
          >
            <p.Icon size={18} color="#F7C841" className="shrink-0" />
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
        <span className="flex justify-center mb-2"><GiPadlock size={48} color="#F7C841" style={{ filter: 'drop-shadow(0 0 12px rgba(247,200,65,0.5))' }} /></span>
        <h2 className="wc-display text-xl font-black text-white mb-1">Permessi indispensabili</h2>
        <p className="text-white/45 text-xs max-w-xs">
          Senza GPS o fotocamera non potrai esplorare e scansionare. Tocca per concedere.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* GPS card */}
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-start gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(58,157,188,0.15)', border: '1px solid rgba(58,157,188,0.3)' }}><GiPositionMarker size={18} color="#3A9DBC" /></div>
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}><GiCctvCamera size={18} color="#34D399" /></div>
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

// One-shot confetti burst for the "Sei pronto" celebration. 18 particles
// shoot up in a fan-out, each with random hue from the brand palette.
const CONFETTI_COLORS = ['#3ABCA8', '#F7C841', '#E85D2F', '#34D399', '#7B4DB8']
function ConfettiBurst() {
  const pieces = Array.from({ length: 18 }, (_, i) => {
    const angle = -90 + (i - 8.5) * 8       // fan: -90 ± 70°
    const distance = 90 + Math.random() * 70
    const rad = (angle * Math.PI) / 180
    const dx = Math.cos(rad) * distance
    const dy = Math.sin(rad) * distance
    return {
      i,
      dx, dy,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot: Math.random() * 720 - 360,
      delay: Math.random() * 0.15,
    }
  })
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {pieces.map(p => (
        <motion.span
          key={p.i}
          className="absolute block"
          style={{ width: 6, height: 10, borderRadius: 1, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy + 60, opacity: 0, rotate: p.rot }}
          transition={{ duration: 1.4, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

function SlideReady() {
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-6 text-center relative"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } } }}
    >
      <ConfettiBurst />
      <motion.div
        className="relative mb-6 flex items-center justify-center"
        style={{ width: 188, height: 188 }}
        variants={{ hidden: { scale: 0.5, opacity: 0 }, show: { scale: 1, opacity: 1 } }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      >
        <motion.div
          className="absolute -inset-3 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(58,188,168,0.32) 0%, transparent 66%)' }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* The guardian setting off — same creature identity as the
            launcher / splash / slide 1; navy scene edge feathered into
            the slide gradient with a radial mask. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src="/brand/slide-walk.png"
          alt="Daimon"
          className="relative"
          style={{
            width: 180, height: 180, objectFit: 'contain',
            WebkitMaskImage: 'radial-gradient(circle at 50% 48%, #000 56%, transparent 75%)',
            maskImage: 'radial-gradient(circle at 50% 48%, #000 56%, transparent 75%)',
            filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.45))',
          }}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.h2
        className="text-3xl font-black text-white mb-3"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        Sei pronto.
      </motion.h2>
      <motion.p
        className="text-white/55 leading-relaxed max-w-xs mb-2"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        Inizia a camminare — la mappa farà il resto.
      </motion.p>
      <motion.p
        className="text-white/30 text-xs max-w-xs"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        Puoi rivedere questo tutorial in qualunque momento dalla pagina <strong className="text-white/55">Guida</strong>.
      </motion.p>
    </motion.div>
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
      {/* Background music — scoped to onboarding only. Unmounts on
          navigation away, which stops playback (the BgmController's
          cleanup pauses and clears the <audio> element). */}
      <BgmController />

      {/* Decorative orbs */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 10%, rgba(58,188,168,0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(232,93,47,0.08) 0%, transparent 50%)',
        }}
      />

      {/* Ambient floating particles — deterministic offsets so SSR/CSR
          render the same DOM and React doesn't tear on hydration. The
          loop period and starting y are derived from i to avoid Math.random
          on first render. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => {
          const left = (i * 37) % 100               // pseudo-spread across width
          const startY = 60 + ((i * 53) % 40)        // 60-100% (bottom area)
          const duration = 8 + (i % 4) * 2           // 8-14 s
          const delay = (i * 0.7) % 5
          const size = 4 + (i % 3) * 2               // 4 / 6 / 8 px
          const color = i % 3 === 0 ? '#3ABCA8' : i % 3 === 1 ? '#F7C841' : '#E85D2F'
          return (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                top: `${startY}%`,
                width: size, height: size,
                background: color,
                boxShadow: `0 0 ${size * 2}px ${color}`,
                opacity: 0.35,
              }}
              animate={{
                y: ['0%', '-180%'],
                opacity: [0, 0.5, 0],
                x: [0, (i % 2 === 0 ? 1 : -1) * 24, 0],
              }}
              transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
            />
          )
        })}
      </div>

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
