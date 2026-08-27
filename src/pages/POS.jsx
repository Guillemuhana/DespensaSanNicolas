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
      setLastSale({ ...sale, changeDue: payment.changeDue })
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

  const matchingProducts = barcode.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(barcode.trim().toLowerCase()) ||
          p.barcode?.includes(barcode.trim())
      )
    : []

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[1fr_380px] md:grid-rows-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1">
        <form onSubmit={handleScan}>
          <label className="block text-sm font-medium text-ink mb-1">
            Código de barras / buscar producto
          </label>
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Escaneá o escribí y apretá Enter"
            className="w-full text-lg sm:text-xl font-mono border border-paper2 rounded-md px-3 sm:px-4 py-3 sm:py-4 focus:border-awning bg-white"
            autoComplete="off"
          />
        </form>

        {status && (
          <div
            className={`rounded-md px-4 py-3 text-sm font-medium ${
              status.type === 'error'
                ? 'bg-brick-light/30 text-brick-dark'
                : 'bg-awning-light/20 text-awning-dark'
            }`}
          >
            {status.text}
          </div>
        )}

        {lastSale && (
          <div className="bg-mustard-light/30 rounded-md px-4 py-3 text-sm text-ink">
            Última venta: <span className="font-mono tabular font-semibold">${lastSale.total.toLocaleString('es-AR')}</span>
            {lastSale.changeDue > 0 && (
              <> · vuelto <span className="font-mono tabular font-semibold">${lastSale.changeDue.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span></>
            )}
          </div>
        )}

        {barcode.trim() && matchingProducts.length > 0 && (
          <div className="bg-white border border-paper2 rounded-md divide-y divide-paper2 overflow-hidden">
            {matchingProducts.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setBarcode(p.barcode || '')
                  if (p.sale_type === 'weight') setPendingWeightProduct(p)
                  else addUnitItem(p)
                  setBarcode('')
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper2 text-left"
              >
                <span className="text-ink font-medium min-w-0 truncate">{p.name}</span>
                <span className="font-mono tabular text-inkfaint text-sm shrink-0">
                  ${Number(p.price).toLocaleString('es-AR')}
                  {p.sale_type === 'weight' ? ' /kg' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-[280px] md:min-h-[420px] md:h-full md:col-start-2 md:row-start-1 md:row-span-2">
        <Receipt items={items} onRemove={removeItem} total={total} />
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 pb-3 pt-2 bg-paper md:static md:mx-0 md:p-0 md:bg-transparent md:col-start-1 md:row-start-2">
        <button
          onClick={() => setShowPayment(true)}
          disabled={items.length === 0}
          className="w-full py-4 sm:py-5 rounded-md bg-mustard text-ink font-display text-xl sm:text-2xl font-semibold hover:bg-mustard-dark disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          Cobrar · ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
        </button>
      </div>

      {pendingWeightProduct && (
        <WeightEntry
          product={pendingWeightProduct}
          onConfirm={(payload) => addWeightItem(pendingWeightProduct, payload)}
          onCancel={() => setPendingWeightProduct(null)}
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
