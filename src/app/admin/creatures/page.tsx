'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { AdminListSkeleton } from '@/components/admin/AdminLoading'

type Rarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario'
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
  session_id: string | null
  catch_difficulty: number
  enigma_title: string | null
  enigma_description: string | null
  enigma_image_url: string | null
  enigma_video_url: string | null
}

const RARITIES: Rarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario']
const ELEMENTS: ElementType[] = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia']

const RARITY_META: Record<Rarity, { label: string; color: string; glow: string }> = {
  comune:      { label: 'Comune',      color: '#9CA3AF', glow: 'rgba(156,163,175,0.25)' },
  non_comune:  { label: 'Non Comune',  color: '#34D399', glow: 'rgba(52,211,153,0.25)' },
  raro:        { label: 'Raro',        color: '#38BDF8', glow: 'rgba(56,189,248,0.25)' },
  epico:       { label: 'Epico',       color: '#C084FC', glow: 'rgba(192,132,252,0.25)' },
  leggendario: { label: 'Leggendario', color: '#FBBF24', glow: 'rgba(251,191,36,0.35)' },
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
}

type ImageMode = 'preview' | 'url' | 'upload' | 'ai'

export default function CreaturesPage() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [artworkLoading, setArtworkLoading] = useState(false)
  const [artworkError, setArtworkError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [enigmaOpen, setEnigmaOpen] = useState(false)
  const [enigmaImgUploading, setEnigmaImgUploading] = useState(false)
  const [enigmaImgError, setEnigmaImgError] = useState<string | null>(null)
  const enigmaFileRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<ElementType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [sessionFilter, setSessionFilter] = useState<string>('')

  useEffect(() => {
    supabase.from('sessions').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })
  }, [supabase])

  const loadCreatures = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/creatures')
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Errore caricamento'); return }
      setCreatures(d.creatures ?? [])
    } catch { setError('Errore di rete') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCreatures() }, [loadCreatures])

  function openNew() {
    setPanel('new'); setFormData({ ...EMPTY_FORM }); setFormError(null)
    setImageMode('preview'); setManualUrl(''); setAiPrompt(''); setArtworkError(null); setEnigmaOpen(false)
  }

  function openEdit(c: Creature) {
    setPanel(c.id)
    setFormData({ name: c.name, description: c.description, rarity: c.rarity, element: c.element,
      hp: c.hp, atk: c.atk, def: c.def, evolution_of: c.evolution_of ?? '',
      session_id: c.session_id ?? '', catch_difficulty: c.catch_difficulty ?? 1,
      enigma_title: c.enigma_title ?? '', enigma_description: c.enigma_description ?? '',
      enigma_image_url: c.enigma_image_url ?? '', enigma_video_url: c.enigma_video_url ?? '' })
    setFormError(null); setImageMode('preview')
    setManualUrl(c.image_url ?? ''); setAiPrompt(c.description ?? ''); setArtworkError(null)
  }

  function closePanel() {
    setPanel('none'); setFormError(null); setArtworkError(null)
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
      enigma_title: (formData as any).enigma_title || null,
      enigma_description: (formData as any).enigma_description || null,
      enigma_image_url: (formData as any).enigma_image_url || null,
      enigma_video_url: (formData as any).enigma_video_url || null,
    }
    try {
      const res = await fetch(isEdit ? `/api/admin/creatures/${panel}` : '/api/admin/creatures', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { setFormError(d.error ?? 'Errore salvataggio') }
      else { closePanel(); await loadCreatures() }
    } catch { setFormError('Errore di rete') }
    finally { setFormLoading(false) }
  }

  async function handleDelete(c: Creature) {
    if (!confirm(`Eliminare "${c.name}"? Irreversibile.`)) return
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/admin/creatures/${c.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Errore eliminazione') }
      else { if (panel === c.id) closePanel(); await loadCreatures() }
    } catch { setError('Errore di rete') }
    finally { setDeletingId(null) }
  }

  async function handleArtwork() {
    const targetId = panel === 'new' ? null : panel as string
    if (!targetId) { setArtworkError('Salva prima la creatura, poi genera l\'artwork'); return }
    setArtworkLoading(true); setArtworkError(null)
    try {
      const body = imageMode === 'url'
        ? { imageUrl: manualUrl }
        : { prompt: aiPrompt || formData.description || formData.name, quality: aiQuality }
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
        body: JSON.stringify({ imageUrl: uploadData.url }),
      })
      const artData = await artRes.json()
      if (!artRes.ok) { setArtworkError(artData.error ?? 'Errore salvataggio artwork') }
      else { setImageMode('preview'); await loadCreatures() }
    } catch { setArtworkError('Errore di rete') }
    finally { setArtworkLoading(false) }
  }

  async function handleEnigmaImageUpload(file: File) {
    setEnigmaImgUploading(true); setEnigmaImgError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) { setEnigmaImgError(d.error ?? 'Errore upload'); return }
      setFormData(f => ({ ...f, enigma_image_url: d.url } as any))
    } catch { setEnigmaImgError('Errore di rete') }
    finally { setEnigmaImgUploading(false) }
  }

  const editingCreature = panel !== 'none' && panel !== 'new'
    ? creatures.find(c => c.id === panel) ?? null : null

  const filtered = creatures.filter(c => {
    if (filter !== 'all' && c.element !== filter) return false
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>
        )}

        {/* Grid */}
        <div>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca..." className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:border-[#3A9DBC]/50" />
            <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#3A9DBC]/50">
              <option value="">📋 Tutte le sessioni</option>
              <option value="__null__">🌐 Globali</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(['all', ...ELEMENTS] as const).map(el => (
              <button key={el} onClick={() => setFilter(el)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${filter === el ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}`}>
                {el === 'all' ? 'Tutti' : `${ELEMENT_META[el].emoji} ${ELEMENT_META[el].label}`}
              </button>
            ))}
          </div>

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
                      {/* Element badge */}
                      <div className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-md font-semibold backdrop-blur-sm"
                        style={{ background: em.bg, color: 'rgba(255,255,255,0.85)' }}>
                        {em.emoji}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="px-3 py-2.5">
                      <p className="font-bold text-sm text-white truncate">{c.name}</p>
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
                      {editingCreature?.image_url ? (
                        <Image src={editingCreature.image_url} alt={editingCreature.name} fill className="object-contain" sizes="320px" />
                      ) : (
                        <span className="text-5xl opacity-20">🐾</span>
                      )}
                      {artworkLoading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-[#3A9DBC] border-t-transparent rounded-full spin-slow" />
                        </div>
                      )}
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
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} type="button"
                            onClick={() => setFormData(f => ({ ...f, catch_difficulty: n } as any))}
                            className={`text-xl leading-none transition-all ${n <= ((formData as any).catch_difficulty ?? 1) ? 'opacity-100' : 'opacity-25'}`}>
                            ⭐
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Enigma section */}
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <button type="button"
                        onClick={() => setEnigmaOpen(o => !o)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
                        <span className="text-xs font-semibold text-white/60 flex items-center gap-2">
                          🧩 Enigma <span className="text-white/30 font-normal">(opzionale)</span>
                        </span>
                        <span className="text-white/30 text-xs">{enigmaOpen ? '▲' : '▼'}</span>
                      </button>
                      {enigmaOpen && (
                        <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-3">
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Titolo enigma</label>
                            <input type="text" value={(formData as any).enigma_title}
                              onChange={e => setFormData(f => ({ ...f, enigma_title: e.target.value } as any))}
                              placeholder="Es. Il Segreto delle Acque..."
                              className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Descrizione enigma</label>
                            <textarea value={(formData as any).enigma_description} rows={3}
                              onChange={e => setFormData(f => ({ ...f, enigma_description: e.target.value } as any))}
                              placeholder="Testo del frammento di storia / indovinello..."
                              className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#3A9DBC]/50" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Immagine (URL o carica)</label>
                            <div className="flex gap-2">
                              <input type="text" value={(formData as any).enigma_image_url}
                                onChange={e => { setFormData(f => ({ ...f, enigma_image_url: e.target.value } as any)); setEnigmaImgError(null) }}
                                placeholder="https://..."
                                className="flex-1 bg-white/5 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50 min-w-0" />
                              <button type="button"
                                onClick={() => enigmaFileRef.current?.click()}
                                disabled={enigmaImgUploading}
                                className="shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
                                {enigmaImgUploading ? '⏳' : '📁'}
                              </button>
                            </div>
                            <input ref={enigmaFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                              className="hidden"
                              onChange={e => { if (e.target.files?.[0]) handleEnigmaImageUpload(e.target.files[0]); e.target.value = '' }} />
                            {enigmaImgError && <p className="text-xs text-red-400 mt-1">{enigmaImgError}</p>}
                            {(formData as any).enigma_image_url && !enigmaImgUploading && (
                              <img src={(formData as any).enigma_image_url} alt="preview"
                                className="mt-2 w-full h-24 object-cover rounded-lg opacity-70" />
                            )}
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Video (URL)</label>
                            <input type="text" value={(formData as any).enigma_video_url}
                              onChange={e => setFormData(f => ({ ...f, enigma_video_url: e.target.value } as any))}
                              placeholder="https://youtube.com/... o link diretto"
                              className="w-full bg-white/5 text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3A9DBC]/50" />
                          </div>
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
