'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Rarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario'
type Element = 'acqua' | 'terra' | 'aria' | 'fuoco' | 'elettro' | 'natura' | 'neutro'

interface Creature {
  id: string
  name: string
  description: string | null
  rarity: Rarity
  element: Element
  base_hp: number
  base_attack: number
  base_defense: number
  evolution_of: string | null
  artwork_url: string | null
  created_at: string
}

const RARITIES: Rarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario']
const ELEMENTS: Element[] = ['acqua', 'terra', 'aria', 'fuoco', 'elettro', 'natura', 'neutro']

const RARITY_LABELS: Record<Rarity, string> = {
  comune: 'Comune',
  non_comune: 'Non Comune',
  raro: 'Raro',
  epico: 'Epico',
  leggendario: 'Leggendario',
}

const RARITY_COLORS: Record<Rarity, string> = {
  comune: 'text-white/50',
  non_comune: 'text-green-400',
  raro: 'text-[#3A9DBC]',
  epico: 'text-purple-400',
  leggendario: 'text-yellow-400',
}

const ELEMENT_LABELS: Record<Element, string> = {
  acqua: 'Acqua',
  terra: 'Terra',
  aria: 'Aria',
  fuoco: 'Fuoco',
  elettro: 'Elettro',
  natura: 'Natura',
  neutro: 'Neutro',
}

const EMPTY_FORM = {
  name: '',
  description: '',
  rarity: 'comune' as Rarity,
  element: 'neutro' as Element,
  base_hp: 50,
  base_attack: 10,
  base_defense: 5,
  evolution_of: '',
}

