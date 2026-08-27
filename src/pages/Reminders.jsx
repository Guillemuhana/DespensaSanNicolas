import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Trash2 } from 'lucide-react'
import {
  fetchReminders,
  createReminder,
  setReminderDone,
  deleteReminder,
  fetchSuppliers,
} from '../lib/queries'
import { friendlyError } from '../lib/friendlyError'

const KINDS = [
  { id: 'pedido', label: 'Pedido' },
  { id: 'pago', label: 'Pago' },
  { id: 'vencimiento', label: 'Vencimiento' },
  { id: 'otro', label: 'Otro' },
]
const labelOf = (id) => KINDS.find((k) => k.id === id)?.label ?? id

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

const todayInput = () => new Date().toISOString().slice(0, 10)
const asDate = (iso) => new Date(iso + 'T00:00:00')

/** Días entre hoy y la fecha, en días calendario (no en horas). */
function daysUntil(iso) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((asDate(iso) - today) / 86400000)
}

function whenLabel(iso) {
  const d = daysUntil(iso)
  if (d < -1) return `Atrasado ${Math.abs(d)} días`
  if (d === -1) return 'Era ayer'
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d <= 7) return `En ${d} días`
  return asDate(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({
    title: '',
    kind: 'pedido',
    due_on: todayInput(),
    supplier_id: '',
    notes: '',
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [r, s] = await Promise.all([fetchReminders(), fetchSuppliers()])
      setReminders(r)
      setSuppliers(s)
      setStatus(null)
    } catch (err) {
      setStatus(friendlyError(err.message, 'reminders'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await createReminder({
        title: form.title.trim(),
        kind: form.kind,
        due_on: form.due_on,
        supplier_id: form.supplier_id || null,
        notes: form.notes.trim() || null,
      })
      setForm({ title: '', kind: 'pedido', due_on: todayInput(), supplier_id: '', notes: '' })
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'reminders'))
    }
  }

  async function toggle(r) {
    try {
      await setReminderDone(r.id, !r.done)
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'reminders'))
    }
  }

  async function remove(id) {
    try {
      await deleteReminder(id)
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'reminders'))
    }
  }

  // Tres grupos: lo vencido primero, después lo que viene, y al final lo hecho.
  const groups = useMemo(() => {
    const pending = reminders.filter((r) => !r.done)
    return {
      late: pending.filter((r) => daysUntil(r.due_on) < 0),
      soon: pending.filter((r) => daysUntil(r.due_on) >= 0),
      done: reminders.filter((r) => r.done).slice(0, 12),
    }
  }, [reminders])

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
      <div className="grid content-start gap-4">
        {status && (
          <div className="rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
            {status}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-paper2/70" />
            ))}
          </div>
        ) : (
          <>
            <Group
              title="Atrasados"
              tone="late"
              items={groups.late}
              onToggle={toggle}
              onRemove={remove}
            />
            <Group
              title="Próximos"
              items={groups.soon}
              onToggle={toggle}
              onRemove={remove}
              empty="No tenés nada pendiente."
            />
            {groups.done.length > 0 && (
              <Group title="Hechos" items={groups.done} onToggle={toggle} onRemove={remove} />
            )}
          </>
        )}
      </div>

      <div className="no-print h-fit rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Nuevo recordatorio</h2>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="rem-title" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Qué hay que hacer
            </label>
            <input
              id="rem-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Pedir gaseosas"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rem-kind" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Tipo
              </label>
              <select
                id="rem-kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className={inputClass}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rem-due" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Para cuándo
              </label>
              <input
                id="rem-due"
                required
                type="date"
                value={form.due_on}
                onChange={(e) => setForm({ ...form, due_on: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          {suppliers.length > 0 && (
            <div>
              <label htmlFor="rem-sup" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Proveedor (opcional)
              </label>
              <select
                id="rem-sup"
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="rem-notes" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Notas
            </label>
            <textarea
              id="rem-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={`${inputClass} resize-none`}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-awning py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
          >
            Agregar recordatorio
          </button>
        </form>
      </div>
    </div>
  )
}

function Group({ title, items, tone, onToggle, onRemove, empty }) {
  if (items.length === 0 && !empty) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {items.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              tone === 'late' ? 'bg-brick-50 text-brick-dark' : 'bg-paper2 text-inkfaint'
            }`}
          >
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-inkfaint">{empty}</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((r) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 px-4 py-3 sm:px-5"
            >
              <button
                onClick={() => onToggle(r)}
                aria-label={r.done ? `Reabrir ${r.title}` : `Marcar ${r.title} como hecho`}
                className={`no-print mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  r.done
                    ? 'border-awning bg-awning text-white'
                    : 'border-line hover:border-awning'
                }`}
              >
                {r.done && <Check size={13} strokeWidth={3} />}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`font-medium ${r.done ? 'text-inkfaint line-through' : 'text-ink'}`}
                >
                  {r.title}
                </p>
                <p className="text-xs text-inkfaint">
                  {labelOf(r.kind)}
                  {r.suppliers?.name ? ` · ${r.suppliers.name}` : ''}
                </p>
                {r.notes && <p className="mt-1 text-sm text-inkfaint">{r.notes}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                    r.done
                      ? 'bg-paper2 text-inkfaint'
                      : tone === 'late'
                        ? 'bg-brick-50 text-brick-dark'
                        : 'bg-awning-50 text-awning-dark'
                  }`}
                >
                  {whenLabel(r.due_on)}
                </span>
                <button
                  onClick={() => onRemove(r.id)}
                  aria-label={`Borrar ${r.title}`}
                  className="no-print rounded-lg p-1.5 text-inkfaint transition-colors hover:bg-brick-50 hover:text-brick"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
