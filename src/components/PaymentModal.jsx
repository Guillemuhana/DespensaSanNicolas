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
    <div className="fixed inset-0 z-50 bg-ink/40 overflow-y-auto flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 sm:p-6 border border-paper2 my-auto">
        <p className="font-mono text-xs tracking-widest text-mustard-dark uppercase mb-1">Cobrar</p>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-xl font-semibold text-ink">Total</h2>
          <span className="font-mono tabular text-3xl font-semibold text-ink">
            ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMethod('cash')}
            className={`flex-1 py-2 rounded-md font-medium border ${
              method === 'cash'
                ? 'bg-awning text-white border-awning'
                : 'border-paper2 text-inkfaint hover:bg-paper2'
            }`}
          >
            Efectivo
          </button>
          <button
            onClick={() => setMethod('account')}
            className={`flex-1 py-2 rounded-md font-medium border ${
              method === 'account'
                ? 'bg-awning text-white border-awning'
                : 'border-paper2 text-inkfaint hover:bg-paper2'
            }`}
          >
            Cuenta corriente
          </button>
        </div>

        {method === 'cash' ? (
          <div className="mb-2">
            <label className="block text-sm font-medium text-ink mb-1">Paga con ($)</label>
            <input
              ref={cashInputRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="0"
              className="w-full text-3xl font-mono tabular border border-paper2 rounded-md px-4 py-3 mb-2 focus:border-awning"
            />
            <div className="flex items-baseline justify-between px-1">
              <span className="text-inkfaint">Vuelto</span>
              <span
                className={`font-mono tabular text-2xl font-semibold ${
                  change < 0 ? 'text-brick' : 'text-awning'
                }`}
              >
                ${Math.max(change, 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-2">
            <label className="block text-sm font-medium text-ink mb-1">Cliente</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full border border-paper2 rounded-md px-3 py-2 mb-2 focus:border-awning"
            />
            <div className="max-h-40 overflow-y-auto border border-paper2 rounded-md divide-y divide-paper2">
              {filteredCustomers.length === 0 ? (
                <div className="p-3">
                  <p className="text-inkfaint text-sm mb-2">No se encontró ningún cliente.</p>
                  <button
                    type="button"
                    onClick={() => onNewCustomer(customerSearch)}
                    className="text-awning font-medium text-sm hover:underline"
                  >
                    + Crear "{customerSearch || 'nuevo cliente'}"
                  </button>
                </div>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCustomerId(c.id)}
                    className={`w-full text-left px-3 py-2 ${
                      customerId === c.id ? 'bg-mustard-light/40' : 'hover:bg-paper2'
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-md border border-paper2 text-inkfaint font-medium hover:bg-paper2"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || (method === 'cash' ? !canConfirmCash : !canConfirmAccount)}
            className="flex-1 py-3 rounded-md bg-awning text-white font-medium hover:bg-awning-dark disabled:opacity-40"
          >
            {busy ? 'Cobrando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
