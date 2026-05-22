'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { AdminListSkeleton } from '@/components/admin/AdminLoading'
import { GameToast } from '@/components/game/GameToast'
import { useGameToast } from '@/components/game/useGameToast'
import { RARITY_CATCH_RATES, CATCH_DIFFICULTY_MULT } from '@/lib/types'

type Rarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario' | 'mitologico'
type ElementType = 'fiamma' | 'adriatico' | 'bosco' | 'terra' | 'armonia'

interface Creature {
  id: string
  name: string
  description: string
  rarity: Rarity
  element: ElementType
  hp: number
  atk: number
  def: number
  evolution_of: string | null
  image_url: string
  sprite_cutout_url?: string | null
  sprite_url?: string | null
  session_id: string | null
  catch_difficulty: number
  enigma_title: string | null
  enigma_description: string | null
  enigma_image_url: string | null
  enigma_video_url: string | null
  attack_sound_url: string | null
  attack_sound_duration_ms: number | null
  status_effect: string | null
  status_effect_chance: number
  enigma_frammento_id: string | null
}

function creatureCutoutUrl(creature?: Creature | null) {
  return creature?.sprite_cutout_url || creature?.sprite_url || ''
}

function creatureArtworkUrl(creature: Creature | null | undefined, kind: ArtworkKind) {
  if (!creature) return ''
  return kind === 'cutout'
    ? creature.sprite_cutout_url || creature.sprite_url || creature.image_url || ''
    : creature.image_url || ''
}

const RARITIES: Rarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']
const ELEMENTS: ElementType[] = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia']

const RARITY_META: Record<Rarity, { label: string; color: string; glow: string }> = {
  comune:      { label: 'Terrestre',   color: '#9CA3AF', glow: 'rgba(156,163,175,0.25)' },
  non_comune:  { label: 'Arcaico',     color: '#34D399', glow: 'rgba(52,211,153,0.25)' },
  raro:        { label: 'Eroico',      color: '#38BDF8', glow: 'rgba(56,189,248,0.25)' },
  epico:       { label: 'Mostruoso',   color: '#C084FC', glow: 'rgba(192,132,252,0.25)' },
  leggendario: { label: 'Leggendario', color: '#FBBF24', glow: 'rgba(251,191,36,0.35)' },
  mitologico:  { label: 'Mitologico',  color: '#FF4D6D', glow: 'rgba(255,77,109,0.35)' },
}

const ELEMENT_META: Record<ElementType, { label: string; emoji: string; bg: string }> = {
  fiamma:    { label: 'Fiamma',    emoji: '🔥', bg: 'rgba(239,68,68,0.15)' },
  adriatico: { label: 'Adriatico', emoji: '🌊', bg: 'rgba(56,189,248,0.15)' },
  bosco:     { label: 'Bosco',     emoji: '🌿', bg: 'rgba(52,211,153,0.15)' },
  terra:     { label: 'Terra',     emoji: '🪨', bg: 'rgba(180,140,90,0.15)' },
  armonia:   { label: 'Armonia',   emoji: '✨', bg: 'rgba(192,132,252,0.15)' },
}

const EMPTY_FORM = {
  name: '', description: '', rarity: 'comune' as Rarity, element: 'armonia' as ElementType,
  hp: 50, atk: 10, def: 5, evolution_of: '', session_id: '', catch_difficulty: 1,
  enigma_title: '', enigma_description: '', enigma_image_url: '', enigma_video_url: '',
  enigma_frammento_id: '',
  spawnable: true,
  attack_sound_url: '', attack_sound_duration_ms: '',
  status_effect: '' as string, status_effect_chance: 15,
}

type ImageMode = 'preview' | 'url' | 'upload' | 'ai'
type ArtworkKind = 'legacy' | 'cutout'

