import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  ReceiptText,
  ScanBarcode,
  Truck,
  Wallet,
  X,
} from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabaseClient'
import SetupNotice from './components/SetupNotice'
import PrintHeader from './components/PrintHeader'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Stock from './pages/Stock'
import Accounts from './pages/Accounts'
import Expenses from './pages/Expenses'
import Suppliers from './pages/Suppliers'
import Reminders from './pages/Reminders'

// Facturación primero: es la pantalla donde se pasa el día.
const TABS = [
  {
    id: 'pos',
    label: 'Facturación',
    icon: ScanBarcode,
    Page: POS,
    title: 'Facturación',
    description: 'Escaneá, cobrá y entregá el ticket',
    printLabel: null, // el ticket se imprime desde el cobro
  },
  {
    id: 'home',
    label: 'Resumen',
    icon: LayoutDashboard,
    Page: Dashboard,
    title: 'Resumen',
    description: 'Cómo viene el negocio',
    printLabel: 'Imprimir reporte',
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: Package,
    Page: Stock,
    title: 'Stock',
    description: 'Productos, precios y reposición',
    printLabel: 'Imprimir lista',
  },
  {
    id: 'accounts',
    label: 'Cuentas corrientes',
    icon: Wallet,
    Page: Accounts,
    title: 'Cuentas corrientes',
    description: 'Saldos, cargos y pagos',
    printLabel: 'Imprimir resumen',
  },
  {
    id: 'reminders',
    label: 'Recordatorios',
    icon: Bell,
    Page: Reminders,
    title: 'Recordatorios',
    description: 'Pedidos, pagos y vencimientos',
    printLabel: 'Imprimir pendientes',
  },
  {
    id: 'suppliers',
    label: 'Proveedores',
    icon: Truck,
    Page: Suppliers,
    title: 'Proveedores',
    description: 'A quién le comprás y cuándo reparte',
    printLabel: 'Imprimir listado',
  },
  {
    id: 'expenses',
    label: 'Gastos',
    icon: ReceiptText,
    Page: Expenses,
    title: 'Gastos',
    description: 'Alquiler, proveedores, servicios',
    printLabel: 'Imprimir gastos',
  },
]

const COLLAPSED_KEY = 'despensa:menu-plegado'

export default function App() {
  const [tab, setTab] = useState('pos')
  const [menuOpen, setMenuOpen] = useState(false)
  // El menú plegado se recuerda entre sesiones: cada uno trabaja como quiere.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Modo incógnito o storage bloqueado: no pasa nada, se pierde la preferencia.
    }
  }, [collapsed])

  // En mobile el menú es un cajón: al elegir una sección se cierra solo, y
  // mientras está abierto no se scrollea el fondo.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  if (!isSupabaseConfigured) return <SetupNotice />

  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const Page = current.Page

  const go = (id) => {
    setTab(id)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-paper">
      <Sidebar
        tab={tab}
        go={go}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        layoutId="nav-active-desktop"
        className="no-print hidden lg:flex"
      />

      {/* Cajón lateral en teléfono y tablet: ahí siempre va desplegado. */}
      <AnimatePresence>
        {menuOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw]"
            >
              <Sidebar
                tab={tab}
                go={go}
                collapsed={false}
                onClose={() => setMenuOpen(false)}
                layoutId="nav-active-mobile"
                className="flex"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div
        className={`transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? 'lg:pl-[5rem]' : 'lg:pl-[17rem]'
        }`}
      >
        <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:py-4">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              className="-ml-1 shrink-0 rounded-lg p-2 text-inkfaint transition-colors hover:bg-paper2 hover:text-ink lg:hidden"
            >
              <Menu size={22} />
            </button>

            <img
              src="/logo.png"
              alt="Despensa San Nicolás"
              className="h-14 w-auto shrink-0 sm:h-16 lg:hidden"
            />

            <div className="hidden min-w-0 lg:block">
              <h2 className="truncate font-display text-xl font-semibold text-ink">
                {current.title}
              </h2>
              <p className="truncate text-sm text-inkfaint">{current.description}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {current.printLabel && (
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-inkfaint shadow-card transition-colors hover:border-awning hover:text-awning"
                >
                  <Printer size={16} strokeWidth={2.2} />
                  <span className="hidden sm:inline">{current.printLabel}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-7">
          <PrintHeader title={current.title} />
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function Sidebar({ tab, go, collapsed, onToggle, onClose, layoutId, className = '' }) {
  const raw = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  // Sólo la primera letra: `capitalize` de CSS daría "Jueves, 27 De Agosto".
  const today = raw.charAt(0).toUpperCase() + raw.slice(1)

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex-col border-r border-line bg-surface transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        collapsed ? 'w-[5rem]' : 'w-[17rem]'
      } ${className}`}
    >
      <div
        className={`flex items-center gap-2 pb-4 pt-5 ${
          collapsed ? 'flex-col px-2' : 'justify-between px-5 pt-6'
        }`}
      >
        <h1 className="flex min-w-0 items-center">
          <img
            src="/logo.png"
            alt=""
            width="528"
            height="420"
            className={`w-auto select-none transition-all duration-300 ${
              collapsed ? 'h-11' : 'h-28'
            }`}
            draggable="false"
          />
          <span className="sr-only">Despensa San Nicolás</span>
        </h1>

        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Desplegar menú' : 'Plegar menú'}
            title={collapsed ? 'Desplegar menú' : 'Plegar menú'}
            className="shrink-0 rounded-lg p-2 text-inkfaint transition-colors hover:bg-paper2 hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="shrink-0 rounded-lg p-2 text-inkfaint transition-colors hover:bg-paper2 hover:text-ink"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-1 ${collapsed ? 'px-2.5' : 'px-3'}`}>
        {!collapsed && <p className="eyebrow px-2 pb-2 pt-3 text-inkfaint/70">Menú</p>}
        {TABS.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? t.label : undefined}
              className={`group relative flex w-full items-center rounded-xl text-left text-sm font-semibold transition-colors ${
                collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'
              } ${active ? 'text-awning-dark' : 'text-inkfaint hover:bg-paper2/70 hover:text-ink'}`}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-xl bg-awning-50 ring-1 ring-awning-100"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon size={19} strokeWidth={2.2} className="relative shrink-0" />
              {!collapsed && <span className="relative truncate">{t.label}</span>}

              {/* Plegado, el nombre aparece al pasar el mouse. */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100">
                  {t.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className={`border-t border-line py-4 ${collapsed ? 'px-2 text-center' : 'px-5'}`}>
        {collapsed ? (
          <p className="font-display text-sm font-semibold text-ink">SN</p>
        ) : (
          <>
            <p className="font-display text-sm font-semibold text-ink">Despensa San Nicolás</p>
            <p className="mt-0.5 text-xs text-inkfaint">{today}</p>
          </>
        )}
      </div>
    </aside>
  )
}
