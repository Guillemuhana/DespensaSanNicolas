import { useEffect, useRef, useState } from 'react'
import { Zap, ZapOff } from 'lucide-react'

// Formatos que se usan en góndola. QR va de yapa porque no cuesta nada.
const FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
  'qr_code',
]

/**
 * Lector por cámara para el celular.
 *
 * Donde el navegador ya sabe leer códigos (Chrome en Android) usamos su lector
 * nativo, que es instantáneo y no pesa nada. Donde no —iPhone, sobre todo—
 * cargamos ZXing recién en ese momento, así el resto de la app no arrastra la
 * librería.
 */
export default function CameraScanner({ title = 'Escanear con la cámara', hint, onDetect, onClose }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const onDetectRef = useRef(onDetect)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [canTorch, setCanTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    onDetectRef.current = onDetect
  })

  useEffect(() => {
    let stopped = false
    let stream = null
    let controls = null
    let timer = null
    let lastCode = null
    let lastAt = 0

    // El mismo código sigue delante de la cámara varios cuadros seguidos: sin
    // esto un solo escaneo cargaría el producto diez veces.
    function emit(code) {
      const value = String(code || '').trim()
      if (!value) return
      const now = Date.now()
      if (value === lastCode && now - lastAt < 1800) return
      lastCode = value
      lastAt = now
      navigator.vibrate?.(60)
      onDetectRef.current?.(value)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Este navegador no da acceso a la cámara. Suele pasar cuando la página no está en https.'
        )
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (stopped) return
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setReady(true)

        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        setCanTorch(Boolean(track?.getCapabilities?.().torch))

        if ('BarcodeDetector' in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats()
          const formats = FORMATS.filter((f) => supported.includes(f))
          const detector = new window.BarcodeDetector({
            formats: formats.length > 0 ? formats : undefined,
          })
          const tick = async () => {
            if (stopped) return
            try {
              const found = await detector.detect(video)
              if (found.length > 0) emit(found[0].rawValue)
            } catch {
              // Un cuadro que no se pudo analizar no es un problema: sigue.
            }
            timer = setTimeout(tick, 150)
          }
          tick()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (stopped) return
          const reader = new BrowserMultiFormatReader()
          controls = await reader.decodeFromVideoElement(video, (result) => {
            if (result) emit(result.getText())
          })
        }
      } catch (err) {
        if (stopped) return
        setError(cameraError(err))
      }
    }

    start()

    return () => {
      stopped = true
      clearTimeout(timer)
      controls?.stop()
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
    }
  }, [])

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn((v) => !v)
    } catch {
      setCanTorch(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="font-display text-base font-semibold text-white">{title}</p>
        <div className="flex items-center gap-2">
          {canTorch && (
            <button
              onClick={toggleTorch}
              aria-label={torchOn ? 'Apagar la luz' : 'Prender la luz'}
              className={`rounded-full p-2.5 transition-colors ${
                torchOn ? 'bg-white text-ink' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {torchOn ? <Zap size={18} strokeWidth={2.4} /> : <ZapOff size={18} strokeWidth={2.4} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
          >
            Listo
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />

        {/* Ventana de puntería: ayuda a encuadrar y tapa el resto. */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-[78%] max-w-sm rounded-2xl border-2 border-white/90 shadow-[0_0_0_100vmax_rgba(23,20,18,0.45)]" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-xs rounded-2xl bg-surface p-5 text-center shadow-pop">
              <p className="font-display text-base font-semibold text-ink">No se pudo abrir la cámara</p>
              <p className="mt-2 text-sm text-inkfaint">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-awning py-2.5 font-semibold text-white"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        {!ready && !error && (
          <p className="absolute inset-x-0 top-1/2 text-center text-sm text-white/80">
            Abriendo la cámara...
          </p>
        )}
      </div>

      <p className="px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center text-sm text-white/80">
        {hint || 'Apuntá al código de barras. Se lee solo, no hace falta tocar nada.'}
      </p>
    </div>
  )
}

function cameraError(err) {
  if (err?.name === 'NotAllowedError') {
    return 'El navegador tiene bloqueado el permiso de cámara para esta página. Habilitalo desde el candado de la barra de direcciones.'
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return 'No encontramos una cámara trasera en este dispositivo.'
  }
  if (err?.name === 'NotReadableError') {
    return 'La cámara está ocupada por otra aplicación. Cerrala y volvé a intentar.'
  }
  return err?.message || 'Probá de nuevo.'
}
