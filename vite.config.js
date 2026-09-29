import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { leerFactura } from './server/leerFactura.js'

// En producción /api/leer-factura es una función de Vercel. En `npm run dev`
// no hay Vercel, así que la misma lógica se sirve desde acá, con la clave de
// Groq sacada del .env local.
function apiDev(env) {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use('/api/leer-factura', async (req, res) => {
        const send = (status, data) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }
        if (req.method !== 'POST') return send(405, { error: 'Usá POST.' })
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          send(200, await leerFactura(body, { apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL }))
        } catch (err) {
          send(err.status || 500, { error: err.message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDev(env)],
  }
})
