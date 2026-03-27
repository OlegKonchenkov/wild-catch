'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Invite {
  id: string
  code: string
  is_active: boolean
  used_by_user_id: string | null
  created_at: string
}

function IconCopy({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v2" />
    </svg>
  )
}

function IconShare({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l8-5M8 12l8 5M6 13.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm12-6a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    </svg>
  )
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16" />
    </svg>
  )
}

function IconReset({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M6.5 9a7 7 0 0111.7-2.2M17.5 15a7 7 0 01-11.7 2.2" />
    </svg>
  )
}

export default function InvitesPage() {
  const [sessions, setSessions]     = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [invites, setInvites]       = useState<Invite[]>([])
  const [nickMap, setNickMap]       = useState<Record<string, string>>({})
  const [quantity, setQuantity]     = useState(50)
  const [loading, setLoading]       = useState(false)
  const [resetting, setResetting]   = useState<string | null>(null)
  const [filter, setFilter]         = useState<'all' | 'available' | 'used'>('all')
  const [actionMsg, setActionMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name, status').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [supabase])

  async function loadInvites(sid: string) {
    const res  = await fetch(`/api/admin/invites?sessionId=${sid}`)
    const data = await res.json()
    const list: Invite[] = data.invites ?? []
    setInvites(list)

    // Fetch nicknames for users who used codes
    const userIds = [...new Set(list.map(i => i.used_by_user_id).filter(Boolean))] as string[]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nickname')
        .in('user_id', userIds)
      if (profiles) {
        const map: Record<string, string> = {}
        profiles.forEach(p => { map[p.user_id] = p.nickname ?? p.user_id.slice(0, 8) })
        setNickMap(map)
      }
    } else {
      setNickMap({})
    }
  }

  useEffect(() => { if (selectedId) loadInvites(selectedId) }, [selectedId])

  function pushActionMsg(ok: boolean, text: string) {
    setActionMsg({ ok, text })
    setTimeout(() => setActionMsg(null), 2500)
  }

  async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }

  async function copyInviteCode(code: string) {
    try {
      const ok = await copyText(code)
      pushActionMsg(ok, ok ? 'Codice copiato negli appunti' : 'Copia non riuscita')
    } catch {
      pushActionMsg(false, 'Copia non riuscita')
    }
  }

  async function shareInviteCode(code: string) {
    const text = `Codice invito Wild Catch: ${code}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Codice invito Wild Catch',
          text,
        })
        pushActionMsg(true, 'Codice condiviso')
        return
      }
      const ok = await copyText(code)
      pushActionMsg(ok, ok ? 'Condivisione non disponibile: codice copiato' : 'Condivisione non riuscita')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      pushActionMsg(false, 'Condivisione non riuscita')
    }
  }

  async function generateCodes() {
    setLoading(true)
    try {
      await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedId, quantity }),
      })
      await loadInvites(selectedId)
    } finally {
      setLoading(false)
    }
  }

  async function resetCode(inviteId: string) {
    setResetting(inviteId)
    const res = await fetch('/api/admin/invites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
    if (res.ok) {
      setInvites(prev => prev.map(i =>
        i.id === inviteId ? { ...i, used_by_user_id: null, is_active: true } : i
      ))
      // Remove from nickMap if present
      setNickMap(prev => {
        const inv = invites.find(i => i.id === inviteId)
        if (!inv?.used_by_user_id) return prev
        const next = { ...prev }
        delete next[inv.used_by_user_id]
        return next
      })
      pushActionMsg(true, 'Codice resettato')
    } else {
      pushActionMsg(false, 'Reset non riuscito')
    }
    setResetting(null)
  }

  async function confirmAndReset(inv: Invite) {
    const ok = window.confirm(`Resettare il codice ${inv.code}? Tornerà disponibile per un nuovo giocatore.`)
    if (!ok) return
    await resetCode(inv.id)
  }

  function exportCSV() {
    const rows = [['Codice', 'Stato', 'Usato da']]
    invites.forEach(i => rows.push([
      i.code,
      i.used_by_user_id ? 'Usato' : i.is_active ? 'Disponibile' : 'Disattivato',
      i.used_by_user_id ? (nickMap[i.used_by_user_id] ?? i.used_by_user_id) : '',
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `inviti_${selectedId}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
    pushActionMsg(true, 'CSV scaricato')
  }

  const usedCount      = invites.filter(i => i.used_by_user_id).length
  const availableCount = invites.filter(i => !i.used_by_user_id && i.is_active).length

  const filtered = invites.filter(i => {
    if (filter === 'used')      return !!i.used_by_user_id
    if (filter === 'available') return !i.used_by_user_id && i.is_active
    return true
  })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">🎟️ Codici Invito</h1>
      {actionMsg && (
        <p className={`mb-4 text-sm rounded-lg px-3 py-2 border ${
          actionMsg.ok
            ? 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
            : 'text-red-400 bg-red-400/10 border-red-400/30'
        }`}>
          {actionMsg.text}
        </p>
      )}

      {/* Session selector */}
      <div className="mb-4">
        <label className="block text-xs text-white/50 mb-1">Sessione</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
      </div>

      {/* Generate */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <p className="text-white/60 text-sm font-semibold mb-3">Genera nuovi codici</p>
        <div className="flex gap-2">
          <div>
            <label className="block text-xs text-white/40 mb-1">Quantità (1–500)</label>
            <input type="number" value={quantity} onChange={e => setQuantity(+e.target.value)}
              min={1} max={500}
              className="w-24 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-2 items-end">
            <button onClick={generateCodes} disabled={loading || !selectedId}
              className="bg-[#3A9DBC] text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50">
              {loading ? 'Generazione...' : 'Genera'}
            </button>
            {invites.length > 0 && (
              <button onClick={exportCSV}
                className="inline-flex items-center gap-1.5 bg-[#34d399] text-[#0F1F2E] font-bold px-4 py-2 rounded-lg">
                <IconDownload className="w-4 h-4" />
                CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats + filters */}
      {invites.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-2 text-xs">
              <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-white/50">{invites.length} totali</span>
              <span className="bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399] px-2.5 py-1 rounded-full">{availableCount} disponibili</span>
              <span className="bg-white/5 border border-white/10 text-white/30 px-2.5 py-1 rounded-full line-through">{usedCount} usati</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1 w-fit">
            {(['all', 'available', 'used'] as const).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  filter === f ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'
                }`}>
                {f === 'all' ? 'Tutti' : f === 'available' ? 'Disponibili' : 'Usati'}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0d1e2e] border-b border-white/10">
                <tr className="text-white/40 text-xs">
                  <th className="text-left px-4 py-2.5 font-semibold">Codice</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Stato</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Usato da</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-bold text-sm ${
                        inv.used_by_user_id ? 'text-white/30 line-through' :
                        inv.is_active ? 'text-[#3A9DBC]' : 'text-red-400'
                      }`}>
                        {inv.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {inv.used_by_user_id ? (
                        <span className="text-xs bg-white/5 text-white/30 px-2 py-0.5 rounded-full">Usato</span>
                      ) : inv.is_active ? (
                        <span className="text-xs bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 px-2 py-0.5 rounded-full">Disponibile</span>
                      ) : (
                        <span className="text-xs bg-red-900/20 text-red-400 px-2 py-0.5 rounded-full">Disattivato</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">
                      {inv.used_by_user_id
                        ? (nickMap[inv.used_by_user_id] ? `🎮 ${nickMap[inv.used_by_user_id]}` : `…${inv.used_by_user_id.slice(-8)}`)
                        : <span className="text-white/20">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!inv.used_by_user_id ? (
                        <div className="flex justify-end items-center gap-1.5">
                          <button
                            onClick={() => copyInviteCode(inv.code)}
                            aria-label="Copia codice invito"
                            title="Copia codice"
                            className="inline-flex items-center justify-center bg-white/10 text-white/75 hover:text-white w-11 h-11 rounded-lg transition-colors"
                          >
                            <IconCopy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => shareInviteCode(inv.code)}
                            aria-label="Condividi codice invito"
                            title="Condividi codice"
                            className="inline-flex items-center justify-center bg-white/10 text-white/75 hover:text-white w-11 h-11 rounded-lg transition-colors"
                          >
                            <IconShare className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => confirmAndReset(inv)}
                          disabled={resetting === inv.id}
                          aria-label="Resetta codice invito usato"
                          title="Reset codice usato"
                          className="inline-flex items-center justify-center bg-[#F7C841]/15 text-[#F7C841] hover:bg-[#F7C841]/25 w-11 h-11 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {resetting === inv.id ? (
                            <span className="text-[11px] font-bold">...</span>
                          ) : (
                            <IconReset className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-white/25 text-sm">Nessun codice in questa categoria</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
