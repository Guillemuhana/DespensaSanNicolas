/**
 * PostgREST avisa en inglés y en jerga cuando una tabla o columna todavía no
 * existe. Como las migraciones se corren a mano en el SQL Editor de Supabase,
 * traducimos ese caso a algo que diga qué hay que hacer.
 */
const MISSING = /schema cache|does not exist|could not find/i
const BLOCKED = /row-level security|permission denied|not authorized/i

const SCRIPTS = {
  products: 'supabase/006_solo_con_sesion.sql',
  expenses: 'supabase/002_costos_y_gastos.sql',
  suppliers: 'supabase/003_proveedores_y_recordatorios.sql',
  reminders: 'supabase/003_proveedores_y_recordatorios.sql',
}

export function friendlyError(message, table) {
  if (BLOCKED.test(String(message))) {
    return `Supabase está bloqueando el acceso a ${table}. Hay que correr el script supabase/006_solo_con_sesion.sql en el SQL Editor de Supabase.`
  }
  if (MISSING.test(message)) {
    const script = SCRIPTS[table]
    return script
      ? `Esta sección todavía no está habilitada en la base. Hay que correr el script ${script} en el SQL Editor de Supabase.`
      : 'La base todavía no tiene las tablas que necesita esta sección.'
  }
  return message
}

/** True si el error es "falta correr la migración" y no un problema real. */
export function isMissingSchema(message) {
  return MISSING.test(String(message))
}
