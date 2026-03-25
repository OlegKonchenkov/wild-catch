'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function JoinForm() {
  const [code, setCode] = useState('')
  const [gdprAccepted, setGdprAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  // After OAuth redirect, consume pending_code from sessionStorage
  useEffect(() => {
    if (searchParams.get('resume') !== '1') return
    const pending = sessionStorage.getItem('pending_code')
    if (!pending) { router.replace('/game/map'); return }
    sessionStorage.removeItem('pending_code')
    setLoading(true)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pending }),
      }).then(async res => {
        const data = await res.json()
        if (!res.ok) { setError(data.error); setLoading(false) }
        else router.replace('/game/map')
      })
    })
  }, [searchParams, supabase, router])

  async function handleGoogleSignIn() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault()
    if (!gdprAccepted) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      sessionStorage.setItem('pending_code', code.toUpperCase())
      await handleGoogleSignIn()
      return
    }

    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    router.push('/game/map')
  }

  return (
    <main className="min-h-screen bg-[#0F1F2E] flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-white mb-2">WildCatch</h1>
      <p className="text-[#3A9DBC] text-sm mb-10">
        La prima avventura outdoor dove catturi creature e risolvi misteri
      </p>

      <form onSubmit={handleJoinWithCode} className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="Inserisci codice invito"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-center text-xl tracking-widest uppercase"
        />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={gdprAccepted}
            onChange={e => setGdprAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[#E85D2F] shrink-0"
          />
          <span className="text-white/70 text-xs leading-relaxed">
            Accetto il trattamento dei dati personali ai sensi del GDPR (art. 6 GDPR) per la partecipazione al gioco
          </span>
        </label>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length < 6 || !gdprAccepted}
          className="w-full bg-[#E85D2F] text-white font-bold py-4 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Connessione...' : 'PARTECIPA'}
        </button>
      </form>

      <div className="my-6 text-white/30 text-sm">oppure accedi con</div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading || !gdprAccepted}
        className="flex items-center gap-3 bg-white text-[#1C2B3A] font-semibold px-6 py-3 rounded-xl disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continua con Google
      </button>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
