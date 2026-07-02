'use client'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiGreekTemple, GiColumnVase, GiLaurelsTrophy, GiScrollUnfurled, GiTrophyCup } from 'react-icons/gi'
import { GameListSkeleton } from '@/components/game/GameLoading'
import { RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
import type { Rarity } from '@/lib/types'

interface Collectible { id: string; name?: string; title?: string; description?: string; body?: string; image_url: string; rarity: string | null; owned: boolean }
interface Place { id: string; name: string; description: string; image_url: string; artworks: Collectible[]; characters: Collectible[]; anecdotes: Collectible[] }
interface Trophy { id: string; name: string; description: string; image_url: string; owned: boolean }

type Kind = 'opera' | 'personaggio' | 'aneddoto'
const KIND_META: Record<Kind, { Icon: typeof GiColumnVase; label: string; accent: string }> = {
  opera:       { Icon: GiColumnVase,   label: 'Opere',       accent: '#38BDF8' },
  personaggio: { Icon: GiLaurelsTrophy, label: 'Personaggi', accent: '#F59E0B' },
  aneddoto:    { Icon: GiScrollUnfurled, label: 'Aneddoti',   accent: '#A3E635' },
}

function rarityColor(r: string | null) { return r && r in RARITY_COLORS ? RARITY_COLORS[r as Rarity] : '#7AB87A' }

export default function CollezionePage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [orphans, setOrphans] = useState<{ artworks: Collectible[]; characters: Collectible[]; anecdotes: Collectible[] }>({ artworks: [], characters: [], anecdotes: [] })
  const [trophies, setTrophies] = useState<Trophy[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<{ item: Collectible; kind: Kind } | null>(null)

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) { setLoading(false); return }
    fetch(`/api/game/collezione?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.places) setPlaces(d.places)
        if (d.orphans) setOrphans(d.orphans)
        if (d.trophies) setTrophies(d.trophies)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const orphanPlace: Place | null = useMemo(() => {
    const has = orphans.artworks.length || orphans.characters.length || orphans.anecdotes.length
    if (!has) return null
    return { id: '_orphan', name: 'Altre scoperte', description: 'Reperti non ancora legati a un luogo', image_url: '', artworks: orphans.artworks, characters: orphans.characters, anecdotes: orphans.anecdotes }
  }, [orphans])

  const allPlaces = orphanPlace ? [...places, orphanPlace] : places
  const ownedTrophies = trophies.filter(t => t.owned)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #2a2410 0%, #14130a 45%, #0a0a06 100%)' }}>
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(230,201,137,0.45), transparent)' }} />
        <h1 className="flex items-center gap-2">
          <GiGreekTemple size={22} color="#E6C989" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
          <span className="wc-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', color: '#E6C989' }}>Collezione</span>
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? <GameListSkeleton rows={4} /> : (
          <>
            {/* Trophy shelf */}
            {trophies.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(160deg, rgba(230,201,137,0.10), rgba(255,255,255,0.02))', border: '1px solid rgba(230,201,137,0.25)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: '#E6C989' }}>
                  <GiTrophyCup size={14} color="#E6C989" /> Trofei · {ownedTrophies.length}/{trophies.length}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {trophies.map(t => (
                    <div key={t.id} className="shrink-0 w-16 flex flex-col items-center text-center" style={{ opacity: t.owned ? 1 : 0.32 }}>
                      <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
                        style={{ background: t.owned ? 'radial-gradient(circle at 40% 30%, #F3C23344, transparent 70%)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.owned ? '#F3C23366' : 'rgba(255,255,255,0.1)'}` }}>
                        {t.image_url ? <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" style={{ filter: t.owned ? undefined : 'grayscale(1)' }} /> : <GiTrophyCup size={28} color={t.owned ? '#F3C233' : '#6B7280'} />}
                      </div>
                      <p className="text-[9px] mt-1 leading-tight text-white/60 line-clamp-2">{t.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allPlaces.length === 0 && (
              <div className="text-center text-white/40 text-sm py-16">
                <GiColumnVase size={40} color="#4b5563" className="mx-auto mb-3" />
                Nessun reperto ancora. Apri bustine e forzieri per scoprire la storia della città!
              </div>
            )}

            {allPlaces.map(place => <PlaceCard key={place.id} place={place} onOpen={(item, kind) => setDetail({ item, kind })} />)}
          </>
        )}
      </div>

      {/* Detail lightbox */}
      <AnimatePresence>
        {detail && <DetailModal item={detail.item} kind={detail.kind} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  )
}

