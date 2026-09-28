/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Fondo de papel, apenas cálido, para que el blanco de las tarjetas resalte.
        paper: '#F7F4EE',
        paper2: '#EFEAE0',
        surface: '#FFFFFF',
        line: '#E5DED2',
        ink: '#171310',
        inkfaint: '#6E675C',
        // Los dos colores de la bolsa del logo.
        awning: {
          50: '#EEF6FC',
          100: '#D6EAF7',
          200: '#A9D2ED',
          400: '#4A9AD4',
          DEFAULT: '#086AB3',
          dark: '#054E85',
          900: '#043A63',
        },
        brick: {
          50: '#FDF0EF',
          100: '#FADEDC',
          200: '#F3B9B6',
          light: '#E9827D',
          DEFAULT: '#D52E28',
          dark: '#A8221D',
        },
      },
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 19, 16, 0.04), 0 1px 3px rgba(23, 19, 16, 0.06)',
        lift: '0 2px 4px rgba(23, 19, 16, 0.04), 0 8px 24px -6px rgba(23, 19, 16, 0.14)',
        pop: '0 18px 48px -12px rgba(23, 19, 16, 0.32)',
        pay: '0 1px 2px rgba(168, 34, 29, 0.28), 0 10px 22px -8px rgba(168, 34, 29, 0.55)',
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
