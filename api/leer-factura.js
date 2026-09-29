import { leerFactura } from '../server/leerFactura.js'

// La foto de una factura puede pesar varios MB en base64.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

/**
 * Recibe la foto (o el texto del PDF) de una factura y devuelve los datos
 * leídos. La clave de Groq vive sólo acá, como variable de entorno de Vercel:
 * nunca llega al navegador.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Usá POST.' })
  }
  // Sólo la propia app: evita que otra página use la clave desde el navegador.
  const origin = req.headers.origin
  if (origin && new URL(origin).host !== req.headers.host) {
    return res.status(403).json({ error: 'Origen no permitido.' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const result = await leerFactura(body, {
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL,
    })
    return res.status(200).json(result)
  } catch (err) {
    if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter))
    return res
      .status(err.status || 500)
      .json({ error: err.message || 'No se pudo leer la factura.', retryAfter: err.retryAfter })
  }
}
