import { Minus, Plus, X } from 'lucide-react'

export default function Receipt({ items, onRemove, onChangeQty, total }) {
  const count = items.length
  const units = items.reduce((n, it) => n + (it.saleType === 'unit' ? it.quantity : 1), 0)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
      <div className="flex items-center justify-between border-b border-dashed border-line px-5 py-4">
        <p className="eyebrow text-inkfaint">Ticket actual</p>
        {count > 0 && (
          <span className="rounded-full bg-paper2 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-inkfaint">
            {units} {units === 1 ? 'ítem' : 'ítems'}
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
              Escaneá un código o buscá el producto por nombre.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((it, idx) => (
              <li key={idx} className="animate-rise flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium leading-snug text-ink">{it.name}</p>
                  <p className="font-mono tabular text-xs text-inkfaint">
                    {it.saleType === 'weight'
                      ? `${it.quantity.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg × $${it.price.toLocaleString('es-AR')}`
                      : `$${it.price.toLocaleString('es-AR')} c/u`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  {/* Los de peso se cargan por importe: no tienen +/-. */}
                  {it.saleType === 'unit' && onChangeQty && (
                    <div className="flex items-center gap-0.5 rounded-lg bg-paper2 p-0.5">
                      <button
                        onClick={() => onChangeQty(idx, -1)}
                        aria-label={`Quitar una unidad de ${it.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-inkfaint transition-colors hover:bg-surface hover:text-ink"
                      >
                        <Minus size={14} strokeWidth={2.6} />
                      </button>
                      <span className="w-6 text-center font-mono tabular text-sm font-semibold text-ink">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => onChangeQty(idx, 1)}
                        aria-label={`Agregar una unidad de ${it.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-inkfaint transition-colors hover:bg-surface hover:text-ink"
                      >
                        <Plus size={14} strokeWidth={2.6} />
                      </button>
                    </div>
                  )}

                  <span className="w-[5.5rem] text-right font-mono tabular font-semibold text-ink">
                    ${it.subtotal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </span>

                  <button
                    onClick={() => onRemove(idx)}
                    aria-label={`Quitar ${it.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-inkfaint transition-colors hover:bg-brick-50 hover:text-brick"
                  >
                    <X size={15} strokeWidth={2.4} />
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
