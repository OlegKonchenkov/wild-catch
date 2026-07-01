'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Ability } from '@/lib/game/abilities'

const ELEMENTS = ['fiamma', 'adriatico', 'bosco', 'terra', 'armonia'] as const
const CATEGORIES = ['attacco', 'stato', 'cura', 'potenziamento', 'difesa'] as const
const RARITIES = ['comune', 'non_comune', 'raro', 'epico', 'leggendario', 'mitologico'] as const
const STATUSES = ['paralisi', 'confusione', 'sonno', 'veleno', 'scottatura', 'congelamento', 'rigenerazione', 'marchio'] as const
const ANIM_KEYS = [
  'basic_strike', 'fire_slash', 'fire_nova', 'water_wave', 'water_spout', 'leaf_storm', 'vine_whip',
  'quake', 'rock_guard', 'harmony_beam', 'harmony_heal', 'charge_beam', 'multi_strike',
  'shadow_mark', 'venom_spit', 'frost_shard', 'thunder_zap', 'regen_bloom', 'buff_roar', 'debuff_screech',
] as const

type Form = Partial<Ability> & { name: string }

const BLANK: Form = {
  name: '', description: '', element: null, category: 'attacco', rarity: null,
  power: 1, accuracy: 1, target: 'enemy', priority: 0,
  charge_turns: 0, recharge_turns: 0, cooldown: 0, max_uses: null, hits_min: 1, hits_max: 1,
  status_effect: null, status_chance: 0, self_status: null, heal_percent: 0, lifesteal_percent: 0,
  buff_atk: 0, buff_def: 0, debuff_atk: 0, debuff_def: 0,
  min_level: 1, min_rarity: null, allowed_elements: null,
  icon_url: null, animation_key: 'basic_strike', color: null,
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-white/25">{hint}</span>}
    </label>
  )
}

const inputCls = 'bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#3A9DBC]/60'

