'use client'
import { useState, useEffect, useCallback } from 'react'

export type FieldType = 'text' | 'textarea' | 'number' | 'rarity' | 'select' | 'json'
export interface Field {
  key: string
  label: string
  type: FieldType
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  half?: boolean
}

const RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico']

/**
 * Schema-driven CRUD panel for a catalogue table, backed by
 * /api/admin/catalog/[table] (+ /art). One component authors packs, chests,
 * prizes, and every collection entity.
 */
export default function CatalogManager({
  table, title, fields, hasArt = false, artPrompt,
}: {
  table: string
  title: string
  fields: Field[]
  hasArt?: boolean
  /** Build the default art prompt from a row. */
  artPrompt?: (row: any) => string
}) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    fetch(`/api/admin/catalog/${table}`).then(r => r.json()).then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [table])
  useEffect(load, [load])

  const blank = () => { const o: any = {}; for (const f of fields) o[f.key] = f.type === 'number' ? 0 : ''; setEditing(o) }

  async function save() {
    setBusy(true); setMsg(null)
    const method = editing.id ? 'PATCH' : 'POST'
    const body = { ...editing }
    // Coerce JSON fields
    for (const f of fields) if (f.type === 'json' && typeof body[f.key] === 'string' && body[f.key].trim()) {
      try { body[f.key] = JSON.parse(body[f.key]) } catch { setMsg({ ok: false, text: `JSON non valido in "${f.label}"` }); setBusy(false); return }
    }
    const res = await fetch(`/api/admin/catalog/${table}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setMsg({ ok: true, text: 'Salvato' }); setEditing(null); load() }
    else setMsg({ ok: false, text: d.error ?? 'Errore' })
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questo elemento?')) return
    const res = await fetch(`/api/admin/catalog/${table}?id=${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  async function genArt(row: any) {
    const prompt = artPrompt ? artPrompt(row) : `${row.name ?? row.title}: ${row.description ?? ''}`
    setBusy(true); setMsg({ ok: true, text: 'Generazione arte…' })
    const res = await fetch(`/api/admin/catalog/${table}/art`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, prompt }) })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setMsg({ ok: true, text: 'Arte generata' }); load() }
    else setMsg({ ok: false, text: d.error ?? 'Errore arte' })
  }

  function fieldInput(f: Field) {
    const v = editing[f.key] ?? ''
    const set = (val: any) => setEditing({ ...editing, [f.key]: val })
    const cls = 'w-full bg-[#0F1F2E] text-white border border-white/20 rounded-lg px-3 py-2 text-sm'
    if (f.type === 'textarea' || f.type === 'json')
      return <textarea value={typeof v === 'object' ? JSON.stringify(v, null, 2) : v} onChange={e => set(e.target.value)} placeholder={f.placeholder} rows={f.type === 'json' ? 4 : 2} className={cls + ' font-mono'} />
    if (f.type === 'number')
      return <input type="number" value={v} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} className={cls} />
    if (f.type === 'rarity')
      return <select value={v ?? ''} onChange={e => set(e.target.value)} className={cls}><option value="">—</option>{RARITIES.map(r => <option key={r} value={r}>{r}</option>)}</select>
    if (f.type === 'select')
      return <select value={v ?? ''} onChange={e => set(e.target.value)} className={cls}><option value="">—</option>{(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    return <input value={v ?? ''} onChange={e => set(e.target.value)} placeholder={f.placeholder} className={cls} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">{title} <span className="text-white/30 text-sm font-normal">({rows.length})</span></h3>
        <button onClick={blank} className="bg-[#3A9DBC] text-white text-sm font-bold px-3 py-1.5 rounded-lg">+ Nuovo</button>
      </div>

      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{msg.text}</p>}

      {editing && (
        <div className="rounded-xl border border-[#3A9DBC]/40 bg-[#0c1c2b] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.half ? '' : 'col-span-2'}>
                <label className="block text-xs font-semibold text-white/50 mb-1">{f.label}</label>
                {fieldInput(f)}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50">{editing.id ? 'Salva' : 'Crea'}</button>
            <button onClick={() => setEditing(null)} className="flex-1 bg-white/5 text-white/60 font-semibold py-2 rounded-lg text-sm">Annulla</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-white/40 text-sm">Caricamento…</p> : (
        <div className="space-y-1.5">
          {rows.map(row => (
            <div key={row.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2">
              {hasArt && (
                <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {row.image_url ? <img src={row.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-white/20 text-lg">🖼️</span>}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{row.name ?? row.title}{row.rarity ? <span className="text-white/30 font-normal"> · {row.rarity}</span> : null}</p>
                <p className="text-white/35 text-xs truncate">{row.description ?? row.body ?? ''}</p>
              </div>
              {hasArt && <button onClick={() => genArt(row)} disabled={busy} className="text-xs bg-purple-600/70 text-white px-2 py-1 rounded-md disabled:opacity-40">🎨</button>}
              <button onClick={() => setEditing(row)} className="text-xs bg-white/5 text-white/70 px-2 py-1 rounded-md">✎</button>
              <button onClick={() => remove(row.id)} className="text-xs bg-red-500/15 text-red-300 px-2 py-1 rounded-md">🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
