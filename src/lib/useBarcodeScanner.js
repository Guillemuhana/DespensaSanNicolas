import { useEffect, useRef } from 'react'

// Un lector de códigos de barras (USB o Bluetooth) se presenta como un teclado:
// "tipea" el código y cierra con Enter. La diferencia con una persona es la
// velocidad —milisegundos entre tecla y tecla—, así que eso es lo que miramos
// para saber que fue el lector y no alguien escribiendo.
const MAX_GAP_MS = 60
const MIN_LENGTH = 3

/**
 * Escucha el lector aunque el foco no esté en el campo de búsqueda: en el
 * mostrador se toca la pantalla todo el tiempo y el foco se pierde solo.
 *
 * Si el foco sí está en un input, no hacemos nada: lo maneja ese campo.
 */
export default function useBarcodeScanner(onScan, { enabled = true } = {}) {
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  })

  useEffect(() => {
    if (!enabled) return

    let buffer = ''
    let lastKeyAt = 0

    function handleKeyDown(e) {
      const el = e.target
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const now = performance.now()
      // Una pausa larga corta la ráfaga: lo anterior no era del lector.
      if (now - lastKeyAt > MAX_GAP_MS) buffer = ''
      lastKeyAt = now

      if (e.key === 'Enter') {
        const code = buffer
        buffer = ''
        if (code.length >= MIN_LENGTH) {
          e.preventDefault()
          onScanRef.current?.(code)
        }
        return
      }

      if (e.key.length === 1) buffer += e.key
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
