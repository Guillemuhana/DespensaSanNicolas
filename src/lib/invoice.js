import { resizeImage } from './image'
import { sameBarcode } from './barcode'

// ---------- Preparar el archivo ----------

/**
 * Convierte lo que eligieron (foto o PDF) en lo que espera el servidor:
 * `{ image }` con la foto achicada, o `{ text }` si es un PDF con texto.
 */
export async function fileToPayload(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
  if (!isPdf) {
    // 2000 px alcanza para leer letra chica de factura sin pasar el límite.
    const blob = await resizeImage(file, 2000, 0.85)
    return { image: await blobToDataUrl(blob) }
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise

  // Factura electrónica: el PDF trae el texto y leerlo es lo más exacto.
  const pages = Math.min(pdf.numPages, 5)
  let text = ''
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += pageText(content.items) + '\n\n'
  }
  if (text.replace(/\s/g, '').length > 80) return { text }

  // PDF escaneado (es una foto adentro de un PDF): se manda la primera hoja
  // como imagen.
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(2.5, 2000 / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
  return { image: canvas.toDataURL('image/jpeg', 0.85) }
}

// Arma renglones de texto respetando la posición en la hoja: si no, las
// columnas de la factura salen todas mezcladas.
function pageText(items) {
  const rows = []
  for (const it of items) {
    if (!it.str?.trim()) continue
    const y = Math.round(it.transform[5])
    let row = rows.find((r) => Math.abs(r.y - y) <= 2)
    if (!row) rows.push((row = { y, parts: [] }))
    row.parts.push({ x: it.transform[4], s: it.str })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join('  '))
    .join('\n')
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(blob)
  })
}

export async function readInvoice(payload) {
  let res
  try {
    res = await fetch('/api/leer-factura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Sin conexión. Revisá internet y probá de nuevo.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `No se pudo leer la factura (error ${res.status}).`)
  return data
}

// ---------- Relacionar con lo cargado ----------

export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** La clave con la que se recuerda un renglón de un proveedor. */
export function lineKey(line) {
  if (line.code) return `cod:${normalizeText(line.code)}`
  return `desc:${normalizeText(line.description)}`
}

export function cuitDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

/** El proveedor de la factura entre los cargados: por CUIT, o por nombre. */
export function matchSupplier(detected, suppliers) {
  const cuit = cuitDigits(detected?.cuit)
  if (cuit.length === 11) {
    const byCuit = suppliers.find((s) => cuitDigits(s.cuit) === cuit)
    if (byCuit) return byCuit
  }
  const name = normalizeText(detected?.name)
  if (!name) return null
  let best = null
  let bestScore = 0
  for (const s of suppliers) {
    const score = similarity(name, normalizeText(s.name))
    if (score > bestScore) {
      best = s
      bestScore = score
    }
  }
  return bestScore >= 0.5 ? best : null
}

/**
 * Para cada renglón: el producto que le corresponde y cómo se encontró.
 * `how`: 'barcode' | 'learned' | 'similar' | null
 */
export function matchLine(line, products, learned) {
  if (line.ean) {
    const p = products.find((pr) => sameBarcode(line.ean, pr.barcode))
    if (p) return { product: p, how: 'barcode' }
  }
  const memo = learned.find((l) => l.match_key === lineKey(line))
  if (memo) {
    const p = products.find((pr) => pr.id === memo.product_id)
    if (p) return { product: p, how: 'learned', unitsPerPack: Number(memo.units_per_pack) || 1 }
  }
  const desc = normalizeText(line.description)
  let best = null
  let bestScore = 0
  for (const p of products) {
    const score = similarity(desc, normalizeText(p.name))
    if (score > bestScore) {
      best = p
      bestScore = score
    }
  }
  if (best && bestScore >= 0.45) return { product: best, how: 'similar' }
  return { product: null, how: null }
}

// Palabras que en una factura no ayudan a distinguir un producto de otro.
const STOP = new Set(['x', 'de', 'la', 'el', 'con', 'sin', 'un', 'u', 'cj', 'caja', 'pack', 'bulto', 'unid', 'uni'])

function tokens(s) {
  return s.split(' ').filter((t) => t && !STOP.has(t))
}

/** Parecido entre dos textos ya normalizados, de 0 a 1. */
function similarity(a, b) {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length === 0 || tb.length === 0) return 0
  let hits = 0
  for (const t of ta) {
    // "playad" en la factura contra "playadito" en el producto también cuenta.
    if (tb.some((u) => u === t || (t.length >= 4 && u.startsWith(t)) || (u.length >= 4 && t.startsWith(u)))) {
      hits++
    }
  }
  return hits / Math.max(ta.length, tb.length) + (hits > 0 && ta[0] === tb[0] ? 0.15 : 0)
}
