import { useEffect, useRef, useState } from 'react'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

/**
 * Entrada de mercadería: suma al stock lo que llegó del proveedor.
 *
 * Si se carga el costo unitario también actualiza el costo del producto, que
 * es lo que se usa después para calcular la ganancia.
 */
export default function RestockModal({ product, suppliers = [], canCost, onConfirm, onCancel }) {
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState(product.cost ? String(product.cost) : '')
  const [supplierId, setSupplierId] = useState(product.supplier_id || '')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const qtyNum = Number(qty) || 0
  const costNum = Number(cost) || 0
  const newStock = Number(product.stock) + qtyNum
  const invoice = qtyNum * costNum

  async function handleSubmit(e) {
    e.preventDefault()
    if (qtyNum <= 0) return
    setBusy(true)
    try {
      await onConfirm({
        stock: newStock,
        ...(canCost && costNum > 0 ? { cost: costNum } : {}),
        ...(supplierId ? { supplier_id: supplierId } : {}),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-rise my-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6"
      >
        <p className="eyebrow text-awning">Entrada de mercadería</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">{product.name}</h2>
        <p className="mt-1 text-sm text-inkfaint">
          Hay{' '}
          <span className="font-mono tabular">
            {Number(product.stock).toLocaleString('es-AR')} un.
          </span>{' '}
          en stock
        </p>

        <label htmlFor="restock-qty" className="mb-1.5 mt-5 block text-xs font-semibold text-inkfaint">
          ¿Cuánto entró? (un.)
        </label>
        <input
          id="restock-qty"
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono tabular text-3xl font-semibold transition-colors focus:border-awning focus:outline-none"
        />

        {canCost && (
          <div className="mt-3.5">
            <label htmlFor="restock-cost" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Costo por unidad (opcional)
            </label>
            <input
              id="restock-cost"
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className={`${inputClass} font-mono tabular`}
            />
          </div>
        )}

        {suppliers.length > 0 && (
          <div className="mt-3.5">
            <label htmlFor="restock-sup" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Proveedor (opcional)
            </label>
            <select
              id="restock-sup"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
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

        <div className="mt-4 space-y-1.5 rounded-xl bg-paper2/70 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-inkfaint">Stock queda en</span>
            <span className="font-mono tabular text-lg font-bold text-ink">
              {newStock.toLocaleString('es-AR')} un.
            </span>
          </div>
          {invoice > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-inkfaint">Le pagás al proveedor</span>
              <span className="font-mono tabular font-semibold text-brick">
                ${invoice.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-3 font-semibold text-inkfaint transition-colors hover:bg-paper2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || qtyNum <= 0}
            className="flex-1 rounded-xl bg-awning py-3 font-semibold text-white shadow-card transition-all hover:bg-awning-dark active:translate-y-px disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
          >
            {busy ? 'Guardando…' : 'Sumar al stock'}
          </button>
        </div>
      </form>
    </div>
  )
}
