/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      /* ── 색상 (CSS 변수 기반) ── */
      colors: {
        brand: {
          50:  'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          300: 'var(--color-brand-300)',
          400: 'var(--color-brand-400)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          800: 'var(--color-brand-800)',
          900: 'var(--color-brand-900)',
        },
        status: {
          success:          'var(--color-status-success)',
          'success-light':  'var(--color-status-success-light)',
          'success-border': 'var(--color-status-success-border)',
          danger:           'var(--color-status-danger)',
          'danger-light':   'var(--color-status-danger-light)',
          'danger-border':  'var(--color-status-danger-border)',
          warning:          'var(--color-status-warning)',
          'warning-light':  'var(--color-status-warning-light)',
          'warning-border': 'var(--color-status-warning-border)',
          info:             'var(--color-status-info)',
          'info-light':     'var(--color-status-info-light)',
          'info-border':    'var(--color-status-info-border)',
        },
        surface: {
          page:    'var(--color-surface-page)',
          card:    'var(--color-surface-card)',
          raised:  'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
        },
        line: {
          DEFAULT: 'var(--color-line)',
          light:   'var(--color-line-light)',
          heavy:   'var(--color-line-heavy)',
        },
        content: {
          primary:   'var(--color-content-primary)',
          secondary: 'var(--color-content-secondary)',
          tertiary:  'var(--color-content-tertiary)',
          inverse:   'var(--color-content-inverse)',
          link:      'var(--color-content-link)',
        },
      },

      /* ── 타이포그래피 ── */
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      fontSize: {
        'heading-xl': ['1.75rem',   { lineHeight: '2.25rem',  fontWeight: '700', letterSpacing: '-0.025em' }],
        'heading-lg': ['1.375rem',  { lineHeight: '1.875rem', fontWeight: '600', letterSpacing: '-0.02em' }],
        'heading-md': ['1.125rem',  { lineHeight: '1.625rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'heading-sm': ['0.875rem',  { lineHeight: '1.375rem', fontWeight: '500' }],
        'body-base':  ['0.875rem',  { lineHeight: '1.5rem',   fontWeight: '400' }],
        'body-sm':    ['0.75rem',   { lineHeight: '1.25rem',  fontWeight: '400' }],
        'caption':    ['0.6875rem', { lineHeight: '1rem',     fontWeight: '500', letterSpacing: '0.01em' }],
        'overline':   ['0.625rem',  { lineHeight: '1rem',     fontWeight: '600', letterSpacing: '0.05em' }],
      },

      /* ── 간격 ── */
      spacing: {
        'page-x':       '1.5rem',
        'page-y':       '2rem',
        'card-x':       '1.5rem',
        'card-y':       '1rem',
        'section-gap':  '1.5rem',
        'element-gap':  '0.75rem',
      },

      /* ── 둥글기 ── */
      borderRadius: {
        'card':   '0.75rem',
        'button': '0.5rem',
        'input':  '0.5rem',
        'badge':  '9999px',
        'modal':  '1rem',
      },

      /* ── 그림자 ── */
      boxShadow: {
        'card':          'var(--shadow-card)',
        'card-hover':    'var(--shadow-card-hover)',
        'card-elevated': 'var(--shadow-card-elevated)',
        'modal':         'var(--shadow-modal)',
        'nav':           'var(--shadow-nav)',
        'dropdown':      '0 4px 12px rgba(0, 0, 0, 0.15)',
      },

      /* ── 애니메이션 ── */
      transitionDuration: {
        'fast':   '100ms',
        'normal': '200ms',
        'slow':   '300ms',
      },

      /* ── 레이아웃 ── */
      maxWidth: {
        'content': '80rem',
      },

      /* ── z-index ── */
      zIndex: {
        'nav':            '30',
        'dropdown':       '35',
        'modal-backdrop': '40',
        'modal':          '50',
        'tooltip':        '55',
        'toast':          '60',
      },
    },
  },
  plugins: [],
};
