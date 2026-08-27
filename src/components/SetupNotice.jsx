export default function SetupNotice() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-paper2 rounded-lg shadow-sm p-8">
        <p className="font-mono text-xs tracking-widest text-mustard-dark uppercase mb-2">
          Configuración pendiente
        </p>
        <h1 className="font-display text-2xl font-semibold text-ink mb-4">
          Falta conectar la base de datos
        </h1>
        <p className="text-inkfaint mb-4 leading-relaxed">
          Esta app todavía no tiene las credenciales de Supabase. Agregá estas dos
          variables de entorno en Vercel (Project Settings → Environment Variables)
          y volvé a desplegar:
        </p>
        <div className="font-mono text-sm bg-paper2 rounded p-4 mb-4 space-y-1">
          <div>VITE_SUPABASE_URL</div>
          <div>VITE_SUPABASE_ANON_KEY</div>
        </div>
        <p className="text-inkfaint text-sm leading-relaxed">
          Estos valores están en el panel de Supabase, en Project Settings → API.
          Una vez cargados, esta pantalla desaparece sola.
        </p>
      </div>
    </div>
  )
}
