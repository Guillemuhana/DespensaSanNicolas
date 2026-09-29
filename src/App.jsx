import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Beef,
  Bell,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  ReceiptText,
  ScanBarcode,
  LogOut,
  Truck,
  UserCog,
  KeyRound,
  Wallet,
  X,
} from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { ROLE_LABEL, signOut, useSession } from './lib/auth'
import SetupNotice from './components/SetupNotice'
import Login from './components/Login'
import PrintHeader from './components/PrintHeader'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Stock from './pages/Stock'
import Butcher from './pages/Butcher'
import PlaceClock from './components/PlaceClock'
import Accounts from './pages/Accounts'
import Expenses from './pages/Expenses'
import Suppliers from './pages/Suppliers'
import Reminders from './pages/Reminders'
import Users from './pages/Users'
import ChangePasswordModal from './components/ChangePasswordModal'

// Agrupado por lo que se hace en el local: vender, manejar la mercadería
// (lo que se compra para revender) y llevar los números del negocio.
// Facturación primero: es la pantalla donde se pasa el día.
const TABS = [
  {
    id: 'pos',
    section: 'Ventas',
    label: 'Facturación',
    icon: ScanBarcode,
    Page: POS,
    title: 'Facturación',
    description: 'Escaneá, cobrá y entregá el ticket',
    printLabel: null, // el ticket se imprime desde el cobro
  },
  {
    id: 'accounts',
    section: 'Ventas',
    label: 'Cuentas corrientes',
    icon: Wallet,
    Page: Accounts,
    title: 'Cuentas corrientes',
    description: 'Lo que fían los clientes y lo que van pagando',
    printLabel: 'Imprimir resumen',
  },
  {
    id: 'stock',
    section: 'Mercadería',
    label: 'Stock',
    icon: Package,
    Page: Stock,
    title: 'Stock',
    description: 'Productos, precios y reposición',
    printLabel: 'Imprimir lista',
  },
  {
    id: 'butcher',
    section: 'Mercadería',
    label: 'Carnicería',
    icon: Beef,
    Page: Butcher,
    title: 'Carnicería',
    description: 'Cortes, precios por kilo y lo que entró del frigorífico',
    printLabel: 'Imprimir precios',
  },
  {
    id: 'suppliers',
    section: 'Mercadería',
    label: 'Compras',
    icon: Truck,
    Page: Suppliers,
    title: 'Compras',
    description: 'Facturas de proveedores y a quién le comprás',
    printLabel: 'Imprimir listado',
  },
  {
    id: 'home',
    section: 'Negocio',
    label: 'Resumen',
    icon: LayoutDashboard,
    Page: Dashboard,
    title: 'Resumen',
    description: 'Cómo viene el negocio',
    printLabel: 'Imprimir reporte',
  },
  {
    id: 'expenses',
    section: 'Negocio',
    label: 'Gastos',
    icon: ReceiptText,
    Page: Expenses,
    title: 'Gastos',
    description: 'Impuestos, luz, gas, agua, alquiler y más',
    printLabel: 'Imprimir gastos',
  },
  {
    id: 'reminders',
    section: 'Negocio',
    label: 'Recordatorios',
    icon: Bell,
    Page: Reminders,
    title: 'Recordatorios',
    description: 'Pedidos, pagos y vencimientos',
    printLabel: 'Imprimir pendientes',
  },
  {
    id: 'users',
    section: 'Negocio',
    label: 'Usuarios',
    icon: UserCog,
    Page: Users,
    title: 'Usuarios',
    description: 'Quién entra a la app y con qué contraseña',
    printLabel: null,
    adminOnly: true,
  },
]

const COLLAPSED_KEY = 'baratillo:menu-plegado'
export default function App() {
  const { loading, session, profile } = useSession()
  const [changingPassword, setChangingPassword] = useState(false)
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
  if (loading) return <Splash />
  if (!session) return <Login />
  if (!profile) return <NoProfile />

  // Usuarios sólo lo ve el admin.
  const tabs = TABS.filter((t) => !t.adminOnly || profile.role === 'admin')
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]
  const Page = current.Page

  const go = (id) => {
    setTab(id)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-paper">
      <Sidebar
        tabs={tabs}
        tab={current.id}
        go={go}
        profile={profile}
        onLogout={signOut}
        onChangePassword={() => setChangingPassword(true)}
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
                tabs={tabs}
                tab={current.id}
                go={go}
                profile={profile}
                onLogout={signOut}
                onChangePassword={() => {
                  setMenuOpen(false)
                  setChangingPassword(true)
                }}
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
              alt="El Baratillo"
              width="900"
              height="172"
              className="h-8 w-auto min-w-0 shrink sm:h-9 lg:hidden"
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
              <Page profile={profile} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  )
}

// Mientras se averigua si ya había sesión: el logo y nada más.
function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
      <img src="/logo.png" alt="El Baratillo" width="900" height="172" className="h-auto w-48 animate-pulse" />
    </div>
  )
}

// Entró con un usuario de Supabase que no tiene perfil en la app.
function NoProfile() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper p-6">
      <div className="max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
        <p className="font-display text-lg font-semibold text-ink">Tu usuario no está habilitado</p>
        <p className="mt-2 text-sm text-inkfaint">
          Pedile al admin que te dé de alta desde la pantalla Usuarios.
        </p>
        <button
          onClick={signOut}
          className="mt-5 w-full rounded-xl bg-awning py-2.5 font-semibold text-white"
        >
          Volver
        </button>
      </div>
    </div>
  )
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

