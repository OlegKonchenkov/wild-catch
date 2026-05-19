'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminListSkeleton } from '@/components/admin/AdminLoading'
import { EQUIPMENT_SLOTS, EQUIPMENT_SLOT_META } from '@/lib/game/equipment'
import { RARITY_COLORS, RARITY_LABELS } from '@/lib/types'
import type { EquipmentSlot, Rarity } from '@/lib/types'

interface EquipItem {
  id: string
  name: string
  type: EquipmentSlot
  description: string
  image_url: string | null
  session_id: string | null
  rarity: Rarity | null
  bonus_hp: number
  bonus_atk: number
  bonus_def: number
}

const RARITIES: Rarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']

const EMPTY_FORM = {
  name: '', type: 'arma' as EquipmentSlot, description: '', image_url: '',
  session_id: '', rarity: 'comune' as Rarity, bonus_hp: 0, bonus_atk: 0, bonus_def: 0,
}

const cls = 'w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/30 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

function ImageField({
  value, onChange, itemId,
}: { value: string; onChange: (url: string) => void; itemId: string | null }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiQuality, setAiQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [aiLoading, setAiLoading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const d = await res.json()
    if (res.ok) { onChange(d.url) } else { setUploadError(d.error ?? 'Errore upload') }
    setUploading(false)
    if (ref.current) ref.current.value = ''
  }

  async function generateAI() {
    if (!itemId) { setUploadError('Salva prima l\'oggetto, poi genera l\'immagine'); return }
    if (!aiPrompt.trim()) { setUploadError('Inserisci una descrizione per la generazione'); return }
    setAiLoading(true); setUploadError('')
    const res = await fetch(`/api/admin/items/${itemId}/artwork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: aiPrompt, quality: aiQuality }),
    })
    const d = await res.json()
    setAiLoading(false)
    if (res.ok && d.imageUrl) { onChange(d.imageUrl) } else { setUploadError(d.error ?? 'Errore generazione') }
  }

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative w-16 h-16">
          <img src={value} alt="" className="w-full h-full object-contain rounded-lg bg-white/5 border border-white/10" />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center">✕</button>
        </div>
      )}
      <div className="flex gap-2">
        <input value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-xs placeholder:text-white/25"
          placeholder="https://... oppure carica →" />
        <button type="button" disabled={uploading} onClick={() => ref.current?.click()}
          className="shrink-0 px-3 py-2 bg-white/10 border border-white/20 text-white/70 text-xs rounded-lg hover:bg-white/15 disabled:opacity-50 whitespace-nowrap">
          {uploading ? '⏳' : '📷 Carica'}
        </button>
      </div>

      <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-white/60">🎨 Genera con AI (gpt-image-2)</p>
        <textarea className={cls} rows={2} value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="es. spada corta di bronzo con elsa intrecciata, stile fantasy" />
        <div className="flex gap-2">
          <select className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1.5 text-xs"
            value={aiQuality} onChange={e => setAiQuality(e.target.value as any)}>
            <option value="low">Qualità bassa (veloce)</option>
            <option value="medium">Qualità media</option>
            <option value="high">Qualità alta (lenta)</option>
          </select>
          <button type="button" disabled={aiLoading || !itemId} onClick={generateAI}
            className="shrink-0 px-3 py-1.5 bg-[#7B4DB8] text-white text-xs rounded-lg disabled:opacity-40 whitespace-nowrap">
            {aiLoading ? '⏳ Genero...' : '✨ Genera'}
          </button>
        </div>
        {!itemId && <p className="text-xs text-white/30">Salva l&apos;oggetto per abilitare la generazione AI.</p>}
      </div>

      {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function EquipaggiamentoPage() {
  const [items, setItems]       = useState<EquipItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [filter, setFilter]     = useState('')
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | 'all'>('all')
  const [panel, setPanel]       = useState<null | 'new' | EquipItem>(null)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    loadItems()
    supabase.from('sessions').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })
  }, [supabase])

  async function loadItems() {
    setLoading(true)
    const res = await fetch('/api/admin/items')
    const d = await res.json()
    const all: any[] = d.items ?? []
    setItems(all.filter(it => (EQUIPMENT_SLOTS as string[]).includes(it.type)))
    setLoading(false)
  }

  function openNew() { setForm({ ...EMPTY_FORM }); setError(''); setPanel('new') }

  function openEdit(item: EquipItem) {
    setForm({
      name: item.name, type: item.type, description: item.description,
      image_url: item.image_url ?? '', session_id: item.session_id ?? '',
      rarity: (item.rarity as Rarity) ?? 'comune',
      bonus_hp: item.bonus_hp ?? 0, bonus_atk: item.bonus_atk ?? 0, bonus_def: item.bonus_def ?? 0,
    })
    setError(''); setPanel(item)
  }

  function closePanel() { setPanel(null); setError('') }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true); setError('')
    const isEdit = panel !== null && panel !== 'new'
    const payload: Record<string, unknown> = {
      name: form.name, type: form.type, description: form.description,
      image_url: form.image_url || null, session_id: form.session_id || null,
      rarity: form.rarity,
      bonus_hp: Number(form.bonus_hp) || 0,
      bonus_atk: Number(form.bonus_atk) || 0,
      bonus_def: Number(form.bonus_def) || 0,
      effect_value: 0, shop_price: 0,
    }
    if (isEdit) payload.id = (panel as EquipItem).id
    const res = await fetch('/api/admin/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    if (isEdit) {
      setItems(prev => prev.map(it => it.id === (panel as EquipItem).id ? d.item : it))
      setPanel(d.item)
    } else {
      setItems(prev => [d.item, ...prev])
      setPanel(d.item)
    }
  }

  async function handleDelete(item: EquipItem) {
    if (!confirm(`Eliminare "${item.name}"?\nSarà rimosso da inventari e creature equipaggiate.`)) return
    setDeletingId(item.id)
    await fetch('/api/admin/items', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
    setItems(prev => prev.filter(it => it.id !== item.id))
    setDeletingId(null)
  }

  const filtered = items.filter(it => {
    const matchSlot = slotFilter === 'all' || it.type === slotFilter
    const matchSearch = !filter || it.name.toLowerCase().includes(filter.toLowerCase())
    return matchSlot && matchSearch
  })

  const editingId = panel !== null && panel !== 'new' ? (panel as EquipItem).id : null

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🛡️ Equipaggiamento</h1>
        <button onClick={openNew} className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm">
          + Nuovo pezzo
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Cerca per nome..."
          className="flex-1 min-w-36 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25" />
        <select value={slotFilter} onChange={e => setSlotFilter(e.target.value as any)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
          <option value="all">Tutti gli slot</option>
          {EQUIPMENT_SLOTS.map(s => (
            <option key={s} value={s}>{EQUIPMENT_SLOT_META[s].emoji} {EQUIPMENT_SLOT_META[s].label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <AdminListSkeleton rows={5} itemClassName="h-[86px]" />
      ) : filtered.length === 0 ? (
        <p className="text-white/30 text-sm">Nessun pezzo di equipaggiamento.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const smeta = EQUIPMENT_SLOT_META[item.type]
            const rColor = item.rarity ? RARITY_COLORS[item.rarity] : '#888'
            return (
              <div key={item.id}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-10 h-10 object-contain rounded-lg bg-white/5 shrink-0" />
                ) : (
                  <span className="text-2xl shrink-0 w-10 text-center">{smeta.emoji}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white text-sm">{item.name}</p>
                    <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{smeta.emoji} {smeta.label}</span>
                    {item.rarity && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${rColor}1A`, color: rColor, border: `1px solid ${rColor}40` }}>
                        {RARITY_LABELS[item.rarity]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/45 mt-0.5 truncate">{item.description || '—'}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {item.bonus_hp ? <span className="mr-2 text-[#34D399]">+{item.bonus_hp} HP</span> : null}
                    {item.bonus_atk ? <span className="mr-2 text-[#FB7185]">+{item.bonus_atk} ATK</span> : null}
                    {item.bonus_def ? <span className="mr-2 text-[#60A5FA]">+{item.bonus_def} DEF</span> : null}
                    {!item.bonus_hp && !item.bonus_atk && !item.bonus_def ? <span>nessun bonus</span> : null}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(item)}
                    className="text-[#3A9DBC] hover:text-[#3A9DBC]/80 text-sm px-2 py-1 rounded transition-colors">✏️</button>
                  <button onClick={() => handleDelete(item)} disabled={deletingId === item.id}
                    className="text-red-400/60 hover:text-red-400 text-sm px-2 py-1 rounded transition-colors disabled:opacity-30">🗑</button>
                </div>
              </div>
            )
          })}
          <p className="text-white/25 text-xs pt-1">{filtered.length} pezzi</p>
        </div>
      )}

      {panel !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closePanel() }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {panel === 'new' ? '+ Nuovo pezzo' : `✏️ ${(panel as EquipItem).name}`}
              </h2>
              <button onClick={closePanel} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <Field label="Nome *">
                <input className={cls} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="es. Spada del Bosco" autoFocus />
              </Field>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Slot *</label>
                <select className={cls} value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as EquipmentSlot }))}>
                  {EQUIPMENT_SLOTS.map(s => (
                    <option key={s} value={s}>{EQUIPMENT_SLOT_META[s].emoji} {EQUIPMENT_SLOT_META[s].label}</option>
                  ))}
                </select>
              </div>

              <Field label="Rarità" hint="Indicativa del potere del pezzo — usala come riferimento di bilanciamento">
                <select className={cls} value={form.rarity}
                  onChange={e => setForm(f => ({ ...f, rarity: e.target.value as Rarity }))}>
                  {RARITIES.map(r => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-3 gap-2">
                <Field label="+HP">
                  <input type="number" min={0} className={cls} value={form.bonus_hp}
                    onChange={e => setForm(f => ({ ...f, bonus_hp: +e.target.value }))} />
                </Field>
                <Field label="+ATK">
                  <input type="number" min={0} className={cls} value={form.bonus_atk}
                    onChange={e => setForm(f => ({ ...f, bonus_atk: +e.target.value }))} />
                </Field>
                <Field label="+DEF">
                  <input type="number" min={0} className={cls} value={form.bonus_def}
                    onChange={e => setForm(f => ({ ...f, bonus_def: +e.target.value }))} />
                </Field>
              </div>

              <Field label="Descrizione" hint="Mostrata al giocatore nello zaino e nella DaimonDex">
                <textarea className={cls} rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="es. Una lama leggera intrisa di linfa del Bosco..." />
              </Field>

              <Field label="Immagine / icona">
                <ImageField value={form.image_url} itemId={editingId}
                  onChange={url => setForm(f => ({ ...f, image_url: url }))} />
              </Field>

              <Field label="Disponibile in" hint="Lascia vuoto per tutte le sessioni">
                <select className={cls} value={form.session_id}
                  onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}>
                  <option value="">🌐 Tutte le sessioni</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>🎯 {s.name}</option>)}
                </select>
              </Field>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={closePanel}
                  className="flex-1 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm">
                  Chiudi
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                  {saving ? 'Salvataggio...' : panel === 'new' ? 'Crea pezzo' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