function PlaceCard({ place, onOpen }: { place: Place; onOpen: (item: Collectible, kind: Kind) => void }) {
  const groups: Array<{ kind: Kind; items: Collectible[] }> = [
    { kind: 'opera', items: place.artworks },
    { kind: 'personaggio', items: place.characters },
    { kind: 'aneddoto', items: place.anecdotes },
  ]
  const total = groups.reduce((s, g) => s + g.items.length, 0)
  const owned = groups.reduce((s, g) => s + g.items.filter(i => i.owned).length, 0)
  const isGold = total > 0 && owned === total
  if (total === 0) return null

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isGold ? '#F3C23366' : 'rgba(255,255,255,0.08)'}`, background: 'rgba(255,255,255,0.02)' }}>
      <div className="relative p-4" style={{ background: isGold ? 'linear-gradient(160deg, rgba(243,194,51,0.12), transparent)' : 'linear-gradient(160deg, rgba(230,201,137,0.06), transparent)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0" style={{ background: 'rgba(230,201,137,0.12)', border: '1px solid rgba(230,201,137,0.2)' }}>
            {place.image_url ? <img src={place.image_url} alt={place.name} className="w-full h-full object-cover" /> : <GiGreekTemple size={26} color="#E6C989" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-sm truncate">{place.name}</p>
              {isGold && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: '#F3C233', color: '#1a1405' }}>GOLD</span>}
            </div>
            <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${(owned / total) * 100}%`, background: isGold ? '#F3C233' : 'linear-gradient(90deg, #E6C989, #C8A24A)' }} />
            </div>
            <p className="text-[11px] text-white/45 mt-1">{owned}/{total} reperti</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        {groups.map(g => g.items.length > 0 && (
          <div key={g.kind}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color: KIND_META[g.kind].accent }}>
              <KindIcon kind={g.kind} /> {KIND_META[g.kind].label} ({g.items.filter(i => i.owned).length}/{g.items.length})
            </p>
            <div className="grid grid-cols-4 gap-2">
              {g.items.map(item => {
                const c = rarityColor(item.rarity)
                return (
                  <button key={item.id} disabled={!item.owned} onClick={() => onOpen(item, g.kind)}
                    className="relative rounded-xl aspect-square flex items-center justify-center overflow-hidden disabled:cursor-default"
                    style={{ background: item.owned ? `radial-gradient(circle at 40% 30%, ${c}33, rgba(255,255,255,0.02))` : 'rgba(255,255,255,0.03)', border: `1px solid ${item.owned ? `${c}55` : 'rgba(255,255,255,0.06)'}` }}>
                    {item.owned && item.image_url
                      ? <img src={item.image_url} alt={item.name ?? item.title} className="w-full h-full object-cover" />
                      : <KindIcon kind={g.kind} size={22} muted={!item.owned} />}
                    {!item.owned && <span className="absolute inset-0 flex items-center justify-center text-white/25 text-lg font-bold">?</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function KindIcon({ kind, size = 12, muted }: { kind: Kind; size?: number; muted?: boolean }) {
  const { Icon, accent } = KIND_META[kind]
  return <Icon size={size} color={muted ? '#4b5563' : accent} />
}

function DetailModal({ item, kind, onClose }: { item: Collectible; kind: Kind; onClose: () => void }) {
  const c = rarityColor(item.rarity)
  const title = item.name ?? item.title ?? ''
  return (
    <motion.div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: '#12100a', border: `1px solid ${c}44` }}
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        {item.image_url && (
          <div className="w-full aspect-video overflow-hidden" style={{ background: `radial-gradient(circle, ${c}22, transparent)` }}>
            <img src={item.image_url} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <KindIcon kind={kind} size={16} />
            <h3 className="text-xl font-bold text-white flex-1">{title}</h3>
            {item.rarity && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${c}22`, color: c }}>{RARITY_LABELS[item.rarity as Rarity] ?? item.rarity}</span>}
          </div>
          <p className="text-sm text-white/55 leading-relaxed whitespace-pre-line">{item.body || item.description}</p>
          <button onClick={onClose} className="mt-5 w-full py-3 rounded-2xl font-bold text-[#12100a]" style={{ background: `linear-gradient(135deg, ${c}, ${c}bb)` }}>Chiudi</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
