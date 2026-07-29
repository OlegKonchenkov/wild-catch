import type { Metadata } from 'next'
import LegalPage, { LegalSections } from '@/components/legal/LegalPage'
import { resolveController } from '@/lib/legal/controller'
import { buildTermsSections } from '@/lib/legal/terms'

export const metadata: Metadata = {
  title: 'Termini di Servizio — Daimon',
  description: 'Le regole per usare Daimon: accesso, età minima, sicurezza durante il gioco all\'aperto, oggetti virtuali e premi.',
}

export default function TerminiPage() {
  const controller = resolveController(null, process.env.NEXT_PUBLIC_PRIVACY_EMAIL)
  const sections = buildTermsSections(process.env.NEXT_PUBLIC_PRIVACY_EMAIL)

  return (
    <LegalPage
      eyebrow="Termini"
      title="Termini di Servizio"
      intro="Daimon si gioca camminando all'aperto. Queste sono le regole d'uso — la sezione che conta davvero è «Gioca in sicurezza»."
    >
      <LegalSections
        sections={sections}
        email={controller.email}
        controllerName={controller.controllerName}
      />
    </LegalPage>
  )
}
