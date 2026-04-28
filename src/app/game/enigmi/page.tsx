'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EnigmaDifficulty } from '@/lib/types'

const DIFFICULTY_COLOR: Record<EnigmaDifficulty, string> = {
  facile: '#34D399',
  medio: '#FBBF24',
  difficile: '#EF4444',
}
const DIFFICULTY_LABEL: Record<EnigmaDifficulty, string> = {
  facile: 'Facile',
  medio: 'Medio',
  difficile: 'Difficile',
}

interface EnigmaFrammentoView {
  id: string
  enigma_id: string
  order_index: number
  collected: boolean
  title: string | null
  description: string | null
  image_url: string | null
  video_url: string | null
}

interface EnigmaSuggerimentoView {
  id: string
  enigma_id: string
  order_index: number
  collected: boolean
  text: string | null
  image_url: string | null
}

interface EnigmaView {
  id: string
  session_id: string | null
  title: string
  description: string | null
  difficulty: EnigmaDifficulty
  reward_type: string | null
  frammenti: EnigmaFrammentoView[]
  suggerimenti: EnigmaSuggerimentoView[]
  frammenti_collected: number
  frammenti_total: number
  suggerimenti_collected: number
  suggerimenti_total: number
}

function getVideoEmbed(url: string): { type: 'iframe'; src: string } | { type: 'video'; src: string } | null {
  try {
    const u = new URL(url)
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.searchParams.get('v')) {
      return { type: 'iframe', src: `https://www.youtube.com/embed/${u.searchParams.get('v')}` }
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0]
      return { type: 'iframe', src: `https://www.youtube.com/embed/${id}` }
    }
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
      return { type: 'video', src: url }
    }
    return { type: 'iframe', src: url }
  } catch {
    return null
  }
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  if (max === 0) return null
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  )
}

