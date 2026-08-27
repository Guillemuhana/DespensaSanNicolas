export default function Receipt({ items, onRemove, total }) {
  return (
    <div className="bg-white border border-paper2 rounded-t-md shadow-sm flex flex-col h-full">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-dashed border-paper2">
        <p className="font-mono text-xs tracking-widest text-inkfaint uppercase">Ticket actual</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3">
        {items.length === 0 ? (
          <p className="text-inkfaint text-sm py-8 text-center">
            Escaneá o buscá un producto para empezar.
          </p>
        ) : (
          <ul className="divide-y divide-paper2">
            {items.map((it, idx) => (
              <li key={idx} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink font-medium truncate">{it.name}</p>
                  <p className="text-inkfaint text-xs font-mono tabular">
                    {it.saleType === 'weight'
                      ? `${it.quantity.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg × $${it.price.toLocaleString('es-AR')}`
                      : `${it.quantity} × $${it.price.toLocaleString('es-AR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular font-medium">
                    ${it.subtotal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => onRemove(idx)}
                    aria-label={`Quitar ${it.name}`}
                    className="text-inkfaint hover:text-brick text-xl leading-none px-1 py-0.5"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="receipt-edge" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 sm:py-5 bg-paper2/60 rounded-b-md">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg text-ink">Total</span>
          <span className="font-mono tabular text-2xl sm:text-3xl font-semibold text-ink">
            ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  )
}
