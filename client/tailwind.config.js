/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Almarai', 'sans-serif'],
        sans:   ['Almarai', 'Inter', 'sans-serif'],
        mono:   ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontFeatureSettings: {
        tnum: '"tnum"',
      },
      colors: {
        bg: {
          DEFAULT:  '#F7F8FA',
          soft:     '#F2F3F6',
          raised:   '#FFFFFF',
          sidebar:  '#FBFBFC',
          // legacy aliases
          primary:  '#F7F8FA',
          surface:  '#FFFFFF',
          elevated: '#FFFFFF',
        },
        border: {
          DEFAULT: '#EAECEF',
          strong:  '#D7DBE0',
          faint:   '#F0F1F3',
        },
        text: {
          DEFAULT: '#1A1D21',
          soft:    '#4B5563',
          muted:   '#6B7280',
          faint:   '#9AA0A6',
        },
        // legacy `ink.*` aliases — keep existing classes working
        ink: {
          primary:   '#1A1D21',
          secondary: '#4B5563',
          muted:     '#6B7280',
        },
        primary: {
          DEFAULT: '#2980B9',
          hover:   '#1A6EA0',
          soft:    'rgba(41,128,185,0.08)',
          ring:    'rgba(41,128,185,0.18)',
        },
        accent: {
          DEFAULT: '#86D7F7',
        },
        status: {
          'received-bg':  '#EFF6FF',  'received-fg':  '#2980B9',
          'inspect-bg':   '#FEF3C7',  'inspect-fg':   '#92400E',
          'waiting-bg':   '#FEF3C7',  'waiting-fg':   '#B45309',
          'repair-bg':    '#DBEAFE',  'repair-fg':    '#1E40AF',
          'quality-bg':   '#F3E8FF',  'quality-fg':   '#6B21A8',
          'ready-bg':     '#DCFCE7',  'ready-fg':     '#166534',
          'delivered-bg': '#E5E7EB',  'delivered-fg': '#374151',
        },
      },
      borderColor: {
        DEFAULT: '#EAECEF',
      },
      borderRadius: {
        sm:  '4px',
        DEFAULT: '6px',
        md:  '8px',
        lg:  '10px',
      },
      boxShadow: {
        sm:  '0 1px 2px rgba(10,12,15,0.04)',
        DEFAULT: '0 2px 6px rgba(10,12,15,0.06), 0 1px 2px rgba(10,12,15,0.04)',
        md:  '0 2px 6px rgba(10,12,15,0.06), 0 1px 2px rgba(10,12,15,0.04)',
        lg:  '0 8px 24px rgba(10,12,15,0.08)',
      },
    },
  },
  plugins: [],
}
