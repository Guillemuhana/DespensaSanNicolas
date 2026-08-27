import { useEffect, useRef, useState } from 'react'
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../lib/queries'

const emptyForm = {
  name: '',
  barcode: '',
  sale_type: 'unit',
  price: '',
  cost: '',
  stock: '',
  min_stock: '',
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

export default function Stock() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(null)
  const formRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setProducts(await fetchProducts())
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  function startEdit(p) {
    setEditingId(p.id)
    // En mobile el formulario queda debajo de la lista, así que lo traemos.
    if (window.matchMedia('(max-width: 767px)').matches) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      sale_type: p.sale_type,
      price: p.price,
      cost: p.cost ?? '',
      stock: p.stock,
      min_stock: p.min_stock,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      sale_type: form.sale_type,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
    }
    try {
      if (editingId) {
        await updateProduct(editingId, payload)
      } else {
        await createProduct(payload)
      }
      resetForm()
      load()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function handleDelete(id) {
    try {
      await deleteProduct(id)
      load()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
  )
  const lowCount = products.filter((p) => Number(p.stock) <= Number(p.min_stock)).length

  // Margen en vivo mientras se carga el producto.
  const priceNum = Number(form.price)
  const costNum = Number(form.cost)
  const margin =
    priceNum > 0 && costNum > 0
      ? { profit: priceNum - costNum, pct: ((priceNum - costNum) / priceNum) * 100 }
      : null

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-inkfaint/60"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 shadow-card transition-colors focus:border-awning focus:outline-none"
            />
          </div>
          {lowCount > 0 && (
            <span className="whitespace-nowrap rounded-full border border-brick-100 bg-brick-50 px-3 py-1.5 text-xs font-semibold text-brick-dark">
              {lowCount} con stock bajo
            </span>
          )}
        </div>

        {status && (
          <div className="mb-4 rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
            {status.text}
          </div>
        )}

        {/* En el teléfono una tabla de 4 columnas no entra: van tarjetas. */}
        <ul className="space-y-2 md:hidden">
          {filtered.map((p) => {
            const low = Number(p.stock) <= Number(p.min_stock)
            return (
              <li key={p.id} className="rounded-xl border border-line bg-surface p-3 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink">{p.name}</p>
                    <p className="font-mono text-xs text-inkfaint">{p.barcode || 'sin código'}</p>
                  </div>
                  <p className="shrink-0 font-mono tabular font-semibold text-ink">
                    ${Number(p.price).toLocaleString('es-AR')}
                    {p.sale_type === 'weight' ? ' /kg' : ''}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${
                      low ? 'bg-brick-50 text-brick-dark' : 'bg-paper2 text-inkfaint'
                    }`}
                  >
                    {Number(p.stock).toLocaleString('es-AR', { maximumFractionDigits: 3 })}
                    {p.sale_type === 'weight' ? ' kg' : ' un.'}
                    {low ? ' · bajo' : ''}
                  </span>
                  <span className="flex shrink-0 gap-4">
                    <button
                      onClick={() => startEdit(p)}
                      className="py-1 text-sm font-semibold text-awning"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="py-1 text-sm font-semibold text-brick"
                    >
                      Borrar
                    </button>
                  </span>
                </div>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-inkfaint">
              No hay productos que coincidan.
            </li>
          )}
        </ul>

        <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper2/60 text-left">
                <th className="eyebrow px-5 py-3 font-medium text-inkfaint">Producto</th>
                <th className="eyebrow px-5 py-3 font-medium text-inkfaint">Precio</th>
                <th className="eyebrow px-5 py-3 font-medium text-inkfaint">Margen</th>
                <th className="eyebrow px-5 py-3 font-medium text-inkfaint">Stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {filtered.map((p) => {
                const low = Number(p.stock) <= Number(p.min_stock)
                return (
                  <tr key={p.id} className="group transition-colors hover:bg-paper2/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="font-mono text-xs text-inkfaint">{p.barcode || 'sin código'}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono tabular font-medium">
                      ${Number(p.price).toLocaleString('es-AR')}
                      {p.sale_type === 'weight' ? (
                        <span className="text-xs font-normal text-inkfaint"> /kg</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono tabular text-sm">
                      {Number(p.cost) > 0 ? (
                        <span className="font-semibold text-awning-dark">
                          {(((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-inkfaint/50">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono tabular text-xs font-semibold ${
                          low ? 'bg-brick-50 text-brick-dark' : 'bg-paper2 text-inkfaint'
                        }`}
                      >
                        {Number(p.stock).toLocaleString('es-AR', { maximumFractionDigits: 3 })}
                        {p.sale_type === 'weight' ? ' kg' : ' un.'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <button
                        onClick={() => startEdit(p)}
                        className="mr-3 text-sm font-semibold text-awning hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-sm font-semibold text-brick hover:underline"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-inkfaint">
                    No hay productos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        ref={formRef}
        className="h-fit scroll-mt-24 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
      >
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          {editingId ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="prod-name" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Nombre
            </label>
            <input
              id="prod-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="prod-barcode" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Código de barras
            </label>
            <input
              id="prod-barcode"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Se vende por</label>
            <div className="flex gap-1 rounded-lg bg-paper2 p-1">
              {[
                { id: 'unit', label: 'Unidad' },
                { id: 'weight', label: 'Peso (kg)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm({ ...form, sale_type: opt.id })}
                  className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-all ${
                    form.sale_type === opt.id
                      ? 'bg-surface text-ink shadow-card'
                      : 'text-inkfaint hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-price" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Precio {form.sale_type === 'weight' ? '/kg' : ''}
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                id="prod-price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
            <div>
              <label htmlFor="prod-stock" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Stock {form.sale_type === 'weight' ? '(kg)' : '(un.)'}
              </label>
              <input
                required
                type="number"
                step="0.001"
                min="0"
                id="prod-stock"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="prod-cost" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Costo de compra {form.sale_type === 'weight' ? '/kg' : ''}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              id="prod-cost"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className={`${inputClass} font-mono tabular`}
            />
            {margin !== null && (
              <p className="mt-1.5 text-xs text-inkfaint">
                Ganás{' '}
                <span className="font-mono tabular font-semibold text-ink">
                  ${margin.profit.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </span>{' '}
                por {form.sale_type === 'weight' ? 'kilo' : 'unidad'} ·{' '}
                <span
                  className={`font-semibold ${margin.pct >= 0 ? 'text-awning' : 'text-brick'}`}
                >
                  {margin.pct.toFixed(0)}% de margen
                </span>
              </p>
            )}
          </div>
          <div>
            <label htmlFor="prod-min" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Aviso de stock bajo
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              id="prod-min"
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              className={`${inputClass} font-mono tabular`}
            />
          </div>
          <div className="flex gap-2 pt-1">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-lg border border-line py-2.5 font-semibold text-inkfaint transition-colors hover:bg-paper2"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 rounded-lg bg-awning py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
            >
              {editingId ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
