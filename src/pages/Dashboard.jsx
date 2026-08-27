import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import {
  fetchSalesSince,
  fetchSaleItemsSince,
  fetchProducts,
  fetchAllBalances,
  fetchCustomers,
  fetchExpenses,
  fetchReminders,
} from '../lib/queries'

// Curva de salida suave, la misma en toda la app.
const EASE = [0.22, 1, 0.36, 1]
const grow = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: EASE, delay },
})

// Los dos colores de la marca. Validados para daltonismo como par categórico
// (ΔE 20.9 en protanopía), así que alcanzan para separar efectivo de fiado.
const CASH = '#086AB3'
const ACCOUNT = '#D52E28'

const DAYS_WINDOW = 35
const money = (n, max = 0) =>
  '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: max })

/** Versión corta para los ejes, donde no entra el número entero. */
const moneyShort = (n) => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M'
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'k'
  return '$' + Math.round(n)
}

/** Sólo la primera letra en mayúscula: `capitalize` de CSS daría "22 De Agosto". */
const sentence = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Clave YYYY-MM-DD en hora local (no UTC: si no, las ventas de la noche se corren de día). */
function dayKey(d) {
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function startOfDayISO(daysAgo) {
  const t = new Date()
  t.setDate(t.getDate() - daysAgo)
  t.setHours(0, 0, 0, 0)
  return t.toISOString()
}

export default function Dashboard() {
  const [sales, setSales] = useState([])
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [balances, setBalances] = useState({})
  const [customers, setCustomers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const since = startOfDayISO(DAYS_WINDOW)
        // El detalle por renglón sólo para la ventana corta (es lo pesado);
        // las ventas del año son una fila cada una, así que entran holgadas.
        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
        const [s, it, p, b, c, ex, rem] = await Promise.all([
          fetchSalesSince(yearStart),
          fetchSaleItemsSince(since),
          fetchProducts(),
          fetchAllBalances(),
          fetchCustomers(),
          // Si todavía no se corrió la migración 002 la tabla no existe.
          fetchExpenses().catch(() => []),
          fetchReminders().catch(() => []),
        ])
        if (!alive) return
        setSales(s)
        setItems(it)
        setProducts(p)
        setBalances(b)
        setCustomers(c)
        setExpenses(ex)
        setReminders(rem)
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const stats = useMemo(() => {
    const today = dayKey(new Date())
    const byDay = new Map()
    for (const s of sales) {
      const k = dayKey(s.created_at)
      const cur = byDay.get(k) || { total: 0, count: 0 }
      cur.total += Number(s.total)
      cur.count += 1
      byDay.set(k, cur)
    }

    // Serie continua de 14 días, con los días sin ventas en cero.
    const daily = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const k = dayKey(d)
      const v = byDay.get(k) || { total: 0, count: 0 }
      daily.push({ key: k, date: d, total: v.total, count: v.count })
    }

    const sumRange = (from, to) => {
      let total = 0
      let count = 0
      for (let i = from; i < to; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const v = byDay.get(dayKey(d))
        if (v) {
          total += v.total
          count += v.count
        }
      }
      return { total, count }
    }
    const last7 = sumRange(0, 7)
    const prev7 = sumRange(7, 14)
    const trend = prev7.total > 0 ? ((last7.total - prev7.total) / prev7.total) * 100 : null

    const todayStats = byDay.get(today) || { total: 0, count: 0 }

    const revenue = sales.reduce((s, v) => s + Number(v.total), 0)
    const avgTicket = sales.length ? revenue / sales.length : 0

    // `sales` trae el año entero (lo necesita la tabla de ganancias), pero los
    // gráficos de abajo hablan de los últimos 35 días: hay que recortar.
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - DAYS_WINDOW)
    windowStart.setHours(0, 0, 0, 0)
    const windowSales = sales.filter((v) => new Date(v.created_at) >= windowStart)

    const windowRevenue = windowSales.reduce((s, v) => s + Number(v.total), 0)
    const cash = windowSales
      .filter((s) => s.payment_method === 'cash')
      .reduce((s, v) => s + Number(v.total), 0)
    const account = windowRevenue - cash

    // Top productos por facturación de los últimos 35 días.
    const byProduct = new Map()
    for (const it of items) {
      const cur = byProduct.get(it.product_name) || { revenue: 0, qty: 0 }
      cur.revenue += Number(it.subtotal)
      cur.qty += Number(it.quantity)
      byProduct.set(it.product_name, cur)
    }
    const topProducts = [...byProduct.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    // Ventas por hora, para saber cuándo conviene tener a alguien más en el mostrador.
    const hours = Array.from({ length: 15 }, (_, i) => ({ hour: i + 7, total: 0 }))
    for (const s of windowSales) {
      const h = new Date(s.created_at).getHours()
      const slot = hours.find((x) => x.hour === h)
      if (slot) slot.total += Number(s.total)
    }

    const lowStock = products
      .filter((p) => Number(p.stock) <= Number(p.min_stock))
      .sort((a, b) => Number(a.stock) - Number(b.stock))

    // ---- Ganancias por período (hoy / mes / año)
    const now = new Date()
    const inPeriod = {
      day: (d) => dayKey(d) === today,
      month: (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
      year: (d) => d.getFullYear() === now.getFullYear(),
    }
    const periodOf = (key) => {
      const rows = sales.filter((v) => inPeriod[key](new Date(v.created_at)))
      const ventas = rows.reduce((a, v) => a + Number(v.total), 0)
      const costo = rows.reduce((a, v) => a + Number(v.cost_total || 0), 0)
      const gastos = expenses
        .filter((e) => inPeriod[key](new Date(e.spent_on + 'T00:00:00')))
        .reduce((a, e) => a + Number(e.amount), 0)
      return { ventas, costo, bruta: ventas - costo, gastos, neto: ventas - costo - gastos }
    }
    const profit = { day: periodOf('day'), month: periodOf('month'), year: periodOf('year') }
    // Sin costos cargados la "ganancia" sería igual a la venta: mejor avisar.
    const hasCosts = profit.year.costo > 0

    const totalDebt = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0)
    const debtors = customers
      .map((c) => ({ ...c, balance: balances[c.id] || 0 }))
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)

    return {
      daily,
      todayStats,
      last7,
      trend,
      revenue,
      avgTicket,
      cash,
      account,
      topProducts,
      hours,
      lowStock,
      totalDebt,
      debtors,
      profit,
      hasCosts,
    }
  }, [sales, items, products, balances, customers, expenses])

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-paper2/70" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-paper2/70" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm font-medium text-brick-dark">
        No se pudieron cargar las estadísticas: {error}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Ventas de hoy"
          value={money(stats.todayStats.total)}
          sub={`${stats.todayStats.count} ${stats.todayStats.count === 1 ? 'ticket' : 'tickets'}`}
          delay={0}
        />
        <StatTile
          label="Últimos 7 días"
          value={money(stats.last7.total)}
          trend={stats.trend}
          sub="vs. los 7 anteriores"
          delay={0.05}
        />
        <StatTile
          label="Ticket promedio"
          value={money(stats.avgTicket)}
          sub={`sobre ${sales.length} ventas del año`}
          delay={0.1}
        />
        <StatTile
          label="Total a cobrar"
          value={money(stats.totalDebt)}
          sub={`${stats.debtors.length} ${stats.debtors.length === 1 ? 'cliente debe' : 'clientes deben'}`}
          accent
          delay={0.15}
        />
      </div>

      <DailyChart daily={stats.daily} />

      <ProfitTable profit={stats.profit} hasCosts={stats.hasCosts} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_380px]">
        <TopProducts products={stats.topProducts} />
        <div className="grid gap-4 sm:gap-5">
          <PaymentSplit cash={stats.cash} account={stats.account} />
          <HourChart hours={stats.hours} />
        </div>
      </div>

      <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-2">
        <PendingReminders reminders={reminders} />
        <LowStock products={stats.lowStock} />
        <Debtors debtors={stats.debtors} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- piezas */

