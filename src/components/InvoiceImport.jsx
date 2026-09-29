import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, FileUp, Loader2, X } from 'lucide-react'
import {
  createProduct,
  createPurchaseInvoice,
  createSupplier,
  fetchSupplierProducts,
  findPurchaseInvoice,
  saveSupplierProducts,
  schema,
  setSupplierCuit,
  updateProduct,
} from '../lib/queries'
import {
  fileToPayload,
  lineKey,
  matchLine,
  matchSupplier,
  readInvoice,
} from '../lib/invoice'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'
const smallInput =
  'w-full rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-sm tabular transition-colors focus:border-awning focus:outline-none'

const money = (n) =>
  '$' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const HOW = {
  barcode: { label: 'Por código de barras', cls: 'bg-awning-50 text-awning-dark border-awning-100' },
  learned: { label: 'Ya lo conocía', cls: 'bg-awning-50 text-awning-dark border-awning-100' },
  similar: { label: 'Parecido: revisalo', cls: 'bg-[#FFF7E6] text-[#8A5A00] border-[#F5DDA8]' },
  none: { label: 'Sin asignar', cls: 'bg-brick-50 text-brick-dark border-brick-100' },
}

const today = () => new Date().toISOString().slice(0, 10)

/** "YERBA PLAYADITO X1KG" → "Yerba Playadito X1kg", para el alta de un producto nuevo. */
function niceName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
}

/**
 * Carga de una factura de proveedor: foto o PDF → la lee Groq → se revisa →
 * al confirmar suma el stock, actualiza costos y proveedor, y aprende qué
 * renglón es qué producto para la próxima.
 */
