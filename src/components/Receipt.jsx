export default function Receipt({ items, onRemove, total }) {
  const count = items.length

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
      <div className="flex items-center justify-between border-b border-dashed border-line px-5 py-4">
        <p className="eyebrow text-inkfaint">Ticket actual</p>
        {count > 0 && (
          <span className="rounded-full bg-paper2 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-inkfaint">
            {count} {count === 1 ? 'ítem' : 'ítems'}
          </span>
        )}
      </div>

      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-5">
        {count === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 py-8 text-center">
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
                <path d="M3 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20.5 8H6" />
                <circle cx="10" cy="20" r="1.2" />
                <circle cx="17" cy="20" r="1.2" />
              </svg>
            </span>
            <p className="max-w-[22ch] text-sm text-inkfaint">
              Escaneá un código o tocá un producto para empezar.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((it, idx) => (
              <li key={idx} className="animate-rise flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{it.name}</p>
                  <p className="font-mono tabular text-xs text-inkfaint">
                    {it.saleType === 'weight'
                      ? `${it.quantity.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg × $${it.price.toLocaleString('es-AR')}`
                      : `${it.quantity} × $${it.price.toLocaleString('es-AR')}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono tabular font-semibold text-ink">
                    ${it.subtotal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => onRemove(idx)}
                    aria-label={`Quitar ${it.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-inkfaint transition-colors hover:bg-brick-50 hover:text-brick"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="receipt-edge shrink-0" aria-hidden="true" />

      <div className="shrink-0 bg-paper2 px-5 py-4 sm:py-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-lg font-semibold text-ink">Total</span>
          <span className="font-mono tabular text-3xl font-bold text-ink sm:text-4xl">
            ${total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  )
}
