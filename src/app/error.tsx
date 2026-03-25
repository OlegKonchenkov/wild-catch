'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0F1F2E] text-white p-8">
      <h2 className="text-xl font-bold mb-2">Qualcosa è andato storto</h2>
      <p className="text-white/50 text-sm mb-6">Riprova o ricarica la pagina.</p>
      <button onClick={reset} className="bg-[#3A9DBC] text-white font-bold px-6 py-3 rounded-xl">
        Riprova
      </button>
    </div>
  )
}
