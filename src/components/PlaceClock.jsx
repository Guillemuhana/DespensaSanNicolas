import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react'

// El local está en Córdoba capital. La hora se muestra con la zona de Córdoba
// aunque el aparato tenga otra configurada.
const PLACE = 'Córdoba'
const TIME_ZONE = 'America/Argentina/Cordoba'
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-31.4135&longitude=-64.1811' +
  '&current=temperature_2m,weather_code,is_day&timezone=America%2FArgentina%2FCordoba'
const WEATHER_EVERY_MS = 15 * 60 * 1000

/** Hora, fecha y temperatura del lugar, para el pie del menú. */
export default function PlaceClock({ compact = false }) {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState(null) // { temp, code, isDay }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(WEATHER_URL)
        if (!res.ok) return
        const data = await res.json()
        const c = data?.current
        if (!cancelled && c && Number.isFinite(c.temperature_2m)) {
          setWeather({ temp: Math.round(c.temperature_2m), code: c.weather_code, isDay: c.is_day === 1 })
        }
      } catch {
        // Sin internet o sin servicio: se muestra sólo la hora.
      }
    }
    load()
    const t = setInterval(load, WEATHER_EVERY_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const time = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE })
  const icon = weather ? weatherIcon(weather.code, weather.isDay) : null

  if (compact) {
    return (
      <div className="text-center">
        <p className="font-mono text-xs font-semibold tabular text-ink">{time}</p>
        {weather && <p className="font-mono text-[11px] tabular text-inkfaint">{weather.temp}°</p>}
      </div>
    )
  }

  const raw = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  })
  // Sólo la primera letra: `capitalize` de CSS daría "Jueves, 27 De Agosto".
  const date = raw.charAt(0).toUpperCase() + raw.slice(1)

  return (
    <div className="mt-0.5 text-xs text-inkfaint">
      <p className="truncate">{date}</p>
      <p className="mt-1 flex items-center gap-1.5">
        <span className="font-mono text-sm font-semibold tabular text-ink">{time}</span>
        {weather && (
          <>
            <span aria-hidden="true">·</span>
            {icon}
            <span className="font-mono font-semibold tabular text-ink">{weather.temp}°C</span>
          </>
        )}
        <span className="truncate">en {PLACE}</span>
      </p>
    </div>
  )
}

function weatherIcon(code, isDay) {
  const Icon = weatherIconType(code, isDay)
  return <Icon size={14} strokeWidth={2.2} className="shrink-0 text-awning" />
}

// Códigos WMO que devuelve Open-Meteo.
function weatherIconType(code, isDay) {
  if (code === 0) return isDay ? Sun : Moon
  if (code <= 2) return CloudSun
  if (code === 3) return Cloud
  if (code === 45 || code === 48) return CloudFog
  if (code >= 51 && code <= 57) return CloudDrizzle
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow
  if (code >= 95) return CloudLightning
  return Cloud
}
