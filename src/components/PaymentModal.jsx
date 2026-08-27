import { useEffect, useRef, useState } from 'react'

export default function PaymentModal({ total, customers, onConfirm, onCancel, onNewCustomer }) {
  const [method, setMethod] = useState('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const cashInputRef = useRef(null)

  useEffect(() => {
    if (method === 'cash') cashInputRef.current?.focus()
  }, [method])

  const paid = Number(paidAmount) || 0
  const change = paid - total
  const canConfirmCash = paid >= total
  const canConfirmAccount = Boolean(customerId)

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // Atajos de billetes: los importes redondos con los que suele pagar la gente.
  const suggestions = [1000, 2000, 5000, 10000, 20000].filter((v) => v >= total).slice(0, 3)

  async function handleConfirm() {
    setBusy(true)
    try {
      if (method === 'cash') {
        await onConfirm({ paymentMethod: 'cash', paidAmount: paid, changeDue: change })
      } else {
        await onConfirm({ paymentMethod: 'account', customerId })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-rise my-auto w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-5">
          <div>
            <p className="eyebrow text-brick">Cobrar</p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-ink">Total a pagar</h2>
          </div>
          <span className="font-mono tabular text-3xl font-bold text-ink">
            ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="mb-5 flex gap-1 rounded-xl bg-paper2 p-1">
          {[
            { id: 'cash', label: 'Efectivo' },
            { id: 'account', label: 'Cuenta corriente' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMethod(opt.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                method === opt.id
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-inkfaint hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {method === 'cash' ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Paga con ($)</label>
            <input
              ref={cashInputRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono tabular text-3xl font-semibold transition-colors focus:border-awning focus:outline-none"
            />

            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPaidAmount(String(v))}
                    className="rounded-full border border-line bg-paper px-3 py-1 font-mono text-sm font-medium text-inkfaint transition-colors hover:border-awning hover:text-awning"
                  >
                    ${v.toLocaleString('es-AR')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(total))}
                  className="rounded-full border border-line bg-paper px-3 py-1 text-sm font-medium text-inkfaint transition-colors hover:border-awning hover:text-awning"
                >
                  Justo
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-xl bg-paper2/70 px-4 py-3">
              <span className="text-sm font-medium text-inkfaint">Vuelto</span>
              <span
                className={`font-mono tabular text-2xl font-bold ${
                  change < 0 ? 'text-inkfaint/50' : 'text-awning'
                }`}
              >
                ${Math.max(change, 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Cliente</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="mb-2 w-full rounded-xl border border-line bg-surface px-4 py-2.5 transition-colors focus:border-awning focus:outline-none"
            />
            <div className="scroll-soft max-h-44 overflow-y-auto rounded-xl border border-line">
              {filteredCustomers.length === 0 ? (
                <div className="p-4">
                  <p className="mb-2 text-sm text-inkfaint">No se encontró ningún cliente.</p>
                  <button
                    type="button"
                    onClick={() => onNewCustomer(customerSearch)}
                    className="text-sm font-semibold text-awning hover:underline"
                  >
                    + Crear &quot;{customerSearch || 'nuevo cliente'}&quot;
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-line/70">
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                          customerId === c.id
                            ? 'bg-awning-50 font-semibold text-awning-dark'
                            : 'hover:bg-paper2/60'
                        }`}
                      >
                        {c.name}
                        {customerId === c.id && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-3 font-semibold text-inkfaint transition-colors hover:bg-paper2"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || (method === 'cash' ? !canConfirmCash : !canConfirmAccount)}
            className="flex-1 rounded-xl bg-brick py-3 font-semibold text-white shadow-pay transition-all hover:bg-brick-dark active:translate-y-px disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
          >
            {busy ? 'Cobrando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
