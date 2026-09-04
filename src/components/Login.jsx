import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Supabase Auth identifica por email, pero en el mostrador se escribe un
// usuario a secas. La pantalla pide el usuario y acá se le pega el dominio:
// "Firenzeapp" entra como "firenzeapp@firenzestore.com.ar". El dominio no recibe
// correo, es sólo la forma que Supabase necesita.
const EMAIL_DOMAIN = 'firenzestore.com.ar'
const toEmail = (user) => `${user.trim().toLowerCase()}@${EMAIL_DOMAIN}`

/**
 * Puerta de entrada. Un solo usuario para el local: no hay registro ni
 * recuperación de contraseña, el alta se hace desde el panel de Supabase.
 *
 * Esto no es sólo una cortina: las políticas de la base (migración 006) sólo
 * dejan pasar al rol `authenticated`, así que sin sesión iniciada la anon key
 * que viaja en el bundle no sirve para leer ni escribir nada.
 */
export default function Login() {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: toEmail(user),
      password,
    })
    if (err) {
      // El mensaje de Supabase viene en inglés y es siempre el mismo para
      // usuario inexistente y contraseña mala, a propósito.
      setError(
        err.message === 'Invalid login credentials'
          ? 'Usuario o contraseña incorrectos.'
          : err.message
      )
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
        <p className="mt-1 text-center text-sm text-inkfaint">Ingresá para abrir la caja</p>

        <div className="mt-6 space-y-3.5">
          <div>
            <label htmlFor="login-user" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Usuario
            </label>
            <input
              id="login-user"
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none"
            />
          </div>

          <div>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-sm font-medium text-brick-dark">
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
