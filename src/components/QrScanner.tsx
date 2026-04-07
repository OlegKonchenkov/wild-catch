'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  onScan: (data: string) => void
  onClose: () => void
}

export default function QrScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>(0)
  const jsQRRef   = useRef<((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null>(null)
  const scannedRef = useRef(false)

  const [phase, setPhase]     = useState<'loading' | 'scanning' | 'error' | 'manual'>('loading')
  const [camError, setCamError] = useState('')
  const [manual, setManual]   = useState('')
  const [torch, setTorch]     = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  /* ── Load jsQR once ── */
  useEffect(() => {
    import('jsqr').then(m => { jsQRRef.current = m.default as any })
  }, [])

  /* ── Start camera ── */
  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        // Check torch support
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() as any
        if (caps?.torch) setTorchSupported(true)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setPhase('scanning')
        }
      } catch (e: any) {
        if (!cancelled) {
          setCamError(e.name === 'NotAllowedError' ? 'Permesso fotocamera negato' : 'Fotocamera non disponibile')
          setPhase('error')
        }
      }
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* ── Toggle torch ── */
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const newVal = !torch
    await (track as any).applyConstraints({ advanced: [{ torch: newVal }] }).catch(() => {})
    setTorch(newVal)
  }

  /* ── Scan loop ── */
  const scan = useCallback(() => {
    if (scannedRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    const jsQR   = jsQRRef.current
    if (!video || !canvas || !jsQR || video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(scan)
      return
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (code?.data) {
      scannedRef.current = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      onScan(code.data)
      return
    }
    rafRef.current = requestAnimationFrame(scan)
  }, [onScan])

  useEffect(() => {
    if (phase === 'scanning') {
      rafRef.current = requestAnimationFrame(scan)
      return () => cancelAnimationFrame(rafRef.current)
    }
  }, [phase, scan])

  function handleManualSubmit() {
    const val = manual.trim()
    if (!val) return
    scannedRef.current = true
    streamRef.current?.getTracks().forEach(t => t.stop())
    onScan(val)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={onClose} className="text-white/70 hover:text-white text-sm flex items-center gap-1.5">
          ✕ <span>Chiudi</span>
        </button>
        <span className="text-white font-bold text-sm">
          {phase === 'manual' ? '⌨️ Inserisci codice' : '📷 Scansiona QR'}
        </span>
        <div className="flex items-center gap-2">
          {torchSupported && phase === 'scanning' && (
            <button onClick={toggleTorch} className={`text-lg transition-opacity ${torch ? 'opacity-100' : 'opacity-40'}`} title="Torcia">
              🔦
            </button>
          )}
          <button
            onClick={() => setPhase(p => p === 'manual' ? 'scanning' : 'manual')}
            className="text-xs text-white/60 hover:text-white border border-white/20 rounded-lg px-2.5 py-1"
          >
            {phase === 'manual' ? '📷 Camera' : '⌨️ Manuale'}
          </button>
        </div>
      </div>

      {/* Camera view */}
      {phase !== 'manual' && (
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading overlay */}
          {phase === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <div className="w-10 h-10 border-2 border-[#3A9DBC] border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Avvio fotocamera...</p>
            </div>
          )}

          {/* Error overlay */}
          {phase === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 overflow-y-auto py-8">
              <span className="text-5xl mb-4">📷</span>
              <p className="text-white text-center font-bold text-base mb-1">{camError}</p>

              {camError === 'Permesso fotocamera negato' && (
                <div className="w-full max-w-xs mt-3 mb-4 rounded-2xl p-4 text-xs space-y-2"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="font-bold text-red-400 text-center">Come riabilitare la fotocamera</p>
                  {/iP(hone|ad|od)/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? (
                    <ol className="text-white/60 space-y-1 list-decimal list-inside leading-relaxed">
                      <li>Apri <strong className="text-white/80">Impostazioni</strong> del telefono</li>
                      <li>Vai su <strong className="text-white/80">Privacy → Fotocamera</strong></li>
                      <li>Abilita <strong className="text-white/80">Safari</strong> (o il browser usato)</li>
                      <li>Torna qui e riprova</li>
                    </ol>
                  ) : (
                    <ol className="text-white/60 space-y-1 list-decimal list-inside leading-relaxed">
                      <li>Tocca l'icona 🔒 nella barra degli indirizzi</li>
                      <li>Seleziona <strong className="text-white/80">Autorizzazioni sito</strong></li>
                      <li>Imposta <strong className="text-white/80">Fotocamera</strong> su <strong className="text-white/80">Consenti</strong></li>
                      <li>Ricarica la pagina</li>
                    </ol>
                  )}
                </div>
              )}

              <p className="text-white/40 text-sm text-center mb-4">Oppure inserisci il codice manualmente</p>
              <button
                onClick={() => setPhase('manual')}
                className="bg-[#3A9DBC] text-white font-bold px-6 py-3 rounded-xl"
              >
                ⌨️ Inserisci codice
              </button>
            </div>
          )}

          {/* Scanning frame */}
          {phase === 'scanning' && (
            <>
              {/* Corner frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56">
                  {/* Corners */}
                  {[
                    'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-8 h-8 border-[#3A9DBC] ${cls}`} />
                  ))}
                  {/* Scan line */}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#3A9DBC]/70 animate-pulse" />
                </div>
              </div>
              {/* Hint */}
              <div className="absolute bottom-8 inset-x-4 flex justify-center">
                <div className="bg-black/60 text-white/70 text-xs px-4 py-2 rounded-full text-center">
                  Inquadra il codice QR nell'area indicata
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual input */}
      {phase === 'manual' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-center space-y-2">
            <span className="text-6xl block">🔢</span>
            <p className="text-white font-bold text-lg">Inserisci il codice</p>
            <p className="text-white/40 text-sm">Digita il codice UUID riportato sul QR</p>
          </div>
          <div className="w-full space-y-3">
            <input
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="es. a1b2c3d4-..."
              autoFocus
              className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-4 py-3 text-sm placeholder:text-white/20 focus:outline-none focus:border-[#3A9DBC]/60 text-center font-mono"
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manual.trim()}
              className="w-full bg-[#3A9DBC] text-white font-bold py-3 rounded-xl disabled:opacity-40"
            >
              ✓ Conferma codice
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
