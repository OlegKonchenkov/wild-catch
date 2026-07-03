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
  const [tradeWith, setTradeWith] = useState<FriendEntry | null>(null)

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
              <button onClick={() => setTradeWith(f)} aria-label="Proponi scambio"
                className="text-xs font-extrabold px-2 py-1 rounded-lg shrink-0"
                style={{ background: 'rgba(96,205,221,0.14)', color: '#60CDDD', border: '1px solid rgba(96,205,221,0.35)' }}>
                ⇄
              </button>
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

      {tradeWith && <TradeModal friend={tradeWith} onClose={() => setTradeWith(null)} />}
    </div>
  )
}

interface DupeOption { creatureId: string; copies: number; name: string; rarity: string | null; image: string | null }

/** Proposta di scambio doppioni: scegli un tuo doppione e uno dell'amico. */
function TradeModal({ friend, onClose }: { friend: FriendEntry; onClose: () => void }) {
  const [mine, setMine] = useState<DupeOption[]>([])
  const [theirs, setTheirs] = useState<DupeOption[]>([])
  const [offer, setOffer] = useState<string | null>(null)
  const [want, setWant] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const sid = localStorage.getItem('current_session_id')
    if (!sid) { setLoading(false); return }
    fetch(`/api/game/trades/options?friendId=${friend.userId}&sessionId=${sid}`)
      .then(r => r.json())
      .then(d => { setMine(d.mine ?? []); setTheirs(d.theirs ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [friend.userId])

  async function propose() {
    const sid = localStorage.getItem('current_session_id')
    if (!sid || !offer || !want || busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/game/trades', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: friend.userId, offerCreatureId: offer, requestCreatureId: want, sessionId: sid }),
      })
      const d = await res.json()
      if (res.ok) { setMsg('Proposta inviata!'); setTimeout(onClose, 1200) }
      else setMsg(d.error ?? 'Errore')
    } catch { setMsg('Errore di rete') }
    finally { setBusy(false) }
  }

  const Picker = ({ title, options, value, onPick }: { title: string; options: DupeOption[]; value: string | null; onPick: (id: string) => void }) => (
    <div>
      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1.5">{title}</p>
      {options.length === 0 ? (
        <p className="text-xs text-white/25 py-2">Nessun doppione disponibile</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {options.map(o => (
            <button key={o.creatureId} onClick={() => onPick(o.creatureId)}
              className="shrink-0 w-16 rounded-xl p-1.5 text-center"
              style={{ background: value === o.creatureId ? 'rgba(96,205,221,0.18)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${value === o.creatureId ? '#60CDDD' : 'rgba(255,255,255,0.1)'}` }}>
              <div className="w-12 h-12 mx-auto rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {o.image ? <img src={o.image} alt={o.name} className="w-full h-full object-cover" /> : <span>?</span>}
              </div>
              <p className="text-[9px] text-white/70 font-semibold truncate mt-1">{o.name}</p>
              <p className="text-[9px] text-white/30">x{o.copies}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
        style={{ background: '#0B1626', border: '1px solid rgba(96,205,221,0.35)' }}>
        <div className="text-center">
          <p className="text-white font-extrabold text-lg">⇄ Scambio con {friend.nickname ?? 'amico'}</p>
          <p className="text-white/40 text-xs mt-0.5">Solo doppioni: a entrambi resta sempre almeno 1 copia</p>
        </div>
        {loading ? <div className="h-20 rounded-xl bg-white/5 animate-pulse" /> : (
          <>
            <Picker title="Offri (un tuo doppione)" options={mine} value={offer} onPick={setOffer} />
            <Picker title="Chiedi (un suo doppione)" options={theirs} value={want} onPick={setWant} />
          </>
        )}
        {msg && <p className="text-xs text-center" style={{ color: msg.includes('inviata') ? '#34D399' : '#F87171' }}>{msg}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-sm text-white/50 bg-white/5 border border-white/10">Annulla</button>
          <button onClick={propose} disabled={busy || !offer || !want}
            className="flex-[2] py-3 rounded-xl font-extrabold text-sm text-[#05070E] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7FE6FF, #3A9DBC)' }}>
            {busy ? 'Invio…' : 'Proponi scambio'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Proposte di scambio pendenti (in arrivo / inviate). */
export function TradesPanel() {
  const [incoming, setIncoming] = useState<any[]>([])
  const [outgoing, setOutgoing] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    const sid = localStorage.getItem('current_session_id')
    if (!sid) return
    fetch(`/api/game/trades?sessionId=${sid}`)
      .then(r => r.json())
      .then(d => { setIncoming(d.incoming ?? []); setOutgoing(d.outgoing ?? []) })
      .catch(() => {})
  }, [])
  useEffect(load, [load])

  async function respond(tradeId: string, action: 'accept' | 'decline' | 'cancel') {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/game/trades', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, action }),
      })
      window.dispatchEvent(new CustomEvent('wc:refresh-stats'))
      load()
    } catch { /* riprova al prossimo load */ }
    finally { setBusy(false) }
  }

  if (incoming.length === 0 && outgoing.length === 0) return null

  const Row = ({ t, mine }: { t: any; mine: boolean }) => (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
      style={{ background: mine ? 'rgba(255,255,255,0.02)' : 'rgba(96,205,221,0.07)', border: `1px solid ${mine ? 'rgba(255,255,255,0.06)' : 'rgba(96,205,221,0.3)'}` }}>
      <span className="flex-1 min-w-0 text-white/75 truncate">
        <strong>{t.otherNickname}</strong>: dai <strong className="text-[#F87171]">{t.give?.name ?? '?'}</strong> ⇄ ricevi <strong className="text-[#34D399]">{t.get?.name ?? '?'}</strong>
      </span>
      {mine ? (
        <button onClick={() => respond(t.id, 'cancel')} disabled={busy} className="text-red-300/70 font-semibold shrink-0">annulla</button>
      ) : (
        <>
          <button onClick={() => respond(t.id, 'accept')} disabled={busy}
            className="px-2 py-1 rounded-md font-bold shrink-0" style={{ background: 'rgba(52,211,153,0.18)', color: '#34D399' }}>OK</button>
          <button onClick={() => respond(t.id, 'decline')} disabled={busy}
            className="px-2 py-1 rounded-md font-bold shrink-0" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}>NO</button>
        </>
      )}
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">⇄ Scambi in sospeso</p>
      {incoming.map(t => <Row key={t.id} t={t} mine={false} />)}
      {outgoing.map(t => <Row key={t.id} t={t} mine={true} />)}
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
