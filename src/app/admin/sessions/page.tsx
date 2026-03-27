'use client'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Bounds } from '@/components/admin/MapPicker'

function SessionTimeInfo({ session }: { session: { status: string; start_at: string | null; end_at: string | null; duration_minutes: number } }) {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    if (session.status !== 'active') { setCountdown(''); return }

    function computeEnd() {
      if (session.end_at) return new Date(session.end_at)
      if (session.start_at) return new Date(new Date(session.start_at).getTime() + session.duration_minutes * 60000)
      return null
    }

    function tick() {
      const end = computeEnd()
      if (!end) { setCountdown(''); return }
      const diff = end.getTime() - Date.now()
      if (diff <= 0) { setCountdown('scaduta'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(h > 0
        ? `${h}h ${m.toString().padStart(2, '0')}m`
        : `${m}m ${s.toString().padStart(2, '0')}s`)
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [session.status, session.end_at, session.start_at, session.duration_minutes])

  if (session.status === 'active' && countdown) {
    const end = session.end_at
      ? new Date(session.end_at)
      : session.start_at
        ? new Date(new Date(session.start_at).getTime() + session.duration_minutes * 60000)
        : null
    const diffMs = end ? end.getTime() - Date.now() : Infinity
    const urgent = diffMs < 5 * 60 * 1000
    return (
      <span className={`font-mono font-bold ${urgent ? 'text-red-400 animate-pulse' : 'text-[#34d399]'}`}>
        ⏱ {countdown} rimasti
      </span>
    )
  }

  if (session.status === 'ended' && session.end_at) {
    return (
      <span className="text-white/30">
        Terminata {new Date(session.end_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }

  if (session.status === 'active' && session.start_at) {
    return (
      <span className="text-white/40">
        Avviata {new Date(session.start_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }

  return null
}

const MapPicker = dynamic(() => import('@/components/admin/MapPicker'), { ssr: false })

type WizardStep = 1 | 2 | 3 | 4

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bozza', ready: 'Pronta', active: 'Attiva', ended: 'Terminata',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'text-white/40', ready: 'text-[#F7C841]', active: 'text-[#34d399]', ended: 'text-white/25',
}
const STATUS_BG: Record<string, string> = {
  draft: 'bg-white/5', ready: 'bg-[#F7C841]/8', active: 'bg-[#34d399]/8', ended: 'bg-white/3',
}

interface Session {
  id: string
  name: string
  status: string
  duration_minutes: number
  area_bounds: Bounds | null
  narrative_config: any
  start_at: string | null
  end_at: string | null
  created_at: string
}

interface EditForm {
  name: string
  durationMinutes: number
  areaBounds: Bounds | null
  storyTitle: string
  introText: string
  villainName: string
}

export default function SessionsPage() {
  const [sessions, setSessions]   = useState<Session[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<EditForm | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editOk, setEditOk]       = useState(false)

  // Create wizard
  const [step, setStep]           = useState<WizardStep>(1)
  const [createLoading, setCreateLoading] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [sessionName, setSessionName]     = useState('')
  const [storyTitle, setStoryTitle]       = useState('')
  const [introText, setIntroText]         = useState('')
  const [villainName, setVillainName]     = useState('')
  const [areaBounds, setAreaBounds]       = useState<Bounds | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(120)

  const loadSessions = () =>
    supabase.from('sessions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data as Session[]) })

  useEffect(() => {
    loadSessions()
    const channel = supabase
      .channel('admin-sessions-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Edit ───────────────────────────────────────────────── */
  function openEdit(s: Session) {
    setEditingId(s.id)
    setEditError(null)
    setEditOk(false)
    setEditForm({
      name: s.name,
      durationMinutes: s.duration_minutes,
      areaBounds: s.area_bounds ?? null,
      storyTitle: s.narrative_config?.story_title ?? '',
      introText: s.narrative_config?.intro_text ?? '',
      villainName: s.narrative_config?.villain_name ?? '',
    })
  }

  function closeEdit() { setEditingId(null); setEditForm(null); setEditError(null) }

  async function saveEdit() {
    if (!editingId || !editForm) return
    setEditLoading(true); setEditError(null); setEditOk(false)
    const res = await fetch('/api/admin/session/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: editingId,
        name: editForm.name,
        durationMinutes: editForm.durationMinutes,
        areaBounds: editForm.areaBounds,
        narrativeConfig: {
          story_title: editForm.storyTitle,
          intro_text: editForm.introText,
          villain_name: editForm.villainName,
          chapters: sessions.find(s => s.id === editingId)?.narrative_config?.chapters ?? [],
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error ?? 'Errore salvataggio') }
    else { setEditOk(true); await loadSessions(); setTimeout(() => { setEditOk(false); closeEdit() }, 1200) }
    setEditLoading(false)
  }

  /* ── Status actions ─────────────────────────────────────── */
  async function setReady(sid: string) {
    await supabase.from('sessions').update({ status: 'ready' }).eq('id', sid)
    loadSessions()
  }

  async function startSession(sid: string) {
    await fetch('/api/admin/session/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    loadSessions()
  }

  async function closeSession(sid: string) {
    if (!confirm('Terminare la sessione? I giocatori non potranno più giocare.')) return
    await fetch('/api/admin/session/close', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    loadSessions()
  }

  async function restartSession(sid: string, name: string) {
    if (!confirm(`Riavviare "${name}"?\n\nLa sessione tornerà in stato Bozza. Dovrai impostare una nuova area e durata prima di attivarla.`)) return
    const res = await fetch('/api/admin/session/restart', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    if (res.ok) loadSessions()
  }

  async function deleteSession(sid: string, name: string) {
    if (!confirm(`Eliminare definitivamente "${name}"?\n\nTutti i dati correlati verranno eliminati.`)) return
    setDeletingId(sid)
    await supabase.from('sessions').delete().eq('id', sid)
    setSessions(ss => ss.filter(s => s.id !== sid))
    setDeletingId(null)
  }

  /* ── Create ─────────────────────────────────────────────── */
  async function createSession() {
    setCreateLoading(true)
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
    if (res.ok) {
      setCreatedId(data.sessionId)
      setStep(4)
      await loadSessions()
    }
    setCreateLoading(false)
  }

  function resetWizard() {
    setStep(1); setCreatedId(null); setSessionName(''); setStoryTitle(''); setIntroText('')
    setVillainName(''); setAreaBounds(null); setDurationMinutes(120); setShowCreate(false)
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎮 Sessioni</h1>
        <button
          onClick={() => { setShowCreate(v => !v); if (showCreate) resetWizard() }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            showCreate ? 'bg-white/10 text-white/60' : 'bg-[#3A9DBC] text-white'
          }`}
        >
          {showCreate ? '✕ Chiudi' : '+ Nuova sessione'}
        </button>
      </div>

      {/* ── Existing sessions ── */}
      {sessions.length === 0 && (
        <p className="text-white/40 text-sm py-4 text-center">Nessuna sessione ancora.</p>
      )}

      {sessions.map(s => {
        const isEditing = editingId === s.id
        return (
          <div key={s.id} className={`rounded-2xl border transition-all ${STATUS_BG[s.status]} ${isEditing ? 'border-[#3A9DBC]/50' : 'border-white/10'}`}>
            {/* Card header */}
            <div className="flex items-start gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{s.name}</p>
                <p className="text-xs text-white/40 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span>{s.duration_minutes} min</span>
                  <span>·</span>
                  <span className={STATUS_COLOR[s.status] ?? 'text-white/40'}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                  <span>·</span>
                  <span>{s.area_bounds ? '🗺 Area definita' : '⚠️ Nessuna area'}</span>
                  <SessionTimeInfo session={s} />
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {s.status === 'draft' && (
                  <button onClick={() => setReady(s.id)}
                    className="bg-[#F7C841] text-[#0F1F2E] px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all">
                    Pronta ✓
                  </button>
                )}
                {s.status === 'ready' && (
                  <button onClick={() => startSession(s.id)}
                    className="bg-[#34d399] text-[#0F1F2E] px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all">
                    ▶ START
                  </button>
                )}
                {s.status === 'active' && (
                  <button onClick={() => closeSession(s.id)}
                    className="bg-red-500/15 text-red-400 border border-red-500/25 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/25 transition-colors">
                    ⏹ Termina
                  </button>
                )}
                {s.status === 'ended' && (
                  <button onClick={() => restartSession(s.id, s.name)}
                    className="bg-[#7B4DB8]/20 text-[#C084FC] border border-[#7B4DB8]/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#7B4DB8]/30 transition-colors">
                    🔄 Riavvia
                  </button>
                )}
                <button
                  onClick={() => isEditing ? closeEdit() : openEdit(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    isEditing ? 'bg-[#3A9DBC]/20 text-[#3A9DBC]' : 'bg-white/8 text-white/60 hover:text-white hover:bg-white/15'
                  }`}
                  title="Modifica"
                >
                  {isEditing ? '✕' : '✏️ Modifica'}
                </button>
                <button
                  onClick={() => deleteSession(s.id, s.name)}
                  disabled={deletingId === s.id}
                  className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                >
                  {deletingId === s.id ? '…' : '🗑'}
                </button>
              </div>
            </div>

            {/* Inline edit panel */}
            {isEditing && editForm && (
              <div className="border-t border-white/10 p-4 space-y-4">
                {s.status === 'active' && (
                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 text-xs text-amber-300">
                    ⚠️ La sessione è attiva — le modifiche avranno effetto immediato sui giocatori
                  </div>
                )}

                {/* Name + duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1 font-semibold">Nome evento *</label>
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => f && ({ ...f, name: e.target.value }))}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1 font-semibold">Durata (minuti)</label>
                    <input
                      type="number" min={30} max={480}
                      value={editForm.durationMinutes}
                      onChange={e => setEditForm(f => f && ({ ...f, durationMinutes: +e.target.value }))}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60"
                    />
                  </div>
                </div>

                {/* Narrative */}
                <details className="bg-white/3 border border-white/10 rounded-xl">
                  <summary className="px-3 py-2 text-xs font-semibold text-white/60 cursor-pointer select-none hover:text-white/80">
                    📖 Narrativa (opzionale)
                  </summary>
                  <div className="px-3 pb-3 space-y-2 pt-2 border-t border-white/10">
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Titolo storia</label>
                      <input value={editForm.storyTitle}
                        onChange={e => setEditForm(f => f && ({ ...f, storyTitle: e.target.value }))}
                        className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Testo introduttivo</label>
                      <textarea value={editForm.introText} rows={2}
                        onChange={e => setEditForm(f => f && ({ ...f, introText: e.target.value }))}
                        className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#3A9DBC]/60" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Nome villain</label>
                      <input value={editForm.villainName}
                        onChange={e => setEditForm(f => f && ({ ...f, villainName: e.target.value }))}
                        className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60" />
                    </div>
                  </div>
                </details>

                {/* Map area */}
                <div>
                  <label className="block text-xs text-white/50 mb-2 font-semibold">🗺 Area geografica</label>
                  <MapPicker
                    key={`edit-${s.id}`}
                    initialBounds={editForm.areaBounds}
                    onBoundsChange={b => setEditForm(f => f && ({ ...f, areaBounds: b }))}
                  />
                </div>

                {/* Save/cancel */}
                {editError && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠ {editError}</p>}
                {editOk    && <p className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">✅ Salvato!</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={closeEdit} className="flex-1 bg-white/8 text-white/60 border border-white/15 font-bold py-2.5 rounded-xl text-sm hover:bg-white/12 transition-colors">
                    Annulla
                  </button>
                  <button onClick={saveEdit} disabled={editLoading || !editForm.name.trim()}
                    className="flex-1 bg-[#3A9DBC] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 hover:brightness-110 transition-all">
                    {editLoading ? 'Salvataggio…' : '💾 Salva modifiche'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Create wizard ── */}
      {showCreate && (
        <div className="border border-white/20 rounded-2xl p-5 mt-2">
          <h2 className="font-bold text-base mb-4">➕ Nuova sessione</h2>

          {/* Progress bar */}
          <div className="flex gap-2 mb-5">
            {([1, 2, 3, 4] as WizardStep[]).map(n => (
              <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= n ? 'bg-[#3A9DBC]' : 'bg-white/10'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 mb-2">Step 1 di 4 — Nome e Narrativa</p>
              <div>
                <label className="block text-xs text-white/50 mb-1 font-semibold">Nome evento <span className="text-red-400">*</span></label>
                <input value={sessionName} onChange={e => setSessionName(e.target.value)}
                  placeholder="es. WildCatch Estate 2026"
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Titolo storia <span className="text-white/25">(opzionale)</span></label>
                <input value={storyTitle} onChange={e => setStoryTitle(e.target.value)}
                  placeholder="es. Il ritorno delle creature oscure"
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Testo introduttivo</label>
                <textarea value={introText} onChange={e => setIntroText(e.target.value)}
                  placeholder="Testo di benvenuto che vedranno i giocatori all'avvio…" rows={3}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#3A9DBC]/60" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Nome villain <span className="text-white/25">(opzionale)</span></label>
                <input value={villainName} onChange={e => setVillainName(e.target.value)}
                  placeholder="es. Lord Malachar"
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60" />
              </div>
              <button onClick={() => setStep(2)} disabled={!sessionName.trim()}
                className="w-full bg-[#3A9DBC] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                Avanti →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 mb-2">Step 2 di 4 — Area geografica e Durata</p>
              <MapPicker key="create" onBoundsChange={setAreaBounds} initialBounds={areaBounds} />
              <div>
                <label className="block text-xs text-white/50 mb-1 font-semibold">Durata evento (30–480 minuti)</label>
                <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(+e.target.value)}
                  min={30} max={480}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3A9DBC]/60" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 bg-white/8 text-white font-bold py-3 rounded-xl text-sm hover:bg-white/12 transition-colors">← Indietro</button>
                <button onClick={() => setStep(3)} disabled={!areaBounds}
                  className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">Avanti →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 mb-2">Step 3 di 4 — Creature</p>
              <div className="bg-white/4 border border-white/10 rounded-xl p-4 text-sm text-white/60 leading-relaxed">
                Le creature vengono dal catalogo globale. Puoi configurare spawn e rarità dalla sezione <strong className="text-white/80">Creature</strong> dopo aver creato la sessione.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 bg-white/8 text-white font-bold py-3 rounded-xl text-sm hover:bg-white/12 transition-colors">← Indietro</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-[#3A9DBC] text-white font-bold py-3 rounded-xl text-sm">Avanti →</button>
              </div>
            </div>
          )}

          {step === 4 && !createdId && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 mb-2">Step 4 di 4 — Riepilogo</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
                <p><span className="text-white/50">Nome:</span> <span className="text-white font-semibold">{sessionName}</span></p>
                <p><span className="text-white/50">Storia:</span> <span className="text-white">{storyTitle || '—'}</span></p>
                <p><span className="text-white/50">Durata:</span> <span className="text-white">{durationMinutes} min</span></p>
                <p><span className="text-white/50">Area:</span> <span className={areaBounds ? 'text-[#34d399]' : 'text-amber-400'}>{areaBounds ? '✅ Definita' : '⚠️ Non definita'}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="flex-1 bg-white/8 text-white font-bold py-3 rounded-xl text-sm hover:bg-white/12 transition-colors">← Indietro</button>
                <button onClick={createSession} disabled={createLoading}
                  className="flex-1 bg-[#34d399] text-[#0F1F2E] font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                  {createLoading ? 'Creazione…' : '✅ Crea sessione'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && createdId && (
            <div className="space-y-3 text-center py-4">
              <p className="text-3xl">🎉</p>
              <p className="text-[#34d399] font-bold text-lg">Sessione creata!</p>
              <p className="text-sm text-white/50">Imposta come "Pronta" per distribuire i codici invito ai giocatori.</p>
              <button onClick={resetWizard}
                className="w-full bg-white/8 text-white font-bold py-3 rounded-xl text-sm hover:bg-white/12 transition-colors mt-2">
                Chiudi
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
