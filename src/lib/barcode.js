/**
 * Formas equivalentes de un mismo código. Un UPC-A (12 dígitos, productos
 * importados) es un EAN-13 con un 0 adelante: la cámara del celular lo lee con
 * 12 y muchas pistolas lo mandan con 13. Buscando las dos, el producto aparece
 * sin importar con qué se cargó.
 */
export function barcodeVariants(code) {
  const value = String(code || '').trim()
  if (!value) return []
  const variants = [value]
  if (/^\d{12}$/.test(value)) variants.push('0' + value)
  if (/^0\d{12}$/.test(value)) variants.push(value.slice(1))
  return variants
}

export function sameBarcode(a, b) {
  if (!a || !b) return false
  return barcodeVariants(a).includes(String(b).trim())
}
