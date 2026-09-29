import { useState } from 'react'
import { changeMyPassword } from '../lib/auth'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

/** Cada uno cambia su propia contraseña. La de otros la cambia el admin. */
export default function ChangePasswordModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const mismatch = repeat && password !== repeat
  const tooShort = password && password.length < 6

  async function handleSubmit(e) {
    e.preventDefault()
    if (mismatch || tooShort || !password) return
    setBusy(true)
    setError(null)
    try {
      await changeMyPassword(password)
      setDone(true)
    } catch (err) {
      setError(
        /different from the old/i.test(err.message)
          ? 'La contraseña nueva tiene que ser distinta de la actual.'
          : err.message
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-rise my-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6"
      >
        <p className="eyebrow text-awning">Mi cuenta</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">Cambiar contraseña</h2>

        {done ? (
          <>
            <p className="mt-4 rounded-lg border border-awning-100 bg-awning-50 px-3 py-2 text-sm font-medium text-awning-dark">
              Listo, la próxima vez entrás con la contraseña nueva.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-awning py-3 font-semibold text-white"
            >
              Cerrar
            </button>
          </>
        ) : (
          <>
            <div className="mt-5 space-y-3.5">
              <div>
                <label htmlFor="pw-new" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                  Contraseña nueva
                </label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                {tooShort && <p className="mt-1 text-xs text-brick-dark">Mínimo 6 caracteres.</p>}
              </div>
              <div>
                <label htmlFor="pw-repeat" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                  Repetila
                </label>
                <input
                  id="pw-repeat"
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className={inputClass}
                />
                {mismatch && <p className="mt-1 text-xs text-brick-dark">No coinciden.</p>}
              </div>
            </div>
            {error && (
              <p className="mt-3 rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-sm font-medium text-brick-dark">
                {error}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-line py-3 font-semibold text-inkfaint transition-colors hover:bg-paper2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy || !password || mismatch || tooShort || password !== repeat}
                className="flex-1 rounded-xl bg-awning py-3 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
              >
                {busy ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
