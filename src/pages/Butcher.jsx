import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Plus, Search, Trash2 } from 'lucide-react'
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  fetchSaleItemsSince,
  fetchSuppliers,
  schema,
  updateProduct,
} from '../lib/queries'
import { BUTCHER_CATEGORIES, isButcherCategory, labelOf } from '../lib/categories'
import { friendlyError } from '../lib/friendlyError'
import RestockModal from '../components/RestockModal'
import InvoiceImport from '../components/InvoiceImport'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

const emptyForm = {
  name: '',
  category: BUTCHER_CATEGORIES[0].id,
  sale_type: 'weight',
  price: '',
  cost: '',
  stock: '',
  min_stock: '',
  supplier_id: '',
}

const money = (n) =>
  '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const qty = (n, weight) =>
  (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: weight ? 3 : 0 }) +
  (weight ? ' kg' : ' un.')

function startOfDay(daysAgo = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

/**
 * Todo lo de la carnicería en un lugar: los cortes con su precio por kilo,
 * lo que hay en la cámara, lo que se vendió, y la entrada del frigorífico.
 * Se vende desde Facturación como cualquier producto; acá se administra.
 */
export default function Butcher() {
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [sold, setSold] = useState({ today: {}, week: {} }) // product_id → { qty, amount }
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [restocking, setRestocking] = useState(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [priceEdit, setPriceEdit] = useState(null) // { id, value }
  const formRef = useRef(null)
  const nameRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [all, sup] = await Promise.all([fetchProducts(), fetchSuppliers().catch(() => [])])
      setAllProducts(all)
      setProducts(all.filter((p) => isButcherCategory(p.category)))
      setSuppliers(sup)
      loadSales()
    } catch (err) {
      setStatus({ type: 'error', text: friendlyError(err.message, 'products') })
    } finally {
      setLoading(false)
    }
  }

  // Lo vendido hoy y en los últimos 7 días, por corte.
  async function loadSales() {
    try {
      const items = await fetchSaleItemsSince(startOfDay(6).toISOString())
      const todayStart = startOfDay(0).getTime()
      const today = {}
      const week = {}
      for (const it of items) {
        if (!it.product_id) continue
        const add = (map) => {
          const row = (map[it.product_id] ||= { qty: 0, amount: 0 })
          row.qty += Number(it.quantity) || 0
          row.amount += Number(it.subtotal) || 0
        }
        add(week)
        if (new Date(it.sales?.created_at).getTime() >= todayStart) add(today)
      }
      setSold({ today, week })
    } catch {
      // Sin las ventas la sección sirve igual.
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) => (!filter || p.category === filter) && (!q || p.name.toLowerCase().includes(q))
    )
  }, [products, filter, search])

  // Agrupados por rubro, en el orden de la lista de rubros.
  const groups = useMemo(
    () =>
      BUTCHER_CATEGORIES.map((c) => ({ ...c, items: shown.filter((p) => p.category === c.id) })).filter(
        (g) => g.items.length > 0
      ),
    [shown]
  )

  const usedCategories = BUTCHER_CATEGORIES.filter((c) => products.some((p) => p.category === c.id))

  const totals = useMemo(() => {
    const sum = (map) =>
      Object.entries(map).reduce(
        (acc, [id, v]) => {
          if (!products.some((p) => p.id === id)) return acc
          return { kg: acc.kg + v.qty, amount: acc.amount + v.amount }
        },
        { kg: 0, amount: 0 }
      )
    const weightStock = products
      .filter((p) => p.sale_type === 'weight')
      .reduce((s, p) => s + (Number(p.stock) || 0), 0)
    const low = products.filter((p) => Number(p.stock) <= Number(p.min_stock)).length
    return { today: sum(sold.today), week: sum(sold.week), weightStock, low }
  }, [products, sold])

  function startNew() {
    setEditingId(null)
    setForm({ ...emptyForm, category: filter || emptyForm.category })
    setStatus(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => nameRef.current?.focus(), 300)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      category: p.category,
      sale_type: p.sale_type,
      price: p.price,
      cost: p.cost ?? '',
      stock: p.stock,
      min_stock: p.min_stock,
      supplier_id: p.supplier_id || '',
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      sale_type: form.sale_type,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      supplier_id: form.supplier_id || null,
    }
    try {
      if (editingId) await updateProduct(editingId, payload)
      else await createProduct({ ...payload, barcode: null })
      setStatus({ type: 'success', text: editingId ? `"${payload.name}" actualizado.` : `"${payload.name}" agregado.` })
      setEditingId(null)
      setForm(emptyForm)
      load()
    } catch (err) {
      setStatus({ type: 'error', text: friendlyError(err.message, 'products') })
    }
  }

  async function handleDelete() {
    const p = products.find((x) => x.id === editingId)
    if (!p || !window.confirm(`¿Borrar "${p.name}"?`)) return
    try {
      await deleteProduct(p.id)
      setEditingId(null)
      setForm(emptyForm)
      load()
    } catch (err) {
      setStatus({ type: 'error', text: friendlyError(err.message, 'products') })
    }
  }

  // El precio del kilo cambia seguido: se toca el precio y se escribe el nuevo.
  async function savePrice() {
    if (!priceEdit) return
    const value = Number(priceEdit.value)
    const p = products.find((x) => x.id === priceEdit.id)
    setPriceEdit(null)
    if (!p || !(value > 0) || value === Number(p.price)) return
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, price: value } : x)))
    try {
      await updateProduct(p.id, { price: value })
    } catch (err) {
      setStatus({ type: 'error', text: 'No se pudo cambiar el precio: ' + err.message })
      load()
    }
  }

  async function handleRestock(patch) {
    try {
      await updateProduct(restocking.id, patch)
      setRestocking(null)
      load()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  const isWeightForm = form.sale_type === 'weight'
  const chip = (active) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'border-awning bg-awning text-white'
        : 'border-line bg-surface text-inkfaint hover:border-awning hover:text-awning'
    }`

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
      <div className="min-w-0">
        {/* Números del día */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Vendido hoy" value={money(totals.today.amount)} sub={`${qty(totals.today.kg, true)}`} />
          <Stat label="Últimos 7 días" value={money(totals.week.amount)} sub={`${qty(totals.week.kg, true)}`} />
          <Stat label="En cámara" value={qty(totals.weightStock, true)} sub={`${products.length} cortes`} />
          <Stat
            label="Para reponer"
            value={String(totals.low)}
            sub={totals.low === 1 ? 'corte con poco stock' : 'cortes con poco stock'}
            alert={totals.low > 0}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-inkfaint/60"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar corte..."
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 shadow-card transition-colors focus:border-awning focus:outline-none"
            />
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-awning px-3.5 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
          >
            <Plus size={16} strokeWidth={2.6} />
            Nuevo corte
          </button>
          <button
            onClick={() => setShowInvoice(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-awning bg-awning-50 px-3.5 py-2.5 text-sm font-semibold text-awning-dark shadow-card transition-colors hover:bg-awning-100"
          >
            <FileText size={16} strokeWidth={2.4} />
            Factura del frigorífico
          </button>
        </div>

        {usedCategories.length > 1 && (
          <div className="scroll-soft mb-4 flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setFilter('')} className={chip(filter === '')}>
              Todo
            </button>
            {usedCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(filter === c.id ? '' : c.id)}
                className={chip(filter === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {status && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
              status.type === 'error'
                ? 'border-brick-100 bg-brick-50 text-brick-dark'
                : 'border-awning-100 bg-awning-50 text-awning-dark'
            }`}
          >
            {status.text}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-paper2/70" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-12 text-center">
            <p className="font-semibold text-ink">Todavía no hay cortes cargados.</p>
            <p className="mt-1 text-sm text-inkfaint">
              Tocá <span className="font-semibold">Nuevo corte</span> o cargá la factura del frigorífico.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-inkfaint">
            Ningún corte coincide con la búsqueda.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-inkfaint">
                  {g.label} · {g.items.length}
                </p>
                <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                  {g.items.map((p) => {
                    const weight = p.sale_type === 'weight'
                    const low = Number(p.stock) <= Number(p.min_stock)
                    const out = Number(p.stock) <= 0
                    const week = sold.week[p.id]
                    const cost = Number(p.cost) || 0
                    const margin = cost > 0 && Number(p.price) > 0 ? ((p.price - cost) / p.price) * 100 : null
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
                        <button onClick={() => startEdit(p)} className="min-w-0 flex-1 text-left">
                          <p className="break-words font-medium text-ink">{p.name}</p>
                          <p className="text-xs text-inkfaint">
                            <span className={out ? 'font-semibold text-brick' : low ? 'font-semibold text-brick-dark' : ''}>
                              {qty(p.stock, weight)} en stock
                            </span>
                            {week && <> · {qty(week.qty, weight)} esta semana</>}
                            {margin !== null && <> · margen {Math.round(margin)}%</>}
                          </p>
                        </button>

                        {priceEdit?.id === p.id ? (
                          <input
                            autoFocus
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={priceEdit.value}
                            onChange={(e) => setPriceEdit({ id: p.id, value: e.target.value })}
                            onBlur={savePrice}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                              if (e.key === 'Escape') setPriceEdit(null)
                            }}
                            className="w-28 rounded-lg border border-awning bg-surface px-2 py-1.5 text-right font-mono text-sm tabular focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setPriceEdit({ id: p.id, value: String(p.price) })}
                            title="Tocá para cambiar el precio"
                            className="rounded-lg px-2 py-1 text-right transition-colors hover:bg-paper2"
                          >
                            <span className="font-mono text-base font-semibold tabular text-ink">{money(p.price)}</span>
                            <span className="text-xs text-inkfaint">{weight ? '/kg' : ' c/u'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => setRestocking(p)}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning"
                        >
                          Entró
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            <p className="text-xs text-inkfaint">
              Tocá el precio para cambiarlo al toque. Los cortes se venden desde Facturación, buscándolos por nombre.
            </p>
          </div>
        )}
      </div>

      {/* Alta y edición de cortes */}
      <div
        ref={formRef}
        className="h-fit scroll-mt-24 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
      >
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          {editingId ? 'Editar corte' : 'Nuevo corte'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="b-name" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Nombre
            </label>
            <input
              id="b-name"
              ref={nameRef}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Asado, Vacío, Milanesa de nalga"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="b-cat" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Rubro
            </label>
            <select
              id="b-cat"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            >
              {BUTCHER_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Se vende por</label>
            <div className="flex gap-1 rounded-lg bg-paper2 p-1">
              {[
                { id: 'weight', label: 'Kilo' },
                { id: 'unit', label: 'Unidad' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm({ ...form, sale_type: opt.id })}
                  className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-all ${
                    form.sale_type === opt.id ? 'bg-surface text-ink shadow-card' : 'text-inkfaint hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="b-price" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Precio {isWeightForm ? '/kg' : 'c/u'}
              </label>
              <input
                id="b-price"
                required
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
            {schema.costs && (
              <div>
                <label htmlFor="b-cost" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                  Costo {isWeightForm ? '/kg' : 'c/u'}
                </label>
                <input
                  id="b-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  className={`${inputClass} font-mono tabular`}
                />
              </div>
            )}
            <div>
              <label htmlFor="b-stock" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Stock {isWeightForm ? '(kg)' : '(un.)'}
              </label>
              <input
                id="b-stock"
                type="number"
                inputMode="decimal"
                min="0"
                step={isWeightForm ? '0.001' : '1'}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
            <div>
              <label htmlFor="b-min" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Avisar debajo de
              </label>
              <input
                id="b-min"
                type="number"
                inputMode="decimal"
                min="0"
                step={isWeightForm ? '0.001' : '1'}
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                className={`${inputClass} font-mono tabular`}
              />
            </div>
          </div>
          {suppliers.length > 0 && (
            <div>
              <label htmlFor="b-sup" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Frigorífico / proveedor
              </label>
              <select
                id="b-sup"
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
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
          <div className="flex gap-2 pt-1">
            {editingId && (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Borrar corte"
                  className="rounded-lg border border-line px-3 text-inkfaint transition-colors hover:border-brick hover:bg-brick-50 hover:text-brick"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setForm(emptyForm)
                  }}
                  className="flex-1 rounded-lg border border-line py-2.5 font-semibold text-inkfaint transition-colors hover:bg-paper2"
                >
                  Cancelar
                </button>
              </>
            )}
            <button
              type="submit"
              className="flex-1 rounded-lg bg-awning py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
            >
              {editingId ? 'Guardar' : 'Agregar'}
            </button>
          </div>
          {editingId && (
            <p className="text-xs text-inkfaint">Rubro actual: {labelOf(form.category)}</p>
          )}
        </form>
      </div>

      {restocking && (
        <RestockModal
          product={restocking}
          suppliers={suppliers}
          canCost={schema.costs}
          onConfirm={handleRestock}
          onCancel={() => setRestocking(null)}
        />
      )}

      {showInvoice && (
        <InvoiceImport
          products={allProducts}
          suppliers={suppliers}
          onClose={() => setShowInvoice(false)}
          onDone={(result) => {
            setShowInvoice(false)
            setStatus({
              type: 'success',
              text: `Factura de ${result.supplier} cargada: ${result.applied.join(' · ')}`,
            })
            load()
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, sub, alert }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 shadow-card">
      <p className="text-xs font-semibold text-inkfaint">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold tabular ${alert ? 'text-brick' : 'text-ink'}`}>{value}</p>
      <p className="text-xs text-inkfaint">{sub}</p>
    </div>
  )
}
