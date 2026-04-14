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
          primary: '#F3F4F6',
          surface: '#FFFFFF',
          elevated: '#FFFFFF',
        },
        primary: {
          DEFAULT: '#2980B9',
          hover: '#1A6EA0',
          soft: 'rgba(41,128,185,0.08)',
        },
        accent: {
          DEFAULT: '#86D7F7',
        },
        ink: {
          primary: '#222222',
          secondary: '#2D3436',
          muted: '#9CA3AF',
        },
      },
      borderColor: {
        DEFAULT: '#E5E7EB',
      },
    },
  },
  plugins: [],
}
