/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Almarai', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: {
          primary: '#16120D',
          surface: '#1F1A13',
          elevated: '#2A2218',
        },
        gold: {
          DEFAULT: '#C9A84C',
          bright: '#E8C96A',
          muted: '#8B7335',
          subtle: 'rgba(201,168,76,0.15)',
        },
        ink: {
          primary: '#F5EFE0',
          secondary: '#A89880',
          muted: '#6B5D4F',
        },
      },
      borderColor: {
        gold: 'rgba(201,168,76,0.25)',
      },
    },
  },
  plugins: [],
}
