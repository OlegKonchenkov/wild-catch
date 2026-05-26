'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiPadlock, GiPadlockOpen, GiPuzzle, GiLightBulb, GiKey } from 'react-icons/gi'
import { playEnigmaSolve } from '@/lib/game/sounds/enigma'
import type { MapPin } from '@/components/map/GameMap'
import type { PinRewardData } from '@/components/game/PinRewardModal'

function FrammentoEnigmaCard({ frammento }: {
  frammento: { id: string; title: string | null; description: string | null; image_url: string | null; video_url: string | null; order_index: number; player_has: boolean }
}) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = frammento.player_has && (frammento.description || frammento.image_url || frammento.video_url)

  if (!frammento.player_has) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', opacity: 0.45 }}
      >
        <GiPadlock size={16} color="rgba(255,255,255,0.5)" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-white/60">— frammento mancante —</p>
          <p className="text-[10px] text-white/35 mt-0.5">Trova la creatura per sbloccare</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(74,29,122,0.18)', border: '1px solid rgba(124,58,237,0.35)' }}
    >
      <button
        onClick={() => hasContent && setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${hasContent ? '' : 'cursor-default'}`}
      >
        <GiPuzzle size={17} color="#C084FC" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white leading-tight truncate">{frammento.title}</p>
          {frammento.description && !expanded && (
            <p className="text-[11px] text-white/50 truncate mt-0.5">{frammento.description}</p>
          )}
        </div>
        {hasContent && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="text-[#C084FC]/70 text-sm shrink-0"
          >›</motion.span>
        )}
      </button>

      <AnimatePresence>
        {expanded && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-2 space-y-2"
              style={{ borderTop: '1px solid rgba(124,58,237,0.2)' }}
            >
              {frammento.description && (
                <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{frammento.description}</p>
              )}
              {frammento.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={frammento.image_url}
                  alt="Frammento"
                  className="w-full rounded-xl object-cover max-h-40 cursor-zoom-in"
                  onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: frammento.image_url }))}
                />
              )}
              {frammento.video_url && (() => {
                try {
                  const u = new URL(frammento.video_url)
                  let src = frammento.video_url
                  if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.searchParams.get('v')) {
                    src = `https://www.youtube.com/embed/${u.searchParams.get('v')}`
                  } else if (u.hostname === 'youtu.be') {
                    src = `https://www.youtube.com/embed/${u.pathname.slice(1)}`
                  }
                  return (
                    <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                      <iframe src={src} className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen />
                    </div>
                  )
                } catch { return null }
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Shown when the player taps or enters range of an enigma pin.
// Supports both new-format pins (enigma_id → frammenti/suggerimenti) and
// old-format pins (inline question/image_url in reward_payload).
export default function EnigmaModal({
  pin,
  sessionId,
  playerPos,
  onSuccess,
  onClose,
}: {
  pin: MapPin
  sessionId: string
  playerPos: { lat: number; lng: number } | null
  onSuccess: (reward: PinRewardData) => void
  onClose: () => void
}) {
  const [visible, setVisible]       = useState(false)
  const [solution, setSolution]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [shaking, setShaking]       = useState(false)
  const [solvedData, setSolvedData] = useState<PinRewardData | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const payload = (pin as any).reward_payload ?? {}
  const isNewFormat = Array.isArray(payload.frammenti)

  const enigmaTitle: string    = payload.title ?? pin.name
  const enigmaDesc: string | null = payload.description ?? null
  type FrammentoPublic  = { id: string; title: string | null; description: string | null; image_url: string | null; video_url: string | null; order_index: number; player_has: boolean }
  type SuggerimentoPublic = { id: string; text: string | null; image_url: string | null; order_index: number; player_has: boolean }
  const frammenti: FrammentoPublic[]      = payload.frammenti   ?? []
  const suggerimenti: SuggerimentoPublic[] = payload.suggerimenti ?? []

  const question: string       = payload.question  ?? ''
  const imageUrl: string | null = payload.image_url ?? null

  const suggerimentoHas   = suggerimenti.filter(s => s.player_has).length
  const suggerimentoTotal = suggerimenti.length

  async function handleSubmit() {
    if (!solution.trim() || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/game/map-pins/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinId: pin.id, sessionId,
          lat: playerPos?.lat ?? pin.lat, lng: playerPos?.lng ?? pin.lng,
          solution: solution.trim(),
        }),
      })
      const d: any = await res.json()
      if (d.success || d.alreadyClaimed) {
        playEnigmaSolve()
        setSolvedData(d as PinRewardData)
        setTimeout(() => { if (mountedRef.current) onSuccess(d as PinRewardData) }, 2600)
      } else if (d.wrongSolution) {
        setErrorMsg('Soluzione errata, riprova!')
        setShaking(true)
        setTimeout(() => setShaking(false), 600)
        setSubmitting(false)
      } else {
        setErrorMsg(d.error ?? 'Errore')
        setSubmitting(false)
      }
    } catch {
      setErrorMsg('Errore di rete')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-end justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #080C1A 0%, #0B1020 100%)',
          border: '1px solid rgba(247,200,65,0.22)',
          borderBottom: 'none',
          maxHeight: '88vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: 180,
            background: 'radial-gradient(ellipse 70% 100% at 50% -10%, rgba(58,157,188,0.18) 0%, transparent 100%)',
          }}
        />

        <AnimatePresence>
          {solvedData && (
            <motion.div
              key="solved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-t-3xl"
              style={{ background: 'linear-gradient(180deg, #040710 0%, #080C1A 100%)' }}
            >
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.6, 1, 0.7] }}
                transition={{ duration: 2.2, times: [0, 0.2, 0.5, 0.75, 1] }}
                style={{
                  background: 'radial-gradient(ellipse 55% 35% at 50% 46%, rgba(247,200,65,0.28) 0%, transparent 70%)',
                }}
              />

              <div className="absolute" style={{ left: '50%', top: '44%' }}>
                {Array.from({ length: 14 }).map((_, i) => {
                  const angle = (i / 14) * 360
                  const dist  = 65 + (i % 4) * 20
                  const tx = Math.cos((angle * Math.PI) / 180) * dist
                  const ty = Math.sin((angle * Math.PI) / 180) * dist
                  const size = 5 + (i % 3) * 2
                  const colors = ['#F7C841', '#FFF5C0', '#3A9DBC', '#A78BFA']
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                      animate={{ opacity: 0, x: tx, y: ty, scale: 0.2 }}
                      transition={{ duration: 1.1, delay: 0.1 + i * 0.045, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        width: size, height: size,
                        borderRadius: i % 2 === 0 ? '50%' : '2px',
                        background: colors[i % 4],
                        left: -size / 2, top: -size / 2,
                      }}
                    />
                  )
                })}
              </div>

              <motion.div
                initial={{ scale: 0.25, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.08 }}
                className="relative flex items-center justify-center rounded-full mb-5"
                style={{
                  width: 90, height: 90,
                  background: 'radial-gradient(circle, rgba(247,200,65,0.22) 0%, rgba(247,200,65,0.04) 100%)',
                  border: '2px solid rgba(247,200,65,0.55)',
                  boxShadow: '0 0 38px rgba(247,200,65,0.45), 0 0 72px rgba(247,200,65,0.14)',
                }}
              >
                <GiPadlockOpen size={48} color="#F7C841" style={{ filter: 'drop-shadow(0 0 12px rgba(247,200,65,0.6))' }} />
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.42 }}
                className="wc-display text-xl font-extrabold uppercase tracking-widest mb-1.5"
                style={{ color: '#F7C841', textShadow: '0 0 18px rgba(247,200,65,0.65)' }}
              >
                Enigma Risolto!
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.40, duration: 0.40 }}
                className="text-sm text-white/55 text-center px-10"
              >
                {enigmaTitle}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center pt-3 mb-2 relative">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(247,200,65,0.3)' }} />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(88vh - 24px)' }}>
          <div className="px-5 pb-8 space-y-5 pt-1">

            <div
              className="flex items-center gap-3 rounded-2xl p-3"
              style={{ background: 'rgba(247,200,65,0.08)', border: '1px solid rgba(247,200,65,0.2)' }}
            >
              <GiPadlock size={22} color="#F7C841" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#F7C841' }}>
                  Enigma
                </p>
                <p className="text-base font-extrabold text-white leading-tight truncate">
                  {isNewFormat ? enigmaTitle : pin.name}
                </p>
              </div>
            </div>

            {isNewFormat ? (
              <>
                {enigmaDesc && (
                  <p
                    className="text-base leading-relaxed text-white/85 text-center italic"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {enigmaDesc}
                  </p>
                )}

                {frammenti.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Frammenti enigma ({frammenti.filter(f => f.player_has).length}/{frammenti.length})
                    </p>
                    <div className="space-y-2">
                      {frammenti.map(f => (
                        <FrammentoEnigmaCard key={f.id} frammento={f} />
                      ))}
                    </div>
                  </div>
                )}

                {suggerimenti.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Indizi trovati
                      </p>
                      <p className="text-[10px] font-bold" style={{ color: '#3A9DBC' }}>
                        {suggerimentoHas}/{suggerimentoTotal}
                      </p>
                    </div>

                    {suggerimentoTotal > 0 && (
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(suggerimentoHas / suggerimentoTotal) * 100}%`,
                            background: 'linear-gradient(90deg, #3A9DBC 0%, #5BBBD8 100%)',
                            boxShadow: '0 0 8px rgba(58,157,188,0.6)',
                          }}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      {suggerimenti.map(s => (
                        <div
                          key={s.id}
                          className="rounded-xl px-3 py-2.5"
                          style={s.player_has ? {
                            background: 'rgba(124,58,237,0.12)',
                            border: '1px solid rgba(124,58,237,0.3)',
                          } : {
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">{s.player_has ? <GiLightBulb size={15} color="#FBBF24" /> : <GiPadlock size={15} color="rgba(255,255,255,0.4)" />}</span>
                            {s.player_has ? (
                              <div className="flex-1 min-w-0">
                                {s.text && (
                                  <p className="text-sm text-white/80 leading-snug">{s.text}</p>
                                )}
                                {s.image_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={s.image_url}
                                    alt="Indizio"
                                    className="w-full rounded-lg object-cover max-h-32 mt-2 cursor-zoom-in"
                                    onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: s.image_url }))}
                                  />
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-white/25 italic">Indizio ancora nascosto…</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Indizio" className="w-full rounded-2xl object-cover max-h-40" />
                )}
                {question && (
                  <p className="text-sm text-white/80 leading-relaxed">{question}</p>
                )}
              </>
            )}

            <div className="space-y-2">
              <input
                value={solution}
                onChange={e => setSolution(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="Inserisci la soluzione…"
                className="w-full text-white rounded-xl px-4 py-3.5 text-base font-semibold focus:outline-none placeholder:text-white/25 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(247,200,65,0.25)',
                  boxShadow: solution ? '0 0 0 2px rgba(247,200,65,0.2)' : 'none',
                  animation: shaking ? 'enigmaShake 0.55s ease-in-out' : 'none',
                }}
              />
              {errorMsg && (
                <p className="text-xs font-semibold text-red-400 text-center">{errorMsg}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white/50 transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                Più tardi
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !solution.trim()}
                className="flex-[2] py-3.5 rounded-xl font-extrabold text-sm transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #B8860B 0%, #F7C841 50%, #D4A017 100%)',
                  color: '#080C1A',
                  boxShadow: solution.trim() && !submitting
                    ? '0 4px 20px rgba(247,200,65,0.5), 0 0 1px rgba(247,200,65,0.8)'
                    : 'none',
                  letterSpacing: '0.08em',
                }}
              >
                {submitting ? 'Verifica…' : <span className="inline-flex items-center justify-center gap-2"><GiKey size={16} /> RISOLVI ENIGMA</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes enigmaShake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}
