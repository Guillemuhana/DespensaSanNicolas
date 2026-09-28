import { useEffect, useState } from 'react'
import { Check, Copy, MessageCircle, Pencil, Phone, Share2 } from 'lucide-react'
import {
  fetchCustomers,
  fetchAllBalances,
  fetchAccountMovements,
  addAccountMovement,
  createCustomer,
  updateCustomer,
} from '../lib/queries'
import { buildAccountMessage, itemsOf, qtyLabel, whatsappUrl } from '../lib/accountShare'

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export default function Accounts() {
  const [customers, setCustomers] = useState([])
  const [balances, setBalances] = useState({})
  const [selected, setSelected] = useState(null)
  const [movements, setMovements] = useState([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [c, b] = await Promise.all([fetchCustomers(), fetchAllBalances()])
      setCustomers(c)
      setBalances(b)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function selectCustomer(c) {
    setSelected(c)
    setPaymentAmount('')
    setEditingPhone(false)
    setCopied(false)
    try {
      setMovements(await fetchAccountMovements(c.id))
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const c = await createCustomer({ name: newName.trim(), phone: newPhone.trim() || null })
      setNewName('')
      setNewPhone('')
      await load()
      selectCustomer(c)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function handleRegisterPayment(e) {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (!selected || amount <= 0) return
    try {
      await addAccountMovement({
        customer_id: selected.id,
        type: 'payment',
        amount,
        note: 'Pago recibido',
      })
      setPaymentAmount('')
      await load()
      selectCustomer(selected)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  async function handleSavePhone(e) {
    e.preventDefault()
    try {
      const c = await updateCustomer(selected.id, { phone: phoneDraft.trim() || null })
      setSelected(c)
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? c : x)))
      setEditingPhone(false)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  function accountMessage() {
    return buildAccountMessage({
      customer: selected,
      movements,
      balance: balances[selected.id] || 0,
    })
  }

  // En el celular abre el menú de compartir del sistema; en la compu, donde
  // casi nunca está, copia el texto para pegarlo donde haga falta.
  async function handleShare() {
    const text = accountMessage()
    if (canNativeShare) {
      try {
        await navigator.share({ title: `Cuenta de ${selected.name}`, text })
      } catch {
        // Cerró el menú sin elegir nada: no es un error.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus({ type: 'error', text: 'No se pudo copiar el resumen.' })
    }
  }

  const sortedCustomers = [...customers].sort(
    (a, b) => (balances[b.id] || 0) - (balances[a.id] || 0)
  )
  const totalDebt = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0)
  const owingCount = Object.values(balances).filter((v) => v > 0).length

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[340px_1fr]">
      <div>
        <div className="mb-4 overflow-hidden rounded-2xl bg-awning p-5 text-white shadow-lift">
          <p className="eyebrow text-white/70">Total a cobrar</p>
          <p className="mt-1.5 font-mono tabular text-3xl font-bold leading-none">
            ${totalDebt.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-sm text-white/75">
            {owingCount === 0
              ? 'Nadie debe nada'
              : `${owingCount} ${owingCount === 1 ? 'cliente adeuda' : 'clientes adeudan'}`}
          </p>
        </div>

        <form onSubmit={handleAddCustomer} className="mb-4 flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nuevo cliente..."
              aria-label="Nombre del cliente nuevo"
              className="min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-card transition-colors focus:border-awning focus:outline-none"
            />
            {newName.trim() && (
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="WhatsApp (opcional), ej. 11 2345 6789"
                aria-label="WhatsApp del cliente nuevo"
                className="min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm shadow-card transition-colors focus:border-awning focus:outline-none"
              />
            )}
          </div>
          <button
            type="submit"
            aria-label="Agregar cliente"
            className="shrink-0 self-start rounded-xl bg-awning px-4 py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <ul className="divide-y divide-line/70">
            {sortedCustomers.map((c) => {
              const bal = balances[c.id] || 0
              const active = selected?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    onClick={() => selectCustomer(c)}
                    className={`flex w-full items-center justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-awning bg-awning-50'
                        : 'border-transparent hover:bg-paper2/60'
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium text-ink">{c.name}</span>
                    <span
                      className={`shrink-0 font-mono tabular text-sm font-semibold ${
                        bal > 0 ? 'text-brick' : 'text-inkfaint/70'
                      }`}
                    >
                      ${bal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    </span>
                  </button>
                </li>
              )
            })}
            {sortedCustomers.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-inkfaint">
                Todavía no hay clientes.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div>
        {!selected ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-4 text-center md:min-h-[340px]">
            <span aria-hidden="true" className="text-inkfaint/30">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
                <circle cx="10" cy="8" r="3.5" />
                <path d="M18 11h4M20 9v4" />
              </svg>
            </span>
            <p className="text-sm text-inkfaint">Elegí un cliente para ver su cuenta.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line pb-5">
              <div className="min-w-0">
                <p className="eyebrow text-inkfaint">Cliente</p>
                <h2 className="mt-1 break-words font-display text-xl font-semibold text-ink sm:text-2xl">
                  {selected.name}
                </h2>
                {editingPhone ? (
                  <form onSubmit={handleSavePhone} className="mt-2 flex gap-2">
                    <input
                      type="tel"
                      autoFocus
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="Ej. 11 2345 6789"
                      aria-label="WhatsApp del cliente"
                      className="w-44 min-w-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm transition-colors focus:border-awning focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-awning px-3 text-sm font-semibold text-white transition-colors hover:bg-awning-dark"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      className="rounded-lg px-2 text-sm text-inkfaint transition-colors hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setPhoneDraft(selected.phone || '')
                      setEditingPhone(true)
                    }}
                    className="mt-1.5 flex items-center gap-1.5 text-sm text-inkfaint transition-colors hover:text-ink"
                  >
                    <Phone size={14} />
                    {selected.phone || 'Agregar WhatsApp'}
                    <Pencil size={12} className="opacity-60" />
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="eyebrow text-inkfaint">Saldo</p>
                <span
                  className={`font-mono tabular text-2xl font-bold sm:text-3xl ${
                    (balances[selected.id] || 0) > 0 ? 'text-brick' : 'text-awning'
                  }`}
                >
                  ${(balances[selected.id] || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="no-print mb-5 flex flex-wrap gap-2">
              <a
                href={whatsappUrl(selected.phone, accountMessage())}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1FA855] px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-[#178A45] sm:flex-none"
              >
                <MessageCircle size={17} strokeWidth={2.4} />
                Enviar por WhatsApp
              </a>
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-paper2 sm:flex-none"
              >
                {canNativeShare ? (
                  <>
                    <Share2 size={16} strokeWidth={2.4} />
                    Compartir
                  </>
                ) : copied ? (
                  <>
                    <Check size={16} strokeWidth={2.6} className="text-awning" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy size={16} strokeWidth={2.4} />
                    Copiar resumen
                  </>
                )}
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="mb-6 flex flex-col gap-2 sm:flex-row">
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Monto que paga"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 font-mono tabular transition-colors focus:border-awning focus:outline-none"
              />
              <button
                type="submit"
                className="whitespace-nowrap rounded-xl bg-awning px-5 py-2.5 font-semibold text-white shadow-card transition-colors hover:bg-awning-dark"
              >
                Registrar pago
              </button>
            </form>

            <p className="eyebrow mb-1 text-inkfaint">Movimientos</p>
            <ul className="divide-y divide-line/70">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        m.type === 'charge'
                          ? 'bg-brick-50 text-brick'
                          : 'bg-awning-50 text-awning'
                      }`}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {m.type === 'charge' ? (
                          <path d="M12 19V5M6 11l6-6 6 6" />
                        ) : (
                          <path d="M12 5v14M6 13l6 6 6-6" />
                        )}
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {m.type === 'charge' && m.note === 'Venta a cuenta'
                          ? 'Fiado'
                          : m.note || (m.type === 'charge' ? 'Fiado' : 'Pago')}
                      </p>
                      {itemsOf(m).length > 0 && (
                        <p className="text-xs leading-snug text-inkfaint">
                          {itemsOf(m)
                            .map((it) => `${it.product_name} ${qtyLabel(it)}`)
                            .join(' · ')}
                        </p>
                      )}
                      <p className="text-xs text-inkfaint">
                        {new Date(m.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap font-mono tabular font-semibold ${
                      m.type === 'charge' ? 'text-brick' : 'text-awning'
                    }`}
                  >
                    {m.type === 'charge' ? '+' : '−'}$
                    {Number(m.amount).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
              {movements.length === 0 && (
                <li className="py-8 text-center text-sm text-inkfaint">
                  Sin movimientos todavía.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {status && (
        <div className="rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark md:col-span-2">
          {status.text}
        </div>
      )}
    </div>
  )
}
