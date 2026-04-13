import { useState, useCallback } from 'react'
import type { ToastVariant, ToastState } from './GameToast'

const PERSISTENT: ToastVariant[] = ['session-ended', 'session-waiting']

// API error message → variant classification
const SESSION_ENDED_PATTERNS   = ['la sessione è terminata', 'sessione terminata', 'session ended']
const SESSION_WAITING_PATTERNS = ['non è ancora iniziata', 'non ancora iniziata', 'non è attiva', 'non è ancora attiva']

function classifyApiError(status: number, message: string): ToastVariant {
  const lower = message.toLowerCase()
  if (SESSION_ENDED_PATTERNS.some(p => lower.includes(p)))   return 'session-ended'
  if (SESSION_WAITING_PATTERNS.some(p => lower.includes(p))) return 'session-waiting'
  if (status === 0 || status >= 500) return 'error'
  return 'warning'
}

export function useGameToast(duration = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const show = useCallback((variant: ToastVariant, message: string) => {
    setToast({ variant, message })
    if (!PERSISTENT.includes(variant)) {
      setTimeout(() => setToast(null), duration)
    }
  }, [duration])

  /** Automatically picks the right variant from an API response */
  const showApiError = useCallback((status: number, message: string) => {
    show(classifyApiError(status, message), message)
  }, [show])

  return {
    toast,
    show,
    showApiError,
    showSuccess: (msg: string) => show('success', msg),
    showWarning: (msg: string) => show('warning', msg),
    showError:   (msg: string) => show('error',   msg),
    dismiss:     ()            => setToast(null),
  }
}
