import { useEffect, useRef, useState } from 'react'
import { Keyboard, SwitchCamera, Zap, ZapOff, ZoomIn } from 'lucide-react'
import { cameraBlockedReason } from '../lib/camera'

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

// Cada cuánto se analiza un cuadro.
const TICK_MS = 110
// Un código recién leído se ignora hasta que salga de cuadro este tiempo:
// si no, dejar el paquete delante de la cámara lo sumaría una y otra vez.
const SAME_CODE_GAP_MS = 1200
// Para dar por bueno un código tiene que salir igual dos veces seguidas: así
// un cuadro movido no mete un número equivocado.
const CONFIRM_WINDOW_MS = 1000

/**
 * Lector por cámara para el celular.
 *
 * Donde el navegador ya sabe leer códigos de góndola (Chrome en Android) usamos
 * su lector nativo, que es instantáneo. Donde no —iPhone, o Android sin los
 * servicios de Google— usamos ZXing, que se carga recién en ese momento.
 *
 * `onDetect` puede devolver una promesa: mientras no termine no se lee otro
 * código, así dos lecturas no se pisan.
 *
 * `hint` es un texto o `{ type: 'error' | 'success', text }`.
 */
export default function CameraScanner({ title = 'Escanear con la cámara', hint, onDetect, onClose }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const onDetectRef = useRef(onDetect)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [canTorch, setCanTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [zoom, setZoom] = useState(null) // { min, max, value } | null
  const [cameras, setCameras] = useState([])
  const [cameraIdx, setCameraIdx] = useState(-1) // -1: la que elija el navegador
  const [restartKey, setRestartKey] = useState(0)
  const [flash, setFlash] = useState(null) // último código leído, para mostrarlo
  const [manual, setManual] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const emitRef = useRef(null)
  const camerasRef = useRef([])

  useEffect(() => {
    onDetectRef.current = onDetect
  })

  // iPhone corta la cámara cuando la app pasa a segundo plano: al volver se
  // reabre sola en vez de quedar en negro.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (trackRef.current?.readyState === 'ended') {
        resetView()
        setRestartKey((k) => k + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    let stopped = false
    let stream = null
    let timer = null
    let busy = false
    let candidate = null // { value, at }
    let lastEmitted = null // { value, seenAt }

    function schedule(fn) {
      if (!stopped) timer = setTimeout(fn, TICK_MS)
    }

    async function emit(value) {
      busy = true
      lastEmitted = { value, seenAt: Date.now() }
      candidate = null
      navigator.vibrate?.(60)
      setFlash(value)
      try {
        await onDetectRef.current?.(value)
      } catch {
        // Lo que falle al procesar el código lo muestra la pantalla de atrás.
      } finally {
        busy = false
        if (lastEmitted) lastEmitted.seenAt = Date.now()
      }
    }
    emitRef.current = emit

    // Cada lectura pasa por acá: confirma el código y descarta repeticiones.
    function onRead(raw) {
      const value = String(raw || '').trim()
      if (!value || busy) return
      const now = Date.now()
      if (lastEmitted && lastEmitted.value === value && now - lastEmitted.seenAt < SAME_CODE_GAP_MS) {
        lastEmitted.seenAt = now
        return
      }
      if (candidate && candidate.value === value && now - candidate.at < CONFIRM_WINDOW_MS) {
        emit(value)
        return
      }
      candidate = { value, at: now }
    }

    async function openStream() {
      const deviceId = camerasRef.current[cameraIdx]?.deviceId
      const base = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: 'environment' } }
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { ...base, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
      } catch (err) {
        // Algunos teléfonos rechazan la resolución pedida: probamos lo básico.
        if (err?.name === 'OverconstrainedError' || err?.name === 'NotReadableError') {
          return navigator.mediaDevices.getUserMedia({ audio: false, video: base })
        }
        throw err
      }
    }

    async function setupTrack(track) {
      trackRef.current = track
      const caps = track?.getCapabilities?.() || {}
      setCanTorch(Boolean(caps.torch))
      setZoom(
        caps.zoom && caps.zoom.max > caps.zoom.min
          ? { min: caps.zoom.min, max: caps.zoom.max, value: track.getSettings?.().zoom ?? caps.zoom.min }
          : null
      )
      // Sin enfoque continuo muchos Android quedan desenfocados de cerca y el
      // código no se lee nunca.
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
        } catch {
          // Si no lo acepta, seguimos con lo que tenga.
        }
      }
    }

    async function listCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videos = devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
        if (!stopped && videos.length > 1 && camerasRef.current.length !== videos.length) {
          camerasRef.current = videos
          setCameras(videos)
        }
      } catch {
        // Sin la lista simplemente no se ofrece cambiar de cámara.
      }
    }

    async function nativeDetector() {
      if (!('BarcodeDetector' in window)) return null
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats()
        // Hay Android que exponen el lector pero sin formatos de góndola: ahí
        // no sirve y conviene ZXing.
        if (!supported.includes('ean_13')) return null
        return new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) })
      } catch {
        return null
      }
    }

    async function zxingDecoder() {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ])
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)
      const reader = new BrowserMultiFormatReader(hints)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      let fullFrame = false

      // Se alterna entre la franja del medio (donde está el recuadro, más
      // rápido y más nítido) y el cuadro entero, por si no lo centraron.
      return (video) => {
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (!vw || !vh) return null
        let sx = 0
        let sy = 0
        let sw = vw
        let sh = vh
        if (!fullFrame) {
          sw = Math.round(vw * 0.85)
          sh = Math.round(vh * 0.5)
          sx = Math.round((vw - sw) / 2)
          sy = Math.round((vh - sh) / 2)
        }
        fullFrame = !fullFrame
        const scale = Math.min(1, 1280 / sw)
        canvas.width = Math.round(sw * scale)
        canvas.height = Math.round(sh * scale)
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        try {
          return reader.decodeFromCanvas(canvas).getText()
        } catch {
          return null // en este cuadro no hay código: normal
        }
      }
    }

    async function start() {
      const blocked = cameraBlockedReason()
      if (blocked) {
        setError(blocked)
        return
      }
      try {
        stream = await openStream()
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.muted = true
        video.setAttribute('playsinline', 'true')
        video.srcObject = stream
        await video.play().catch(() => {})
        if (stopped) return
        setReady(true)

        await setupTrack(stream.getVideoTracks()[0])
        listCameras()

        const detector = await nativeDetector()
        const decode = detector ? null : await zxingDecoder()
        if (stopped) return

        const tick = async () => {
          if (stopped) return
          if (!busy && video.readyState >= 2) {
            try {
              if (detector) {
                const found = await detector.detect(video)
                if (found.length > 0) onRead(found[0].rawValue)
              } else {
                const text = decode(video)
                if (text) onRead(text)
              }
            } catch {
              // Un cuadro que no se pudo analizar no es un problema: sigue.
            }
          }
          schedule(tick)
        }
        tick()
      } catch (err) {
        if (stopped) return
        setError(cameraError(err))
      }
    }

    start()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
      emitRef.current = null
    }
  }, [cameraIdx, restartKey])

  // Antes de reabrir la cámara se vuelve a la pantalla de "Abriendo...".
  function resetView() {
    setReady(false)
    setError(null)
    setTorchOn(false)
  }

  // El código leído se muestra un momento sobre el recuadro.
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1400)
    return () => clearTimeout(t)
  }, [flash])

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

  // Acercar ayuda con códigos chicos: el teléfono no enfoca tan de cerca.
  async function toggleZoom() {
    const track = trackRef.current
    if (!track || !zoom) return
    const target = zoom.value > zoom.min + 0.1 ? zoom.min : Math.min(zoom.max, Math.max(zoom.min, 2))
    try {
      await track.applyConstraints({ advanced: [{ zoom: target }] })
      setZoom((z) => (z ? { ...z, value: target } : z))
    } catch {
      setZoom(null)
    }
  }

  function switchCamera() {
    if (cameras.length < 2) return
    // Se avanza desde la que está abierta, sea cual sea la que eligió el navegador.
    const currentId = trackRef.current?.getSettings?.().deviceId
    const current = cameras.findIndex((c) => c.deviceId === currentId)
    resetView()
    setCameraIdx((i) => ((current >= 0 ? current : i) + 1) % cameras.length)
  }

  function submitManual(e) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    setManualCode('')
    setManual(false)
    if (emitRef.current) emitRef.current(code)
    else onDetectRef.current?.(code)
  }

  const hintText = typeof hint === 'string' ? hint : hint?.text
  const hintType = typeof hint === 'string' ? null : hint?.type
  const zoomed = zoom && zoom.value > zoom.min + 0.1

  const iconBtn = 'rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/25'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate font-display text-base font-semibold text-white">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          {cameras.length > 1 && (
            <button onClick={switchCamera} aria-label="Cambiar de cámara" className={iconBtn}>
              <SwitchCamera size={18} strokeWidth={2.4} />
            </button>
          )}
          {zoom && (
            <button
              onClick={toggleZoom}
              aria-label={zoomed ? 'Alejar' : 'Acercar'}
              className={zoomed ? 'rounded-full bg-white p-2.5 text-ink' : iconBtn}
            >
              <ZoomIn size={18} strokeWidth={2.4} />
            </button>
          )}
          {canTorch && (
            <button
              onClick={toggleTorch}
              aria-label={torchOn ? 'Apagar la luz' : 'Prender la luz'}
              className={torchOn ? 'rounded-full bg-white p-2.5 text-ink' : iconBtn}
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
            <div
              className={`relative h-40 w-[78%] max-w-sm rounded-2xl border-2 shadow-[0_0_0_100vmax_rgba(23,20,18,0.45)] transition-colors ${
                flash ? 'border-[#4ade80]' : 'border-white/90'
              }`}
            >
              {!flash && (
                <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brick-light" />
              )}
              {flash && (
                <p className="absolute inset-x-0 -bottom-9 text-center font-mono text-sm font-semibold text-white">
                  {flash}
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-xs rounded-2xl bg-surface p-5 text-center shadow-pop">
              <p className="font-display text-base font-semibold text-ink">No se pudo abrir la cámara</p>
              <p className="mt-2 text-sm text-inkfaint">{error}</p>
              <button
                onClick={() => setManual(true)}
                className="mt-4 w-full rounded-xl border border-line py-2.5 font-semibold text-ink"
              >
                Escribir el código
              </button>
              <button
                onClick={onClose}
                className="mt-2 w-full rounded-xl bg-awning py-2.5 font-semibold text-white"
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

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {manual ? (
          <form onSubmit={submitManual} className="flex gap-2">
            <input
              autoFocus
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Número del código"
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 font-mono text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="rounded-xl bg-awning px-4 font-semibold text-white disabled:opacity-50"
            >
              OK
            </button>
          </form>
        ) : (
          <>
            <p
              className={`text-center text-sm ${
                hintType === 'error'
                  ? 'font-semibold text-[#fca5a5]'
                  : hintType === 'success'
                    ? 'font-semibold text-[#86efac]'
                    : 'text-white/80'
              }`}
            >
              {hintText || 'Apuntá al código de barras. Se lee solo, no hace falta tocar nada.'}
            </p>
            <button
              onClick={() => setManual(true)}
              className="mx-auto mt-2 flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white"
            >
              <Keyboard size={14} strokeWidth={2.2} />
              ¿No lo lee? Escribilo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function cameraError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'El permiso de cámara está bloqueado para esta página. Habilitalo desde el candado de la barra de direcciones (en iPhone: Ajustes › Safari › Cámara) y volvé a intentar.'
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return 'No encontramos una cámara en este dispositivo.'
  }
  if (err?.name === 'NotReadableError' || err?.name === 'AbortError') {
    return 'La cámara está ocupada por otra aplicación. Cerrala y volvé a intentar.'
  }
  return err?.message || 'Probá de nuevo.'
}
