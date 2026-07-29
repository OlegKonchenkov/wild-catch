'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { LEGAL, LEGAL_LAST_UPDATED, resolveController } from '@/lib/legal/controller'
import { buildPrivacySections } from '@/lib/legal/privacy'

interface PrivacyPolicyModalProps {
  open: boolean
  onClose: () => void
  controllerName?: string | null
  contactEmail?: string | null
}

/**
 * In-app privacy notice, shown in the join flow.
 *
 * The text is NOT written here any more: it comes from lib/legal/privacy.ts,
 * the same definition the public /privacy page renders. Previously this modal
 * was the only copy of the policy in existence, which also meant it lived
 * behind Google login — unreadable by anyone deciding whether to sign up.
 */

function Contact({ email, controllerName }: { email: string; controllerName: string }) {
  const line = { margin: '6px 0 0' }
  const strong = { color: '#fff' }
  return (
    <>
      <p style={{ margin: 0 }}><strong style={strong}>{LEGAL.businessName}</strong></p>
      <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.55)' }}>{LEGAL.address}</p>
      <p style={line}><strong style={strong}>P.IVA:</strong>{' '}
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{LEGAL.vatNumber}</span></p>
      <p style={line}><strong style={strong}>Titolare / referente privacy:</strong> {controllerName}</p>
      <p style={line}><strong style={strong}>Email:</strong>{' '}
        <a href={`mailto:${email}`} style={{ color: '#3ABCA8', textDecoration: 'none' }}>{email}</a></p>
      <p style={line}><strong style={strong}>Tel:</strong>{' '}
        <a href={`tel:${LEGAL.phone.replace(/\s/g, '')}`} style={{ color: '#3ABCA8', textDecoration: 'none' }}>{LEGAL.phone}</a></p>
    </>
  )
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '14px 14px 0' }}>
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

  const controller = resolveController(controllerName, contactEmail)
  const sections = buildPrivacySections(controllerName, contactEmail)
  const updated = new Date(LEGAL_LAST_UPDATED).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

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
          background: 'linear-gradient(160deg, rgba(13,30,46,0.98) 0%, rgba(10,21,32,0.99) 100%)',
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
            background: 'linear-gradient(180deg, rgba(13,30,46,0.98) 0%, rgba(13,30,46,0.94) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
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
              <h2 style={{ fontSize: 22, lineHeight: 1.15, color: '#fff', margin: 0 }}>
                Informativa Privacy
              </h2>
              <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5 }}>
                Ultimo aggiornamento: {updated}. Consultabile in ogni momento su{' '}
                <Link href="/privacy" style={{ color: '#3ABCA8', textDecoration: 'none' }}>
                  /privacy
                </Link>
                , insieme ai{' '}
                <Link href="/termini" style={{ color: '#3ABCA8', textDecoration: 'none' }}>
                  Termini di Servizio
                </Link>
                .
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
              ×
            </button>
          </div>
        </div>

        <div style={{ paddingBottom: 18 }}>
          {sections.map(section => (
            <PolicySection key={section.title} title={section.title}>
              {section.blocks.map((block, i) => {
                if (block.kind === 'contact') {
                  return <Contact key={i} email={controller.email} controllerName={controller.controllerName} />
                }
                if (block.kind === 'list') {
                  return (
                    <ul key={i} style={{ paddingLeft: 18, margin: i === 0 ? 0 : '10px 0 0' }}>
                      {block.items.map(item => (
                        <li key={item} style={{ marginBottom: 6 }}>{item}</li>
                      ))}
                    </ul>
                  )
                }
                return <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0' }}>{block.text}</p>
              })}
            </PolicySection>
          ))}
        </div>
      </div>
    </div>
  )
}
