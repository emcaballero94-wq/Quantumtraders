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
        // ─── Backgrounds ─────────────────────────────────────────
        bg: {
          void:    '#03040A',   // deepest black — body bg
          base:    '#06080F',   // main dark layer
          deep:    '#080C16',   // sidebar / panels
          card:    '#0D1120',   // card surfaces
          elevated:'#121828',   // hover / elevated state
          border:  '#1C2236',   // subtle edge separator
          glass:   '#0D112080', // glassmorphism tint
        },
        // ─── Ink / Text ───────────────────────────────────────────
        ink: {
          primary:   '#F0F2FA', // near-white — main text
          secondary: '#8A95B0', // secondary text
          muted:     '#4A5270', // labels / captions
          dim:       '#252D45', // disabled / decorative
        },
        // ─── Brand / Accent ───────────────────────────────────────
        // ATLAS — Emerald Cyan (technical, price action)
        atlas: {
          DEFAULT: '#00D4AA',
          bright:  '#00FFD0',
          dim:     '#00D4AA18',
          glow:    '#00D4AA30',
        },
        // ORACLE — Electric Blue (AI, insights)
        oracle: {
          DEFAULT: '#3B82F6',
          bright:  '#60A5FA',
          dim:     '#3B82F618',
          glow:    '#3B82F630',
        },
        // NEXUS — Violet (correlations, macro)
        nexus: {
          DEFAULT: '#8B5CF6',
          bright:  '#A78BFA',
          dim:     '#8B5CF618',
          glow:    '#8B5CF630',
        },
        // PULSE — Amber (alerts, sentiment)
        pulse: {
          DEFAULT: '#F59E0B',
          bright:  '#FCD34D',
          dim:     '#F59E0B18',
          glow:    '#F59E0B30',
        },
        // ─── Semantic States ──────────────────────────────────────
        bull:    '#10B981',   // green — long bias
        bear:    '#EF4444',   // red  — short bias
        caution: '#F59E0B',   // amber — warning
      },

      // ─── Typography ───────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem',    letterSpacing: '0.05em' }],
        '3xs': ['0.55rem',  { lineHeight: '0.875rem', letterSpacing: '0.06em' }],
      },

      // ─── Shadows / Glows ─────────────────────────────────────
      boxShadow: {
        'glow-atlas':  '0 0 0 1px #00D4AA20, 0 0 24px 0 #00D4AA18',
        'glow-oracle': '0 0 0 1px #3B82F620, 0 0 24px 0 #3B82F618',
        'glow-nexus':  '0 0 0 1px #8B5CF620, 0 0 24px 0 #8B5CF618',
        'glow-pulse':  '0 0 0 1px #F59E0B20, 0 0 24px 0 #F59E0B18',
        'panel':       '0 1px 3px 0 #00000080, inset 0 1px 0 0 #ffffff06',
        'float':       '0 8px 32px 0 #000000A0, 0 0 0 1px #1C223680',
      },

      // ─── Backgrounds ─────────────────────────────────────────
      backgroundImage: {
        // Subtle dot grid for depth
        'grid-dots': "radial-gradient(circle, #1C223620 1px, transparent 1px)",
        // Edge vignette
        'vignette':  "radial-gradient(ellipse at center, transparent 60%, #03040A 100%)",
        // Card shimmer gradient
        'card-surface': "linear-gradient(160deg, #121828 0%, #0D1120 40%, #080C16 100%)",
        // Sidebar gradient
        'sidebar-bg':   "linear-gradient(180deg, #080C16 0%, #06080F 100%)",
        // Oracle accent gradient
        'oracle-gradient': 'linear-gradient(135deg, #06080F 0%, #0A0F1E 100%)',
      },
      backgroundSize: {
        'dots': '24px 24px',
      },

      // ─── Animations ───────────────────────────────────────────
      animation: {
        'fade-in':       'fadeIn 0.25s ease-out',
        'slide-up':      'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast':    'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker':       'flicker 2s ease-in-out infinite',
        'scan':          'scan 4s linear infinite',
        'glow-pulse':    'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        slideInLeft: {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px 0 currentColor' },
          '50%':      { boxShadow: '0 0 24px 4px currentColor' },
        },
      },

      // ─── Border radius ────────────────────────────────────────
      borderRadius: {
        'sm': '4px',
        DEFAULT: '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}

export default config
