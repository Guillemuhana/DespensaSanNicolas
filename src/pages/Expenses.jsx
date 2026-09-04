import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { fetchExpenses, createExpense, deleteExpense } from '../lib/queries'
import { friendlyError } from '../lib/friendlyError'

const CATEGORIES = [
  { id: 'temporada', label: 'Compra de temporada' },
  { id: 'envios', label: 'Envíos y logística' },
  { id: 'marketing', label: 'Marketing y redes' },
  { id: 'alquiler', label: 'Alquiler' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'sueldos', label: 'Sueldos' },
  { id: 'impuestos', label: 'Impuestos' },
  { id: 'otros', label: 'Otros' },
]
const labelOf = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

const money = (n) => '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
const todayInput = () => new Date().toISOString().slice(0, 10)

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState({
    description: '',
    category: 'temporada',
    amount: '',
    spent_on: todayInput(),
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setExpenses(await fetchExpenses())
    } catch (err) {
      setStatus(friendlyError(err.message, 'expenses'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    try {
      await createExpense({
        description: form.description.trim(),
        category: form.category,
        amount: Number(form.amount) || 0,
        spent_on: form.spent_on,
      })
      setForm({ description: '', category: 'temporada', amount: '', spent_on: todayInput() })
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'expenses'))
    }
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id)
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'expenses'))
    }
  }

  const summary = useMemo(() => {
    const now = new Date()
    const thisMonth = expenses.filter((e) => {
      const d = new Date(e.spent_on + 'T00:00:00')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const thisYear = expenses.filter(
      (e) => new Date(e.spent_on + 'T00:00:00').getFullYear() === now.getFullYear()
    )
    const sum = (rows) => rows.reduce((s, e) => s + Number(e.amount), 0)

    const byCategory = CATEGORIES.map((c) => ({
      ...c,
      total: sum(thisMonth.filter((e) => e.category === c.id)),
    }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)

    return { month: sum(thisMonth), year: sum(thisYear), byCategory }
  }, [expenses])

  const maxCat = Math.max(...summary.byCategory.map((c) => c.total), 1)

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
      <div className="grid content-start gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="eyebrow text-inkfaint">Gastos del mes</p>
            <p className="mt-1.5 font-mono tabular text-2xl font-bold leading-none text-brick">
              {money(summary.month)}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="eyebrow text-inkfaint">Gastos del año</p>
            <p className="mt-1.5 font-mono tabular text-2xl font-bold leading-none text-ink">
              {money(summary.year)}
            </p>
          </div>
        </div>

        {summary.byCategory.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
            <h2 className="mb-4 font-display text-base font-semibold text-ink">
              En qué se va la plata
            </h2>
            <ul className="space-y-2.5">
              {summary.byCategory.map((c, i) => (
                <li key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{c.label}</span>
                    <span className="font-mono tabular text-sm font-semibold text-ink">
                      {money(c.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper2">
                    <motion.div
                      className="h-full rounded-full bg-brick"
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.total / maxCat) * 100}%` }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 + i * 0.05 }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-display text-base font-semibold text-ink">Últimos gastos</h2>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-paper2/70" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-inkfaint">
              Todavía no cargaste ningún gasto.
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {expenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{e.description}</p>
                    <p className="text-xs text-inkfaint">
                      {labelOf(e.category)} ·{' '}
                      {new Date(e.spent_on + 'T00:00:00').toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono tabular font-semibold text-brick">
                      {money(e.amount)}
                    </span>
                    <button
                      onClick={() => handleDelete(e.id)}
                      aria-label={`Borrar ${e.description}`}
                      className="no-print rounded-lg p-1.5 text-inkfaint transition-colors hover:bg-brick-50 hover:text-brick"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="no-print h-fit rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Nuevo gasto</h2>
        {status && (
          <div className="mb-4 rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
            {status}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Descripción</label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Pedido a distribuidora..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Monto</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Fecha</label>
              <input
                required
                type="date"
                value={form.spent_on}
                onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-awning py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
          >
            Agregar gasto
          </button>
        </form>
      </div>
    </div>
  )
}
