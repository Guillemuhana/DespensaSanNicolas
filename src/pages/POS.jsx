import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchProducts,
  findProductByBarcode,
  fetchCustomers,
  createSale,
  createCustomer,
  createProduct,
} from '../lib/queries'
import Receipt from '../components/Receipt'
import PaymentModal from '../components/PaymentModal'
import QuickProductModal from '../components/QuickProductModal'
import TicketPrint from '../components/TicketPrint'
import { printTicket } from '../lib/print'
import useBarcodeScanner from '../lib/useBarcodeScanner'
import CameraScanner from '../components/CameraScanner'
import { CATEGORIES } from '../lib/categories'
import { cameraAvailable } from '../lib/camera'
import { Camera, ChevronDown, Plus, Printer, ScanBarcode } from 'lucide-react'

export default function POS() {
  const [barcode, setBarcode] = useState('')
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'error'|'success', text }
  const [lastSale, setLastSale] = useState(null)
  // Código escaneado que no está en la base: se ofrece darlo de alta al toque.
  const [unknownCode, setUnknownCode] = useState(null)
  const [quickProduct, setQuickProduct] = useState(null) // { barcode } | null
  // El catálogo completo arranca plegado: en el mostrador manda el escáner.
  const [showCatalog, setShowCatalog] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [cameraHint, setCameraHint] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    loadData()
    inputRef.current?.focus()
  }, [])

  // El lector sigue funcionando aunque el foco se haya ido del campo, salvo
  // que haya un modal abierto: ahí el escaneo no debe agregar nada por detrás.
  useBarcodeScanner(processCode, {
    enabled: !showPayment && !quickProduct && !showCamera,
  })

  async function loadData() {
    try {
      const [p, c] = await Promise.all([fetchProducts(), fetchCustomers()])
      setProducts(p)
      setCustomers(c)
    } catch (err) {
      setStatus({ type: 'error', text: 'No se pudo cargar productos/clientes: ' + err.message })
    }
  }

  const total = items.reduce((sum, it) => sum + it.subtotal, 0)

  function addUnitItem(product) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === product.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].quantity + 1,
          subtotal: (copy[idx].quantity + 1) * product.price,
          cost: Number(product.cost) || 0,
        }
        return copy
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
          cost: Number(product.cost) || 0,
          subtotal: product.price,
        },
      ]
    })
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // +/- en el ticket: llegar a cero saca la línea.
  function changeQty(idx, delta) {
    setItems((prev) => {
      const it = prev[idx]
      if (!it) return prev
      const next = it.quantity + delta
      if (next <= 0) return prev.filter((_, i) => i !== idx)
      return prev.map((row, i) =>
        i === idx ? { ...row, quantity: next, subtotal: next * row.price } : row
      )
    })
  }

  function handleScan(e) {
    e.preventDefault()
    const code = barcode.trim()
    if (!code) return
    processCode(code)
  }

  // Un mismo camino para el lector de pistola, la cámara y lo escrito a mano.
  // Devuelve qué pasó, así la cámara sabe si puede seguir escaneando.
  async function processCode(code) {
    setStatus(null)
    setUnknownCode(null)
    try {
      let product = products.find((p) => p.barcode === code)
      if (!product) product = await findProductByBarcode(code)
      if (!product) {
        // Enter sobre un nombre escrito a mano: si hay una sola coincidencia la
        // cargamos derecho, y si hay varias avisamos para que elijan.
        const matches = matchProducts(products, code)
        if (matches.length === 1) return pickProduct(matches[0])
        if (matches.length > 1) {
          setStatus({
            type: 'success',
            text: `Hay ${matches.length} productos que coinciden: tocá el que va.`,
          })
          return { outcome: 'multiple' }
        }
        setUnknownCode(code)
        setStatus({ type: 'error', text: `No hay ningún producto con el código "${code}".` })
        setBarcode('')
        return { outcome: 'unknown' }
      }
      setBarcode('')
      return addProduct(product)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
      return { outcome: 'error' }
    }
  }

  // Lo manda derecho al ticket.
  function addProduct(p) {
    if (Number(p.stock) <= 0) {
      setStatus({ type: 'error', text: `"${p.name}" no tiene stock.` })
      return { outcome: 'nostock', name: p.name }
    }
    addUnitItem(p)
    return { outcome: 'added', name: p.name }
  }

  // La cámara queda abierta mientras se sigan agregando cosas al ticket;
  // cualquier otra cosa (sin stock, código nuevo) necesita la pantalla.
  async function handleCameraScan(code) {
    const res = await processCode(code)
    if (res?.outcome === 'added') {
      setCameraHint(`Listo: ${res.name}. Seguí con el próximo.`)
      return
    }
    closeCamera()
  }

  function openCamera() {
    setCameraHint(null)
    setShowCamera(true)
  }

  function closeCamera() {
    setShowCamera(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Alta al vuelo: el producto queda cargado y entra al ticket sin salir de acá.
  async function handleQuickCreate(payload) {
    const product = await createProduct(payload)
    setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setQuickProduct(null)
    setUnknownCode(null)
    setBarcode('')
    addUnitItem(product)
    setStatus({ type: 'success', text: `"${product.name}" quedó cargado y va en el ticket.` })
    inputRef.current?.focus()
  }

  async function handleConfirmPayment(payment) {
    try {
      const sale = await createSale({
        items,
        paymentMethod: payment.paymentMethod,
        customerId: payment.customerId,
        total,
        paidAmount: payment.paidAmount,
        changeDue: payment.changeDue,
      })
      setLastSale({
        ...sale,
        changeDue: payment.changeDue,
        items,
        customerName: customers.find((c) => c.id === payment.customerId)?.name ?? null,
      })
      setItems([])
      setShowPayment(false)
      setStatus({ type: 'success', text: 'Venta cobrada.' })
      loadData()
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (err) {
      setStatus({ type: 'error', text: 'No se pudo cobrar: ' + err.message })
    }
  }

  async function handleNewCustomer(name) {
    if (!name.trim()) return
    try {
      const c = await createCustomer({ name: name.trim() })
      setCustomers((prev) => [...prev, c])
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  const query = barcode.trim()
  const results = useMemo(() => matchProducts(products, query), [products, query])
  // Mientras se escribe se ven los resultados; con el campo vacío el catálogo
  // aparece sólo si lo despliegan.
  const listOpen = query.length > 0 || showCatalog
  // Buscar por texto pisa el filtro de rubro: si escribieron algo, mandan los
  // resultados. Los chips sólo tienen sentido sobre el catálogo desplegado.
  const shownProducts = query
    ? results
    : catFilter
      ? products.filter((p) => p.category === catFilter)
      : products
  // Sólo se ofrecen los rubros que hoy tienen algo cargado.
  const usedCategories = useMemo(
    () => CATEGORIES.filter((c) => products.some((p) => p.category === c.id)),
    [products]
  )

  // Tocar una fila hace lo mismo que escanear el código de ese producto.
  function pickProduct(p) {
    setStatus(null)
    setUnknownCode(null)
    const res = addProduct(p)
    setBarcode('')
    inputRef.current?.focus()
    return res
  }

  return (
    // En el teléfono el orden es: buscador → ticket → productos, y el botón de
    // cobrar queda fijo al pie de la pantalla (por eso el padding de abajo).
    // En escritorio son dos columnas y el ticket queda pegado al scroll.
    <div className="grid gap-4 pb-24 lg:grid-cols-[1fr_400px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-6 lg:pb-0">
      <div className="order-1 flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        <form onSubmit={handleScan}>
          <div className="mb-2 flex items-end justify-between gap-3">
            <label htmlFor="scan" className="eyebrow text-inkfaint block">
              Escanear o buscar
            </label>
            <button
              type="button"
              onClick={() => setQuickProduct({ barcode: '' })}
              className="flex items-center gap-1.5 text-xs font-semibold text-inkfaint transition-colors hover:text-awning"
            >
              <Plus size={14} strokeWidth={2.6} />
              Producto nuevo
            </button>
          </div>
          <div className="flex gap-2">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-inkfaint/60"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M3 6V5a2 2 0 0 1 2-2h1M21 6V5a2 2 0 0 0-2-2h-1M3 18v1a2 2 0 0 0 2 2h1M21 18v1a2 2 0 0 1-2 2h-1" />
                <path d="M7 8v8M10.5 8v8M14 8v8M17 8v8" />
              </svg>
            </span>
            <input
              id="scan"
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value)
                setUnknownCode(null)
              }}
              placeholder="Pasá el código o escribí el nombre"
              className="w-full rounded-xl border border-line bg-surface py-3.5 pl-12 pr-4 font-mono text-lg shadow-card transition-shadow placeholder:font-body placeholder:text-inkfaint/50 focus:border-awning focus:shadow-lift focus:outline-none sm:py-4 sm:text-xl"
              autoComplete="off"
            />
          </div>
            {cameraAvailable && (
              <button
                type="button"
                onClick={openCamera}
                aria-label="Escanear con la cámara del celular"
                className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-surface px-4 text-inkfaint shadow-card transition-colors hover:border-awning hover:text-awning"
              >
                <Camera size={22} strokeWidth={2} />
              </button>
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-inkfaint">
            <ScanBarcode size={13} strokeWidth={2.2} className="shrink-0" />
            El lector anda aunque el cursor no esté acá
            {cameraAvailable ? ', o escaneá con la cámara.' : '.'}
          </p>
        </form>

        {status && (
          <div
            role="status"
            className={`animate-rise rounded-xl border px-4 py-3 text-sm font-medium ${
              status.type === 'error'
                ? 'border-brick-100 bg-brick-50 text-brick-dark'
                : 'border-awning-100 bg-awning-50 text-awning-dark'
            }`}
          >
            <p>{status.text}</p>
            {unknownCode && (
              <button
                onClick={() => setQuickProduct({ barcode: unknownCode })}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-brick px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brick-dark"
              >
                <ScanBarcode size={14} strokeWidth={2.4} />
                Cargar producto con este código
              </button>
            )}
          </div>
        )}

        {lastSale && (
          <div className="animate-rise flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-card">
            <span className="eyebrow text-inkfaint">Última venta</span>
            <span className="font-mono tabular font-semibold text-ink">
              ${lastSale.total.toLocaleString('es-AR')}
            </span>
            {lastSale.changeDue > 0 && (
              <span className="text-inkfaint">
                vuelto{' '}
                <span className="font-mono tabular font-semibold text-awning">
                  ${lastSale.changeDue.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </span>
              </span>
            )}
            <button
              onClick={printTicket}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning"
            >
              <Printer size={14} strokeWidth={2.2} />
              Imprimir ticket
            </button>
          </div>
        )}
      </div>

      {/* El catálogo va plegado y en filas finas: lo que manda es el ticket.
          Sirve sobre todo para lo que no tiene código de barras. */}
      <div className="order-3 min-h-0 lg:order-none lg:col-start-1 lg:row-start-2">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-inkfaint">
            {query ? `Resultados (${results.length})` : 'Productos'}
          </p>
          {!query && products.length > 0 && (
            <button
              onClick={() => setShowCatalog((v) => !v)}
              aria-expanded={showCatalog}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-inkfaint shadow-card transition-colors hover:border-awning hover:text-awning"
            >
              {showCatalog ? 'Ocultar' : `Ver los ${products.length}`}
              <ChevronDown
                size={14}
                strokeWidth={2.6}
                className={`transition-transform ${showCatalog ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {showCatalog && !query && usedCategories.length > 0 && (
          <div className="scroll-soft mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setCatFilter('')}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                catFilter === ''
                  ? 'border-awning bg-awning text-white'
                  : 'border-line bg-surface text-inkfaint hover:border-awning hover:text-awning'
              }`}
            >
              Todos
            </button>
            {usedCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatFilter(catFilter === c.id ? '' : c.id)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  catFilter === c.id
                    ? 'border-awning bg-awning text-white'
                    : 'border-line bg-surface text-inkfaint hover:border-awning hover:text-awning'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {listOpen && (
          <div className="mt-2">
            {shownProducts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-sm text-inkfaint">
                {query
                  ? 'Ningún producto coincide con la búsqueda.'
                  : catFilter
                    ? 'No hay productos en ese rubro.'
                    : 'Todavía no hay productos cargados. Agregalos desde la pestaña Stock.'}
              </p>
            ) : (
              <ul className="scroll-soft max-h-[21rem] divide-y divide-line/70 overflow-y-auto rounded-xl border border-line bg-surface shadow-card lg:max-h-[calc(100vh-23rem)]">
                {shownProducts.map((p) => {
                  const out = Number(p.stock) <= 0
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => pickProduct(p)}
                        disabled={out}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-awning-50/60 disabled:pointer-events-none disabled:opacity-45"
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium leading-tight text-ink">
                            {p.name}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-inkfaint">
                            {p.barcode || 'sin código'}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono tabular text-sm font-semibold text-ink">
                          ${Number(p.price).toLocaleString('es-AR')}
                        </span>
                        <span
                          className={`w-[4.5rem] shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[11px] font-semibold ${
                            out ? 'bg-brick-50 text-brick-dark' : 'bg-paper2 text-inkfaint'
                          }`}
                        >
                          {out ? 'sin st.' : `${Number(p.stock).toLocaleString('es-AR')} un.`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <div className="flex flex-col gap-3 lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)]">
          <div className="min-h-[320px] lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            <Receipt items={items} onRemove={removeItem} onChangeQty={changeQty} total={total} />
          </div>
          {/* Fijo al pie en el teléfono; parte de la columna en escritorio. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm lg:static lg:shrink-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <button
              onClick={() => setShowPayment(true)}
              disabled={items.length === 0}
              className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-xl bg-brick px-6 py-4 text-white shadow-pay transition-all duration-150 hover:bg-brick-dark active:translate-y-px disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
            >
              <span className="font-display text-lg font-semibold sm:text-xl">Cobrar</span>
              <span className="font-mono tabular text-xl font-bold sm:text-2xl">
                ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
            </button>
          </div>
        </div>
      </div>


      <TicketPrint sale={lastSale} />

      {showCamera && (
        <CameraScanner
          title="Escanear productos"
          hint={cameraHint}
          onDetect={handleCameraScan}
          onClose={closeCamera}
        />
      )}

      {quickProduct && (
        <QuickProductModal
          barcode={quickProduct.barcode}
          onCreate={handleQuickCreate}
          onCancel={() => setQuickProduct(null)}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          customers={customers}
          onConfirm={handleConfirmPayment}
          onCancel={() => setShowPayment(false)}
          onNewCustomer={handleNewCustomer}
        />
      )}
    </div>
  )
}

function matchProducts(products, query) {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.barcode?.includes(query.trim())
  )
}
