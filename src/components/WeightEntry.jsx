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
    <div className="fixed inset-0 z-50 bg-ink/40 overflow-y-auto flex items-end sm:items-center justify-center p-3 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-lg w-full max-w-sm p-5 sm:p-6 border border-paper2 my-auto"
      >
        <p className="font-mono text-xs tracking-widest text-mustard-dark uppercase mb-1">
          Producto por peso
        </p>
        <h2 className="font-display text-xl font-semibold text-ink mb-1">{product.name}</h2>
        <p className="text-inkfaint text-sm mb-4">
          ${Number(product.price).toLocaleString('es-AR')} el kg · quedan{' '}
          {Number(product.stock).toLocaleString('es-AR')} kg
        </p>

        <label className="block text-sm font-medium text-ink mb-1">
          ¿Cuánto vendiste? ($)
        </label>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full text-3xl font-mono tabular border border-paper2 rounded-md px-4 py-3 mb-2 focus:border-awning"
        />

        <p className="text-inkfaint text-sm mb-4 tabular">
          = {kg > 0 ? kg.toLocaleString('es-AR', { maximumFractionDigits: 3 }) : '0'} kg
          {!enoughStock && amountNum > 0 && (
            <span className="text-brick font-medium"> · no hay tanto stock</span>
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-md border border-paper2 text-inkfaint font-medium hover:bg-paper2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={amountNum <= 0}
            className="flex-1 py-3 rounded-md bg-awning text-white font-medium hover:bg-awning-dark disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      </form>
    </div>
  )
}
