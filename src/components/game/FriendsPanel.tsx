'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GiThreeFriends, GiCheckMark, GiCancel } from 'react-icons/gi'

interface FriendEntry {
  friendshipId: string
  userId: string
  nickname: string | null
  avatarUrl: string | null
}

/**
 * Pannello Amici del Profilo: amicizie globali (cross-sessione).
 * Aggiungi per nickname esatto; accetta/rifiuta le richieste in arrivo.
 */
export default function FriendsPanel() {
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [pendingIn, setPendingIn] = useState<FriendEntry[]>([])
  const [pendingOut, setPendingOut] = useState<FriendEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    fetch('/api/game/friends')
      .then(r => r.json())
      .then(d => {
        setFriends(d.friends ?? [])
        setPendingIn(d.pendingIn ?? [])
        setPendingOut(d.pendingOut ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  async function sendRequest() {
    if (!nickname.trim() || busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/game/friends/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
      const d = await res.json()
      if (res.ok) { setMsg({ ok: true, text: `Richiesta inviata a ${d.nickname}!` }); setNickname(''); load() }
      else setMsg({ ok: false, text: d.error ?? 'Errore' })
    } catch { setMsg({ ok: false, text: 'Errore di rete' }) }
    finally { setBusy(false) }
  }

  async function respond(friendshipId: string, accept: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/game/friends/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, accept }),
      })
      load()
    } catch { /* ricarica comunque al prossimo giro */ }
    finally { setBusy(false) }
  }

  const Avatar = ({ f }: { f: FriendEntry }) => (
    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm"
      style={{ background: 'rgba(58,157,188,0.18)', border: '1px solid rgba(58,157,188,0.35)' }}>
      {f.avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />
        : '👤'}
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2.5 flex items-center gap-1.5">
        <GiThreeFriends size={13} color="#3A9DBC" /> Amici {friends.length > 0 && `(${friends.length})`}
      </p>

      {/* Aggiungi per nickname */}
      <div className="flex gap-2 mb-2">
        <input
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendRequest() }}
          placeholder="Nickname dell'amico…"
          className="flex-1 min-w-0 rounded-lg bg-[#0A1520] border border-white/15 px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#3A9DBC]"
        />
        <button onClick={sendRequest} disabled={busy || !nickname.trim()}
          className="shrink-0 rounded-lg bg-[#3A9DBC] disabled:bg-white/10 px-3 py-2 text-sm font-bold text-white disabled:text-white/30">
          Aggiungi
        </button>
      </div>
      {msg && <p className={`text-xs mb-2 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}

      {loading ? (
        <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
      ) : (
        <div className="space-y-1.5">
          {/* Richieste in arrivo */}
          <AnimatePresence>
            {pendingIn.map(f => (
              <motion.div key={f.friendshipId} layout exit={{ opacity: 0, x: -12 }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                style={{ background: 'rgba(247,200,65,0.08)', border: '1px solid rgba(247,200,65,0.3)' }}>
                <Avatar f={f} />
                <span className="flex-1 text-sm font-semibold text-white truncate">{f.nickname ?? 'Giocatore'}</span>
                <button onClick={() => respond(f.friendshipId, true)} disabled={busy}
                  aria-label="Accetta" className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.4)' }}>
                  <GiCheckMark size={15} color="#34D399" />
                </button>
                <button onClick={() => respond(f.friendshipId, false)} disabled={busy}
                  aria-label="Rifiuta" className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)' }}>
                  <GiCancel size={15} color="#F87171" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Amici */}
          {friends.map(f => (
            <div key={f.friendshipId} className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/[0.04] border border-white/[0.07]">
              <Avatar f={f} />
              <span className="flex-1 text-sm font-semibold text-white truncate">{f.nickname ?? 'Giocatore'}</span>
            </div>
          ))}

          {/* In attesa (inviate) */}
          {pendingOut.map(f => (
            <div key={f.friendshipId} className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/[0.02] border border-white/[0.05] opacity-60">
              <Avatar f={f} />
              <span className="flex-1 text-sm text-white/60 truncate">{f.nickname ?? 'Giocatore'}</span>
              <span className="text-[10px] text-white/30 font-semibold shrink-0">in attesa…</span>
              <button onClick={() => respond(f.friendshipId, false)} disabled={busy}
                className="text-[10px] text-red-300/70 font-semibold shrink-0">annulla</button>
            </div>
          ))}

          {friends.length === 0 && pendingIn.length === 0 && pendingOut.length === 0 && (
            <p className="text-center text-white/25 py-3 text-xs">
              Nessun amico ancora — aggiungi qualcuno col suo nickname!
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Pannello Gruppo (classe/istituto): entra con il codice dell'organizzatore,
 * poi la classifica offre il filtro "Gruppo".
 */
export function GroupPanel() {
  const [group, setGroup] = useState<{ id: string; name: string; members: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    fetch('/api/game/groups').then(r => r.json())
      .then(d => setGroup(d.group ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  async function join() {
    if (!code.trim() || busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/game/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const d = await res.json()
      if (res.ok) { setMsg({ ok: true, text: `Sei entrato in ${d.name}!` }); setCode(''); load() }
      else setMsg({ ok: false, text: d.error ?? 'Errore' })
    } catch { setMsg({ ok: false, text: 'Errore di rete' }) }
    finally { setBusy(false) }
  }

  async function leave() {
    if (busy || !confirm('Uscire dal gruppo?')) return
    setBusy(true)
    await fetch('/api/game/groups', { method: 'DELETE' }).catch(() => {})
    setBusy(false); setMsg(null); load()
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2.5">
        🏫 Gruppo (classe / squadra)
      </p>
      {loading ? (
        <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
      ) : group ? (
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(58,157,188,0.1)', border: '1px solid rgba(58,157,188,0.3)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{group.name}</p>
            <p className="text-[11px] text-white/40">{group.members} membri — filtra la classifica su "Gruppo"</p>
          </div>
          <button onClick={leave} disabled={busy} className="text-[11px] text-red-300/70 font-semibold shrink-0">esci</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') join() }}
              placeholder="CODICE"
              maxLength={6}
              className="flex-1 min-w-0 rounded-lg bg-[#0A1520] border border-white/15 px-3 py-2 text-sm font-mono tracking-widest text-white placeholder-white/25 focus:outline-none focus:border-[#3A9DBC] uppercase"
            />
            <button onClick={join} disabled={busy || !code.trim()}
              className="shrink-0 rounded-lg bg-[#3A9DBC] disabled:bg-white/10 px-3 py-2 text-sm font-bold text-white disabled:text-white/30">
              Entra
            </button>
          </div>
          <p className="text-[11px] text-white/30 mt-1.5">Chiedi il codice all&apos;organizzatore (classe, scuola, squadra).</p>
        </>
      )}
      {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </div>
  )
}
