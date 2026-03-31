'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminInlineSpinner, AdminTableSkeleton } from '@/components/admin/AdminLoading'

interface Player {
  userId: string
  nickname?: string
  email: string
  level: number
  exp: number
  score: number
  gold: number
  joinedAt: string
}

interface NotifyTarget { userId?: string; label: string }
interface GrantTarget { userId: string; label: string }

export default function PlayersPage() {
  const [sessions, setSessions]         = useState<any[]>([])
  const [selectedId, setSelectedId]     = useState('')
  const [players, setPlayers]           = useState<Player[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [items, setItems]               = useState<any[]>([])

  // Notify — shared state for both "all" and single-player
  const [notifyTarget, setNotifyTarget] = useState<NotifyTarget | null>(null)
  const [notifyTitle, setNotifyTitle]   = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [feedback, setFeedback]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Inventory
  const [inventoryTarget, setInventoryTarget] = useState<{ userId: string; label: string } | null>(null)
  const [inventory, setInventory] = useState<any[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [inventoryFeedback, setInventoryFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [removeQtyMap, setRemoveQtyMap] = useState<Record<string, number>>({})

  // Grant resources
  const [grantTarget, setGrantTarget]   = useState<GrantTarget | null>(null)
  const [grantType, setGrantType]       = useState<'gold' | 'exp' | 'item'>('gold')
  const [grantAmount, setGrantAmount]   = useState(50)
  const [grantItemId, setGrantItemId]   = useState('')
  const [grantQty, setGrantQty]         = useState(1)
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantFeedback, setGrantFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // QR scan
  const [qrScanTarget, setQrScanTarget] = useState<{ userId: string; label: string } | null>(null)
  const [qrScanning, setQrScanning]     = useState(false)
  const [qrScanResult, setQrScanResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetch('/api/admin/items').then(r => r.json()).then(d => setItems(d.items ?? []))
    supabase.from('sessions')
      .select('id, name, status')
      .then(({ data }) => {
        if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
      })
      .then(() => setLoadingSessions(false), () => setLoadingSessions(false))
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false

    async function fetchPlayers() {
      setLoadingPlayers(true)
      try {
        const res = await fetch(`/api/admin/players?sessionId=${encodeURIComponent(selectedId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setPlayers(data.players ?? [])
      } finally {
        if (!cancelled) setLoadingPlayers(false)
      }
    }

    fetchPlayers()
    const channel = supabase
      .channel(`admin-players-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_sessions', filter: `session_id=eq.${selectedId}` },
        () => fetchPlayers())
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [selectedId, supabase])

  async function sendNotify() {
    if (!notifyTarget || !notifyTitle.trim() || !notifyMessage.trim()) return
    setNotifyLoading(true); setFeedback(null)
    try {
      const body: any = { title: notifyTitle, message: notifyMessage }
      if (notifyTarget.userId) {
        body.userId = notifyTarget.userId
      } else {
        body.sessionId = selectedId
      }
      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setFeedback({ type: 'success', text: `Notifica inviata a ${notifyTarget.label}` })
        setNotifyTitle(''); setNotifyMessage('')
        setTimeout(() => { setFeedback(null); setNotifyTarget(null) }, 3000)
      } else {
        const d = await res.json()
        setFeedback({ type: 'error', text: d.error ?? 'Errore durante l\'invio' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Errore di rete' })
    } finally {
      setNotifyLoading(false)
    }
  }

  function openNotifyAll() {
    setNotifyTarget({ label: 'tutti i giocatori' })
    setNotifyTitle(''); setNotifyMessage(''); setFeedback(null)
  }

  function openNotifyPlayer(p: Player) {
    setNotifyTarget({ userId: p.userId, label: p.nickname || p.email || p.userId.slice(0, 8) })
    setNotifyTitle(''); setNotifyMessage(''); setFeedback(null)
  }

  function openGrant(p: Player) {
    setGrantTarget({ userId: p.userId, label: p.nickname || p.email || p.userId.slice(0, 8) })
    setGrantType('gold'); setGrantAmount(50); setGrantItemId(''); setGrantQty(1); setGrantFeedback(null)
  }

  async function sendGrant() {
    if (!grantTarget || !selectedId) return
    setGrantLoading(true); setGrantFeedback(null)
    const body: Record<string, unknown> = {
      userId: grantTarget.userId, sessionId: selectedId, type: grantType,
    }
    if (grantType === 'item') { body.itemId = grantItemId; body.quantity = grantQty }
    else { body.amount = grantAmount }
    const res = await fetch('/api/admin/players/grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      setGrantFeedback({ type: 'success', text: `Risorse assegnate a ${grantTarget.label}!` })
      setTimeout(() => { setGrantFeedback(null); setGrantTarget(null) }, 2500)
    } else {
      setGrantFeedback({ type: 'error', text: data.error ?? 'Errore' })
    }
    setGrantLoading(false)
  }

  async function openInventory(p: Player) {
    setInventoryTarget({ userId: p.userId, label: p.nickname || p.email || p.userId.slice(0, 8) })
    setInventory([])
    setInventoryFeedback(null)
    setRemoveQtyMap({})
    setInventoryLoading(true)
    const res = await fetch(`/api/admin/players/inventory?userId=${p.userId}&sessionId=${selectedId}`)
    const d = await res.json()
    setInventory(d.inventory ?? [])
    setInventoryLoading(false)
  }

  async function handleRemoveItem(inventoryId: string, maxQty: number) {
    const qty = removeQtyMap[inventoryId] ?? 1
    const removing = Math.min(qty, maxQty)
    const all = removing >= maxQty
    if (!confirm(all
      ? 'Rimuovere tutte le copie di questo oggetto?'
      : `Rimuovere ${removing} cop${removing === 1 ? 'ia' : 'ie'} di questo oggetto?`
    )) return
    const res = await fetch('/api/admin/players/inventory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryId, quantity: removing }),
    })
    if (res.ok) {
      setInventory(prev => prev.map(i => {
        if (i.id !== inventoryId) return i
        const newQty = i.quantity - removing
        return newQty <= 0 ? null : { ...i, quantity: newQty }
      }).filter(Boolean))
      setRemoveQtyMap(prev => { const n = { ...prev }; delete n[inventoryId]; return n })
      setInventoryFeedback({ type: 'success', text: `Rimoss${removing === 1 ? 'a 1 copia' : `e ${removing} copie`}.` })
    }
  }

  async function handleRedeemItem(inventoryId: string, itemName: string) {
    if (!inventoryTarget) return
    if (!confirm(`Validare e consumare "${itemName}" per ${inventoryTarget.label}?`)) return
    setRedeemingId(inventoryId)
    setInventoryFeedback(null)
    const res = await fetch('/api/admin/players/redeem-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: inventoryTarget.userId, sessionId: selectedId, inventoryId }),
    })
    const d = await res.json()
    if (res.ok) {
      setInventory(prev => {
        const row = prev.find(i => i.id === inventoryId)
        if (!row) return prev
        if (row.quantity <= 1) return prev.filter(i => i.id !== inventoryId)
        return prev.map(i => i.id === inventoryId ? { ...i, quantity: i.quantity - 1 } : i)
      })
      const reward = d.reward
      const parts = []
      if (reward?.gold) parts.push(`+${reward.gold} 💰`)
      if (reward?.exp) parts.push(`+${reward.exp} ⭐`)
      setInventoryFeedback({ type: 'success', text: `✅ "${d.itemName}" riscattato! Ricompensa: ${parts.join(' · ') || 'nessuna'}` })
    } else {
      setInventoryFeedback({ type: 'error', text: d.error ?? 'Errore' })
    }
    setRedeemingId(null)
  }

  function openQrScan(p: Player) {
    setQrScanTarget({ userId: p.userId, label: p.nickname || p.email || p.userId.slice(0, 8) })
    setQrScanResult(null)
    setQrScanning(false)
  }

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    scanLoopRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  async function startCamera() {
    setQrScanning(true); setQrScanResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      scanFrame()
    } catch {
      setQrScanResult({ type: 'error', text: 'Accesso alla fotocamera negato' })
      setQrScanning(false)
    }
  }

  function scanFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !streamRef.current) return
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      import('jsqr').then(({ default: jsQR }) => {
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          stopCamera()
          setQrScanning(false)
          handleQrDecoded(code.data)
          return
        }
        scanLoopRef.current = requestAnimationFrame(scanFrame)
      })
    } else {
      scanLoopRef.current = requestAnimationFrame(scanFrame)
    }
  }

  async function handleQrDecoded(content: string) {
    if (!qrScanTarget || !selectedId) return
    setQrScanResult(null)
    const res = await fetch('/api/admin/players/redeem-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: qrScanTarget.userId, sessionId: selectedId, qrContent: content }),
    })
    const d = await res.json()
    if (res.ok) {
      const r = d.reward
      const parts = []
      if (r?.gold) parts.push(`+${r.gold} 💰`)
      if (r?.exp) parts.push(`+${r.exp} ⭐`)
      if (r?.bonus_items?.length) parts.push(`+${r.bonus_items.length} oggetti 🎒`)
      setQrScanResult({ type: 'success', text: `✅ "${d.itemName}" riscattato! ${parts.join(' · ') || 'Nessuna ricompensa'}` })
    } else {
      setQrScanResult({ type: 'error', text: d.error ?? 'Errore durante il riscatto' })
    }
  }

  function closeQrScan() {
    stopCamera()
    setQrScanTarget(null); setQrScanResult(null); setQrScanning(false)
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">👥 Giocatori</h1>

      {/* Session selector */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="block text-xs text-white/50 mb-1">Sessione</label>
          <select
            value={selectedId} onChange={e => setSelectedId(e.target.value)}
            disabled={loadingSessions}
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 disabled:opacity-50"
          >
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>
          {loadingSessions && (
            <div className="mt-2">
              <AdminInlineSpinner label="Caricamento sessioni..." />
            </div>
          )}
        </div>
        <div className="flex items-end">
          <button
            onClick={openNotifyAll}
            disabled={!selectedId || players.length === 0}
            className="bg-[#3A9DBC] text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40"
          >
            📢 Notifica tutti
          </button>
        </div>
      </div>

      {/* Players table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-8">
        {loadingPlayers && players.length === 0 ? (
          <div className="p-4">
            <AdminTableSkeleton rows={5} columns={6} />
          </div>
        ) : players.length === 0 ? (
          <p className="text-white/50 text-sm p-4">Nessun giocatore in questa sessione.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs">
                  <th className="text-left px-4 py-3 font-semibold">Giocatore</th>
                  <th className="text-center px-3 py-3 font-semibold">Liv.</th>
                  <th className="text-center px-3 py-3 font-semibold">EXP</th>
                  <th className="text-center px-3 py-3 font-semibold">Punteggio</th>
                  <th className="text-center px-3 py-3 font-semibold">Oro</th>
                  <th className="text-center px-3 py-3 font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.userId} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i === 0 ? 'text-[#FFD700]' : 'text-white'}`}>
                    <td className="px-4 py-3">
                      <div>
                        {p.nickname && <p className="font-bold text-sm">{p.nickname}</p>}
                        <p className="text-xs text-white/40 font-mono">{p.email || p.userId.slice(0, 12) + '…'}</p>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3 font-bold">{p.level}</td>
                    <td className="text-center px-3 py-3">{p.exp}</td>
                    <td className="text-center px-3 py-3 font-bold">{p.score}</td>
                    <td className="text-center px-3 py-3">{p.gold}</td>
                    <td className="text-center px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openNotifyPlayer(p)}
                          className="text-[#3A9DBC]/60 hover:text-[#3A9DBC] text-lg transition-colors"
                          title={`Invia notifica a ${p.nickname || p.email}`}
                        >
                          📢
                        </button>
                        <button
                          onClick={() => openGrant(p)}
                          className="text-[#D4A96A]/60 hover:text-[#D4A96A] text-lg transition-colors"
                          title={`Assegna risorse a ${p.nickname || p.email}`}
                        >
                          🎁
                        </button>
                        <button
                          onClick={() => openInventory(p)}
                          className="text-[#34d399]/60 hover:text-[#34d399] text-lg transition-colors"
                          title={`Inventario di ${p.nickname || p.email}`}
                        >
                          🎒
                        </button>
                        <button
                          onClick={() => openQrScan(p)}
                          className="text-[#a78bfa]/60 hover:text-[#a78bfa] text-lg transition-colors"
                          title={`Scansiona QR per ${p.nickname || p.email}`}
                        >
                          📷
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {players.length > 0 && (
          <p className="text-white/25 text-xs px-4 py-2">{players.length} giocatori · aggiornamento in tempo reale</p>
        )}
      </div>

      {/* Grant resources modal */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setGrantTarget(null) }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">🎁 Assegna Risorse</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  A: <span className="text-[#D4A96A] font-semibold">{grantTarget.label}</span>
                </p>
              </div>
              <button onClick={() => setGrantTarget(null)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Tipo risorsa</label>
                <div className="flex gap-2">
                  {(['gold', 'exp', 'item'] as const).map(t => (
                    <button key={t} onClick={() => setGrantType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        grantType === t ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50 border border-white/10'
                      }`}>
                      {t === 'gold' ? '💰 Oro' : t === 'exp' ? '⭐ EXP' : '🎒 Oggetto'}
                    </button>
                  ))}
                </div>
              </div>

              {grantType !== 'item' && (
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">
                    {grantType === 'gold' ? 'Quantità oro' : 'Quantità EXP'}
                    <span className="ml-1 font-normal text-white/30">(negativo = rimuovi)</span>
                  </label>
                  <input type="number" value={grantAmount}
                    onChange={e => setGrantAmount(Number(e.target.value))}
                    className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
                  />
                  {grantAmount < 0 && (
                    <p className="text-amber-400/70 text-xs mt-1">
                      ⚠ Verranno rimossi {Math.abs(grantAmount)} {grantType === 'gold' ? 'oro' : 'EXP'}
                      {grantType === 'gold' ? ' · non può scendere sotto 0' : ''}
                    </p>
                  )}
                </div>
              )}

              {grantType === 'item' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">Oggetto</label>
                    <select value={grantItemId} onChange={e => setGrantItemId(e.target.value)}
                      className="w-full bg-[#0F1F2E] text-white border border-white/20 rounded-lg px-3 py-2">
                      <option value="">— Seleziona oggetto —</option>
                      {items.map((item: any) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">Quantità</label>
                    <input type="number" min={1} value={grantQty}
                      onChange={e => setGrantQty(Number(e.target.value))}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}

              {grantFeedback && (
                <p className={`text-sm font-medium px-3 py-2 rounded-lg ${
                  grantFeedback.type === 'success'
                    ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20'
                    : 'bg-red-400/10 text-red-400 border border-red-400/20'
                }`}>
                  {grantFeedback.text}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setGrantTarget(null)}
                  className="flex-1 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm">
                  Annulla
                </button>
                <button
                  onClick={sendGrant}
                  disabled={grantLoading || (grantType === 'item' && !grantItemId) || (grantType !== 'item' && grantAmount === 0)}
                  className={`flex-1 font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 ${
                    grantType !== 'item' && grantAmount < 0
                      ? 'bg-red-500 text-white'
                      : 'bg-[#D4A96A] text-[#0F1F2E]'
                  }`}
                >
                  {grantLoading ? 'Invio...' : (grantType !== 'item' && grantAmount < 0) ? '🗑 Rimuovi' : '🎁 Assegna'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory modal */}
      {inventoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setInventoryTarget(null) }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">🎒 Inventario</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  <span className="text-[#34d399] font-semibold">{inventoryTarget.label}</span>
                </p>
              </div>
              <button onClick={() => setInventoryTarget(null)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            {inventoryFeedback && (
              <p className={`text-sm font-medium px-3 py-2 rounded-lg mb-3 shrink-0 ${
                inventoryFeedback.type === 'success'
                  ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20'
                  : 'bg-red-400/10 text-red-400 border border-red-400/20'
              }`}>
                {inventoryFeedback.text}
              </p>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {inventoryLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
                </div>
              ) : inventory.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-8">Inventario vuoto</p>
              ) : (
                <div className="space-y-2">
                  {inventory.map((inv: any) => {
                    const item = inv.items
                    const isRedeemable = item?.is_redeemable
                    return (
                      <div key={inv.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                        isRedeemable ? 'bg-[#34d399]/5 border-[#34d399]/20' : 'bg-white/3 border-white/8'
                      }`}>
                        {item?.image_url ? (
                          <img src={item.image_url} alt="" className="w-8 h-8 object-contain rounded" />
                        ) : (
                          <span className="text-xl w-8 text-center">🎒</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item?.name ?? '—'}</p>
                          <p className="text-xs text-white/40">{item?.type} · ×{inv.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isRedeemable && (
                            <button
                              onClick={() => handleRedeemItem(inv.id, item.name)}
                              disabled={redeemingId === inv.id}
                              className="bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-[#34d399]/30 disabled:opacity-40 transition-colors"
                            >
                              {redeemingId === inv.id ? '…' : '✅ Valida'}
                            </button>
                          )}
                          {inv.quantity > 1 && (
                            <input
                              type="number"
                              min={1}
                              max={inv.quantity}
                              value={removeQtyMap[inv.id] ?? 1}
                              onChange={e => setRemoveQtyMap(prev => ({
                                ...prev,
                                [inv.id]: Math.min(Math.max(1, +e.target.value), inv.quantity),
                              }))}
                              className="w-12 bg-white/10 border border-white/15 rounded-lg px-1.5 py-1 text-white text-xs text-center"
                              title="Quantità da rimuovere"
                            />
                          )}
                          <button
                            onClick={() => handleRemoveItem(inv.id, inv.quantity)}
                            className="text-red-400/50 hover:text-red-400 text-sm px-1.5 py-1 rounded transition-colors"
                            title="Rimuovi dall'inventario"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Scan modal */}
      {qrScanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeQrScan() }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">📷 Scansiona QR</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Per: <span className="text-[#a78bfa] font-semibold">{qrScanTarget.label}</span>
                </p>
              </div>
              <button onClick={closeQrScan} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            {qrScanResult ? (
              <div className="space-y-4">
                <div className={`text-sm font-medium px-4 py-3 rounded-xl border text-center ${
                  qrScanResult.type === 'success'
                    ? 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20'
                    : 'bg-red-400/10 text-red-400 border-red-400/20'
                }`}>
                  {qrScanResult.text}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setQrScanResult(null) }}
                    className="flex-1 bg-white/5 border border-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-sm">
                    Scansiona ancora
                  </button>
                  <button onClick={closeQrScan}
                    className="flex-1 bg-[#a78bfa] text-white font-bold py-2.5 rounded-xl text-sm">
                    Chiudi
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-white/40 text-center">
                  Punta la fotocamera su un QR code di tipo <strong className="text-white/60">oggetto custom</strong>
                </p>

                {qrScanning ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-[#a78bfa] rounded-xl opacity-70" />
                    </div>
                    <div className="absolute bottom-3 left-0 right-0 text-center">
                      <span className="text-xs text-white/60 bg-black/50 px-3 py-1 rounded-full">Scansione in corso...</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/3 border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-4xl mb-2">📷</p>
                    <p className="text-xs text-white/40">Fotocamera non attiva</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {!qrScanning ? (
                    <button onClick={startCamera}
                      className="flex-1 bg-[#a78bfa] text-white font-bold py-2.5 rounded-xl text-sm">
                      Avvia fotocamera
                    </button>
                  ) : (
                    <button onClick={() => { stopCamera(); setQrScanning(false) }}
                      className="flex-1 bg-white/10 border border-white/20 text-white/60 font-semibold py-2.5 rounded-xl text-sm">
                      Ferma
                    </button>
                  )}
                  <button onClick={closeQrScan}
                    className="flex-1 bg-white/5 border border-white/10 text-white/40 font-semibold py-2.5 rounded-xl text-sm">
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notify modal */}
      {notifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setNotifyTarget(null) }}>
          <div className="bg-[#0d1e2e] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">📢 Invia Notifica</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Destinatario: <span className="text-[#3A9DBC] font-semibold">{notifyTarget.label}</span>
                </p>
              </div>
              <button onClick={() => setNotifyTarget(null)}
                className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Titolo notifica</label>
                <input
                  type="text"
                  placeholder="es. Bonus attivato!"
                  value={notifyTitle}
                  onChange={e => setNotifyTitle(e.target.value)}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/25"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Messaggio</label>
                <textarea
                  placeholder="es. Hai ricevuto un bonus EXP ×2 per i prossimi 10 minuti!"
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/25 resize-none"
                />
              </div>

              {feedback && (
                <p className={`text-sm font-medium px-3 py-2 rounded-lg ${
                  feedback.type === 'success'
                    ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20'
                    : 'bg-red-400/10 text-red-400 border border-red-400/20'
                }`}>
                  {feedback.text}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setNotifyTarget(null)}
                  className="flex-1 bg-white/5 border border-white/10 text-white/50 font-semibold py-2.5 rounded-xl text-sm">
                  Annulla
                </button>
                <button
                  onClick={sendNotify}
                  disabled={notifyLoading || !notifyTitle.trim() || !notifyMessage.trim()}
                  className="flex-1 bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                >
                  {notifyLoading ? 'Invio...' : 'Invia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
