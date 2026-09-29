// Lectura de facturas de proveedor con Groq. Lo usa la función de Vercel
// (api/leer-factura.js) y el servidor de desarrollo de Vite, así que no
// depende de ninguno de los dos.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'

// Groq acepta imágenes de hasta 4 MB en base64; dejamos margen.
const MAX_IMAGE_CHARS = 5_400_000
const MAX_TEXT_CHARS = 60_000

const PROMPT = `Sos un asistente que lee facturas y remitos de proveedores de un almacén/carnicería de Argentina.
Extraé los datos y devolvé SOLO un objeto JSON con esta forma exacta:
{
  "proveedor": { "nombre": string|null, "cuit": string|null },
  "factura": {
    "tipo": string|null,          // "A", "B", "C", "Remito", etc.
    "numero": string|null,        // ej. "0003-00012345"
    "fecha": string|null,         // formato AAAA-MM-DD
    "subtotal": number|null,      // neto sin IVA, si figura
    "iva": number|null,           // total de IVA, si figura discriminado
    "total": number|null
  },
  "renglones": [
    {
      "codigo": string|null,      // código interno del proveedor, si hay
      "ean": string|null,         // código de barras de 8, 12, 13 o 14 dígitos, si figura
      "descripcion": string,
      "cantidad": number,         // cantidad facturada (bultos o unidades, tal cual figura)
      "unidades_por_bulto": number|null, // si la descripción dice "x12", "CJ X 24", "pack 6", etc.
      "precio_unitario": number|null,    // precio de UNA unidad de "cantidad", sin IVA si está discriminado
      "subtotal": number|null
    }
  ]
}
Reglas:
- El proveedor es QUIEN EMITE la factura (arriba), no el cliente.
- Números en formato argentino: "1.234,50" es 1234.5. Devolvé números JSON, sin símbolos.
- No inventes datos: si algo no se lee, poné null.
- Incluí todos los renglones de productos; no incluyas subtotales, IVA, percepciones ni bonificaciones generales como renglones.
- Si un renglón tiene bonificación o descuento propio, usá el precio unitario ya descontado.
- Kilos: si se factura por peso (carne, fiambre), "cantidad" son los kg.`

export async function leerFactura({ image, text }, { apiKey, model } = {}) {
  if (!apiKey) throw httpError(500, 'Falta configurar GROQ_API_KEY en el servidor.')

  let content
  if (typeof image === 'string' && image.startsWith('data:image/')) {
    if (image.length > MAX_IMAGE_CHARS) {
      throw httpError(413, 'La imagen es demasiado grande. Probá con una foto más chica.')
    }
    content = [
      { type: 'text', text: 'Leé esta factura y devolvé el JSON pedido.' },
      { type: 'image_url', image_url: { url: image } },
    ]
  } else if (typeof text === 'string' && text.trim()) {
    content = `Este es el texto de una factura en PDF. Devolvé el JSON pedido.\n\n${text.slice(0, MAX_TEXT_CHARS)}`
  } else {
    throw httpError(400, 'Mandá una imagen o el texto de la factura.')
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 429) {
      throw httpError(429, 'Se alcanzó el límite de lecturas por ahora. Esperá un minuto y probá de nuevo.')
    }
    throw httpError(502, `Groq respondió ${res.status}. ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content || ''
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw httpError(502, 'No se pudo entender la respuesta al leer la factura.')
    parsed = JSON.parse(match[0])
  }
  return normalize(parsed)
}

function normalize(p) {
  const prov = p?.proveedor || {}
  const fac = p?.factura || {}
  const lines = Array.isArray(p?.renglones) ? p.renglones : []
  return {
    supplier: { name: str(prov.nombre), cuit: str(prov.cuit) },
    invoice: {
      type: str(fac.tipo),
      number: str(fac.numero),
      date: isoDate(fac.fecha),
      subtotal: num(fac.subtotal),
      iva: num(fac.iva),
      total: num(fac.total),
    },
    lines: lines
      .map((l) => ({
        code: str(l?.codigo),
        ean: digits(l?.ean),
        description: str(l?.descripcion) || '',
        quantity: num(l?.cantidad),
        unitsPerPack: num(l?.unidades_por_bulto),
        unitPrice: num(l?.precio_unitario),
        subtotal: num(l?.subtotal),
      }))
      .filter((l) => l.description || l.ean || l.code),
  }
}

function str(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function digits(v) {
  const s = String(v ?? '').replace(/\D/g, '')
  return s.length >= 8 && s.length <= 14 ? s : null
}

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string' || !v.trim()) return null
  let s = v.replace(/[^\d.,-]/g, '')
  // "1.234,50" → 1234.50 ; "1234.50" queda igual
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function isoDate(v) {
  const s = str(v)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (!m) return null
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}
