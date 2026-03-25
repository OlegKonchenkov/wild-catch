'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  created_at: string
}

const RARITIES: Rarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario']
const ELEMENTS: ElementType[] = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia']

const RARITY_LABELS: Record<Rarity, string> = {
  comune: 'Comune', non_comune: 'Non Comune', raro: 'Raro', epico: 'Epico', leggendario: 'Leggendario',
}

const RARITY_COLORS: Record<Rarity, string> = {
  comune: 'text-white/50', non_comune: 'text-green-400', raro: 'text-[#3A9DBC]',
  epico: 'text-purple-400', leggendario: 'text-yellow-400',
}

const ELEMENT_LABELS: Record<ElementType, string> = {
  fiamma: 'Fiamma', adriatico: 'Adriatico', bosco: 'Bosco', terra: 'Terra', armonia: 'Armonia',
}

const EMPTY_FORM = {
  name: '', description: '', rarity: 'comune' as Rarity, element: 'armonia' as ElementType,
  hp: 50, atk: 10, def: 5, evolution_of: '',
}

export default function CreaturesPage() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [artworkCreatureName, setArtworkCreatureName] = useState('')

  useEffect(() => {
    loadCreatures()
  }, [supabase])

  async function loadCreatures() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/creatures')
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Errore nel caricamento'); return }
      setCreatures(d.creatures ?? [])
    } catch {
      setError('Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  function startNew() {
    setEditingId(null); setFormData({ ...EMPTY_FORM }); setFormError(null); setShowNewForm(true)
  }

  function startEdit(c: Creature) {
    setShowNewForm(false); setEditingId(c.id)
    setFormData({ name: c.name, description: c.description, rarity: c.rarity, element: c.element,
      hp: c.hp, atk: c.atk, def: c.def, evolution_of: c.evolution_of ?? '' })
    setFormError(null)
  }

  function cancelForm() {
    setShowNewForm(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true); setFormError(null)
    const payload = {
      name: formData.name, description: formData.description, rarity: formData.rarity,
      element: formData.element, hp: Number(formData.hp), atk: Number(formData.atk),
      def: Number(formData.def), evolution_of: formData.evolution_of || null,
    }
    const url = editingId ? `/api/admin/creatures/${editingId}` : '/api/admin/creatures'
    try {
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { setFormError(d.error ?? 'Errore durante il salvataggio') }
      else { cancelForm(); await loadCreatures() }
    } catch {
      setFormError('Errore di rete')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(c: Creature) {
    if (!window.confirm(`Eliminare la creatura "${c.name}"? Questa azione è irreversibile.`)) return
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/admin/creatures/${c.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Errore eliminazione') }
      else await loadCreatures()
    } catch {
      setError('Errore di rete')
    } finally {
      setDeletingId(null)
    }
  }

  function renderForm(isEdit: boolean) {
    return (
      <form onSubmit={handleSubmit} className="border border-white/20 rounded-2xl p-6 space-y-4 mb-6">
        <h2 className="font-bold text-lg">{isEdit ? 'Modifica Creatura' : 'Nuova Creatura'}</h2>
        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{formError}</div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-white/50 block mb-1">Nome *</label>
            <input type="text" value={formData.name} required
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-white/50 block mb-1">Descrizione</label>
            <textarea value={formData.description} rows={3}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 resize-none" />
          </div>
          <div>
            <label className="text-sm text-white/50 block mb-1">Rarità *</label>
            <select value={formData.rarity} onChange={e => setFormData(f => ({ ...f, rarity: e.target.value as Rarity }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
              {RARITIES.map(r => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/50 block mb-1">Elemento *</label>
            <select value={formData.element} onChange={e => setFormData(f => ({ ...f, element: e.target.value as ElementType }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
              {ELEMENTS.map(el => <option key={el} value={el}>{ELEMENT_LABELS[el]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/50 block mb-1">HP</label>
            <input type="number" value={formData.hp} min={1}
              onChange={e => setFormData(f => ({ ...f, hp: +e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-sm text-white/50 block mb-1">Attacco</label>
            <input type="number" value={formData.atk} min={1}
              onChange={e => setFormData(f => ({ ...f, atk: +e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-sm text-white/50 block mb-1">Difesa</label>
            <input type="number" value={formData.def} min={0}
              onChange={e => setFormData(f => ({ ...f, def: +e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="text-sm text-white/50 block mb-1">Evoluzione di (opzionale)</label>
            <select value={formData.evolution_of} onChange={e => setFormData(f => ({ ...f, evolution_of: e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
              <option value="">— Nessuna —</option>
              {creatures.filter(c => !isEdit || c.id !== editingId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={cancelForm}
            className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">Annulla</button>
          <button type="submit" disabled={formLoading}
            className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-50">
            {formLoading ? 'Salvataggio...' : isEdit ? 'Salva Modifiche' : 'Crea Creatura'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catalogo Creature</h1>
        {!showNewForm && editingId === null && (
          <button onClick={startNew} className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-xl">
            + Nuova Creatura
          </button>
        )}
      </div>

      {showNewForm && renderForm(false)}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">{error}</div>
      )}

      {loading && <div className="text-white/50 text-center py-12">Caricamento creature...</div>}

      {!loading && creatures.length === 0 && (
        <div className="text-white/40 text-center py-12">Nessuna creatura nel catalogo. Creane una!</div>
      )}

      {!loading && creatures.length > 0 && (
        <div className="space-y-3 mb-10">
          {creatures.map(c => (
            <div key={c.id}>
              {editingId === c.id && renderForm(true)}
              {editingId !== c.id && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white">{c.name}</p>
                        <span className={`text-xs font-semibold ${RARITY_COLORS[c.rarity]}`}>{RARITY_LABELS[c.rarity]}</span>
                        <span className="text-xs text-white/40">{ELEMENT_LABELS[c.element]}</span>
                      </div>
                      {c.description && <p className="text-sm text-white/50 mt-1 truncate">{c.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-white/40">
                        <span>HP: <span className="text-white/70">{c.hp}</span></span>
                        <span>ATK: <span className="text-white/70">{c.atk}</span></span>
                        <span>DEF: <span className="text-white/70">{c.def}</span></span>
                        {c.evolution_of && (
                          <span>Evolve da: <span className="text-white/70">{creatures.find(x => x.id === c.evolution_of)?.name ?? '—'}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(c)}
                        className="bg-white/10 text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors">
                        Modifica
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={deletingId === c.id}
                        className="bg-red-500/20 text-red-400 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50">
                        {deletingId === c.id ? '...' : 'Elimina'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border border-white/20 rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Genera Artwork AI</h2>
        <p className="text-sm text-white/50 mb-4">
          Inserisci il nome di una creatura per generare automaticamente il suo artwork con l&apos;intelligenza artificiale.
        </p>
        <div className="flex gap-2 mb-4">
          <input type="text" value={artworkCreatureName} placeholder="Nome creatura..."
            onChange={e => setArtworkCreatureName(e.target.value)}
            className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          <button disabled={!artworkCreatureName.trim()}
            className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50">
            Genera Artwork
          </button>
        </div>
        <div className="bg-white/5 rounded-xl p-4 text-white/50 text-center">
          Generazione artwork non ancora disponibile
        </div>
      </div>
    </div>
  )
}