export default function AdminAbilitiesPage() {
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [form, setForm] = useState<Form>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))
  const num = (v: string): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/abilities')
    const d = await res.json()
    setAbilities(res.ok ? (d.abilities ?? []) : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function edit(a: Ability) {
    setEditingId(a.id)
    setForm({ ...a })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() { setEditingId(null); setForm(BLANK); setError('') }

  async function save() {
    setSaving(true); setError('')
    const method = editingId ? 'PUT' : 'POST'
    const body = editingId ? { ...form, id: editingId } : form
    const res = await fetch('/api/admin/abilities', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Errore'); return }
    reset(); load()
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questa abilità? I giocatori che l\'hanno appresa la perderanno.')) return
    const res = await fetch('/api/admin/abilities', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    if (res.ok) { if (editingId === id) reset(); load() }
  }

  const grouped = useMemo(() => {
    const g: Record<string, Ability[]> = {}
    for (const a of abilities) { const k = a.element ?? 'neutrale'; (g[k] ??= []).push(a) }
    return g
  }, [abilities])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">✨ Abilità speciali</h1>
      <p className="text-white/40 text-sm mb-5">Crea e gestisci le abilità che i Daimon possono imparare. Le percentuali sono valori 0–1 (es. 0.35 = 35%).</p>

      {/* Form */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#3A9DBC]">{editingId ? 'Modifica abilità' : 'Nuova abilità'}</h2>
          {editingId && <button onClick={reset} className="text-xs text-white/40 hover:text-white">+ Nuova</button>}
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase mb-2">Identità</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="col-span-2"><Field label="Nome"><input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} /></Field></div>
          <Field label="Elemento">
            <select className={inputCls} value={form.element ?? ''} onChange={e => set('element', (e.target.value || null) as Ability['element'])}>
              <option value="">Neutrale</option>
              {ELEMENTS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Categoria">
            <select className={inputCls} value={form.category} onChange={e => set('category', e.target.value as Ability['category'])}>
              {CATEGORIES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <div className="col-span-2 md:col-span-4"><Field label="Descrizione"><input className={inputCls} value={form.description ?? ''} onChange={e => set('description', e.target.value)} /></Field></div>
          <Field label="Rarità abilità">
            <select className={inputCls} value={form.rarity ?? ''} onChange={e => set('rarity', (e.target.value || null) as Ability['rarity'])}>
              <option value="">—</option>
              {RARITIES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase mb-2">Effetto</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Potenza (×)" hint="0 = non danneggia"><input type="number" step="0.1" className={inputCls} value={form.power ?? 0} onChange={e => set('power', num(e.target.value))} /></Field>
          <Field label="Precisione" hint="0–1"><input type="number" step="0.05" className={inputCls} value={form.accuracy ?? 1} onChange={e => set('accuracy', num(e.target.value))} /></Field>
          <Field label="Bersaglio">
            <select className={inputCls} value={form.target} onChange={e => set('target', e.target.value as Ability['target'])}>
              <option value="enemy">Nemico</option><option value="self">Sé stesso</option>
            </select>
          </Field>
          <Field label="Priorità" hint="&gt;0 va prima"><input type="number" className={inputCls} value={form.priority ?? 0} onChange={e => set('priority', num(e.target.value))} /></Field>
          <Field label="Colpi min"><input type="number" className={inputCls} value={form.hits_min ?? 1} onChange={e => set('hits_min', num(e.target.value))} /></Field>
          <Field label="Colpi max"><input type="number" className={inputCls} value={form.hits_max ?? 1} onChange={e => set('hits_max', num(e.target.value))} /></Field>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase mb-2">Stato · cura · potenziamento</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Stato al nemico">
            <select className={inputCls} value={form.status_effect ?? ''} onChange={e => set('status_effect', (e.target.value || null) as Ability['status_effect'])}>
              <option value="">—</option>{STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Prob. stato" hint="0–1"><input type="number" step="0.05" className={inputCls} value={form.status_chance ?? 0} onChange={e => set('status_chance', num(e.target.value))} /></Field>
          <Field label="Stato su di sé">
            <select className={inputCls} value={form.self_status ?? ''} onChange={e => set('self_status', (e.target.value || null) as Ability['self_status'])}>
              <option value="">—</option>{STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Cura" hint="% HP max, 0–1"><input type="number" step="0.05" className={inputCls} value={form.heal_percent ?? 0} onChange={e => set('heal_percent', num(e.target.value))} /></Field>
          <Field label="Assorbimento" hint="% danno, 0–1"><input type="number" step="0.05" className={inputCls} value={form.lifesteal_percent ?? 0} onChange={e => set('lifesteal_percent', num(e.target.value))} /></Field>
          <Field label="Buff ATK" hint="es. 0.3"><input type="number" step="0.05" className={inputCls} value={form.buff_atk ?? 0} onChange={e => set('buff_atk', num(e.target.value))} /></Field>
          <Field label="Buff DIF"><input type="number" step="0.05" className={inputCls} value={form.buff_def ?? 0} onChange={e => set('buff_def', num(e.target.value))} /></Field>
          <Field label="Debuff ATK nemico"><input type="number" step="0.05" className={inputCls} value={form.debuff_atk ?? 0} onChange={e => set('debuff_atk', num(e.target.value))} /></Field>
          <Field label="Debuff DIF nemico"><input type="number" step="0.05" className={inputCls} value={form.debuff_def ?? 0} onChange={e => set('debuff_def', num(e.target.value))} /></Field>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase mb-2">Multi-turno · economia</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Turni carica" hint="Solar Beam"><input type="number" className={inputCls} value={form.charge_turns ?? 0} onChange={e => set('charge_turns', num(e.target.value))} /></Field>
          <Field label="Turni recupero" hint="Hyper Beam"><input type="number" className={inputCls} value={form.recharge_turns ?? 0} onChange={e => set('recharge_turns', num(e.target.value))} /></Field>
          <Field label="Ricarica (cooldown)"><input type="number" className={inputCls} value={form.cooldown ?? 0} onChange={e => set('cooldown', num(e.target.value))} /></Field>
          <Field label="Usi max (PP)" hint="vuoto = illimitati"><input type="number" className={inputCls} value={form.max_uses ?? ''} onChange={e => set('max_uses', e.target.value === '' ? null : num(e.target.value))} /></Field>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase mb-2">Requisiti di apprendimento</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Livello minimo"><input type="number" className={inputCls} value={form.min_level ?? 1} onChange={e => set('min_level', num(e.target.value))} /></Field>
          <Field label="Rarità minima Daimon">
            <select className={inputCls} value={form.min_rarity ?? ''} onChange={e => set('min_rarity', (e.target.value || null) as Ability['min_rarity'])}>
              <option value="">—</option>{RARITIES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Elementi ammessi" hint="vuoto = qualsiasi">
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {ELEMENTS.map(el => {
                  const on = (form.allowed_elements ?? []).includes(el)
                  return (
                    <button key={el} type="button"
                      onClick={() => {
                        const cur = form.allowed_elements ?? []
                        const next = on ? cur.filter(x => x !== el) : [...cur, el]
                        set('allowed_elements', next.length ? next : null)
                      }}
                      className={`text-xs px-2 py-1 rounded-lg border ${on ? 'bg-[#3A9DBC]/25 border-[#3A9DBC]/60 text-[#7CD4E8]' : 'bg-white/5 border-white/10 text-white/40'}`}>
                      {el}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase mb-2">Presentazione</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Animazione">
            <select className={inputCls} value={form.animation_key ?? 'basic_strike'} onChange={e => set('animation_key', e.target.value)}>
              {ANIM_KEYS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Colore accento" hint="es. #FB7185"><input className={inputCls} value={form.color ?? ''} onChange={e => set('color', e.target.value || null)} /></Field>
          <div className="col-span-2"><Field label="URL icona"><input className={inputCls} value={form.icon_url ?? ''} onChange={e => set('icon_url', e.target.value || null)} /></Field></div>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">⚠ {error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !form.name.trim()}
            className="px-4 py-2 rounded-lg bg-[#3A9DBC] text-white font-bold text-sm disabled:opacity-40">
            {saving ? 'Salvo…' : editingId ? 'Salva modifiche' : 'Crea abilità'}
          </button>
          {editingId && <button onClick={reset} className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm">Annulla</button>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-white/30">Carico…</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([el, list]) => (
            <div key={el}>
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-wide mb-2 capitalize">{el} ({list.length})</h3>
              <div className="grid gap-2">
                {list.map(a => (
                  <div key={a.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5"
                    style={{ borderColor: a.color ? `${a.color}44` : undefined }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: a.color ?? '#fff' }}>{a.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/50">{a.category}</span>
                        {a.rarity && <span className="text-[10px] text-white/40">{a.rarity}</span>}
                        <span className="text-[10px] text-white/30">Lv.{a.min_level}{a.min_rarity ? ` · ${a.min_rarity}+` : ''}</span>
                      </div>
                      <p className="text-[11px] text-white/40 truncate">{a.description}</p>
                    </div>
                    <button onClick={() => edit(a)} className="text-xs text-[#3A9DBC] hover:text-white px-2 py-1">Modifica</button>
                    <button onClick={() => remove(a.id)} className="text-xs text-red-400/70 hover:text-red-400 px-2 py-1">Elimina</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {abilities.length === 0 && <p className="text-white/30">Nessuna abilità. Creane una qui sopra.</p>}
        </div>
      )}
    </div>
  )
}
