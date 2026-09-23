import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Institutional dark backgrounds — theme-able via CSS vars (see globals.css)
        bg: {
          deep:    'rgb(var(--c-bg-deep) / <alpha-value>)',
          base:    'rgb(var(--c-bg-base) / <alpha-value>)',
          card:    'rgb(var(--c-bg-card) / <alpha-value>)',
          elevated:'rgb(var(--c-bg-elevated) / <alpha-value>)',
          border:  'rgb(var(--c-bg-border) / <alpha-value>)',
        },
        // Text hierarchy — theme-able via CSS vars
        ink: {
          primary:   'rgb(var(--c-ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-ink-secondary) / <alpha-value>)',
          muted:     'rgb(var(--c-ink-muted) / <alpha-value>)',
          dim:       'rgb(var(--c-ink-dim) / <alpha-value>)',
        },
        // Agent / semantic colors — theme-able via CSS vars
        atlas:  { DEFAULT: 'rgb(var(--c-atlas) / <alpha-value>)',  dim: 'rgb(var(--c-atlas) / 0.125)',  glow: 'rgb(var(--c-atlas) / 0.25)' },
        nexus:  { DEFAULT: 'rgb(var(--c-nexus) / <alpha-value>)',  dim: 'rgb(var(--c-nexus) / 0.125)',  glow: 'rgb(var(--c-nexus) / 0.25)' },
        pulse:  { DEFAULT: 'rgb(var(--c-pulse) / <alpha-value>)',  dim: 'rgb(var(--c-pulse) / 0.125)',  glow: 'rgb(var(--c-pulse) / 0.25)' },
        oracle: { DEFAULT: 'rgb(var(--c-oracle) / <alpha-value>)', dim: 'rgb(var(--c-oracle) / 0.125)', glow: 'rgb(var(--c-oracle) / 0.25)' },

        // Semantic states — mapped onto the agent colors above so they follow the theme too
        bull:  'rgb(var(--c-atlas) / <alpha-value>)',
        bear:  'rgb(var(--c-bear) / <alpha-value>)',
        neutral: 'rgb(var(--c-neutral) / <alpha-value>)',
        strong: 'rgb(var(--c-atlas) / <alpha-value>)',
        operable: 'rgb(var(--c-oracle) / <alpha-value>)',
        mixed: 'rgb(var(--c-pulse) / <alpha-value>)',
        avoid: 'rgb(var(--c-bear) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'monospace'],
        display: ['var(--font-display)'],
        serif: ['IBM Plex Serif', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'atlas': '0 0 24px 0 rgb(var(--c-atlas) / 0.125)',
        'nexus': '0 0 24px 0 rgb(var(--c-nexus) / 0.125)',
        'pulse': '0 0 24px 0 rgb(var(--c-pulse) / 0.125)',
        'oracle': '0 0 24px 0 rgb(var(--c-oracle) / 0.125)',
        'card': '0 1px 3px 0 #00000060, 0 1px 2px -1px #00000040',
      },
      backgroundImage: {
        'grid-subtle': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%232E2A22' fill-opacity='0.4'%3E%3Cpath fill-rule='evenodd' d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
        'oracle-gradient': 'linear-gradient(135deg, rgb(var(--c-bg-deep)) 0%, rgb(var(--c-bg-base)) 50%, rgb(var(--c-bg-card)) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow-pulse': 'glowPulse 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.06)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
