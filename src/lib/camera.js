const hasNavigator = typeof navigator !== 'undefined'
const hasGetUserMedia = hasNavigator && Boolean(navigator.mediaDevices?.getUserMedia)
const insecure = typeof window !== 'undefined' && window.isSecureContext === false

/**
 * Si se muestra el botón de cámara. Además de cuando anda, también cuando la
 * página está en http: ahí el navegador esconde la cámara, y es mejor que el
 * botón aparezca y explique por qué que dejar a la persona buscándolo.
 */
export const cameraAvailable = hasGetUserMedia || insecure

/** Por qué no se puede abrir la cámara, o null si se puede. */
export function cameraBlockedReason() {
  if (insecure) {
    return 'La cámara sólo funciona si la página se abre con https. Entrá desde la dirección publicada (https://...) en vez de la IP de la compu.'
  }
  if (!hasGetUserMedia) {
    return 'Este navegador no da acceso a la cámara. Probá con Chrome o Safari actualizados.'
  }
  return null
}
