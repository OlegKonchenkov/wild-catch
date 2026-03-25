'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QRCodeType } from '@/lib/types'

export default function QRCodesPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [qrCodes, setQrCodes] = useState<any[]>([])
  const [type, setType] = useState<QRCodeType>('oggetto')
  const [label, setLabel] = useState('')
  const [payload, setPayload] = useState('{}')
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('sessions').select('id, name').then(({ data }) => {
      if (data) { setSessions(data); if (data[0]) setSelectedId(data[0].id) }
    })
  }, [supabase])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/admin/qrcodes?sessionId=${selectedId}`)
      .then(r => r.json()).then(d => setQrCodes(d.qrCodes ?? []))
  }, [selectedId])

  async function createQR() {
    let parsedPayload: any
    try { parsedPayload = JSON.parse(payload) }
    catch { alert('Payload JSON non valido'); return }

    const res = await fetch('/api/admin/qrcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, type, payload: parsedPayload, usesRemaining, label }),
    })
    const data = await res.json()
    if (res.ok) {
      setQrCodes(prev => [data.qrCode, ...prev])
      setLabel(''); setPayload('{}')
    }
  }

  async function downloadQR(qrId: string, qrLabel: string) {
    const QRCode = await import('qrcode')
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrId, { width: 300 })
    const link = document.createElement('a')
    link.download = `qr_${qrLabel || qrId}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const PAYLOAD_TEMPLATES: Record<QRCodeType, string> = {
    oggetto: '{"item_id":"UUID_ITEM","quantity":1}',
    indizio: '{"chapter_order":1,"text":"Testo indizio...","image_url":null}',
    uovo: '{"egg_rarity":"comune","creature_pool":[]}',
    boss: '{"creature_id":"UUID_CREATURE","level_override":10}',
    evento: '{"event_type":"bonus_exp","effect":{"multiplier":2,"duration_minutes":10}}',
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">QR Codes</h1>

      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 mb-4">
        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 space-y-3">
        <p className="font-bold text-white">Crea QR Code</p>
        <div className="flex gap-2">
          <select value={type} onChange={e => { setType(e.target.value as QRCodeType); setPayload(PAYLOAD_TEMPLATES[e.target.value as QRCodeType]) }}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2">
            {(['oggetto','indizio','uovo','boss','evento'] as QRCodeType[]).map(t =>
              <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Etichetta (es. Stazione A)"
            className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea value={payload} onChange={e => setPayload(e.target.value)}
          rows={3} className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 font-mono text-xs resize-none" />
        <div className="flex gap-2">
          <input type="number" placeholder="Usi (vuoto=illimitato)"
            value={usesRemaining ?? ''} onChange={e => setUsesRemaining(e.target.value ? +e.target.value : null)}
            className="w-40 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm" />
          <button onClick={createQR}
            className="flex-1 bg-[#E85D2F] text-white font-bold py-2 rounded-lg">
            Crea QR
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {qrCodes.map(qr => (
          <div key={qr.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{qr.label || qr.type}</p>
              <p className="text-xs text-white/40 font-mono">{qr.id.slice(0, 12)}...</p>
              <p className="text-xs text-white/40">
                {qr.uses_remaining === null ? '∞ usi' : `${qr.uses_remaining} usi rimanenti`}
              </p>
            </div>
            <button onClick={() => downloadQR(qr.id, qr.label)}
              className="bg-[#3A9DBC] text-white px-3 py-1.5 rounded-lg text-sm">
              ⬇ PNG
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
