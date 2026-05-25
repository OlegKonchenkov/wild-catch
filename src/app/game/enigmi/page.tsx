'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EnigmaDifficulty } from '@/lib/types'
import EnigmaSolvedModal from '@/components/game/EnigmaSolvedModal'
import MissionRewardModal, { type CompletedMissionInfo } from '@/components/game/MissionRewardModal'
import TutorialMomentModal from '@/components/game/TutorialMomentModal'
import {
  TUTORIAL_MISSION_MOMENTS,
  TUTORIAL_SESSION_ID,
} from '@/lib/game/tutorial'
import type { TutorialMoment } from '@/lib/game/tutorial'
import {
  GiPuzzle, GiJigsawPiece, GiLightBulb, GiPadlock, GiCheckMark, GiWorld, GiScrollUnfurled, GiKey,
} from 'react-icons/gi'

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
  solved: boolean
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
        <GiJigsawPiece size={20} color="rgba(255,255,255,0.28)" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/30">Frammento {index + 1}</p>
          <p className="text-[11px] text-white/20">Non ancora trovato</p>
        </div>
        <GiPadlock size={13} color="rgba(255,255,255,0.25)" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#7B4DB8]/40 overflow-hidden" style={{ background: 'rgba(74,29,122,0.2)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <GiJigsawPiece size={20} color="#C084FC" style={{ flexShrink: 0, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }} />
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
        <GiLightBulb size={20} color="rgba(255,255,255,0.28)" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/30">Suggerimento {index + 1}</p>
          <p className="text-[11px] text-white/20">Non ancora trovato</p>
        </div>
        <GiPadlock size={13} color="rgba(255,255,255,0.25)" />
      </div>
    )
  }

  const isLong = suggerimento.text !== null && suggerimento.text.length > 60
  const hasMore = isLong || !!suggerimento.image_url

  return (
    <div className="rounded-xl border border-[#3A9DBC]/40 overflow-hidden" style={{ background: 'rgba(58,157,188,0.1)' }}>
      <button
        onClick={() => hasMore && setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${hasMore ? '' : 'cursor-default'}`}
      >
        <GiLightBulb size={20} color="#38BDF8" style={{ flexShrink: 0, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold text-[#38BDF8] ${hasMore ? 'truncate' : 'whitespace-pre-wrap break-words'}`}>
            {suggerimento.text}
          </p>
        </div>
        {hasMore && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="text-[#38BDF8]/60 text-sm shrink-0"
          >›</motion.span>
        )}
      </button>

      <AnimatePresence>
        {expanded && hasMore && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-[#3A9DBC]/20 pt-2 space-y-2">
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{suggerimento.text}</p>
              {suggerimento.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={suggerimento.image_url}
                  alt="Suggerimento"
                  className="w-full rounded-xl object-cover max-h-48 cursor-zoom-in"
                  onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: suggerimento.image_url }))}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface SolveSuccess {
  enigmaTitle: string
  solution: string
  reward?: { gold?: number; exp?: number }
  completedMissions: CompletedMissionInfo[]
  fresh: boolean                      // false when the API reports alreadySolved
}