function Sidebar({
  tabs,
  tab,
  go,
  profile,
  onLogout,
  onChangePassword,
  collapsed,
  onToggle,
  onClose,
  layoutId,
  className = '',
}) {
  const [hovering, setHovering] = useState(false)
  const hoverTimer = useRef(null)
  // Plegada pero con el mouse encima se despliega igual, flotando por arriba
  // del contenido: no empuja la página, así nada se mueve de lugar.
  const expanded = !collapsed || hovering

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  function handleEnter() {
    if (!collapsed) return
    clearTimeout(hoverTimer.current)
    // Un respiro corto para que no se abra sola cuando el puntero apenas pasa.
    hoverTimer.current = setTimeout(() => setHovering(true), 120)
  }

  function handleLeave() {
    clearTimeout(hoverTimer.current)
    setHovering(false)
  }

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`fixed inset-y-0 left-0 z-50 flex-col border-r border-line bg-surface transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        expanded ? 'w-[17rem]' : 'w-[5rem]'
      } ${hovering ? 'shadow-pop' : ''} ${className}`}
    >
      <div
        className={`flex items-center gap-2 pb-4 pt-5 ${
          expanded ? 'justify-between px-5 pt-6' : 'flex-col px-2'
        }`}
      >
        <h1 className="flex min-w-0 items-center">
          {/* Plegado no entra la palabra entera: queda la B del logo. */}
          <img
            src={expanded ? '/logo.png' : '/icon.png'}
            alt=""
            width={expanded ? 900 : 180}
            height={expanded ? 172 : 180}
            className={`select-none ${expanded ? 'h-auto w-full' : 'h-11 w-11 rounded-lg'}`}
            draggable="false"
          />
          <span className="sr-only">El Baratillo</span>
        </h1>

        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Fijar el menú abierto' : 'Plegar el menú'}
            title={collapsed ? 'Fijar el menú abierto' : 'Plegar el menú'}
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

      <nav className={`scroll-soft min-h-0 flex-1 space-y-1 overflow-y-auto ${expanded ? 'px-3' : 'px-2.5'}`}>
        {tabs.map((t, i) => {
          const active = tab === t.id
          const Icon = t.icon
          const newSection = i === 0 || tabs[i - 1].section !== t.section
          return (
            <div key={t.id}>
              {newSection &&
                (expanded ? (
                  <p className="eyebrow px-2 pb-1.5 pt-4 text-inkfaint/70">{t.section}</p>
                ) : (
                  i > 0 && <div className="mx-2 my-2 border-t border-line" />
                ))}
              <button
                onClick={() => go(t.id)}
                aria-current={active ? 'page' : undefined}
                title={expanded ? undefined : t.label}
                className={`group relative flex w-full items-center rounded-[0.875rem] text-left text-sm font-semibold transition-[color,background-color,transform] duration-200 active:scale-[0.98] ${
                  expanded ? 'gap-3 px-2 py-1.5' : 'justify-center px-0 py-1.5'
                } ${active ? 'text-ink' : 'text-inkfaint hover:bg-paper2/70 hover:text-ink'}`}
              >
                {/* La marca de la opción elegida se desliza de una a otra:
                    brillo detrás, borde con degradé que gira y fondo claro. */}
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  >
                    <span className="nav-glow" />
                    <span className="absolute inset-0 rounded-[0.875rem] bg-gradient-to-r from-awning-50 via-surface to-surface" />
                    <span className="nav-ring" />
                  </motion.span>
                )}
                <span
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-br from-awning-400 to-awning text-white shadow-[0_4px_12px_-4px_rgba(7,104,45,0.6)]'
                      : 'bg-paper2/70 text-inkfaint group-hover:bg-surface group-hover:text-awning group-hover:shadow-card'
                  }`}
                >
                  <Icon
                    size={18}
                    strokeWidth={2.2}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />
                </span>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="relative truncate"
                  >
                    {t.label}
                  </motion.span>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      <div className={`border-t border-line py-4 ${expanded ? 'px-5' : 'px-2 text-center'}`}>
        {expanded ? (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-awning-400 to-awning font-display text-xs font-semibold text-white">
                {initials(profile?.full_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-ink">
                  {profile?.full_name}
                </p>
                <p className="truncate text-xs text-inkfaint">{ROLE_LABEL[profile?.role] || ''}</p>
              </div>
            </div>
            <div className="mt-3">
              <PlaceClock />
            </div>
            <div className="mt-2.5 flex items-center gap-4">
              <button
                onClick={onChangePassword}
                className="flex items-center gap-1.5 text-xs font-semibold text-inkfaint transition-colors hover:text-awning"
              >
                <KeyRound size={13} strokeWidth={2.6} />
                Contraseña
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs font-semibold text-inkfaint transition-colors hover:text-brick"
              >
                <LogOut size={13} strokeWidth={2.6} />
                Salir
              </button>
            </div>
          </>
        ) : (
          <>
          <PlaceClock compact />
          <button
            onClick={onLogout}
            aria-label="Salir"
            title="Salir"
            className="mx-auto block rounded-lg p-2 text-inkfaint transition-colors hover:bg-paper2 hover:text-brick"
          >
            <LogOut size={18} strokeWidth={2.4} />
          </button>
          </>
        )}
      </div>
    </aside>
  )
}