export default function CreaturesPage() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // AI artwork state
  const [artworkCreatureName, setArtworkCreatureName] = useState('')

  useEffect(() => {
    loadCreatures()
  }, [supabase])

  async function loadCreatures() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/creatures')
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Errore nel caricamento')
    } else {
      const d = await res.json()
      setCreatures(d.creatures ?? [])
    }
    setLoading(false)
  }

  function startNew() {
    setEditingId(null)
    setFormData({ ...EMPTY_FORM })
    setFormError(null)
    setShowNewForm(true)
  }

  function startEdit(c: Creature) {
    setShowNewForm(false)
    setEditingId(c.id)
    setFormData({
      name: c.name,
      description: c.description ?? '',
      rarity: c.rarity,
      element: c.element,
      base_hp: c.base_hp,
      base_attack: c.base_attack,
      base_defense: c.base_defense,
      evolution_of: c.evolution_of ?? '',
    })
    setFormError(null)
  }

  function cancelForm() {
    setShowNewForm(false)
    setEditingId(null)
    setFormData({ ...EMPTY_FORM })
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)

    const payload = {
      name: formData.name,
      description: formData.description || null,
      rarity: formData.rarity,
      element: formData.element,
      base_hp: Number(formData.base_hp),
      base_attack: Number(formData.base_attack),
      base_defense: Number(formData.base_defense),
      evolution_of: formData.evolution_of || null,
    }

    const url = editingId ? `/api/admin/creatures/${editingId}` : '/api/admin/creatures'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const d = await res.json()
      setFormError(d.error ?? 'Errore durante il salvataggio')
    } else {
      cancelForm()
      await loadCreatures()
    }
    setFormLoading(false)
  }

  async function handleDelete(c: Creature) {
    if (!window.confirm(`Eliminare la creatura "${c.name}"? Questa azione è irreversibile.`)) return

    const res = await fetch(`/api/admin/creatures/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Errore durante l\'eliminazione')
    } else {
      await loadCreatures()
    }
  }

  function renderForm(isEdit: boolean) {
    return (
      <form onSubmit={handleSubmit} className="border border-white/20 rounded-2xl p-6 space-y-4 mb-6">
        <h2 className="font-bold text-lg">{isEdit ? 'Modifica Creatura' : 'Nuova Creatura'}</h2>

        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-white/50 block mb-1">Nome *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm text-white/50 block mb-1">Descrizione</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-white/50 block mb-1">Rarità *</label>
            <select
              value={formData.rarity}
              onChange={e => setFormData(f => ({ ...f, rarity: e.target.value as Rarity }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            >
              {RARITIES.map(r => (
                <option key={r} value={r}>{RARITY_LABELS[r]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/50 block mb-1">Elemento *</label>
            <select
              value={formData.element}
              onChange={e => setFormData(f => ({ ...f, element: e.target.value as Element }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            >
              {ELEMENTS.map(el => (
                <option key={el} value={el}>{ELEMENT_LABELS[el]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/50 block mb-1">HP Base</label>
            <input
              type="number"
              value={formData.base_hp}
              onChange={e => setFormData(f => ({ ...f, base_hp: +e.target.value }))}
              min={1}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-white/50 block mb-1">Attacco Base</label>
            <input
              type="number"
              value={formData.base_attack}
              onChange={e => setFormData(f => ({ ...f, base_attack: +e.target.value }))}
              min={1}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-white/50 block mb-1">Difesa Base</label>
            <input
              type="number"
              value={formData.base_defense}
              onChange={e => setFormData(f => ({ ...f, base_defense: +e.target.value }))}
              min={1}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-white/50 block mb-1">Evoluzione di (opzionale)</label>
            <select
              value={formData.evolution_of}
              onChange={e => setFormData(f => ({ ...f, evolution_of: e.target.value }))}
              className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
            >
              <option value="">— Nessuna —</option>
              {creatures
                .filter(c => !isEdit || c.id !== editingId)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={cancelForm}
            className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={formLoading}
            className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
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
          <button
            onClick={startNew}
            className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-xl"
          >
            + Nuova Creatura
          </button>
        )}
      </div>

      {/* New creature form */}
      {showNewForm && renderForm(false)}

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-white/50 text-center py-12">Caricamento creature...</div>
      )}

      {/* Creatures list */}
      {!loading && creatures.length === 0 && (
        <div className="text-white/40 text-center py-12">
          Nessuna creatura nel catalogo. Creane una!
        </div>
      )}

      {!loading && creatures.length > 0 && (
        <div className="space-y-3 mb-10">
          {creatures.map(c => (
            <div key={c.id}>
              {/* Edit form inline */}
              {editingId === c.id && renderForm(true)}

              {editingId !== c.id && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white">{c.name}</p>
                        <span className={`text-xs font-semibold ${RARITY_COLORS[c.rarity]}`}>
                          {RARITY_LABELS[c.rarity]}
                        </span>
                        <span className="text-xs text-white/40">
                          {ELEMENT_LABELS[c.element]}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-sm text-white/50 mt-1 truncate">{c.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-white/40">
                        <span>HP: <span className="text-white/70">{c.base_hp}</span></span>
                        <span>ATK: <span className="text-white/70">{c.base_attack}</span></span>
                        <span>DEF: <span className="text-white/70">{c.base_defense}</span></span>
                        {c.evolution_of && (
                          <span>Evolve da: <span className="text-white/70">{creatures.find(x => x.id === c.evolution_of)?.name ?? '—'}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(c)}
                        className="bg-white/10 text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="bg-red-500/20 text-red-400 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI Artwork section */}
      <div className="border border-white/20 rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Genera Artwork AI</h2>
        <p className="text-sm text-white/50 mb-4">
          Inserisci il nome di una creatura per generare automaticamente il suo artwork con l&apos;intelligenza artificiale.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={artworkCreatureName}
            onChange={e => setArtworkCreatureName(e.target.value)}
            placeholder="Nome creatura..."
            className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
          />
          <button
            onClick={() => {
              // Placeholder: POST /api/admin/creatures/artwork — not yet implemented
            }}
            disabled={!artworkCreatureName.trim()}
            className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          >
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
