import { useEffect, useRef, useState } from 'react'
import { GROUPED } from '../lib/categories'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

/**
 * Alta rápida desde el mostrador: se escaneó un código que no está cargado,
 * así que se crea el producto con lo mínimo (nombre, precio y stock) sin salir
 * de Facturación. Lo demás —costo, proveedor, aviso de stock bajo— se completa
 * después desde Stock.
 */
export default function QuickProductModal({ barcode, onCreate, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    category: '',
    sale_type: 'unit',
    price: '',
    stock: '',
    cost: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const priceNum = Number(form.price) || 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || priceNum <= 0) return
    setBusy(true)
    setError(null)
    try {
      await onCreate({
        name: form.name.trim(),
        barcode: barcode || null,
        category: form.category || null,
        sale_type: form.sale_type,
        price: priceNum,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        min_stock: 0,
        supplier_id: null,
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-rise my-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6"
      >
        <p className="eyebrow text-awning">Producto nuevo</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">
          {barcode ? 'Código sin cargar' : 'Carga manual'}
        </h2>
        {barcode ? (
          <p className="mt-1 break-all font-mono text-sm text-inkfaint">{barcode}</p>
        ) : (
          <p className="mt-1 text-sm text-inkfaint">
            Para lo que no tiene código de barras: se busca por nombre.
          </p>
        )}

        <div className="mt-5 space-y-3.5">
          <div>
            <label htmlFor="quick-name" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Nombre
            </label>
            <input
              id="quick-name"
              ref={nameRef}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Camisa lino blanca S"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="quick-category" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Rubro <span className="font-normal">(opcional)</span>
            </label>
            <select
              id="quick-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              {GROUPED.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-price" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Precio
              </label>
              <input
                id="quick-price"
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
            <div>
              <label htmlFor="quick-stock" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Stock (un.)
              </label>
              <input
                id="quick-stock"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="0"
                className={`${inputClass} font-mono tabular`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="quick-cost" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Costo de compra <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="quick-cost"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className={`${inputClass} font-mono tabular`}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-sm font-medium text-brick-dark">
            {error}
          </p>
        )}

        <p className="mt-3 text-xs text-inkfaint">
          Se agrega al ticket apenas lo guardes. El resto de los datos los completás desde Stock.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-3 font-semibold text-inkfaint transition-colors hover:bg-paper2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !form.name.trim() || priceNum <= 0}
            className="flex-1 rounded-xl bg-awning py-3 font-semibold text-white shadow-card transition-all hover:bg-awning-dark active:translate-y-px disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
          >
            {busy ? 'Guardando...' : 'Guardar y agregar'}
          </button>
        </div>
      </form>
    </div>
  )
}
