/**
 * Resumen de fiado para mandarle al cliente por WhatsApp o donde sea.
 *
 * No manda la historia entera: arranca desde la última vez que la cuenta quedó
 * en cero, que es lo que el cliente necesita para entender cuánto debe y por
 * qué. Si nunca quedó en cero, van todos los movimientos.
 */

const money = (n) =>
  '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const day = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

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

export function buildAccountMessage({ customer, movements, balance }) {
  const lines = ['*El Baratillo* · Minimercado y carnicería', `Resumen de cuenta de *${customer.name}*`, '']

  if (balance <= 0.005) {
    lines.push('No tenés saldo pendiente. ¡Gracias!')
    return lines.join('\n')
  }

  for (const m of openMovements(movements)) {
    if (m.type === 'charge') {
      lines.push(`${day(m.created_at)} Fiado ${money(m.amount)}`)
      for (const it of itemsOf(m)) {
        lines.push(`   · ${it.product_name} ${qtyLabel(it)} ${money(it.subtotal)}`)
      }
    } else {
      lines.push(`${day(m.created_at)} Pago −${money(m.amount)}`)
    }
  }

  lines.push('', `*Saldo a pagar: ${money(balance)}*`, `Al ${new Date().toLocaleDateString('es-AR')}`)
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
