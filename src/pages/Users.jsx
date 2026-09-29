import { useEffect, useState } from 'react'
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import {
  ROLE_LABEL,
  adminCreateUser,
  adminDeleteUser,
  adminSetPassword,
  adminUpdateProfile,
  fetchProfiles,
} from '../lib/auth'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

const emptyForm = { username: '', fullName: '', role: 'owner', password: '' }

// Contraseña para arrancar: fácil de dictar y de tipear en el celular.
// Sin letras que se confunden (l, 1, o, 0).
function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const pick = (set, n) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join('')
  return pick(letters, 4) + pick(digits, 4)
}

/** Sólo para el admin: quién entra a la app y con qué contraseña. */
export default function Users({ profile }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { id, fullName, role }
  const [newPassword, setNewPassword] = useState(null) // { id, value }

  async function load() {
    try {
      setUsers(await fetchProfiles())
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function run(action, okText) {
    setBusy(true)
    setStatus(null)
    try {
      await action()
      setStatus({ type: 'success', text: okText })
      await load()
      return true
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const username = form.username.trim().toLowerCase()
    const ok = await run(
      () => adminCreateUser({ ...form, username, fullName: form.fullName.trim() }),
      `Listo: ${form.fullName.trim()} entra con el usuario "${username}" y la contraseña "${form.password}".`
    )
    if (ok) setForm(emptyForm)
  }

  async function handleSavePassword(user) {
    const value = newPassword.value.trim()
    const ok = await run(
      () => adminSetPassword(user.id, value),
      `Contraseña de ${user.full_name} cambiada a "${value}".`
    )
    if (ok) setNewPassword(null)
  }

  async function handleSaveProfile(user) {
    const ok = await run(
      () => adminUpdateProfile(user.id, { fullName: editing.fullName.trim(), role: editing.role }),
      `${editing.fullName.trim()} actualizado.`
    )
    if (ok) setEditing(null)
  }

  async function handleDelete(user) {
    if (!window.confirm(`¿Borrar el usuario de ${user.full_name}? No va a poder entrar más.`)) return
    await run(() => adminDeleteUser(user.id), `${user.full_name} ya no puede entrar.`)
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
      <div className="min-w-0">
        {status && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
              status.type === 'error'
                ? 'border-brick-100 bg-brick-50 text-brick-dark'
                : 'border-awning-100 bg-awning-50 text-awning-dark'
            }`}
          >
            {status.text}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-paper2/70" />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => {
              const me = u.id === profile?.id
              const isEditing = editing?.id === u.id
              const isPw = newPassword?.id === u.id
              return (
                <li key={u.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-awning-400 to-awning font-display text-sm font-semibold text-white">
                        {initials(u.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold text-ink">
                          {u.full_name}
                          {me && <span className="ml-1.5 text-xs font-medium text-inkfaint">(vos)</span>}
                        </p>
                        <p className="font-mono text-xs text-inkfaint">usuario: {u.username}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        u.role === 'admin' ? 'bg-ink text-white' : 'bg-awning-50 text-awning-dark'
                      }`}
                    >
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </div>

                  {isEditing && (
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <input
                        value={editing.fullName}
                        onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                        className={`${inputClass} text-sm`}
                      />
                      <select
                        value={editing.role}
                        onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                        className={`${inputClass} text-sm`}
                      >
                        <option value="owner">Dueño/a</option>
                        <option value="admin">Admin</option>
                      </select>
                      <div className="col-span-2 flex gap-2">
                        <button
                          onClick={() => setEditing(null)}
                          className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-inkfaint hover:bg-paper2"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSaveProfile(u)}
                          disabled={busy || !editing.fullName.trim()}
                          className="flex-1 rounded-lg bg-awning py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}

                  {isPw && (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={newPassword.value}
                        onChange={(e) => setNewPassword({ ...newPassword, value: e.target.value })}
                        placeholder="Contraseña nueva"
                        className={`${inputClass} font-mono text-sm`}
                      />
                      <button
                        onClick={() => setNewPassword({ ...newPassword, value: generatePassword() })}
                        aria-label="Generar una contraseña"
                        title="Generar una contraseña"
                        className="rounded-lg border border-line px-2.5 text-inkfaint hover:border-awning hover:text-awning"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => handleSavePassword(u)}
                        disabled={busy || newPassword.value.trim().length < 6}
                        className="rounded-lg bg-awning px-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Guardar
                      </button>
                    </div>
                  )}

                  {!isEditing && !isPw && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
                      <button
                        onClick={() => setNewPassword({ id: u.id, value: generatePassword() })}
                        className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning"
                      >
                        <KeyRound size={14} />
                        Cambiar contraseña
                      </button>
                      <button
                        onClick={() => setEditing({ id: u.id, fullName: u.full_name, role: u.role })}
                        className="rounded-lg border border-line px-3 py-1.5 font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning"
                      >
                        Editar
                      </button>
                      {!me && (
                        <button
                          onClick={() => handleDelete(u)}
                          aria-label={`Borrar a ${u.full_name}`}
                          className="ml-auto rounded-lg p-1.5 text-inkfaint transition-colors hover:bg-brick-50 hover:text-brick"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="h-fit rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Nuevo usuario</h2>
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div>
            <label htmlFor="u-name" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Nombre y apellido
            </label>
            <input
              id="u-name"
              required
              value={form.fullName}
              onChange={(e) => {
                const fullName = e.target.value
                // Propone el usuario con el primer nombre, si no lo tocaron.
                const suggested = fullName.trim().split(/\s+/)[0]?.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') || ''
                setForm((f) => ({
                  ...f,
                  fullName,
                  username: !f.username || f.username === f._suggested ? suggested : f.username,
                  _suggested: suggested,
                }))
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="u-user" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Usuario (con esto entra)
            </label>
            <input
              id="u-user"
              required
              autoCapitalize="none"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="u-role" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Rol
            </label>
            <select
              id="u-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClass}
            >
              <option value="owner">Dueño/a: usa toda la app</option>
              <option value="admin">Admin: además maneja usuarios</option>
            </select>
          </div>
          <div>
            <label htmlFor="u-pw" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Contraseña
            </label>
            <div className="flex gap-2">
              <input
                id="u-pw"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, password: generatePassword() })}
                aria-label="Generar una contraseña"
                title="Generar una contraseña"
                className="rounded-lg border border-line px-2.5 text-inkfaint hover:border-awning hover:text-awning"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-inkfaint">
              Pasásela a la persona. Después la puede cambiar desde el menú.
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-awning py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark disabled:opacity-60"
          >
            {busy ? 'Guardando...' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  )
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}
