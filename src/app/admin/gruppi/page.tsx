'use client'
import { useState, useEffect, useCallback } from 'react'

interface GroupRow { id: string; name: string; code: string; created_at: string; members: number }

export default function GruppiAdminPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/groups').then(r => r.json())
      .then(d => setGroups(d.groups ?? []))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true); setMsg(null)
    const res = await fetch('/api/admin/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setMsg(`Gruppo creato — codice: ${d.group.code}`); setName(''); load() }
    else setMsg(d.error ?? 'Errore')
  }

  async function remove(id: string, gname: string) {
    if (!confirm(`Eliminare il gruppo "${gname}"? I membri perderanno la classifica privata.`)) return
    await fetch(`/api/admin/groups?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">👥 Gruppi</h1>
        <p className="text-white/40 text-sm mt-1">
          Classifiche private (classe, istituto, squadra): crea un gruppo e condividi il codice —
          i giocatori entrano dal Profilo e la classifica guadagna il filtro &ldquo;Gruppo&rdquo;.
        </p>
      </div>

      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') create() }}
          placeholder="es. Classe 3ªB — Liceo Galilei"
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
        <button onClick={create} disabled={busy || !name.trim()}
          className="bg-[#3A9DBC] text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
          + Crea
        </button>
      </div>
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      {loading ? <p className="text-white/40 text-sm">Caricamento…</p> : (
        <div className="space-y-1.5">
          {groups.map(g => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{g.name}</p>
                <p className="text-white/35 text-xs">{g.members} membri</p>
              </div>
              <code className="text-sm font-mono font-bold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(58,157,188,0.15)', color: '#7FD6F2', border: '1px solid rgba(58,157,188,0.35)' }}>
                {g.code}
              </code>
              <button onClick={() => remove(g.id, g.name)}
                className="text-xs bg-red-500/15 text-red-300 px-2 py-1 rounded-md">🗑</button>
            </div>
          ))}
          {groups.length === 0 && <p className="text-white/25 text-sm text-center py-8">Nessun gruppo ancora</p>}
        </div>
      )}
    </div>
  )
}
