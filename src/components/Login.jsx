import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// La app tiene una sola cuenta, así que no se pide usuario: en la pantalla va
// nada más la contraseña y el email lo pone el código.
//
// Que esta dirección viaje en el bundle no debilita nada: es un identificador,
// no un secreto. Lo único que abre la puerta es la contraseña, que vive en
// Supabase y no está en ningún archivo del repo.
const ACCOUNT_EMAIL = 'firenzeapp@firenzestore.com.ar'

/**
 * Puerta de entrada. No hay registro ni recuperación de contraseña: el alta se
 * hace una vez desde el panel de Supabase.
 *
 * Esto no es una cortina. Las políticas de la base (migración 006) sólo dejan
 * pasar al rol `authenticated`, así que sin sesión iniciada la anon key que
 * viaja en el bundle no sirve para leer ni escribir nada.
 */
export default function Login() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: ACCOUNT_EMAIL,
      password,
    })
    if (err) {
      setError(
        err.message === 'Invalid login credentials' ? 'Contraseña incorrecta.' : err.message
      )
      setPassword('')
      setBusy(false)
    }
    // Si entró no hace falta hacer nada: onAuthStateChange en App levanta la
    // sesión y este componente se desmonta solo.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8"
      >
        <img
          src="/logo.jpeg"
          alt="Firenze Store"
          width="1254"
          height="1254"
          className="mx-auto mb-6 h-32 w-auto rounded-full"
        />

        <h1 className="text-center font-display text-xl font-semibold text-ink">Firenze Store</h1>
        <p className="mt-1 text-center text-sm text-inkfaint">Ingresá la contraseña para entrar</p>

        <div className="mt-6">
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-semibold text-inkfaint"
          >
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-center font-mono tracking-widest transition-colors focus:border-awning focus:outline-none"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-center text-sm font-medium text-brick-dark">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-awning px-4 py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark disabled:opacity-60"
        >
          <LogIn size={17} strokeWidth={2.4} />
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
