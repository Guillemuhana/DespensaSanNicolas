/**
 * Encabezado que sólo aparece en el papel. En pantalla no ocupa lugar: el
 * título de la sección ya está en la barra superior.
 */
export default function PrintHeader({ title }) {
  const now = new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="print-only mb-5 items-end justify-between gap-6 border-b-2 border-ink pb-3">
      <div className="flex items-center gap-3">
        <img src="/logo.jpeg" alt="" width="1254" height="1254" className="h-14 w-auto" />
        <div>
          <p className="font-display text-lg font-bold leading-tight">Firenze Store</p>
          <p className="text-sm">{title}</p>
        </div>
      </div>
      <p className="text-xs">Emitido el {now}</p>
    </div>
  )
}
