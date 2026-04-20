/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:   ['Inter', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Inter', 'sans-serif'],
        mono:   ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontFeatureSettings: {
        tnum: '"tnum"',
      },
      colors: {
        bg: {
          DEFAULT:  '#F6F7F9',
          soft:     '#EEF0F3',
          raised:   '#FFFFFF',
          sidebar:  '#FFFFFF',
          // legacy aliases
          primary:  '#F6F7F9',
          surface:  '#FFFFFF',
          elevated: '#FFFFFF',
        },
        border: {
          DEFAULT: '#D8DCE2',
          strong:  '#B5BBC4',
          faint:   '#E6E9ED',
        },
        text: {
          DEFAULT: '#0F172A',
          soft:    '#334155',
          muted:   '#64748B',
          faint:   '#94A3B8',
        },
        ink: {
          primary:   '#0F172A',
          secondary: '#334155',
          muted:     '#64748B',
        },
        primary: {
          DEFAULT: '#2563EB',
          hover:   '#1D4ED8',
          soft:    'rgba(37,99,235,0.08)',
          ring:    'rgba(37,99,235,0.28)',
        },
        accent: {
          DEFAULT: '#2563EB',
        },
        status: {
          'received-bg':  'rgba(37,99,235,0.08)',   'received-fg':  '#1D4ED8',
          'inspect-bg':   'rgba(147,51,234,0.08)',  'inspect-fg':   '#6B21A8',
          'waiting-bg':   'rgba(217,119,6,0.10)',   'waiting-fg':   '#92400E',
          'repair-bg':    'rgba(37,99,235,0.08)',   'repair-fg':    '#1E40AF',
          'quality-bg':   'rgba(71,85,105,0.10)',   'quality-fg':   '#334155',
          'ready-bg':     'rgba(22,163,74,0.10)',   'ready-fg':     '#166534',
          'delivered-bg': 'rgba(100,116,139,0.10)', 'delivered-fg': '#475569',
        },
      },
      borderColor: {
        DEFAULT: '#D8DCE2',
      },
      borderRadius: {
        none: '0',
        xs:  '2px',
        sm:  '2px',
        DEFAULT: '2px',
        md:  '4px',
        lg:  '4px',
      },
      boxShadow: {
        none: 'none',
        sm:  '0 1px 0 0 #D8DCE2',
        DEFAULT: '0 0 0 1px #D8DCE2',
        md:  '0 0 0 1px #D8DCE2',
        lg:  '0 0 0 1px #B5BBC4',
        hairline: '0 0 0 1px #D8DCE2',
        focus: '0 0 0 2px rgba(37,99,235,0.28)',
      },
    },
  },
  plugins: [],
}
