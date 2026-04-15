'use client'

import { useEffect } from 'react'

interface PrivacyPolicyModalProps {
  open: boolean
  onClose: () => void
  controllerName?: string | null
  contactEmail?: string | null
}

function PolicySection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        padding: '14px 14px 0',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(247,200,65,0.82)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '12px 13px',
          color: 'rgba(255,255,255,0.72)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </section>
  )
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 18, margin: 0 }}>
      {items.map(item => (
        <li key={item} style={{ marginBottom: 6 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

export default function PrivacyPolicyModal({
  open,
  onClose,
  controllerName,
  contactEmail,
}: PrivacyPolicyModalProps) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  // Dati fissi del titolare — Adventura Escape Room Pesaro
  const businessName   = 'Adventura Escape Room Pesaro di Marco Tomasucci'
  const controllerLabel = controllerName?.trim() || 'Marco Tomasucci'
  const address        = 'Via XXIV Maggio 17, 61121 Pesaro (PU) — Italia'
  const vatNumber      = '02812540413'
  const contactLabel   = contactEmail?.trim() || 'adventuraescaperoom@gmail.com'
  const phone          = '+39 339 7136398'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Informativa Privacy"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        background: 'rgba(4, 10, 20, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px 14px',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '84svh',
          overflowY: 'auto',
          borderRadius: 24,
          background:
            'linear-gradient(160deg, rgba(13,30,46,0.98) 0%, rgba(10,21,32,0.99) 100%)',
          border: '1px solid rgba(58,188,168,0.2)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            padding: '18px 18px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background:
              'linear-gradient(180deg, rgba(13,30,46,0.98) 0%, rgba(13,30,46,0.94) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#3ABCA8',
                  marginBottom: 6,
                }}
              >
                Privacy
              </div>
              <h2
                style={{
                  fontSize: 22,
                  lineHeight: 1.15,
                  color: '#fff',
                  margin: 0,
                }}
              >
                Informativa Privacy
              </h2>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.42)',
                  lineHeight: 1.5,
                }}
              >
                Versione sintetica mostrata al momento di accesso all&apos;evento. Ultimo
                aggiornamento: 15 aprile 2026.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.76)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
              }}
              aria-label="Chiudi informativa privacy"
            >
              x
            </button>
          </div>
        </div>

        <div style={{ paddingBottom: 18 }}>
          <PolicySection title="Titolare del trattamento">
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff' }}>{businessName}</strong>
            </p>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.55)' }}>
              {address}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              <strong style={{ color: '#fff' }}>P.IVA:</strong>{' '}
              <span style={{ color: 'rgba(255,255,255,0.72)' }}>{vatNumber}</span>
            </p>
            <p style={{ margin: '6px 0 0' }}>
              <strong style={{ color: '#fff' }}>Titolare / referente privacy:</strong>{' '}
              {controllerLabel}
            </p>
            <p style={{ margin: '6px 0 0' }}>
              <strong style={{ color: '#fff' }}>Email:</strong>{' '}
              <a href={`mailto:${contactLabel}`} style={{ color: '#3ABCA8', textDecoration: 'none' }}>
                {contactLabel}
              </a>
            </p>
            <p style={{ margin: '6px 0 0' }}>
              <strong style={{ color: '#fff' }}>Tel:</strong>{' '}
              <a href={`tel:${phone}`} style={{ color: '#3ABCA8', textDecoration: 'none' }}>
                {phone}
              </a>
            </p>
          </PolicySection>

          <PolicySection title="Quali dati trattiamo">
            <PolicyList
              items={[
                "dati di accesso e profilo provenienti dall'autenticazione (es. email, nome profilo, avatar Google se disponibile)",
                'nickname scelto nel gioco',
                'partecipazione alla sessione, progressi, inventario, creature, missioni, duelli, QR riscattati e ricompense',
                'posizione GPS e accuratezza durante il gioco, necessarie alle funzioni basate sulla mappa e sugli incontri',
                "dati tecnici essenziali per tenere aperta la sessione sul dispositivo, come l'identificativo sessione salvato in locale",
              ]}
            />
          </PolicySection>

          <PolicySection title="Perche usiamo questi dati">
            <PolicyList
              items={[
                "consentirti l'accesso e la partecipazione all'evento di gioco",
                'abilitare mappa, incontri, missioni, QR code, duelli, classifiche e progressi',
                'gestire sicurezza operativa minima, assistenza e prevenzione di abusi o errori di sessione',
                'tenere traccia dell accettazione dell informativa privacy mostrata nel flusso di adesione',
              ]}
            />
          </PolicySection>

          <PolicySection title="Base giuridica e geolocalizzazione">
            <p style={{ margin: 0 }}>
              L&apos;app richiede una tua azione positiva per accettare questa informativa e
              usa i permessi del browser/dispositivo per la geolocalizzazione. Senza GPS
              alcune funzioni basate sulla mappa potrebbero non essere disponibili o
              risultare limitate durante la sessione.
            </p>
          </PolicySection>

          <PolicySection title="Conservazione">
            <PolicyList
              items={[
                "i dati di profilo restano associati all'account finche l'account non viene eliminato",
                "i dati di gioco e di sessione restano disponibili per la gestione dell'evento, delle classifiche e dello storico finche non vengono rimossi dall'organizzatore o cancelli l'account",
                'i log tecnici e operativi sono mantenuti per il tempo strettamente necessario a diagnosi, sicurezza e gestione del servizio',
              ]}
            />
          </PolicySection>

          <PolicySection title="Chi puo ricevere i dati">
            <PolicyList
              items={[
                "fornitori tecnici indispensabili per autenticazione, database, hosting e mappe",
                "organizzatori o amministratori dell'evento per funzioni operative strettamente collegate alla sessione",
              ]}
            />
          </PolicySection>

          <PolicySection title="I tuoi diritti">
            <PolicyList
              items={[
                'accesso, rettifica, cancellazione, limitazione, opposizione e portabilita dei dati nei limiti previsti dalla legge',
                "revoca del consenso gia prestato, senza pregiudicare i trattamenti gia effettuati",
                "reclamo all'autorita di controllo competente",
              ]}
            />
          </PolicySection>

          <PolicySection title="Autorità di controllo">
            <p style={{ margin: 0 }}>
              Hai il diritto di proporre reclamo al{' '}
              <strong style={{ color: '#fff' }}>Garante per la Protezione dei Dati Personali</strong>{' '}
              (
              <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style={{ color: '#3ABCA8', textDecoration: 'none' }}>
                www.garanteprivacy.it
              </a>
              ) se ritieni che il trattamento dei tuoi dati violi il Regolamento UE 2016/679 (GDPR).
            </p>
          </PolicySection>
        </div>
      </div>
    </div>
  )
}
