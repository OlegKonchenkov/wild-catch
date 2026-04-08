'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminListSkeleton } from '@/components/admin/AdminLoading'

type ItemType = 'rete' | 'esca' | 'uovo' | 'battaglia' | 'pozione' | 'cura' | 'custom'
type EggRarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario' | 'mitologico'

interface Item {
  id: string
  name: string
  type: ItemType
  effect_value: number
  description: string
  shop_price: number
  image_url: string | null
  session_id: string | null
  egg_rarity?: string | null
  steps_required?: number | null
  is_redeemable?: boolean
  in_shop?: boolean
  reward?: { gold?: number; exp?: number; bonus_items?: Array<{ item_id: string; quantity: number }> }
}

interface TypeMeta {
  icon: string
  label: string
  hint: string
  effectLabel: string
  effectHint: string
  effectStep: string
  effectMin: number
  effectMax: number
}

const TYPE_META: Record<ItemType, TypeMeta> = {
  rete: {
    icon: '🕸️', label: 'Rete (cattura)',
    hint: 'Usata per catturare le creature durante uno scontro. Può essere di tipo normale, potenziata, etc.',
    effectLabel: 'Bonus cattura (additivo)',
    effectHint: '0.10 = +10% · 0.25 = +25% · Max consigliato: 0.50',
    effectStep: '0.01', effectMin: 0, effectMax: 1,
  },
  esca: {
    icon: '🪱', label: 'Esca (spawn)',
    hint: 'Attiva uno spawn potenziato di creature attorno al giocatore per la durata impostata.',
    effectLabel: 'Durata attivazione (secondi)',
    effectHint: '300 = 5 min · 600 = 10 min · 1800 = 30 min',
    effectStep: '60', effectMin: 60, effectMax: 7200,
  },
  uovo: {
    icon: '🥚', label: 'Uovo',
    hint: 'Si schiude dopo aver percorso i passi di incubazione impostati (0 = istantaneo al ritiro).',
    effectLabel: 'Livello minimo giocatore richiesto',
    effectHint: 'Il giocatore deve essere almeno a questo livello per poter schiudere l\'uovo. 0 = nessun requisito.',
    effectStep: '1', effectMin: 0, effectMax: 50,
  },
  battaglia: {
    icon: '⚔️', label: 'Battaglia (ATK)',
    hint: 'Potenzia i danni inflitti in combattimento. Attivabile durante i duelli PvP o scontri con creature.',
    effectLabel: 'Bonus danni (%)',
    effectHint: 'Es. 10 = +10% danni · 25 = +25% danni',
    effectStep: '1', effectMin: 0, effectMax: 200,
  },
  pozione: {
    icon: '🧪', label: 'Pozione (resistenza)',
    hint: 'Riduce o annulla la debolezza elementale del giocatore nel prossimo scontro o duello.',
    effectLabel: 'Riduzione debolezza (0.0 – 1.0)',
    effectHint: '0.5 = dimezza i danni extra da svantaggio · 1.0 = nega completamente la debolezza',
    effectStep: '0.1', effectMin: 0, effectMax: 1,
  },
  cura: {
    icon: '💊', label: 'Cura (HP)',
    hint: 'Recupera HP durante un combattimento o duello. Utilizzabile una volta per turno.',
    effectLabel: 'HP curati per utilizzo',
    effectHint: 'Es. 15 = +15 HP · 30 = +30 HP · 50 = +50 HP',
    effectStep: '1', effectMin: 1, effectMax: 500,
  },
  custom: {
    icon: '🎁', label: 'Oggetto custom',
    hint: 'Oggetto speciale creato dall\'admin. Può essere riscattato tramite QR code. Sempre is_redeemable = true.',
    effectLabel: '—',
    effectHint: '',
    effectStep: '1', effectMin: 0, effectMax: 0,
  },
}

const EGG_RARITIES: EggRarity[] = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']
const EGG_RARITY_LABEL: Record<EggRarity, string> = {
  comune: '⚪ Comune', non_comune: '🟢 Non comune', raro: '🔵 Raro',
  epico: '🟣 Epico', leggendario: '🟡 Leggendario', mitologico: '🌌 Mitologico',
}

