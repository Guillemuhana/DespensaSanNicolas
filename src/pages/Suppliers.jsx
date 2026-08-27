import { useEffect, useMemo, useState } from 'react'
import { Mail, Phone, Trash2 } from 'lucide-react'
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchProducts,
} from '../lib/queries'
import { friendlyError } from '../lib/friendlyError'

const emptyForm = { name: '', contact: '', phone: '', email: '', delivery_days: '', notes: '' }

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus:border-awning focus:outline-none'

/** Deja sólo los dígitos, que es lo que espera el enlace de WhatsApp. */
const waLink = (phone) => `https://wa.me/${String(phone).replace(/\D/g, '')}`

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [s, p] = await Promise.all([fetchSuppliers(), fetchProducts()])
      setSuppliers(s)
      setProducts(p)
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

  function startEdit(s) {
    setEditingId(s.id)
    setForm({
      name: s.name,
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
        {status && (
          <div className="mb-4 rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
            {status}
          </div>
        )}

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
    </div>
  )
}
