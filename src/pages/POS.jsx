import { useEffect, useRef, useState } from 'react'
import {
  fetchProducts,
  findProductByBarcode,
  fetchCustomers,
  createSale,
  createCustomer,
} from '../lib/queries'
import Receipt from '../components/Receipt'
import WeightEntry from '../components/WeightEntry'
import PaymentModal from '../components/PaymentModal'
import TicketPrint from '../components/TicketPrint'
import { printTicket } from '../lib/print'
import { Printer } from 'lucide-react'

export default function POS() {
  const [barcode, setBarcode] = useState('')
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [pendingWeightProduct, setPendingWeightProduct] = useState(null)
  const [showPayment, setShowPayment] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'error'|'success', text }
  const [lastSale, setLastSale] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    loadData()
    inputRef.current?.focus()
  }, [])

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
      const idx = prev.findIndex((it) => it.id === product.id && it.saleType === 'unit')
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
          saleType: 'unit',
          quantity: 1,
          price: product.price,
          cost: Number(product.cost) || 0,
          subtotal: product.price,
        },
      ]
    })
  }

  function addWeightItem(product, { quantityKg, amount }) {
    setItems((prev) => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        saleType: 'weight',
        quantity: quantityKg,
        price: product.price,
        cost: Number(product.cost) || 0,
        subtotal: amount,
      },
    ])
    setPendingWeightProduct(null)
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleScan(e) {
    e.preventDefault()
    const code = barcode.trim()
    if (!code) return
    setStatus(null)
    try {
      let product = products.find((p) => p.barcode === code)
      if (!product) product = await findProductByBarcode(code)
      if (!product) {
        setStatus({ type: 'error', text: `No hay ningún producto con el código "${code}".` })
        setBarcode('')
        return
      }
      if (product.sale_type === 'weight') {
        setPendingWeightProduct(product)
      } else {
        if (product.stock <= 0) {
          setStatus({ type: 'error', text: `"${product.name}" no tiene stock.` })
        } else {
          addUnitItem(product)
        }
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
    setBarcode('')
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

  const query = barcode.trim().toLowerCase()
  const shownProducts = query
    ? products.filter(
        (p) => p.name.toLowerCase().includes(query) || p.barcode?.includes(barcode.trim())
      )
    : products

  // Tocar una tarjeta hace lo mismo que escanear el código de ese producto.
  function pickProduct(p) {
    setStatus(null)
    if (p.sale_type === 'weight') {
      setPendingWeightProduct(p)
    } else if (Number(p.stock) <= 0) {
      setStatus({ type: 'error', text: `"${p.name}" no tiene stock.` })
    } else {
      addUnitItem(p)
    }
    setBarcode('')
    inputRef.current?.focus()
  }

  return (
    // En el teléfono el orden es: buscador → ticket → productos, y el botón de
    // cobrar queda fijo al pie de la pantalla (por eso el padding de abajo).
    // En escritorio son dos columnas y el ticket queda pegado al scroll.
    <div className="grid gap-4 pb-24 lg:grid-cols-[1fr_400px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-6 lg:pb-0">
      <div className="order-1 flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
        <form onSubmit={handleScan}>
          <label htmlFor="scan" className="eyebrow text-inkfaint block mb-2">
            Código de barras
          </label>
          <div className="relative">
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
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Escaneá o buscá por nombre"
              className="w-full rounded-xl border border-line bg-surface py-3.5 pl-12 pr-4 font-mono text-lg shadow-card transition-shadow placeholder:font-body placeholder:text-inkfaint/50 focus:border-awning focus:shadow-lift focus:outline-none sm:py-4 sm:text-xl"
              autoComplete="off"
            />
          </div>
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
            {status.text}
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

      {/* Con la búsqueda vacía mostramos igual el catálogo entero: en un
          mostrador conviene poder tocar el producto sin escribir nada. */}
      <div className="order-3 min-h-0 lg:order-none lg:col-start-1 lg:row-start-2">
        <div>
          <p className="eyebrow mb-2 text-inkfaint">
            {query ? 'Resultados' : 'Productos'}
          </p>
          {shownProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-10 text-center text-sm text-inkfaint">
              {query
                ? 'Ningún producto coincide con la búsqueda.'
                : 'Todavía no hay productos cargados. Agregalos desde la pestaña Stock.'}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
              {shownProducts.map((p) => {
                const out = p.sale_type === 'unit' && Number(p.stock) <= 0
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => pickProduct(p)}
                      disabled={out}
                      className="h-full w-full rounded-xl border border-line bg-surface p-3 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-awning-200 hover:shadow-lift active:translate-y-0 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <p className="line-clamp-2 min-h-[2.6em] font-medium leading-snug text-ink">
                        {p.name}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <span className="font-mono tabular font-semibold text-ink">
                          ${Number(p.price).toLocaleString('es-AR')}
                          {p.sale_type === 'weight' && (
                            <span className="text-xs font-normal text-inkfaint"> /kg</span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            out
                              ? 'bg-brick-50 text-brick-dark'
                              : p.sale_type === 'weight'
                                ? 'bg-awning-50 text-awning-dark'
                                : 'bg-paper2 text-inkfaint'
                          }`}
                        >
                          {out
                            ? 'sin stock'
                            : p.sale_type === 'weight'
                              ? 'por peso'
                              : `${Number(p.stock).toLocaleString('es-AR')} un.`}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <div className="flex flex-col gap-3 lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)]">
          <div className="min-h-[280px] lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            <Receipt items={items} onRemove={removeItem} total={total} />
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

      {pendingWeightProduct && (
        <WeightEntry
          product={pendingWeightProduct}
          onConfirm={(payload) => addWeightItem(pendingWeightProduct, payload)}
          onCancel={() => setPendingWeightProduct(null)}
        />
      )}

      <TicketPrint sale={lastSale} />

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
