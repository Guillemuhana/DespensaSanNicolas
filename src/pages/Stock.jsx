import { useEffect, useState } from 'react'
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../lib/queries'

const emptyForm = { name: '', barcode: '', sale_type: 'unit', price: '', stock: '', min_stock: '' }

export default function Stock() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(null)

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
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      sale_type: p.sale_type,
      price: p.price,
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
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
  )

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full border border-paper2 rounded-md px-4 py-2.5 mb-4 bg-white focus:border-awning"
        />

        {status && (
          <div className="rounded-md px-4 py-3 text-sm font-medium mb-4 bg-brick-light/30 text-brick-dark">
            {status.text}
          </div>
        )}

        <div className="bg-white border border-paper2 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper2/60 text-inkfaint text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Producto</th>
                <th className="px-4 py-2 font-medium">Precio</th>
                <th className="px-4 py-2 font-medium">Stock</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper2">
              {filtered.map((p) => {
                const low = Number(p.stock) <= Number(p.min_stock)
                return (
                  <tr key={p.id} className="hover:bg-paper2/40">
                    <td className="px-4 py-2.5">
                      <p className="text-ink font-medium">{p.name}</p>
                      <p className="text-inkfaint text-xs font-mono">{p.barcode || 'sin código'}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular">
                      ${Number(p.price).toLocaleString('es-AR')}
                      {p.sale_type === 'weight' ? ' /kg' : ''}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular">
                      <span className={low ? 'text-brick font-semibold' : ''}>
                        {Number(p.stock).toLocaleString('es-AR', { maximumFractionDigits: 3 })}
                        {p.sale_type === 'weight' ? ' kg' : ' un.'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-awning hover:underline text-sm mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-brick hover:underline text-sm"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-inkfaint">
                    No hay productos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-paper2 rounded-md p-5 h-fit">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">
          {editingId ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-inkfaint mb-1">Nombre</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-paper2 rounded-md px-3 py-2 focus:border-awning"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-inkfaint mb-1">Código de barras</label>
            <input
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="w-full border border-paper2 rounded-md px-3 py-2 font-mono focus:border-awning"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-inkfaint mb-1">Se vende por</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, sale_type: 'unit' })}
                className={`flex-1 py-2 rounded-md border text-sm font-medium ${
                  form.sale_type === 'unit' ? 'bg-awning text-white border-awning' : 'border-paper2 text-inkfaint'
                }`}
              >
                Unidad
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, sale_type: 'weight' })}
                className={`flex-1 py-2 rounded-md border text-sm font-medium ${
                  form.sale_type === 'weight' ? 'bg-awning text-white border-awning' : 'border-paper2 text-inkfaint'
                }`}
              >
                Peso (kg)
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-inkfaint mb-1">
                Precio {form.sale_type === 'weight' ? '/kg' : ''}
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-paper2 rounded-md px-3 py-2 font-mono focus:border-awning"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-inkfaint mb-1">
                Stock {form.sale_type === 'weight' ? '(kg)' : '(un.)'}
              </label>
              <input
                required
                type="number"
                step="0.001"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full border border-paper2 rounded-md px-3 py-2 font-mono focus:border-awning"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-inkfaint mb-1">Aviso de stock bajo</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              className="w-full border border-paper2 rounded-md px-3 py-2 font-mono focus:border-awning"
            />
          </div>
          <div className="flex gap-2 pt-1">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 rounded-md border border-paper2 text-inkfaint font-medium hover:bg-paper2"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-md bg-awning text-white font-medium hover:bg-awning-dark"
            >
              {editingId ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
