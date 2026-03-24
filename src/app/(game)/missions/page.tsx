'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Mission } from '@/lib/types'

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [scanResult, setScanResult] = useState<any>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return
    supabase
      .from('missions')
      .select('*')
      .eq('session_id', sessionId)
      .order('chapter_order')
      .then(({ data }) => { if (data) setMissions(data as unknown as Mission[]) })
  }, [supabase])

  async function handleScanResult(qrData: string) {
    const sessionId = localStorage.getItem('current_session_id')
    if (!sessionId) return

    // QR data is the qr_codes.id UUID
    const res = await fetch('/api/game/qr/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrId: qrData, sessionId }),
    })
    const data = await res.json()
    setScanResult(data)
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Missioni</h1>
        <button
          onClick={() => {
            // In production: open camera QR scanner
            // For now: prompt for QR UUID (demo mode)
            const qrId = prompt('Inserisci ID QR:')
            if (qrId) handleScanResult(qrId)
          }}
          className="bg-[#3A9DBC] text-white px-4 py-2 rounded-xl text-sm font-bold"
        >
          📷 Scansiona QR
        </button>
      </div>

      {scanResult && (
        <div className="bg-[#3A9DBC]/20 border border-[#3A9DBC] rounded-xl p-4 mb-4">
          <p className="text-white font-bold">QR Scansionato! ✅</p>
          <p className="text-sm text-white/70 mt-1">
            {scanResult.type === 'oggetto' && `Ricevuto: ${scanResult.itemName} ×${scanResult.quantity}`}
            {scanResult.type === 'indizio' && `Indizio sbloccato: ${scanResult.text}`}
            {scanResult.type === 'uovo' && `Uovo ${scanResult.eggRarity} trovato!`}
          </p>
          <button onClick={() => setScanResult(null)} className="text-xs text-white/50 mt-2">Chiudi</button>
        </div>
      )}

      <div className="space-y-3">
        {missions.map((mission) => (
          <div key={mission.id}
            className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3A9DBC]/20 border border-[#3A9DBC] flex items-center justify-center text-sm font-bold text-[#3A9DBC]">
                {mission.chapter_order}
              </div>
              <div>
                <p className="font-bold text-white text-sm">{mission.title}</p>
                <p className="text-xs text-white/50">{mission.description}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-white/50">
              <span>🥇 {mission.reward_exp} EXP</span>
              <span>💰 {mission.reward_gold} Oro</span>
            </div>
          </div>
        ))}
        {missions.length === 0 && (
          <p className="text-center text-white/30 py-8">Nessuna missione attiva</p>
        )}
      </div>
    </div>
  )
}
