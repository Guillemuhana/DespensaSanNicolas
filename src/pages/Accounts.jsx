import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, MessageCircle, Pencil, Phone, Share2 } from 'lucide-react'
import {
  fetchCustomers,
  fetchAllAccountMovements,
  fetchAccountMovements,
  addAccountMovement,
  createCustomer,
  updateCustomer,
} from '../lib/queries'
import {
  accountSummary,
  anteriorLabel,
  buildAccountMessage,
  chargeLabel,
  fullDate,
  itemsOf,
  money,
  qtyLabel,
  whatsappUrl,
} from '../lib/accountShare'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / MS_PER_DAY))
const daysLabel = (n) => (n === 0 ? 'hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`)

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export default function Accounts() {
  const [customers, setCustomers] = useState([])
  const [allMovements, setAllMovements] = useState([])
  const [selected, setSelected] = useState(null)
  const [movements, setMovements] = useState([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [newName, setNewName] = useState('')
  const [movementKind, setMovementKind] = useState('charge') // 'charge' = fiado | 'payment'
  const [movementNote, setMovementNote] = useState('')
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
      const [c, m] = await Promise.all([fetchCustomers(), fetchAllAccountMovements()])
      setCustomers(c)
      setAllMovements(m)
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

  // "Anotámelo": el fiado se carga a mano con el monto, sin pasar los productos
  // por Facturación. El pago va por el mismo formulario.
  async function handleRegisterMovement(e) {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (!selected || amount <= 0) return
    const isCharge = movementKind === 'charge'
    try {
      await addAccountMovement({
        customer_id: selected.id,
        type: movementKind,
        amount,
        note: movementNote.trim() || (isCharge ? 'Fiado' : 'Pago recibido'),
      })
      setPaymentAmount('')
      setMovementNote('')
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

  // Saldos, desde cuándo debe cada uno y los números del mes, todo de una
  // pasada sobre los movimientos.
  const { balances, owingSince, stats } = useMemo(() => {
    const byCustomer = {}
    for (const m of allMovements) (byCustomer[m.customer_id] ??= []).push(m)

    const balances = {}
    const owingSince = {}
    for (const [id, list] of Object.entries(byCustomer)) {
      const bal = list.reduce((s, m) => s + (m.type === 'charge' ? 1 : -1) * Number(m.amount), 0)
      balances[id] = bal
      if (bal > 0.005) owingSince[id] = accountSummary(list, bal).since
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    let fiadoMes = 0
    let cobradoMes = 0
    for (const m of allMovements) {
      if (new Date(m.created_at) < monthStart) continue
      if (m.type === 'charge') fiadoMes += Number(m.amount)
      else cobradoMes += Number(m.amount)
    }

    const owing = Object.keys(owingSince)
    const oldestId = owing.sort((a, b) => new Date(owingSince[a]) - new Date(owingSince[b]))[0]

    return {
      balances,
      owingSince,
      stats: {
        totalDebt: owing.reduce((s, id) => s + balances[id], 0),
        owingCount: owing.length,
        fiadoMes,
        cobradoMes,
        oldestId,
      },
    }
  }, [allMovements])

  const sortedCustomers = [...customers].sort(
    (a, b) => (balances[b.id] || 0) - (balances[a.id] || 0)
  )
  const oldest = customers.find((c) => c.id === stats.oldestId)
  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long' })
  const summary = selected ? accountSummary(movements, balances[selected.id] || 0) : null

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[340px_1fr]">
      <div className="grid grid-cols-2 gap-3 md:col-span-2 lg:grid-cols-4">
        <div className="col-span-2 rounded-2xl bg-awning p-4 text-white shadow-lift sm:p-5 lg:col-span-1">
          <p className="eyebrow text-white/70">Total a cobrar</p>
          <p className="mt-1.5 font-mono tabular text-3xl font-bold leading-none">
            {money(stats.totalDebt)}
          </p>
          <p className="mt-2 text-sm text-white/75">
            {stats.owingCount === 0
              ? 'Nadie debe nada'
              : `${stats.owingCount} ${stats.owingCount === 1 ? 'cliente debe' : 'clientes deben'}`}
          </p>
        </div>
        <StatTile label={`Fiado en ${monthName}`} value={money(stats.fiadoMes)} tone="brick" />
        <StatTile label={`Cobrado en ${monthName}`} value={money(stats.cobradoMes)} tone="awning" />
        <StatTile
          className="col-span-2 lg:col-span-1"
          label="Deuda más vieja"
          value={oldest ? oldest.name : '—'}
          hint={
            oldest
              ? `${money(balances[oldest.id])} · desde ${fullDate(owingSince[oldest.id])} (${daysLabel(daysSince(owingSince[oldest.id]))})`
              : 'Nadie debe nada'
          }
          onClick={oldest ? () => selectCustomer(oldest) : undefined}
        />
      </div>

      <div>

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
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{c.name}</span>
                      {owingSince[c.id] && (
                        <span className="block text-xs text-inkfaint">
                          Debe desde {fullDate(owingSince[c.id])} ·{' '}
                          {daysLabel(daysSince(owingSince[c.id]))}
                        </span>
                      )}
                    </span>
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
            </div>

            {/* Los mismos números que lleva el resumen que se le manda al
                cliente: desde la última vez que la cuenta quedó en cero. */}
            <div className="mb-5">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Total fiado" value={money(summary.fiado)} className="text-brick" />
                <MiniStat label="Total pagado" value={money(summary.pagado)} className="text-awning" />
                <MiniStat
                  label="Saldo"
                  value={money(balances[selected.id] || 0)}
                  className={(balances[selected.id] || 0) > 0 ? 'text-brick' : 'text-awning'}
                  strong
                />
              </div>
              <p className="mt-2 text-xs text-inkfaint">
                {(balances[selected.id] || 0) > 0.005 && summary.since
                  ? `Debe desde ${fullDate(summary.since)} (${daysLabel(daysSince(summary.since))})`
                  : 'Está al día'}
                {summary.anterior ? ` · ${anteriorLabel(summary.anterior)}` : ''}
                {summary.lastPayment
                  ? ` · Último pago ${fullDate(summary.lastPayment.created_at)}`
                  : ''}
              </p>
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

            <form onSubmit={handleRegisterMovement} className="mb-6 rounded-xl bg-paper2/60 p-3">
              <div className="mb-2.5 flex gap-1 rounded-lg bg-paper2 p-1">
                {[
                  { id: 'charge', label: 'Anotar fiado' },
                  { id: 'payment', label: 'Registrar pago' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMovementKind(opt.id)}
                    className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-all ${
                      movementKind === opt.id
                        ? 'bg-surface text-ink shadow-card'
                        : 'text-inkfaint hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={movementKind === 'charge' ? 'Monto que se lleva' : 'Monto que paga'}
                  aria-label="Monto"
                  className="min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 font-mono tabular transition-colors focus:border-awning focus:outline-none sm:w-40"
                />
                <input
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder={
                    movementKind === 'charge' ? 'Qué se llevó (opcional)' : 'Nota (opcional)'
                  }
                  aria-label="Nota"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 transition-colors focus:border-awning focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!(Number(paymentAmount) > 0)}
                  className={`whitespace-nowrap rounded-xl px-5 py-2.5 font-semibold text-white shadow-card transition-colors disabled:bg-paper2 disabled:text-inkfaint/70 disabled:shadow-none ${
                    movementKind === 'charge'
                      ? 'bg-brick hover:bg-brick-dark'
                      : 'bg-awning hover:bg-awning-dark'
                  }`}
                >
                  {movementKind === 'charge' ? 'Anotar' : 'Registrar pago'}
                </button>
              </div>
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
                        {m.type === 'charge'
                          ? chargeLabel(m)
                          : m.note && m.note !== 'Pago recibido'
                            ? `Pago · ${m.note}`
                            : 'Pago'}
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
                          year: 'numeric',
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

function StatTile({ label, value, hint, tone, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`min-w-0 rounded-2xl border border-line bg-surface p-4 text-left shadow-card ${
        onClick ? 'transition-colors hover:border-awning' : ''
      } ${className}`}
    >
      <p className="eyebrow truncate text-inkfaint">{label}</p>
      <p
        className={`mt-1.5 truncate text-xl font-bold leading-tight ${
          tone === 'brick' ? 'font-mono tabular text-brick' : tone === 'awning' ? 'font-mono tabular text-awning' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-inkfaint">{hint}</p>}
    </Tag>
  )
}

function MiniStat({ label, value, className = '', strong = false }) {
  return (
    <div className={`min-w-0 rounded-xl px-3 py-2.5 ${strong ? 'bg-brick-50/70' : 'bg-paper2/70'}`}>
      <p className="truncate text-[0.7rem] font-semibold uppercase tracking-wide text-inkfaint">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate font-mono tabular font-bold ${
          strong ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
        } ${className}`}
      >
        {value}
      </p>
    </div>
  )
}
