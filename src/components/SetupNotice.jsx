export default function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8">
        <img
          src="/logo.png"
          alt="Despensa San Nicolás"
          width="528"
          height="420"
          className="mb-6 h-16 w-auto"
        />
        <p className="eyebrow text-brick">Configuración pendiente</p>
        <h1 className="mt-1.5 font-display text-xl font-semibold text-ink sm:text-2xl">
          Falta conectar la base de datos
        </h1>
        <p className="mt-3 leading-relaxed text-inkfaint">
          Esta app todavía no tiene las credenciales de Supabase. Agregá estas dos variables de
          entorno en Vercel (Project Settings → Environment Variables) y volvé a desplegar:
        </p>
        <div className="my-4 space-y-1 break-all rounded-xl border border-line bg-paper p-4 font-mono text-xs sm:text-sm">
          <div>VITE_SUPABASE_URL</div>
          <div>VITE_SUPABASE_ANON_KEY</div>
        </div>
        <p className="text-sm leading-relaxed text-inkfaint">
          Estos valores están en el panel de Supabase, en Project Settings → API. Una vez cargados,
          esta pantalla desaparece sola.
        </p>
      </div>
    </div>
  )
}