export default function CreaturesPage() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [loading, setLoading] = useState(true)
  const { toast, showError, dismiss } = useGameToast()
  const supabase = useMemo(() => createClient(), [])

  // Panel state
  const [panel, setPanel] = useState<'none' | 'new' | string>('none') // 'none' | 'new' | creature.id
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Image state
  const [imageMode, setImageMode] = useState<ImageMode>('preview')
  const [manualUrl, setManualUrl] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiQuality, setAiQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [artworkKind, setArtworkKind] = useState<ArtworkKind>('cutout')
  const [artworkLoading, setArtworkLoading] = useState(false)
  const [artworkError, setArtworkError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [soundOpen, setSoundOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [soundUploading, setSoundUploading] = useState(false)
  const [soundError, setSoundError] = useState<string | null>(null)
  const soundFileRef = useRef<HTMLInputElement>(null)

  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<ElementType | 'all'>('all')
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [sessionFilter, setSessionFilter] = useState<string>('')
  const [allFrammenti, setAllFrammenti] = useState<Array<{
    id: string
    title: string
    enigma_title: string
  }>>([])


  useEffect(() => {
    supabase.from('sessions').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })
    supabase
      .from('enigma_frammenti')
      .select('id, title, enigma:enigmi(title)')
      .order('title', { ascending: true })
      .then(({ data }) => {
        if (data) setAllFrammenti(data.map((f: any) => ({
          id: f.id,
          title: f.title,
          enigma_title: f.enigma?.title ?? '',
        })))
      })
  }, [supabase])

  const loadCreatures = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/creatures')
      const d = await res.json()
      if (!res.ok) { showError(d.error ?? 'Errore caricamento'); return }
      setCreatures(d.creatures ?? [])
    } catch { showError('Errore di rete') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCreatures() }, [loadCreatures])

  function openNew() {
    setPanel('new'); setFormData({ ...EMPTY_FORM }); setFormError(null)
    setImageMode('preview'); setManualUrl(''); setAiPrompt(''); setArtworkError(null)
    setArtworkKind('cutout')
    setSoundOpen(false); setSoundError(null); setStatusOpen(false)
  }

  function openEdit(c: Creature) {
    setPanel(c.id)
    setFormData({ name: c.name, description: c.description, rarity: c.rarity, element: c.element,
      hp: c.hp, atk: c.atk, def: c.def, evolution_of: c.evolution_of ?? '',
      session_id: c.session_id ?? '', catch_difficulty: c.catch_difficulty ?? 1,
      enigma_title: c.enigma_title ?? '', enigma_description: c.enigma_description ?? '',
      enigma_image_url: c.enigma_image_url ?? '', enigma_video_url: c.enigma_video_url ?? '',
      enigma_frammento_id: c.enigma_frammento_id ?? '',
      spawnable: (c as any).spawnable !== false,
      attack_sound_url: c.attack_sound_url ?? '', attack_sound_duration_ms: c.attack_sound_duration_ms ?? '',
      status_effect: c.status_effect ?? '', status_effect_chance: c.status_effect_chance != null ? Math.round(c.status_effect_chance * 100) : 15 } as any)
    setFormError(null); setImageMode('preview')
    setManualUrl(creatureCutoutUrl(c)); setAiPrompt(c.description ?? ''); setArtworkError(null)
    setArtworkKind('cutout')
    setSoundError(null); setStatusOpen(!!c.status_effect)
  }

  function closePanel() {
    setPanel('none'); setFormError(null); setArtworkError(null); setSoundError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true); setFormError(null)
    const isEdit = panel !== 'new'
    const payload = {
      name: formData.name, description: formData.description, rarity: formData.rarity,
      element: formData.element, hp: Number(formData.hp), atk: Number(formData.atk),
      def: Number(formData.def), evolution_of: formData.evolution_of || null,
      session_id: (formData as any).session_id || null,
      catch_difficulty: Number((formData as any).catch_difficulty) || 1,
      enigma_frammento_id: (formData as any).enigma_frammento_id || null,
      spawnable: (formData as any).spawnable !== false,
      attack_sound_url: (formData as any).attack_sound_url || null,
      attack_sound_duration_ms: (formData as any).attack_sound_duration_ms
        ? Number((formData as any).attack_sound_duration_ms) : null,
      status_effect: (formData as any).status_effect || null,
      status_effect_chance: Number((formData as any).status_effect_chance ?? 15) / 100,
    }
    try {
      const res = await fetch(isEdit ? `/api/admin/creatures/${panel}` : '/api/admin/creatures', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { setFormError(d.error ?? 'Errore salvataggio') }
      else { await loadCreatures(); closePanel() }
    } catch { setFormError('Errore di rete') }
    finally { setFormLoading(false) }
  }

  async function handleDelete(c: Creature) {
    if (!confirm(`Eliminare "${c.name}"? Irreversibile.`)) return
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/admin/creatures/${c.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); showError(d.error ?? 'Errore eliminazione') }
      else { if (panel === c.id) closePanel(); await loadCreatures() }
    } catch { showError('Errore di rete') }
    finally { setDeletingId(null) }
  }

  async function handleArtwork() {
    const targetId = panel === 'new' ? null : panel as string
    if (!targetId) { setArtworkError('Salva prima la creatura, poi genera l\'artwork'); return }
    setArtworkLoading(true); setArtworkError(null)
    try {
      const body = imageMode === 'url'
        ? { imageUrl: manualUrl, kind: artworkKind }
        : { prompt: aiPrompt || formData.description || formData.name, quality: aiQuality, kind: artworkKind }
      const res = await fetch(`/api/admin/creatures/${targetId}/artwork`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setArtworkError(d.error ?? 'Errore artwork') }
      else { setImageMode('preview'); await loadCreatures() }
    } catch { setArtworkError('Errore di rete') }
    finally { setArtworkLoading(false) }
  }

  async function handleFileUpload(file: File) {
    const targetId = panel === 'new' ? null : panel as string
    if (!targetId) { setArtworkError('Salva prima la creatura, poi carica l\'artwork'); return }
    setArtworkLoading(true); setArtworkError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) { setArtworkError(uploadData.error ?? 'Errore upload'); return }
      const artRes = await fetch(`/api/admin/creatures/${targetId}/artwork`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadData.url, kind: artworkKind }),
      })
      const artData = await artRes.json()
      if (!artRes.ok) { setArtworkError(artData.error ?? 'Errore salvataggio artwork') }
      else { setImageMode('preview'); await loadCreatures() }
    } catch { setArtworkError('Errore di rete') }
    finally { setArtworkLoading(false) }
  }

  async function handleSoundUpload(file: File) {
    setSoundUploading(true); setSoundError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) { setSoundError(d.error ?? 'Errore upload'); return }
      // Auto-detect duration from audio file
      const url = d.url as string
      let durationMs: number | null = null
      try {
        const audio = new Audio(url)
        durationMs = await new Promise<number>(resolve => {
          audio.addEventListener('loadedmetadata', () => resolve(Math.round(audio.duration * 1000)))
          audio.addEventListener('error', () => resolve(0))
          setTimeout(() => resolve(0), 5000)
        })
      } catch { /* silent */ }
      setFormData(f => ({ ...f, attack_sound_url: url, attack_sound_duration_ms: durationMs ?? '' } as any))
    } catch { setSoundError('Errore di rete') }
    finally { setSoundUploading(false) }
  }

  const editingCreature = panel !== 'none' && panel !== 'new'
    ? creatures.find(c => c.id === panel) ?? null : null

  const activeFilterCount = [
    filter !== 'all', rarityFilter !== 'all', !!sessionFilter
  ].filter(Boolean).length

  const filtered = creatures.filter(c => {
    if (filter !== 'all' && c.element !== filter) return false
    if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sessionFilter === '__null__' && c.session_id !== null) return false
    if (sessionFilter && sessionFilter !== '__null__' && c.session_id !== sessionFilter) return false
    return true
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .creatures-root { font-family: 'Exo 2', sans-serif; }
        .stat-mono { font-family: 'JetBrains Mono', monospace; }
        .card-shimmer { background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%); }
        .img-placeholder { background: linear-gradient(135deg, #0F2030 0%, #1A3040 100%); }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow 2s linear infinite; }
        @keyframes pulse-glow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .panel-enter { animation: slideIn 0.2s ease-out; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <div className="creatures-root max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">🐾 Catalogo Creature</h1>
            <p className="text-xs text-white/30 mt-0.5 stat-mono">{creatures.length} creature nel database</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-gradient-to-r from-[#3A9DBC] to-[#2D7A96] text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-[#3A9DBC]/20 hover:shadow-[#3A9DBC]/40 transition-all">
            <span className="text-lg leading-none">+</span> Nuova Creatura
          </button>
        </div>

        <GameToast toast={toast} onDismiss={dismiss} />

        {/* Grid */}
        <div>
          {/* Filter bar */}
          <div className="flex gap-2 mb-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cerca per nome…"
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50 transition-colors" />
            </div>

            {/* Filtri toggle */}
            <motion.button
              onClick={() => setShowFilters(f => !f)}
              whileTap={{ scale: 0.93 }}
              className="relative flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
              style={{
                background: showFilters || activeFilterCount > 0 ? 'rgba(58,157,188,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${showFilters || activeFilterCount > 0 ? 'rgba(58,157,188,0.45)' : 'rgba(255,255,255,0.09)'}`,
                color: showFilters || activeFilterCount > 0 ? '#3A9DBC' : 'rgba(255,255,255,0.45)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              <span>Filtri</span>
              <AnimatePresence>
                {activeFilterCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#3A9DBC] text-white text-[9px] font-black flex items-center justify-center"
                  >
                    {activeFilterCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Collapsible filter panel */}
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pb-3 space-y-2">
                  {/* Session filter */}
                  <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50">
                    <option value="">📋 Tutte le sessioni</option>
                    <option value="__null__">🌐 Globali</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>

                  {/* Element chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(['all', ...ELEMENTS] as const).map(el => (
                      <button key={el} onClick={() => setFilter(el)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                        style={{
                          background: filter === el ? 'rgba(58,157,188,0.2)' : 'rgba(255,255,255,0.05)',
                          color: filter === el ? '#3A9DBC' : 'rgba(255,255,255,0.38)',
                          border: `1px solid ${filter === el ? 'rgba(58,157,188,0.45)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        {el === 'all' ? '🌐 Elem.' : `${ELEMENT_META[el].emoji} ${ELEMENT_META[el].label}`}
                      </button>
                    ))}
                  </div>

                  {/* Rarity chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(['all', ...RARITIES] as const).map(r => (
                      <button key={r} onClick={() => setRarityFilter(r)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                        style={{
                          background: rarityFilter === r ? `${RARITY_META[r === 'all' ? 'comune' : r].color}22` : 'rgba(255,255,255,0.05)',
                          color: rarityFilter === r ? (r === 'all' ? 'white' : RARITY_META[r].color) : 'rgba(255,255,255,0.38)',
                          border: `1px solid ${rarityFilter === r ? (r === 'all' ? 'rgba(255,255,255,0.25)' : `${RARITY_META[r].color}50`) : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        {r === 'all' ? '★ Rarità' : RARITY_META[r].label}
                      </button>
                    ))}
                  </div>

                  {activeFilterCount > 0 && (
                    <button onClick={() => { setFilter('all'); setRarityFilter('all'); setSessionFilter('') }}
                      className="w-full text-[10px] text-white/30 hover:text-white/60 text-center cursor-pointer py-0.5 transition-colors">
                      Reimposta filtri
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <AdminListSkeleton rows={8} itemClassName="h-44" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" />
          ) : filtered.length === 0 ? (
            <div className="text-white/30 text-center py-16 text-sm">Nessuna creatura trovata</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(c => {
                const rm = RARITY_META[c.rarity]
                const em = ELEMENT_META[c.element]
                const isActive = panel === c.id
                return (
                  <div key={c.id} onClick={() => isActive ? closePanel() : openEdit(c)}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all select-none group
                      ${isActive ? 'ring-2 ring-[#3A9DBC] shadow-lg shadow-[#3A9DBC]/20' : 'hover:scale-[1.02] hover:shadow-lg'}`}
                    style={{ background: `linear-gradient(145deg, #0D1E2E, #0A1520)`, boxShadow: isActive ? `0 0 20px ${rm.glow}` : undefined }}>

                    {/* Rarity accent line */}
                    <div className="h-0.5 w-full" style={{ background: rm.color }} />

                    {/* Image area */}
                    <div className="relative h-28 img-placeholder flex items-center justify-center overflow-hidden">
                      {c.image_url ? (
                        <Image src={c.image_url} alt={c.name} fill className="object-cover"
                          sizes="200px" onError={() => {}} />
                      ) : (
                        <div className="text-4xl opacity-30 group-hover:opacity-50 transition-opacity"
                          style={{ filter: 'saturate(0)' }}>🐾</div>
                      )}
                      {/* Non-spawnable badge */}
                      {(c as any).spawnable === false && (
                        <div className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded-md font-semibold bg-black/70 text-white/60">
                          🚫
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-sm text-white truncate flex-1">{c.name}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0"
                          style={{ background: em.bg, color: 'rgba(255,255,255,0.9)' }}>
                          {em.emoji} {em.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-semibold" style={{ color: rm.color }}>{rm.label}</span>
                        <span className="stat-mono text-xs text-white/30">{c.hp}hp</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Edit/Create Modal Overlay */}
        {panel !== 'none' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm panel-enter"
            onClick={e => { if (e.target === e.currentTarget) closePanel() }}>
            <div className="bg-[#0D1E2E] border border-white/15 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <h2 className="font-bold text-base text-white">
                  {panel === 'new' ? '+ Nuova Creatura' : `✏️ Modifica: ${editingCreature?.name ?? ''}`}
                </h2>
                <button onClick={closePanel} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
              </div>

                <div className="p-5 overflow-y-auto flex-1">
                  {/* Image section */}
                  <div className="mb-4">
                    <div className="relative h-36 bg-[#07111B] rounded-xl overflow-hidden mb-2 flex items-center justify-center">
                      {creatureArtworkUrl(editingCreature, artworkKind) ? (
                        <Image
                          src={creatureArtworkUrl(editingCreature, artworkKind)}
                          alt={editingCreature?.name ?? 'Creatura'}
                          fill
                          className="object-contain"
                          sizes="320px"
                        />
                      ) : (
                        <span className="text-5xl opacity-20">🐾</span>
                      )}
                      {artworkLoading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-[#3A9DBC] border-t-transparent rounded-full spin-slow" />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 mb-2 bg-white/5 p-1 rounded-lg">
                      {([
                        ['cutout', 'Sprite battle'],
                        ['legacy', 'Card'],
                      ] as Array<[ArtworkKind, string]>).map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => {
                            setArtworkKind(kind)
                            setManualUrl(kind === 'cutout' ? creatureCutoutUrl(editingCreature) : editingCreature?.image_url ?? '')
                            setArtworkError(null)
                          }}
                          className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${artworkKind === kind ? 'bg-[#F7C841] text-[#180F03]' : 'text-white/45 hover:text-white'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Image mode tabs */}
                    <div className="flex gap-1 mb-3 bg-white/5 p-1 rounded-lg">
                      {(['preview', 'url', 'upload', 'ai'] as ImageMode[]).map(m => (
                        <button key={m} onClick={() => { setImageMode(m); setArtworkError(null) }}
                          className={`flex-1 text-xs py-1.5 rounded-md font-semibold transition-all ${imageMode === m ? 'bg-[#3A9DBC] text-white' : 'text-white/40 hover:text-white'}`}>
                          {m === 'preview' ? '👁' : m === 'url' ? '🔗' : m === 'upload' ? '📁' : '✨'}
                        </button>
                      ))}
                    </div>

                    {/* Hidden file input */}
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]) }} />

                    {imageMode === 'url' && (
                      <div className="space-y-2">
                        <input value={manualUrl} onChange={e => setManualUrl(e.target.value)}
                          placeholder="https://..." className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50" />
                        <button onClick={handleArtwork} disabled={artworkLoading || !manualUrl.startsWith('http')}
                          className="w-full bg-white/10 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-40 hover:bg-white/20 transition-colors">
                          Imposta URL
                        </button>
                      </div>
                    )}

                    {imageMode === 'upload' && (
                      <div
                        onClick={() => !artworkLoading && fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer hover:border-[#3A9DBC]/50 hover:bg-white/5 transition-colors"
                      >
                        {artworkLoading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-[#3A9DBC] border-t-transparent rounded-full spin-slow" />
                            <p className="text-xs text-white/50">Caricamento...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-1">
                            <span className="text-2xl">📁</span>
                            <p className="text-xs text-white/50 font-medium">Clicca per selezionare</p>
                            <p className="text-xs text-white/25">PNG, JPG, WEBP, GIF, SVG — max 5 MB</p>
                          </div>
                        )}
                        {panel === 'new' && (
                          <p className="text-xs text-amber-400/70 mt-1">Salva prima la creatura</p>
                        )}
                      </div>
                    )}

                    {imageMode === 'ai' && (
                      <div className="space-y-2">
                        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3}
                          placeholder="Descrivi la creatura per l'AI..."
                          className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#3A9DBC]/50" />
                        <div className="flex gap-2">
                          <select value={aiQuality} onChange={e => setAiQuality(e.target.value as any)}
                            className="flex-1 bg-white/5 text-white text-xs border border-white/10 rounded-lg px-2 py-2">
                            <option value="low">Bassa (~$0.01)</option>
                            <option value="medium">Media (~$0.04)</option>
                            <option value="high">Alta (~$0.17)</option>
                          </select>
                          <button onClick={handleArtwork}
                            disabled={artworkLoading || !aiPrompt.trim() || panel === 'new'}
                            className="flex-1 bg-gradient-to-r from-[#7B4DB8] to-[#5A35A0] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-40 transition-all hover:brightness-110">
                            {artworkLoading ? '⏳ Genera...' : '✨ Genera AI'}
                          </button>
                        </div>
                        {panel === 'new' && (
                          <p className="text-xs text-amber-400/70">Salva prima la creatura, poi genera l&apos;artwork</p>
                        )}
                      </div>
                    )}

                    {artworkError && (
                      <p className="text-xs text-red-400 mt-2">{artworkError}</p>
                    )}
                  </div>

                  {/* Creature form */}
                  <form onSubmit={handleSubmit} className="space-y-3">
                    {formError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">{formError}</div>
                    )}

                    <div>
                      <label className="text-xs text-white/40 block mb-1">Nome *</label>
                      <input type="text" value={formData.name} required
                        onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                        className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50" />
                    </div>

                    <div>
                      <label className="text-xs text-white/40 block mb-1">Descrizione</label>
                      <textarea value={formData.description} rows={2}
                        onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                        className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#3A9DBC]/50" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Rarità</label>
                        <select value={formData.rarity} onChange={e => setFormData(f => ({ ...f, rarity: e.target.value as Rarity }))}
                          className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-2 py-2">
                          {RARITIES.map(r => <option key={r} value={r}>{RARITY_META[r].label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Elemento</label>
                        <select value={formData.element} onChange={e => setFormData(f => ({ ...f, element: e.target.value as ElementType }))}
                          className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-2 py-2">
                          {ELEMENTS.map(el => <option key={el} value={el}>{ELEMENT_META[el].emoji} {ELEMENT_META[el].label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[['hp','HP',1],['atk','ATK',1],['def','DEF',0]].map(([field, label, min]) => (
                        <div key={field}>
                          <label className="text-xs text-white/40 block mb-1 stat-mono">{label}</label>
                          <input type="number" value={(formData as any)[field]} min={min}
                            onChange={e => setFormData(f => ({ ...f, [field]: +e.target.value }))}
                            className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-2 py-2 stat-mono focus:outline-none focus:border-[#3A9DBC]/50" />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs text-white/40 block mb-1">Evoluzione di</label>
                      <select value={formData.evolution_of}
                        onChange={e => setFormData(f => ({ ...f, evolution_of: e.target.value }))}
                        className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-2 py-2">
                        <option value="">— Nessuna —</option>
                        {creatures.filter(c => c.id !== panel).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white/40 block mb-1">Disponibile in</label>
                      <select value={(formData as any).session_id}
                        onChange={e => setFormData(f => ({ ...f, session_id: e.target.value } as any))}
                        className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-2 py-2">
                        <option value="">🌐 Tutte le sessioni</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>🎯 {s.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white/40 block mb-1">Difficoltà cattura</label>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button"
                              onClick={() => setFormData(f => ({ ...f, catch_difficulty: n } as any))}
                              className={`text-xl leading-none transition-all ${n <= ((formData as any).catch_difficulty ?? 1) ? 'opacity-100' : 'opacity-25'}`}>
                              ⭐
                            </button>
                          ))}
                        </div>
                        {/* Live effective catch % */}
                        {(() => {
                          const diff = (formData as any).catch_difficulty ?? 3
                          const base = RARITY_CATCH_RATES[formData.rarity as Rarity] ?? 0.5
                          const mult = CATCH_DIFFICULTY_MULT[diff] ?? 1.0
                          const pct  = Math.min(100, Math.round(base * mult * 100))
                          const labels = ['', 'Molto facile', 'Facile', 'Normale', 'Difficile', 'Molto difficile']
                          const color  = pct >= 60 ? '#34D399' : pct >= 30 ? '#FBBF24' : '#F87171'
                          return (
                            <span className="text-xs font-bold ml-1" style={{ color }}>
                              {pct}% · {labels[diff]}
                            </span>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Spawnable toggle */}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-semibold text-white/70">Trovabile in esplorazione</p>
                        <p className="text-xs text-white/30 mt-0.5">Se disattivato, la creatura non appare negli incontri selvatici</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, spawnable: !(f as any).spawnable } as any))}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${(formData as any).spawnable !== false ? 'bg-[#3A9DBC]' : 'bg-white/20'}`}
                      >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${(formData as any).spawnable !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Frammento Enigma */}
                    <div className="border border-white/10 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/60">🧩 Frammento Enigma <span className="text-white/30 font-normal">(opzionale)</span></span>
                      </div>
                      <div className="px-3 py-3 space-y-2">
                        <select
                          value={(formData as any).enigma_frammento_id ?? ''}
                          onChange={e => setFormData(f => ({ ...f, enigma_frammento_id: e.target.value || null } as any))}
                          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">— Nessun frammento —</option>
                          {allFrammenti.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.title}{f.enigma_title ? ` (${f.enigma_title})` : ''}
                            </option>
                          ))}
                        </select>
                        {(formData as any).enigma_frammento_id && (() => {
                          const sel = allFrammenti.find(f => f.id === (formData as any).enigma_frammento_id)
                          return sel ? (
                            <p className="text-xs text-white/40">Enigma: <span className="text-[#3A9DBC]/80">{sel.enigma_title}</span></p>
                          ) : null
                        })()}
                      </div>
                    </div>

                    {/* Sound section */}
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <button type="button"
                        onClick={() => setSoundOpen(o => !o)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
                        <span className="text-xs font-semibold text-white/60 flex items-center gap-2">
                          🔊 Suono attacco <span className="text-white/30 font-normal">(opzionale)</span>
                          {(formData as any).attack_sound_url && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC6A] inline-block" />
                          )}
                        </span>
                        <span className="text-white/30 text-xs">{soundOpen ? '▲' : '▼'}</span>
                      </button>
                      {soundOpen && (
                        <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
                          {/* Upload button */}
                          <div>
                            <label className="text-xs text-white/40 block mb-1">File audio (MP3, OGG, WAV)</label>
                            <div className="flex gap-2 items-center">
                              <button type="button"
                                onClick={() => soundFileRef.current?.click()}
                                disabled={soundUploading}
                                className="shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
                                {soundUploading ? '⏳ Carico...' : '📁 Carica audio'}
                              </button>
                              {(formData as any).attack_sound_url && (
                                <button type="button"
                                  onClick={() => setFormData(f => ({ ...f, attack_sound_url: '', attack_sound_duration_ms: '' } as any))}
                                  className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                                  ✕ Rimuovi
                                </button>
                              )}
                            </div>
                            <input ref={soundFileRef} type="file" accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"
                              className="hidden"
                              onChange={e => { if (e.target.files?.[0]) handleSoundUpload(e.target.files[0]); e.target.value = '' }} />
                            {soundError && <p className="text-xs text-red-400 mt-1">{soundError}</p>}
                          </div>
                          {/* Preview + URL display */}
                          {(formData as any).attack_sound_url && !soundUploading && (
                            <div className="space-y-2">
                              <audio controls src={(formData as any).attack_sound_url}
                                className="w-full h-8"
                                style={{ filter: 'invert(1) brightness(0.7)' }} />
                              <p className="text-[10px] text-white/25 truncate">{(formData as any).attack_sound_url}</p>
                            </div>
                          )}
                          {/* Duration override */}
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Durata riproduzione (ms) — lascia vuoto = automatico</label>
                            <input type="number" min={0} step={100}
                              value={(formData as any).attack_sound_duration_ms}
                              onChange={e => setFormData(f => ({ ...f, attack_sound_duration_ms: e.target.value } as any))}
                              placeholder="Es. 1200"
                              className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Effetto di Stato ── */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                      <button type="button" className="w-full flex items-center justify-between px-4 py-3"
                        onClick={() => setStatusOpen(o => !o)}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">⚡</span>
                          <span className="text-sm font-bold text-white/70">Effetto di Stato</span>
                          {(formData as any).status_effect && (() => {
                            const effectColors: Record<string, string> = { paralisi: '#FBBF24', confusione: '#C084FC', sonno: '#38BDF8', veleno: '#4ADE80' }
                            const c = effectColors[(formData as any).status_effect] ?? '#9CA3AF'
                            return (
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}>
                                {(formData as any).status_effect} — {(formData as any).status_effect_chance}%
                              </span>
                            )
                          })()}
                        </div>
                        <span className="text-white/30 text-xs">{statusOpen ? '▲' : '▼'}</span>
                      </button>
                      {statusOpen && (
                        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/06">
                          <div>
                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Tipo di effetto</label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { value: '', label: 'Nessuno', emoji: '—', color: '#9CA3AF', glow: 'rgba(156,163,175,0.35)' },
                                { value: 'paralisi', label: 'Paralisi', emoji: '⚡', color: '#FBBF24', glow: 'rgba(251,191,36,0.35)' },
                                { value: 'confusione', label: 'Confusione', emoji: '💫', color: '#C084FC', glow: 'rgba(192,132,252,0.35)' },
                                { value: 'sonno', label: 'Sonno', emoji: '💤', color: '#38BDF8', glow: 'rgba(56,189,248,0.35)' },
                                { value: 'veleno', label: 'Veleno', emoji: '☠️', color: '#4ADE80', glow: 'rgba(74,222,128,0.35)' },
                              ].map(opt => {
                                const active = (formData as any).status_effect === opt.value
                                return (
                                  <button key={opt.value} type="button"
                                    onClick={() => setFormData(f => ({ ...f, status_effect: opt.value } as any))}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
                                    style={{
                                      background: active ? `${opt.color}22` : 'rgba(255,255,255,0.04)',
                                      border: `1px solid ${active ? `${opt.color}66` : 'rgba(255,255,255,0.1)'}`,
                                      color: active ? opt.color : 'rgba(255,255,255,0.5)',
                                      boxShadow: active ? `0 0 8px ${opt.glow}` : 'none',
                                    }}>
                                    <span>{opt.emoji}</span><span>{opt.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          {(formData as any).status_effect && (
                            <div>
                              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                                Probabilità: <span className="text-white/60">{(formData as any).status_effect_chance}%</span>
                              </label>
                              <input type="range" min="1" max="100"
                                value={(formData as any).status_effect_chance}
                                onChange={e => setFormData(f => ({ ...f, status_effect_chance: Number(e.target.value) } as any))}
                                className="w-full accent-[#3A9DBC]" />
                              <div className="flex justify-between text-[10px] text-white/25 mt-1">
                                <span>1%</span><span>15% (default)</span><span>100%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      {panel !== 'new' && editingCreature && (
                        <button type="button" onClick={() => handleDelete(editingCreature)}
                          disabled={deletingId === panel}
                          className="px-3 bg-red-500/15 text-red-400 text-xs font-bold py-3 rounded-xl hover:bg-red-500/25 transition-colors disabled:opacity-40">
                          {deletingId === panel ? '...' : '🗑'}
                        </button>
                      )}
                      <button type="submit" disabled={formLoading}
                        className="flex-1 bg-gradient-to-r from-[#3A9DBC] to-[#2D7A96] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 hover:brightness-110 transition-all">
                        {formLoading ? 'Salvataggio...' : panel === 'new' ? 'Crea Creatura' : 'Salva Modifiche'}
                      </button>
                    </div>
                  </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
