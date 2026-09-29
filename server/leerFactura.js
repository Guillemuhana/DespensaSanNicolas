// Lectura de facturas de proveedor con Groq. Lo usa la función de Vercel
// (api/leer-factura.js) y el servidor de desarrollo de Vite, así que no
// depende de ninguno de los dos.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'

// Groq acepta imágenes de hasta 4 MB en base64; dejamos margen.
const MAX_IMAGE_CHARS = 5_400_000
const MAX_TEXT_CHARS = 60_000

// El plan gratis de Groq deja generar pocos tokens de respuesta por minuto,
// así que el formato es lo más corto posible: renglones como listas, sin
// nombres de campo repetidos ni espacios.
const PROMPT = `Leés facturas y remitos de proveedores de un almacén/carnicería de Argentina.
Devolvé SOLO JSON minificado (una línea, sin espacios ni saltos) con esta forma:
{"p":[nombre,cuit],"f":[tipo,numero,fecha,neto,iva,total],"r":[[codigo,ean,descripcion,cantidad,unidades_por_bulto,precio_unitario],...]}
- p: proveedor = quien EMITE la factura (arriba), no el cliente. cuit como figura.
- f: tipo ("A","B","C","R" si es remito), numero (ej "0003-00012345"), fecha "AAAA-MM-DD", neto sin IVA, total de IVA discriminado, total final.
- r: un renglón por producto. codigo = código interno del proveedor; ean = código de barras de 8 a 14 dígitos; unidades_por_bulto si la descripción dice "x12", "CJ X 24", "pack 6"; precio_unitario = precio de una unidad de "cantidad", sin IVA si está discriminado y ya con la bonificación del renglón. Si se factura por peso, cantidad son los kg.
- Descripción tal cual figura, sin agregar texto.
- Números como números JSON: "1.234,50" es 1234.5.
- Lo que no se lea: null. No inventes datos. No incluyas subtotales, IVA ni percepciones como renglones.`

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
      // Groq dice cuánto esperar ("try again in 32.2s"): se lo pasamos a la
      // app para que reintente sola.
      const m = detail.match(/try again in (?:(\d+)m)?([\d.]+)s/i)
      const wait = m ? Number(m[1] || 0) * 60 + Number(m[2]) : NaN
      const err = httpError(429, 'Groq está al límite de lecturas por minuto.')
      err.retryAfter = Number.isFinite(wait) ? Math.ceil(wait) + 1 : 30
      throw err
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
  // Formato compacto (listas) → objetos.
  if (Array.isArray(p?.r) || Array.isArray(p?.p) || Array.isArray(p?.f)) {
    const [nombre, cuit] = Array.isArray(p.p) ? p.p : []
    const [tipo, numero, fecha, subtotal, iva, total] = Array.isArray(p.f) ? p.f : []
    p = {
      proveedor: { nombre, cuit },
      factura: { tipo, numero, fecha, subtotal, iva, total },
      renglones: (Array.isArray(p.r) ? p.r : []).map((r) =>
        Array.isArray(r)
          ? {
              codigo: r[0],
              ean: r[1],
              descripcion: r[2],
              cantidad: r[3],
              unidades_por_bulto: r[4],
              precio_unitario: r[5],
            }
          : r
      ),
    }
  }
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
