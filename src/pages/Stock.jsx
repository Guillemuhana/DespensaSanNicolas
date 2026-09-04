import { useEffect, useRef, useState } from 'react'
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchSuppliers,
  uploadProductPhoto,
  schema,
} from '../lib/queries'
import { resizeImage } from '../lib/image'
import RestockModal from '../components/RestockModal'
import CameraScanner from '../components/CameraScanner'
import { cameraAvailable } from '../lib/camera'
import { Camera, ImagePlus, ScanBarcode, X } from 'lucide-react'
import { CATEGORIES, labelOf } from '../lib/categories'

const emptyForm = {
  name: '',
  barcode: '',
  category: '',
  sale_type: 'unit',
  price: '',
  cost: '',
  stock: '',
  min_stock: '',
  supplier_id: '',
  image_url: '',
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

export default function Stock() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [restocking, setRestocking] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const formRef = useRef(null)
  const barcodeRef = useRef(null)
  const photoRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setProducts(await fetchProducts())
      // Si todavía no se corrió la migración 003 la tabla no existe: el
      // selector de proveedor simplemente no se muestra.
      setSuppliers(await fetchSuppliers().catch(() => []))
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
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

  function startEdit(p) {
    setEditingId(p.id)
    // En mobile el formulario queda debajo de la lista, así que lo traemos.
    if (window.matchMedia('(max-width: 767px)').matches) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category || '',
      sale_type: p.sale_type,
      price: p.price,
      cost: p.cost ?? '',
      stock: p.stock,
      min_stock: p.min_stock,
      supplier_id: p.supplier_id || '',
      image_url: p.image_url || '',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  // Alta nueva: el foco arranca en el código para pasarle el lector de una.
  function startNew() {
    resetForm()
    setStatus(null)
    if (window.matchMedia('(max-width: 767px)').matches) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTimeout(() => barcodeRef.current?.focus(), 60)
  }

  // Código interno para lo que no viene con código de barras impreso (sueltos,
  // fraccionado, verdulería): así todo producto se puede buscar por código.
  function generateInternalCode() {
    const used = products
      .map((p) => Number(p.barcode?.match(/^INT-(\d+)$/)?.[1]))
      .filter((n) => Number.isFinite(n))
    const next = (used.length > 0 ? Math.max(...used) : 0) + 1
    setForm((f) => ({ ...f, barcode: `INT-${String(next).padStart(4, '0')}` }))
  }

  // En el celular esto abre la cámara directo; en la compu, el explorador.
  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setStatus(null)
    try {
      const blob = await resizeImage(file)
      const url = await uploadProductPhoto(blob)
      setForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      setStatus({ type: 'error', text: 'No se pudo subir la foto: ' + err.message })
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    if (duplicate) {
      setStatus({ type: 'error', text: `Ese código ya lo usa "${duplicate.name}".` })
      return
    }
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      category: form.category || null,
      sale_type: form.sale_type,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      supplier_id: form.supplier_id || null,
      image_url: form.image_url || null,
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
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)) &&
      (!category || p.category === category)
  )
  const lowCount = products.filter((p) => Number(p.stock) <= Number(p.min_stock)).length
  const noCodeCount = products.filter((p) => !p.barcode).length

  // Dos productos con el mismo código romperían el escaneo: se avisa antes.
  const barcodeValue = form.barcode.trim()
  const duplicate = barcodeValue
    ? products.find((p) => p.barcode === barcodeValue && p.id !== editingId)
    : null

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
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filtrar por rubro"
            className={`whitespace-nowrap rounded-xl border bg-surface px-3 py-2.5 text-sm font-semibold shadow-card transition-colors focus:border-awning focus:outline-none ${
              category ? 'border-awning text-awning-dark' : 'border-line text-inkfaint'
            }`}
          >
            <option value="">Todos los rubros</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {lowCount > 0 && (
            <span className="whitespace-nowrap rounded-full border border-brick-100 bg-brick-50 px-3 py-1.5 text-xs font-semibold text-brick-dark">
              {lowCount} con stock bajo
            </span>
          )}
          {noCodeCount > 0 && (
            <span className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-inkfaint">
              {noCodeCount} sin código
            </span>
          )}
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-awning px-3 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-awning-dark md:hidden"
          >
            <ScanBarcode size={16} strokeWidth={2.4} />
            Cargar producto
          </button>
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
                  <div className="flex min-w-0 items-start gap-2.5">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="break-words font-medium text-ink">{p.name}</p>
                      <p className="font-mono text-xs text-inkfaint">{p.barcode || 'sin código'}</p>
                      {p.category && (
                        <p className="mt-0.5 text-xs text-awning-dark">{labelOf(p.category)}</p>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 font-mono tabular font-semibold text-ink">
                    ${Number(p.price).toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${
                      low ? 'bg-brick-50 text-brick-dark' : 'bg-paper2 text-inkfaint'
                    }`}
                  >
                    {Number(p.stock).toLocaleString('es-AR')} un.
                    {low ? ' · bajo' : ''}
                  </span>
                  <span className="flex shrink-0 gap-4">
                    <button
                      onClick={() => setRestocking(p)}
                      className="py-1 text-sm font-semibold text-awning"
                    >
                      Reponer
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="py-1 text-sm font-semibold text-inkfaint"
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
                      <div className="flex items-center gap-3">
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{p.name}</p>
                          <p className="font-mono text-xs text-inkfaint">
                            {p.barcode || 'sin código'}
                            {p.category && (
                              <span className="ml-2 font-body text-awning-dark">
                                {labelOf(p.category)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono tabular font-medium">
                      ${Number(p.price).toLocaleString('es-AR')}
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
                        {Number(p.stock).toLocaleString('es-AR')} un.
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <button
                        onClick={() => setRestocking(p)}
                        className="mr-3 text-sm font-semibold text-awning hover:underline"
                      >
                        Reponer
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="mr-3 text-sm font-semibold text-inkfaint hover:underline"
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
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            {editingId ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button
            type="button"
            onClick={startNew}
            className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning md:flex"
          >
            <ScanBarcode size={14} strokeWidth={2.4} />
            Escanear
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {schema.photos && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-inkfaint">Foto</label>
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper2">
                  {form.image_url ? (
                    <>
                      <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: '' })}
                        aria-label="Quitar la foto"
                        className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white transition-colors hover:bg-ink"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    </>
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-inkfaint/40">
                      <ImagePlus size={22} strokeWidth={1.8} />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    disabled={photoBusy}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning disabled:opacity-60"
                  >
                    <Camera size={16} strokeWidth={2.2} />
                    {photoBusy ? 'Subiendo...' : form.image_url ? 'Cambiar foto' : 'Sacar foto'}
                  </button>
                  <p className="mt-1.5 text-xs text-inkfaint">
                    Desde el celular abre la cámara.
                  </p>
                </div>
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                className="hidden"
              />
            </div>
          )}
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
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="prod-barcode" className="block text-xs font-semibold text-inkfaint">
                Código
              </label>
              <button
                type="button"
                onClick={generateInternalCode}
                className="text-xs font-semibold text-awning transition-colors hover:text-awning-dark"
              >
                Generar código interno
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint/50"
                >
                  <ScanBarcode size={16} strokeWidth={2} />
                </span>
                <input
                  id="prod-barcode"
                  ref={barcodeRef}
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Pasá el lector acá"
                  onKeyDown={(e) => {
                    // El lector manda Enter al final: no queremos que eso guarde
                    // el producto a medio cargar.
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                  className={`${inputClass} pl-9 font-mono ${
                    duplicate ? 'border-brick focus:border-brick' : ''
                  }`}
                />
              </div>
              {cameraAvailable && (
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  aria-label="Leer el código con la cámara"
                  className="flex shrink-0 items-center justify-center rounded-lg border border-line px-3 text-inkfaint transition-colors hover:border-awning hover:text-awning"
                >
                  <Camera size={18} strokeWidth={2} />
                </button>
              )}
            </div>
            {duplicate ? (
              <p className="mt-1.5 text-xs font-medium text-brick-dark">
                Ese código ya lo usa &ldquo;{duplicate.name}&rdquo;.{' '}
                <button
                  type="button"
                  onClick={() => startEdit(duplicate)}
                  className="font-semibold underline"
                >
                  Editar ese producto
                </button>
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-inkfaint">
                Con el cursor en este campo, escaneá el producto y el código se
                completa solo. Si no tiene, generá uno interno.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-price" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                Precio
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
                Stock (un.)
              </label>
              <input
                required
                type="number"
                step="1"
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
              Costo de compra
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
                por unidad ·{' '}
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
          <div>
            <label
              htmlFor="prod-category"
              className="mb-1.5 block text-xs font-semibold text-inkfaint"
            >
              Rubro
            </label>
            <select
              id="prod-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {suppliers.length > 0 && (
            <div>
              <label
                htmlFor="prod-supplier"
                className="mb-1.5 block text-xs font-semibold text-inkfaint"
              >
                Proveedor
              </label>
              <select
                id="prod-supplier"
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              disabled={!!duplicate}
              className="flex-1 rounded-lg bg-awning py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
            >
              {editingId ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>

      {showCamera && (
        <CameraScanner
          title="Leer el código del producto"
          hint="Apuntá al código de barras del envase. Se copia solo al formulario."
          onDetect={(code) => {
            setForm((f) => ({ ...f, barcode: code }))
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {restocking && (
        <RestockModal
          product={restocking}
          suppliers={suppliers}
          canCost={schema.costs}
          onConfirm={handleRestock}
          onCancel={() => setRestocking(null)}
        />
      )}
    </div>
  )
}
