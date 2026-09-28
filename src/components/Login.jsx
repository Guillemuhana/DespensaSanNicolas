import { useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { ArrowRight, Check, Eye, EyeOff, Lock } from 'lucide-react'

// La contraseña se valida en el navegador: sirve para que no entre cualquiera
// que abra el link, no como seguridad fuerte (queda dentro del JS publicado).
const PASSWORD = '+6Elbaratillo27'

const EASE = [0.22, 1, 0.36, 1]

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const shake = useAnimationControls()

  async function handleSubmit(e) {
    e.preventDefault()
    if (success) return
    if (password !== PASSWORD) {
      setError('Contraseña incorrecta')
      setPassword('')
      shake.start({ x: [0, -12, 12, -8, 8, -4, 4, 0], transition: { duration: 0.45 } })
      return
    }
    setError(null)
    setSuccess(true)
    // Un instante para que se vea el tilde antes de entrar.
    setTimeout(onLogin, 650)
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0B2A17] p-4 sm:p-6">
      <Backdrop />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative w-full max-w-sm"
      >
        <motion.form
          onSubmit={handleSubmit}
          animate={shake}
          className="rounded-[1.75rem] border border-white/40 bg-white/90 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-8"
        >
          <motion.img
            src="/logo.png"
            alt="El Baratillo"
            width="900"
            height="172"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
            className="mx-auto h-auto w-full max-w-[16rem]"
          />
          <h1 className="sr-only">El Baratillo</h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-inkfaint"
          >
            Minimercado · Carnicería
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
            className="mt-8"
          >
            <label htmlFor="login-password" className="sr-only">
              Contraseña
            </label>
            <div
              className={`group relative flex items-center rounded-2xl border-2 bg-white transition-colors ${
                error ? 'border-brick' : 'border-line focus-within:border-awning'
              }`}
            >
              <Lock
                size={18}
                className={`pointer-events-none absolute left-4 transition-colors ${
                  error ? 'text-brick' : 'text-inkfaint group-focus-within:text-awning'
                }`}
              />
              <input
                id="login-password"
                type={show ? 'text' : 'password'}
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Contraseña"
                className="w-full rounded-2xl bg-transparent py-3.5 pl-11 pr-12 text-base text-ink placeholder:text-inkfaint/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 rounded-xl p-2 text-inkfaint transition-colors hover:bg-paper2 hover:text-ink"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2 text-center text-sm font-medium text-brick"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.button
            type="submit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
            whileHover={{ scale: success ? 1 : 1.015 }}
            whileTap={{ scale: 0.98 }}
            className={`relative mt-5 flex h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-2xl font-semibold text-white shadow-[0_12px_28px_-10px_rgba(7,104,45,0.7)] transition-colors ${
              success ? 'bg-awning' : 'bg-gradient-to-r from-awning to-awning-dark'
            }`}
          >
            {/* Brillo que cruza el botón cada tanto. */}
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              initial={{ left: '-40%' }}
              animate={{ left: '140%' }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.8, ease: 'easeInOut' }}
            />
            <AnimatePresence mode="wait" initial={false}>
              {success ? (
                <motion.span
                  key="ok"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  className="relative"
                >
                  <Check size={24} strokeWidth={3} />
                </motion.span>
              ) : (
                <motion.span
                  key="go"
                  exit={{ opacity: 0, y: -8 }}
                  className="relative flex items-center gap-2"
                >
                  Entrar
                  <ArrowRight size={18} strokeWidth={2.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-6 text-center text-xs text-white/55"
        >
          Caja · Stock · Fiado
        </motion.p>
      </motion.div>
    </div>
  )
}

// Fondo: los colores del logo en manchas de luz que se mueven lento, más una
// trama de puntos apenas visible. Todo decorativo y sin interacción.
function Backdrop() {
  const blobs = [
    { color: 'bg-[#07682D]', size: 'h-[28rem] w-[28rem]', pos: '-left-32 -top-32', x: [0, 60, 0], y: [0, 40, 0], d: 16 },
    { color: 'bg-[#B5020A]', size: 'h-[24rem] w-[24rem]', pos: '-bottom-28 -right-24', x: [0, -50, 0], y: [0, -60, 0], d: 18 },
    { color: 'bg-[#3E9A5E]', size: 'h-[18rem] w-[18rem]', pos: 'right-[10%] top-[8%]', x: [0, -40, 0], y: [0, 50, 0], d: 20 },
  ]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full opacity-60 blur-3xl ${b.color} ${b.size} ${b.pos}`}
          animate={{ x: b.x, y: b.y, scale: [1, 1.12, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
    </div>
  )
}