function SolvePanel({ enigma, onCorrect }: {
  enigma: EnigmaView
  onCorrect: (s: SolveSuccess) => void
}) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ko'; msg: string } | null>(null)

  async function submit() {
    if (!answer.trim() || submitting) return
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) {
      setFeedback({ kind: 'ko', msg: 'Sessione non trovata' })
      return
    }
    setSubmitting(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/game/enigmi/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enigmaId: enigma.id, sessionId, answer }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ kind: 'ko', msg: data.error ?? 'Errore' })
      } else if (data.correct) {
        // Surface the rich success to the parent so it can render a full
        // celebration modal + chain on into mission rewards + tutorial
        // closing moments. We pass the player's own answer back as the
        // displayed solution — the server deliberately never reveals it
        // for wrong attempts, but here it MUST be correct so echoing the
        // input is safe.
        if (data.correct && !data.alreadySolved) {
          window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
        }
        onCorrect({
          enigmaTitle: enigma.title,
          solution: answer.trim(),
          reward: data.reward,
          completedMissions: Array.isArray(data.completedMissions) ? data.completedMissions : [],
          fresh: !data.alreadySolved,
        })
      } else {
        setFeedback({ kind: 'ko', msg: 'Risposta errata — riprova.' })
      }
    } catch {
      setFeedback({ kind: 'ko', msg: 'Errore di rete' })
    } finally {
      setSubmitting(false)
    }
  }

  if (enigma.solved) {
    return (
      <div className="rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 px-3 py-2.5 flex items-center gap-2">
        <GiCheckMark size={17} color="#34D399" />
        <p className="text-sm font-bold text-[#34D399]">Enigma risolto</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
      <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider inline-flex items-center gap-1.5">
        <GiKey size={13} color="#46BAD8" /> La tua risposta
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Scrivi la soluzione…"
          disabled={submitting}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 min-w-0 rounded-lg bg-[#0A1520] border border-white/15 px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#3A9DBC]"
        />
        <button
          onClick={submit}
          disabled={submitting || !answer.trim()}
          className="shrink-0 rounded-lg bg-[#3A9DBC] disabled:bg-white/10 px-3 py-2 text-sm font-bold text-white disabled:text-white/30 transition-colors"
        >
          {submitting ? '…' : 'Invia'}
        </button>
      </div>
      {feedback && (
        <p className="text-xs font-semibold" style={{ color: '#F87171' }}>
          {feedback.msg}
        </p>
      )}
    </div>
  )
}

function EnigmaCard({ enigma, onCorrect }: { enigma: EnigmaView; onCorrect: (s: SolveSuccess) => void }) {
  const [open, setOpen] = useState(false)
  const diffColor = DIFFICULTY_COLOR[enigma.difficulty]
  const isGlobal = !enigma.session_id

  return (
    <div
      className="overflow-hidden wc-panel"
      style={{
        borderRadius: 18,
        borderLeft: `3px solid ${enigma.solved ? '#44d08a' : diffColor}`,
      }}
    >
      {/* Card header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="wc-display font-bold text-white text-[15px]">{enigma.title}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
              style={{ backgroundColor: diffColor + '22', color: diffColor }}
            >
              {DIFFICULTY_LABEL[enigma.difficulty]}
            </span>
            {enigma.solved && (
              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold shrink-0 bg-[#34D399]/20 text-[#34D399]">
                <GiCheckMark size={10} /> Risolto
              </span>
            )}
            {isGlobal && (
              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold shrink-0 bg-[#7B4DB8]/20 text-[#C084FC]">
                <GiWorld size={10} /> Globale
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
                <span className="text-[11px] shrink-0 inline-flex items-center gap-1" style={{ color: '#C084FC' }}><GiJigsawPiece size={12} /> {enigma.frammenti_collected}/{enigma.frammenti_total}</span>
                <div className="w-16">
                  <ProgressBar value={enigma.frammenti_collected} max={enigma.frammenti_total} color="#C084FC" />
                </div>
              </div>
            )}
            {enigma.suggerimenti_total > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] shrink-0 inline-flex items-center gap-1" style={{ color: '#38BDF8' }}><GiLightBulb size={12} /> {enigma.suggerimenti_collected}/{enigma.suggerimenti_total}</span>
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

              {/* Full enigma description — collapsed header truncates to
                  2 lines so the card stays compact; reveal the full text
                  here in a parchment-style quote so the player can
                  actually read the riddle when they need to solve it. */}
              {enigma.description && (
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p className="text-[10px] font-bold tracking-widest uppercase text-white/35 mb-1 inline-flex items-center gap-1.5"><GiScrollUnfurled size={13} color="#C0A0F0" /> Enigma</p>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {enigma.description}
                  </p>
                </div>
              )}

              {/* Frammenti */}
              {enigma.frammenti_total > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <GiJigsawPiece size={13} color="#C084FC" /> Frammenti ({enigma.frammenti_collected}/{enigma.frammenti_total})
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
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <GiLightBulb size={13} color="#38BDF8" /> Suggerimenti ({enigma.suggerimenti_collected}/{enigma.suggerimenti_total})
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

              {/* Solve panel — always present so the player can guess even
                  before all indizi are collected. */}
              <SolvePanel enigma={enigma} onCorrect={onCorrect} />
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

  // Three-stage celebration chain when a player solves an enigma:
  //   1. EnigmaSolvedModal     — the enigma's own confetti + answer reveal
  //   2. MissionRewardModal    — any mission rows the solve completed
  //   3. TutorialMomentModal   — only for the tutorial closing M8 mission
  // Each stage hands off via state transitions so only one modal is on
  // screen at a time. Mid-chain navigation away just drops the rest.
  const [solveCelebration, setSolveCelebration] = useState<SolveSuccess | null>(null)
  const [pendingMissionRewards, setPendingMissionRewards] = useState<CompletedMissionInfo[]>([])
  const [pendingTutorialMoment, setPendingTutorialMoment] = useState<TutorialMoment | null>(null)

  const reload = () => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }

    fetch(`/api/game/enigmi?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => { setEnigmi(d.enigmi ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  function handleSolveCorrect(s: SolveSuccess) {
    setSolveCelebration(s)
    reload()
  }

  function closeSolveCelebration() {
    const missions = solveCelebration?.completedMissions ?? []
    setSolveCelebration(null)
    if (missions.length > 0) setPendingMissionRewards(missions)
  }

  function closeMissionRewards() {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('current_session_id') : null
    const isTutorial = sessionId === TUTORIAL_SESSION_ID
    if (isTutorial) {
      // If any of the just-completed missions has a tutorial moment defined
      // (M8 → tutorial-complete), surface it as the final stage. We don't
      // dedup against the moments-seen flag here: solving the tutorial
      // enigma is THE finale and should always show, even on replays.
      for (const m of pendingMissionRewards) {
        if (!m.missionId) continue
        const moment = TUTORIAL_MISSION_MOMENTS[m.missionId]
        if (moment) {
          setPendingTutorialMoment(moment)
          break
        }
      }
    }
    setPendingMissionRewards([])
  }

  const collectedCount = enigmi.reduce(
    (acc, e) => acc + e.frammenti_collected + e.suggerimenti_collected,
    0,
  )

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'radial-gradient(120% 70% at 50% 0%, #1c2545 0%, #0e1626 45%, #070d17 100%)' }}>
      <div className="max-w-lg mx-auto px-4 py-4 pb-6">
        {/* Header */}
        <div className="relative mb-5 pb-3">
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(176,108,240,0.45), transparent)' }} />
          <h1 className="flex items-center gap-2 mb-0.5">
            <GiPuzzle size={26} color="#B06CF0" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />
            <span className="wc-display wc-gold-text" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.02em' }}>Enigmi</span>
          </h1>
          {!loading && enigmi.length > 0 && (
            <p className="text-sm text-white/45">
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
          <div className="flex flex-col items-center justify-center gap-3 mt-14 text-white/30">
            {/* Friendly Daimon (same launcher/splash art) instead of a
                lone emoji — navy tile edge feathered into the page bg.
                Reuses the existing icon asset, zero added weight. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-512.png"
              alt=""
              style={{
                width: 132, height: 132, objectFit: 'contain', opacity: 0.85,
                WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 58%, transparent 76%)',
                maskImage: 'radial-gradient(circle at 50% 50%, #000 58%, transparent 76%)',
                filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.4))',
              }}
            />
            <p className="text-sm text-center -mt-1">
              Nessun enigma disponibile in questa sessione.<br />
              Esplora la mappa per scoprire misteri!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enigmi.map(enigma => (
              <EnigmaCard key={enigma.id} enigma={enigma} onCorrect={handleSolveCorrect} />
            ))}
          </div>
        )}
      </div>

      {/* Solve celebration chain — order matters: only one renders at a time */}
      {solveCelebration && (
        <EnigmaSolvedModal
          enigmaTitle={solveCelebration.enigmaTitle}
          solution={solveCelebration.solution}
          reward={solveCelebration.reward}
          fresh={solveCelebration.fresh}
          onClose={closeSolveCelebration}
        />
      )}
      {!solveCelebration && pendingMissionRewards.length > 0 && (
        <MissionRewardModal
          missions={pendingMissionRewards}
          onDone={closeMissionRewards}
        />
      )}
      {!solveCelebration && pendingMissionRewards.length === 0 && pendingTutorialMoment && (
        <TutorialMomentModal
          moment={pendingTutorialMoment}
          onClose={() => setPendingTutorialMoment(null)}
        />
      )}
    </div>
  )
}
