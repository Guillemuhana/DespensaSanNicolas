/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FDFAF5',
        paper2: '#F2ECDF',
        ink: '#1A1A1A',
        inkfaint: '#5C5850',
        awning: {
          DEFAULT: '#086AB3',
          dark: '#06508A',
          light: '#4A9AD4',
        },
        mustard: {
          DEFAULT: '#D52E28',
          dark: '#A8221D',
          light: '#E9827D',
        },
        brick: {
          DEFAULT: '#D52E28',
          dark: '#A8221D',
          light: '#E9827D',
        },
      },
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
