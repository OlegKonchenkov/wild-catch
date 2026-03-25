'use client'
import { useState, useRef } from 'react'

interface Props {
  value: string
  onChange: (url: string) => void
  label?: string
  hint?: string
  optional?: boolean
  /** Called instead of default /api/admin/upload when set (e.g. creatures artwork endpoint) */
  onUpload?: (file: File) => Promise<void>
}

export function ImageInput({ value, onChange, label, hint, optional, onUpload }: Props) {
  const [mode, setMode]         = useState<'url' | 'upload'>(value ? 'url' : 'url')
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const fileRef                 = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    if (onUpload) {
      // Delegate to parent (e.g. creatures page that has its own endpoint)
      setUploading(true)
      try { await onUpload(file) }
      catch (e: any) { setError(e.message ?? 'Errore upload') }
      finally { setUploading(false) }
      return
    }

    // Generic upload via /api/admin/upload
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const d   = await res.json()
    setUploading(false)
    if (!res.ok) { setError(d.error ?? 'Errore upload'); return }
    onChange(d.url)
    setMode('url')  // switch to URL mode to show the result
  }

  const hasImage = value && (value.startsWith('http') || value.startsWith('/'))

  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-white/60 mb-1">
          {label}
          {optional && <span className="text-white/30 ml-1">(opzionale)</span>}
        </label>
      )}
      {hint && <p className="text-xs text-white/30 mb-1.5 leading-relaxed">{hint}</p>}

      {/* Mode tabs */}
      <div className="flex gap-1 mb-2 bg-white/5 p-1 rounded-lg w-fit">
        <button type="button" onClick={() => setMode('url')}
          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${mode === 'url' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}>
          🔗 URL
        </button>
        <button type="button" onClick={() => { setMode('upload'); setError(''); fileRef.current?.click() }}
          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${mode === 'upload' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}>
          📁 Carica file
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) { setMode('upload'); handleFile(e.target.files[0]) } }}
      />

      {mode === 'url' ? (
        <div>
          <input
            type="url"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="https://esempio.com/immagine.png"
            className="w-full bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/25"
          />
          {/* Inline preview */}
          {hasImage && (
            <div className="mt-2 relative h-20 bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Anteprima" className="max-h-full max-w-full object-contain rounded" />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="w-full border-2 border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer hover:border-[#3A9DBC]/50 hover:bg-white/3 transition-colors"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#3A9DBC] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-white/50">Caricamento in corso...</p>
            </div>
          ) : hasImage ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="max-h-20 mx-auto rounded object-contain" />
              <p className="text-xs text-white/40">Clicca per cambiare immagine</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="text-2xl">📁</span>
              <p className="text-sm text-white/50 font-medium">Clicca per selezionare</p>
              <p className="text-xs text-white/25">PNG, JPG, WEBP, GIF, SVG — max 5 MB</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1.5 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">⚠ {error}</p>}
    </div>
  )
}
