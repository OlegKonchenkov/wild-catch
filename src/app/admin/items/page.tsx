'use client'
import { useState, useEffect, useMemo } from 'react'

interface Item {
  id: string
  name: string
  type: 'rete' | 'esca' | 'uovo' | 'battaglia'
  effect_value: number
  description: string
  shop_price: number
}

const TYPE_META: Record<Item['type'], { label: string; icon: string; hint: string }> = {
  rete:      { icon: '🕸️', label: 'Rete (cattura)',  hint: 'Aumenta la probabilità di cattura. effect_value = bonus % (es. 0.10 = +10%)' },
  esca:      { icon: '🪱', label: 'Esca (spawn)',     hint: 'Attira creature nella zona del giocatore. effect_value = durata in secondi' },
  uovo:      { icon: '🥚', label: 'Uovo',             hint: 'Contiene una creatura da schiudere. effect_value = livello minimo creatura' },
  battaglia: { icon: '⚔️', label: 'Battaglia',        hint: 'Usabile nei duelli. effect_value = punti danno aggiuntivi' },
}

const EMPTY: Omit<Item, 'id'> = {
  name: '', type: 'rete', effect_value: 0, description: '', shop_price: 0,
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

const cls = 'w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25'

export default function ItemsPage() {
  const [items, setItems]         = useState<Item[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('')
  const [typeFilter, setTypeFilter] = useState<Item['type'] | 'all'>('all')

  // panel: null = closed, 'new' = create, Item = edit
  const [panel, setPanel]         = useState<null | 'new' | Item>(null)
  const [form, setForm]           = useState<Omit<Item, 'id'>>({ ...EMPTY })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    const res = await fetch('/api/admin/items')
    const d   = await res.json()
    setItems(d.items ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm({ ...EMPTY }); setError(''); setPanel('new')
  }

  function openEdit(item: Item) {
    setForm({ name: item.name, type: item.type, effect_value: item.effect_value, description: item.description, shop_price: item.shop_price })
    setError(''); setPanel(item)
  }

  function closePanel() { setPanel(null); setError('') }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true); setError('')
    const isEdit = panel !== null && panel !== 'new'
    const res = await fetch('/api/admin/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { id: (panel as Item).id, ...form } : form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    if (isEdit) {
      setItems(prev => prev.map(it => it.id === (panel as Item).id ? d.item : it))
    } else {
      setItems(prev => [d.item, ...prev])
    }
    closePanel()
  }

  async function handleDelete(item: Item) {
    if (!confirm(`Eliminare l'oggetto "${item.name}"?\nAttenzione: sarà rimosso anche dai negozi e dagli inventari.`)) return
    setDeletingId(item.id)
    await fetch('/api/admin/items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
    setItems(prev => prev.filter(it => it.id !== item.id))
    setDeletingId(null)
  }

  const filtered = items.filter(it => {
    const matchType = typeFilter === 'all' || it.type === typeFilter
    const matchSearch = !filter || it.name.toLowerCase().includes(filter.toLowerCase()) || it.description.toLowerCase().includes(filter.toLowerCase())
    return matchType && matchSearch
  })

  const selectedTypeMeta = TYPE_META[form.type]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🎒 Oggetti</h1>
        <button onClick={openNew}
          className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm">
          + Nuovo oggetto
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Cerca per nome..."
          className="flex-1 min-w-36 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25"
        />
        <select
          value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Tutti i tipi</option>
          {(Object.keys(TYPE_META) as Item['type'][]).map(t => (
            <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
          ))}
        </select>
      </div>

      {/* Items list */}
      {loading ? (
        <p className="text-white/40 text-sm">Caricamento...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/30 text-sm">Nessun oggetto trovato.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl shrink-0">{TYPE_META[item.type].icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white text-sm">{item.name}</p>
                  <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{TYPE_META[item.type].label}</span>
                  <span className="text-xs text-[#F7C841]">🪙 {item.shop_price}</span>
                </div>
                <p className="text-xs text-white/45 mt-0.5 truncate">{item.description || '—'}</p>
                <p className="text-xs text-white/30 mt-0.5">Valore effetto: {item.effect_value}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(item)}
                  className="text-[#3A9DBC] hover:text-[#3A9DBC]/80 text-sm px-2 py-1 rounded transition-colors">
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="text-red-400/60 hover:text-red-400 text-sm px-2 py-1 rounded transition-colors disabled:opacity-30"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
          <p className="text-white/25 text-xs pt-1">{filtered.length} oggetti</p>
        </div>
      )}

      {/* Panel modal */}
      {panel !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closePanel() }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {panel === 'new' ? '+ Nuovo oggetto' : `✏️ Modifica: ${(panel as Item).name}`}
              </h2>
              <button onClick={closePanel} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <Field label="Nome oggetto *">
                <input className={cls} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="es. Rete Speciale" autoFocus />
              </Field>

              <Field label="Tipo *" hint={selectedTypeMeta.hint}>
                <select className={cls} value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as Item['type'] }))}>
                  {(Object.keys(TYPE_META) as Item['type'][]).map(t => (
                    <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
                  ))}
                </select>
              </Field>

              <Field
                label="Valore effetto"
                hint={selectedTypeMeta.hint}
              >
                <input type="number" className={cls} value={form.effect_value} step="0.01"
                  onChange={e => setForm(f => ({ ...f, effect_value: +e.target.value }))} />
              </Field>

              <Field label="Descrizione" hint="Testo mostrato al giocatore nello zaino e nel negozio">
                <textarea className={cls} rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="es. Una rete resistente che aumenta le probabilità di cattura..." />
              </Field>

              <Field label="Prezzo nel negozio (oro 🪙)" hint="Quanto costa acquistarlo dal negozio. 0 = non in vendita">
                <input type="number" className={cls} value={form.shop_price} min={0}
                  onChange={e => setForm(f => ({ ...f, shop_price: +e.target.value }))} />
              </Field>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={closePanel}
                  className="flex-1 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm">
                  Annulla
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                  {saving ? 'Salvataggio...' : panel === 'new' ? 'Crea oggetto' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
