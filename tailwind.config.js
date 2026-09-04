/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Fondo crema rosado, el mismo aire del logo, para que el blanco de las
        // tarjetas resalte sin cortar.
        paper: '#FBF7F6',
        paper2: '#F4EBE9',
        surface: '#FFFFFF',
        line: '#EFE0DE',
        ink: '#2A2220',
        inkfaint: '#8A7472',
        // Rosé gold del logo: es el color de acción (botones, links, activos).
        // Conserva el nombre `awning` para no tocar los ~200 usos en la app.
        awning: {
          50: '#FCF4F3',
          100: '#F6E3E1',
          200: '#EBC7C3',
          400: '#D09E99',
          DEFAULT: '#B87B76',
          dark: '#9A5F5B',
          900: '#6E403D',
        },
        // Vino suave: alertas, faltantes y el botón de cobrar.
        brick: {
          50: '#FBF0F1',
          100: '#F5DCDF',
          200: '#E8BAC0',
          light: '#C27F86',
          DEFAULT: '#A65D63',
          dark: '#83454B',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.375rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(42, 34, 32, 0.04), 0 1px 3px rgba(42, 34, 32, 0.06)',
        lift: '0 2px 4px rgba(42, 34, 32, 0.04), 0 8px 24px -6px rgba(42, 34, 32, 0.12)',
        pop: '0 18px 48px -12px rgba(42, 34, 32, 0.26)',
        pay: '0 1px 2px rgba(166, 93, 99, 0.24), 0 10px 22px -8px rgba(166, 93, 99, 0.45)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rise: 'rise 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
