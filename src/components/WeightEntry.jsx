import { useEffect, useRef, useState } from 'react'

export default function WeightEntry({ product, onConfirm, onCancel }) {
  const [amount, setAmount] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const amountNum = Number(amount) || 0
  const kg = product.price > 0 ? amountNum / product.price : 0
  const enoughStock = kg <= product.stock

  function handleSubmit(e) {
    e.preventDefault()
    if (amountNum <= 0) return
    onConfirm({ quantityKg: kg, amount: amountNum })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-rise my-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6"
      >
        <p className="eyebrow text-brick">Producto por peso</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">{product.name}</h2>
        <p className="mt-1 text-sm text-inkfaint">
          <span className="font-mono tabular">
            ${Number(product.price).toLocaleString('es-AR')}
          </span>{' '}
          el kg · quedan{' '}
          <span className="font-mono tabular">
            {Number(product.stock).toLocaleString('es-AR')} kg
          </span>
        </p>

        <label htmlFor="weight-amount" className="mb-1.5 mt-5 block text-xs font-semibold text-inkfaint">
          ¿Cuánto vendiste? ($)
        </label>
        <input
          id="weight-amount"
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono tabular text-3xl font-semibold transition-colors focus:border-awning focus:outline-none"
        />

        <div className="mt-3 flex items-center justify-between rounded-xl bg-paper2/70 px-4 py-3">
          <span className="text-sm font-medium text-inkfaint">Equivale a</span>
          <span className="font-mono tabular text-xl font-bold text-ink">
            {kg > 0 ? kg.toLocaleString('es-AR', { maximumFractionDigits: 3 }) : '0'} kg
          </span>
        </div>

        {!enoughStock && amountNum > 0 && (
          <p className="mt-2 rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-sm font-medium text-brick-dark">
            No hay tanto stock: quedan {Number(product.stock).toLocaleString('es-AR')} kg.
          </p>
        )}

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
            disabled={amountNum <= 0}
            className="flex-1 rounded-xl bg-awning py-3 font-semibold text-white shadow-card transition-all hover:bg-awning-dark active:translate-y-px disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
          >
            Agregar
          </button>
        </div>
      </form>
    </div>
  )
}
