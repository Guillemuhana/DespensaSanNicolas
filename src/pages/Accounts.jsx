import { useEffect, useState } from 'react'
import {
  fetchCustomers,
  fetchAllBalances,
  fetchAccountMovements,
  addAccountMovement,
  createCustomer,
} from '../lib/queries'

export default function Accounts() {
  const [customers, setCustomers] = useState([])
  const [balances, setBalances] = useState({})
  const [selected, setSelected] = useState(null)
  const [movements, setMovements] = useState([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [newName, setNewName] = useState('')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [c, b] = await Promise.all([fetchCustomers(), fetchAllBalances()])
      setCustomers(c)
      setBalances(b)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function selectCustomer(c) {
    setSelected(c)
    setPaymentAmount('')
    try {
      setMovements(await fetchAccountMovements(c.id))
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const c = await createCustomer({ name: newName.trim() })
      setNewName('')
      await load()
      selectCustomer(c)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function handleRegisterPayment(e) {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (!selected || amount <= 0) return
    try {
      await addAccountMovement({
        customer_id: selected.id,
        type: 'payment',
        amount,
        note: 'Pago recibido',
      })
      setPaymentAmount('')
      await load()
      selectCustomer(selected)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  const sortedCustomers = [...customers].sort(
    (a, b) => (balances[b.id] || 0) - (balances[a.id] || 0)
  )
  const totalDebt = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0)
  const owingCount = Object.values(balances).filter((v) => v > 0).length

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[340px_1fr]">
      <div>
        <div className="mb-4 overflow-hidden rounded-2xl bg-awning p-5 text-white shadow-lift">
          <p className="eyebrow text-white/70">Total a cobrar</p>
          <p className="mt-1.5 font-mono tabular text-3xl font-bold leading-none">
            ${totalDebt.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-sm text-white/75">
            {owingCount === 0
              ? 'Nadie debe nada'
              : `${owingCount} ${owingCount === 1 ? 'cliente adeuda' : 'clientes adeudan'}`}
          </p>
        </div>

        <form onSubmit={handleAddCustomer} className="mb-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuevo cliente..."
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-card transition-colors focus:border-awning focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Agregar cliente"
            className="shrink-0 rounded-xl bg-awning px-4 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <ul className="divide-y divide-line/70">
            {sortedCustomers.map((c) => {
              const bal = balances[c.id] || 0
              const active = selected?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    onClick={() => selectCustomer(c)}
                    className={`flex w-full items-center justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-awning bg-awning-50'
                        : 'border-transparent hover:bg-paper2/60'
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium text-ink">{c.name}</span>
                    <span
                      className={`shrink-0 font-mono tabular text-sm font-semibold ${
                        bal > 0 ? 'text-brick' : 'text-inkfaint/70'
                      }`}
                    >
                      ${bal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    </span>
                  </button>
                </li>
              )
            })}
            {sortedCustomers.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-inkfaint">
                Todavía no hay clientes.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div>
        {!selected ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-4 text-center md:min-h-[340px]">
            <span aria-hidden="true" className="text-inkfaint/30">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
                <circle cx="10" cy="8" r="3.5" />
                <path d="M18 11h4M20 9v4" />
              </svg>
            </span>
            <p className="text-sm text-inkfaint">Elegí un cliente para ver su cuenta.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line pb-5">
              <div className="min-w-0">
                <p className="eyebrow text-inkfaint">Cliente</p>
                <h2 className="mt-1 break-words font-display text-xl font-semibold text-ink sm:text-2xl">
                  {selected.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="eyebrow text-inkfaint">Saldo</p>
                <span
                  className={`font-mono tabular text-2xl font-bold sm:text-3xl ${
                    (balances[selected.id] || 0) > 0 ? 'text-brick' : 'text-awning'
                  }`}
                >
                  ${(balances[selected.id] || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleRegisterPayment} className="mb-6 flex flex-col gap-2 sm:flex-row">
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Monto que paga"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 font-mono tabular transition-colors focus:border-awning focus:outline-none"
              />
              <button
                type="submit"
                className="whitespace-nowrap rounded-xl bg-awning px-5 py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
              >
                Registrar pago
              </button>
            </form>

            <p className="eyebrow mb-1 text-inkfaint">Movimientos</p>
            <ul className="divide-y divide-line/70">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        m.type === 'charge'
                          ? 'bg-brick-50 text-brick'
                          : 'bg-awning-50 text-awning'
                      }`}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {m.type === 'charge' ? (
                          <path d="M12 19V5M6 11l6-6 6 6" />
                        ) : (
                          <path d="M12 5v14M6 13l6 6 6-6" />
                        )}
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {m.note || (m.type === 'charge' ? 'Cargo' : 'Pago')}
                      </p>
                      <p className="text-xs text-inkfaint">
                        {new Date(m.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap font-mono tabular font-semibold ${
                      m.type === 'charge' ? 'text-brick' : 'text-awning'
                    }`}
                  >
                    {m.type === 'charge' ? '+' : '−'}$
                    {Number(m.amount).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
              {movements.length === 0 && (
                <li className="py-8 text-center text-sm text-inkfaint">
                  Sin movimientos todavía.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {status && (
        <div className="rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark md:col-span-2">
          {status.text}
        </div>
      )}
    </div>
  )
}
