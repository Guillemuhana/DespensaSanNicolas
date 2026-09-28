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
        // Los dos colores del logo de El Baratillo. Los nombres `awning` y
        // `brick` vienen de la marca anterior y se quedan para no tocar los
        // cientos de usos: awning es el verde (acción, pagos), brick el rojo
        // (deuda, faltantes, cobrar).
        awning: {
          50: '#EEF8F1',
          100: '#D5EDDC',
          200: '#A8D5B5',
          400: '#3E9A5E',
          DEFAULT: '#07682D',
          dark: '#035620',
          900: '#023E17',
        },
        brick: {
          50: '#FDF0F0',
          100: '#F9DADB',
          200: '#F2B3B5',
          light: '#E0575C',
          DEFAULT: '#B5020A',
          dark: '#8C0208',
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
