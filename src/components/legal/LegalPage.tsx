import Link from 'next/link'
import { LEGAL, LEGAL_LAST_UPDATED, resolveController } from '@/lib/legal/controller'
import type { PolicySectionData } from '@/lib/legal/privacy'

/**
 * Shared shell for the public legal pages (/privacy, /termini).
 *
 * Deliberately a server component with no auth: these URLs have to be readable
 * by someone who has never logged in — that's what a privacy policy is for, and
 * both app stores require a publicly reachable link.
 */

function Contact({ email, controllerName }: { email: string; controllerName: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-white font-semibold">{LEGAL.businessName}</p>
      <p className="text-white/55">{LEGAL.address}</p>
      <p><span className="text-white font-semibold">P.IVA:</span> {LEGAL.vatNumber}</p>
      <p><span className="text-white font-semibold">Titolare / referente privacy:</span> {controllerName}</p>
      <p>
        <span className="text-white font-semibold">Email:</span>{' '}
        <a href={`mailto:${email}`} className="text-[#3ABCA8] hover:underline">{email}</a>
      </p>
      <p>
        <span className="text-white font-semibold">Tel:</span>{' '}
        <a href={`tel:${LEGAL.phone.replace(/\s/g, '')}`} className="text-[#3ABCA8] hover:underline">{LEGAL.phone}</a>
      </p>
    </div>
  )
}

export function LegalSections({
  sections,
  email,
  controllerName,
}: {
  sections: PolicySectionData[]
  email: string
  controllerName: string
}) {
  return (
    <div className="space-y-5">
      {sections.map(section => (
        <section key={section.title}>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#F7C841]/85 mb-2">
            {section.title}
          </h2>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-[14px] leading-relaxed text-white/75 space-y-2.5">
            {section.blocks.map((block, i) => {
              if (block.kind === 'contact') {
                return <Contact key={i} email={email} controllerName={controllerName} />
              }
              if (block.kind === 'list') {
                return (
                  <ul key={i} className="list-disc pl-5 space-y-1.5">
                    {block.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )
              }
              return <p key={i}>{block.text}</p>
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <main
      className="min-h-dvh text-white"
      style={{
        background: 'radial-gradient(120% 80% at 50% 0%, #122c3e 0%, #0a1a26 55%, #060f17 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(48px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 pt-8">
        <Link href="/" className="text-[13px] text-[#3ABCA8] hover:underline">← Torna a {LEGAL.appName}</Link>

        <header className="mt-6 mb-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#3ABCA8] mb-1.5">{eyebrow}</p>
          <h1 className="wc-display text-3xl font-extrabold leading-tight">{title}</h1>
          {intro && <p className="mt-3 text-[14px] leading-relaxed text-white/60">{intro}</p>}
          <p className="mt-3 text-[12px] text-white/35">
            Ultimo aggiornamento: {new Date(LEGAL_LAST_UPDATED).toLocaleDateString('it-IT', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </header>

        {children}

        <nav className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-[13px]">
          <Link href="/privacy" className="text-white/50 hover:text-white">Informativa Privacy</Link>
          <Link href="/termini" className="text-white/50 hover:text-white">Termini di Servizio</Link>
          <a
            href={`mailto:${resolveController().email}`}
            className="text-white/50 hover:text-white"
          >
            Contatti
          </a>
        </nav>
      </div>
    </main>
  )
}
