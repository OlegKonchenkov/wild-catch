import { useState, useCallback } from 'react'
import type { ToastVariant, ToastState } from './GameToast'

// Session-state toasts stay longer so the user reads them, but still auto-close
const DURATION: Partial<Record<ToastVariant, number>> = {
  'session-ended':   7000,
  'session-waiting': 7000,
}
const DEFAULT_DURATION = 4000

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

export function useGameToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const show = useCallback((variant: ToastVariant, message: string) => {
    setToast({ variant, message })
    const ms = DURATION[variant] ?? DEFAULT_DURATION
    setTimeout(() => setToast(null), ms)
  }, [])

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