const EMPTY_FORM = {
  name: '', type: 'rete' as ItemType, effect_value: 0,
  description: '', shop_price: 0, image_url: '',
  session_id: '', egg_rarity: 'comune' as EggRarity, steps_required: 0,
  is_redeemable: false, in_shop: true,
  reward_gold: 0, reward_exp: 0,
  reward_items: [] as Array<{ item_id: string; quantity: number }>,
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

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: () => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-white/70">{label}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#34d399]' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
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

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative w-16 h-16">
          <img src={value} alt="" className="w-full h-full object-contain rounded-lg bg-white/5 border border-white/10" />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center">
            ✕
          </button>
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
      {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function ItemsPage() {
  const [items, setItems]       = useState<Item[]>([])
  const [loading, setLoading]   = useState(true)
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [filter, setFilter]     = useState('')
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all')
  const [panel, setPanel]       = useState<null | 'new' | Item>(null)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sessionFilter, setSessionFilter] = useState<string>('')

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
    setItems(d.items ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm({ ...EMPTY_FORM }); setError(''); setPanel('new')
  }

  function openEdit(item: Item) {
    setForm({
      name: item.name, type: item.type, effect_value: item.effect_value,
      description: item.description, shop_price: item.shop_price,
      image_url: item.image_url ?? '',
      session_id: item.session_id ?? '',
      egg_rarity: (item.egg_rarity as EggRarity) ?? 'comune',
      steps_required: item.steps_required ?? 0,
      is_redeemable: item.is_redeemable ?? false,
      in_shop: item.in_shop ?? true,
      reward_gold: item.reward?.gold ?? 0,
      reward_exp: item.reward?.exp ?? 0,
      reward_items: item.reward?.bonus_items ?? [],
    })
    setError(''); setPanel(item)
  }

  function closePanel() { setPanel(null); setError('') }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome obbligatorio'); return }
    if (form.type === 'custom' && !form.description.trim()) { setError('Descrizione obbligatoria per oggetti custom'); return }
    if (form.type === 'custom' && !form.image_url.trim()) { setError('Immagine obbligatoria per oggetti custom'); return }
    setSaving(true); setError('')
    const isEdit = panel !== null && panel !== 'new'
    const payload: Record<string, unknown> = {
      name: form.name, type: form.type,
      description: form.description,
      image_url: form.image_url || null,
      session_id: form.session_id || null,
    }

    if (form.type === 'custom') {
      payload.in_shop = form.in_shop
      payload.shop_price = form.in_shop ? Number(form.shop_price) || 0 : 0
      payload.is_redeemable = true
      payload.effect_value = 0
      payload.reward = {
        gold: Number(form.reward_gold) || 0,
        exp: Number(form.reward_exp) || 0,
        bonus_items: form.reward_items.filter(ri => ri.item_id),
      }
    } else {
      payload.effect_value = form.effect_value
      payload.shop_price = form.shop_price
      payload.is_redeemable = false
      payload.in_shop = true
      payload.reward = {}
    }

    if (form.type === 'uovo') {
      payload.egg_rarity = form.egg_rarity
      payload.steps_required = Number(form.steps_required) || 0
    }
    if (isEdit) payload.id = (panel as Item).id
    const res = await fetch('/api/admin/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    if (!confirm(`Eliminare "${item.name}"?\nSarà rimosso da negozi e inventari.`)) return
    setDeletingId(item.id)
    await fetch('/api/admin/items', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
    setItems(prev => prev.filter(it => it.id !== item.id))
    setDeletingId(null)
  }

  const filtered = items.filter(it => {
    const matchType = typeFilter === 'all' || it.type === typeFilter
    const matchSearch = !filter || it.name.toLowerCase().includes(filter.toLowerCase()) || it.description.toLowerCase().includes(filter.toLowerCase())
    const matchSession = sessionFilter === '' || (sessionFilter === '__null__' ? it.session_id === null : it.session_id === sessionFilter)
    return matchType && matchSearch && matchSession
  })

  const meta = TYPE_META[form.type]
  const sessionName = (sid: string | null) => sessions.find(s => s.id === sid)?.name ?? null
  const isCustom = form.type === 'custom'

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🎒 Oggetti</h1>
        <button onClick={openNew} className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm">
          + Nuovo oggetto
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Cerca per nome..."
          className="flex-1 min-w-36 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
          <option value="all">Tutti i tipi</option>
          {(Object.keys(TYPE_META) as ItemType[]).map(t => (
            <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
          ))}
        </select>
        <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
          <option value="">📋 Tutte le sessioni</option>
          <option value="__null__">🌐 Globali (nessuna sessione)</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Items list */}
      {loading ? (
        <AdminListSkeleton rows={5} itemClassName="h-[86px]" />
      ) : filtered.length === 0 ? (
        <p className="text-white/30 text-sm">Nessun oggetto trovato.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const tmeta = TYPE_META[item.type]
            const sname = sessionName(item.session_id)
            return (
              <div key={item.id}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                {item.image_url ? (
                  <img src={item.image_url} alt=""
                    className="w-10 h-10 object-contain rounded-lg bg-white/5 shrink-0" />
                ) : (
                  <span className="text-2xl shrink-0 w-10 text-center">{tmeta.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white text-sm">{item.name}</p>
                    <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{tmeta.label}</span>
                    {item.type !== 'custom' && (
                      <span className="text-xs text-[#F7C841]">🪙 {item.shop_price}</span>
                    )}
                    {item.type === 'custom' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.in_shop ? 'bg-[#F7C841]/15 text-[#F7C841]/80' : 'bg-white/8 text-white/40'}`}>
                        {item.in_shop ? `🪙 ${item.shop_price}` : '🔒 Solo admin'}
                      </span>
                    )}
                    {sname && (
                      <span className="text-xs bg-[#3A9DBC]/15 text-[#3A9DBC]/80 px-2 py-0.5 rounded-full">
                        🎯 {sname}
                      </span>
                    )}
                    {item.is_redeemable && (
                      <span className="text-xs bg-[#34d399]/15 text-[#34d399]/80 px-2 py-0.5 rounded-full">✅ Riscattabile</span>
                    )}
                  </div>
                  <p className="text-xs text-white/45 mt-0.5 truncate">{item.description || '—'}</p>
                  {item.type !== 'custom' && (
                    <p className="text-xs text-white/30 mt-0.5">
                      {tmeta.effectLabel}: <span className="text-white/50">{item.effect_value}</span>
                      {item.type === 'uovo' && item.egg_rarity && (
                        <span className="ml-2 text-white/30">· {EGG_RARITY_LABEL[item.egg_rarity as EggRarity] ?? item.egg_rarity}</span>
                      )}
                      {item.type === 'uovo' && (item.steps_required ?? 0) > 0 && (
                        <span className="ml-2 text-white/30">· {item.steps_required} passi</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(item)}
                    className="text-[#3A9DBC] hover:text-[#3A9DBC]/80 text-sm px-2 py-1 rounded transition-colors">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(item)} disabled={deletingId === item.id}
                    className="text-red-400/60 hover:text-red-400 text-sm px-2 py-1 rounded transition-colors disabled:opacity-30">
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
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

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Tipo *</label>
                <select className={cls} value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as ItemType }))}>
                  {(Object.keys(TYPE_META) as ItemType[]).map(t => (
                    <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
                  ))}
                </select>
                <p className="text-xs text-white/30 mt-1.5 leading-relaxed">{meta.hint}</p>
              </div>

              {/* ── Custom type fields ─────────────────────── */}
              {isCustom && (
                <div className="bg-[#3A9DBC]/5 border border-[#3A9DBC]/20 rounded-xl p-3 space-y-4">
                  <p className="text-xs text-[#3A9DBC]/80 font-semibold">🎁 Configurazione oggetto custom</p>

                  <Field label="Descrizione *" hint="Mostrata al giocatore nello zaino e al momento del riscatto">
                    <textarea className={cls} rows={2} value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="es. Coupon per una consumazione gratuita..." />
                  </Field>

                  <Field label="Immagine *" hint="Obbligatoria per gli oggetti custom — carica o incolla URL">
                    <ImageUpload value={form.image_url}
                      onChange={url => setForm(f => ({ ...f, image_url: url }))} />
                  </Field>

                  <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-3">
                    <Toggle
                      checked={form.in_shop}
                      onChange={() => setForm(f => ({ ...f, in_shop: !f.in_shop }))}
                      label="Disponibile in negozio"
                      sub="Se disattivato, l'oggetto può essere assegnato solo dall'admin"
                    />
                    {form.in_shop && (
                      <Field label="Prezzo negozio 🪙">
                        <input type="number" className={cls} value={form.shop_price} min={0}
                          onChange={e => setForm(f => ({ ...f, shop_price: +e.target.value }))} />
                      </Field>
                    )}
                  </div>

                  {/* Redeemable rewards — always visible for custom */}
                  <div className="bg-white/3 border border-white/10 rounded-xl p-3 space-y-3">
                    <p className="text-xs font-semibold text-white/70">✅ Ricompensa al riscatto QR</p>
                    <p className="text-xs text-white/30">Risorse assegnate al giocatore quando l&apos;admin valida l&apos;oggetto tramite scansione QR</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-white/50 mb-1">💰 Oro</label>
                        <input type="number" min={0} className={cls} value={form.reward_gold}
                          onChange={e => setForm(f => ({ ...f, reward_gold: +e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">⭐ EXP</label>
                        <input type="number" min={0} className={cls} value={form.reward_exp}
                          onChange={e => setForm(f => ({ ...f, reward_exp: +e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-white/50">🎒 Oggetti bonus</p>
                      {form.reward_items.map((ri, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={ri.item_id}
                            onChange={e => setForm(f => {
                              const arr = [...f.reward_items]; arr[i] = { ...arr[i], item_id: e.target.value }
                              return { ...f, reward_items: arr }
                            })}
                            className="flex-1 bg-[#0F1F2E] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs"
                          >
                            <option value="">— Seleziona —</option>
                            {items.filter(it => it.type !== 'custom').map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                          </select>
                          <input type="number" min={1} value={ri.quantity}
                            onChange={e => setForm(f => {
                              const arr = [...f.reward_items]; arr[i] = { ...arr[i], quantity: Math.max(1, +e.target.value) }
                              return { ...f, reward_items: arr }
                            })}
                            className="w-14 bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs text-center"
                          />
                          <button type="button" onClick={() => setForm(f => ({ ...f, reward_items: f.reward_items.filter((_, j) => j !== i) }))}
                            className="text-red-400/60 hover:text-red-400 text-sm px-1">×</button>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, reward_items: [...f.reward_items, { item_id: '', quantity: 1 }] }))}
                        className="text-xs text-[#3A9DBC] font-semibold hover:text-[#5AB5D0]">
                        + Aggiungi oggetto
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Non-custom type fields ─────────────────── */}
              {!isCustom && (
                <>
                  <Field label={meta.effectLabel} hint={meta.effectHint}>
                    <input type="number" className={cls} value={form.effect_value}
                      step={meta.effectStep} min={meta.effectMin} max={meta.effectMax}
                      onChange={e => setForm(f => ({ ...f, effect_value: +e.target.value }))} />
                  </Field>

                  {/* Egg-specific fields */}
                  {form.type === 'uovo' && (
                    <div className="bg-[#F7C841]/5 border border-[#F7C841]/20 rounded-xl p-3 space-y-3">
                      <p className="text-xs text-[#F7C841]/70 font-semibold">🥚 Configurazione uovo</p>
                      <Field label="Rarità uovo"
                        hint="Determina il pool di creature ottenibili — uovo comune → solo comuni; uovo leggendario → maggiori probabilità di rare">
                        <select className={cls} value={form.egg_rarity}
                          onChange={e => setForm(f => ({ ...f, egg_rarity: e.target.value as EggRarity }))}>
                          {EGG_RARITIES.map(r => (
                            <option key={r} value={r}>{EGG_RARITY_LABEL[r]}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Passi di incubazione"
                        hint="Il giocatore deve percorrere questo numero di passi dal momento del ritiro prima di poter schiudere. 0 = schiusura immediata.">
                        <input type="number" className={cls} value={form.steps_required}
                          step={50} min={0}
                          onChange={e => setForm(f => ({ ...f, steps_required: +e.target.value }))} />
                      </Field>
                    </div>
                  )}

                  <Field label="Descrizione" hint="Testo mostrato al giocatore nello zaino e nel negozio">
                    <textarea className={cls} rows={2} value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="es. Una rete resistente che aumenta le probabilità di cattura..." />
                  </Field>

                  <Field label="Prezzo negozio 🪙" hint="0 = non in vendita nel negozio">
                    <input type="number" className={cls} value={form.shop_price} min={0}
                      onChange={e => setForm(f => ({ ...f, shop_price: +e.target.value }))} />
                  </Field>

                  <Field label="Immagine / icona personalizzata"
                    hint="Sostituisce l'icona di default. Puoi incollare un URL o caricare un file (max 5 MB).">
                    <ImageUpload value={form.image_url}
                      onChange={url => setForm(f => ({ ...f, image_url: url }))} />
                  </Field>
                </>
              )}

              <Field label="Disponibile in"
                hint="Lascia vuoto per renderlo disponibile in tutte le sessioni">
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
