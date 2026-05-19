'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

function getVideoEmbed(url: string): { type: 'iframe' | 'video'; src: string } | null {
  try {
    const u = new URL(url)
    if ((u.hostname.endsWith('youtube.com')) && u.searchParams.get('v')) {
      return { type: 'iframe', src: `https://www.youtube.com/embed/${u.searchParams.get('v')}` }
    }
    if (u.hostname === 'youtu.be') {
      return { type: 'iframe', src: `https://www.youtube.com/embed/${u.pathname.slice(1).split('?')[0]}` }
    }
    if (u.hostname.endsWith('youtube.com') && u.pathname.startsWith('/embed/')) {
      return { type: 'iframe', src: url }
    }
    if (u.hostname.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` }
    }
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { type: 'video', src: url }
    return { type: 'iframe', src: url }
  } catch {
    return null
  }
}

const VIOLET = '#C084FC'

function OrnamentRule() {
  return (
    <div className="flex items-center gap-2 py-0.5" aria-hidden>
      <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(192,132,252,0.45))' }} />
      <span className="text-[10px]" style={{ color: 'rgba(192,132,252,0.7)' }}>◆</span>
      <span className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(192,132,252,0.45))' }} />
    </div>
  )
}

export default function EnigmaFragmentPanel({
  enigmaTitle,
  fragmentTitle,
  description,
  imageUrl,
  videoUrl,
}: {
  enigmaTitle: string | null
  fragmentTitle: string | null
  description: string | null
  imageUrl: string | null
  videoUrl: string | null
}) {
  const [scrolled, setScrolled] = useState(false)
  const [atEnd, setAtEnd] = useState(false)

  const hasData = !!(fragmentTitle || description || imageUrl || videoUrl)

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl"
        style={{ background: 'rgba(123,77,184,0.05)', border: '1px dashed rgba(123,77,184,0.28)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-4"
          style={{ background: 'rgba(123,77,184,0.12)', border: '1.5px dashed rgba(192,132,252,0.45)' }}
        >
          🧩
        </div>
        <p className="text-sm font-bold text-white/55">Nessun frammento</p>
        <p className="text-xs text-white/30 mt-1.5 max-w-[15rem] leading-relaxed">
          Questa creatura non custodisce alcun indizio. Esplora la mappa per trovarne altre.
        </p>
      </motion.div>
    )
  }

  const embed = videoUrl ? getVideoEmbed(videoUrl) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 0%, rgba(123,77,184,0.18) 0%, rgba(26,13,46,0.0) 60%), #160B26',
        border: '1px solid rgba(123,77,184,0.32)',
        boxShadow: 'inset 0 1px 0 rgba(192,132,252,0.12), 0 8px 28px rgba(20,8,38,0.55)',
      }}
    >
      {/* corner glints */}
      <span className="pointer-events-none absolute top-0 left-0 w-16 h-16"
        style={{ background: 'radial-gradient(circle at 0 0, rgba(192,132,252,0.20), transparent 70%)' }} />
      <span className="pointer-events-none absolute bottom-0 right-0 w-20 h-20"
        style={{ background: 'radial-gradient(circle at 100% 100%, rgba(123,77,184,0.16), transparent 70%)' }} />

      <div className="relative p-5">
        {/* Eyebrow + enigma reference */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          className="flex items-center justify-between gap-3 mb-3"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: 'rgba(192,132,252,0.65)' }}>
            ✦ Frammento d&apos;Enigma
          </span>
          {enigmaTitle && (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold shrink-0 max-w-[55%] truncate"
              style={{ background: 'rgba(123,77,184,0.22)', color: VIOLET, border: '1px solid rgba(123,77,184,0.4)' }}
              title={`Sblocca: ${enigmaTitle}`}>
              🔓 {enigmaTitle}
            </span>
          )}
        </motion.div>

        {/* Fragment title */}
        {fragmentTitle && (
          <motion.h3
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-center text-lg leading-snug"
            style={{
              fontFamily: 'var(--font-cinzel), Georgia, serif',
              fontWeight: 700,
              color: VIOLET,
              textShadow: '0 0 18px rgba(192,132,252,0.45)',
              letterSpacing: '0.02em',
            }}
          >
            {fragmentTitle}
          </motion.h3>
        )}

        {(fragmentTitle && (description || imageUrl || embed)) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }} className="my-3">
            <OrnamentRule />
          </motion.div>
        )}

        {/* Long-form lore — scrollable reading column with edge fades */}
        {description && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="relative"
          >
            <div
              onScroll={e => {
                const el = e.currentTarget
                setScrolled(el.scrollTop > 6)
                setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 6)
              }}
              className="max-h-[42vh] overflow-y-auto pr-1.5"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(192,132,252,0.4) transparent' }}
            >
              <p
                className="text-[15px] text-white/75 whitespace-pre-wrap
                  first-letter:float-left first-letter:mr-2 first-letter:mt-1
                  first-letter:text-4xl first-letter:font-bold first-letter:leading-none
                  first-letter:text-[#C084FC]"
                style={{ lineHeight: '1.85', letterSpacing: '0.01em' }}
              >
                {description}
              </p>
            </div>
            {/* top / bottom fade — atmosphere + "more to read" affordance */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-6 transition-opacity duration-200"
              style={{ background: 'linear-gradient(to bottom, #160B26, transparent)', opacity: scrolled ? 1 : 0 }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 transition-opacity duration-200"
              style={{ background: 'linear-gradient(to top, #160B26, transparent)', opacity: atEnd ? 0 : 1 }}
            />
          </motion.div>
        )}

        {/* Media */}
        {(imageUrl || embed) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mt-4 space-y-3"
          >
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Frammento"
                className="w-full rounded-xl object-cover max-h-56 cursor-zoom-in"
                style={{ border: '1px solid rgba(123,77,184,0.3)' }}
                onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: imageUrl }))}
                title="Tocca per ingrandire"
              />
            )}
            {embed && (
              <div className="relative w-full rounded-xl overflow-hidden"
                style={{ aspectRatio: '16/9', border: '1px solid rgba(123,77,184,0.3)' }}>
                {embed.type === 'iframe' ? (
                  <iframe
                    src={embed.src}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={embed.src} controls className="absolute inset-0 w-full h-full" />
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
