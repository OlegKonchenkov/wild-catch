'use client'
import { useEffect, useRef } from 'react'

// ── Native-app "Back closes the overlay" behaviour ─────────────────────────
// In a real mobile app, the hardware Back button (Android) / back-swipe closes
// the top-most open sheet/drawer/modal — it does NOT navigate the whole page
// away like a website. This hook wires that up.
//
// A single shared LIFO stack tracks every open overlay's close callback, plus
// one synthetic history entry that "absorbs" a Back press. Back pops the top
// overlay; if more remain, a fresh entry is queued so the next Back closes the
// next one. Closing from the UI (button / backdrop) removes the overlay from
// the stack and, when it was the last one, cleans up the synthetic entry so
// the user never has to press Back twice to actually leave the page.
//
// The stack lives at module scope (client-only) so nested overlays across
// different components (e.g. a page bottom-sheet + the shell's notification
// drawer) share one coherent history model.

type Closer = () => void

const overlayStack: Closer[] = []
let popstateBound = false
// Set when WE programmatically call history.back() during UI-close cleanup, so
// the resulting popstate is swallowed instead of being read as a real Back.
let ignoreNextPop = false

function onGlobalPop() {
  if (ignoreNextPop) {
    ignoreNextPop = false
    return
  }
  const closer = overlayStack.pop()
  if (!closer) return
  closer()
  // More overlays still open → re-arm a history entry so the next Back press
  // closes the next one instead of leaving the page.
  if (overlayStack.length > 0) {
    window.history.pushState({ __wcOverlay: true }, '')
  }
}

export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return

    if (!popstateBound) {
      window.addEventListener('popstate', onGlobalPop)
      popstateBound = true
    }

    const closer: Closer = () => onCloseRef.current()
    // Only the first overlay in the stack needs to push the guard entry;
    // subsequent Back presses are re-armed inside onGlobalPop.
    if (overlayStack.length === 0) {
      window.history.pushState({ __wcOverlay: true }, '')
    }
    overlayStack.push(closer)

    return () => {
      const idx = overlayStack.lastIndexOf(closer)
      if (idx !== -1) overlayStack.splice(idx, 1)
      // If we just removed the last overlay via the UI (not via Back), pop the
      // guard entry we added — but only if it's still ours (a genuine route
      // change would have replaced history.state, in which case we leave it
      // alone so we don't interfere with navigation).
      if (overlayStack.length === 0 && window.history.state?.__wcOverlay) {
        ignoreNextPop = true
        window.history.back()
      }
    }
  }, [open])
}
