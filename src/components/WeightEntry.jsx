import { useEffect, useRef, useState } from 'react'

// Se puede cargar por plata ("dame $5000 de picada") o por lo que marcó la
// balanza ("0,750 kg de asado"). Lo que se elige queda recordado para la
// próxima, porque cada uno trabaja siempre de la misma forma.
const MODE_KEY = 'baratillo:peso-por'

function initialMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'kg' ? 'kg' : 'money'
  } catch {
    return 'money'
  }
}

export default function WeightEntry({ product, onConfirm, onCancel }) {
  const [mode, setMode] = useState(initialMode)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode])

  function changeMode(m) {
    setMode(m)
    setValue('')
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // Sin almacenamiento: se elige de nuevo la próxima vez.
    }
  }

  const price = Number(product.price) || 0
  const valueNum = Number(String(value).replace(',', '.')) || 0
  const kg = mode === 'kg' ? valueNum : price > 0 ? valueNum / price : 0
  const amount = mode === 'kg' ? Math.round(valueNum * price * 100) / 100 : valueNum
  const enoughStock = kg <= Number(product.stock)

  function handleSubmit(e) {
    e.preventDefault()
    if (kg <= 0 || amount <= 0) return
    onConfirm({ quantityKg: kg, amount })
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
          <span className="font-mono tabular">${price.toLocaleString('es-AR')}</span> el kg · quedan{' '}
          <span className="font-mono tabular">
            {Number(product.stock).toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg
          </span>
        </p>

        <div className="mt-5 flex gap-1 rounded-xl bg-paper2 p-1">
          {[
            { id: 'money', label: 'Por $' },
            { id: 'kg', label: 'Por kg (balanza)' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => changeMode(opt.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === opt.id ? 'bg-surface text-ink shadow-card' : 'text-inkfaint hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label htmlFor="weight-value" className="mb-1.5 mt-4 block text-xs font-semibold text-inkfaint">
          {mode === 'kg' ? '¿Cuántos kilos marcó la balanza?' : '¿Cuánta plata lleva? ($)'}
        </label>
        <div className="relative">
          <input
            id="weight-value"
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step={mode === 'kg' ? '0.001' : '0.01'}
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'kg' ? '0,000' : '0'}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 pr-14 font-mono tabular text-3xl font-semibold transition-colors focus:border-awning focus:outline-none"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-lg text-inkfaint">
            {mode === 'kg' ? 'kg' : '$'}
          </span>
        </div>

        {mode === 'kg' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValue(String(v))}
                className="rounded-full border border-line bg-paper px-3 py-1 font-mono text-sm text-inkfaint transition-colors hover:border-awning hover:text-awning"
              >
                {v.toLocaleString('es-AR')} kg
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-paper2/70 px-4 py-3">
          <span className="text-sm font-medium text-inkfaint">
            {mode === 'kg' ? 'A cobrar' : 'Equivale a'}
          </span>
          <span className="font-mono tabular text-xl font-bold text-ink">
            {mode === 'kg'
              ? `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
              : `${kg > 0 ? kg.toLocaleString('es-AR', { maximumFractionDigits: 3 }) : '0'} kg`}
          </span>
        </div>

        {!enoughStock && valueNum > 0 && (
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
            disabled={kg <= 0 || amount <= 0}
            className="flex-1 rounded-xl bg-awning py-3 font-semibold text-white shadow-card transition-all hover:bg-awning-dark active:translate-y-px disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
          >
            Agregar
          </button>
        </div>
      </form>
    </div>
  )
}
