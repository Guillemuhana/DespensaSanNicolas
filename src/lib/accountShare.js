/**
 * Resumen de fiado para mandarle al cliente por WhatsApp o donde sea.
 *
 * No manda la historia entera: arranca desde la última vez que la cuenta quedó
 * en cero, que es lo que el cliente necesita para entender cuánto debe y por
 * qué. Si nunca quedó en cero, van todos los movimientos.
 */

export const money = (n) =>
  '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const fullDate = (d) =>
  new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Lo que se llevó en una venta fiada, desde el embed de fetchAccountMovements. */
export function itemsOf(movement) {
  return movement.sales?.sale_items ?? []
}

/** "0,750 kg" para lo que va por peso, "2 ×" para lo que va por unidad. */
export function qtyLabel(item) {
  const q = Number(item.quantity)
  return item.products?.sale_type === 'weight'
    ? `${q.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
    : `${q.toLocaleString('es-AR')} ×`
}

/** Movimientos desde que la cuenta estuvo en cero por última vez, del más viejo al más nuevo. */
export function openMovements(movements) {
  const asc = [...movements].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let running = 0
  let start = 0
  asc.forEach((m, i) => {
    running += (m.type === 'charge' ? 1 : -1) * Number(m.amount)
    if (running <= 0.005) start = i + 1
  })
  return asc.slice(start)
}

/**
 * Los números de la cuenta abierta: cuánto fió, cuánto pagó, desde cuándo y
 * cuándo fue el último pago. fiado - pagado + anterior da siempre el saldo;
 * `anterior` sólo es distinto de cero si la última vez pagó de más y le quedó
 * saldo a favor.
 */
export function accountSummary(movements, balance) {
  const open = openMovements(movements)
  let fiado = 0
  let pagado = 0
  let lastPayment = null
  for (const m of open) {
    if (m.type === 'charge') fiado += Number(m.amount)
    else {
      pagado += Number(m.amount)
      lastPayment = m
    }
  }
  const anterior = balance - (fiado - pagado)
  return {
    open,
    fiado,
    pagado,
    anterior: Math.abs(anterior) > 0.005 ? anterior : 0,
    since: open[0]?.created_at ?? null,
    lastPayment,
  }
}

/** "Saldo a favor anterior: −$1.000" si había pagado de más, "Saldo anterior: $500" si no. */
export function anteriorLabel(anterior) {
  return anterior < 0
    ? `Saldo a favor anterior: −${money(-anterior)}`
    : `Saldo anterior: ${money(anterior)}`
}

export function chargeLabel(m) {
  // Los anotados a mano traen lo que se llevó en la nota; los de Facturación
  // traen el detalle de productos aparte.
  return m.note && m.note !== 'Fiado' && m.note !== 'Venta a cuenta' ? m.note : 'Fiado'
}

export function buildAccountMessage({ customer, movements, balance }) {
  const lines = [
    '*EL BARATILLO* · Minimercado y carnicería',
    `Cuenta de *${customer.name}*`,
    `Fecha: ${fullDate(new Date())}`,
    '',
  ]

  if (balance <= 0.005) {
    lines.push('✅ No tenés saldo pendiente. ¡Gracias!')
    return lines.join('\n')
  }

  const sum = accountSummary(movements, balance)

  lines.push('*Detalle*')
  for (const m of sum.open) {
    if (m.type === 'charge') {
      lines.push(`${fullDate(m.created_at)}  ${chargeLabel(m)}  ${money(m.amount)}`)
      for (const it of itemsOf(m)) {
        lines.push(`      ${it.product_name} ${qtyLabel(it)} ${money(it.subtotal)}`)
      }
    } else {
      lines.push(`${fullDate(m.created_at)}  Pago  −${money(m.amount)}`)
    }
  }

  lines.push('', '*Resumen*')
  if (sum.anterior) lines.push(anteriorLabel(sum.anterior))
  lines.push(`Total fiado: ${money(sum.fiado)}`)
  lines.push(`Total pagado: ${money(sum.pagado)}`)
  lines.push(`*SALDO A PAGAR: ${money(balance)}*`)
  return lines.join('\n')
}

/**
 * Link de WhatsApp. Con teléfono va directo al chat del cliente; sin teléfono
 * WhatsApp pide elegir a quién mandarlo. Los números se guardan como los anota
 * la gente ("11 2345-6789", "0341 15 555 1234"): se sacan el 0 de la
 * característica y el 15, y se arma el formato internacional de Argentina
 * (54 9 + característica + número).
 */
export function whatsappUrl(phone, text) {
  const digits = normalizeArPhone(phone)
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(text)}`
}

export function normalizeArPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('54')) {
    d = d.slice(2)
    if (d.startsWith('9')) d = d.slice(1)
  }
  if (d.startsWith('0')) d = d.slice(1)
  // El 15 va después de la característica (2 a 4 dígitos). Sólo se saca si
  // lo que queda tiene el largo de un número argentino completo (10 dígitos).
  if (d.length === 12) {
    for (const len of [2, 3, 4]) {
      if (d.slice(len, len + 2) === '15') {
        d = d.slice(0, len) + d.slice(len + 2)
        break
      }
    }
  }
  return d.length === 10 ? `549${d}` : d
}