export default function InvoiceImport({
  products,
  suppliers,
  onDone,
  onClose,
}) {
  const [step, setStep] = useState('pick') // pick | reading | review | saving
  const [error, setError] = useState(null)
  const [invoice, setInvoice] = useState(null) // lo que devolvió el servidor
  const [supplierId, setSupplierId] = useState('') // id | 'new'
  const [newSupplierName, setNewSupplierName] = useState('')
  const [learned, setLearned] = useState([])
  const [rows, setRows] = useState([])
  const [addIva, setAddIva] = useState(true)
  const [purchaseTotal, setPurchaseTotal] = useState('')
  const [duplicate, setDuplicate] = useState(null)
  const [waiting, setWaiting] = useState(0) // segundos hasta reintentar
  const cameraRef = useRef(null)
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setStep('reading')
    try {
      const payload = await fileToPayload(file)
      const data = await readInvoice(payload, { onWait: setWaiting })
      if (!data.lines?.length) {
        throw new Error('No encontramos renglones de productos. Probá con una foto más nítida y derecha.')
      }
      setInvoice(data)
      const sup = matchSupplier(data.supplier, suppliers)
      setSupplierId(sup ? sup.id : 'new')
      setNewSupplierName(data.supplier?.name ? niceName(data.supplier.name) : '')
      const linesTotal = data.lines.reduce(
        (s, l) => s + (l.subtotal ?? (l.quantity || 0) * (l.unitPrice || 0)),
        0
      )
      setPurchaseTotal(String(Math.round((data.invoice?.total ?? linesTotal) * 100) / 100))
      setRows(buildRows(data.lines, []))
      setStep('review')
    } catch (err) {
      setError(err.message)
      setStep('pick')
    }
  }

  function buildRows(lines, memo) {
    return lines.map((line, i) => {
      const m = matchLine(line, products, memo)
      return {
        i,
        line,
        how: m.how || 'none',
        choice: m.product ? m.product.id : 'new',
        qty: line.quantity ?? '',
        upp: m.unitsPerPack ?? line.unitsPerPack ?? 1,
        price: line.unitPrice ?? (line.subtotal && line.quantity ? line.subtotal / line.quantity : ''),
        newName: niceName(line.description),
        newPrice: '',
        newSaleType: 'unit',
        touched: false,
      }
    })
  }

  // Al saber el proveedor: se trae lo aprendido de él, se vuelve a buscar
  // cada renglón que no se tocó a mano, y se mira si la factura ya se cargó.
  useEffect(() => {
    if (step !== 'review' || !invoice) return
    let cancelled = false
    const id = supplierId && supplierId !== 'new' ? supplierId : null
    Promise.all([fetchSupplierProducts(id), findPurchaseInvoice(id, invoice.invoice?.number)])
      .then(([memo, dup]) => {
        if (cancelled) return
        setLearned(memo)
        setDuplicate(dup)
        setRows((prev) => {
          const fresh = buildRows(invoice.lines, memo)
          return prev.map((r, idx) => (r.touched ? r : fresh[idx]))
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // buildRows usa `products`, que no cambia mientras está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, invoice, step])

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, touched: true } : r)))
  }

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [products]
  )

  const inv = invoice?.invoice || {}
  const hasIva = Number(inv.iva) > 0
  const ivaRate = hasIva && Number(inv.subtotal) > 0 ? Number(inv.iva) / Number(inv.subtotal) : 0.21
  const ivaFactor = hasIva && addIva ? 1 + ivaRate : 1

  // Lo que se va a aplicar, renglón por renglón.
  function plan(r) {
    const product = productById[r.choice]
    const isWeight = r.choice === 'new' ? r.newSaleType === 'weight' : product?.sale_type === 'weight'
    const upp = isWeight ? 1 : Math.max(1, Number(r.upp) || 1)
    const qty = Number(r.qty) || 0
    const add = qty * upp
    const unitCost = Number(r.price) > 0 ? (Number(r.price) / upp) * ivaFactor : 0
    return { product, isWeight, upp, qty, add, unitCost }
  }

  const active = rows.filter((r) => r.choice !== 'skip')
  const missingPrice = active.some((r) => r.choice === 'new' && !(Number(r.newPrice) > 0))
  const missingSupplier = supplierId === 'new' && !newSupplierName.trim()
  const canSave = active.length > 0 && !missingPrice && !missingSupplier && step === 'review'

  async function handleSave() {
    if (!canSave) return
    setStep('saving')
    setError(null)
    try {
      // 1. Proveedor
      let supplier = supplierId !== 'new' ? suppliers.find((s) => s.id === supplierId) : null
      const cuit = invoice.supplier?.cuit || null
      if (!supplier) {
        supplier = await createSupplier({ name: newSupplierName.trim() })
        if (cuit) await setSupplierCuit(supplier.id, cuit)
      } else if (cuit && !supplier.cuit) {
        await setSupplierCuit(supplier.id, cuit)
      }

      // 2. Productos: stock, costo y proveedor. Si dos renglones van al mismo
      // producto, el stock se acumula.
      const stockNow = {}
      const memoRows = []
      const applied = []
      for (const r of active) {
        const p = plan(r)
        let productId
        if (r.choice === 'new') {
          const created = await createProduct({
            name: r.newName.trim() || niceName(r.line.description),
            barcode: r.line.ean || null,
            category: null,
            sale_type: r.newSaleType,
            price: Number(r.newPrice),
            cost: Math.round(p.unitCost * 100) / 100,
            stock: p.add,
            min_stock: 0,
            supplier_id: supplier.id,
          })
          productId = created.id
          applied.push(`${created.name}: nuevo, ${p.add} ${p.isWeight ? 'kg' : 'un.'}`)
        } else {
          const base = stockNow[p.product.id] ?? (Number(p.product.stock) || 0)
          const newStock = base + p.add
          stockNow[p.product.id] = newStock
          await updateProduct(p.product.id, {
            stock: newStock,
            ...(schema.costs && p.unitCost > 0 ? { cost: Math.round(p.unitCost * 100) / 100 } : {}),
            supplier_id: supplier.id,
          })
          productId = p.product.id
          applied.push(`${p.product.name}: +${p.add} ${p.isWeight ? 'kg' : 'un.'}`)
        }
        memoRows.push({
          supplier_id: supplier.id,
          product_id: productId,
          match_key: lineKey(r.line),
          description: r.line.description,
          units_per_pack: p.upp,
        })
      }

      // 3. Lo aprendido, para que la próxima factura salga sola.
      await saveSupplierProducts(dedupeByKey(memoRows)).catch(() => {})

      // 4. La compra queda en Compras. No va a Gastos: es mercadería que se
      // vende, y su costo ya entra en la ganancia a través del costo de cada
      // producto.
      await createPurchaseInvoice({
        supplier_id: supplier.id,
        invoice_number: inv.number || null,
        invoice_date: inv.date || today(),
        total: Number(purchaseTotal) > 0 ? Number(purchaseTotal) : (inv.total ?? null),
        lines: active.map((r) => ({ ...r.line, product_id: r.choice === 'new' ? null : r.choice })),
      }).catch(() => {})

      onDone?.({ supplier: supplier.name, applied })
    } catch (err) {
      setError('No se pudo guardar todo: ' + err.message + '. Revisá el stock de los productos antes de reintentar.')
      setStep('review')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-rise flex max-h-[100dvh] w-full max-w-3xl flex-col rounded-t-2xl border border-line bg-surface shadow-pop sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
          <div>
            <p className="eyebrow text-awning">Entrada de mercadería</p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-ink">Cargar factura de proveedor</h2>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'saving'}
            aria-label="Cerrar"
            className="rounded-full p-2 text-inkfaint transition-colors hover:bg-paper2 hover:text-ink"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-4 rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-sm font-medium text-brick-dark">
              {error}
            </p>
          )}

          {step === 'pick' && (
            <div className="space-y-3">
              <p className="text-sm text-inkfaint">
                Sacale una foto a la factura o subí el PDF. La app reconoce el proveedor y los
                productos; vos revisás y confirmás antes de que se toque el stock.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-awning py-4 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
                >
                  <Camera size={20} strokeWidth={2.2} />
                  Sacar foto
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-line py-4 font-semibold text-ink transition-colors hover:border-awning hover:text-awning"
                >
                  <FileUp size={20} strokeWidth={2.2} />
                  Subir foto o PDF
                </button>
              </div>
              <p className="text-xs text-inkfaint">
                Para que salga bien: la factura entera, derecha, con buena luz y sin sombras.
              </p>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          )}

          {step === 'reading' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Loader2 size={32} className="animate-spin text-awning" />
              <p className="font-semibold text-ink">Leyendo la factura...</p>
              <p className="text-sm text-inkfaint">
                {waiting > 0
                  ? `Groq está al límite por minuto: reintento solo en ${waiting} s. No cierres esta ventana.`
                  : 'Tarda unos segundos.'}
              </p>
            </div>
          )}

          {(step === 'review' || step === 'saving') && invoice && (
            <div className="space-y-5">
              {/* Proveedor y datos de la factura */}
              <section className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-inkfaint">
                    Leído: <span className="font-semibold text-ink">{invoice.supplier?.name || 'sin nombre'}</span>
                    {invoice.supplier?.cuit && <span className="font-mono"> · CUIT {invoice.supplier.cuit}</span>}
                  </p>
                  <p className="text-sm text-inkfaint">
                    {inv.type && <>Factura {inv.type} </>}
                    {inv.number && <span className="font-mono">{inv.number}</span>}
                    {inv.date && <> · {inv.date.split('-').reverse().join('/')}</>}
                    {inv.total != null && <> · Total <span className="font-semibold text-ink">{money(inv.total)}</span></>}
                  </p>
                </div>
                <label className="mt-3 block text-xs font-semibold text-inkfaint">Proveedor</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={`${inputClass} mt-1`}
                >
                  <option value="new">+ Crear proveedor nuevo</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {supplierId === 'new' && (
                  <input
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="Nombre del proveedor"
                    className={`${inputClass} mt-2`}
                  />
                )}
                {duplicate && (
                  <p className="mt-2 rounded-lg border border-[#F5DDA8] bg-[#FFF7E6] px-3 py-2 text-sm font-medium text-[#8A5A00]">
                    Esta factura ya se cargó el{' '}
                    {new Date(duplicate.created_at).toLocaleDateString('es-AR')}. Si la confirmás de nuevo,
                    el stock se suma dos veces.
                  </p>
                )}
              </section>

              {hasIva && (
                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={addIva}
                    onChange={(e) => setAddIva(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-awning"
                  />
                  <span>
                    <span className="font-semibold text-ink">
                      Sumar el IVA ({Math.round(ivaRate * 1000) / 10}%) al costo
                    </span>
                    <span className="block text-xs text-inkfaint">
                      Si sos monotributista el IVA no se recupera: es parte de lo que te cuesta.
                    </span>
                  </span>
                </label>
              )}

              {/* Renglones */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-inkfaint">
                  Productos ({rows.length})
                </p>
                <ul className="space-y-3">
                  {rows.map((r, idx) => {
                    const p = plan(r)
                    const badge = HOW[r.how] || HOW.none
                    const skip = r.choice === 'skip'
                    return (
                      <li
                        key={r.i}
                        className={`rounded-xl border border-line p-3 ${skip ? 'opacity-55' : ''}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words font-medium text-ink">{r.line.description}</p>
                            <p className="font-mono text-xs text-inkfaint">
                              {[r.line.code && `cód. ${r.line.code}`, r.line.ean].filter(Boolean).join(' · ') ||
                                'sin código'}
                            </p>
                          </div>
                          {!skip && !r.touched && (
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>

                        <select
                          value={r.choice}
                          onChange={(e) => updateRow(idx, { choice: e.target.value })}
                          className={`${inputClass} mt-2 text-sm`}
                        >
                          <option value="skip">— No cargar este renglón —</option>
                          <option value="new">+ Crear producto nuevo</option>
                          {sortedProducts.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name}
                              {pr.barcode ? ` · ${pr.barcode}` : ''}
                            </option>
                          ))}
                        </select>

                        {r.choice === 'new' && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input
                              value={r.newName}
                              onChange={(e) => updateRow(idx, { newName: e.target.value })}
                              placeholder="Nombre"
                              className={`${inputClass} col-span-2 text-sm`}
                            />
                            <div>
                              <label className="text-[11px] font-semibold text-inkfaint">
                                Precio de venta {r.newSaleType === 'weight' ? '/kg' : ''}
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={r.newPrice}
                                onChange={(e) => updateRow(idx, { newPrice: e.target.value })}
                                className={`${smallInput} ${!(Number(r.newPrice) > 0) ? 'border-brick' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-inkfaint">Se vende por</label>
                              <select
                                value={r.newSaleType}
                                onChange={(e) => updateRow(idx, { newSaleType: e.target.value })}
                                className={smallInput}
                              >
                                <option value="unit">Unidad</option>
                                <option value="weight">Peso (kg)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {!skip && (
                          <>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-inkfaint">
                                  {p.isWeight ? 'Kilos' : 'Cantidad'}
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.001"
                                  value={r.qty}
                                  onChange={(e) => updateRow(idx, { qty: e.target.value })}
                                  className={smallInput}
                                />
                              </div>
                              {!p.isWeight ? (
                                <div>
                                  <label className="text-[11px] font-semibold text-inkfaint">Unid. x bulto</label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    step="1"
                                    value={r.upp}
                                    onChange={(e) => updateRow(idx, { upp: e.target.value })}
                                    className={smallInput}
                                  />
                                </div>
                              ) : (
                                <div />
                              )}
                              <div>
                                <label className="text-[11px] font-semibold text-inkfaint">
                                  Precio {p.isWeight ? '/kg' : p.upp > 1 ? '/bulto' : 'unit.'}
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={r.price}
                                  onChange={(e) => updateRow(idx, { price: e.target.value })}
                                  className={smallInput}
                                />
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-inkfaint">
                              Entran <span className="font-semibold text-ink">{p.add} {p.isWeight ? 'kg' : 'un.'}</span>
                              {p.product && (
                                <>
                                  {' '}· stock {Number(p.product.stock)} → {Number(p.product.stock) + p.add}
                                </>
                              )}
                              {p.unitCost > 0 && (
                                <>
                                  {' '}· costo {p.isWeight ? 'x kg' : 'x unidad'}{' '}
                                  <span className="font-semibold text-ink">{money(p.unitCost)}</span>
                                  {p.product && Number(p.product.cost) > 0 && (
                                    <> (antes {money(p.product.cost)})</>
                                  )}
                                </>
                              )}
                            </p>
                            {p.product && p.unitCost > 0 && Number(p.product.price) > 0 && p.unitCost >= Number(p.product.price) && (
                              <p className="mt-1 text-xs font-semibold text-brick-dark">
                                Ojo: el costo nuevo supera el precio de venta ({money(p.product.price)}).
                              </p>
                            )}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>

              {/* Total de la compra */}
              <section className="rounded-xl border border-line p-3.5">
                <label htmlFor="purchase-total" className="block text-sm font-semibold text-ink">
                  Total de la compra
                </label>
                <input
                  id="purchase-total"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={purchaseTotal}
                  onChange={(e) => setPurchaseTotal(e.target.value)}
                  className={`${inputClass} mt-1.5 font-mono text-sm`}
                />
                <p className="mt-1.5 text-xs text-inkfaint">
                  Queda registrada en Compras. No va a Gastos: es mercadería que vendés, y su costo
                  ya se descuenta de la ganancia cuando se vende.
                </p>
              </section>

              {learned.length > 0 && (
                <p className="text-xs text-inkfaint">
                  Este proveedor ya tiene {learned.length} productos aprendidos de facturas anteriores.
                </p>
              )}
            </div>
          )}
        </div>

        {(step === 'review' || step === 'saving') && (
          <div className="flex gap-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              onClick={() => {
                setStep('pick')
                setInvoice(null)
                setError(null)
              }}
              disabled={step === 'saving'}
              className="rounded-xl border border-line px-4 py-3 font-semibold text-inkfaint transition-colors hover:bg-paper2"
            >
              Otra
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-xl bg-awning py-3 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none"
            >
              {step === 'saving'
                ? 'Guardando...'
                : missingPrice
                  ? 'Falta el precio de venta de un producto nuevo'
                  : missingSupplier
                    ? 'Falta el nombre del proveedor'
                    : `Confirmar y cargar ${active.length} ${active.length === 1 ? 'producto' : 'productos'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Dos renglones con la misma clave no pueden ir en el mismo upsert.
function dedupeByKey(rows) {
  const map = new Map()
  for (const r of rows) map.set(`${r.supplier_id}|${r.match_key}`, r)
  return [...map.values()]
}
