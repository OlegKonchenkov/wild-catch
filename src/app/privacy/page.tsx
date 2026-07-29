import type { Metadata } from 'next'
import LegalPage, { LegalSections } from '@/components/legal/LegalPage'
import { resolveController } from '@/lib/legal/controller'
import { buildPrivacySections } from '@/lib/legal/privacy'

export const metadata: Metadata = {
  title: 'Informativa Privacy — Daimon',
  description: 'Come Daimon tratta i tuoi dati personali: cosa raccogliamo, perché, per quanto tempo e quali diritti hai.',
}

/**
 * Public privacy policy.
 *
 * The policy previously existed only as a modal inside /home, i.e. behind
 * Google login — unreachable for anyone deciding *whether* to sign up, and a
 * blocker for both app stores, which require a publicly linkable URL. Same
 * content, rendered from the shared definition in lib/legal/privacy.ts.
 */
export default function PrivacyPage() {
  const controller = resolveController(
    process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER,
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
  )
  const sections = buildPrivacySections(
    process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER,
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
  )

  return (
    <LegalPage
      eyebrow="Privacy"
      title="Informativa Privacy"
      intro="Daimon è un gioco all'aperto: per funzionare ha bisogno della tua posizione mentre giochi. Qui trovi esattamente quali dati raccogliamo, perché, per quanto tempo li teniamo e come cancellarli."
    >
      <LegalSections
        sections={sections}
        email={controller.email}
        controllerName={controller.controllerName}
      />
    </LegalPage>
  )
}
