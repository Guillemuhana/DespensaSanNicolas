/** Imprime el ticket de mostrador y devuelve la app a su estado normal. */
export function printTicket() {
  document.body.classList.add('printing-ticket')
  const cleanup = () => {
    document.body.classList.remove('printing-ticket')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  // Safari en iOS no siempre dispara afterprint.
  setTimeout(cleanup, 3000)
}
