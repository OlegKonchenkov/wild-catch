import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0F1F2E] text-white p-8">
      <h2 className="text-4xl font-bold mb-2">404</h2>
      <p className="text-white/50 mb-6">Pagina non trovata</p>
      <Link href="/" className="bg-[#3A9DBC] text-white font-bold px-6 py-3 rounded-xl">
        Torna alla home
      </Link>
    </div>
  )
}
