import { useState } from 'react'
import { isSupabaseConfigured } from './lib/supabaseClient'
import SetupNotice from './components/SetupNotice'
import POS from './pages/POS'
import Stock from './pages/Stock'
import Accounts from './pages/Accounts'

const TABS = [
  { id: 'pos', label: 'Facturación', short: 'Facturar' },
  { id: 'stock', label: 'Stock', short: 'Stock' },
  { id: 'accounts', label: 'Cuentas corrientes', short: 'Cuentas' },
]

export default function App() {
  const [tab, setTab] = useState('pos')

  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-paper2 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpeg"
              alt="Despensa San Nicolás"
              className="h-9 sm:h-11 w-auto"
            />
            <h1 className="font-display text-lg font-bold text-ink leading-tight hidden lg:block">
              Despensa San Nicolás
            </h1>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-awning text-white'
                    : 'text-inkfaint hover:bg-paper2'
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {tab === 'pos' && <POS />}
        {tab === 'stock' && <Stock />}
        {tab === 'accounts' && <Accounts />}
      </main>
    </div>
  )
}
