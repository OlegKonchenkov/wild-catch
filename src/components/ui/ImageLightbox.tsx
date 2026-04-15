'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Global image lightbox — event-driven.
 * Trigger from anywhere (including Leaflet popup HTML strings):
 *   window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: 'https://...' }))
 * Mount this component once in a shell (GameShell, AdminShell).
 */
export default function ImageLightbox() {
  const [src, setSrc] = useState<string | null>(null)

  const close = useCallback(() => setSrc(null), [])

  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent<string>).detail
      if (url) setSrc(url)
    }
    window.addEventListener('wc:zoom-image', handler)
    return () => window.removeEventListener('wc:zoom-image', handler)
  }, [])

  useEffect(() => {
    if (!src) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [src, close])

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          key="lightbox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={src}
            alt=""
            initial={{ scale: 0.84, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="rounded-2xl object-contain shadow-2xl"
            style={{ maxWidth: 'min(90vw, 800px)', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={close}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