function FrammentoCard({ frammento, index }: { frammento: EnigmaFrammentoView; index: number }) {
  const [expanded, setExpanded] = useState(false)

  if (!frammento.collected) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/8">
        <span className="text-xl opacity-30">🧩</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/30">Frammento {index + 1}</p>
          <p className="text-[11px] text-white/20">Non ancora trovato</p>
        </div>
        <span className="text-xs text-white/20">🔒</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#7B4DB8]/40 overflow-hidden" style={{ background: 'rgba(74,29,122,0.2)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-xl">🧩</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[#C084FC] truncate">{frammento.title}</p>
          {frammento.description && (
            <p className="text-[11px] text-white/50 truncate">{frammento.description}</p>
          )}
        </div>
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-[#C084FC]/60 text-sm shrink-0"
        >›</motion.span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-[#7B4DB8]/20 pt-2">
              {frammento.description && (
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{frammento.description}</p>
              )}
              {frammento.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={frammento.image_url}
                  alt="Frammento"
                  className="w-full rounded-xl object-cover max-h-48 cursor-zoom-in"
                  onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: frammento.image_url }))}
                />
              )}
              {frammento.video_url && (() => {
                const embed = getVideoEmbed(frammento.video_url)
                if (!embed) return null
                return (
                  <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    {embed.type === 'iframe' ? (
                      <iframe src={embed.src} className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen />
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
    </div>
  )
}

function SuggerimentoCard({ suggerimento, index }: { suggerimento: EnigmaSuggerimentoView; index: number }) {
  const [expanded, setExpanded] = useState(false)

  if (!suggerimento.collected) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/8">
        <span className="text-xl opacity-30">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/30">Suggerimento {index + 1}</p>
          <p className="text-[11px] text-white/20">Non ancora trovato</p>
        </div>
        <span className="text-xs text-white/20">🔒</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#3A9DBC]/40 overflow-hidden" style={{ background: 'rgba(58,157,188,0.1)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-xl">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[#38BDF8] truncate">{suggerimento.text}</p>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-[#38BDF8]/60 text-sm shrink-0"
        >›</motion.span>
      </button>

      <AnimatePresence>
        {expanded && suggerimento.image_url && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-[#3A9DBC]/20 pt-2 space-y-2">
              <p className="text-sm text-white/70 leading-relaxed">{suggerimento.text}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={suggerimento.image_url}
                alt="Suggerimento"
                className="w-full rounded-xl object-cover max-h-48 cursor-zoom-in"
                onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: suggerimento.image_url }))}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EnigmaCard({ enigma }: { enigma: EnigmaView }) {
  const [open, setOpen] = useState(false)
  const diffColor = DIFFICULTY_COLOR[enigma.difficulty]
  const hasActivity = enigma.frammenti_collected > 0 || enigma.suggerimenti_collected > 0
  const isGlobal = !enigma.session_id

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: hasActivity ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
        background: hasActivity ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Card header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-white text-sm">{enigma.title}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
              style={{ backgroundColor: diffColor + '22', color: diffColor }}
            >
              {DIFFICULTY_LABEL[enigma.difficulty]}
            </span>
            {isGlobal && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 bg-[#7B4DB8]/20 text-[#C084FC]">
                🌍 Globale
              </span>
            )}
          </div>
          {enigma.description && (
            <p className="text-xs text-white/40 leading-snug mb-2 line-clamp-2">{enigma.description}</p>
          )}
          {/* Progress row */}
          <div className="flex items-center gap-4">
            {enigma.frammenti_total > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] text-white/40 shrink-0">🧩 {enigma.frammenti_collected}/{enigma.frammenti_total}</span>
                <div className="w-16">
                  <ProgressBar value={enigma.frammenti_collected} max={enigma.frammenti_total} color="#C084FC" />
                </div>
              </div>
            )}
            {enigma.suggerimenti_total > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] text-white/40 shrink-0">💡 {enigma.suggerimenti_collected}/{enigma.suggerimenti_total}</span>
                <div className="w-16">
                  <ProgressBar value={enigma.suggerimenti_collected} max={enigma.suggerimenti_total} color="#38BDF8" />
                </div>
              </div>
            )}
            {enigma.frammenti_total === 0 && enigma.suggerimenti_total === 0 && (
              <span className="text-[11px] text-white/25">Nessun indizio configurato</span>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-white/40 text-lg shrink-0 mt-0.5"
        >›</motion.span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/8 pt-3">

              {/* Frammenti */}
              {enigma.frammenti_total > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    🧩 Frammenti ({enigma.frammenti_collected}/{enigma.frammenti_total})
                  </p>
                  <p className="text-[11px] text-white/25 -mt-1">
                    Si ottengono catturando le creature associate
                  </p>
                  <div className="space-y-1.5">
                    {enigma.frammenti.map((f, i) => (
                      <FrammentoCard key={f.id} frammento={f} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggerimenti */}
              {enigma.suggerimenti_total > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    💡 Suggerimenti ({enigma.suggerimenti_collected}/{enigma.suggerimenti_total})
                  </p>
                  <p className="text-[11px] text-white/25 -mt-1">
                    Si ottengono scansionando QR code o riscattando pin sulla mappa
                  </p>
                  <div className="space-y-1.5">
                    {enigma.suggerimenti.map((s, i) => (
                      <SuggerimentoCard key={s.id} suggerimento={s} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {enigma.frammenti_total === 0 && enigma.suggerimenti_total === 0 && (
                <p className="text-xs text-white/25 text-center py-2">
                  Nessun frammento o suggerimento associato a questo enigma.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function EnigmiPage() {
  const [enigmi, setEnigmi] = useState<EnigmaView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }

    fetch(`/api/game/enigmi?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => { setEnigmi(d.enigmi ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const collectedCount = enigmi.reduce(
    (acc, e) => acc + e.frammenti_collected + e.suggerimenti_collected,
    0,
  )

  return (
    <div className="h-full overflow-y-auto bg-[#0F1F2E]">
      <div className="max-w-lg mx-auto px-4 py-4 pb-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-black text-white mb-0.5">🧩 Enigmi</h1>
          {!loading && enigmi.length > 0 && (
            <p className="text-sm text-white/40">
              {enigmi.length} {enigmi.length === 1 ? 'enigma' : 'enigmi'} · {collectedCount} indizi raccolti
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : enigmi.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 mt-16 text-white/30">
            <span className="text-6xl">🧩</span>
            <p className="text-sm text-center">
              Nessun enigma disponibile in questa sessione.<br />
              Esplora la mappa per scoprire misteri!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enigmi.map(enigma => (
              <EnigmaCard key={enigma.id} enigma={enigma} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
