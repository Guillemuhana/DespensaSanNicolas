import { CalendarClock, ExternalLink } from 'lucide-react'

// Fin del período de prueba: sábado 29 de agosto de 2026, al cierre del día.
const DEMO_END = new Date(2026, 7, 29, 23, 59, 59)
export const QUOTE_URL = 'https://numera-presupuestos.vercel.app/p/173f4ae3-0c1d-4baa-849d-08f36324d763'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Días completos que faltan, contados por fecha y no por horas: si hoy es el 27
// y vence el 29, faltan 2, sin importar a qué hora se abra la app.
function daysLeft(now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfEnd = new Date(DEMO_END.getFullYear(), DEMO_END.getMonth(), DEMO_END.getDate())
  return Math.round((startOfEnd - startOfToday) / MS_PER_DAY)
}

function countdown(left) {
  if (left > 1) return `Quedan ${left} días de prueba`
  if (left === 1) return 'Queda 1 día de prueba'
  if (left === 0) return 'Último día de la prueba'
  return 'La prueba gratuita terminó'
}

export default function DemoNotice() {
  const left = daysLeft()
  const expired = left < 0

  return (
    <div
      className={`no-print mb-5 flex flex-col gap-3 rounded-2xl border p-4 shadow-card sm:flex-row sm:items-center sm:gap-4 ${
        expired ? 'border-brick-200 bg-brick-50' : 'border-awning-100 bg-awning-50'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          expired ? 'bg-brick text-white' : 'bg-awning text-white'
        }`}
      >
        <CalendarClock size={20} strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`eyebrow ${expired ? 'text-brick-dark' : 'text-awning-dark'}`}>
            {countdown(left)}
          </p>
          <span className="rounded-full bg-brick px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white">
            30% de descuento
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink">
          Esta es una demo de la app.{' '}
          {expired ? (
            <>
              El demo gratuito caducó el sábado 29 de agosto de 2026 y con él se terminó el{' '}
              <strong className="font-semibold">30% de descuento</strong>. Consultanos por el
              presupuesto actualizado.
            </>
          ) : (
            <>
              El demo gratuito caduca el{' '}
              <strong className="font-semibold">sábado 29 de agosto de 2026</strong>. Contratando
              antes de esa fecha aprovechás el{' '}
              <strong className="font-semibold">30% de descuento</strong> del presupuesto.
            </>
          )}
        </p>
      </div>

      <a
        href={QUOTE_URL}
        target="_blank"
        rel="noreferrer"
        className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors ${
          expired ? 'bg-brick hover:bg-brick-dark' : 'bg-awning hover:bg-awning-dark'
        }`}
      >
        {expired ? 'Ver presupuesto' : 'Aprovechar el 30%'}
        <ExternalLink size={15} strokeWidth={2.4} />
      </a>
    </div>
  )
}
