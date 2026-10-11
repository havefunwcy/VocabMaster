/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7f4',
          100: '#e1ede6',
          200: '#c5dcd0',
          300: '#9ec3b1',
          400: '#73a58e',
          500: '#4a8c6f',
          600: '#3c735b',
          700: '#325d4a',
          800: '#2a4b3d',
          900: '#233e33',
        },
        neu: {
          bg: 'var(--neu-bg)',
          alt: 'var(--neu-bg-alt)',
          main: 'var(--neu-text-main)',
          sub: 'var(--neu-text-sub)',
          muted: 'var(--neu-text-muted)',
          sage: 'var(--neu-sage)',
          amber: 'var(--neu-amber)',
          coral: 'var(--neu-coral)',
          steel: 'var(--neu-steel)',
        }
      },
      boxShadow: {
        'neu-panel': '9px 9px 18px var(--neu-shadow-dark), -9px -9px 18px var(--neu-shadow-light)',
        'neu-card': '6px 6px 13px var(--neu-shadow-dark), -6px -6px 13px var(--neu-shadow-light)',
        'neu-raised': '4px 4px 9px var(--neu-shadow-dark), -4px -4px 9px var(--neu-shadow-light)',
        'neu-sm': '2.5px 2.5px 5.5px var(--neu-shadow-dark), -2.5px -2.5px 5.5px var(--neu-shadow-light)',
        'neu-inset': 'inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)',
        'neu-inset-sm': 'inset 2.5px 2.5px 5px var(--neu-shadow-dark), inset -2.5px -2.5px 5px var(--neu-shadow-light)',
        'neu-inset-deep': 'inset 6px 6px 12px var(--neu-shadow-dark), inset -6px -6px 12px var(--neu-shadow-light)',
        'neu-pressed': 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-up': 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        }
      }
    },
  },
  plugins: [],
}
