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

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[320px_1fr]">
      <div>
        <div className="bg-awning text-white rounded-md p-4 mb-4">
          <p className="text-xs uppercase tracking-widest text-white/70 mb-1">Total a cobrar</p>
          <p className="font-mono tabular text-2xl font-semibold">
            ${totalDebt.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </p>
        </div>

        <form onSubmit={handleAddCustomer} className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuevo cliente..."
            className="flex-1 border border-paper2 rounded-md px-3 py-2 bg-white focus:border-awning"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-awning text-white font-medium hover:bg-awning-dark"
          >
            +
          </button>
        </form>

        <div className="bg-white border border-paper2 rounded-md divide-y divide-paper2 overflow-hidden">
          {sortedCustomers.map((c) => {
            const bal = balances[c.id] || 0
            return (
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                  selected?.id === c.id ? 'bg-mustard-light/40' : 'hover:bg-paper2'
                }`}
              >
                <span className="text-ink font-medium min-w-0 truncate pr-3">{c.name}</span>
                <span
                  className={`font-mono tabular text-sm font-semibold ${
                    bal > 0 ? 'text-brick' : 'text-inkfaint'
                  } shrink-0`}
                >
                  ${bal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </span>
              </button>
            )
          })}
          {sortedCustomers.length === 0 && (
            <p className="text-inkfaint text-sm px-4 py-6 text-center">Todavía no hay clientes.</p>
          )}
        </div>
      </div>

      <div>
        {!selected ? (
          <div className="h-full flex items-center justify-center text-center px-4 text-inkfaint bg-white border border-paper2 rounded-md min-h-[180px] md:min-h-[300px]">
            Elegí un cliente para ver su cuenta.
          </div>
        ) : (
          <div className="bg-white border border-paper2 rounded-md p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-5">
              <h2 className="font-display text-xl font-semibold text-ink break-words min-w-0">
                {selected.name}
              </h2>
              <span
                className={`font-mono tabular text-2xl font-semibold ${
                  (balances[selected.id] || 0) > 0 ? 'text-brick' : 'text-awning'
                }`}
              >
                ${(balances[selected.id] || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <form onSubmit={handleRegisterPayment} className="flex flex-col sm:flex-row gap-2 mb-6">
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Monto que paga"
                className="flex-1 min-w-0 border border-paper2 rounded-md px-3 py-2 font-mono focus:border-awning"
              />
              <button
                type="submit"
                className="px-4 py-2.5 sm:py-2 rounded-md bg-mustard text-ink font-medium hover:bg-mustard-dark whitespace-nowrap"
              >
                Registrar pago
              </button>
            </form>

            <p className="font-mono text-xs tracking-widest text-inkfaint uppercase mb-2">
              Movimientos
            </p>
            <ul className="divide-y divide-paper2">
              {movements.map((m) => (
                <li key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-ink">{m.note || (m.type === 'charge' ? 'Cargo' : 'Pago')}</p>
                    <p className="text-inkfaint text-xs">
                      {new Date(m.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <span
                    className={`font-mono tabular font-medium ${
                      m.type === 'charge' ? 'text-brick' : 'text-awning'
                    } shrink-0 whitespace-nowrap`}
                  >
                    {m.type === 'charge' ? '+' : '−'}$
                    {Number(m.amount).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
              {movements.length === 0 && (
                <p className="text-inkfaint text-sm py-4 text-center">Sin movimientos todavía.</p>
              )}
            </ul>
          </div>
        )}
      </div>

      {status && (
        <div className="rounded-md px-4 py-3 text-sm font-medium bg-brick-light/30 text-brick-dark md:col-span-2">
          {status.text}
        </div>
      )}
    </div>
  )
}
