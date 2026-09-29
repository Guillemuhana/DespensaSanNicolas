import { useEffect, useMemo, useState } from 'react'
import { FileText, Mail, Phone, Trash2, X } from 'lucide-react'
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchProducts,
  fetchRecentPurchaseInvoices,
} from '../lib/queries'
import { friendlyError } from '../lib/friendlyError'
import InvoiceImport from '../components/InvoiceImport'

const emptyForm = { name: '', cuit: '', contact: '', phone: '', email: '', delivery_days: '', notes: '' }

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })

/** Deja sólo los dígitos, que es lo que espera el enlace de WhatsApp. */
const waLink = (phone) => `https://wa.me/${String(phone).replace(/\D/g, '')}`

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [showInvoice, setShowInvoice] = useState(false)
  const [notice, setNotice] = useState(null) // resultado de la última factura cargada
  const [showAllPurchases, setShowAllPurchases] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [s, p, inv] = await Promise.all([
        fetchSuppliers(),
        fetchProducts(),
        fetchRecentPurchaseInvoices().catch(() => []),
      ])
      setSuppliers(s)
      setProducts(p)
      setInvoices(inv)
      setStatus(null)
    } catch (err) {
      setStatus(friendlyError(err.message, 'suppliers'))
    } finally {
      setLoading(false)
    }
  }

  // Cuántos productos le compramos a cada uno.
  const countBySupplier = useMemo(() => {
    const map = {}
    for (const p of products) {
      if (p.supplier_id) map[p.supplier_id] = (map[p.supplier_id] || 0) + 1
    }
    return map
  }, [products])

  // La última factura cargada de cada uno (vienen ordenadas, la primera gana).
  const lastInvoice = useMemo(() => {
    const map = {}
    for (const inv of invoices) {
      if (inv.supplier_id && !map[inv.supplier_id]) map[inv.supplier_id] = inv
    }
    return map
  }, [invoices])

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? 'Proveedor borrado'

  // Lo comprado en el mes y en el año, según las facturas cargadas.
  const purchaseTotals = useMemo(() => {
    const now = new Date()
    let month = 0
    let year = 0
    for (const inv of invoices) {
      const d = new Date(inv.invoice_date ? inv.invoice_date + 'T12:00:00' : inv.created_at)
      if (d.getFullYear() !== now.getFullYear()) continue
      year += Number(inv.total) || 0
      if (d.getMonth() === now.getMonth()) month += Number(inv.total) || 0
    }
    return { month, year }
  }, [invoices])

  // La columna cuit llega con la migración 008: sin ella no se manda.
  const hasCuit = suppliers.some((s) => 'cuit' in s)

  function startEdit(s) {
    setEditingId(s.id)
    setForm({
      name: s.name,
      cuit: s.cuit || '',
      contact: s.contact || '',
      phone: s.phone || '',
      email: s.email || '',
      delivery_days: s.delivery_days || '',
      notes: s.notes || '',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      name: form.name.trim(),
      ...(hasCuit ? { cuit: form.cuit.trim() || null } : {}),
      contact: form.contact.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      delivery_days: form.delivery_days.trim() || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editingId) await updateSupplier(editingId, payload)
      else await createSupplier(payload)
      resetForm()
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'suppliers'))
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSupplier(id)
      if (editingId === id) resetForm()
      load()
    } catch (err) {
      setStatus(friendlyError(err.message, 'suppliers'))
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-inkfaint">
            Lo que le comprás a los proveedores para vender. Cargá la factura y el stock, los
            costos y el proveedor se actualizan solos.
          </p>
          <button
            onClick={() => setShowInvoice(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-awning px-3.5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
          >
            <FileText size={16} strokeWidth={2.4} />
            Cargar factura
          </button>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-awning-100 bg-awning-50 px-4 py-3 text-sm text-awning-dark">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">
                Factura de {notice.supplier} cargada: {notice.applied.length}{' '}
                {notice.applied.length === 1 ? 'producto actualizado' : 'productos actualizados'}.
              </p>
              <button
                onClick={() => setNotice(null)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-full p-0.5 hover:bg-awning-100"
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            </div>
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {notice.applied.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {status && (
          <div className="mb-4 rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
            {status}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="eyebrow text-inkfaint">Compras del mes</p>
            <p className="mt-1.5 font-mono text-2xl font-bold leading-none tabular text-ink">
              {money(purchaseTotals.month)}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="eyebrow text-inkfaint">Compras del año</p>
            <p className="mt-1.5 font-mono text-2xl font-bold leading-none tabular text-ink">
              {money(purchaseTotals.year)}
            </p>
          </div>
        </div>

        <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-display text-base font-semibold text-ink">Últimas compras</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-inkfaint">
              Todavía no cargaste facturas. Tocá <span className="font-semibold">Cargar factura</span>.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line/70">
                {(showAllPurchases ? invoices : invoices.slice(0, 6)).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{supplierName(inv.supplier_id)}</p>
                      <p className="text-xs text-inkfaint">
                        {new Date(
                          inv.invoice_date ? inv.invoice_date + 'T12:00:00' : inv.created_at
                        ).toLocaleDateString('es-AR')}
                        {inv.invoice_number && <> · Fact. {inv.invoice_number}</>}
                        {Array.isArray(inv.lines) && (
                          <>
                            {' '}· {inv.lines.length} {inv.lines.length === 1 ? 'producto' : 'productos'}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-semibold tabular text-ink">
                      {inv.total != null ? money(inv.total) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
              {invoices.length > 6 && (
                <button
                  onClick={() => setShowAllPurchases((v) => !v)}
                  className="no-print w-full border-t border-line py-2.5 text-sm font-semibold text-awning hover:bg-paper2/60"
                >
                  {showAllPurchases ? 'Ver menos' : `Ver las ${invoices.length}`}
                </button>
              )}
            </>
          )}
        </section>

        <h2 className="mb-3 font-display text-base font-semibold text-ink">Proveedores</h2>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-paper2/70" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-12 text-center text-sm text-inkfaint">
            Todavía no cargaste ningún proveedor.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {suppliers.map((s) => (
              <li
                key={s.id}
                className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-display font-semibold text-ink">{s.name}</p>
                    {s.cuit && <p className="font-mono text-xs text-inkfaint">CUIT {s.cuit}</p>}
                    {s.contact && <p className="text-sm text-inkfaint">{s.contact}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    aria-label={`Borrar ${s.name}`}
                    className="no-print shrink-0 rounded-lg p-1.5 text-inkfaint transition-colors hover:bg-brick-50 hover:text-brick"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {s.delivery_days && (
                  <p className="mt-2 inline-flex w-fit rounded-full bg-awning-50 px-2.5 py-1 text-xs font-semibold text-awning-dark">
                    Reparte: {s.delivery_days}
                  </p>
                )}

                <div className="mt-3 space-y-1.5 text-sm">
                  {s.phone && (
                    <a
                      href={waLink(s.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-awning hover:underline"
                    >
                      <Phone size={14} strokeWidth={2.2} />
                      <span className="font-mono">{s.phone}</span>
                    </a>
                  )}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className="flex items-center gap-2 text-awning hover:underline"
                    >
                      <Mail size={14} strokeWidth={2.2} />
                      <span className="truncate">{s.email}</span>
                    </a>
                  )}
                </div>

                {s.notes && <p className="mt-2 text-sm text-inkfaint">{s.notes}</p>}

                {lastInvoice[s.id] && (
                  <p className="mt-2 text-xs text-inkfaint">
                    Última factura:{' '}
                    {new Date(
                      lastInvoice[s.id].invoice_date
                        ? lastInvoice[s.id].invoice_date + 'T12:00:00'
                        : lastInvoice[s.id].created_at
                    ).toLocaleDateString('es-AR')}
                    {lastInvoice[s.id].total != null && (
                      <>
                        {' '}·{' '}
                        <span className="font-semibold text-ink">
                          ${Number(lastInvoice[s.id].total).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                  <span className="text-inkfaint">
                    {countBySupplier[s.id] || 0}{' '}
                    {countBySupplier[s.id] === 1 ? 'producto' : 'productos'}
                  </span>
                  <button
                    onClick={() => startEdit(s)}
                    className="no-print font-semibold text-awning hover:underline"
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="no-print h-fit rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          {editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="sup-name" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Nombre
            </label>
            <input
              id="sup-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Distribuidora del Centro"
              className={inputClass}
            />
          </div>
          {hasCuit && (
            <div>
              <label htmlFor="sup-cuit" className="mb-1.5 block text-xs font-semibold text-inkfaint">
                CUIT
              </label>
              <input
                id="sup-cuit"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                placeholder="30-71234567-8"
                inputMode="numeric"
                className={`${inputClass} font-mono`}
              />
            </div>
          )}
          <div>
            <label
              htmlFor="sup-contact"
              className="mb-1.5 block text-xs font-semibold text-inkfaint"
            >
              Contacto
            </label>
            <input
              id="sup-contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Con quién hablás"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sup-phone" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Teléfono
            </label>
            <input
              id="sup-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="351 555-1234"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="sup-email" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Email
            </label>
            <input
              id="sup-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sup-days" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Días que reparte
            </label>
            <input
              id="sup-days"
              value={form.delivery_days}
              onChange={(e) => setForm({ ...form, delivery_days: e.target.value })}
              placeholder="Lunes y jueves"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sup-notes" className="mb-1.5 block text-xs font-semibold text-inkfaint">
              Notas
            </label>
            <textarea
              id="sup-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Pedido mínimo, formas de pago..."
              className={`${inputClass} resize-none`}
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

      {showInvoice && (
        <InvoiceImport
          products={products}
          suppliers={suppliers}
          onClose={() => setShowInvoice(false)}
          onDone={(result) => {
            setShowInvoice(false)
            setNotice(result)
            load()
          }}
        />
      )}
    </div>
  )
}
