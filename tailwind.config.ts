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
        // Institutional dark backgrounds
        bg: {
          deep:    '#04050A',
          base:    '#080B12',
          card:    '#0D1017',
          elevated:'#12161F',
          border:  '#1A1F2E',
        },
        // Text hierarchy
        ink: {
          primary:   '#EEF0F5',
          secondary: '#8892A4',
          muted:     '#4D5566',
          dim:       '#2A303D',
        },
        // Agent / semantic colors
        atlas:  { DEFAULT: '#00C9A7', dim: '#00C9A720', glow: '#00C9A740' },
        nexus:  { DEFAULT: '#7C3AED', dim: '#7C3AED20', glow: '#7C3AED40' },
        pulse:  { DEFAULT: '#F59E0B', dim: '#F59E0B20', glow: '#F59E0B40' },
        oracle: { DEFAULT: '#3B82F6', dim: '#3B82F620', glow: '#3B82F640' },

        // Semantic states
        bull:  '#00C9A7',
        bear:  '#EF4444',
        neutral: '#8892A4',
        strong: '#00C9A7',
        operable: '#3B82F6',
        mixed: '#F59E0B',
        avoid: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'atlas': '0 0 24px 0 #00C9A720',
        'nexus': '0 0 24px 0 #7C3AED20',
        'pulse': '0 0 24px 0 #F59E0B20',
        'oracle': '0 0 24px 0 #3B82F620',
        'card': '0 1px 3px 0 #00000060, 0 1px 2px -1px #00000040',
      },
      backgroundImage: {
        'grid-subtle': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231A1F2E' fill-opacity='0.4'%3E%3Cpath fill-rule='evenodd' d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
        'oracle-gradient': 'linear-gradient(135deg, #04050A 0%, #080B12 50%, #0D1017 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
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
      },
    },
  },
  plugins: [],
}

export default config
