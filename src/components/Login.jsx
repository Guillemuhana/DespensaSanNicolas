import { useState } from 'react'
import { LogIn } from 'lucide-react'

const PASSWORD = '202714'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (password !== PASSWORD) {
      setError('Contraseña incorrecta.')
      setPassword('')
      setBusy(false)
      return
    }
    onLogin()
    setBusy(false)
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
          className="mx-auto mb-5 h-56 w-auto rounded-full sm:h-64"
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
