import { createPortal } from 'react-dom'

const money = (n) =>
  '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })

/**
 * Comprobante de 80 mm para la impresora del mostrador.
 *
 * Se monta en un portal colgado del <body> (fuera de #root) para que, al
 * imprimir, podamos ocultar la app entera y quede sólo el papel. Ver las
 * reglas `body.printing-ticket` en index.css.
 */
export default function TicketPrint({ sale }) {
  if (!sale) return null

  const when = new Date(sale.created_at).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const short = String(sale.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()

  return createPortal(
    <div className="ticket-sheet">
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <img
          src="/logo.jpeg"
          alt=""
          style={{ width: '24mm', height: 'auto', margin: '0 auto 4px' }}
        />
        <div style={{ fontWeight: 700, fontSize: '13px' }}>FIRENZE STORE</div>
        <div style={{ fontSize: '10px' }}>Comprobante no válido como factura</div>
      </div>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '10px' }}>
        <div>Fecha: {when}</div>
        {short && <div>Ticket: #{short}</div>}
        <div>Pago: {sale.payment_method === 'account' ? 'Cuenta corriente' : 'Efectivo'}</div>
        {sale.customerName && <div>Cliente: {sale.customerName}</div>}
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          margin: '6px 0',
          borderTop: '1px dashed #000',
          borderBottom: '1px dashed #000',
        }}
      >
        <tbody>
          {(sale.items || []).map((it, i) => (
            <tr key={i}>
              <td style={{ padding: '2px 0', verticalAlign: 'top' }}>
                <div>{it.name}</div>
                <div style={{ fontSize: '10px' }}>
                  {`${it.quantity} x ${money(it.price)}`}
                </div>
              </td>
              <td
                style={{
                  padding: '2px 0',
                  textAlign: 'right',
                  verticalAlign: 'top',
                  whiteSpace: 'nowrap',
                }}
              >
                {money(it.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', fontSize: '12px' }}>
        <tbody>
          <tr style={{ fontWeight: 700, fontSize: '14px' }}>
            <td>TOTAL</td>
            <td style={{ textAlign: 'right' }}>{money(sale.total)}</td>
          </tr>
          {sale.payment_method === 'cash' && sale.paid_amount != null && (
            <>
              <tr>
                <td>Paga con</td>
                <td style={{ textAlign: 'right' }}>{money(sale.paid_amount)}</td>
              </tr>
              <tr>
                <td>Vuelto</td>
                <td style={{ textAlign: 'right' }}>{money(sale.changeDue ?? 0)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px' }}>
        <div>¡Gracias por su compra!</div>
      </div>
    </div>,
    document.body
  )
}
