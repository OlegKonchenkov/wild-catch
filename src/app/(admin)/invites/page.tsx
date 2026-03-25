'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InvitesPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [invites, setInvites] = useState<any[]>([])
  const [quantity, setQuantity] = useState(50)
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/invites?sessionId=${selectedId}`)
      .then(r => r.json()).then(d => setInvites(d.invites ?? []))
  }, [selectedId])

  async function generateCodes() {
    setLoading(true)
    await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, quantity }),
    })
    const res = await fetch(`/api/admin/invites?sessionId=${selectedId}`)
    const data = await res.json()
    setInvites(data.invites ?? [])
    setLoading(false)
  }

  function exportCSV() {
    const csv = 'Codice,Usato\n' + invites.map(i =>
      `${i.code},${i.used_by_user_id ? 'Sì' : 'No'}`
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `inviti_${selectedId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const usedCount = invites.filter(i => i.used_by_user_id).length

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Codici Invito</h1>

      <div className="flex gap-2 mb-4">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <p className="text-white/50 text-sm mb-3">Genera nuovi codici</p>
        <div className="flex gap-2">
          <input type="number" value={quantity} onChange={e => setQuantity(+e.target.value)}
            min={1} max={200}
            className="w-24 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          <button onClick={generateCodes} disabled={loading || !selectedId}
            className="flex-1 bg-[#3A9DBC] text-white font-bold py-2 rounded-lg disabled:opacity-50">
            {loading ? 'Generazione...' : 'Genera Codici'}
          </button>
          {invites.length > 0 && (
            <button onClick={exportCSV}
              className="bg-[#34d399] text-[#0F1F2E] font-bold px-4 rounded-lg">
              CSV
            </button>
          )}
        </div>
      </div>

      {invites.length > 0 && (
        <div>
          <p className="text-sm text-white/50 mb-2">
            {invites.length} codici totali · {usedCount} usati · {invites.length - usedCount} disponibili
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {invites.map(inv => (
              <div key={inv.id}
                className={`rounded-lg p-2 text-center font-mono text-sm font-bold ${
                  inv.used_by_user_id
                    ? 'bg-white/5 text-white/30 line-through'
                    : inv.is_active ? 'bg-[#3A9DBC]/20 text-[#3A9DBC]' : 'bg-red-900/20 text-red-400'
                }`}>
                {inv.code}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