function Card({ title, hint, children, action, delay = 0 }) {
  return (
    <motion.section
      {...grow(delay)}
      className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-lift sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-inkfaint">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  )
}

function StatTile({ label, value, sub, trend, accent, delay = 0 }) {
  return (
    <motion.div
      {...grow(delay)}
      className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-lift"
    >
      <p className="eyebrow text-inkfaint">{label}</p>
      <p
        className={`mt-1.5 font-mono tabular text-2xl font-bold leading-none sm:text-[1.75rem] ${
          accent ? 'text-brick' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {typeof trend === 'number' && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              trend >= 0 ? 'bg-awning-50 text-awning-dark' : 'bg-brick-50 text-brick-dark'
            }`}
          >
            {trend >= 0 ? (
              <TrendingUp size={12} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <TrendingDown size={12} strokeWidth={2.6} aria-hidden="true" />
            )}
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(0)}%
          </span>
        )}
        {sub && <span className="text-xs text-inkfaint">{sub}</span>}
      </div>
    </motion.div>
  )
}

/** Columnas de facturación diaria. Una sola serie: un solo tono, sin leyenda. */
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null)
  const [asTable, setAsTable] = useState(false)
  const max = Math.max(...daily.map((d) => d.total), 1)
  const best = daily.reduce((a, b) => (b.total > a.total ? b : a), daily[0])

  const dayLabel = (d) =>
    d.date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
  const fullLabel = (d) =>
    sentence(d.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))

  return (
    <Card
      title="Facturación por día"
      hint="Últimos 14 días"
      delay={0.2}
      action={
        <button
          onClick={() => setAsTable((v) => !v)}
          className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-inkfaint transition-colors hover:border-awning hover:text-awning"
        >
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      }
    >
      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left">
                <th className="eyebrow py-2 font-medium text-inkfaint">Día</th>
                <th className="eyebrow py-2 text-right font-medium text-inkfaint">Tickets</th>
                <th className="eyebrow py-2 text-right font-medium text-inkfaint">Facturado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {[...daily].reverse().map((d) => (
                <tr key={d.key}>
                  <td className="py-2">{fullLabel(d)}</td>
                  <td className="py-2 text-right font-mono tabular text-inkfaint">{d.count}</td>
                  <td className="py-2 text-right font-mono tabular font-semibold">
                    {money(d.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* Grilla de fondo, deliberadamente tenue. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-44">
            {[0, 0.5, 1].map((f) => (
              <div
                key={f}
                className="absolute inset-x-0 border-t border-line/60"
                style={{ top: `${f * 100}%` }}
              >
                <span className="absolute -top-2 left-0 bg-surface pr-1.5 font-mono text-[10px] text-inkfaint/80">
                  {moneyShort(max * (1 - f))}
                </span>
              </div>
            ))}
          </div>

          <ul className="relative flex h-44 items-end gap-[3px] pl-11">
            {daily.map((d, i) => {
              const pct = (d.total / max) * 100
              const isHover = hover === i
              return (
                <li
                  key={d.key}
                  className="group relative flex h-full flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <motion.div
                    className="w-full rounded-t-[4px]"
                    initial={{ height: 0 }}
                    animate={{
                      height: `${Math.max(pct, 1.5)}%`,
                      opacity: hover === null || isHover ? 1 : 0.45,
                    }}
                    transition={{
                      height: { duration: 0.5, ease: EASE, delay: 0.25 + i * 0.025 },
                      opacity: { duration: 0.15 },
                    }}
                    style={{ background: CASH }}
                  />
                  {isHover && (
                    <div
                      className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[180px] rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-pop ${
                        i > daily.length - 4 ? 'right-0' : i < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2'
                      }`}
                    >
                      <p className="text-white/70">{fullLabel(d)}</p>
                      <p className="font-mono tabular font-semibold">{money(d.total)}</p>
                      <p className="text-white/70">
                        {d.count} {d.count === 1 ? 'ticket' : 'tickets'}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-2 flex gap-[3px] pl-11">
            {daily.map((d) => (
              <span
                key={d.key}
                className="flex-1 text-center text-[10px] capitalize text-inkfaint"
              >
                {dayLabel(d)}
              </span>
            ))}
          </div>

          {/* Etiqueta directa sólo en el día pico: no un número sobre cada barra. */}
          <p className="mt-3 border-t border-line pt-3 text-xs text-inkfaint">
            Mejor día:{' '}
            <span className="font-semibold text-ink">{fullLabel(best)}</span> con{' '}
            <span className="font-mono tabular font-semibold text-ink">{money(best.total)}</span>
          </p>
        </div>
      )}
    </Card>
  )
}

/** Ranking por facturación: barras horizontales, un solo tono. */
function TopProducts({ products }) {
  const max = Math.max(...products.map((p) => p.revenue), 1)
  return (
    <Card title="Productos más vendidos" hint="Por facturación, últimos 35 días" delay={0.25}>
      {products.length === 0 ? (
        <p className="py-8 text-center text-sm text-inkfaint">Todavía no hay ventas.</p>
      ) : (
        <ul className="space-y-2.5">
          {products.map((p, i) => (
            <li key={p.name}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-ink">{p.name}</span>
                <span className="shrink-0 font-mono tabular text-sm font-semibold text-ink">
                  {money(p.revenue)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper2">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(p.revenue / max) * 100}%` }}
                  transition={{ duration: 0.55, ease: EASE, delay: 0.2 + i * 0.05 }}
                  style={{ background: CASH }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Parte-todo con dos series: barra apilada + leyenda + etiquetas directas. */
function PaymentSplit({ cash, account }) {
  const total = cash + account
  const cashPct = total ? (cash / total) * 100 : 0
  const accountPct = total ? (account / total) * 100 : 0

  return (
    <Card title="Cómo pagan" hint="Últimos 35 días" delay={0.3}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-paper2">
        <motion.div
          className="rounded-l-full rounded-r-[2px]"
          initial={{ width: 0 }}
          animate={{ width: `${cashPct}%` }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
          style={{ background: CASH }}
        />
        <motion.div
          className="rounded-l-[2px] rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${accountPct}%` }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
          style={{ background: ACCOUNT }}
        />
      </div>
      <ul className="mt-4 space-y-2.5">
        {[
          { label: 'Efectivo', value: cash, pct: cashPct, color: CASH },
          { label: 'Cuenta corriente', value: account, pct: accountPct, color: ACCOUNT },
        ].map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
              <span className="truncate text-inkfaint">{row.label}</span>
            </span>
            <span className="shrink-0 font-mono tabular">
              <span className="font-semibold text-ink">{money(row.value)}</span>
              <span className="ml-2 text-inkfaint">{row.pct.toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** A qué hora se vende más. Una sola serie, mismo tono. */
function HourChart({ hours }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...hours.map((h) => h.total), 1)
  const peak = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0])

  return (
    <Card title="Horario de mayor venta" hint="Acumulado de los últimos 35 días" delay={0.35}>
      <ul className="flex h-24 items-end gap-[2px]">
        {hours.map((h, i) => (
          <li
            key={h.hour}
            className="relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <motion.div
              className="w-full rounded-t-[4px]"
              initial={{ height: 0 }}
              animate={{
                height: `${Math.max((h.total / max) * 100, 2)}%`,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
              transition={{
                height: { duration: 0.45, ease: EASE, delay: 0.3 + i * 0.02 },
                opacity: { duration: 0.15 },
              }}
              style={{ background: CASH }}
            />
            {hover === i && (
              <div
                className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-pop ${
                  i > hours.length - 4 ? 'right-0' : i < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2'
                }`}
              >
                <p className="text-white/70">{h.hour}:00 a {h.hour + 1}:00</p>
                <p className="font-mono tabular font-semibold">{money(h.total)}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-[2px]">
        {hours.map((h) => (
          <span key={h.hour} className="flex-1 text-center text-[10px] text-inkfaint">
            {h.hour % 3 === 0 ? h.hour : ''}
          </span>
        ))}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-xs text-inkfaint">
        Pico entre las{' '}
        <span className="font-semibold text-ink">
          {peak.hour}:00 y las {peak.hour + 1}:00
        </span>
      </p>
    </Card>
  )
}

function LowStock({ products }) {
  return (
    <Card title="Reponer" hint="Productos en o por debajo del mínimo" delay={0.4}>
      {products.length === 0 ? (
        <p className="py-8 text-center text-sm text-inkfaint">
          Ningún producto está por debajo del mínimo.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{p.name}</span>
              <span className="shrink-0 rounded-full bg-brick-50 px-2.5 py-1 font-mono tabular text-xs font-semibold text-brick-dark">
                {Number(p.stock).toLocaleString('es-AR', { maximumFractionDigits: 3 })}
                {p.sale_type === 'weight' ? ' kg' : ' un.'}
                <span className="font-normal text-brick-dark/70">
                  {' '}
                  / mín {Number(p.min_stock).toLocaleString('es-AR')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Debtors({ debtors }) {
  const max = Math.max(...debtors.map((d) => d.balance), 1)
  return (
    <Card title="Quién debe" hint="Saldos de cuenta corriente" delay={0.45}>
      {debtors.length === 0 ? (
        <p className="py-8 text-center text-sm text-inkfaint">Nadie tiene saldo pendiente.</p>
      ) : (
        <ul className="space-y-2.5">
          {debtors.map((d, i) => (
            <li key={d.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-ink">{d.name}</span>
                <span className="shrink-0 font-mono tabular text-sm font-semibold text-brick">
                  {money(d.balance)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper2">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.balance / max) * 100}%` }}
                  transition={{ duration: 0.55, ease: EASE, delay: 0.2 + i * 0.05 }}
                  style={{ background: ACCOUNT }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/**
 * Ganancias del día, del mes y del año.
 *
 *   ventas − costo de la mercadería  = ganancia bruta
 *   ganancia bruta − gastos          = resultado neto
 *
 * El costo sale de `sales.cost_total`, congelado en el momento de la venta.
 */
function ProfitTable({ profit, hasCosts }) {
  const COLS = [
    { key: 'day', label: 'Hoy' },
    { key: 'month', label: 'Este mes' },
    { key: 'year', label: 'Este año' },
  ]
  const ROWS = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'costo', label: 'Costo de mercadería', negative: true },
    { key: 'bruta', label: 'Ganancia bruta', strong: true },
    { key: 'gastos', label: 'Gastos', negative: true },
  ]

  return (
    <Card title="Ganancias" hint="Ventas menos costo de mercadería y gastos" delay={0.22}>
      {!hasCosts && (
        <p className="mb-4 rounded-xl border border-awning-100 bg-awning-50 px-4 py-3 text-sm text-awning-dark">
          Todavía no hay costos de compra cargados, así que la ganancia todavía no
          se puede calcular. Cargá el costo de cada producto desde la pestaña Stock.
        </p>
      )}
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="eyebrow py-2 pl-1 font-medium text-inkfaint">Concepto</th>
              {COLS.map((c) => (
                <th key={c.key} className="eyebrow py-2 pr-1 text-right font-medium text-inkfaint">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {ROWS.map((r) => (
              <tr key={r.key}>
                <td className={`py-2.5 pl-1 ${r.strong ? 'font-semibold text-ink' : 'text-inkfaint'}`}>
                  {r.label}
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2.5 pr-1 text-right font-mono tabular ${
                      r.strong ? 'font-semibold text-ink' : r.negative ? 'text-brick' : 'text-ink'
                    }`}
                  >
                    {r.negative && profit[c.key][r.key] > 0 ? '−' : ''}
                    {money(profit[c.key][r.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-ink">
              <td className="py-3 pl-1 font-display font-semibold text-ink">Resultado</td>
              {COLS.map((c) => {
                const v = profit[c.key].neto
                return (
                  <td
                    key={c.key}
                    className={`py-3 pr-1 text-right font-mono tabular text-lg font-bold ${
                      v >= 0 ? 'text-awning' : 'text-brick'
                    }`}
                  >
                    {money(v)}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Lo que hay que hacer: vencidos primero, después la semana que viene. */
function PendingReminders({ reminders }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntil = (iso) => Math.round((new Date(iso + 'T00:00:00') - today) / 86400000)

  const pending = reminders
    .filter((r) => !r.done && daysUntil(r.due_on) <= 7)
    .sort((a, b) => daysUntil(a.due_on) - daysUntil(b.due_on))
    .slice(0, 8)

  const whenLabel = (iso) => {
    const d = daysUntil(iso)
    if (d < -1) return `Atrasado ${Math.abs(d)} d`
    if (d === -1) return 'Era ayer'
    if (d === 0) return 'Hoy'
    if (d === 1) return 'Mañana'
    return `En ${d} d`
  }

  return (
    <Card title="Pendientes" hint="Vencidos y de acá a una semana" delay={0.42}>
      {pending.length === 0 ? (
        <p className="py-8 text-center text-sm text-inkfaint">No tenés nada pendiente.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {pending.map((r) => {
            const late = daysUntil(r.due_on) < 0
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.title}</p>
                  {r.suppliers?.name && (
                    <p className="truncate text-xs text-inkfaint">{r.suppliers.name}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                    late ? 'bg-brick-50 text-brick-dark' : 'bg-awning-50 text-awning-dark'
                  }`}
                >
                  {whenLabel(r.due_on)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
