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
        // Institutional dark backgrounds — warm charcoal (Wall Street Gold)
        bg: {
          deep:    '#0A0908',
          base:    '#0F0D0A',
          card:    '#161310',
          elevated:'#1C1815',
          border:  '#2E2A22',
        },
        // Text hierarchy — warm off-white / tan
        ink: {
          primary:   '#F3EFE7',
          secondary: '#B8AD98',
          muted:     '#7A6F5C',
          dim:       '#3A342A',
        },
        // Agent / semantic colors
        atlas:  { DEFAULT: '#10B981', dim: '#10B98120', glow: '#10B98140' },
        nexus:  { DEFAULT: '#7C3AED', dim: '#7C3AED20', glow: '#7C3AED40' },
        pulse:  { DEFAULT: '#F97316', dim: '#F9731620', glow: '#F9731640' },
        oracle: { DEFAULT: '#E8B44C', dim: '#E8B44C20', glow: '#E8B44C40' },

        // Semantic states
        bull:  '#10B981',
        bear:  '#EF4444',
        neutral: '#A69C88',
        strong: '#10B981',
        operable: '#E8B44C',
        mixed: '#F97316',
        avoid: '#EF4444',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
        serif: ['IBM Plex Serif', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'atlas': '0 0 24px 0 #10B98120',
        'nexus': '0 0 24px 0 #7C3AED20',
        'pulse': '0 0 24px 0 #F9731620',
        'oracle': '0 0 24px 0 #E8B44C20',
        'card': '0 1px 3px 0 #00000060, 0 1px 2px -1px #00000040',
      },
      backgroundImage: {
        'grid-subtle': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%232E2A22' fill-opacity='0.4'%3E%3Cpath fill-rule='evenodd' d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
        'oracle-gradient': 'linear-gradient(135deg, #0A0908 0%, #0F0D0A 50%, #161310 100%)',
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
