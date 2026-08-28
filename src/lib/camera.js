/** El navegador da acceso a la cámara sólo en https (o en localhost). */
export const cameraAvailable =
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
