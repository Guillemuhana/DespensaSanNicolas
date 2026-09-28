import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, MessageCircle, Minus, Pencil, Phone, Plus, Search } from 'lucide-react'
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
const daysLabel = (n) => (n === 0 ? 'hoy' : n === 1 ? '1 día' : `${n} días`)
const shortDate = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

export default function Accounts() {
  const [customers, setCustomers] = useState([])
  const [allMovements, setAllMovements] = useState([])
  const [selected, setSelected] = useState(null)
  const [movements, setMovements] = useState([])
  const [search, setSearch] = useState('')
  // null | 'charge' (anotar fiado) | 'payment' (registrar pago)
  const [entry, setEntry] = useState(null)
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
      setStatus(err.message)
    }
  }

  async function selectCustomer(c) {
    setSelected(c)
    setEntry(null)
    setStatus(null)
    try {
      setMovements(await fetchAccountMovements(c.id))
    } catch (err) {
      setStatus(err.message)
    }
  }

  async function handleAddCustomer() {
    const name = search.trim()
    if (!name) return
    try {
      const c = await createCustomer({ name })
      setSearch('')
      await load()
      selectCustomer(c)
    } catch (err) {
      setStatus(err.message)
    }
  }

  // "Anotámelo" o "te traigo lo que debo": el mismo formulario para las dos.
  async function handleSaveEntry({ amount, note }) {
    const isCharge = entry === 'charge'
    try {
      await addAccountMovement({
        customer_id: selected.id,
        type: entry,
        amount,
        note: note || (isCharge ? 'Fiado' : 'Pago recibido'),
      })
      setEntry(null)
      await load()
      setMovements(await fetchAccountMovements(selected.id))
    } catch (err) {
      setStatus(err.message)
    }
  }

  async function handleSavePhone(phone) {
    try {
      const c = await updateCustomer(selected.id, { phone: phone || null })
      setSelected(c)
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? c : x)))
    } catch (err) {
      setStatus(err.message)
    }
  }

  // Saldos, desde cuándo debe cada uno y los números del mes, de una pasada.
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
    return {
      balances,
      owingSince,
      stats: {
        totalDebt: owing.reduce((s, id) => s + balances[id], 0),
        owingCount: owing.length,
        fiadoMes,
        cobradoMes,
      },
    }
  }, [allMovements])

  const q = search.trim().toLowerCase()
  const visibleCustomers = customers
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0))
  const exactMatch = customers.some((c) => c.name.toLowerCase() === q)

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Resumen general, en una sola franja. */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-2xl bg-awning px-5 py-4 text-white shadow-lift`}>
        <div>
          <p className="text-sm text-white/75">Total a cobrar</p>
          <p className="font-mono tabular text-3xl font-bold leading-tight">{money(stats.totalDebt)}</p>
          <p className="text-sm text-white/75">
            {stats.owingCount === 0
              ? 'Nadie debe nada'
              : `${stats.owingCount} ${stats.owingCount === 1 ? 'cliente debe' : 'clientes deben'}`}
          </p>
        </div>
        <div className="flex gap-8 text-sm">
          <div>
            <p className="text-white/75">Fiado este mes</p>
            <p className="font-mono tabular text-lg font-semibold">{money(stats.fiadoMes)}</p>
          </div>
          <div>
            <p className="text-white/75">Cobrado este mes</p>
            <p className="font-mono tabular text-lg font-semibold">{money(stats.cobradoMes)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr] md:gap-5">
        {/* Clientes. En el celular se esconde al abrir uno, para no scrollear. */}
        <div className={selected ? 'hidden md:block' : ''}>
          <div className="relative mb-3">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-inkfaint"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q && !exactMatch && visibleCustomers.length === 0) {
                  handleAddCustomer()
                }
              }}
              placeholder="Buscar o agregar cliente"
              aria-label="Buscar o agregar cliente"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 shadow-card transition-colors focus:border-awning focus:outline-none"
            />
          </div>

          {q && !exactMatch && (
            <button
              onClick={handleAddCustomer}
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-awning-200 bg-awning-50 px-4 py-2.5 text-left text-sm font-semibold text-awning-dark transition-colors hover:bg-awning-100"
            >
              <Plus size={16} strokeWidth={2.6} />
              Agregar a “{search.trim()}”
            </button>
          )}

          <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {visibleCustomers.map((c) => {
              const bal = balances[c.id] || 0
              const since = owingSince[c.id]
              const active = selected?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    onClick={() => selectCustomer(c)}
                    className={`flex w-full items-center justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${
                      active ? 'border-awning bg-awning-50' : 'border-transparent hover:bg-paper2/60'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{c.name}</span>
                      <span className="block text-xs text-inkfaint">
                        {since ? `Debe hace ${daysLabel(daysSince(since))}` : 'Al día'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-mono tabular font-semibold ${
                        bal > 0.005 ? 'text-brick' : 'text-inkfaint/60'
                      }`}
                    >
                      {money(Math.max(bal, 0))}
                    </span>
                  </button>
                </li>
              )
            })}
            {visibleCustomers.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-inkfaint">
                {q ? 'No hay ningún cliente con ese nombre.' : 'Todavía no hay clientes.'}
              </li>
            )}
          </ul>
        </div>

        {/* Cuenta del cliente. */}
        {!selected ? (
          <div className="hidden min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-line text-sm text-inkfaint md:flex">
            Elegí un cliente para ver su cuenta.
          </div>
        ) : (
          <CustomerAccount
            customer={selected}
            movements={movements}
            balance={balances[selected.id] || 0}
            entry={entry}
            onEntry={setEntry}
            onSaveEntry={handleSaveEntry}
            onSavePhone={handleSavePhone}
            onBack={() => setSelected(null)}
          />
        )}
      </div>

      {status && (
        <div className="rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
          {status}
        </div>
      )}
    </div>
  )
}

function CustomerAccount({
  customer,
  movements,
  balance,
  entry,
  onEntry,
  onSaveEntry,
  onSavePhone,
  onBack,
}) {
  const summary = accountSummary(movements, balance)
  const owes = balance > 0.005

  // Libreta: del más nuevo al más viejo, con el saldo que quedó después de
  // cada movimiento.
  const rows = useMemo(() => {
    const asc = [...movements].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const withBalance = asc.reduce((acc, m) => {
      const prev = acc.length ? acc[acc.length - 1].after : 0
      acc.push({ ...m, after: prev + (m.type === 'charge' ? 1 : -1) * Number(m.amount) })
      return acc
    }, [])
    return withBalance.reverse()
  }, [movements])

  const message = buildAccountMessage({ customer, movements, balance })

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="p-4 sm:p-6">
        <button
          onClick={onBack}
          className="no-print -ml-1 mb-3 flex items-center gap-1 text-sm font-medium text-inkfaint transition-colors hover:text-ink md:hidden"
        >
          <ArrowLeft size={16} />
          Clientes
        </button>

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 className="break-words font-display text-2xl font-semibold text-ink">
              {customer.name}
            </h2>
            <PhoneField phone={customer.phone} onSave={onSavePhone} />
          </div>
          <div className="text-right">
            <p className="text-sm text-inkfaint">{owes ? 'Debe' : 'Está al día'}</p>
            <p
              className={`font-mono tabular text-3xl font-bold leading-tight ${
                owes ? 'text-brick' : 'text-awning'
              }`}
            >
              {money(Math.max(balance, 0))}
            </p>
          </div>
        </div>

        {owes && (
          <p className="mt-3 rounded-lg bg-paper2/70 px-3 py-2 text-sm text-inkfaint">
            Fió <span className="font-mono font-semibold text-ink">{money(summary.fiado)}</span>
            {' · '}Pagó <span className="font-mono font-semibold text-ink">{money(summary.pagado)}</span>
            {' · '}desde el {fullDate(summary.since)}
          </p>
        )}

        <div className="no-print mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button
            onClick={() => onEntry(entry === 'charge' ? null : 'charge')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-colors ${
              entry === 'charge'
                ? 'bg-brick-dark text-white'
                : 'bg-brick text-white shadow-card hover:bg-brick-dark'
            }`}
          >
            <Plus size={17} strokeWidth={2.6} />
            Anotar fiado
          </button>
          <button
            onClick={() => onEntry(entry === 'payment' ? null : 'payment')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-colors ${
              entry === 'payment'
                ? 'bg-awning-dark text-white'
                : 'bg-awning text-white shadow-card hover:bg-awning-dark'
            }`}
          >
            <Minus size={17} strokeWidth={2.6} />
            Registrar pago
          </button>
          <a
            href={whatsappUrl(customer.phone, message)}
            target="_blank"
            rel="noreferrer"
            title="Mandarle el resumen por WhatsApp"
            aria-label="Mandarle el resumen por WhatsApp"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-[#128C4A] shadow-card transition-colors hover:bg-paper2"
          >
            <MessageCircle size={18} strokeWidth={2.4} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>

        {entry && (
          <EntryForm
            key={entry}
            kind={entry}
            onSave={onSaveEntry}
            onCancel={() => onEntry(null)}
          />
        )}
      </div>

      {/* La libreta. */}
      <div className="border-t border-line">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-inkfaint">Sin movimientos todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-inkfaint">
                <th className="py-2.5 pl-4 pr-2 font-medium sm:pl-6">Fecha</th>
                <th className="px-2 py-2.5 font-medium">Detalle</th>
                <th className="px-2 py-2.5 text-right font-medium">Monto</th>
                <th className="py-2.5 pl-2 pr-4 text-right font-medium sm:pr-6">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70 border-t border-line/70">
              {rows.map((m) => {
                const charge = m.type === 'charge'
                const items = itemsOf(m)
                return (
                  <tr key={m.id} className="align-top">
                    <td
                      className="whitespace-nowrap py-3 pl-4 pr-2 font-mono tabular text-inkfaint sm:pl-6"
                      title={new Date(m.created_at).toLocaleString('es-AR')}
                    >
                      {shortDate(m.created_at)}
                    </td>
                    <td className="px-2 py-3">
                      <p className="text-ink">
                        {charge
                          ? chargeLabel(m)
                          : m.note && m.note !== 'Pago recibido'
                            ? `Pago · ${m.note}`
                            : 'Pago'}
                      </p>
                      {items.length > 0 && (
                        <p className="mt-0.5 text-xs leading-snug text-inkfaint">
                          {items.map((it) => `${it.product_name} ${qtyLabel(it)}`).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td
                      className={`whitespace-nowrap px-2 py-3 text-right font-mono tabular font-semibold ${
                        charge ? 'text-brick' : 'text-awning'
                      }`}
                    >
                      {charge ? '+' : '−'}
                      {money(m.amount)}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right font-mono tabular text-inkfaint sm:pr-6">
                      {money(m.after)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function EntryForm({ kind, onSave, onCancel }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const amountRef = useRef(null)
  const charge = kind === 'charge'

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return
    setBusy(true)
    await onSave({ amount: n, note: note.trim() })
    setBusy(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`no-print mt-3 rounded-xl border p-3 ${
        charge ? 'border-brick-100 bg-brick-50/60' : 'border-awning-100 bg-awning-50/60'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={amountRef}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto $"
          aria-label="Monto"
          className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono tabular text-lg transition-colors focus:border-awning focus:outline-none sm:w-44"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={charge ? 'Qué se llevó (opcional)' : 'Nota (opcional)'}
          aria-label="Nota"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors focus:border-awning focus:outline-none"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-line bg-surface py-2.5 text-sm font-semibold text-inkfaint transition-colors hover:text-ink sm:flex-none sm:px-5"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy || !(Number(amount) > 0)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:bg-paper2 disabled:text-inkfaint/70 sm:flex-none sm:px-6 ${
            charge ? 'bg-brick hover:bg-brick-dark' : 'bg-awning hover:bg-awning-dark'
          }`}
        >
          <Check size={16} strokeWidth={2.6} />
          {charge ? 'Anotar' : 'Guardar pago'}
        </button>
      </div>
    </form>
  )
}

function PhoneField({ phone, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          await onSave(draft.trim())
          setEditing(false)
        }}
        className="mt-2 flex gap-2"
      >
        <input
          type="tel"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
          onClick={() => setEditing(false)}
          className="px-1 text-sm text-inkfaint transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </form>
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(phone || '')
        setEditing(true)
      }}
      className="no-print mt-1 flex items-center gap-1.5 text-sm text-inkfaint transition-colors hover:text-ink"
    >
      <Phone size={14} />
      {phone || 'Agregar WhatsApp'}
      <Pencil size={12} className="opacity-60" />
    </button>
  )
}
