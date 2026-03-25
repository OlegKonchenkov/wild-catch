'use client'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const MapPicker = dynamic(() => import('@/components/admin/MapPicker'), { ssr: false })

type WizardStep = 1 | 2 | 3 | 4

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bozza', ready: 'Pronta', active: 'Attiva', ended: 'Terminata',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'text-white/40', ready: 'text-[#F7C841]', active: 'text-[#34d399]', ended: 'text-white/25',
}

export default function SessionsPage() {
  const [step, setStep] = useState<WizardStep>(1)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Step 1: Narrative
  const [sessionName, setSessionName] = useState('')
  const [storyTitle, setStoryTitle] = useState('')
  const [introText, setIntroText] = useState('')
  const [villainName, setVillainName] = useState('')

  // Step 2: Area
  const [areaBounds, setAreaBounds] = useState<any>(null)
  const [durationMinutes, setDurationMinutes] = useState(120)

  // Step 4: created session id
  const [sessionId, setSessionId] = useState<string | null>(null)

  const loadSessions = () =>
    supabase.from('sessions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })

  useEffect(() => { loadSessions() }, [supabase])

  async function createSession() {
    setLoading(true)
    const res = await fetch('/api/admin/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sessionName,
        narrativeConfig: { story_title: storyTitle, intro_text: introText, villain_name: villainName, chapters: [] },
        areaBounds,
        durationMinutes,
      }),
    })
    const data = await res.json()
    if (res.ok) { setSessionId(data.sessionId); setStep(4) }
    setLoading(false)
  }

  async function setReady(sid: string) {
    await supabase.from('sessions').update({ status: 'ready' }).eq('id', sid)
    loadSessions()
  }

  async function startSession(sid: string) {
    await fetch('/api/admin/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    loadSessions()
  }

  async function deleteSession(sid: string, name: string) {
    if (!confirm(`Eliminare definitivamente la sessione "${name}"?\n\nAttenzione: tutti i dati correlati (giocatori, missioni, inviti, creature) verranno eliminati.`)) return
    setDeletingId(sid)
    await supabase.from('sessions').delete().eq('id', sid)
    setSessions(ss => ss.filter(s => s.id !== sid))
    setDeletingId(null)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Gestione Sessioni</h1>

      {/* Existing sessions */}
      <div className="space-y-3 mb-8">
        {sessions.length === 0 && (
          <p className="text-white/40 text-sm">Nessuna sessione ancora.</p>
        )}
        {sessions.map(s => (
          <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{s.name}</p>
                <p className="text-sm text-white/40 mt-0.5">
                  {s.duration_minutes} min ·{' '}
                  <span className={STATUS_COLOR[s.status] ?? 'text-white/40'}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === 'draft' && (
                  <button onClick={() => setReady(s.id)}
                    className="bg-[#F7C841] text-[#0F1F2E] px-3 py-1.5 rounded-lg text-sm font-bold">
                    Pronta
                  </button>
                )}
                {s.status === 'ready' && (
                  <button onClick={() => startSession(s.id)}
                    className="bg-[#34d399] text-[#0F1F2E] px-3 py-1.5 rounded-lg text-sm font-bold">
                    ▶ START
                  </button>
                )}
                {s.status === 'active' && (
                  <span className="text-[#34d399] font-bold text-sm">🟢 Attiva</span>
                )}
                <button
                  onClick={() => deleteSession(s.id, s.name)}
                  disabled={deletingId === s.id}
                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                  title="Elimina sessione"
                >
                  {deletingId === s.id ? '...' : '🗑'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create new session wizard */}
      <div className="border border-white/20 rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Crea Nuova Sessione</h2>

        {/* Step indicators */}
        <div className="flex gap-2 mb-6">
          {([1, 2, 3, 4] as WizardStep[]).map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-[#3A9DBC]' : 'bg-white/10'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 1 di 4 — Nome e Narrativa</p>
            <div>
              <label className="block text-xs text-white/50 mb-1">Nome evento <span className="text-red-400">*</span></label>
              <input value={sessionName} onChange={e => setSessionName(e.target.value)}
                placeholder="es. WildCatch Estate 2026"
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Titolo storia</label>
              <input value={storyTitle} onChange={e => setStoryTitle(e.target.value)}
                placeholder="es. Il ritorno delle creature oscure"
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Testo introduttivo (mostrato ai giocatori all'avvio)</label>
              <textarea value={introText} onChange={e => setIntroText(e.target.value)}
                placeholder="Scrivi il testo di introduzione che vedranno i giocatori..."
                rows={3}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 resize-none" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Nome antagonista / villain</label>
              <input value={villainName} onChange={e => setVillainName(e.target.value)}
                placeholder="es. Lord Malachar"
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            </div>
            <button onClick={() => setStep(2)} disabled={!sessionName}
              className="w-full bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-50">
              Avanti →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 2 di 4 — Area geografica e Durata</p>
            <label className="block text-xs text-white/50 mb-1">
              Seleziona l'area sulla mappa (trascina per definire i confini dell'evento)
            </label>
            <div className="h-64 rounded-xl overflow-hidden border border-white/20">
              <MapPicker onBoundsChange={setAreaBounds} />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Durata evento (minuti) — tra 30 e 480</label>
              <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(+e.target.value)}
                min={30} max={480}
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">← Indietro</button>
              <button onClick={() => setStep(3)} disabled={!areaBounds}
                className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-50">Avanti →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 3 di 4 — Creature</p>
            <p className="text-white/70 text-sm">
              Le creature disponibili vengono dal catalogo globale. Puoi configurare le probabilità di spawn
              dalla sezione <strong>Creature</strong> dopo aver creato la sessione.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">← Indietro</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl">Avanti →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-3">Step 4 di 4 — Rivedi e Crea</p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
              <p><span className="text-white/50">Nome:</span> <span className="text-white">{sessionName}</span></p>
              <p><span className="text-white/50">Storia:</span> <span className="text-white">{storyTitle || '—'}</span></p>
              <p><span className="text-white/50">Durata:</span> <span className="text-white">{durationMinutes} min</span></p>
              <p><span className="text-white/50">Area:</span> <span className="text-white">{areaBounds ? 'Definita ✅' : 'Non definita ⚠️'}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl">← Indietro</button>
              <button onClick={createSession} disabled={loading}
                className="flex-1 bg-[#34d399] text-[#0F1F2E] font-bold py-3 rounded-xl disabled:opacity-50">
                {loading ? 'Creazione...' : '✅ Crea Sessione'}
              </button>
            </div>
            {sessionId && (
              <div className="bg-[#34d399]/10 border border-[#34d399] rounded-xl p-3 text-center">
                <p className="text-[#34d399] font-bold">Sessione creata!</p>
                <p className="text-sm text-white/60">Imposta come "Pronta" per distribuire i codici invito</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
